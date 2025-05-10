import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import 'dotenv/config'; // Load .env variables

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;
const API_PORT = process.env.API_PORT || 3004;

// Enable CORS
app.use(cors());

// Serve static files from the dashboard directory
app.use(express.static(__dirname));

// --- Add BTC Price Proxy Logic ---
let btcPriceCache = { price: null, timestamp: 0, error: null };
const CACHE_DURATION_MS = 60 * 1000; // Cache for 60 seconds

async function fetchBtcPriceFromServer() {
    const now = Date.now();
    if (btcPriceCache.price !== null && (now - btcPriceCache.timestamp < CACHE_DURATION_MS)) {
        console.log('[PROXY CACHE] Using cached BTC price:', btcPriceCache.price);
        return { price: btcPriceCache.price };
    }
    if (btcPriceCache.error !== null && (now - btcPriceCache.timestamp < CACHE_DURATION_MS)) {
         console.log('[PROXY CACHE] Using cached error:', btcPriceCache.error);
        return { error: btcPriceCache.error };
    }
    console.log('[PROXY API] Fetching BTC price from CoinGecko...');
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const responseBody = await response.text();
        console.log(`[PROXY API] CoinGecko Response Status: ${response.status}`);
        if (!response.ok) {
            const errorMsg = `CoinGecko API Error: ${response.status} ${response.statusText}`;
            console.error(`[PROXY API ERROR] ${errorMsg}. Body: ${responseBody}`);
            btcPriceCache = { price: btcPriceCache.price, timestamp: now, error: errorMsg };
            return { error: errorMsg, status: response.status };
        }
        const data = JSON.parse(responseBody);
        if (data && data.bitcoin && typeof data.bitcoin.usd === 'number') {
            const price = data.bitcoin.usd;
            console.log('[PROXY API SUCCESS] Fetched BTC price:', price);
            btcPriceCache = { price: price, timestamp: now, error: null };
            return { price: price };
        } else {
            const errorMsg = 'Invalid data structure from CoinGecko';
            console.error('[PROXY API ERROR]', errorMsg, data);
             btcPriceCache = { price: btcPriceCache.price, timestamp: now, error: errorMsg };
            return { error: errorMsg };
        }
    } catch (error) {
        const errorMsg = `Network error fetching BTC price: ${error.message}`;
        console.error('[PROXY CATCH ERROR]', errorMsg);
        btcPriceCache = { price: btcPriceCache.price, timestamp: now, error: errorMsg };
        return { error: errorMsg };
    }
}

// Define the proxy route
app.get('/btc-price', async (req, res) => {
  const result = await fetchBtcPriceFromServer();
  if (result.error) {
    res.status(result.status || 500).json({ error: result.error });
  } else {
    res.status(200).json({ price: result.price });
  }
});
// --- End BTC Price Proxy Logic ---

// --- Add HLP Vault Details Proxy Logic ---
let hlpDetailsCache = { data: null, timestamp: 0, error: null };
// Use same cache duration as BTC price for simplicity

