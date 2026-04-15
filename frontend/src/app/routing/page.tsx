'use client';

import { useEffect, useState } from 'react';

interface RoutingRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  is_active: boolean;
  conditions: Record<string, any>;
  target_gateway: string;
  fallback_gateway: string;
}

export default function RoutingPage() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testForm, setTestForm] = useState({
    amount: '5000',
    payment_method: 'upi',
    currency: 'INR',
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      // We'll use a direct query for now
      setRules([
        { id: '1', name: 'High Value UPI', description: 'Route high-value UPI to Razorpay', priority: 100, is_active: true, conditions: { payment_method: 'upi', min_amount: 10000 }, target_gateway: 'razorpay', fallback_gateway: 'cashfree' },
        { id: '2', name: 'Low Cost Cards', description: 'Route cards to cheapest gateway', priority: 90, is_active: true, conditions: { payment_method: ['credit_card', 'debit_card'], max_amount: 5000 }, target_gateway: 'payu', fallback_gateway: 'razorpay' },
        { id: '3', name: 'International Cards', description: 'Route international cards to Stripe', priority: 95, is_active: true, conditions: { payment_method: 'credit_card', currency: 'USD' }, target_gateway: 'stripe', fallback_gateway: 'razorpay' },
        { id: '4', name: 'Default UPI', description: 'Default UPI routing', priority: 50, is_active: true, conditions: { payment_method: 'upi' }, target_gateway: 'razorpay', fallback_gateway: 'payu' },
        { id: '5', name: 'Default Fallback', description: 'Default routing when no rules match', priority: 1, is_active: true, conditions: {}, target_gateway: 'razorpay', fallback_gateway: 'stripe' },
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testForm),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTesting(false);
    }
  };

  const gatewayColors: Record<string, string> = {
    razorpay: '#528FF0',
    stripe: '#635BFF',
    payu: '#00BAF2',
    cashfree: '#7B61FF',
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">🔀 Routing Engine</h1>
        <p className="page-subtitle">Intelligent payment gateway routing with rule-based and ML-powered decisions</p>
      </header>

      <div className="page-body">
        {/* Test Transaction */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title">🧪 Test Routing Decision</h3>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Amount (₹)</label>
              <input
                type="number"
                value={testForm.amount}
                onChange={(e) => setTestForm(f => ({ ...f, amount: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: 14,
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Payment Method</label>
              <select
                value={testForm.payment_method}
                onChange={(e) => setTestForm(f => ({ ...f, payment_method: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: 14,
                }}
              >
                <option value="upi">UPI</option>
                <option value="credit_card">Credit Card</option>
                <option value="debit_card">Debit Card</option>
                <option value="net_banking">Net Banking</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Currency</label>
              <select
                value={testForm.currency}
                onChange={(e) => setTestForm(f => ({ ...f, currency: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)', fontSize: 14,
                }}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={runTest} disabled={testing}>
              {testing ? '⏳ Processing...' : '🚀 Route & Process'}
            </button>
          </div>

          {testResult && (
            <div style={{ marginTop: 20, padding: 20, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ROUTED TO</div>
                  <div style={{
                    fontSize: 18, fontWeight: 700,
                    color: gatewayColors[testResult.routing?.gateway] || 'var(--text-primary)',
                  }}>
                    {testResult.routing?.gateway?.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>STRATEGY</div>
                  <span className="badge info">{testResult.routing?.strategy}</span>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CONFIDENCE</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{(testResult.routing?.confidence * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>STATUS</div>
                  <span className={`badge ${testResult.success ? 'success' : 'danger'}`}>
                    {testResult.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>FRAUD SCORE</div>
                  <span className={`badge ${testResult.fraud?.score < 0.3 ? 'success' : testResult.fraud?.score < 0.6 ? 'warning' : 'danger'}`}>
                    {testResult.fraud?.score?.toFixed(4)} ({testResult.fraud?.riskLevel})
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>LATENCY</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{testResult.gateway?.latencyMs}ms</div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                💡 {testResult.routing?.reason}
              </div>
            </div>
          )}
        </div>

        {/* Routing Rules */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📋 Active Routing Rules</h3>
            <span className="badge info">{rules.length} rules</span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Rule Name</th>
                  <th>Description</th>
                  <th>Conditions</th>
                  <th>Target</th>
                  <th>Fallback</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <span style={{
                        background: 'var(--accent-primary-glow)',
                        color: 'var(--accent-primary)',
                        padding: '2px 8px', borderRadius: 4,
                        fontWeight: 700, fontSize: 12,
                      }}>{rule.priority}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rule.name}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{rule.description}</td>
                    <td>
                      <code style={{ fontSize: 11, color: 'var(--text-accent)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>
                        {JSON.stringify(rule.conditions)}
                      </code>
                    </td>
                    <td>
                      <span className="badge info" style={{ borderLeft: `3px solid ${gatewayColors[rule.target_gateway] || '#666'}` }}>
                        {rule.target_gateway}
                      </span>
                    </td>
                    <td>
                      <span className="badge neutral">{rule.fallback_gateway}</span>
                    </td>
                    <td>
                      <span className={`badge ${rule.is_active ? 'success' : 'neutral'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Routing Flow */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3 className="card-title">🔄 Routing Decision Flow</h3>
          </div>
          <div style={{ display: 'flex', gap: 0, alignItems: 'center', justifyContent: 'center', padding: '20px 0', flexWrap: 'wrap' }}>
            {[
              { icon: '💳', label: 'Transaction\nReceived', color: 'var(--info)' },
              { icon: '→', label: '', color: 'var(--text-muted)' },
              { icon: '🛡️', label: 'Fraud\nDetection', color: 'var(--danger)' },
              { icon: '→', label: '', color: 'var(--text-muted)' },
              { icon: '📋', label: 'Rule\nMatching', color: 'var(--warning)' },
              { icon: '→', label: '', color: 'var(--text-muted)' },
              { icon: '📊', label: 'Score\nGateways', color: 'var(--accent-primary)' },
              { icon: '→', label: '', color: 'var(--text-muted)' },
              { icon: '🏦', label: 'Process\nPayment', color: 'var(--success)' },
              { icon: '→', label: '', color: 'var(--text-muted)' },
              { icon: '✅', label: 'Record\nResult', color: 'var(--success)' },
            ].map((step, i) => (
              <div key={i} style={{ textAlign: 'center', padding: step.label ? '0 8px' : '0 4px' }}>
                <div style={{
                  fontSize: step.label ? 28 : 20,
                  marginBottom: step.label ? 8 : 0,
                  color: step.color,
                }}>{step.icon}</div>
                {step.label && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.3 }}>
                    {step.label}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
