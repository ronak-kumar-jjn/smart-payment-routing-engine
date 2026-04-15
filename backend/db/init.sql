-- SmartRoute Payment Router - Database Schema
-- Phase 1: Foundation

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Payment Gateways
CREATE TABLE gateways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 95.00,
    avg_latency_ms INTEGER DEFAULT 200,
    cost_percentage DECIMAL(5,4) DEFAULT 0.0200,
    supported_methods TEXT[] DEFAULT '{"credit_card","debit_card","upi","net_banking"}',
    daily_limit DECIMAL(15,2) DEFAULT 10000000.00,
    daily_processed DECIMAL(15,2) DEFAULT 0.00,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(50) NOT NULL,
    customer_id VARCHAR(100),
    customer_email VARCHAR(255),
    
    -- Gateway info
    gateway_id UUID REFERENCES gateways(id),
    gateway_name VARCHAR(50),
    gateway_transaction_id VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','success','failed','refunded','flagged')),
    failure_reason TEXT,
    
    -- Routing info
    routing_strategy VARCHAR(50) DEFAULT 'rule_based',
    routing_confidence DECIMAL(5,4),
    routing_reason TEXT,
    
    -- ML scores
    fraud_score DECIMAL(5,4),
    fraud_flag BOOLEAN DEFAULT false,
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
    
    -- Performance
    latency_ms INTEGER,
    retries INTEGER DEFAULT 0,
    
    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Gateway Performance Metrics (hourly snapshots)
CREATE TABLE gateway_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway_id UUID REFERENCES gateways(id),
    gateway_name VARCHAR(50) NOT NULL,
    
    -- Metrics
    total_transactions INTEGER DEFAULT 0,
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),
    avg_latency_ms DECIMAL(10,2),
    p95_latency_ms DECIMAL(10,2),
    p99_latency_ms DECIMAL(10,2),
    total_amount DECIMAL(15,2) DEFAULT 0,
    total_cost DECIMAL(15,2) DEFAULT 0,
    
    -- Time window
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Routing Rules
CREATE TABLE routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Conditions (JSONB for flexibility)
    conditions JSONB NOT NULL DEFAULT '{}',
    
    -- Action
    target_gateway VARCHAR(50),
    fallback_gateway VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B Test Experiments
CREATE TABLE ab_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
    
    -- Strategies
    strategy_a JSONB NOT NULL DEFAULT '{}',
    strategy_b JSONB NOT NULL DEFAULT '{}',
    traffic_split DECIMAL(3,2) DEFAULT 0.50,
    
    -- Results
    total_transactions_a INTEGER DEFAULT 0,
    total_transactions_b INTEGER DEFAULT 0,
    success_rate_a DECIMAL(5,2),
    success_rate_b DECIMAL(5,2),
    avg_cost_a DECIMAL(10,4),
    avg_cost_b DECIMAL(10,4),
    
    -- Statistical
    p_value DECIMAL(10,8),
    is_significant BOOLEAN DEFAULT false,
    winner VARCHAR(1),
    
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fraud Detection Logs
CREATE TABLE fraud_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id),
    
    fraud_score DECIMAL(5,4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    model_version VARCHAR(50),
    
    -- Feature values used
    features JSONB DEFAULT '{}',
    
    -- Decision
    action VARCHAR(20) DEFAULT 'allow' CHECK (action IN ('allow','flag','block','review')),
    reviewed_by VARCHAR(100),
    review_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default gateways
INSERT INTO gateways (name, display_name, success_rate, avg_latency_ms, cost_percentage, priority, supported_methods) VALUES
    ('razorpay', 'Razorpay', 96.50, 180, 0.0200, 1, '{"credit_card","debit_card","upi","net_banking","wallet"}'),
    ('stripe', 'Stripe', 97.80, 220, 0.0290, 2, '{"credit_card","debit_card","net_banking","wallet"}'),
    ('payu', 'PayU', 94.20, 250, 0.0180, 3, '{"credit_card","debit_card","upi","net_banking","emi"}'),
    ('cashfree', 'Cashfree', 95.10, 200, 0.0195, 4, '{"credit_card","debit_card","upi","net_banking","wallet"}');

-- Insert default routing rules
INSERT INTO routing_rules (name, description, priority, conditions, target_gateway, fallback_gateway) VALUES
    ('High Value UPI', 'Route high-value UPI to Razorpay', 100, 
     '{"payment_method": "upi", "min_amount": 10000}', 'razorpay', 'cashfree'),
    ('Low Cost Cards', 'Route cards to cheapest gateway', 90,
     '{"payment_method": ["credit_card", "debit_card"], "max_amount": 5000}', 'payu', 'razorpay'),
    ('International Cards', 'Route international cards to Stripe', 95,
     '{"payment_method": "credit_card", "currency": "USD"}', 'stripe', 'razorpay'),
    ('Default UPI', 'Default UPI routing', 50,
     '{"payment_method": "upi"}', 'razorpay', 'payu'),
    ('Default Fallback', 'Default routing when no rules match', 1,
     '{}', 'razorpay', 'stripe');

-- Create indexes for performance
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_gateway ON transactions(gateway_name);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_fraud ON transactions(fraud_score DESC) WHERE fraud_flag = true;
CREATE INDEX idx_gateway_metrics_window ON gateway_metrics(window_start, window_end);
CREATE INDEX idx_gateway_metrics_gateway ON gateway_metrics(gateway_id, window_start);
CREATE INDEX idx_fraud_logs_transaction ON fraud_logs(transaction_id);
CREATE INDEX idx_fraud_logs_score ON fraud_logs(fraud_score DESC);

-- Create a view for dashboard summary
CREATE VIEW dashboard_summary AS
SELECT 
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE status = 'success') as successful_transactions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_transactions,
    COUNT(*) FILTER (WHERE fraud_flag = true) as flagged_transactions,
    ROUND(AVG(CASE WHEN status = 'success' THEN 1.0 ELSE 0.0 END) * 100, 2) as overall_success_rate,
    ROUND(AVG(latency_ms), 0) as avg_latency,
    SUM(amount) as total_volume,
    SUM(amount) FILTER (WHERE status = 'success') as successful_volume
FROM transactions;
