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

interface GenerateAddressParams {
  srcChain: 'bitcoin' | 'hyperliquid' | 'ethereum';
  dstChain: 'bitcoin' | 'hyperliquid' | 'ethereum';
  asset: 'btc' | 'eth';
  dstAddr: string;
}

export async function generateUnitAddress({
  srcChain,
  dstChain,
  asset,
  dstAddr
}: GenerateAddressParams): Promise<UnitAddressResponse> {
  try {
    // Validate input parameters
    if (!['bitcoin', 'hyperliquid', 'ethereum'].includes(srcChain)) {
      throw new Error('Invalid source chain');
    }
    if (!['bitcoin', 'hyperliquid', 'ethereum'].includes(dstChain)) {
      throw new Error('Invalid destination chain');
    }
    if (!['btc', 'eth'].includes(asset)) {
      throw new Error('Invalid asset');
    }
    if (!dstAddr) {
      throw new Error('Destination address is required');
    }

    // Make the API request
    const response = await axios.get<UnitAddressResponse>(
      `${UNIT_API_BASE_URL}/gen/${srcChain}/${dstChain}/${asset}/${dstAddr}`
    );

    // Verify the signatures
    const proposal = {
      destinationAddress: dstAddr,
      destinationChain: dstChain,
      asset: asset.toUpperCase(),
      address: response.data.address,
      sourceChain: srcChain,
      coinType: srcChain === 'ethereum' ? 'ethereum' : undefined
    };

    const verificationResult = await verifyDepositAddressSignatures(
      response.data.signatures,
      proposal
    );

    if (!verificationResult.success) {
      throw new Error('Signature verification failed: ' + (verificationResult.errors?.join(', ') || 'Unknown error'));
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Unit API error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

// Example usage
async function testGenerateAddress() {
  try {
    const result = await generateUnitAddress({
      srcChain: 'bitcoin',
      dstChain: 'hyperliquid',
      asset: 'btc',
      dstAddr: '0x99a5F7202c4983a6f0Ca9d8F0526Fcd9d2be9e1D'
    });

    console.log('Generated Address:', result.address);
    console.log('Signatures:', result.signatures);
    console.log('Status:', result.status);
  } catch (error) {
    console.error('Error generating address:', error);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testGenerateAddress()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
} 