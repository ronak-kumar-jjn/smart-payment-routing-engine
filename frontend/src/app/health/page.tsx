'use client';

import { useEffect, useState } from 'react';

interface HealthData {
  service: string;
  status: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; database?: string; error?: string };
    redis: { status: string; error?: string };
    data: { gateways: string; transactions: string; routing_rules: string };
  };
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [mlHealth, setMlHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const [backendRes, mlRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/health`).then(r => r.json()),
        fetch('http://localhost:8000/health').then(r => r.json()),
      ]);

      if (backendRes.status === 'fulfilled') {
        setHealth(backendRes.value);
      }
      if (mlRes.status === 'fulfilled') {
        setMlHealth(mlRes.value);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`badge ${status === 'healthy' || status === 'loaded' ? 'success' : status === 'degraded' ? 'warning' : 'danger'}`}>
      {status}
    </span>
  );

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">System Health</h1>
        <p className="page-subtitle">Monitor all services and dependencies</p>
      </header>

      <div className="page-body">
        {/* Service Status Cards */}
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          {[
            { name: 'Backend API', port: ':5000', status: health?.status || 'unhealthy', icon: '🖥️' },
            { name: 'Database', port: 'SQLite', status: health?.checks?.database?.status || 'unknown', icon: '🗄️' },
            { name: 'Cache', port: 'In-Memory', status: health?.checks?.redis?.status || 'unknown', icon: '⚡' },
            { name: 'ML Service', port: ':8000', status: mlHealth?.status || 'unknown', icon: '🤖' },
            { name: 'Frontend', port: ':3000', status: 'healthy', icon: '🌐' },
          ].map((svc) => (
            <div key={svc.name} className="kpi-card">
              <div className={`kpi-icon ${svc.status === 'healthy' ? 'success' : svc.status === 'degraded' ? 'warning' : 'danger'}`}>
                <span style={{ fontSize: 20 }}>{svc.icon}</span>
              </div>
              <div className="kpi-content">
                <div className="kpi-label">{svc.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`status-dot ${svc.status === 'healthy' ? 'active' : 'inactive'}`}></span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: svc.status === 'healthy' ? 'var(--success)' : 'var(--danger)' }}>
                    {svc.status.charAt(0).toUpperCase() + svc.status.slice(1)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{svc.port}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Info */}
        {health && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📊 Database Stats</h3>
              </div>
              {health.checks.data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-primary)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Gateways</span>
                    <strong>{health.checks.data.gateways}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-primary)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transactions</span>
                    <strong>{health.checks.data.transactions}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Routing Rules</span>
                    <strong>{health.checks.data.routing_rules}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">⏱️ Server Info</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uptime</span>
                  <strong>{Math.floor(health.uptime)}s</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Timestamp</span>
                  <strong style={{ fontSize: 12 }}>{health.timestamp}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                  <StatusBadge status={health.status} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
