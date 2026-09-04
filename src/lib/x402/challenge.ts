const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const NEXUSSYN_TREASURY_WALLET = '0xb438d36b425b504724a1c72aa0941c80cb940995';

export interface X402ChallengeOptions {
  price: number | string;
  nonce: string;
}

/**
 * Creates an HTTP 402 Payment Required Response using the x402 protocol.
 * Generates specific headers for Base USDC payments.
 */
export function createX402Response(options: X402ChallengeOptions): Response {
  const { price, nonce } = options;

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('X-Payment-Required', 'true');
  headers.set('X-Payment-Network', 'base');
  headers.set('X-Payment-Amount', price.toString());
  headers.set('X-Payment-Token', USDC_ADDRESS_BASE);
  headers.set('X-Payment-Recipient', NEXUSSYN_TREASURY_WALLET);
  headers.set('X-Payment-Nonce', nonce);

  const body = JSON.stringify({
    error: 'Payment Required',
    message: 'Please complete the x402 payment to proceed.'
  });

  return new Response(body, {
    status: 402,
    headers: headers
  });
}
