import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fetch from 'node-fetch';
import { EsploraExplorer } from '@bitcoinerlab/explorer';
import * as bitcoin from 'bitcoinjs-lib';

// Type declarations
interface UTXO {
    txid: string;
    vout: number;
    value: number;
    status: {
        confirmed: boolean;
        block_height?: number;
        block_hash?: string;
        block_time?: number;
    };
}

interface Cache {
    price: number;
    timestamp: number;
}

interface LiquidityCache {
    liquidity: number;
    timestamp: number;
}

interface BtcLiquidityCache {
    [address: string]: LiquidityCache;
}

// Initialize Bitcoin network and explorer
const network = bitcoin.networks.bitcoin;
const explorer = new EsploraExplorer({ url: 'https://blockstream.info/api' });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize caches
let btcPriceCache: Cache = { price: 0, timestamp: 0 };
let ubtcPriceCache: Cache = { price: 0, timestamp: 0 };
const btcLiquidityCache: BtcLiquidityCache = {};
const ubtcLiquidityCache: BtcLiquidityCache = {};

// Track depeg duration
let depegStartTime: number | null = null;
let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes between alerts

async function getBtcPrice(): Promise<number | null> {
  const now = Date.now();
  if (btcPriceCache.price !== null && (now - btcPriceCache.timestamp < 60000)) {
    console.log('[CACHE] Using cached BTC price:', btcPriceCache.price);
    return btcPriceCache.price;
  }

  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
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
  if (ubtcPriceCache.price !== null && (now - ubtcPriceCache.timestamp < 60000)) {
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
    const data = await response.json();
    const price = data["@142"] ?? null;
    
    ubtcPriceCache = { price, timestamp: now };
    console.log('[API] Fetched uBTC price:', price);
    return price;
  } catch (error) {
    console.error('Error fetching uBTC price:', error);
    return null;
  }
}

async function getUBtcLiquidity(address: string): Promise<number> {
  const now = Date.now();
  const cached = ubtcLiquidityCache[address];
  
  if (cached && now - cached.timestamp < 60000) {
    console.log('[CACHE] Using cached uBTC liquidity:', cached.liquidity);
    return cached.liquidity;
  }

  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({  
        type: "spotClearinghouseState",
        user:  address
      })
    });
    
    const data = await response.json();
    for (let i = 0; i < data.balances.length; i++) {
      if (data.balances[i]?.coin === "UBTC") {
        const liquidity = 21000000 - parseFloat(data.balances[i]?.total ?? "0");
        
        ubtcLiquidityCache[address] = { liquidity, timestamp: now };
        console.log('[API] Fetched uBTC liquidity:', liquidity);
        return liquidity;
      }
    }

    return 0;
  } catch (error) {
    console.error('Error fetching uBTC liquidity:', error);
    return 0;
  }
}

async function getBtcLiquidity(address: string): Promise<number> {
  try {
    if (!address) {
      console.error('BTC address is not set in environment variables');
      return 0;
    }

    const now = Date.now();
    const cached = btcLiquidityCache[address];
    
    if (cached && now - cached.timestamp < 60000) {
      return cached.liquidity;
    }

    const response = await fetch(`https://blockstream.info/api/address/${address}/utxo`);
    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${response.status} ${response.statusText}`);
    }
    
    const utxos: UTXO[] = await response.json();
    const liquidity = utxos.reduce((sum: number, utxo: UTXO) => sum + utxo.value, 0);

    btcLiquidityCache[address] = {
      liquidity,
      timestamp: now
    };

    return liquidity;
  } catch (error) {
    console.error('Error getting BTC liquidity:', error);
    return 0;
  }
}

async function monitorPrices() {
  try {
    const btcPrice = await getBtcPrice();
    const ubtcPrice = await getUBtcPrice();
    const btcLiquidity = await getBtcLiquidity(process.env.UNIT_BTC_CHAIN_ADDRESS || '');
    const ubtcLiquidity = await getUBtcLiquidity(process.env.UNIT_BTC_HL_ADDRESS || '');

    if (btcPrice === null || ubtcPrice === null) {
      console.error('Failed to fetch one or both prices');
      return;
    }

    // Calculate price difference percentage
    const priceDifferencePercent = ((ubtcPrice - btcPrice) / btcPrice) * 100;
    console.log("Price Difference Percent:", priceDifferencePercent);
    
    // Log liquidity information
    console.log("BTC Liquidity:", btcLiquidity/100000000, "BTC");
    console.log("uBTC Liquidity:", ubtcLiquidity, "uBTC");

    // Prepare data for Supabase
    const insertData = {
      btc_price: Number(btcPrice),
      ubtc_price: Number(ubtcPrice),
      btc_liquidity: Number(btcLiquidity/100000000),
      ubtc_liquidity: Number(ubtcLiquidity),
      price_difference_percent: Number(priceDifferencePercent),
      timestamp: new Date().toISOString()
    };

    // Log the data we're trying to insert
    console.log('Attempting to insert data:', JSON.stringify(insertData, null, 2));

    // Store in Supabase
    try {
      const { data, error } = await supabase
        .from('btc_price_monitoring')  // Changed table name to match schema
        .insert([insertData]);

      if (error) {
        console.error('Error storing prices in Supabase:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log('Successfully stored prices and liquidity in Supabase');
        
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