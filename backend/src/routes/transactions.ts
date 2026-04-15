import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { processTransaction } from '../services/transactionProcessor';
import { broadcastTransaction } from '../services/websocket';

const router = Router();

// GET /api/transactions - List all transactions
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const gateway = req.query.gateway as string;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (gateway) {
      params.push(gateway);
      conditions.push(`gateway_name = $${params.length}`);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT * FROM transactions ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM transactions ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/transactions/:id - Get single transaction
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Get fraud logs for this transaction
    const fraudLogs = await query(
      'SELECT * FROM fraud_logs WHERE transaction_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        fraud_logs: fraudLogs.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/transactions - Create and process a new transaction through the routing engine
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      amount,
      currency = 'INR',
      payment_method,
      customer_id,
      customer_email,
      metadata = {},
    } = req.body;

    if (!amount || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'amount and payment_method are required',
      });
    }

    // Process through the full routing engine
    const result = await processTransaction({
      amount: parseFloat(amount),
      currency,
      paymentMethod: payment_method,
      customerId: customer_id,
      customerEmail: customer_email,
      metadata,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'],
    });

    // Broadcast via WebSocket
    broadcastTransaction(result.transaction, result.routing, result.fraud);

    res.status(201).json({
      success: result.success,
      data: result.transaction,
      routing: result.routing,
      fraud: result.fraud,
      gateway: result.gateway,
    });
  } catch (err: any) {
    console.error('Error processing transaction:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/transactions/batch - Process multiple transactions
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { transactions: txnList } = req.body;

    if (!Array.isArray(txnList) || txnList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'transactions array is required',
      });
    }

    const results = [];
    for (const txn of txnList) {
      try {
        const result = await processTransaction({
          amount: parseFloat(txn.amount),
          currency: txn.currency || 'INR',
          paymentMethod: txn.payment_method,
          customerId: txn.customer_id,
          customerEmail: txn.customer_email,
          metadata: txn.metadata || {},
          ipAddress: req.ip || '127.0.0.1',
        });
        results.push({ success: result.success, transaction_id: result.transaction.id });
      } catch (err: any) {
        results.push({ success: false, error: err.message });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.status(201).json({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed,
        success_rate: `${((successful / results.length) * 100).toFixed(1)}%`,
      },
      results,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
