import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET /api/gateways - List all gateways
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM gateways ORDER BY priority ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/gateways/:name - Get single gateway
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM gateways WHERE name = $1',
      [req.params.name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Gateway not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/gateways/:name - Update gateway config
router.patch('/:name', async (req: Request, res: Response) => {
  try {
    const { is_active, priority, success_rate, cost_percentage } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }
    if (priority !== undefined) {
      params.push(priority);
      updates.push(`priority = $${params.length}`);
    }
    if (success_rate !== undefined) {
      params.push(success_rate);
      updates.push(`success_rate = $${params.length}`);
    }
    if (cost_percentage !== undefined) {
      params.push(cost_percentage);
      updates.push(`cost_percentage = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.name);

    const result = await query(
      `UPDATE gateways SET ${updates.join(', ')} WHERE name = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Gateway not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
