import { describe, it, expect } from 'vitest';
import { createX402Response } from './challenge';

describe('createX402Response', () => {
  it('should return a 402 response with the correct headers and body', async () => {
    const options = {
      price: 0.005,
      nonce: 'nonce-12345'
    };

    const response = createX402Response(options);

    // Assert status code
    expect(response.status).toBe(402);

    // Assert headers
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('X-Payment-Required')).toBe('true');
    expect(response.headers.get('X-Payment-Network')).toBe('base');
    expect(response.headers.get('X-Payment-Amount')).toBe('0.005');
    expect(response.headers.get('X-Payment-Token')).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(response.headers.get('X-Payment-Recipient')).toBe('0xb438d36b425b504724a1c72aa0941c80cb940995');
    expect(response.headers.get('X-Payment-Nonce')).toBe('nonce-12345');

    // Assert body
    const body = await response.json();
    expect(body).toEqual({
      error: 'Payment Required',
      message: 'Please complete the x402 payment to proceed.'
    });
  });

  it('should handle string prices correctly', () => {
    const options = {
      price: '0.010',
      nonce: 'nonce-67890'
    };

    const response = createX402Response(options);

    expect(response.status).toBe(402);
    expect(response.headers.get('X-Payment-Amount')).toBe('0.010');
    expect(response.headers.get('X-Payment-Nonce')).toBe('nonce-67890');
  });
});
