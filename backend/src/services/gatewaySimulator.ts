import { v4 as uuidv4 } from 'uuid';

// ─── Gateway Simulator ─────────────────────────────────────
// Simulates payment gateway behavior with realistic latency, success rates, and failures

interface GatewayConfig {
  name: string;
  displayName: string;
  successRate: number;         // 0-1
  avgLatencyMs: number;
  latencyStdDev: number;
  costPercentage: number;      // e.g., 0.02 = 2%
  supportedMethods: string[];
  dailyLimit: number;
  currentDailyVolume: number;
  isActive: boolean;
  // Simulate different failure modes
  timeoutRate: number;         // chance of timeout
  declineRate: number;         // chance of decline vs error
}

interface GatewayResponse {
  success: boolean;
  gatewayTransactionId: string;
  status: 'success' | 'failed';
  latencyMs: number;
  failureReason?: string;
  failureCode?: string;
  gatewayFee: number;
  rawResponse: Record<string, any>;
}

// Default gateway configurations
const GATEWAY_CONFIGS: Record<string, GatewayConfig> = {
  razorpay: {
    name: 'razorpay',
    displayName: 'Razorpay',
    successRate: 0.965,
    avgLatencyMs: 180,
    latencyStdDev: 60,
    costPercentage: 0.02,
    supportedMethods: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'],
    dailyLimit: 10000000,
    currentDailyVolume: 0,
    isActive: true,
    timeoutRate: 0.005,
    declineRate: 0.7,    // 70% of failures are declines, 30% are errors
  },
  stripe: {
    name: 'stripe',
    displayName: 'Stripe',
    successRate: 0.978,
    avgLatencyMs: 220,
    latencyStdDev: 70,
    costPercentage: 0.029,
    supportedMethods: ['credit_card', 'debit_card', 'net_banking', 'wallet'],
    dailyLimit: 15000000,
    currentDailyVolume: 0,
    isActive: true,
    timeoutRate: 0.003,
    declineRate: 0.8,
  },
  payu: {
    name: 'payu',
    displayName: 'PayU',
    successRate: 0.942,
    avgLatencyMs: 250,
    latencyStdDev: 90,
    costPercentage: 0.018,
    supportedMethods: ['credit_card', 'debit_card', 'upi', 'net_banking', 'emi'],
    dailyLimit: 8000000,
    currentDailyVolume: 0,
    isActive: true,
    timeoutRate: 0.008,
    declineRate: 0.6,
  },
  cashfree: {
    name: 'cashfree',
    displayName: 'Cashfree',
    successRate: 0.951,
    avgLatencyMs: 200,
    latencyStdDev: 65,
    costPercentage: 0.0195,
    supportedMethods: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'],
    dailyLimit: 12000000,
    currentDailyVolume: 0,
    isActive: true,
    timeoutRate: 0.006,
    declineRate: 0.65,
  },
};

// Failure reasons by type
const DECLINE_REASONS = [
  'Insufficient funds',
  'Card declined by issuer',
  'CVV mismatch',
  'Authentication failed',
  'Card expired',
  'Transaction limit exceeded',
  'Suspected fraud - declined',
];

const ERROR_REASONS = [
  'Gateway timeout',
  'Network error',
  'Internal gateway error',
  'Service temporarily unavailable',
  'Rate limit exceeded',
];

// Normal distribution approximation using Box-Muller
function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(50, Math.round(mean + z * stdDev)); // min 50ms
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Amount-based success rate modifier
function getAmountModifier(amount: number): number {
  if (amount > 100000) return -0.05;     // Very high amounts fail more
  if (amount > 50000) return -0.02;
  if (amount > 10000) return -0.01;
  if (amount < 100) return 0.01;          // Very small amounts succeed more
  return 0;
}

// Time-based success rate modifier (simulates real-world patterns)
function getTimeModifier(): number {
  const hour = new Date().getHours();
  if (hour >= 0 && hour <= 5) return -0.02;      // Late night lower success
  if (hour >= 10 && hour <= 14) return 0.01;      // Business hours slightly better
  if (hour >= 20 && hour <= 23) return -0.01;     // Evening slightly lower
  return 0;
}

export async function processPayment(
  gatewayName: string,
  amount: number,
  paymentMethod: string,
  metadata: Record<string, any> = {}
): Promise<GatewayResponse> {
  const config = GATEWAY_CONFIGS[gatewayName];
  
  if (!config) {
    return {
      success: false,
      gatewayTransactionId: '',
      status: 'failed',
      latencyMs: 0,
      failureReason: `Unknown gateway: ${gatewayName}`,
      failureCode: 'INVALID_GATEWAY',
      gatewayFee: 0,
      rawResponse: {},
    };
  }

  if (!config.isActive) {
    return {
      success: false,
      gatewayTransactionId: '',
      status: 'failed',
      latencyMs: 0,
      failureReason: 'Gateway is currently disabled',
      failureCode: 'GATEWAY_DISABLED',
      gatewayFee: 0,
      rawResponse: {},
    };
  }

  if (!config.supportedMethods.includes(paymentMethod)) {
    return {
      success: false,
      gatewayTransactionId: '',
      status: 'failed',
      latencyMs: 5,
      failureReason: `Payment method '${paymentMethod}' not supported by ${config.displayName}`,
      failureCode: 'UNSUPPORTED_METHOD',
      gatewayFee: 0,
      rawResponse: {},
    };
  }

  // Simulate processing latency
  const latency = normalRandom(config.avgLatencyMs, config.latencyStdDev);
  await new Promise(resolve => setTimeout(resolve, Math.min(latency, 500))); // Cap actual wait at 500ms

  // Calculate effective success rate
  const effectiveRate = Math.min(1, Math.max(0,
    config.successRate + getAmountModifier(amount) + getTimeModifier()
  ));

  const roll = Math.random();
  const gatewayTxnId = `${config.name}_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

  if (roll <= effectiveRate) {
    // SUCCESS
    const fee = amount * config.costPercentage;
    
    return {
      success: true,
      gatewayTransactionId: gatewayTxnId,
      status: 'success',
      latencyMs: latency,
      gatewayFee: Math.round(fee * 100) / 100,
      rawResponse: {
        gateway: config.name,
        transaction_id: gatewayTxnId,
        amount,
        currency: metadata.currency || 'INR',
        status: 'captured',
        fee,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // FAILURE
  const isTimeout = Math.random() < config.timeoutRate;
  const isDecline = Math.random() < config.declineRate;
  
  let failureReason: string;
  let failureCode: string;

  if (isTimeout) {
    failureReason = 'Gateway timeout';
    failureCode = 'TIMEOUT';
  } else if (isDecline) {
    failureReason = randomChoice(DECLINE_REASONS);
    failureCode = 'DECLINED';
  } else {
    failureReason = randomChoice(ERROR_REASONS);
    failureCode = 'GATEWAY_ERROR';
  }

  return {
    success: false,
    gatewayTransactionId: gatewayTxnId,
    status: 'failed',
    latencyMs: isTimeout ? latency * 3 : latency,
    failureReason,
    failureCode,
    gatewayFee: 0,
    rawResponse: {
      gateway: config.name,
      transaction_id: gatewayTxnId,
      status: 'failed',
      error: failureReason,
      error_code: failureCode,
      timestamp: new Date().toISOString(),
    },
  };
}

export function getGatewayConfig(name: string): GatewayConfig | undefined {
  return GATEWAY_CONFIGS[name];
}

export function getAllGatewayConfigs(): Record<string, GatewayConfig> {
  return { ...GATEWAY_CONFIGS };
}

export { GatewayConfig, GatewayResponse };
