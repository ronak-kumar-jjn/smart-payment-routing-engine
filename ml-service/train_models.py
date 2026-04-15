"""
SmartRoute ML Models - Phase 3
Train Isolation Forest for fraud detection and XGBoost for routing prediction
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import LabelEncoder, StandardScaler
import xgboost as xgb
import joblib
from datetime import datetime

MODEL_PATH = os.getenv("MODEL_PATH", "./models")
os.makedirs(MODEL_PATH, exist_ok=True)


def generate_fraud_training_data(n_samples: int = 5000) -> pd.DataFrame:
    """Generate synthetic transaction data for fraud detection training"""
    np.random.seed(42)
    
    # Normal transactions (95%)
    n_normal = int(n_samples * 0.95)
    # Fraudulent transactions (5%)
    n_fraud = n_samples - n_normal
    
    # Normal transactions
    normal_data = {
        'amount': np.random.lognormal(7, 1.2, n_normal).clip(50, 200000),
        'hour_of_day': np.random.choice(range(6, 23), n_normal, 
                                          p=[0.02, 0.05, 0.08, 0.1, 0.12, 0.12, 0.1, 0.08, 0.08, 0.07, 0.06, 0.04, 0.03, 0.02, 0.01, 0.01, 0.01]),
        'payment_method': np.random.choice([0, 1, 2, 3, 4], n_normal, p=[0.2, 0.3, 0.25, 0.15, 0.1]),
        'is_international': np.random.choice([0, 1], n_normal, p=[0.9, 0.1]),
        'transaction_frequency': np.random.poisson(3, n_normal).clip(0, 20),
        'avg_amount_deviation': np.random.normal(0, 0.3, n_normal).clip(-1, 1),
        'is_new_customer': np.random.choice([0, 1], n_normal, p=[0.8, 0.2]),
        'failed_attempts_24h': np.random.poisson(0.2, n_normal).clip(0, 5),
        'unique_ips_24h': np.random.poisson(1.2, n_normal).clip(1, 5),
        'is_fraud': np.zeros(n_normal),
    }
    
    # Fraudulent transactions - different patterns
    fraud_data = {
        'amount': np.random.lognormal(9, 1.5, n_fraud).clip(5000, 500000),  # Higher amounts
        'hour_of_day': np.random.randint(0, 24, n_fraud),  # Random hour distribution
        'payment_method': np.random.choice([0, 1, 2, 3, 4], n_fraud, p=[0.4, 0.3, 0.1, 0.1, 0.1]),
        'is_international': np.random.choice([0, 1], n_fraud, p=[0.4, 0.6]),  # More international
        'transaction_frequency': np.random.poisson(8, n_fraud).clip(3, 30),   # More frequent
        'avg_amount_deviation': np.random.normal(2, 0.8, n_fraud).clip(0.5, 5),  # High deviation
        'is_new_customer': np.random.choice([0, 1], n_fraud, p=[0.3, 0.7]),   # More new customers
        'failed_attempts_24h': np.random.poisson(3, n_fraud).clip(1, 10),      # More failed attempts
        'unique_ips_24h': np.random.poisson(4, n_fraud).clip(2, 15),          # Multiple IPs
        'is_fraud': np.ones(n_fraud),
    }
    
    normal_df = pd.DataFrame(normal_data)
    fraud_df = pd.DataFrame(fraud_data)
    
    df = pd.concat([normal_df, fraud_df], ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    return df


def train_fraud_model():
    """Train Isolation Forest model for fraud detection"""
    print("🔮 Training Fraud Detection Model (Isolation Forest)...")
    
    df = generate_fraud_training_data(5000)
    
    feature_cols = ['amount', 'hour_of_day', 'payment_method', 'is_international',
                    'transaction_frequency', 'avg_amount_deviation', 'is_new_customer',
                    'failed_attempts_24h', 'unique_ips_24h']
    
    X = df[feature_cols].values
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train Isolation Forest
    model = IsolationForest(
        n_estimators=200,
        max_samples='auto',
        contamination=0.05,
        max_features=1.0,
        random_state=42,
        n_jobs=-1,
    )
    
    model.fit(X_scaled)
    
    # Evaluate
    scores = model.decision_function(X_scaled)
    predictions = model.predict(X_scaled)
    
    # Calculate metrics
    anomaly_mask = predictions == -1
    actual_fraud = df['is_fraud'].values == 1
    
    tp = np.sum(anomaly_mask & actual_fraud)
    fp = np.sum(anomaly_mask & ~actual_fraud)
    fn = np.sum(~anomaly_mask & actual_fraud)
    tn = np.sum(~anomaly_mask & ~actual_fraud)
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    
    print(f"   Precision: {precision:.4f}")
    print(f"   Recall:    {recall:.4f}")
    print(f"   F1 Score:  {f1:.4f}")
    print(f"   True Positives:  {tp}")
    print(f"   False Positives: {fp}")
    print(f"   True Negatives:  {tn}")
    print(f"   False Negatives: {fn}")
    
    # Save model and scaler
    joblib.dump(model, os.path.join(MODEL_PATH, "fraud_detector.joblib"))
    joblib.dump(scaler, os.path.join(MODEL_PATH, "fraud_scaler.joblib"))
    joblib.dump(feature_cols, os.path.join(MODEL_PATH, "fraud_features.joblib"))
    
    metadata = {
        "model_type": "IsolationForest",
        "version": "ml_v1",
        "trained_at": datetime.utcnow().isoformat(),
        "n_samples": len(df),
        "n_features": len(feature_cols),
        "features": feature_cols,
        "metrics": {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
        },
        "hyperparameters": {
            "n_estimators": 200,
            "contamination": 0.05,
        },
    }
    
    with open(os.path.join(MODEL_PATH, "fraud_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)
    
    print("   ✅ Fraud model saved!")
    return metadata


def generate_routing_training_data(n_samples: int = 10000) -> pd.DataFrame:
    """Generate synthetic routing decision data for XGBoost training"""
    np.random.seed(42)
    
    gateways = ['razorpay', 'stripe', 'payu', 'cashfree']
    payment_methods = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet']
    
    data = []
    for _ in range(n_samples):
        amount = np.random.lognormal(7, 1.5)
        method_idx = np.random.choice(len(payment_methods))
        method = payment_methods[method_idx]
        currency_is_inr = np.random.choice([0, 1], p=[0.1, 0.9])
        hour = np.random.randint(0, 24)
        fraud_score = np.random.beta(2, 20)  # Most scores are low
        
        # Simulate what the best gateway would be based on rules
        scores = {}
        for gw in gateways:
            base_score = 0.5
            
            if gw == 'razorpay':
                base_score = 0.7
                if method == 'upi': base_score += 0.15
                if amount < 10000: base_score += 0.05
            elif gw == 'stripe':
                base_score = 0.65
                if not currency_is_inr: base_score += 0.2
                if method == 'credit_card': base_score += 0.1
            elif gw == 'payu':
                base_score = 0.6
                base_score += 0.1  # Lower cost bonus
                if method in ['credit_card', 'debit_card'] and amount < 5000: base_score += 0.1
            elif gw == 'cashfree':
                base_score = 0.62
                if method == 'upi': base_score += 0.08
            
            # Add noise
            scores[gw] = base_score + np.random.normal(0, 0.1)
        
        best_gateway = max(scores, key=scores.get)
        success = np.random.random() < (0.95 - fraud_score * 0.3)
        
        data.append({
            'amount': amount,
            'payment_method': method_idx,
            'currency_is_inr': currency_is_inr,
            'hour_of_day': hour,
            'fraud_score': fraud_score,
            'best_gateway': gateways.index(best_gateway),
            'success': int(success),
        })
    
    return pd.DataFrame(data)


def train_routing_model():
    """Train XGBoost model for routing prediction"""
    print("\n🎯 Training Routing Prediction Model (XGBoost)...")
    
    df = generate_routing_training_data(10000)
    
    feature_cols = ['amount', 'payment_method', 'currency_is_inr', 'hour_of_day', 'fraud_score']
    
    X = df[feature_cols].values
    y = df['best_gateway'].values
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train/test split
    split = int(0.8 * len(X))
    X_train, X_test = X_scaled[:split], X_scaled[split:]
    y_train, y_test = y[:split], y[split:]
    
    # Train XGBoost
    model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.1,
        objective='multi:softprob',
        num_class=4,
        random_state=42,
        eval_metric='mlogloss',
        use_label_encoder=False,
    )
    
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    
    # Evaluate
    train_acc = model.score(X_train, y_train)
    test_acc = model.score(X_test, y_test)
    
    # Feature importance
    importance = dict(zip(feature_cols, model.feature_importances_.tolist()))
    
    print(f"   Train Accuracy: {train_acc:.4f}")
    print(f"   Test Accuracy:  {test_acc:.4f}")
    print(f"   Feature Importance:")
    for feat, imp in sorted(importance.items(), key=lambda x: x[1], reverse=True):
        print(f"     {feat}: {imp:.4f}")
    
    # Save model
    gateways = ['razorpay', 'stripe', 'payu', 'cashfree']
    
    joblib.dump(model, os.path.join(MODEL_PATH, "routing_predictor.joblib"))
    joblib.dump(scaler, os.path.join(MODEL_PATH, "routing_scaler.joblib"))
    joblib.dump(feature_cols, os.path.join(MODEL_PATH, "routing_features.joblib"))
    joblib.dump(gateways, os.path.join(MODEL_PATH, "routing_gateways.joblib"))
    
    metadata = {
        "model_type": "XGBClassifier",
        "version": "ml_v1",
        "trained_at": datetime.utcnow().isoformat(),
        "n_samples": len(df),
        "n_features": len(feature_cols),
        "features": feature_cols,
        "classes": gateways,
        "metrics": {
            "train_accuracy": round(train_acc, 4),
            "test_accuracy": round(test_acc, 4),
        },
        "feature_importance": {k: round(v, 4) for k, v in importance.items()},
        "hyperparameters": {
            "n_estimators": 150,
            "max_depth": 6,
            "learning_rate": 0.1,
        },
    }
    
    with open(os.path.join(MODEL_PATH, "routing_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)
    
    print("   ✅ Routing model saved!")
    return metadata


if __name__ == "__main__":
    print("=" * 60)
    print("  SmartRoute ML Model Training Pipeline")
    print("=" * 60)
    
    fraud_meta = train_fraud_model()
    routing_meta = train_routing_model()
    
    print("\n" + "=" * 60)
    print("  ✅ All models trained successfully!")
    print("=" * 60)
    print(f"\n  Fraud Model:   {fraud_meta['metrics']}")
    print(f"  Routing Model: {routing_meta['metrics']}")
    print(f"\n  Models saved to: {MODEL_PATH}/")
