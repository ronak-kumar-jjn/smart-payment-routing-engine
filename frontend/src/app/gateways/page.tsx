'use client';

import { useEffect, useState } from 'react';
import { getGateways } from '@/lib/api';

interface Gateway {
  id: string;
  name: string;
  display_name: string;
  is_active: boolean;
  priority: number;
  success_rate: string;
  avg_latency_ms: number;
  cost_percentage: string;
  supported_methods: string[];
  daily_limit: string;
  daily_processed: string;
}

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGateways();
  }, []);

  const loadGateways = async () => {
    try {
      const res = await getGateways();
      setGateways(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
        <h1 className="page-title">Payment Gateways</h1>
        <p className="page-subtitle">Configure and monitor payment gateway integrations</p>
      </header>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {gateways.map((gw) => (
            <div key={gw.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: gatewayColors[gw.name] || 'var(--accent-primary)',
              }}></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>{gw.display_name}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Priority: {gw.priority}</p>
                </div>
                <span className={`badge ${gw.is_active ? 'success' : 'neutral'}`}>
                  <span className={`status-dot ${gw.is_active ? 'active' : 'inactive'}`} style={{ width: 6, height: 6 }}></span>
                  {gw.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>SUCCESS RATE</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{gw.success_rate}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>AVG LATENCY</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{gw.avg_latency_ms}ms</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>COST</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{(parseFloat(gw.cost_percentage) * 100).toFixed(2)}%</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>SUPPORTED METHODS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {gw.supported_methods.map((method) => (
                    <span key={method} className="badge neutral" style={{ fontSize: 11 }}>
                      {method.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
