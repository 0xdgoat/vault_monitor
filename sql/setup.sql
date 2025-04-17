
      CREATE TABLE IF NOT EXISTS raw_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        user_address TEXT,
        amount TEXT,
        fee TEXT,
        block_number INTEGER NOT NULL,
        transaction_hash TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_raw_events_event_type ON raw_events (event_type);
      CREATE INDEX IF NOT EXISTS idx_raw_events_contract_address ON raw_events (contract_address);
      CREATE INDEX IF NOT EXISTS idx_raw_events_user_address ON raw_events (user_address);
      CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp ON raw_events (timestamp);
      

      CREATE TABLE IF NOT EXISTS prices_and_liquidity (
        id SERIAL PRIMARY KEY,
        asset_id TEXT NOT NULL,
        asset_symbol TEXT NOT NULL,
        price_usd NUMERIC(24, 8) NOT NULL,
        price_change_24h NUMERIC(24, 8),
        market_cap_usd NUMERIC(36, 8),
        dex_liquidity NUMERIC(36, 8),
        volume_24h NUMERIC(36, 8),
        timestamp TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_prices_asset_id ON prices_and_liquidity (asset_id);
      CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices_and_liquidity (timestamp);
      

      CREATE TABLE IF NOT EXISTS metrics_per_asset (
        id SERIAL PRIMARY KEY,
        asset_id TEXT NOT NULL,
        asset_symbol TEXT NOT NULL,
        average_price_24h NUMERIC(24, 8),
        price_volatility NUMERIC(10, 4),
        liquidity_score NUMERIC(5, 2),
        market_cap_rank INTEGER,
        updated_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_asset_id ON metrics_per_asset (asset_id);
      

      CREATE TABLE IF NOT EXISTS positions_summary (
        id SERIAL PRIMARY KEY,
        user_address TEXT UNIQUE NOT NULL,
        health_factor NUMERIC(24, 8),
        risk_level TEXT,
        price_impact_10pct NUMERIC(24, 8),
        price_impact_20pct NUMERIC(24, 8),
        updated_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_positions_user_address ON positions_summary (user_address);
      CREATE INDEX IF NOT EXISTS idx_positions_risk_level ON positions_summary (risk_level);
      

      CREATE TABLE IF NOT EXISTS protocol_health (
        id SERIAL PRIMARY KEY,
        average_health_factor NUMERIC(24, 8),
        critical_positions_count INTEGER,
        high_risk_positions_count INTEGER,
        total_positions_count INTEGER,
        risk_score NUMERIC(5, 2),
        updated_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_protocol_updated_at ON protocol_health (updated_at);
      

      CREATE TABLE IF NOT EXISTS btc_price_monitoring (
        id SERIAL PRIMARY KEY,
        btc_price DECIMAL NOT NULL,
        ubtc_price DECIMAL NOT NULL,
        price_difference_percent DECIMAL NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      

      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        user_address TEXT,
        message TEXT NOT NULL,
        severity TEXT NOT NULL,
        acknowledged BOOLEAN DEFAULT false,
        timestamp TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts (type);
      CREATE INDEX IF NOT EXISTS idx_alerts_user_address ON alerts (user_address);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts (timestamp);
      