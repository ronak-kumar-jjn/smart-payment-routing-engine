'use client';

import { useEffect, useState } from 'react';
import { getTransactions, createTransaction } from '@/lib/api';

interface Transaction {
  id: string;
  order_id: string;
  amount: string;
  currency: string;
  payment_method: string;
  gateway_name: string;
  status: string;
  routing_strategy: string;
  fraud_score: string | null;
  risk_level: string;
  latency_ms: number | null;
  created_at: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [page, filter]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await getTransactions({ page, limit: 15, status: filter || undefined });
      setTransactions(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: 'success', failed: 'danger', pending: 'warning',
      processing: 'info', flagged: 'danger', refunded: 'neutral',
    };
    return map[status] || 'neutral';
  };

  const getRiskBadge = (risk: string) => {
    const map: Record<string, string> = {
      low: 'success', medium: 'warning', high: 'danger', critical: 'danger',
    };
    return map[risk] || 'neutral';
  };

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Transactions</h1>
            <p className="page-subtitle">View and manage all payment transactions</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['', 'success', 'failed', 'pending'].map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setFilter(f); setPage(1); }}
              >
                {f || 'All'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="page-body">
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Gateway</th>
                  <th>Strategy</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Latency</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ width: '80%', height: 16 }}></div></td>
                      ))}
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <span style={{ fontSize: 40 }}>💳</span>
                        <h3>No transactions found</h3>
                        <p>Process some transactions to see them here</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>
                        <code style={{ fontSize: 12, color: 'var(--text-accent)' }}>
                          {txn.order_id.substring(0, 20)}
                        </code>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        ₹{parseFloat(txn.amount).toLocaleString()}
                      </td>
                      <td>{txn.payment_method}</td>
                      <td>
                        <span className="badge info">{txn.gateway_name}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{txn.routing_strategy}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(txn.status)}`}>{txn.status}</span>
                      </td>
                      <td>
                        <span className={`badge ${getRiskBadge(txn.risk_level)}`}>{txn.risk_level}</span>
                      </td>
                      <td>{txn.latency_ms ? `${txn.latency_ms}ms` : '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(txn.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 0', borderTop: '1px solid var(--border-primary)', marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                ← Prev
              </button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
