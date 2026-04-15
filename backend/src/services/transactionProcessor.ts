import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { cacheDelete } from '../config/redis';
import { routeTransaction, TransactionContext } from './routingEngine';
import { processPayment, GatewayResponse } from './gatewaySimulator';
import axios from 'axios';

// ─── Transaction Processor ─────────────────────────────────
// Orchestrates the full transaction lifecycle: route → fraud check → process → record

interface ProcessTransactionInput {
  amount: number;
  currency?: string;
  paymentMethod: string;
  customerId?: string;
  customerEmail?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

interface ProcessTransactionResult {
  success: boolean;
  transaction: any;
  routing: {
    gateway: string;
    strategy: string;
    confidence: number;
    reason: string;
    alternatives: any[];
  };
  fraud: {
    score: number;
    riskLevel: string;
    isFraudulent: boolean;
  };
  gateway: {
    transactionId: string;
    latencyMs: number;
    fee: number;
  };
}

// Call ML service for fraud detection
async function checkFraud(input: ProcessTransactionInput): Promise<{
  score: number;
  riskLevel: string;
  isFraudulent: boolean;
  confidence: number;
}> {
  try {
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    const response = await axios.post(`${mlUrl}/predict/fraud`, {
      amount: input.amount,
      payment_method: input.paymentMethod,
      customer_id: input.customerId,
      ip_address: input.ipAddress,
      hour_of_day: new Date().getHours(),
      is_international: input.currency !== 'INR',
    }, { timeout: 2000 });

    return {
      score: response.data.fraud_score,
      riskLevel: response.data.risk_level,
      isFraudulent: response.data.is_fraudulent,
      confidence: response.data.confidence,
    };
  } catch (err) {
    // ML service unavailable - use default low risk
    console.warn('ML fraud check unavailable, using defaults');
    return {
      score: 0.1,
      riskLevel: 'low',
      isFraudulent: false,
      confidence: 0.5,
    };
  }
}

export async function processTransaction(input: ProcessTransactionInput): Promise<ProcessTransactionResult> {
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  // Step 1: Fraud Detection
  const fraudResult = await checkFraud(input);

  // Step 2: If high fraud, block immediately
  if (fraudResult.isFraudulent && fraudResult.score >= 0.85) {
    const blocked = await query(
      `INSERT INTO transactions 
        (order_id, amount, currency, payment_method, customer_id, customer_email,
         status, fraud_score, fraud_flag, risk_level, routing_strategy, routing_reason,
         ip_address, metadata, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        orderId, input.amount, input.currency || 'INR', input.paymentMethod,
        input.customerId, input.customerEmail,
        'flagged', fraudResult.score, true, fraudResult.riskLevel,
        'blocked', 'Transaction blocked due to high fraud score',
        input.ipAddress, JSON.stringify(input.metadata || {}),
        Date.now() - startTime,
      ]
    );

    // Log fraud detection
    await query(
      `INSERT INTO fraud_logs (transaction_id, fraud_score, risk_level, model_version, features, action)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [blocked.rows[0].id, fraudResult.score, fraudResult.riskLevel, 'v1', JSON.stringify({}), 'block']
    );

    // Invalidate cache
    await cacheDelete('metrics:summary');
    await cacheDelete('metrics:gateways');

    return {
      success: false,
      transaction: blocked.rows[0],
      routing: {
        gateway: 'none',
        strategy: 'blocked',
        confidence: 0,
        reason: 'Transaction blocked - high fraud risk',
        alternatives: [],
      },
      fraud: {
        score: fraudResult.score,
        riskLevel: fraudResult.riskLevel,
        isFraudulent: true,
      },
      gateway: {
        transactionId: '',
        latencyMs: 0,
        fee: 0,
      },
    };
  }

  // Step 3: Route Transaction
  const routingCtx: TransactionContext = {
    amount: input.amount,
    currency: input.currency || 'INR',
    paymentMethod: input.paymentMethod,
    customerId: input.customerId,
    isInternational: input.currency !== 'INR' && input.currency !== undefined,
    riskLevel: fraudResult.riskLevel,
    fraudScore: fraudResult.score,
    metadata: input.metadata,
  };

  const routingDecision = await routeTransaction(routingCtx);

  // Step 4: Process Payment through Gateway
  let gatewayResult: GatewayResponse = await processPayment(
    routingDecision.gateway,
    input.amount,
    input.paymentMethod,
    { currency: input.currency || 'INR' }
  );

  // Step 5: Retry with fallback if failed
  let retries = 0;
  if (!gatewayResult.success && routingDecision.fallback) {
    retries = 1;
    gatewayResult = await processPayment(
      routingDecision.fallback,
      input.amount,
      input.paymentMethod,
      { currency: input.currency || 'INR' }
    );
    
    if (!gatewayResult.success && routingDecision.alternatives.length > 0) {
      retries = 2;
      gatewayResult = await processPayment(
        routingDecision.alternatives[0].gateway,
        input.amount,
        input.paymentMethod,
        { currency: input.currency || 'INR' }
      );
    }
  }

  const totalLatency = Date.now() - startTime;

  // Step 6: Record Transaction
  const finalGateway = gatewayResult.success 
    ? (retries === 0 ? routingDecision.gateway : (retries === 1 ? routingDecision.fallback : routingDecision.alternatives[0]?.gateway))
    : routingDecision.gateway;

  const txnResult = await query(
    `INSERT INTO transactions 
      (order_id, amount, currency, payment_method, customer_id, customer_email,
       gateway_name, gateway_transaction_id, status, failure_reason,
       routing_strategy, routing_confidence, routing_reason,
       fraud_score, fraud_flag, risk_level,
       latency_ms, retries, ip_address, metadata,
       processed_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
     RETURNING *`,
    [
      orderId, input.amount, input.currency || 'INR', input.paymentMethod,
      input.customerId || `CUST-${Math.random().toString(36).substr(2, 6)}`,
      input.customerEmail,
      finalGateway, gatewayResult.gatewayTransactionId,
      gatewayResult.success ? 'success' : 'failed',
      gatewayResult.failureReason || null,
      routingDecision.strategy, routingDecision.confidence, routingDecision.reason,
      fraudResult.score, fraudResult.score >= 0.6, fraudResult.riskLevel,
      gatewayResult.latencyMs, retries,
      input.ipAddress, JSON.stringify(input.metadata || {}),
      new Date().toISOString(), gatewayResult.success ? new Date().toISOString() : null,
    ]
  );

  // Log fraud if flagged
  if (fraudResult.score >= 0.3) {
    await query(
      `INSERT INTO fraud_logs (transaction_id, fraud_score, risk_level, model_version, features, action)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        txnResult.rows[0].id, fraudResult.score, fraudResult.riskLevel, 'v1',
        JSON.stringify({ amount: input.amount, method: input.paymentMethod }),
        fraudResult.score >= 0.7 ? 'flag' : fraudResult.score >= 0.5 ? 'review' : 'allow',
      ]
    );
  }

  // Invalidate caches
  await cacheDelete('metrics:summary');
  await cacheDelete('metrics:gateways');
  await cacheDelete('routing:gateway_stats');

  return {
    success: gatewayResult.success,
    transaction: txnResult.rows[0],
    routing: {
      gateway: routingDecision.gateway,
      strategy: routingDecision.strategy,
      confidence: routingDecision.confidence,
      reason: routingDecision.reason,
      alternatives: routingDecision.alternatives,
    },
    fraud: {
      score: fraudResult.score,
      riskLevel: fraudResult.riskLevel,
      isFraudulent: fraudResult.isFraudulent,
    },
    gateway: {
      transactionId: gatewayResult.gatewayTransactionId,
      latencyMs: gatewayResult.latencyMs,
      fee: gatewayResult.gatewayFee,
    },
  };
}

export { ProcessTransactionInput, ProcessTransactionResult };
