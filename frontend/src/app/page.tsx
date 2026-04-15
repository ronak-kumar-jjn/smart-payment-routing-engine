'use client';

import { useEffect, useState } from 'react';
import { getMetricsSummary, getGatewayMetrics, getTransactions } from '@/lib/api';

interface Summary {
  total_transactions: number;
  successful: number;
  failed: number;
  pending: number;
  flagged: number;
  success_rate: number;
  avg_latency: number;
  total_volume: number;
  successful_volume: number;
  avg_fraud_score: number;
}

interface GatewayMetric {
  name: string;
  display_name: string;
  is_active: boolean;
  total_transactions: number;
  successful: number;
  failed: number;
  actual_success_rate: number;
  actual_avg_latency: number;
  cost_percentage: string;
  total_volume: string;
}

interface Transaction {
  id: string;
  order_id: string;
  amount: string;
  payment_method: string;
  gateway_name: string;
  status: string;
  fraud_score: string | null;
  latency_ms: number | null;
  created_at: string;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [gateways, setGateways] = useState<GatewayMetric[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [summaryRes, gatewayRes, txnRes] = await Promise.all([
        getMetricsSummary(),
        getGatewayMetrics(),
        getTransactions({ limit: 10 }),
      ]);
      setSummary(summaryRes.data);
      setGateways(gatewayRes.data);
      setTransactions(txnRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return `₹${num.toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: 'success',
      failed: 'danger',
      pending: 'warning',
      processing: 'info',
      flagged: 'danger',
    };
    return map[status] || 'neutral';
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time payment routing overview</p>
        </header>
        <div className="page-body">
          <div className="kpi-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="kpi-card">
                <div className="skeleton" style={{ width: 44, height: 44 }}></div>
                <div className="kpi-content">
                  <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: 8 }}></div>
                  <div className="skeleton" style={{ width: '80%', height: 32 }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time payment routing overview</p>
        </header>
        <div className="page-body">
          <div className="card" style={{ borderColor: 'var(--danger)', textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ color: 'var(--danger)', marginBottom: 8 }}>Connection Error</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{error}</p>
            <button className="btn btn-primary" onClick={loadData}>Retry</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Real-time payment routing overview</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="status-dot active"></span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Live</span>
          </div>
        </div>
      </header>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card animate-slide-up" style={{ animationDelay: '0ms' }}>
            <div className="kpi-icon primary">
              <span style={{ fontSize: 20 }}>💳</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Total Transactions</div>
              <div className="kpi-value">{summary?.total_transactions.toLocaleString()}</div>
              <div className="kpi-change positive">↑ Live</div>
            </div>
          </div>

          <div className="kpi-card animate-slide-up" style={{ animationDelay: '50ms' }}>
            <div className="kpi-icon success">
              <span style={{ fontSize: 20 }}>✅</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Success Rate</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{summary?.success_rate}%</div>
              <div className="kpi-change positive">↑ {summary?.successful} successful</div>
            </div>
          </div>

          <div className="kpi-card animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="kpi-icon info">
              <span style={{ fontSize: 20 }}>💰</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Total Volume</div>
              <div className="kpi-value">{formatCurrency(summary?.total_volume || 0)}</div>
              <div className="kpi-change positive">{formatCurrency(summary?.successful_volume || 0)} settled</div>
            </div>
          </div>

          <div className="kpi-card animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="kpi-icon warning">
              <span style={{ fontSize: 20 }}>⚡</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Avg Latency</div>
              <div className="kpi-value">{summary?.avg_latency || 0}ms</div>
              <div className="kpi-change positive">{summary?.flagged || 0} flagged</div>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          {/* Gateway Performance */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🏦 Gateway Performance</h3>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Gateway</th>
                    <th>Txns</th>
                    <th>Success</th>
                    <th>Latency</th>
                    <th>Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gateways.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        No gateway data yet. Process some transactions to see metrics.
                      </td>
                    </tr>
                  ) : (
                    gateways.map((gw) => (
                      <tr key={gw.name}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`status-dot ${gw.is_active ? 'active' : 'inactive'}`}></span>
                            <strong style={{ color: 'var(--text-primary)' }}>{gw.display_name}</strong>
                          </div>
                        </td>
                        <td>{gw.total_transactions}</td>
                        <td>
                          <span className={`badge ${parseFloat(String(gw.actual_success_rate)) >= 95 ? 'success' : parseFloat(String(gw.actual_success_rate)) >= 90 ? 'warning' : 'danger'}`}>
                            {gw.actual_success_rate}%
                          </span>
                        </td>
                        <td>{gw.actual_avg_latency}ms</td>
                        <td>{(parseFloat(gw.cost_percentage) * 100).toFixed(2)}%</td>
                        <td>
                          <span className={`badge ${gw.is_active ? 'success' : 'neutral'}`}>
                            {gw.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">💳 Recent Transactions</h3>
              <a href="/transactions" className="btn btn-secondary btn-sm">View All</a>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Amount</th>
                    <th>Gateway</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        No transactions yet. Use the API to create some!
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn) => (
                      <tr key={txn.id}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-accent)' }}>
                            {txn.order_id.substring(0, 16)}...
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          ₹{parseFloat(txn.amount).toLocaleString()}
                        </td>
                        <td>{txn.gateway_name}</td>
                        <td>
                          <span className={`badge ${getStatusBadge(txn.status)}`}>
                            {txn.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
