const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `API error: ${res.status}`);
    }

    return res.json();
  } catch (err: any) {
    if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
      throw new Error('Backend service unavailable. Is the server running?');
    }
    throw err;
  }
}

// Metrics
export const getMetricsSummary = () => fetchAPI<any>('/api/metrics/summary');
export const getGatewayMetrics = () => fetchAPI<any>('/api/metrics/gateways');
export const getTimeline = (hours?: number) => fetchAPI<any>(`/api/metrics/timeline${hours ? `?hours=${hours}` : ''}`);

// Transactions
export const getTransactions = (params?: { page?: number; limit?: number; status?: string; gateway?: string }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.status) query.set('status', params.status);
  if (params?.gateway) query.set('gateway', params.gateway);
  return fetchAPI<any>(`/api/transactions?${query.toString()}`);
};

export const getTransaction = (id: string) => fetchAPI<any>(`/api/transactions/${id}`);

export const createTransaction = (data: any) =>
  fetchAPI<any>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Gateways
export const getGateways = () => fetchAPI<any>('/api/gateways');
export const getGateway = (name: string) => fetchAPI<any>(`/api/gateways/${name}`);

// Health
export const getHealth = () => fetchAPI<any>('/api/health');

export default fetchAPI;
