import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fetch from 'node-fetch';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY as string;

// Log environment variables (without exposing sensitive data)
console.log('Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('Supabase Key:', supabaseKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY are required in the .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('btc_price_monitoring').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') { // Table does not exist
        console.error('Table btc_price_monitoring does not exist. Please run the setup script first.');
      } else {
        console.error('Error connecting to Supabase:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
      }
      process.exit(1);
    }
    console.log('Successfully connected to Supabase');
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    process.exit(1);
  }
}

// Test connection before starting monitoring
testSupabaseConnection();

// Depeg thresholds
const WARNING_THRESHOLD = 0.01; // 0.5% depeg threshold
const CRITICAL_THRESHOLD = 1.0; // 1.0% depeg threshold
const WARNING_DURATION_MS = 400  ; // 4 hours in milliseconds

// Cache for BTC price
let btcPriceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 };
const BTC_CACHE_DURATION_MS = 10 * 1000; // 10 seconds

// Cache for uBTC price
let ubtcPriceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 };
const UBTC_CACHE_DURATION_MS = 10 * 1000; // 10 seconds

// Track depeg duration
let depegStartTime: number | null = null;
let lastAlertTime: number = 0;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes between alerts

interface CoinGeckoResponse {
  bitcoin: {
    usd: number;
  };
}

interface HyperliquidResponse {
  [key: string]: number;
}

async function getBtcPrice(): Promise<number | null> {
  const now = Date.now();
  if (btcPriceCache.price !== null && (now - btcPriceCache.timestamp < BTC_CACHE_DURATION_MS)) {
    console.log('[CACHE] Using cached BTC price:', btcPriceCache.price);
    return btcPriceCache.price;
  }

  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json() as CoinGeckoResponse;
    const price = data.bitcoin?.usd ?? null;
    
    btcPriceCache = { price, timestamp: now };
    console.log('[API] Fetched BTC price:', price);
    return price;
  } catch (error) {
    console.error('Error fetching BTC price:', error);
    return null;
  }
}

async function getUBtcPrice(): Promise<number | null> {
  const now = Date.now();
  if (ubtcPriceCache.price !== null && (now - ubtcPriceCache.timestamp < UBTC_CACHE_DURATION_MS)) {
    console.log('[CACHE] Using cached uBTC price:', ubtcPriceCache.price);
    return ubtcPriceCache.price;
  }

  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: "allMids"
      })
    });
    const data = await response.json() as HyperliquidResponse;
    const price = data["@142"] ?? null;
    
    ubtcPriceCache = { price, timestamp: now };
    console.log('[API] Fetched uBTC price:', price);
    return price;
  } catch (error) {
    console.error('Error fetching uBTC price:', error);
    return null;
  }
}

async function checkDepegStatus(priceDifferencePercent: number) {
  const now = Date.now();
  const absDifference = Math.abs(priceDifferencePercent);

  // Check if we're above warning threshold
  if (absDifference > WARNING_THRESHOLD) {
    if (depegStartTime === null) {
      depegStartTime = now;
    }

    const depegDuration = now - depegStartTime;
    
    // Check if we've exceeded the warning duration
    if (depegDuration >= WARNING_DURATION_MS && (now - lastAlertTime) >= ALERT_COOLDOWN_MS) {
      console.warn(`⚠️ WARNING: UBTC has been depegged by ${absDifference.toFixed(2)}% for more than 4 hours!`);
      lastAlertTime = now;
      
      // Store alert in Supabase
      await supabase.from('alerts').insert({
        type: 'depeg_warning',
        message: `UBTC has been depegged by ${absDifference.toFixed(2)}% for more than 4 hours`,
        severity: 'warning',
        timestamp: new Date().toISOString()
      });
    }
  } else {
    depegStartTime = null;
  }

  // Check critical threshold
  if (absDifference > CRITICAL_THRESHOLD && (now - lastAlertTime) >= ALERT_COOLDOWN_MS) {
    console.error(`🚨 CRITICAL: UBTC has depegged by ${absDifference.toFixed(2)}%!`);
    lastAlertTime = now;
    
    // Store critical alert in Supabase
    await supabase.from('alerts').insert({
      type: 'depeg_critical',
      message: `UBTC has depegged by ${absDifference.toFixed(2)}% - Borrows should be paused immediately`,
      severity: 'critical',
      timestamp: new Date().toISOString()
    });

    // TODO: Implement borrow pause mechanism
    console.log('🚨 Borrows should be paused immediately');
  }
}

async function monitorPrices() {
  try {
    const btcPrice = await getBtcPrice();
    const ubtcPrice = await getUBtcPrice();

    if (btcPrice === null || ubtcPrice === null) {
      console.error('Failed to fetch one or both prices');
      return;
    }

    // Calculate price difference percentage
    const priceDifferencePercent = ((ubtcPrice - btcPrice) / btcPrice) * 100;
    console.log("priceDifferencePercent:", priceDifferencePercent);
    // Check depeg status
    await checkDepegStatus(priceDifferencePercent);

    // Store in Supabase
    try {
      const { data, error } = await supabase
        .from('btc_price_monitoring')
        .insert({
          btc_price: btcPrice,
          ubtc_price: ubtcPrice,
          price_difference_percent: priceDifferencePercent,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Error storing prices in Supabase:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          error: error
        });
        
        // Check if table exists
        const { data: tableExists } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', 'btc_price_monitoring')
          .single();
          
        if (!tableExists) {
          console.error('Table btc_price_monitoring does not exist in the database');
        }
      } else {
        console.log('Successfully stored prices in Supabase');
        console.log(`BTC Price: $${btcPrice}`);
        console.log(`uBTC Price: $${ubtcPrice}`);
        console.log(`Price Difference: ${priceDifferencePercent.toFixed(4)}%`);
      }
    } catch (error) {
      console.error('Unexpected error while storing prices:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
    }
  } catch (error) {
    console.error('Error in monitorPrices:', error);
  }
}

// Run the monitoring function immediately and then every minute
monitorPrices();
setInterval(monitorPrices, 60 * 1000);

// Export the monitorPrices function for use in cron job
export { monitorPrices }; 