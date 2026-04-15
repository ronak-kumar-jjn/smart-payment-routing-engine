import os
import json
import time
from datetime import datetime
from typing import Optional, List

import numpy as np
import redis
import psycopg2
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="SmartRoute ML Service",
    description="AI-powered fraud detection and routing prediction",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Configuration ────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://smartroute:smartroute123@localhost:5432/smartroute")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MODEL_PATH = os.getenv("MODEL_PATH", "./models")

# ─── Model Storage ────────────────────────────────────────────
models = {
    "fraud_detector": None,
    "fraud_scaler": None,
    "fraud_features": None,
    "routing_predictor": None,
    "routing_scaler": None,
    "routing_features": None,
    "routing_gateways": None,
}

def load_models():
    """Load trained ML models from disk"""
    global models
    
    try:
        fraud_path = os.path.join(MODEL_PATH, "fraud_detector.joblib")
        if os.path.exists(fraud_path):
            models["fraud_detector"] = joblib.load(fraud_path)
            models["fraud_scaler"] = joblib.load(os.path.join(MODEL_PATH, "fraud_scaler.joblib"))
            models["fraud_features"] = joblib.load(os.path.join(MODEL_PATH, "fraud_features.joblib"))
            print("✅ Fraud detection model loaded")
        else:
            print("⚠️ Fraud model not found - using rule-based fallback")
    except Exception as e:
        print(f"❌ Error loading fraud model: {e}")

    try:
        routing_path = os.path.join(MODEL_PATH, "routing_predictor.joblib")
        if os.path.exists(routing_path):
            models["routing_predictor"] = joblib.load(routing_path)
            models["routing_scaler"] = joblib.load(os.path.join(MODEL_PATH, "routing_scaler.joblib"))
            models["routing_features"] = joblib.load(os.path.join(MODEL_PATH, "routing_features.joblib"))
            models["routing_gateways"] = joblib.load(os.path.join(MODEL_PATH, "routing_gateways.joblib"))
            print("✅ Routing prediction model loaded")
        else:
            print("⚠️ Routing model not found - using rule-based fallback")
    except Exception as e:
        print(f"❌ Error loading routing model: {e}")

# Load models on startup
@app.on_event("startup")
async def startup():
    load_models()

# ─── Connection helpers ───────────────────────────────────────
def get_db():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"❌ DB connection error: {e}")
        return None

def get_redis():
    try:
        r = redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        return r
    except Exception as e:
        print(f"❌ Redis connection error: {e}")
        return None

# ─── Request/Response Models ─────────────────────────────────
class FraudRequest(BaseModel):
    transaction_id: Optional[str] = None
    amount: float
    payment_method: str
    customer_id: Optional[str] = None
    ip_address: Optional[str] = None
    hour_of_day: Optional[int] = None
    is_international: Optional[bool] = False
    transaction_frequency: Optional[int] = 3
    avg_amount_deviation: Optional[float] = 0.0
    is_new_customer: Optional[bool] = False
    failed_attempts_24h: Optional[int] = 0
    unique_ips_24h: Optional[int] = 1

class FraudResponse(BaseModel):
    fraud_score: float
    risk_level: str
    is_fraudulent: bool
    confidence: float
    features_used: dict
    model_version: str
    inference_time_ms: float

class RoutingRequest(BaseModel):
    amount: float
    payment_method: str
    currency: str = "INR"
    customer_id: Optional[str] = None
    priority: str = "balanced"
    fraud_score: Optional[float] = 0.1
    hour_of_day: Optional[int] = None

class RoutingResponse(BaseModel):
    recommended_gateway: str
    confidence: float
    scores: dict
    reasoning: str
    alternatives: list
    model_version: str
    inference_time_ms: float

class TrainRequest(BaseModel):
    fraud_samples: int = 5000
    routing_samples: int = 10000

class BatchFraudRequest(BaseModel):
    transactions: List[FraudRequest]

# ─── Payment method encoding ─────────────────────────────────
PAYMENT_METHOD_MAP = {
    'credit_card': 0,
    'debit_card': 1,
    'upi': 2,
    'net_banking': 3,
    'wallet': 4,
    'emi': 3,  # map to net_banking
}

# ─── Health Check ─────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "SmartRoute ML Service",
        "version": "2.0.0",
        "status": "running",
        "models": {
            "fraud_detector": "loaded" if models["fraud_detector"] is not None else "not_loaded",
            "routing_predictor": "loaded" if models["routing_predictor"] is not None else "not_loaded",
        },
    }

