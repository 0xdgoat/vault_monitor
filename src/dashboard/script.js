// Dashboard JavaScript

// Global variables to store intermediate results for Net Rate calculation
let currentNetHlpDeposits = null;
let currentHlpApr = null;
let currentTotalDebt = null;
let currentAvgLoanRate = null;

// Check if we're in a browser environment
const isBrowser = typeof document !== 'undefined';
let historicalVaultEvents = [];
let historicalLoanEvents = [];

// Utility functions
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return "-";
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatAddress(address) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp * 1000).toLocaleString();
}

function formatEth(wei) {
  if (!wei) return "0";
  return (Number(wei) / 1e18).toFixed(4);
}

// Function to reset all summary card values to a loading state
function resetSummaryCardsToLoading() {
    if (!isBrowser) return;

    const cardSelectors = {
        '#summary-vault-assets .value-primary': '...', 
        '#summary-vault-assets .value-secondary': '(...)',
        '#summary-loan-collateral .value-primary': '...',
        '#summary-loan-collateral .value-secondary': '(...)',
        '#summary-total-debt': '...',
        '#summary-avg-loan-rate': '...',
        '#summary-hlp-deposits .value-primary': '...',
        '#summary-hlp-deposits .value-secondary': '(...)', // Consistent loading state
        '#summary-hlp-yield': '...',
        '#summary-net-revenue': '...', // Set net rate cards too
        '#summary-net-profit': '...'
    };

    console.log("[UI Reset] Setting summary cards to loading state...");
    for (const selector in cardSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = cardSelectors[selector];
        } else {
            console.warn(`[UI Reset] Element not found for selector: ${selector}`);
        }
    }
}

// API Functions

// Fetch current BTC price from OUR backend proxy
let btcPriceCache = { price: null, timestamp: 0 }; // Keep frontend cache simple
async function getBtcPrice() {
  const now = Date.now();
  // Use frontend cache first (short duration, backend handles main caching/rate limiting)
  if (btcPriceCache.price !== null && (now - btcPriceCache.timestamp < 10000)) { // e.g., 10 second frontend cache
    console.log('[FRONTEND CACHE] Using cached BTC price:', btcPriceCache.price);
    return btcPriceCache.price;
  }

  console.log('[FRONTEND API] Attempting to fetch BTC price from proxy /btc-price ...');
  try {
    // Fetch from your own backend proxy endpoint
    const response = await fetch('/btc-price'); // Relative path to our server endpoint

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to parse error
      console.error(`[FRONTEND API ERROR] Proxy response not OK: ${response.status} ${response.statusText}. Error: ${errorData.error || 'Unknown'}`);
      return null; // Indicate error to callers
    }

    const data = await response.json();

    if (data && typeof data.price === 'number') {
      const price = data.price;
      console.log('[FRONTEND API SUCCESS] Fetched BTC price via proxy:', price);
      btcPriceCache = { price: price, timestamp: now }; // Update frontend cache
      return price;
    } else {
      console.error('[FRONTEND API ERROR] Invalid data structure received from proxy:', data);
      return null; // Indicate error to callers
    }
  } catch (error) {
    console.error('[FRONTEND CATCH ERROR] Error fetching BTC price from proxy:', error);
    return null; // Indicate error to callers
  }
}

// Fetch current BTC price from Hyperliquid
let btcPriceHLCache = { price: null, timestamp: 0 }; // Keep frontend cache simple
async function getBtcPriceFromHL() {
  const now = Date.now();
  // Use frontend cache first (short duration, backend handles main caching/rate limiting)
  if (btcPriceHLCache.price !== null && (now - btcPriceHLCache.timestamp < 10000)) { // e.g., 10 second frontend cache
    console.log('[FRONTEND CACHE] Using cached BTC price from HL:', btcPriceHLCache.price);
    return btcPriceHLCache.price;
  }

  console.log('[FRONTEND API] Attempting to fetch BTC price from HL proxy /btc-price-hl ...');
  try {
    // Fetch from our backend proxy endpoint
    const response = await fetch('/btc-price-hl'); // Relative path to our server endpoint

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to parse error
      console.error(`[FRONTEND API ERROR] Proxy response not OK: ${response.status} ${response.statusText}. Error: ${errorData.error || 'Unknown'}`);
      return null; // Indicate error to callers
    }

    const data = await response.json();

    if (data && typeof data.price === 'number') {
      const price = data.price;
      console.log('[FRONTEND API SUCCESS] Fetched BTC price via HL proxy:', price);
      btcPriceHLCache = { price: price, timestamp: now }; // Update frontend cache
      return price;
    } else {
      console.error('[FRONTEND API ERROR] Invalid data structure received from proxy:', data);
      return null; // Indicate error to callers
    }
  } catch (error) {
    console.error('[FRONTEND CATCH ERROR] Error fetching BTC price from HL proxy:', error);
    return null; // Indicate error to callers
  }
}

