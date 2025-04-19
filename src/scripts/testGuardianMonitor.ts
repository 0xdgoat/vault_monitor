import axios from 'axios';
import { verifyDepositAddressSignatures } from './guardianMonitor';

const UNIT_API_BASE_URL = 'https://api.hyperunit-testnet.xyz';

interface UnitAddressResponse {
  address: string;
  signatures: {
    [nodeId: string]: string;
  };
  status: string;
}

async function testGuardianMonitor() {
  // Example parameters for generating a Bitcoin deposit address
  const params = {
    srcChain: 'bitcoin',
    dstChain: 'hyperliquid',
    asset: 'btc',
    dstAddr: '0x99a5F7202c4983a6f0Ca9d8F0526Fcd9d2be9e1D'
  };

  try {
    // Step 1: Call Unit API to generate address and get signatures
    console.log('Calling Unit API to generate address...');
    const response = await axios.get<UnitAddressResponse>(
      `${UNIT_API_BASE_URL}/gen/${params.srcChain}/${params.dstChain}/${params.asset}/${params.dstAddr}`
    );

    console.log('\nUnit API Response:');
    console.log('Generated Address:', response.data.address);
    console.log('Status:', response.data.status);
    console.log('Signatures:', response.data.signatures);

    // Step 2: Verify the signatures
    console.log('\nVerifying signatures...');
    const proposal = {
      destinationAddress: params.dstAddr,
      destinationChain: params.dstChain,
      asset: params.asset.toUpperCase(),
      address: response.data.address,
      sourceChain: params.srcChain
    };

    console.log('Proposal being verified:', proposal);
    
    const verificationResult = await verifyDepositAddressSignatures(
      response.data.signatures,
      proposal
    );
    
    console.log('\nVerification Result:');
    console.log('Success:', verificationResult.success);
    console.log('Verified Count:', verificationResult.verifiedCount);
    console.log('Verification Details:', verificationResult.verificationDetails);
    if (verificationResult.errors) {
      console.log('Errors:', verificationResult.errors);
    }

    // Step 3: Check minimum amounts
    console.log('\nMinimum Amount Requirements:');
    if (params.asset === 'btc') {
      console.log('Minimum BTC amount: 0.002 BTC (20,000 sats)');
    } else if (params.asset === 'eth') {
      console.log('Minimum ETH amount: 0.05 ETH (5e16 wei)');
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Unit API error:', error.response?.data || error.message);
    } else {
      console.error('Error:', error);
    }
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testGuardianMonitor()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
} 