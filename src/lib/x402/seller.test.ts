import { describe, it, expect, vi } from 'vitest';
import { handlePaidRequest, HandlePaidRequestOptions } from './seller';
import * as verifier from './verifier';
import { PublicClient, Address } from 'viem';

vi.mock('./verifier', () => ({
  verifyTransaction: vi.fn(),
}));

describe('handlePaidRequest', () => {
  const mockClient = {} as PublicClient;
  const mockOptions: Omit<HandlePaidRequestOptions, 'request'> = {
    client: mockClient,
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    expectedAmount: 1000000n, // 1 USDC (assuming 6 decimals, but type is bigint)
    expectedRecipient: '0xb438d36b425b504724a1c72aa0941c80cb940995' as Address,
    price: 1,
    nonce: 'test-nonce-123',
    serviceTokenValue: 'mock-service-token',
  };

  it('should return a 402 challenge if X-Payment-Tx header is missing', async () => {
    const request = new Request('https://example.com/api', {
      headers: new Headers(),
    });

    const response = await handlePaidRequest({ ...mockOptions, request });

    expect(response.status).toBe(402);
    expect(response.headers.get('X-Payment-Required')).toBe('true');
    expect(response.headers.get('X-Payment-Nonce')).toBe('test-nonce-123');
  });

  it('should return a 400 response if X-Payment-Tx header format is invalid', async () => {
    const request = new Request('https://example.com/api', {
      headers: new Headers({
        'X-Payment-Tx': 'invalid-hash-format', // Missing 0x
      }),
    });

    const response = await handlePaidRequest({ ...mockOptions, request });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid transaction hash format');
  });

  it('should return a 400 response if payment verification fails', async () => {
    vi.mocked(verifier.verifyTransaction).mockResolvedValueOnce({
      success: false,
      error: 'Transaction reverted',
    });

    const request = new Request('https://example.com/api', {
      headers: new Headers({
        'X-Payment-Tx': '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }),
    });

    const response = await handlePaidRequest({ ...mockOptions, request });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Transaction reverted');
  });

  it('should return a 200 response with service token if payment verification succeeds', async () => {
    vi.mocked(verifier.verifyTransaction).mockResolvedValueOnce({
      success: true,
    });

    const request = new Request('https://example.com/api', {
      headers: new Headers({
        'X-Payment-Tx': '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      }),
    });

    const response = await handlePaidRequest({ ...mockOptions, request });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.serviceToken).toBe('mock-service-token');
  });
});