@app.get("/health")
def health():
    checks = {
        "service": "SmartRoute ML Service",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {}
    }

    db = get_db()
    if db:
        checks["checks"]["database"] = {"status": "healthy"}
        db.close()
    else:
        checks["checks"]["database"] = {"status": "unhealthy"}
        checks["status"] = "degraded"

    r = get_redis()
    if r:
        checks["checks"]["redis"] = {"status": "healthy"}
    else:
        checks["checks"]["redis"] = {"status": "unhealthy"}
        checks["status"] = "degraded"

    checks["checks"]["models"] = {
        "fraud_detector": "loaded" if models["fraud_detector"] is not None else "not_trained",
        "routing_predictor": "loaded" if models["routing_predictor"] is not None else "not_trained",
    }

    return checks

# ─── Fraud Detection ─────────────────────────────────────────
@app.post("/predict/fraud", response_model=FraudResponse)
def predict_fraud(req: FraudRequest):
    """Predict fraud score using Isolation Forest model"""
    start_time = time.time()
    
    hour = req.hour_of_day if req.hour_of_day is not None else datetime.now().hour
    method_encoded = PAYMENT_METHOD_MAP.get(req.payment_method, 0)
    
    if models["fraud_detector"] is not None:
        # ML-based prediction
        features = np.array([[
            req.amount,
            hour,
            method_encoded,
            int(req.is_international or False),
            req.transaction_frequency or 3,
            req.avg_amount_deviation or 0.0,
            int(req.is_new_customer or False),
            req.failed_attempts_24h or 0,
            req.unique_ips_24h or 1,
        ]])
        
        features_scaled = models["fraud_scaler"].transform(features)
        
        # Get anomaly score (raw score from Isolation Forest)
        raw_score = models["fraud_detector"].decision_function(features_scaled)[0]
        prediction = models["fraud_detector"].predict(features_scaled)[0]
        
        # Convert to 0-1 fraud probability
        # Isolation Forest: more negative = more anomalous
        # Typical range: -0.5 to 0.5
        fraud_score = max(0, min(1, 0.5 - raw_score))
        
        # Boost score based on additional signals
        if req.amount > 50000:
            fraud_score = min(1, fraud_score + 0.1)
        if req.is_international:
            fraud_score = min(1, fraud_score + 0.08)
        if (req.failed_attempts_24h or 0) > 3:
            fraud_score = min(1, fraud_score + 0.12)
        if (req.unique_ips_24h or 1) > 3:
            fraud_score = min(1, fraud_score + 0.1)
        
        model_version = "isolation_forest_v1"
        confidence = 0.85
    else:
        # Rule-based fallback
        fraud_score = 0.1
        if req.amount > 50000: fraud_score += 0.3
        elif req.amount > 20000: fraud_score += 0.15
        elif req.amount > 10000: fraud_score += 0.05
        if req.is_international: fraud_score += 0.2
        if hour >= 0 and hour <= 5: fraud_score += 0.15
        if (req.failed_attempts_24h or 0) > 2: fraud_score += 0.15
        fraud_score = min(fraud_score, 1.0)
        model_version = "rule_based_v1"
        confidence = 0.65
    
    risk_level = (
        "low" if fraud_score < 0.3 else
        "medium" if fraud_score < 0.6 else
        "high" if fraud_score < 0.8 else
        "critical"
    )
    
    inference_time = (time.time() - start_time) * 1000

    return FraudResponse(
        fraud_score=round(fraud_score, 4),
        risk_level=risk_level,
        is_fraudulent=fraud_score >= 0.7,
        confidence=confidence,
        features_used={
            "amount": req.amount,
            "payment_method": req.payment_method,
            "is_international": req.is_international,
            "hour_of_day": hour,
            "transaction_frequency": req.transaction_frequency,
            "failed_attempts_24h": req.failed_attempts_24h,
            "unique_ips_24h": req.unique_ips_24h,
        },
        model_version=model_version,
        inference_time_ms=round(inference_time, 2),
    )

# ─── Batch Fraud Detection ───────────────────────────────────
@app.post("/predict/fraud/batch")
def predict_fraud_batch(req: BatchFraudRequest):
    """Predict fraud scores for multiple transactions"""
    results = []
    for txn in req.transactions:
        result = predict_fraud(txn)
        results.append(result.dict())
    
    fraud_count = sum(1 for r in results if r["is_fraudulent"])
    
    return {
        "total": len(results),
        "fraudulent": fraud_count,
        "clean": len(results) - fraud_count,
        "avg_score": round(sum(r["fraud_score"] for r in results) / len(results), 4),
        "results": results,
    }

