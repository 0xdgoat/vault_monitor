import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY are required in the .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create Supabase tables
async function setupSupabase() {
  try {
    console.log('Setting up Supabase tables...');
    
    // These SQL statements would be executed in the Supabase SQL editor
    // or via an admin API call in a real setup.
    // For simplicity, I'm showing what the SQL would look like.
    
    const createRawEventsTable = `
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
    `;
    
    const createPricesAndLiquidityTable = `
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
    `;
    
    const createMetricsPerAssetTable = `
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
    `;
    
    const createPositionsSummaryTable = `
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
    `;
    
    const createProtocolHealthTable = `
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
    `;
    
    const createBtcPriceMonitoringTable = `
    CREATE TABLE IF NOT EXISTS btc_price_monitoring (
      id SERIAL PRIMARY KEY,
      btc_price DECIMAL NOT NULL,
      ubtc_price DECIMAL NOT NULL,
      price_difference_percent DECIMAL NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    `;
    
    const createAlertsTable = `
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      user_address TEXT,
      message TEXT NOT NULL,
      severity TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    `;
    
    console.log(
      'IMPORTANT: Execute the following SQL statements in the Supabase SQL editor:\n\n' +
      createRawEventsTable + '\n\n' +
      createPricesAndLiquidityTable + '\n\n' +
      createMetricsPerAssetTable + '\n\n' +
      createPositionsSummaryTable + '\n\n' +
      createProtocolHealthTable + '\n\n' +
      createBtcPriceMonitoringTable + '\n\n' +
      createAlertsTable
    );
    
    console.log('\nIn a production environment, these would be executed programmatically.');
    
    // Test connection to Supabase
    const { data, error } = await supabase.from('raw_events').select('id').limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error connecting to Supabase:', error);
    } else {
      console.log('Successfully connected to Supabase!');
    }
    
  } catch (error) {
    console.error('Error setting up Supabase:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  setupSupabase();
}

export default setupSupabase; 