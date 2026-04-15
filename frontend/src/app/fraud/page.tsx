'use client';

import { useEffect, useState } from 'react';

interface FraudTransaction {
  id: string;
  order_id: string;
  amount: string;
  payment_method: string;
  gateway_name: string;
  status: string;
  fraud_score: string;
  risk_level: string;
  fraud_flag: boolean;
  customer_id: string;
  created_at: string;
}

interface ModelStatus {
  fraud_detector: any;
  routing_predictor: any;
}

export default function FraudPage() {
  const [transactions, setTransactions] = useState<FraudTransaction[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testForm, setTestForm] = useState({
    amount: '75000',
    payment_method: 'credit_card',
    is_international: true,
    hour_of_day: '2',
    failed_attempts_24h: '4',
    unique_ips_24h: '5',
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      // Get flagged transactions
      const txnRes = await fetch(`${API}/api/transactions?limit=50`);
      const txnData = await txnRes.json();
      
      // Filter to show most interesting (flagged and high fraud score)
      const sorted = (txnData.data || [])
        .filter((t: any) => t.fraud_score !== null)
        .sort((a: any, b: any) => parseFloat(b.fraud_score || '0') - parseFloat(a.fraud_score || '0'));
      
      setTransactions(sorted.slice(0, 30));

      // Get model status
      try {
        const mlRes = await fetch('http://localhost:8000/models/status');
        const mlData = await mlRes.json();
        setModelStatus(mlData);
      } catch {
        setModelStatus(null);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const runFraudTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('http://localhost:8000/predict/fraud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(testForm.amount),
          payment_method: testForm.payment_method,
          is_international: testForm.is_international,
          hour_of_day: parseInt(testForm.hour_of_day),
          failed_attempts_24h: parseInt(testForm.failed_attempts_24h),
          unique_ips_24h: parseInt(testForm.unique_ips_24h),
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTesting(false);
    }
  };

  const getRiskColor = (level: string) => {
    const map: Record<string, string> = {
      low: 'var(--success)',
      medium: 'var(--warning)',
      high: '#f97316',
      critical: 'var(--danger)',
    };
    return map[level] || 'var(--text-muted)';
  };

  const getScoreWidth = (score: number) => `${Math.min(100, score * 100)}%`;

  // Calculate stats
  const flaggedCount = transactions.filter(t => t.fraud_flag).length;
  const highRiskCount = transactions.filter(t => t.risk_level === 'high' || t.risk_level === 'critical').length;
  const avgScore = transactions.length > 0
    ? transactions.reduce((acc, t) => acc + parseFloat(t.fraud_score || '0'), 0) / transactions.length
    : 0;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">🛡️ Fraud Monitor</h1>
        <p className="page-subtitle">AI-powered fraud detection with real-time risk analysis</p>
      </header>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon danger">
              <span style={{ fontSize: 20 }}>🚨</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Flagged Transactions</div>
              <div className="kpi-value" style={{ color: 'var(--danger)' }}>{flaggedCount}</div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-icon warning">
              <span style={{ fontSize: 20 }}>⚠️</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">High Risk</div>
              <div className="kpi-value" style={{ color: 'var(--warning)' }}>{highRiskCount}</div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-icon info">
              <span style={{ fontSize: 20 }}>📊</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Avg Fraud Score</div>
              <div className="kpi-value">{avgScore.toFixed(4)}</div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-icon success">
              <span style={{ fontSize: 20 }}>🤖</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Model Status</div>
              <div className="kpi-value" style={{ fontSize: 16 }}>
                {modelStatus?.fraud_detector?.status === 'loaded' ? '✅ Active' : '⚠️ Rule-based'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          {/* Fraud Test Panel */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🧪 Test Fraud Detection</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Amount (₹)</label>
                <input type="number" value={testForm.amount}
                  onChange={(e) => setTestForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Payment Method</label>
                <select value={testForm.payment_method}
                  onChange={(e) => setTestForm(f => ({ ...f, payment_method: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14 }}
                >
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="upi">UPI</option>
                  <option value="net_banking">Net Banking</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Hour (0-23)</label>
                <input type="number" value={testForm.hour_of_day} min="0" max="23"
                  onChange={(e) => setTestForm(f => ({ ...f, hour_of_day: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Failed Attempts (24h)</label>
                <input type="number" value={testForm.failed_attempts_24h}
                  onChange={(e) => setTestForm(f => ({ ...f, failed_attempts_24h: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <input type="checkbox" checked={testForm.is_international}
                  onChange={(e) => setTestForm(f => ({ ...f, is_international: e.target.checked }))}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>International</span>
              </div>
              <div style={{ paddingTop: 12 }}>
                <button className="btn btn-primary" onClick={runFraudTest} disabled={testing} style={{ width: '100%' }}>
                  {testing ? '⏳ Analyzing...' : '🔍 Analyze Risk'}
                </button>
              </div>
            </div>

            {testResult && (
              <div style={{
                marginTop: 16, padding: 16, borderRadius: 'var(--radius-md)',
                background: testResult.fraud_score >= 0.7 ? 'var(--danger-bg)' : testResult.fraud_score >= 0.3 ? 'var(--warning-bg)' : 'var(--success-bg)',
                border: `1px solid ${testResult.fraud_score >= 0.7 ? 'rgba(239,68,68,0.3)' : testResult.fraud_score >= 0.3 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 800 }}>{testResult.fraud_score.toFixed(4)}</div>
                    <div style={{ fontSize: 13, color: getRiskColor(testResult.risk_level) }}>
                      {testResult.risk_level.toUpperCase()} RISK
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${testResult.is_fraudulent ? 'danger' : 'success'}`} style={{ fontSize: 14, padding: '6px 14px' }}>
                      {testResult.is_fraudulent ? '🚨 FRAUDULENT' : '✅ CLEAN'}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Model: {testResult.model_version} • {testResult.inference_time_ms}ms
                    </div>
                  </div>
                </div>
                {/* Score bar */}
                <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: getScoreWidth(testResult.fraud_score),
                    background: testResult.fraud_score >= 0.7 ? 'var(--danger)' : testResult.fraud_score >= 0.3 ? 'var(--warning)' : 'var(--success)',
                    borderRadius: 3, transition: 'width 0.5s ease',
                  }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Model Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🤖 ML Model Details</h3>
            </div>
            {modelStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Fraud Detector - Isolation Forest</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
                      <span className={`badge ${modelStatus.fraud_detector?.status === 'loaded' ? 'success' : 'warning'}`}>
                        {modelStatus.fraud_detector?.status}
                      </span>
                    </div>
                    {modelStatus.fraud_detector?.metrics && (
                      <>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Precision</div>
                          <strong>{modelStatus.fraud_detector.metrics.precision}</strong>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Recall</div>
                          <strong>{modelStatus.fraud_detector.metrics.recall}</strong>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>F1 Score</div>
                          <strong>{modelStatus.fraud_detector.metrics.f1_score}</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Routing Predictor - XGBoost</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
                      <span className={`badge ${modelStatus.routing_predictor?.status === 'loaded' ? 'success' : 'warning'}`}>
                        {modelStatus.routing_predictor?.status}
                      </span>
                    </div>
                    {modelStatus.routing_predictor?.metrics && (
                      <>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Train Acc</div>
                          <strong>{modelStatus.routing_predictor.metrics.train_accuracy}</strong>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Test Acc</div>
                          <strong>{modelStatus.routing_predictor.metrics.test_accuracy}</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 30 }}>
                <span style={{ fontSize: 40 }}>🤖</span>
                <h3>ML Service Unavailable</h3>
                <p>Start the ML service to see model details</p>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Risk Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Transaction Risk Analysis</h3>
            <span className="badge info">{transactions.length} transactions</span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Fraud Score</th>
                  <th>Risk Level</th>
                  <th>Gateway</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <span style={{ fontSize: 40 }}>🛡️</span>
                        <h3>No transaction data</h3>
                        <p>Process some transactions to see fraud analysis</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>
                        <code style={{ fontSize: 12, color: 'var(--text-accent)' }}>
                          {txn.order_id?.substring(0, 18)}
                        </code>
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{parseFloat(txn.amount).toLocaleString()}</td>
                      <td>{txn.payment_method}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: getScoreWidth(parseFloat(txn.fraud_score || '0')),
                              background: getRiskColor(txn.risk_level),
                              borderRadius: 2,
                            }}></div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {parseFloat(txn.fraud_score || '0').toFixed(4)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${txn.risk_level === 'low' ? 'success' : txn.risk_level === 'medium' ? 'warning' : 'danger'}`}>
                          {txn.risk_level}
                        </span>
                      </td>
                      <td>{txn.gateway_name}</td>
                      <td>
                        <span className={`badge ${txn.status === 'success' ? 'success' : txn.status === 'flagged' ? 'danger' : txn.status === 'failed' ? 'danger' : 'warning'}`}>
                          {txn.fraud_flag ? '🚩 ' : ''}{txn.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(txn.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
