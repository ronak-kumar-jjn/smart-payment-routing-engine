'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

interface GatewayData {
  name: string;
  display_name: string;
  total_transactions: number;
  successful: number;
  failed: number;
  actual_success_rate: number;
  actual_avg_latency: number;
  cost_percentage: string;
  total_volume: string;
}

export default function AnalyticsPage() {
  const [gateways, setGateways] = useState<GatewayData[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const [summaryRes, gatewayRes, timeRes] = await Promise.all([
        fetch(`${API}/api/metrics/summary`).then(r => r.json()),
        fetch(`${API}/api/metrics/gateways`).then(r => r.json()),
        fetch(`${API}/api/metrics/timeline?hours=24`).then(r => r.json()),
      ]);

      setSummary(summaryRes.data);
      setGateways(gatewayRes.data || []);
      setTimeline((timeRes.data || []).map((t: any) => ({
        ...t,
        hour: new Date(t.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        volume: parseFloat(t.volume) / 1000,
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  const GATEWAY_COLORS: Record<string, string> = {
    razorpay: '#528FF0',
    stripe: '#635BFF',
    payu: '#00BAF2',
    cashfree: '#7B61FF',
  };

  // Prepare chart data
  const pieData = gateways.map(gw => ({
    name: gw.display_name,
    value: gw.total_transactions,
    color: GATEWAY_COLORS[gw.name] || '#666',
  }));

  const successRateData = gateways.map(gw => ({
    name: gw.display_name,
    rate: parseFloat(String(gw.actual_success_rate)),
    target: 95,
  }));

  const costData = gateways.map(gw => ({
    name: gw.display_name,
    cost: parseFloat(gw.cost_percentage) * 100,
    volume: parseFloat(gw.total_volume) / 1000,
  }));

  const latencyData = gateways.map(gw => ({
    name: gw.display_name,
    latency: gw.actual_avg_latency,
    threshold: 300,
  }));

  // Cost savings calculation
  const maxCost = Math.max(...gateways.map(g => parseFloat(g.cost_percentage)));
  const actualAvgCost = gateways.reduce((acc, g) => {
    const vol = parseFloat(g.total_volume) || 0;
    return acc + vol * parseFloat(g.cost_percentage);
  }, 0);
  const totalVolume = gateways.reduce((acc, g) => acc + (parseFloat(g.total_volume) || 0), 0);
  const worstCaseCost = totalVolume * maxCost;
  const savings = worstCaseCost - actualAvgCost;
  const savingsPercent = worstCaseCost > 0 ? ((savings / worstCaseCost) * 100) : 0;

  const customTooltipStyle = {
    backgroundColor: '#1e1e2a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '12px',
    color: '#f1f5f9',
  };

  if (loading) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">📈 Analytics</h1>
          <p className="page-subtitle">Advanced analytics and business intelligence</p>
        </header>
        <div className="page-body">
          <div className="kpi-grid">
            {[1, 2, 3, 4].map(i => (
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

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">📈 Analytics</h1>
        <p className="page-subtitle">Advanced analytics and business intelligence</p>
      </header>

      <div className="page-body">
        {/* Cost Savings + Key Metrics */}
        <div className="kpi-grid">
          <div className="kpi-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div className="kpi-icon success">
              <span style={{ fontSize: 20 }}>💰</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Cost Savings</div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>
                {savingsPercent.toFixed(1)}%
              </div>
              <div className="kpi-change positive">₹{savings.toFixed(0)} saved via smart routing</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon primary">
              <span style={{ fontSize: 20 }}>📊</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Success Rate</div>
              <div className="kpi-value">{summary?.success_rate || 0}%</div>
              <div className="kpi-change positive">↑ Target: 95%</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon info">
              <span style={{ fontSize: 20 }}>⚡</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Avg Response</div>
              <div className="kpi-value">{summary?.avg_latency || 0}ms</div>
              <div className="kpi-change positive">↓ Target: &lt;300ms</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon warning">
              <span style={{ fontSize: 20 }}>🎯</span>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Processed</div>
              <div className="kpi-value">{summary?.total_transactions || 0}</div>
              <div className="kpi-change positive">{summary?.flagged || 0} flagged</div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          {/* Transaction Volume by Gateway */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📊 Transaction Distribution</h3>
            </div>
            <div style={{ height: 300 }}>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p>No data available</p></div>
              )}
            </div>
          </div>

          {/* Success Rate by Gateway */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">✅ Success Rate by Gateway</h3>
            </div>
            <div style={{ height: 300 }}>
              {successRateData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={successRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis domain={[80, 100]} stroke="#64748b" fontSize={12} />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Bar dataKey="rate" fill="#6366f1" radius={[4, 4, 0, 0]} name="Success Rate %" />
                    <Bar dataKey="target" fill="rgba(16,185,129,0.3)" radius={[4, 4, 0, 0]} name="Target %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p>No data available</p></div>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid-2" style={{ marginBottom: 24 }}>
          {/* Latency Comparison */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">⚡ Latency Comparison (ms)</h3>
            </div>
            <div style={{ height: 300 }}>
              {latencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={80} />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Bar dataKey="latency" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Avg Latency (ms)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p>No data available</p></div>
              )}
            </div>
          </div>

          {/* Cost Analysis */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">💰 Gateway Cost Analysis</h3>
            </div>
            <div style={{ height: 300 }}>
              {costData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip contentStyle={customTooltipStyle} />
                    <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Cost %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p>No data available</p></div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📈 Transaction Volume Timeline</h3>
            </div>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#colorTotal)" name="Total" />
                  <Area type="monotone" dataKey="successful" stroke="#10b981" fill="url(#colorSuccess)" name="Successful" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