async function fetchData(query) {
  try {
    console.log('Attempting to fetch from GraphQL endpoint... Query:', query.trim().substring(0, 100) + '...');
    
    const response = await fetch('https://066c76113133.ngrok.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      console.error(`GraphQL response not OK: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log('GraphQL response received:', data);
    
    if (data.errors) {
      console.error('GraphQL errors:', JSON.stringify(data.errors));
      showErrorMessage(`GraphQL errors: ${data.errors.map(e => e.message).join(', ')}`);
      return null;
    }
    
    if (!data.data) {
      console.error('No data returned from GraphQL');
      showErrorMessage('No data returned from GraphQL');
      return null;
    }
    
    console.log('Successfully fetched data:', JSON.stringify(data.data).substring(0, 200) + '...');
    return data.data;
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

// Show error message on dashboard
function showErrorMessage(message) {
  if (!isBrowser) return;
  
  const errorContainer = document.getElementById('error-container');
  if (!errorContainer) {
    // Create error container if it doesn't exist
    const main = document.querySelector('main');
    if (main) {
      const container = document.createElement('div');
      container.id = 'error-container';
      container.className = 'alert alert-danger mt-3 mb-3';
      container.style.display = 'none';
      main.prepend(container);
    }
  }
  
  const container = document.getElementById('error-container');
  if (container) {
    // Create message if doesn't exist already
    if (!container.textContent.includes(message)) {
      const errorElement = document.createElement('div');
      errorElement.textContent = message;
      container.appendChild(errorElement);
      
      // Add reload button if not present
      if (!container.querySelector('button')) {
        const reloadButton = document.createElement('button');
        reloadButton.className = 'btn btn-sm btn-danger mt-2';
        reloadButton.textContent = 'Reload Data';
        reloadButton.addEventListener('click', () => {
          container.style.display = 'none';
          container.innerHTML = '';
          loadDashboardData();
        });
        container.appendChild(reloadButton);
      }
    }
    
    container.style.display = 'block';
  }
}

// Clear error messages
function clearErrorMessages() {
  if (!isBrowser) return;
  
  const errorContainer = document.getElementById('error-container');
  if (errorContainer) {
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
  }
}

// Update last updated timestamp
function updateLastUpdated() {
  if (!isBrowser) return;
  
  const lastUpdatedElement = document.getElementById('last-updated');
  if (lastUpdatedElement) {
    const now = new Date();
    lastUpdatedElement.textContent = `Last updated: ${now.toLocaleString()}`;
  }
}

// Calculate and update risk metrics
function updateRiskMetrics(loans = []) {
  if (!isBrowser) return;
  
  // Calculate average health factor
  let totalHealthFactor = 0;
  let loansNearLiquidation = 0;
  let totalCollateral = 0;
  
  if (loans.length > 0) {
    loans.forEach(loan => {
      const healthFactor = Number(loan.healthFactor) || 0;
      totalHealthFactor += healthFactor;
      
      // Count loans with health factor < 1.2 as near liquidation
      if (healthFactor > 0 && healthFactor < 1) {
        loansNearLiquidation++;
      }
      
      totalCollateral += Number(loan.collateralAmount) || 0;
    });
    
    const avgHealthFactor = totalHealthFactor / loans.length;
    
    // Update UI elements
    document.getElementById('avg-health-factor').textContent = formatNumber(avgHealthFactor);
    document.getElementById('loans-near-liquidation').textContent = loansNearLiquidation;
    document.getElementById('total-collateral').textContent = formatEth(totalCollateral.toString());
    
    // Update risk score based on metrics
    let riskLevel = "Low";
    let riskClass = "bg-success";
    let riskWidth = "25%";
    
    if (loansNearLiquidation > 0 || avgHealthFactor < 1) {
      riskLevel = "High";
      riskClass = "bg-danger";
      riskWidth = "75%";
    } else if (avgHealthFactor < 2.0) {
      riskLevel = "Medium";
      riskClass = "bg-warning";
      riskWidth = "50%";
    }
    
    const riskBar = document.getElementById('risk-score-bar');
    if (riskBar) {
      riskBar.className = `progress-bar ${riskClass}`;
      riskBar.style.width = riskWidth;
      riskBar.textContent = riskLevel;
      
      document.getElementById('risk-score').textContent = riskLevel;
    }
  }
}

// Function to load LATEST HLP Snapshot Data from Ponder DB
async function loadHlpYieldAndPnl() {
  const hlpVaultAddress = "0xa15099a30bbf2e68942d6f4c43d70d04faeab0a0"; // Testnet address
  const yieldElement = document.getElementById('summary-hlp-yield');
  const depositsElement = document.getElementById('summary-hlp-deposits');
  const valueSecondaryElement = depositsElement ? depositsElement.querySelector('.value-secondary') : null;

  // --- Fetch Latest Snapshot from Ponder DB --- 
  console.log(`[GraphQL] Fetching latest HLP snapshot for ${hlpVaultAddress}...`);
  try {
    const query = `
      query {
        hlpSnapshots(
          where: { vaultAddress: "${hlpVaultAddress.toLowerCase()}" },
          orderBy: "timestamp",
          orderDirection: "desc",
          limit: 1 
        ) {
          items {
            apr
            maxWithdrawable
            timestamp 
          }
        }
      }
    `;
    const gqlData = await fetchData(query);

    if (gqlData && gqlData.hlpSnapshots && gqlData.hlpSnapshots.items && gqlData.hlpSnapshots.items.length > 0) {
        const latestSnapshot = gqlData.hlpSnapshots.items[0];
        console.log('[GraphQL SUCCESS] Received Latest HLP Snapshot from DB:', latestSnapshot);

        // Update cards using snapshot data
        if (yieldElement) {
            const apr = latestSnapshot.apr ? parseFloat(latestSnapshot.apr) : null;
            if (apr !== null && !isNaN(apr)) {
                currentHlpApr = apr; // Store the decimal APR
                console.log(`[NetRateCalc] Stored hlpApr: ${currentHlpApr}`);
                yieldElement.textContent = formatNumber(apr * 100, 2);
            } else {
                currentHlpApr = null; // Ensure it's null if invalid
                console.warn('[DB DATA WARNING] Invalid APR data in snapshot');
                yieldElement.textContent = "...";
            }
        }
        if (valueSecondaryElement) {
            const maxW = latestSnapshot.maxWithdrawable ? parseFloat(latestSnapshot.maxWithdrawable) : null;
            if (maxW !== null && !isNaN(maxW)) {
                valueSecondaryElement.textContent = `(Withdrawable: ${formatNumber(maxW, 2)})`;
            } else {
                 console.warn('[DB DATA WARNING] Invalid maxWithdrawable data in snapshot');
                 valueSecondaryElement.textContent = "(...)";
            }
        }
    } else {
        console.error('[GraphQL ERROR] No HLP Snapshots found in Ponder DB for address:', hlpVaultAddress);
        if (yieldElement) yieldElement.textContent = "...";
        if (valueSecondaryElement) valueSecondaryElement.textContent = "(...)";
        currentHlpApr = null; // Reset APR if snapshot fails
    }
  } catch (error) {
     console.error('[GraphQL CATCH ERROR] Error fetching HLP snapshot from Ponder DB:', error);
     if (yieldElement) yieldElement.textContent = "...";
     if (valueSecondaryElement) valueSecondaryElement.textContent = "(...)";
     currentHlpApr = null; // Reset APR on hard error
  }
}

// New function to calculate and display Net Rates
function calculateAndDisplayNetRates() {
    const revenueElement = document.getElementById('summary-net-revenue');
    const profitElement = document.getElementById('summary-net-profit');

    console.log("[NetRateCalc] Attempting calculation with:", 
        { deposits: currentNetHlpDeposits, apr: currentHlpApr, debt: currentTotalDebt, loanRate: currentAvgLoanRate });

    // Check if all required data points are available and valid numbers
    if (currentNetHlpDeposits !== null && typeof currentNetHlpDeposits === 'number' &&
        currentHlpApr !== null && typeof currentHlpApr === 'number' &&
        currentTotalDebt !== null && typeof currentTotalDebt === 'number' && currentTotalDebt > 0 && // Debt needs conversion
        currentAvgLoanRate !== null && typeof currentAvgLoanRate === 'number') 
    { 
        // Convert totalDebt from wei-like format (1e18) to standard number
        const totalDebtNumber = Number(currentTotalDebt) / 1e18;

        // Calculate annualized numbers
        const annualizedRevenue = currentNetHlpDeposits * currentHlpApr;
        const annualizedCost = totalDebtNumber * (currentAvgLoanRate / 100); // Loan rate is already %
        const annualizedProfit = annualizedRevenue - annualizedCost;

        console.log("[NetRateCalc] Calculated Values:", 
            { revenue: annualizedRevenue, cost: annualizedCost, profit: annualizedProfit });

        // Update UI elements
        if (revenueElement) revenueElement.textContent = formatNumber(annualizedRevenue, 2);
        if (profitElement) profitElement.textContent = formatNumber(annualizedProfit, 2);

    } else {
        console.warn("[NetRateCalc] Skipping calculation - one or more data points missing or invalid.");
    }
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Clear previous errors
    clearErrorMessages();
    
    if (isBrowser) {
      // Reset cards to loading state FIRST
      resetSummaryCardsToLoading();

      // Update loading state for tables (keep this)
      document.querySelectorAll('tbody').forEach(tbody => {
        if (tbody.children.length === 0 || 
            (tbody.children.length === 1 && tbody.children[0].textContent.includes('No data'))) {
          tbody.innerHTML = '<tr><td colspan="10" class="text-center">Loading data...</td></tr>';
        }
      });

      // Load all data in parallel
      await Promise.all([
        loadVaults(),
        loadVaultEvents(),
        loadVaultUsers(),
        loadLoans(), // Populates currentTotalDebt, currentAvgLoanRate
        loadLoanEvents(),
        loadL1Data(),
        loadHlpTransactions(), // Populates currentNetHlpDeposits
        loadHlpYieldAndPnl() // Populates currentHlpApr
      ]);
      
      // Calculate and display net rates AFTER all data is loaded
      calculateAndDisplayNetRates();
      
      // Create charts
      createVaultActivityChart();
      createLoanHealthChart();
      
      // Update last updated timestamp
      updateLastUpdated();
    }
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

// Data loading functions
async function loadVaults() {
  const query = `
    query {
      vaultEntitys {
        items {
          id
          totalAssets
          totalShares
          depositCount
          withdrawCount
          userCount
          lastEventTimestamp
        }
      }
    }
  `;
  
  const data = await fetchData(query);
  if (!data || !isBrowser) return;
  
  const vaults = data.vaultEntitys.items;
  const vaultsTable = document.getElementById('vaults-table');
  
  if (!vaultsTable) return;
  
  if (vaults.length === 0) {
    vaultsTable.innerHTML = '<tr><td colspan="7" class="text-center">No vaults found</td></tr>';
    return;
  }
  
  console.log('[loadVaults] Attempting to get BTC price...');
  const btcPrice = await getBtcPrice();
  console.log('[loadVaults] Received BTC price:', btcPrice, '(Type:', typeof btcPrice, ')');

  if (vaults.length > 0) {
    const totalAssetsWei = vaults[0].totalAssets;
    const totalAssetsBtc = Number(totalAssetsWei) / 1e18;
    let totalAssetsUsd = '?'; // Default to ?
    if (typeof btcPrice === 'number') { // Check if price is valid number
        totalAssetsUsd = formatNumber(totalAssetsBtc * btcPrice, 0);
    } else {
        console.warn('[loadVaults] Invalid btcPrice for summary card calculation.');
    }

    // Update stacked display in summary card
    const vaultAssetsElement = document.getElementById('summary-vault-assets');
    if (vaultAssetsElement) {
        vaultAssetsElement.querySelector('.value-primary').textContent = `$${totalAssetsUsd}`;
        vaultAssetsElement.querySelector('.value-secondary').textContent = `(${formatNumber(totalAssetsBtc, 4)} BTC)`;
    }

    // Update table display (USD value + BTC in smaller font below)
    vaultsTable.innerHTML = '';
    vaults.forEach(vault => {
      const assetsBtc = Number(vault.totalAssets) / 1e18;
      let assetsUsd = '?'; // Default to ?
       if (typeof btcPrice === 'number') { // Check if price is valid number
           assetsUsd = formatNumber(assetsBtc * btcPrice, 0);
       } else {
           console.warn('[loadVaults] Invalid btcPrice for table row calculation.');
       }
      const sharesFeBTC = Number(vault.totalShares / 1e27).toFixed(0);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatAddress(vault.id)}</td>
        <td>$${assetsUsd}<span class="btc-value">(${formatNumber(assetsBtc, 4)} BTC)</span></td>
        <td>${sharesFeBTC}</td>
        <td>${vault.depositCount}</td>
        <td>${vault.withdrawCount}</td>
        <td>${vault.userCount}</td>
        <td>${formatTimestamp(vault.lastEventTimestamp)}</td>
      `;
      vaultsTable.appendChild(row);
    });
  }
}

async function loadVaultEvents() {
  const query = `
    query {
      vaultEventEntitys(orderBy: "timestamp", limit: 10) {
        items {
          id
          transactionHash
          vaultAddress
          eventType
          user
          amount
          shares
          timestamp
        }
      }
    }
  `;
  
  const data = await fetchData(query);
  if (!data || !isBrowser) return;
  
  const events = data.vaultEventEntitys?.items || [];
  historicalVaultEvents = events;
  const eventsTable = document.getElementById('vault-events-table');
  
  if (!eventsTable) return;
  
  if (events.length === 0) {
    eventsTable.innerHTML = '<tr><td colspan="7" class="text-center">No events found</td></tr>';
    return;
  }
  
  eventsTable.innerHTML = '';
  
  events.forEach(event => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatAddress(event.transactionHash)}</td>
      <td>${formatAddress(event.vaultAddress)}</td>
      <td>${event.eventType}</td>
      <td>${formatAddress(event.user)}</td>
      <td>${formatEth(event.amount)}</td>
      <td>${Number(event.shares / 1e26).toFixed(0)}</td>
      <td>${formatTimestamp(event.timestamp)}</td>
    `;
    eventsTable.appendChild(row);
  });
}

async function loadVaultUsers() {
  const query = `
    query {
      vaultUserEntitys(orderBy: "shares", limit: 10) {
        items {
          id
          userAddress
          vaultAddress
          shares
          depositCount
          withdrawCount
          lastActionTimestamp
          unlockTime
          isActive
        }
      }
    }
  `;
  
  const data = await fetchData(query);
  if (!data || !isBrowser) return;
  
  const users = data.vaultUserEntitys?.items || [];
  const usersTable = document.getElementById('vault-users-table');
  
  if (!usersTable) return;
  
  if (users.length === 0) {
    usersTable.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
    return;
  }
  
  usersTable.innerHTML = '';
  
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatAddress(user.userAddress)}</td>
      <td>${formatAddress(user.vaultAddress)}</td>
      <td>${Number(user.shares / 1e26).toFixed(0)}</td>
      <td>${user.depositCount}</td>
      <td>${user.withdrawCount}</td>
      <td>${formatTimestamp(user.lastActionTimestamp)}</td>
      <td>${'-'}</td>
    `;
    usersTable.appendChild(row);
  });
}

async function loadLoans() {
  const query = `
    query {
      loanEntitys(where : { borrowerAddress: "0xdd00059904ddf45e30b4131345957f76f26b8f6c"}) {
        items {
          id
          borrowerAddress
          outstandingDebt
          collateralAmount
          healthFactor
          interestRate
          isActive
          lastEventType
          lastEventTimestamp
          troveId
        }
      }
    }
  `;
  
  const data = await fetchData(query);
  if (!data || !isBrowser) return;
  
  const loans = data.loanEntitys?.items || [];
  historicalLoanEvents = loans;
  const loansTable = document.getElementById('loans-table');
  
  if (!loansTable) return;
  
  console.log('[loadLoans] Received loans array from API:', JSON.stringify(loans, null, 2));

  if (loans.length === 0) {
    loansTable.innerHTML = '<tr><td colspan="7" class="text-center">No loans found</td></tr>';
    return;
  }
  
  console.log('[loadLoans] Attempting to get BTC price...');
  const btcPrice = await getBtcPrice();
  console.log('[loadLoans] Received BTC price:', btcPrice, '(Type:', typeof btcPrice, ')');

  if (loans.length > 0) {
    const totalDebt = loans.reduce((sum, loan) => sum + Number(loan.outstandingDebt || 0), 0);
    const totalCollateralWei = loans.reduce((sum, loan) => sum + Number(loan.collateralAmount || 0), 0);
    const totalCollateralBtc = Number(totalCollateralWei) / 1e18;
    let totalCollateralUsd = '?'; // Default to ?
    if (typeof btcPrice === 'number') { // Check if price is valid number
        totalCollateralUsd = formatNumber(totalCollateralBtc * btcPrice, 0);
    } else {
        console.warn('[loadLoans] Invalid btcPrice for summary card calculation.');
    }

    const totalInterestRateSum = loans.reduce((sum, loan) => sum + Number(loan.interestRate || 0), 0);
    const avgInterestRate = loans.length > 0 ? (totalInterestRateSum / loans.length / 1e16) : 0;

    // Store for Net Rate calculation
    currentTotalDebt = totalDebt; 
    currentAvgLoanRate = avgInterestRate;
    console.log(`[NetRateCalc] Stored totalDebt: ${currentTotalDebt}, avgLoanRate: ${currentAvgLoanRate}`);

    // Update stacked display in summary card
    const loanCollateralElement = document.getElementById('summary-loan-collateral');
    if (loanCollateralElement) {
        loanCollateralElement.querySelector('.value-primary').textContent = `$${totalCollateralUsd}`;
        loanCollateralElement.querySelector('.value-secondary').textContent = `(${formatNumber(totalCollateralBtc, 4)} BTC)`;
    }
    document.getElementById('summary-total-debt').textContent = formatEth(totalDebt.toString());
    document.getElementById('summary-avg-loan-rate').textContent = formatNumber(avgInterestRate, 2);

    // Update table display (USD value + BTC in smaller font below)
    loansTable.innerHTML = '';
    loans.forEach(loan => {
      const collateralBtc = Number(loan.collateralAmount) / 1e18;
      let collateralUsd = '?'; // Default to ?
      if (typeof btcPrice === 'number') { // Check if price is valid number
          collateralUsd = formatNumber(collateralBtc * btcPrice, 0);
      } else {
          console.warn('[loadLoans] Invalid btcPrice for table row calculation.');
      }
      const debtFeUSD = formatEth(loan.outstandingDebt);
      const interestRatePercent = formatNumber(loan.interestRate / 1e16);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatAddress(loan.troveId)}</td>
        <td>${debtFeUSD}</td>
        <td>$${collateralUsd}<span class="btc-value">(${formatNumber(collateralBtc, 4)} BTC)</span></td>
        <td>${formatNumber(loan.healthFactor)}</td>
        <td>${interestRatePercent}%</td>
        <td>${loan.isActive ? 'Active' : 'Closed'}</td>
        <td>${formatTimestamp(loan.lastEventTimestamp)}</td>
      `;
      loansTable.appendChild(row);
    });

    updateRiskMetrics(loans);
  }
}

