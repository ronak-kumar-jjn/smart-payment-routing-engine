'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ABExperiment {
  id: string;
  name: string;
  description: string;
  status: string;
  strategy_a: any;
  strategy_b: any;
  traffic_split: number;
  total_transactions_a: number;
  total_transactions_b: number;
  success_rate_a: number;
  success_rate_b: number;
  avg_cost_a: number;
  avg_cost_b: number;
  p_value: number;
  is_significant: boolean;
  winner: string | null;
}

export default function ABTestingPage() {
  const [experiments, setExperiments] = useState<ABExperiment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated A/B test data for demo
    setExperiments([
      {
        id: '1',
        name: 'Cost-Optimized vs Reliability-First',
        description: 'Compare cost-optimized routing against reliability-first strategy',
        status: 'completed',
        strategy_a: { name: 'Cost Optimized', priority: 'cost', description: 'Minimize transaction costs' },
        strategy_b: { name: 'Reliability First', priority: 'reliability', description: 'Maximize success rate' },
        traffic_split: 0.50,
        total_transactions_a: 52,
        total_transactions_b: 48,
        success_rate_a: 92.3,
        success_rate_b: 97.9,
        avg_cost_a: 0.0185,
        avg_cost_b: 0.0245,
        p_value: 0.0023,
        is_significant: true,
        winner: 'B',
      },
      {
        id: '2',
        name: 'ML Routing vs Rule-Based',
        description: 'Test ML-powered routing against traditional rule-based approach',
        status: 'running',
        strategy_a: { name: 'Rule-Based', priority: 'balanced', description: 'Traditional rule matching' },
        strategy_b: { name: 'ML-Powered', priority: 'ml', description: 'XGBoost routing prediction' },
        traffic_split: 0.50,
        total_transactions_a: 35,
        total_transactions_b: 38,
        success_rate_a: 94.3,
        success_rate_b: 96.1,
        avg_cost_a: 0.0210,
        avg_cost_b: 0.0198,
        p_value: 0.087,
        is_significant: false,
        winner: null,
      },
      {
        id: '3',
        name: 'Razorpay Heavy vs Distributed',
        description: 'Compare routing heavily through Razorpay vs distributing across all gateways',
        status: 'completed',
        strategy_a: { name: 'Razorpay Heavy', priority: 'single', description: '80% traffic to Razorpay' },
        strategy_b: { name: 'Distributed', priority: 'balanced', description: 'Even distribution' },
        traffic_split: 0.50,
        total_transactions_a: 45,
        total_transactions_b: 43,
        success_rate_a: 96.5,
        success_rate_b: 95.2,
        avg_cost_a: 0.0200,
        avg_cost_b: 0.0215,
        p_value: 0.342,
        is_significant: false,
        winner: null,
      },
    ]);
    setLoading(false);
  }, []);

  const customTooltipStyle = {
    backgroundColor: '#1e1e2a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '12px',
    color: '#f1f5f9',
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">🧪 A/B Testing</h1>
        <p className="page-subtitle">Experiment with routing strategies and measure statistical significance</p>
      </header>

      <div className="page-body">
        {experiments.map((exp) => {
          const comparisonData = [
            { metric: 'Success Rate', A: exp.success_rate_a, B: exp.success_rate_b },
            { metric: 'Cost %', A: exp.avg_cost_a * 100, B: exp.avg_cost_b * 100 },
            { metric: 'Transactions', A: exp.total_transactions_a, B: exp.total_transactions_b },
          ];

          return (
            <div key={exp.id} className="card" style={{ marginBottom: 24, overflow: 'hidden', position: 'relative' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{exp.name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{exp.description}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${exp.status === 'running' ? 'info' : exp.status === 'completed' ? 'success' : 'neutral'}`}>
                    {exp.status === 'running' && '🔄 '}{exp.status}
                  </span>
                  {exp.is_significant && (
                    <span className="badge success" style={{ fontWeight: 700 }}>
                      ✨ Significant
                    </span>
                  )}
                </div>
              </div>

              {/* Strategy Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, marginBottom: 20 }}>
                {/* Strategy A */}
                <div style={{
                  padding: 16, borderRadius: 'var(--radius-md)',
                  background: exp.winner === 'A' ? 'var(--success-bg)' : 'var(--bg-secondary)',
                  border: `1px solid ${exp.winner === 'A' ? 'rgba(16,185,129,0.3)' : 'var(--border-primary)'}`,
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    STRATEGY A {exp.winner === 'A' && '🏆 WINNER'}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{exp.strategy_a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.strategy_a.description}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SUCCESS</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{exp.success_rate_a}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>COST</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{(exp.avg_cost_a * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>

                {/* VS */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'var(--gradient-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 14,
                  }}>VS</div>
                </div>

                {/* Strategy B */}
                <div style={{
                  padding: 16, borderRadius: 'var(--radius-md)',
                  background: exp.winner === 'B' ? 'var(--success-bg)' : 'var(--bg-secondary)',
                  border: `1px solid ${exp.winner === 'B' ? 'rgba(16,185,129,0.3)' : 'var(--border-primary)'}`,
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    STRATEGY B {exp.winner === 'B' && '🏆 WINNER'}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{exp.strategy_b.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exp.strategy_b.description}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SUCCESS</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{exp.success_rate_b}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>COST</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{(exp.avg_cost_b * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison Chart */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="metric" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip contentStyle={customTooltipStyle} />
                      <Legend />
                      <Bar dataKey="A" fill="#6366f1" radius={[4, 4, 0, 0]} name={exp.strategy_a.name} />
                      <Bar dataKey="B" fill="#10b981" radius={[4, 4, 0, 0]} name={exp.strategy_b.name} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Statistical Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>P-VALUE</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: exp.p_value < 0.05 ? 'var(--success)' : 'var(--text-secondary)' }}>
                      {exp.p_value.toFixed(4)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {exp.p_value < 0.05 ? '✅ Statistically significant' : '⏳ Not yet significant'}
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TRAFFIC SPLIT</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{(exp.traffic_split * 100).toFixed(0)}% / {((1 - exp.traffic_split) * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TOTAL SAMPLES</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{exp.total_transactions_a + exp.total_transactions_b}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
