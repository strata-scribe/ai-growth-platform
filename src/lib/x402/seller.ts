import { PublicClient, Address, Hash } from 'viem';
import { createX402Response } from './challenge';
import { verifyTransaction } from './verifier';

export interface HandlePaidRequestOptions {
  request: Request;
  client: PublicClient;
  tokenAddress: Address;
  expectedAmount: bigint;
  expectedRecipient: Address;
  price: number | string;
  nonce: string;
  serviceTokenValue: unknown;
  maxAgeSeconds?: number;
}

/**
 * Handles incoming requests for paid endpoints.
 * Intercepts requests without proof of payment and issues HTTP 402 challenge headers.
 * Dispenses service tokens upon successful verification of payment proof.
 */
export async function handlePaidRequest(options: HandlePaidRequestOptions): Promise<Response> {
  const {
    request,
    client,
    tokenAddress,
    expectedAmount,
    expectedRecipient,
    price,
    nonce,
    serviceTokenValue,
    maxAgeSeconds
  } = options;

  const txHashHeader = request.headers.get('X-Payment-Tx');

  if (!txHashHeader) {
    return createX402Response({ price, nonce });
  }

  // Ensure txHash starts with 0x
  if (!txHashHeader.startsWith('0x')) {
    return new Response(JSON.stringify({ error: 'Invalid transaction hash format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const txHash = txHashHeader as Hash;

  const verificationResult = await verifyTransaction({
    client,
    txHash,
    tokenAddress,
    expectedAmount,
    expectedRecipient,
    maxAgeSeconds
  });

  if (!verificationResult.success) {
    return new Response(JSON.stringify({ error: verificationResult.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ serviceToken: serviceTokenValue }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
