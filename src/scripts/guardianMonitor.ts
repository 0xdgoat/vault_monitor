// @ts-nocheck

// Constants
export const MAINNET_GUARDIAN_NODES = [
  {
    nodeId: 'unit-node',
    publicKey: '04dc6f89f921dc816aa69b687be1fcc3cc1d48912629abc2c9964e807422e1047e0435cb5ba0fa53cb9a57a9c610b4e872a0a2caedda78c4f85ebafcca93524061',
  },
  {
    nodeId: 'hl-node',
    publicKey: '048633ea6ab7e40cdacf37d1340057e84bb9810de0687af78d031e9b07b65ad4ab379180ab55075f5c2ebb96dab30d2c2fab49d5635845327b6a3c27d20ba4755b',
  },
  {
    nodeId: 'field-node',
    publicKey: '04ae2ab20787f816ea5d13f36c4c4f7e196e29e867086f3ce818abb73077a237f841b33ada5be71b83f4af29f333dedc5411ca4016bd52ab657db2896ef374ce99',
  },
];

const GUARDIAN_SIGNATURE_THRESHOLD = 3;

interface Proposal {
  destinationAddress: string;
  destinationChain: string;
  asset: string;
  address: string;
  sourceChain: string;
  coinType?: string;
  keyType?: string;
}

interface VerificationResult {
  success: boolean;
  verifiedCount: number;
  errors?: string[];
  verificationDetails?: { [nodeId: string]: boolean };
}

interface ProcessedNode {
  nodeId: string;
  publicKey: CryptoKey;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(cleanHex, 'hex'));
}

// Updated payload construction functions
function legacyProposalToPayload(nodeId: string, proposal: Proposal): Uint8Array {
  const payloadString = `${nodeId}:${[
    proposal.destinationAddress,
    proposal.destinationChain,
    proposal.asset,
    proposal.address,
    proposal.sourceChain,
    'deposit'
  ].join('-')}`;
  console.log(`Legacy payload for ${nodeId}:`, payloadString);
  return new TextEncoder().encode(payloadString);
}

function newProposalToPayload(nodeId: string, proposal: Proposal): Uint8Array {
  const payloadString = `${nodeId}:${[
    'user',
    proposal.coinType,
    proposal.destinationChain,
    proposal.destinationAddress,
    proposal.address
  ].join('-')}`;
  console.log(`New payload for ${nodeId}:`, payloadString);
  return new TextEncoder().encode(payloadString);
}

function proposalToPayload(nodeId: string, proposal: Proposal): Uint8Array {
  // For Ethereum addresses, use new format
  if (proposal.coinType === 'ethereum') {
    return newProposalToPayload(nodeId, proposal);
  }
  
  // Default to legacy format for backward compatibility
  return legacyProposalToPayload(nodeId, proposal);
}

async function processGuardianNodes(nodes: { nodeId: string; publicKey: string }[]): Promise<ProcessedNode[]> {
  const processed: ProcessedNode[] = [];
  for (const node of nodes) {
    try {
      const publicKeyBytes = hexToBytes(node.publicKey);
      if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
        throw new Error(`Invalid public key format for node ${node.nodeId}`);
      }
      const publicKey = await crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );
      processed.push({ nodeId: node.nodeId, publicKey });
    } catch (error) {
      console.error(`Failed to process node ${node.nodeId}:`, error);
      throw new Error(`Node processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return processed;
}

// Updated signature verification with proper base64url handling
async function verifySignature(publicKey: CryptoKey, message: Uint8Array, signature: string): Promise<boolean> {
  try {
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    if (sigBytes.length !== 64) {
      console.log('Invalid signature length:', sigBytes.length);
      return false;
    }
  
    return await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      sigBytes,
      message
    );
    
  } catch (error) {
    console.log('Signature verification failed:', error);
    return false;
  }
}

export async function verifyDepositAddressSignatures(
  signatures: { [nodeId: string]: string  },
  proposal: Proposal,
  guardianNodes: { nodeId: string; publicKey: string }[] = MAINNET_GUARDIAN_NODES
): Promise<VerificationResult> {
  try {
    const processedNodes = await processGuardianNodes(guardianNodes);
    let verifiedCount = 0;
    const errors: string[] = [];
    const verificationDetails: { [nodeId: string]: boolean } = {};

    await Promise.all(
      processedNodes.map(async (node) => {
        try {
          if (!signatures[node.nodeId]) {
            verificationDetails[node.nodeId] = false;
            return;
          }        
          let isVerified = false;
          
          if (proposal.coinType !== 'ethereum') {
            const legacyPayload = legacyProposalToPayload(node.nodeId, proposal);
            isVerified = await verifySignature(node.publicKey, legacyPayload, signatures[node.nodeId]);
            console.log('isVerified for legacy payload', isVerified);

            if (!isVerified) {
              const newPayload = newProposalToPayload(node.nodeId, proposal);
              isVerified = await verifySignature(node.publicKey, newPayload, signatures[node.nodeId]);
              console.log('isVerified for new payload', isVerified);
            }
          } else {
            const payload = newProposalToPayload(node.nodeId, proposal);
            isVerified = await verifySignature(node.publicKey, payload, signatures[node.nodeId]);
          }
          
          verificationDetails[node.nodeId] = isVerified;
          if (isVerified) verifiedCount++;
        } catch (error) {
          errors.push(`Verification failed for node ${node.nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          verificationDetails[node.nodeId] = false;
        }
      })
    );

    return {
      success: verifiedCount >= GUARDIAN_SIGNATURE_THRESHOLD,
      verifiedCount,
      errors: errors.length > 0 ? errors : undefined,
      verificationDetails
    };
  } catch (error) {
    return {
      success: false,
      verifiedCount: 0,
      errors: [`Global verification error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      verificationDetails: {}
    };
  }
}