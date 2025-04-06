import { createClient } from '@supabase/supabase-js';
import { sendSlackAlert } from '../handlers/slackHandler';
import 'dotenv/config';


// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// Risk thresholds
const LIQUIDATION_THRESHOLD = 1.05; // Health factor below which liquidation is imminent
const WARNING_THRESHOLD = 1.2; // Health factor below which we should warn users

// Asset configuration (matches the one in fetchPriceData.ts)
const ASSETS = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'USDC', name: 'USD Coin' },
];

async function calculateRiskMetrics() {
  try {
    console.log('Calculating risk metrics...');
    const timestamp = new Date().toISOString();
    
    // Get latest price data
    const { data: priceData, error: priceError } = await supabase
      .from('prices_and_liquidity')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(ASSETS.length); // Get latest entry for each asset
    
    if (priceError) {
      throw new Error(`Error fetching price data: ${priceError.message}`);
    }
    
    // Get all active loans
    const { data: loanData, error: loanError } = await supabase
      .from('raw_events')
      .select('*')
      .eq('event_type', 'HealthFactorUpdated')
      .order('timestamp', { ascending: false });
      
    if (loanError) {
      throw new Error(`Error fetching loan data: ${loanError.message}`);
    }
    
    // Group loans by user address to get the latest for each user
    const latestLoans = new Map();
    loanData.forEach(loan => {
      if (!latestLoans.has(loan.user_address) || 
          new Date(loan.timestamp) > new Date(latestLoans.get(loan.user_address).timestamp)) {
        latestLoans.set(loan.user_address, loan);
      }
    });
    
    // Calculate risk for each loan and update positions_summary
    for (const [userAddress, loan] of latestLoans.entries()) {
      // Get the health factor
      const healthFactor = parseFloat(loan.health_factor) / 1e18; // Assuming 18 decimals
      
      // Determine risk level
      let riskLevel = 'low';
      if (healthFactor < LIQUIDATION_THRESHOLD) {
        riskLevel = 'critical';
      } else if (healthFactor < WARNING_THRESHOLD) {
        riskLevel = 'high';
      } else if (healthFactor < 1.5) {
        riskLevel = 'medium';
      }
      
      // Calculate price impact on health factor
      // Simplified example - in a real system, you'd use the specific collateral asset
      const eth = priceData.find(p => p.asset_symbol === 'ETH');
      if (!eth) continue;
      
      const priceImpact10Pct = healthFactor * 0.9; // Simulating 10% price drop
      const priceImpact20Pct = healthFactor * 0.8; // Simulating 20% price drop
      
      // Update positions summary
      await supabase.from('positions_summary').upsert({
        user_address: userAddress,
        health_factor: healthFactor,
        risk_level: riskLevel,
        price_impact_10pct: priceImpact10Pct,
        price_impact_20pct: priceImpact20Pct,
        updated_at: timestamp,
      }, { onConflict: 'user_address' });
      
      // Create alerts for high-risk positions
      if (riskLevel === 'critical' || riskLevel === 'high') {

        await supabase.from('alerts').insert({
          type: 'liquidation_risk',
          user_address: userAddress,
          message: `Liquidation risk: Health factor for ${userAddress} is ${healthFactor.toFixed(2)}`,
          severity: riskLevel === 'critical' ? 'critical' : 'high',
          timestamp,
          acknowledged: false,
        });

        try {
            await sendSlackAlert(`${riskLevel} Liquidation risk: Health factor for ${userAddress} is ${healthFactor.toFixed(2)}`);
            
          } catch (error) {
            console.error("Error sending Slack alert:", error);
            
          }
      }
    }
    
    // Calculate protocol-wide health metrics
    const healthFactors = Array.from(latestLoans.values()).map(loan => 
      parseFloat(loan.health_factor) / 1e18
    );
    
    if (healthFactors.length > 0) {
      const avgHealthFactor = healthFactors.reduce((a, b) => a + b, 0) / healthFactors.length;
      const minHealthFactor = Math.min(...healthFactors);
      const criticalPositions = healthFactors.filter(hf => hf < LIQUIDATION_THRESHOLD).length;
      const highRiskPositions = healthFactors.filter(hf => hf >= LIQUIDATION_THRESHOLD && hf < WARNING_THRESHOLD).length;
      
      // Update protocol health metrics
      await supabase.from('protocol_health').upsert({
        id: 'current',
        avg_health_factor: avgHealthFactor,
        min_health_factor: minHealthFactor,
        critical_positions_count: criticalPositions,
        high_risk_positions_count: highRiskPositions,
        total_positions_count: healthFactors.length,
        updated_at: timestamp,
      }, { onConflict: 'id' });
      
      console.log(`Protocol health metrics: Avg HF: ${avgHealthFactor.toFixed(2)}, Min HF: ${minHealthFactor.toFixed(2)}`);
      console.log(`Risk distribution: Critical: ${criticalPositions}, High: ${highRiskPositions}, Total: ${healthFactors.length}`);
    } else {
      console.log('No active loans found for risk calculation');
    }
    
    // Also calculate and store risk metrics in Ponder's riskMetric table
    const { data: ethPriceData } = await supabase
      .from('asset_price')
      .select('*')
      .eq('asset', 'ETH')
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (ethPriceData && ethPriceData.length > 0) {
      const currentPrice = ethPriceData[0].price;
      const liquidationPrice = currentPrice * 0.7; // Example: liquidation at 70% of current price
      
      // Insert risk metric
      await supabase.from('risk_metric').insert({
        id: `risk-${Math.floor(Date.now() / 1000)}`,
        timestamp: Math.floor(Date.now() / 1000),
        collateralRatio: 1.5, // Example value
        liquidationPrice,
        currentPrice,
        liquidationRisk: 30, // Example: 0-100 score
        profitLoss: 0.05, // Example: 5% profit
        apy: 0.08, // Example: 8% APY
        shareLockPeriod: 7 * 24 * 60 * 60, // Example: 7 days in seconds
      });
    }
    
    console.log('Risk metrics calculation completed.');
  } catch (error) {
    console.error('Error calculating risk metrics:', error);
  }
}

// Run the function directly if this file is executed
if (require.main === module) {
  calculateRiskMetrics();
}

// Export for scheduled execution
export default calculateRiskMetrics; 