async function loadLoanEvents() {
  const query = `
    query {
      loanEventEntitys(where : { borrowerAddress: "0xdd00059904ddf45e30b4131345957f76f26b8f6c"}) {
        items {
          id
          borrowerAddress
          transactionHash
          loanId
          eventType
          debtChange
          collateralChange
          healthFactorAfter
          timestamp
          troveId
        }
      }
    }
  `;
  
  const data = await fetchData(query);
  if (!data || !isBrowser) return;
  
  const events = data.loanEventEntitys?.items || [];
  const eventsTable = document.getElementById('loan-events-table');
  
  if (!eventsTable) return;
  
  if (events.length === 0) {
    eventsTable.innerHTML = '<tr><td colspan="7" class="text-center">No events found</td></tr>';
    return;
  }
  
  eventsTable.innerHTML = '';
  
  events.forEach(event => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatAddress(event.transactionHash)}</td>
      <td>${formatAddress(event.troveId)}</td>
      <td>${event.eventType}</td>
      <td>${formatEth(event.debtChange)}</td>
      <td>${formatEth(event.collateralChange)}</td>
      <td>${formatNumber(event.healthFactorAfter)}</td>
      <td>${formatTimestamp(event.timestamp)}</td>
    `;
    eventsTable.appendChild(row);
  });
}

async function loadL1Data() {
  const query = `
    query {
      # Fetch 100 records using original var names
      vaultEquitys(orderBy: "lastTimestamp", orderDirection: "desc") {
        items {
          id
          lastTimestamp
          equity
          withdrawableAmount
        }
      }
      vaultSpotBalances(orderBy: "lastTimestamp", orderDirection: "desc") {
        items {
          id
          lastTimestamp
          total
          hold
        }
      }
    }
  `;

  const data = await fetchData(query);
  if (!data || !isBrowser) return;

  const vaultEquitys = data.vaultEquitys?.items || [];
  const vaultSpotBalances = data.vaultSpotBalances?.items || [];

  let uniqueEquityHistoryForChart = [];
  if (vaultEquitys.length > 0) { // Use vaultEquitys
    uniqueEquityHistoryForChart.push(vaultEquitys[0]); // Always include the latest
    for (let i = 1; i < vaultEquitys.length; i++) { // Use vaultEquitys
      if (Number(vaultEquitys[i].equity) !== Number(vaultEquitys[i - 1].equity)) {
        uniqueEquityHistoryForChart.push(vaultEquitys[i]); // Use vaultEquitys
      }
    }
  }

  let uniqueSpotHistoryForChart = [];
  if (vaultSpotBalances.length > 0) { // Use vaultSpotBalances
    uniqueSpotHistoryForChart.push(vaultSpotBalances[0]); // Always include the latest
    for (let i = 1; i < vaultSpotBalances.length; i++) { // Use vaultSpotBalances
      if (Number(vaultSpotBalances[i].total) !== Number(vaultSpotBalances[i - 1].total)) {
        uniqueSpotHistoryForChart.push(vaultSpotBalances[i]); // Use vaultSpotBalances
      }
    }
  }

  const equityChartCtx = document.getElementById('vaultEquityChart')?.getContext('2d');
  if (equityChartCtx && uniqueEquityHistoryForChart.length > 0) {
    const reversedUniqueEquityHistory = [...uniqueEquityHistoryForChart].reverse();
    
    // Calculate percentage changes
    const equityPctChangeData = reversedUniqueEquityHistory.map((item, index, arr) => {
      if (index === 0) return 0; // No change for the first point
      const prevValue = Number(arr[index - 1].equity);
      if (prevValue === 0) return 0; // Avoid division by zero
      const currentValue = Number(item.equity);
      return ((currentValue / prevValue) - 1) * 100;
    });
    const withdrawablePctChangeData = reversedUniqueEquityHistory.map((item, index, arr) => {
       if (index === 0) return 0;
       const prevValue = Number(arr[index - 1].withdrawableAmount);
       if (prevValue === 0) return 0;
       const currentValue = Number(item.withdrawableAmount);
       // Return large number if prev was 0 and current > 0, or 0 otherwise
       if (prevValue === 0 && currentValue > 0) return 100.0; // Or handle differently
       if (prevValue === 0) return 0.0;
       return ((currentValue / prevValue) - 1) * 100;
    });

    const allEquityChanges = [...equityPctChangeData, ...withdrawablePctChangeData];
    const dataMinPct = Math.min(...allEquityChanges);
    const dataMaxPct = Math.max(...allEquityChanges);
    const maxAbsDev = Math.max(Math.abs(dataMinPct), Math.abs(dataMaxPct));
    let yMin = -maxAbsDev * 1.1; // 10% padding below
    let yMax = maxAbsDev * 1.1;  // 10% padding above
    // Ensure a minimum visible range if changes are tiny
    if (yMax - yMin < 0.01) { // e.g., minimum +/- 0.005% range
        yMax = 0.005;
        yMin = -0.005;
    }

    // Destroy existing chart instance
    const existingEquityChart = Chart.getChart(equityChartCtx);
    if (existingEquityChart) { existingEquityChart.destroy(); }
    
    new Chart(equityChartCtx, {
      type: 'line',
      data: {
        labels: reversedUniqueEquityHistory.map(item => new Date(Number(item.lastTimestamp)).getDate()),
        datasets: [{
          label: 'Equity (% Change)',
          data: equityPctChangeData, // Use percentage change data
          borderColor: 'rgba(75, 192, 192, 1)',
          fill: false,
          tension: 0.1, 
          stepped: true
        }, {
          label: 'Withdrawable (% Change)',
          data: withdrawablePctChangeData, // Use percentage change data
          borderColor: 'rgba(255, 99, 132, 1)',
          fill: false,
          tension: 0.1, 
          stepped: true
        }]
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) { label += ': '; }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(4) + '%'; // Add % sign and more precision
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                min: yMin, // Apply calculated min
                max: yMax  // Apply calculated max
            }
        }
       }
    });
  }

  const spotBalanceChartCtx = document.getElementById('vaultSpotBalanceChart')?.getContext('2d');
  if (spotBalanceChartCtx && uniqueSpotHistoryForChart.length > 0) {
    const reversedUniqueSpotHistory = [...uniqueSpotHistoryForChart].reverse();
    const SPOT_DIVISOR = 1e8; 

    // Calculate absolute values for scaling
    const spotValues = reversedUniqueSpotHistory.map(item => Number(item.total) / SPOT_DIVISOR);

    const spotDataMin = Math.min(...spotValues);
    const spotDataMax = Math.max(...spotValues);
    let spotYMin, spotYMax;
    if (spotDataMin === spotDataMax) {
      spotYMin = spotDataMin >= 0 ? spotDataMin * 0.9 : spotDataMin * 1.1; // Adjust padding differently around 0 if needed
      spotYMax = spotDataMax >= 0 ? spotDataMax * 1.1 : spotDataMax * 0.9;
    } else {
      const padding = (spotDataMax - spotDataMin) * 0.1; // 10% padding maybe better for bar chart
      spotYMin = spotDataMin - padding;
      spotYMax = spotDataMax + padding;
    }

    // Destroy existing chart instance
    const existingSpotChart = Chart.getChart(spotBalanceChartCtx);
    if (existingSpotChart) { existingSpotChart.destroy(); }
    
    new Chart(spotBalanceChartCtx, {
      type: 'bar', 
      data: {
        labels: reversedUniqueSpotHistory.map(item => new Date(Number(item.lastTimestamp)).getDate()),
        datasets: [{
          label: 'Total Spot Balance (USDC)', // Revert label
          data: spotValues, // Use absolute values
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: { // Remove % sign from tooltip
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) { label += ': '; }
                        if (context.parsed.y !== null) {
                            label += formatNumber(context.parsed.y, 2); // Use formatNumber
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false, // Allow zoom, even for bar chart
                min: spotYMin, // Apply calculated min
                max: spotYMax  // Apply calculated max
            }
        }
       }
    });
  }
}

async function loadHlpTransactions() {
  const query = `
    query {
      hlpVaultEvents(orderBy: "timestamp") {
        items {
          id
          transactionHash
          eventType
          amount
          timestamp
        }
      }
    }
  `;

  const data = await fetchData(query);
  if (!data || !isBrowser) return;

  const events = data.hlpVaultEvents?.items || [];
  const eventsTable = document.getElementById('hlp-events-table');
  const depositsElement = document.getElementById('summary-hlp-deposits');

  if (!eventsTable) return;

  if (events.length === 0) {
    eventsTable.innerHTML = '<tr><td colspan="7" class="text-center">No events found</td></tr>';
    return;
  }

  eventsTable.innerHTML = '';

  events.forEach(event => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatAddress(event.transactionHash)}</td>
      <td>${event.eventType}</td>
      <td>${Number(event.amount) / 1e6}</td>
      <td>${formatTimestamp(event.timestamp)}</td>
    `;
    eventsTable.appendChild(row);
  });

  const hlpActivity = document.getElementById('hlp-activity-table');
  if (!hlpActivity || !isBrowser) return;

  hlpActivity.innerHTML = '';

  events.forEach(event => {
    if (event.eventType === 'l1-deposit' || event.eventType === 'l1-withdraw') {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${event.eventType}</td>
        <td>${event.eventType === 'l1-deposit' ? Number(event.amount) / 1e6 : '-'}</td>
        <td>${event.eventType === 'l1-withdraw' ? Number(event.amount) / 1e6 : ''}</td>
        <td>${formatTimestamp(event.timestamp)}</td>
      `;
      hlpActivity.appendChild(row);
    }
  });

  // Calculate Net Deposits
  let netDeposits = 0;
  if (events.length > 0) {
      netDeposits = events.reduce((sum, event) => {
          const amount = Number(event.amount) / 1e6; // Assume USDC with 6 decimals
          if (event.eventType === 'l1-deposit') {
              return sum + amount;
          } else if (event.eventType === 'l1-withdraw') {
              return sum - amount;
          }
          return sum;
      }, 0);
  }

  // Store for Net Rate calculation
  currentNetHlpDeposits = netDeposits;
  console.log(`[NetRateCalc] Stored netHlpDeposits: ${currentNetHlpDeposits}`);

  // Update Primary Value of HLP Deposits Card
  if (depositsElement) {
    console.log('[loadHlpTransactions] Found depositsElement:', depositsElement);
    const primarySpan = depositsElement.querySelector('.value-primary');
    console.log('[loadHlpTransactions] Found primarySpan:', primarySpan);

    if (primarySpan) {
        primarySpan.textContent = formatNumber(netDeposits, 2);
    } else {
        console.error('[loadHlpTransactions] CRITICAL: QuerySelector could not find .value-primary inside:', depositsElement.outerHTML);
    }
    // Secondary value will be updated by loadHlpYieldAndPnl
  } else {
    console.warn('Could not find HLP Deposits card element #summary-hlp-deposits to update primary value.');
  }
}

// Chart creation
function createVaultActivityChart() {
  if (!isBrowser) return;
  
  const ctx = document.getElementById('vaultActivityChart');
  if (!ctx) return;
  
  const ctxContext = ctx.getContext('2d');
  
  // Sample data - will be replaced with real data
  new Chart(ctxContext, {
    type: 'bar',
    data: {
      labels: 
        historicalVaultEvents.map(
          event => new Date(Number(event.timestamp * 1000)).getDate()
        ),
      datasets: [{
        label: 'Deposits',
        data: historicalVaultEvents.map(event => (event.eventType === 'deposit') ? Number(event.amount) / 1e18 : 0),
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }, {
        label: 'Withdrawals',
        data: historicalVaultEvents.map(event => (event.eventType === 'withdraw') ? Number(event.amount) / 1e18 : 0),
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function createLoanHealthChart() {
  if (!isBrowser) return;
  
  const ctx = document.getElementById('loanHealthChart');
  if (!ctx) return;
  
  const ctxContext = ctx.getContext('2d');

  const labels = historicalLoanEvents.map(event => new Date(Number(event.lastEventTimestamp * 1000)).getDate());
  const data = historicalLoanEvents.map(event => Number(event.healthFactor) );
  labels.push(new Date().getDate());
  data.push(Number(historicalLoanEvents[historicalLoanEvents.length - 1].healthFactor));
  new Chart(ctxContext, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average Health Factor',
        data: data,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}

// Theme Switching Logic
function applyTheme(theme) {
  if (!isBrowser) return;
  if (theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }
}

function toggleTheme() {
  if (!isBrowser) return;
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);
}

function loadTheme() {
  if (!isBrowser) return;
  // Default to light unless 'dark' is explicitly saved
  const savedTheme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  applyTheme(savedTheme);
}

// Sidebar Navigation Interaction
function setupSidebarNavigation() {
  if (!isBrowser) return;

  const sidebarLinks = document.querySelectorAll('.sidebar .nav-link');
  const sections = document.querySelectorAll('main h2[id]'); // Get section headers with IDs

  if (!sidebarLinks.length || !sections.length) {
    console.warn('Sidebar links or main sections not found for interaction setup.');
    return;
  }

  // --- Smooth Scrolling on Click ---
  sidebarLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      const href = this.getAttribute('href');
      if (href && href.startsWith('#')) {
        event.preventDefault(); // Prevent default jump
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Optionally update URL hash without jumping (good for back button/history)
          // history.pushState(null, null, href);

          // Manually update active class immediately on click for snappier feel
          updateActiveLink(targetId);
        }
      }
    });
  });

  // --- Active Link Highlighting on Scroll (Intersection Observer) ---
  const observerOptions = {
    root: null, // Use the viewport as the root
    rootMargin: '0px',
    threshold: 0.4 // Trigger when 40% of the section is visible
  };

  const observerCallback = (entries) => {
    let visibleSectionId = null;
    // Find the section that is most visible or the first one intersecting from the top
     entries.forEach(entry => {
        if (entry.isIntersecting) {
           if (visibleSectionId === null || entry.boundingClientRect.top < document.getElementById(visibleSectionId).getBoundingClientRect().top) {
               visibleSectionId = entry.target.id;
           }
        }
     });

    // If scrolled to top or no section is sufficiently visible, default to dashboard? Or keep last active?
    // For now, only update if a section is clearly visible.
    if (visibleSectionId) {
         updateActiveLink(visibleSectionId);
    } else {
        // Check if scrolled near the top - activate Dashboard link
        if (window.scrollY < 200) {
             updateActiveLink('dashboard'); // Assuming top section doesn't have an ID or corresponds to dashboard
        }
        // Otherwise, keep the last active link highlighted when scrolling between sections
    }
  };

  const observer = new IntersectionObserver(observerCallback, observerOptions);

  sections.forEach(section => {
    observer.observe(section);
  });

  // --- Helper function to update active class ---
  function updateActiveLink(targetId) {
      sidebarLinks.forEach(link => {
          link.classList.remove('active');
          // Check if the link's href matches the target section ID
          // Handle the default Dashboard link special case (href="#")
          const linkHref = link.getAttribute('href');
          if ((linkHref === `#${targetId}`) || (targetId === 'dashboard' && linkHref === '#')) {
              link.classList.add('active');
          }
      });
  }

  // Set initial state (Dashboard link active)
  updateActiveLink('dashboard');

}

