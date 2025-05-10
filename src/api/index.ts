// @ts-ignore - ignore missing type declarations
import { Hono } from "hono";
// @ts-ignore - ignore missing type declarations
import { db } from "ponder:api";
// @ts-ignore - ignore missing type declarations
import schema from "ponder:schema";
// @ts-ignore - ignore missing type declarations
import { graphql } from "ponder";
import { sendSlackAlert } from "../handlers/slackHandler";

const app = new Hono();

// Register GraphQL middleware
app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// Example custom endpoint
app.get("/hello", (c) => {
  return c.text("Hello, feBTC Vault Monitor!");
});

// Dashboard API endpoints using GraphQL
app.get("/api/vaults", async (c) => {
  try {
    const query = `
      query GetVaults {
        vaults(orderBy: { lastUpdatedTimestamp: DESC }) {
          id
          totalAssets
          totalShares
          lastUpdatedBlock
          lastUpdatedTimestamp
        }
      }
    `;
    
    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(r => r.json()) as { data?: { vaults?: any[] } };
    
    return c.json(result.data?.vaults || []);
  } catch (error) {
    console.error("Error fetching vaults:", error);
    return c.json([]);
  }
});

app.get("/api/vault/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const query = `
      query GetVault($id: ID!) {
        vault(id: $id) {
          id
          totalAssets
          totalShares
          lastUpdatedBlock
          lastUpdatedTimestamp
        }
      }
    `;
    
    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query,
        variables: { id }
      })
    }).then(r => r.json()) as { data?: { vault?: any } };
    
    return c.json(result.data?.vault || {});
  } catch (error) {
    console.error("Error fetching vault:", error);
    return c.json({});
  }
});

app.get("/api/vault-stats", async (c) => {
  try {
    const query = `
      query GetVaultStatus {
        vaultStatus(id: "latest") {
          id
          totalAssets
          totalShares
          timestamp
          isPaused
        }
      }
    `;
    
    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(r => r.json()) as { data?: { vaultStatus?: any } };
    
    return c.json(result.data?.vaultStatus || {});
  } catch (error) {
    console.error("Error fetching vault status:", error);
    return c.json({});
  }
});

app.get("/api/user-positions", async (c) => {
  try {
    const query = `
      query GetUserPositions {
        vaultUsers(orderBy: { lastUpdatedBlock: DESC }) {
          id
          vaultAddress
          userAddress
          shares
          unlockTime
          lastUpdatedBlock
        }
      }
    `;
    
    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(r => r.json()) as { data?: { vaultUsers?: any[] } };
    
    return c.json(result.data?.vaultUsers || []);
  } catch (error) {
    console.error("Error fetching user positions:", error);
    return c.json([]);
  }
});

app.get("/api/deposits", async (c) => {
  try {
    const query = `
      query GetDeposits {
        deposits(
          orderBy: { timestamp: DESC }
          limit: 50
        ) {
          id
          txHash
          timestamp
          receiver
          depositAsset
          depositAmount
          shareAmount
        }
      }
    `;
    
    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(r => r.json()) as { data?: { deposits?: any[] } };
    
    return c.json(result.data?.deposits || []);
  } catch (error) {
    console.error("Error fetching deposits:", error);
    return c.json([]);
  }
});

app.get("/api/strategy-executions", async (c) => {
  try {
    const query = `
      query GetStrategyExecutions {
        strategyExecutions(
          orderBy: { timestamp: DESC }
          limit: 20
        ) {
          id
          txHash
          timestamp
          strategyName
          executor
          successful
        }
      }
    `;
    
    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(r => r.json()) as { data?: { strategyExecutions?: any[] } };
    
    return c.json(result.data?.strategyExecutions || []);
  } catch (error) {
    console.error("Error fetching strategy executions:", error);
    return c.json([]);
  }
});

app.get("/api/risk-metrics", async (c) => {
  try {
    const query = `
      query GetRiskMetrics {
        riskMetrics(
          orderBy: { timestamp: DESC }
          limit: 30
        ) {
          id
          timestamp
          collateralRatio
          liquidationPrice
          currentPrice
          liquidationRisk
          profitLoss
          apy
        }
      }
    `;
    
    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(r => r.json()) as { data?: { riskMetrics?: any[] } };
    
    return c.json(result.data?.riskMetrics || []);
  } catch (error) {
    console.error("Error fetching risk metrics:", error);
    return c.json([]);
  }
});

app.get("/api/asset-prices", async (c) => {
  try {
    const query = `
      query GetAssetPrices {
        assetPrices(
          orderBy: { timestamp: DESC }
          limit: 10
        ) {
          id
          asset
          price
          timestamp
          source
        }
      }
    `;
    
    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(r => r.json()) as { data?: { assetPrices?: any[] } };
    
    return c.json(result.data?.assetPrices || []);
  } catch (error) {
    console.error("Error fetching asset prices:", error);
    return c.json([]);
  }
});

app.get("/api/historical-l1-data", async (c) => {
  try {
    const query = `
      query GetHistoricalL1Data {
        vaultEquitys(
          orderBy: { lastTimestamp: DESC }
          limit: 10
        ) {
          id
          lastTimestamp
          total
          hold
        }
        vaultSpotBalances(
          orderBy: { lastTimestamp: DESC }
          limit: 10
        ) {
          id
          lastTimestamp
          total
        }
      }
    `;

    const result = await fetch(`http://localhost:3002/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    }).then(r => r.json()) as { data?: { vaultEquitys?: any[] } };

    return c.json(result.data?.vaultEquitys || []);
  } catch (error) {
    console.error("Error fetching historical L1 data:", error);
    return c.json([]);
  }
});


app.post("/api/test-alerts", async (c) => {
  const alertMessage = 'This is a test alert from the Slack bot!';

  
  try {
    await sendSlackAlert(alertMessage);
    return c.json({ message: "Test alert sent!" });
  } catch (error) {
    console.error("Error sending Slack alert:", error);
    return c.json({ error: "Failed to send test alert" }, 500);
  }
});

app.get("/api/health", (c) => {
  return c.json({ status: "OKiee" });
});


export default app; 