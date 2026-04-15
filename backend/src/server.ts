import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { testConnection } from './config/database';
import { testRedisConnection } from './config/redis';
import { setupWebSocket } from './services/websocket';
import healthRouter from './routes/health';
import transactionRouter from './routes/transactions';
import metricsRouter from './routes/metrics';
import gatewayRouter from './routes/gateways';

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://frontend:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/gateways', gatewayRouter);

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'SmartRoute Payment Router',
    version: '1.0.0',
    status: 'running',
    docs: '/api/health',
    websocket: 'ws://localhost:5000/ws',
  });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const start = async () => {
  console.log('🚀 Starting SmartRoute Backend...');
  
  // Test connections
  const dbOk = await testConnection();
  const redisOk = await testRedisConnection();
  
  if (!dbOk) {
    console.error('❌ Cannot start: Database connection failed');
    process.exit(1);
  }
  
  if (!redisOk) {
    console.warn('⚠️ Redis connection failed - running without cache');
  }
  
  // Setup WebSocket
  setupWebSocket(server);
  
  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`✅ SmartRoute Backend running on port ${PORT}`);
    console.log(`   Database: ${dbOk ? '✅' : '❌'}`);
    console.log(`   Redis: ${redisOk ? '✅' : '❌'}`);
    console.log(`   WebSocket: ✅ ws://localhost:${PORT}/ws`);
    console.log(`   Environment: ${process.env.NODE_ENV}`);
  });
};

start().catch(console.error);

export default app;
