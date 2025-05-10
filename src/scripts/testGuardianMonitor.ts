import axios from 'axios';
import { verifyDepositAddressSignatures, MAINNET_GUARDIAN_NODES } from './guardianMonitor';

const UNIT_API_BASE_URL = 'https://api.hyperunit.xyz';

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
    dstAddr: '0x0e3Ad791F4991931A6E683634b4beefB31854F61'
  };

  try {
    // Step 1: Call Unit API to generate address
    console.log('Calling Unit API to generate address...');
    const response = await axios.get<UnitAddressResponse>(
      `${UNIT_API_BASE_URL}/gen/${params.srcChain}/${params.dstChain}/${params.asset}/${params.dstAddr}`
    );

    console.log('Status:', response.data.status);

    // Step 2: Verify the signatures
    console.log('\nVerifying signatures...');
    const proposal = {
      destinationAddress: params.dstAddr,
      destinationChain: params.dstChain,
      asset: params.asset,
      address: response.data.address,
      sourceChain: params.srcChain,
    };

    console.log('Proposal being verified:', proposal);
    
    // Log the guardian nodes being used
    console.log('\nGuardian Nodes:');
    console.log('Mainnet Nodes:', MAINNET_GUARDIAN_NODES.map(n => n.nodeId));
    
    // Log the signature nodes
    console.log('\nSignature Nodes:', Object.keys(response.data.signatures));
    
    // Test mainnet verification
    console.log('\nTesting Mainnet Verification:');
    const mainnetResult = await verifyDepositAddressSignatures(
      response.data.signatures,
      proposal,
      MAINNET_GUARDIAN_NODES // Use mainnet nodes
    );
    
    console.log('\nMainnet Verification Result:');
    console.log('Success:', mainnetResult.success);
    console.log('Verified Count:', mainnetResult.verifiedCount);
    console.log('Verification Details:', mainnetResult.verificationDetails);
    if (mainnetResult.errors) {
      console.log('Errors:', mainnetResult.errors);
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Unit API error:', error.response?.data || error.message);
    } else {
      console.error('Error:', error);
    }
  }
}

testGuardianMonitor(); 