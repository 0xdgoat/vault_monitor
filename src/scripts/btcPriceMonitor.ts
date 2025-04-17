import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fetch from 'node-fetch';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// Cache for BTC price
let btcPriceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 };
const BTC_CACHE_DURATION_MS = 10 * 1000; // 10 seconds

// Cache for uBTC price
let ubtcPriceCache: { price: number | null; timestamp: number } = { price: null, timestamp: 0 };
const UBTC_CACHE_DURATION_MS = 10 * 1000; // 10 seconds

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
    // Store in Supabase
    const { error } = await supabase
      .from('btc_price_monitoring')
      .insert({
        btc_price: btcPrice,
        ubtc_price: ubtcPrice,
        price_difference_percent: priceDifferencePercent,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('Error storing prices in Supabase:', error);
    } else {
      console.log('Successfully stored prices in Supabase');
      console.log(`BTC Price: $${btcPrice}`);
      console.log(`uBTC Price: $${ubtcPrice}`);
      console.log(`Price Difference: ${priceDifferencePercent.toFixed(4)}%`);
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