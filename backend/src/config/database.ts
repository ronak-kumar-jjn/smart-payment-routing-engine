import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'smartroute.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gateways (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      base_url TEXT,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      success_rate REAL DEFAULT 95.00,
      avg_latency_ms INTEGER DEFAULT 200,
      cost_percentage REAL DEFAULT 0.0200,
      supported_methods TEXT DEFAULT '["credit_card","debit_card","upi","net_banking"]',
      daily_limit REAL DEFAULT 10000000.00,
      daily_processed REAL DEFAULT 0.00,
      config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      order_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      payment_method TEXT NOT NULL,
      customer_id TEXT,
      customer_email TEXT,
      gateway_id TEXT,
      gateway_name TEXT,
      gateway_transaction_id TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','success','failed','refunded','flagged')),
      failure_reason TEXT,
      routing_strategy TEXT DEFAULT 'rule_based',
      routing_confidence REAL,
      routing_reason TEXT,
      fraud_score REAL,
      fraud_flag INTEGER DEFAULT 0,
      risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
      latency_ms INTEGER,
      retries INTEGER DEFAULT 0,
      ip_address TEXT,
      user_agent TEXT,
      device_fingerprint TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS gateway_metrics (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      gateway_id TEXT,
      gateway_name TEXT NOT NULL,
      total_transactions INTEGER DEFAULT 0,
      successful_transactions INTEGER DEFAULT 0,
      failed_transactions INTEGER DEFAULT 0,
      success_rate REAL,
      avg_latency_ms REAL,
      p95_latency_ms REAL,
      p99_latency_ms REAL,
      total_amount REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      description TEXT,
      priority INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      conditions TEXT NOT NULL DEFAULT '{}',
      target_gateway TEXT,
      fallback_gateway TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ab_experiments (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
      strategy_a TEXT NOT NULL DEFAULT '{}',
      strategy_b TEXT NOT NULL DEFAULT '{}',
      traffic_split REAL DEFAULT 0.50,
      total_transactions_a INTEGER DEFAULT 0,
      total_transactions_b INTEGER DEFAULT 0,
      success_rate_a REAL,
      success_rate_b REAL,
      avg_cost_a REAL,
      avg_cost_b REAL,
      p_value REAL,
      is_significant INTEGER DEFAULT 0,
      winner TEXT,
      started_at TEXT,
      ended_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fraud_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      transaction_id TEXT,
      fraud_score REAL NOT NULL,
      risk_level TEXT NOT NULL,
      model_version TEXT,
      features TEXT DEFAULT '{}',
      action TEXT DEFAULT 'allow' CHECK (action IN ('allow','flag','block','review')),
      reviewed_by TEXT,
      review_notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_gateway ON transactions(gateway_name);
    CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_logs_transaction ON fraud_logs(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_logs_score ON fraud_logs(fraud_score);
  `);

  // Seed default gateways if empty
  const count = db.prepare('SELECT COUNT(*) as cnt FROM gateways').get() as any;
  if (count.cnt === 0) {
    const insertGateway = db.prepare(`
      INSERT INTO gateways (id, name, display_name, success_rate, avg_latency_ms, cost_percentage, priority, supported_methods)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertGateway.run('gw-razorpay', 'razorpay', 'Razorpay', 96.50, 180, 0.0200, 1, '["credit_card","debit_card","upi","net_banking","wallet"]');
    insertGateway.run('gw-stripe', 'stripe', 'Stripe', 97.80, 220, 0.0290, 2, '["credit_card","debit_card","net_banking","wallet"]');
    insertGateway.run('gw-payu', 'payu', 'PayU', 94.20, 250, 0.0180, 3, '["credit_card","debit_card","upi","net_banking","emi"]');
    insertGateway.run('gw-cashfree', 'cashfree', 'Cashfree', 95.10, 200, 0.0195, 4, '["credit_card","debit_card","upi","net_banking","wallet"]');

    console.log('✅ Seeded 4 default gateways');
  }

  // Seed default routing rules if empty
  const ruleCount = db.prepare('SELECT COUNT(*) as cnt FROM routing_rules').get() as any;
  if (ruleCount.cnt === 0) {
    const insertRule = db.prepare(`
      INSERT INTO routing_rules (name, description, priority, conditions, target_gateway, fallback_gateway)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertRule.run('High Value UPI', 'Route high-value UPI to Razorpay', 100, '{"payment_method":"upi","min_amount":10000}', 'razorpay', 'cashfree');
    insertRule.run('Low Cost Cards', 'Route cards to cheapest gateway', 90, '{"payment_method":["credit_card","debit_card"],"max_amount":5000}', 'payu', 'razorpay');
    insertRule.run('International Cards', 'Route international cards to Stripe', 95, '{"payment_method":"credit_card","currency":"USD"}', 'stripe', 'razorpay');
    insertRule.run('Default UPI', 'Default UPI routing', 50, '{"payment_method":"upi"}', 'razorpay', 'payu');
    insertRule.run('Default Fallback', 'Default routing when no rules match', 1, '{}', 'razorpay', 'stripe');

    console.log('✅ Seeded 5 default routing rules');
  }
}

initializeDatabase();

// Query helper compatible with pg-style interface
export const query = async (text: string, params?: any[]): Promise<{ rows: any[] }> => {
  try {
    // Convert PostgreSQL-style $1, $2 placeholders to SQLite ? placeholders
    let sqliteText = text;
    let paramIndex = 0;
    sqliteText = sqliteText.replace(/\$(\d+)/g, () => '?');

    // Handle PostgreSQL-specific syntax conversions
    sqliteText = sqliteText.replace(/::int/g, '');
    sqliteText = sqliteText.replace(/::float/g, '');
    sqliteText = sqliteText.replace(/::text/g, '');
    sqliteText = sqliteText.replace(/COALESCE/gi, 'COALESCE');
    sqliteText = sqliteText.replace(/NOW\(\)/gi, "datetime('now')");
    sqliteText = sqliteText.replace(/INTERVAL\s+'(\d+)\s+(\w+)'/gi, "'$1 $2'");
    sqliteText = sqliteText.replace(/uuid_generate_v4\(\)/gi, "lower(hex(randomblob(16)))");
    
    // Handle FILTER (WHERE ...) - SQLite doesn't support this
    sqliteText = sqliteText.replace(
      /COUNT\(\*\)\s+FILTER\s+\(WHERE\s+([^)]+)\)/gi,
      'SUM(CASE WHEN $1 THEN 1 ELSE 0 END)'
    );
    sqliteText = sqliteText.replace(
      /SUM\(([^)]+)\)\s+FILTER\s+\(WHERE\s+([^)]+)\)/gi,
      'SUM(CASE WHEN $2 THEN $1 ELSE 0 END)'
    );
    sqliteText = sqliteText.replace(
      /AVG\(([^)]+)\)\s+FILTER\s+\(WHERE\s+([^)]+)\)/gi,
      'AVG(CASE WHEN $2 THEN $1 ELSE NULL END)'
    );
    
    // Handle date_trunc
    sqliteText = sqliteText.replace(
      /date_trunc\('hour',\s*([^)]+)\)/gi,
      "strftime('%Y-%m-%d %H:00:00', $1)"
    );

    // Handle RETURNING *
    const isReturning = /RETURNING\s+\*/i.test(sqliteText);
    sqliteText = sqliteText.replace(/\s+RETURNING\s+\*/gi, '');

    // Handle WHERE created_at >= NOW() - INTERVAL ...
    sqliteText = sqliteText.replace(
      /created_at\s*>=\s*datetime\('now'\)\s*-\s*'(\d+)\s+(\w+)'/gi,
      "created_at >= datetime('now', '-$1 $2')"
    );
    sqliteText = sqliteText.replace(
      /created_at\s*>\s*datetime\('now'\)\s*-\s*'(\d+)\s+(\w+)'/gi,
      "created_at > datetime('now', '-$1 $2')"
    );

    // Handle boolean values for SQLite
    const sqliteParams = (params || []).map(p => {
      if (p === true) return 1;
      if (p === false) return 0;
      return p;
    });

    const trimmed = sqliteText.trim();
    const isSelect = /^SELECT/i.test(trimmed);
    const isInsert = /^INSERT/i.test(trimmed);
    const isUpdate = /^UPDATE/i.test(trimmed);
    const isDelete = /^DELETE/i.test(trimmed);

    if (isSelect) {
      const rows = db.prepare(sqliteText).all(...sqliteParams);
      // Convert integer booleans back
      return {
        rows: rows.map((row: any) => {
          const converted = { ...row };
          if ('is_active' in converted) converted.is_active = !!converted.is_active;
          if ('fraud_flag' in converted) converted.fraud_flag = !!converted.fraud_flag;
          if ('is_significant' in converted) converted.is_significant = !!converted.is_significant;
          if ('supported_methods' in converted && typeof converted.supported_methods === 'string') {
            try { converted.supported_methods = JSON.parse(converted.supported_methods); } catch {}
          }
          return converted;
        }),
      };
    } else if (isInsert && isReturning) {
      const info = db.prepare(sqliteText).run(...sqliteParams);
      // Fetch the inserted row
      // Get the table name from INSERT INTO <table>
      const tableMatch = trimmed.match(/INSERT\s+INTO\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        // Try to find by rowid
        const row = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(info.lastInsertRowid);
        if (row) {
          const converted: any = { ...row as any };
          if ('is_active' in converted) converted.is_active = !!converted.is_active;
          if ('fraud_flag' in converted) converted.fraud_flag = !!converted.fraud_flag;
          if ('supported_methods' in converted && typeof converted.supported_methods === 'string') {
            try { converted.supported_methods = JSON.parse(converted.supported_methods); } catch {}
          }
          return { rows: [converted] };
        }
      }
      return { rows: [] };
    } else if (isUpdate && isReturning) {
      db.prepare(sqliteText).run(...sqliteParams);
      // For UPDATE RETURNING, we need to fetch the updated row
      const tableMatch = trimmed.match(/UPDATE\s+(\w+)/i);
      const whereMatch = trimmed.match(/WHERE\s+(.+)/i);
      if (tableMatch && whereMatch) {
        const rows = db.prepare(`SELECT * FROM ${tableMatch[1]} WHERE ${whereMatch[1]}`).all(...sqliteParams.slice(-1));
        return {
          rows: rows.map((row: any) => {
            const converted = { ...row };
            if ('is_active' in converted) converted.is_active = !!converted.is_active;
            if ('fraud_flag' in converted) converted.fraud_flag = !!converted.fraud_flag;
            if ('supported_methods' in converted && typeof converted.supported_methods === 'string') {
              try { converted.supported_methods = JSON.parse(converted.supported_methods); } catch {}
            }
            return converted;
          }),
        };
      }
      return { rows: [] };
    } else {
      db.prepare(sqliteText).run(...sqliteParams);
      return { rows: [] };
    }
  } catch (err: any) {
    console.error('SQLite query error:', err.message);
    console.error('Query:', text.substring(0, 200));
    throw err;
  }
};

export const getClient = async () => {
  return { query: db.prepare.bind(db), release: () => {} };
};

export const testConnection = async (): Promise<boolean> => {
  try {
    const row = db.prepare("SELECT datetime('now') as now").get() as any;
    console.log('✅ SQLite database connected:', row.now);
    return true;
  } catch (err) {
    console.error('❌ SQLite connection failed:', err);
    return false;
  }
};

export default db;
