import { query } from '../config/database';
import { cacheGetJSON, cacheSetJSON } from '../config/redis';

// ─── Routing Engine ────────────────────────────────────────
// Determines the best payment gateway for each transaction

interface RoutingDecision {
  gateway: string;
  confidence: number;
  strategy: string;
  reason: string;
  scores: Record<string, number>;
  alternatives: Array<{ gateway: string; score: number }>;
  fallback: string | null;
}

interface TransactionContext {
  amount: number;
  currency: string;
  paymentMethod: string;
  customerId?: string;
  isInternational?: boolean;
  riskLevel?: string;
  fraudScore?: number;
  metadata?: Record<string, any>;
}

interface GatewayStats {
  name: string;
  successRate: number;
  avgLatency: number;
  costPercentage: number;
  totalTransactions: number;
  recentFailures: number;
  isActive: boolean;
  supportedMethods: string[];
}

// Get real-time gateway stats
async function getGatewayStats(): Promise<GatewayStats[]> {
  // Check cache first
  const cached = await cacheGetJSON<GatewayStats[]>('routing:gateway_stats');
  if (cached) return cached;

  // Get base gateway info
  const gatewayResult = await query(
    `SELECT name, is_active, cost_percentage, supported_methods, success_rate, avg_latency_ms
     FROM gateways WHERE is_active = 1 ORDER BY priority ASC`
  );

  const stats: GatewayStats[] = [];

  for (const gw of gatewayResult.rows) {
    // Get transaction stats for this gateway
    let successRate = parseFloat(gw.success_rate) / 100;
    let avgLatency = parseInt(gw.avg_latency_ms);
    let totalTransactions = 0;
    let recentFailures = 0;

    try {
      const txnStats = await query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                AVG(latency_ms) as avg_lat
         FROM transactions WHERE gateway_name = ?`,
        [gw.name]
      );
      if (txnStats.rows[0] && txnStats.rows[0].total > 0) {
        totalTransactions = txnStats.rows[0].total;
        successRate = txnStats.rows[0].successful / txnStats.rows[0].total;
        if (txnStats.rows[0].avg_lat) avgLatency = Math.round(txnStats.rows[0].avg_lat);
      }

      const failStats = await query(
        `SELECT COUNT(*) as cnt FROM transactions WHERE gateway_name = ? AND status = 'failed'`,
        [gw.name]
      );
      recentFailures = failStats.rows[0]?.cnt || 0;
    } catch (e) {
      // Use defaults on error
    }

    const supportedMethods = typeof gw.supported_methods === 'string'
      ? JSON.parse(gw.supported_methods)
      : (gw.supported_methods || []);

    stats.push({
      name: gw.name,
      successRate,
      avgLatency,
      costPercentage: parseFloat(gw.cost_percentage),
      totalTransactions,
      recentFailures,
      isActive: !!gw.is_active,
      supportedMethods,
    });
  }

  await cacheSetJSON('routing:gateway_stats', stats, 15); // cache 15s
  return stats;
}

// Check routing rules from database
async function checkRoutingRules(ctx: TransactionContext): Promise<{ gateway: string; fallback: string } | null> {
  const cached = await cacheGetJSON<any[]>('routing:rules');
  let rules = cached;
  
  if (!rules) {
    const result = await query(
      'SELECT * FROM routing_rules WHERE is_active = 1 ORDER BY priority DESC'
    );
    // Parse conditions from JSON strings
    rules = result.rows.map((r: any) => ({
      ...r,
      conditions: typeof r.conditions === 'string' ? JSON.parse(r.conditions) : r.conditions,
    }));
    await cacheSetJSON('routing:rules', rules, 60);
  }

  for (const rule of rules) {
    const conditions = rule.conditions;
    let matches = true;

    // Check payment method
    if (conditions.payment_method) {
      if (Array.isArray(conditions.payment_method)) {
        if (!conditions.payment_method.includes(ctx.paymentMethod)) matches = false;
      } else {
        if (conditions.payment_method !== ctx.paymentMethod) matches = false;
      }
    }

    // Check amount range
    if (conditions.min_amount && ctx.amount < conditions.min_amount) matches = false;
    if (conditions.max_amount && ctx.amount > conditions.max_amount) matches = false;

    // Check currency
    if (conditions.currency && conditions.currency !== ctx.currency) matches = false;

    if (matches) {
      return {
        gateway: rule.target_gateway,
        fallback: rule.fallback_gateway,
      };
    }
  }

  return null;
}

// Score gateways based on multiple factors
function scoreGateways(
  stats: GatewayStats[],
  ctx: TransactionContext,
  priority: 'balanced' | 'cost' | 'speed' | 'reliability' = 'balanced'
): Record<string, number> {
  const scores: Record<string, number> = {};

  // Weight configuration by priority
  const weights = {
    balanced: { success: 0.40, cost: 0.25, latency: 0.20, load: 0.15 },
    cost: { success: 0.25, cost: 0.50, latency: 0.10, load: 0.15 },
    speed: { success: 0.25, cost: 0.10, latency: 0.50, load: 0.15 },
    reliability: { success: 0.55, cost: 0.15, latency: 0.15, load: 0.15 },
  };

  const w = weights[priority];

  for (const gw of stats) {
    if (!gw.isActive) continue;
    if (!gw.supportedMethods.includes(ctx.paymentMethod)) continue;

    // Success rate score (higher is better)
    const successScore = gw.successRate;

    // Cost score (lower cost = higher score)
    const costScore = 1 - (gw.costPercentage / 0.03); // normalize to 3% max

    // Latency score (lower latency = higher score)
    const latencyScore = 1 - (gw.avgLatency / 500); // normalize to 500ms max

    // Load balancing score (fewer recent failures = higher score)
    const loadScore = Math.max(0, 1 - (gw.recentFailures / 10));

    // Special bonuses
    let bonus = 0;
    
    // UPI bonus for Razorpay
    if (ctx.paymentMethod === 'upi' && gw.name === 'razorpay') bonus += 0.08;
    
    // International bonus for Stripe
    if (ctx.isInternational && gw.name === 'stripe') bonus += 0.1;
    if (ctx.currency !== 'INR' && gw.name === 'stripe') bonus += 0.1;
    
    // EMI bonus for PayU
    if (ctx.paymentMethod === 'emi' && gw.name === 'payu') bonus += 0.08;

    // High-risk penalty for lower-reliability gateways
    if (ctx.fraudScore && ctx.fraudScore > 0.5) {
      if (gw.successRate < 0.95) bonus -= 0.05;
    }

    const totalScore = 
      w.success * successScore +
      w.cost * costScore +
      w.latency * latencyScore +
      w.load * loadScore +
      bonus;

    scores[gw.name] = Math.round(totalScore * 10000) / 10000;
  }

  return scores;
}

// Main routing function
export async function routeTransaction(ctx: TransactionContext): Promise<RoutingDecision> {
  // 1. Check explicit routing rules first
  const ruleMatch = await checkRoutingRules(ctx);

  // 2. Get gateway stats for scoring
  const stats = await getGatewayStats();

  // 3. Score all gateways
  const priority = (ctx.metadata?.priority as any) || 'balanced';
  const scores = scoreGateways(stats, ctx, priority);

  // 4. Determine the best gateway
  let selectedGateway: string;
  let strategy: string;
  let reason: string;
  let fallback: string | null = null;

  if (ruleMatch) {
    // Rule-based routing takes priority
    selectedGateway = ruleMatch.gateway;
    fallback = ruleMatch.fallback;
    strategy = 'rule_based';
    reason = `Matched routing rule for ${ctx.paymentMethod} payment`;
    
    // But verify the rule's gateway is valid
    if (!scores[selectedGateway]) {
      // Gateway doesn't support this method or is inactive, use scoring
      selectedGateway = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'razorpay';
      strategy = 'score_based';
      reason = `Rule gateway unavailable, fell back to scoring (${priority} priority)`;
    }
  } else {
    // Score-based routing
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    selectedGateway = sorted[0]?.[0] || 'razorpay';
    strategy = 'score_based';
    reason = `Best gateway by ${priority} scoring: ${selectedGateway}`;
    fallback = sorted[1]?.[0] || null;
  }

  // Calculate confidence
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? (scores[selectedGateway] || 0) / totalScore : 0.5;

  // Alternatives
  const alternatives = Object.entries(scores)
    .filter(([name]) => name !== selectedGateway)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([gateway, score]) => ({ gateway, score }));

  return {
    gateway: selectedGateway,
    confidence: Math.round(confidence * 10000) / 10000,
    strategy,
    reason,
    scores,
    alternatives,
    fallback,
  };
}

export { RoutingDecision, TransactionContext };