async function fetchHlpDetailsFromServer(vaultAddress) {
    const now = Date.now();
    const cacheKey = vaultAddress; // Simple key based on address

    if (hlpDetailsCache[cacheKey] && hlpDetailsCache[cacheKey].data && (now - hlpDetailsCache[cacheKey].timestamp < CACHE_DURATION_MS)) {
        console.log(`[PROXY CACHE] Using cached HLP details for ${cacheKey}`);
        return { data: hlpDetailsCache[cacheKey].data };
    }
    if (hlpDetailsCache[cacheKey] && hlpDetailsCache[cacheKey].error && (now - hlpDetailsCache[cacheKey].timestamp < CACHE_DURATION_MS)) {
        console.log(`[PROXY CACHE] Using cached HLP error for ${cacheKey}`);
        return { error: hlpDetailsCache[cacheKey].error };
    }

    console.log(`[PROXY API] Fetching HLP details for ${vaultAddress} from Hyperliquid UI API...`);
    try {
        // Use BORING_VAULT_ADDRESS from environment for the user field
        const userAddress = process.env.BORING_VAULT_ADDRESS;
        if (!userAddress) {
          console.warn('[PROXY WARNING] BORING_VAULT_ADDRESS environment variable not set. User field will be omitted.');
        }

        const requestBody = {
            type: "vaultDetails",
            vaultAddress: vaultAddress
        };
        if (userAddress) {
            requestBody.user = userAddress;
        }

        const response = await fetch('https://api-ui.hyperliquid-testnet.xyz/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        const responseBody = await response.text(); // Get raw body first
        console.log(`[PROXY API] HLP Details Response Status: ${response.status}`);
        console.log(`[PROXY API] HLP Details Raw Response Body: ${responseBody}`); // Log the full raw body

        if (!response.ok) {
            const errorMsg = `Hyperliquid HLP API Error: ${response.status} ${response.statusText}`;
            console.error(`[PROXY API ERROR] ${errorMsg}. Body: ${responseBody}`);
            hlpDetailsCache[cacheKey] = { data: null, timestamp: now, error: errorMsg };
            return { error: errorMsg, status: response.status };
        }

        const data = JSON.parse(responseBody); // Now parse the body

        // Basic check for expected data structure (adjust if needed)
        if (data && typeof data.apr === 'number') {
            console.log('[PROXY API SUCCESS] Fetched HLP details:', data);
            hlpDetailsCache[cacheKey] = { data: data, timestamp: now, error: null };
            return { data: data };
        } else {
            const errorMsg = 'Invalid data structure from Hyperliquid HLP API';
            console.error('[PROXY API ERROR]', errorMsg, data);
             hlpDetailsCache[cacheKey] = { data: null, timestamp: now, error: errorMsg };
            return { error: errorMsg };
        }
    } catch (error) {
        const errorMsg = `Network error fetching HLP details: ${error.message}`;
        console.error('[PROXY CATCH ERROR]', errorMsg);
        hlpDetailsCache[cacheKey] = { data: null, timestamp: now, error: errorMsg };
        return { error: errorMsg };
    }
}

// Define the proxy route (using POST to match API? Or GET with query param? Let's use GET for simplicity)
app.get('/hlp-details', async (req, res) => {
  const vaultAddress = req.query.address;
  if (!vaultAddress) {
    return res.status(400).json({ error: 'Missing vault address query parameter' });
  }

  const result = await fetchHlpDetailsFromServer(vaultAddress);
  if (result.error) {
    res.status(result.status || 500).json({ error: result.error });
  } else {
    res.status(200).json(result.data); // Send back the full data object for now
  }
});
// --- End HLP Vault Details Proxy Logic ---

// --- Add BTC Price from HL Logic ---
let btcPriceHLCache = { price: null, timestamp: 0, error: null };
const BTC_PRICE_CACHE_DURATION_MS = 60 * 4 * 1000; // Cache for 4 minutes

async function fetchUBtcPrice() {
    const now = Date.now();
    if (btcPriceHLCache.price !== null && (now - btcPriceHLCache.timestamp < BTC_PRICE_CACHE_DURATION_MS)) {
        console.log('[HL CACHE] Using cached BTC price from HL:', btcPriceHLCache.price);
        return { price: btcPriceHLCache.price };
    }
    if (btcPriceHLCache.error !== null && (now - btcPriceHLCache.timestamp < CACHE_DURATION_MS)) {
        console.log('[HL CACHE] Using cached error:', btcPriceHLCache.error);
        return { error: btcPriceHLCache.error };
    }

    console.log('[HL API] Fetching BTC price from Hyperliquid...');
    try {
        const requestBody = {
            type: "allMids"
        };

        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const responseBody = await response.text();
        console.log(`[HL API] Response Status: ${response.status}`);

        if (!response.ok) {
            const errorMsg = `Hyperliquid API Error: ${response.status} ${response.statusText}`;
            console.error(`[HL API ERROR] ${errorMsg}. Body: ${responseBody}`);
            btcPriceHLCache = { price: btcPriceHLCache.price, timestamp: now, error: errorMsg };
            return { error: errorMsg, status: response.status };
        }

        const data = JSON.parse(responseBody);
        // Look for BTC price under "@142" key
        if (data && data["@142"]) {
            const price = parseFloat(data["@142"]);
            if (!isNaN(price)) {
                console.log('[HL API SUCCESS] Fetched BTC price:', price);
                btcPriceHLCache = { price: price, timestamp: now, error: null };
                return { price: price };
            } else {
                const errorMsg = 'Invalid BTC price format from Hyperliquid API';
                console.error('[HL API ERROR]', errorMsg, data);
                btcPriceHLCache = { price: btcPriceHLCache.price, timestamp: now, error: errorMsg };
                return { error: errorMsg };
            }
        } else {
            const errorMsg = 'BTC price not found in Hyperliquid API response';
            console.error('[HL API ERROR]', errorMsg, data);
            btcPriceHLCache = { price: btcPriceHLCache.price, timestamp: now, error: errorMsg };
            return { error: errorMsg };
        }
    } catch (error) {
        const errorMsg = `Network error fetching BTC price from HL: ${error.message}`;
        console.error('[HL CATCH ERROR]', errorMsg);
        btcPriceHLCache = { price: btcPriceHLCache.price, timestamp: now, error: errorMsg };
        return { error: errorMsg };
    }
}

// Define the proxy route
app.get('/ubtc-price', async (req, res) => {
    const result = await fetchUBtcPrice();
    if (result.error) {
        res.status(result.status || 500).json({ error: result.error });
    } else {
        res.status(200).json({ price: result.price });
    }
});

// Default route redirects to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
  console.log(`Using Ponder API at http://localhost:${API_PORT}/api`);
  console.log(`Make sure Ponder is running on port ${API_PORT} with 'PORT=3001 API_PORT=${API_PORT} yarn dev'`);
}); 
