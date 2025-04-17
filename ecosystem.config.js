export default {
  apps: [{
    name: 'btc-price-monitor',
    script: 'src/scripts/btcPriceMonitor.ts',
    interpreter: 'node',
    interpreter_args: '-r ts-node/register',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production'
    }
  }]
}; 