# ─── Routing Prediction ──────────────────────────────────────
@app.post("/predict/routing", response_model=RoutingResponse)
def predict_routing(req: RoutingRequest):
    """Predict optimal gateway using XGBoost model"""
    start_time = time.time()
    
    hour = req.hour_of_day if req.hour_of_day is not None else datetime.now().hour
    method_encoded = PAYMENT_METHOD_MAP.get(req.payment_method, 0)
    currency_is_inr = 1 if req.currency == "INR" else 0
    
    gateway_names = ['razorpay', 'stripe', 'payu', 'cashfree']
    
    if models["routing_predictor"] is not None:
        # ML-based prediction
        features = np.array([[
            req.amount,
            method_encoded,
            currency_is_inr,
            hour,
            req.fraud_score or 0.1,
        ]])
        
        features_scaled = models["routing_scaler"].transform(features)
        
        # Get probabilities for each gateway
        probabilities = models["routing_predictor"].predict_proba(features_scaled)[0]
        predicted_class = models["routing_predictor"].predict(features_scaled)[0]
        
        gateways = models["routing_gateways"]
        scores = {gw: round(float(prob), 4) for gw, prob in zip(gateways, probabilities)}
        
        recommended = gateways[predicted_class]
        confidence = float(probabilities[predicted_class])
        
        model_version = "xgboost_v1"
    else:
        # Rule-based fallback
        scores = {}
        gateway_stats = {
            "razorpay": {"cost": 0.02, "speed": 0.9, "reliability": 0.965},
            "stripe": {"cost": 0.029, "speed": 0.85, "reliability": 0.978},
            "payu": {"cost": 0.018, "speed": 0.8, "reliability": 0.942},
            "cashfree": {"cost": 0.0195, "speed": 0.87, "reliability": 0.951},
        }
        
        for name, stats in gateway_stats.items():
            if req.priority == "cost":
                scores[name] = 1 - stats["cost"]
            elif req.priority == "speed":
                scores[name] = stats["speed"]
            elif req.priority == "reliability":
                scores[name] = stats["reliability"]
            else:
                scores[name] = (1 - stats["cost"]) * 0.3 + stats["speed"] * 0.3 + stats["reliability"] * 0.4
        
        if req.payment_method == "upi":
            scores["razorpay"] = scores.get("razorpay", 0) * 1.15
            scores["stripe"] = scores.get("stripe", 0) * 0.7
        if req.currency != "INR":
            scores["stripe"] = scores.get("stripe", 0) * 1.2
        
        recommended = max(scores, key=scores.get)
        total = sum(scores.values())
        scores = {k: round(v / total, 4) for k, v in scores.items()}
        confidence = scores[recommended]
        model_version = "rule_based_v1"
    
    sorted_gateways = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    alternatives = [{"gateway": g, "score": s} for g, s in sorted_gateways if g != recommended][:3]
    
    inference_time = (time.time() - start_time) * 1000
    
    return RoutingResponse(
        recommended_gateway=recommended,
        confidence=round(confidence, 4),
        scores=scores,
        reasoning=f"ML model ({model_version}) selected {recommended} with {confidence:.1%} confidence for {req.payment_method} ₹{req.amount:.0f}",
        alternatives=alternatives,
        model_version=model_version,
        inference_time_ms=round(inference_time, 2),
    )

# ─── Model Training ──────────────────────────────────────────
@app.post("/train")
def train_models(req: TrainRequest = TrainRequest()):
    """Trigger model training"""
    from train_models import train_fraud_model, train_routing_model
    
    fraud_meta = train_fraud_model()
    routing_meta = train_routing_model()
    
    # Reload models
    load_models()
    
    return {
        "success": True,
        "fraud_model": fraud_meta,
        "routing_model": routing_meta,
    }

# ─── Model Status ────────────────────────────────────────────
@app.get("/models/status")
def models_status():
    """Get detailed model status and metadata"""
    result = {}
    
    # Fraud model
    fraud_meta_path = os.path.join(MODEL_PATH, "fraud_metadata.json")
    if os.path.exists(fraud_meta_path):
        with open(fraud_meta_path) as f:
            result["fraud_detector"] = json.load(f)
        result["fraud_detector"]["status"] = "loaded" if models["fraud_detector"] is not None else "saved_not_loaded"
    else:
        result["fraud_detector"] = {"status": "not_trained", "type": "IsolationForest"}
    
    # Routing model
    routing_meta_path = os.path.join(MODEL_PATH, "routing_metadata.json")
    if os.path.exists(routing_meta_path):
        with open(routing_meta_path) as f:
            result["routing_predictor"] = json.load(f)
        result["routing_predictor"]["status"] = "loaded" if models["routing_predictor"] is not None else "saved_not_loaded"
    else:
        result["routing_predictor"] = {"status": "not_trained", "type": "XGBClassifier"}
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
