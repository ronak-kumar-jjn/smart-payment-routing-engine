import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    console.log(`📡 WebSocket client connected (${clients.size} total)`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Connected to SmartRoute real-time feed',
    }));

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`📡 WebSocket client disconnected (${clients.size} total)`);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      clients.delete(ws);
    });
  });

  console.log('📡 WebSocket server initialized at /ws');
  return wss;
}

export function broadcastTransaction(transaction: any, routing: any, fraud: any) {
  const message = JSON.stringify({
    type: 'transaction',
    timestamp: new Date().toISOString(),
    data: {
      id: transaction.id,
      order_id: transaction.order_id,
      amount: transaction.amount,
      payment_method: transaction.payment_method,
      gateway_name: transaction.gateway_name,
      status: transaction.status,
      fraud_score: transaction.fraud_score,
      risk_level: transaction.risk_level,
      routing_strategy: routing?.strategy,
      routing_confidence: routing?.confidence,
      latency_ms: transaction.latency_ms,
    },
  });

  let sent = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });

  if (sent > 0) {
    console.log(`📡 Broadcast transaction to ${sent} clients`);
  }
}

export function broadcastMetricsUpdate(metrics: any) {
  const message = JSON.stringify({
    type: 'metrics_update',
    timestamp: new Date().toISOString(),
    data: metrics,
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function getConnectedClients(): number {
  return clients.size;
}
