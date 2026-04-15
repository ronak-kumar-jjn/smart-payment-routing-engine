# SmartRoute - AI-Powered Payment Router 🚀

> Intelligent payment routing with ML-powered fraud detection and dynamic gateway optimization

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend   │────▶│ ML Service  │
│  Next.js 14  │     │  Express.js │     │   FastAPI    │
│   :3000      │     │   :5000     │     │   :8000     │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────┴─────┐ ┌────┴────┐
              │ PostgreSQL │ │  Redis  │
              │   :5432    │ │  :6379  │
              └───────────┘ └─────────┘
```

## Quick Start

```bash
# Start all services
docker-compose up --build

# Services will be available at:
# Frontend:    http://localhost:3000
# Backend:     http://localhost:5000
# ML Service:  http://localhost:8000
# PostgreSQL:  localhost:5432
# Redis:       localhost:6379
```

## API Endpoints

### Backend (Port 5000)
- `GET  /api/health` - Health check with dependency status
- `GET  /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `GET  /api/metrics/summary` - Dashboard KPIs
- `GET  /api/metrics/gateways` - Gateway performance
- `GET  /api/gateways` - List payment gateways

### ML Service (Port 8000)
- `GET  /health` - Service health
- `POST /predict/fraud` - Fraud detection
- `POST /predict/routing` - Routing prediction
- `GET  /models/status` - Model status

## Tech Stack

| Service | Technology | Purpose |
|---------|-----------|---------|
| Frontend | Next.js 14 + TypeScript | Dashboard UI |
| Backend | Express.js + TypeScript | API Server |
| ML Service | FastAPI + Python | ML Models |
| Database | PostgreSQL 15 | Data Storage |
| Cache | Redis 7 | Caching Layer |

## Payment Gateways

| Gateway | Success Rate | Avg Latency | Cost |
|---------|-------------|-------------|------|
| Razorpay | 96.5% | 180ms | 2.00% |
| Stripe | 97.8% | 220ms | 2.90% |
| PayU | 94.2% | 250ms | 1.80% |
| Cashfree | 95.1% | 200ms | 1.95% |

## Project Structure

```
Hackathon/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── server.ts
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   └── redis.ts
│   │   └── routes/
│   │       ├── health.ts
│   │       ├── transactions.ts
│   │       ├── metrics.ts
│   │       └── gateways.ts
│   └── db/
│       └── init.sql
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx (Dashboard)
│       │   ├── transactions/
│       │   ├── gateways/
│       │   ├── health/
│       │   ├── fraud/
│       │   ├── routing/
│       │   ├── analytics/
│       │   └── ab-testing/
│       ├── components/
│       │   └── Sidebar.tsx
│       └── lib/
│           └── api.ts
└── ml-service/
    ├── Dockerfile
    ├── requirements.txt
    └── main.py
```

## Phases

- [x] **Phase 1**: Foundation - Services scaffolded, DB schema, health checks
- [ ] **Phase 2**: Core Routing - Gateway simulator, routing engine, transaction processing
- [ ] **Phase 3**: ML & Fraud - Isolation Forest, XGBoost, ML integration
- [ ] **Phase 4**: Polish - Analytics, WebSocket, A/B testing, documentation
