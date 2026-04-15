import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { cacheGetJSON, cacheSetJSON } from '../config/redis';

const router = Router();

// GET /api/metrics/summary - Dashboard summary
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    // Check cache
    const cached = await cacheGetJSON<any>('metrics:summary');
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    const result = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN fraud_flag = 1 THEN 1 ELSE 0 END) as flagged,
        ROUND(AVG(CASE WHEN status = 'success' THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate,
        ROUND(AVG(latency_ms), 0) as avg_latency,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as successful_volume,
        ROUND(AVG(fraud_score), 4) as avg_fraud_score
      FROM transactions
    `);

    const data = result.rows[0] || {};
    // Ensure numeric types
    data.total_transactions = data.total_transactions || 0;
    data.successful = data.successful || 0;
    data.failed = data.failed || 0;
    data.pending = data.pending || 0;
    data.flagged = data.flagged || 0;
    data.success_rate = data.success_rate || 0;
    data.avg_latency = data.avg_latency || 0;
    data.total_volume = data.total_volume || 0;
    data.successful_volume = data.successful_volume || 0;
    data.avg_fraud_score = data.avg_fraud_score || 0;

    await cacheSetJSON('metrics:summary', data, 30);

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/metrics/gateways - Gateway performance
router.get('/gateways', async (_req: Request, res: Response) => {
  try {
    const cached = await cacheGetJSON<any>('metrics:gateways');
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    // Get gateways
    const gwResult = await query('SELECT * FROM gateways ORDER BY priority ASC');
    
    const data = [];
    for (const gw of gwResult.rows) {
      // Get transaction stats for this gateway
      const txnResult = await query(
        `SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          ROUND(AVG(CASE WHEN status = 'success' THEN 1.0 ELSE 0.0 END) * 100, 2) as actual_success_rate,
          ROUND(AVG(latency_ms), 0) as actual_avg_latency,
          COALESCE(SUM(amount), 0) as total_volume
        FROM transactions WHERE gateway_name = ?`,
        [gw.name]
      );

      const txn = txnResult.rows[0] || {};

      data.push({
        name: gw.name,
        display_name: gw.display_name,
        is_active: gw.is_active,
        configured_rate: gw.success_rate,
        configured_latency: gw.avg_latency_ms,
        cost_percentage: gw.cost_percentage,
        supported_methods: gw.supported_methods,
        total_transactions: txn.total_transactions || 0,
        successful: txn.successful || 0,
        failed: txn.failed || 0,
        actual_success_rate: txn.actual_success_rate || 0,
        actual_avg_latency: txn.actual_avg_latency || 0,
        total_volume: txn.total_volume || 0,
      });
    }

    await cacheSetJSON('metrics:gateways', data, 30);

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching gateway metrics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/metrics/timeline - Transaction volume over time
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;

    const result = await query(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', created_at) as hour,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        COALESCE(SUM(amount), 0) as volume,
        COALESCE(ROUND(AVG(latency_ms), 0), 0) as avg_latency
      FROM transactions
      GROUP BY strftime('%Y-%m-%d %H:00:00', created_at)
      ORDER BY hour ASC
    `);

    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
