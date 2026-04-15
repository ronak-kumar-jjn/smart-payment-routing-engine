import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import redis from '../config/redis';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const checks: Record<string, any> = {
    service: 'SmartRoute Backend',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {},
  };

  // Database check
  try {
    const dbResult = await query("SELECT datetime('now') as time");
    checks.checks.database = {
      status: 'healthy',
      database: 'smartroute (SQLite)',
      time: dbResult.rows[0].time,
    };
  } catch (err: any) {
    checks.checks.database = { status: 'unhealthy', error: err.message };
    checks.status = 'degraded';
  }

  // Redis/Cache check
  try {
    const pong = await redis.ping();
    checks.checks.redis = {
      status: pong === 'PONG' ? 'healthy' : 'unhealthy',
      response: pong,
      note: 'In-memory cache',
    };
  } catch (err: any) {
    checks.checks.redis = { status: 'unhealthy', error: err.message };
    checks.status = 'degraded';
  }

  // Table counts
  try {
    const gwCount = await query('SELECT COUNT(*) as cnt FROM gateways');
    const txnCount = await query('SELECT COUNT(*) as cnt FROM transactions');
    const ruleCount = await query('SELECT COUNT(*) as cnt FROM routing_rules');
    checks.checks.data = {
      gateways: gwCount.rows[0].cnt,
      transactions: txnCount.rows[0].cnt,
      routing_rules: ruleCount.rows[0].cnt,
    };
  } catch (err: any) {
    checks.checks.data = { error: err.message };
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

// Liveness probe
router.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Readiness probe
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    await query('SELECT 1 as ok');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

export default router;