// Modify initDashboard to call loadTheme and add listener
function initDashboard() {
  console.log('Initializing dashboard...');
  if (isBrowser) {
    loadTheme(); // Load theme preferences first
    setupSidebarNavigation(); // Setup navigation interactions

    // Add theme toggle button listener
    const themeToggleButton = document.getElementById('theme-toggle-button');
    if (themeToggleButton) {
      themeToggleButton.addEventListener('click', toggleTheme);
    }

    // Initialize Bootstrap Tooltips
    console.log('Attempting to initialize tooltips...');
    // Defer initialization slightly to ensure bootstrap object is ready
    setTimeout(() => {
        try {
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
                // Ensure bootstrap object is available
                if (typeof bootstrap !== 'undefined' && typeof bootstrap.Tooltip === 'function') {
                    return new bootstrap.Tooltip(tooltipTriggerEl);
                } else {
                    console.error('Bootstrap Tooltip function not found. Check Bootstrap JS loading.');
                    return null;
                }
            });
            console.log(`Initialized ${tooltipList.filter(t => t !== null).length} tooltips successfully.`);
        } catch (e) {
            console.error('Error initializing tooltips:', e);
        }
    }, 100); // Small delay (100ms) just in case of timing issues

  }

  console.log('Loading dashboard data...');
  loadDashboardData();
  
  // Refresh data every 60 seconds
  setInterval(loadDashboardData, 60000);
  
  // Add refresh button event listener (if it exists)
  const refreshButton = document.getElementById('refresh-btn');
  if (refreshButton) {
    refreshButton.addEventListener('click', loadDashboardData);
  }
}

// Start dashboard when DOM is loaded
if (isBrowser) {
  // Make sure initDashboard is called after DOM is ready
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    // Node.js environment - export functions
    console.log('Dashboard script loaded in Node.js environment');

    // For CommonJS environments
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = {
        loadDashboardData,
        formatAddress,
        formatTimestamp,
        formatEth
      };
    }
} 