import { describe, it, expect, vi } from 'vitest';
import { calculateAffiliateSplit, verifyAffiliateTransaction } from './affiliate';
import { PublicClient } from 'viem';

describe('calculateAffiliateSplit', () => {
  it('calculates the correct split with 10% affiliate fee', () => {
    // 100 USDC (6 decimals)
    const totalAmount = 100_000000n;
    // 10% = 1000 bps
    const affiliateBps = 1000;

    const { providerAmount, affiliateAmount } = calculateAffiliateSplit(totalAmount, affiliateBps);

    expect(affiliateAmount).toBe(10_000000n);
    expect(providerAmount).toBe(90_000000n);
  });

  it('calculates the correct split with 0% affiliate fee', () => {
    const totalAmount = 100_000000n;
    const affiliateBps = 0;

    const { providerAmount, affiliateAmount } = calculateAffiliateSplit(totalAmount, affiliateBps);

    expect(affiliateAmount).toBe(0n);
    expect(providerAmount).toBe(100_000000n);
  });

  it('calculates the correct split with 100% affiliate fee', () => {
    const totalAmount = 100_000000n;
    const affiliateBps = 10000;

    const { providerAmount, affiliateAmount } = calculateAffiliateSplit(totalAmount, affiliateBps);

    expect(affiliateAmount).toBe(100_000000n);
    expect(providerAmount).toBe(0n);
  });

  it('handles fractional bps calculation correctly by rounding down bps internally if not whole', () => {
    const totalAmount = 100_000000n;
    const affiliateBps = 1000.5; // floor(1000.5) = 1000 = 10%

    const { providerAmount, affiliateAmount } = calculateAffiliateSplit(totalAmount, affiliateBps);

    expect(affiliateAmount).toBe(10_000000n);
    expect(providerAmount).toBe(90_000000n);
  });

  it('throws if affiliate bps < 0', () => {
    expect(() => calculateAffiliateSplit(100000000n, -1)).toThrow('Affiliate bps must be between 0 and 10000');
  });

  it('throws if affiliate bps > 10000', () => {
    expect(() => calculateAffiliateSplit(100000000n, 10001)).toThrow('Affiliate bps must be between 0 and 10000');
  });
});

describe('verifyAffiliateTransaction', () => {
  const mockTokenAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const mockProviderAddress = '0x1111111111111111111111111111111111111111';
  const mockAffiliateAddress = '0x2222222222222222222222222222222222222222';

  // Keccak256 of "Transfer(address,address,uint256)"
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  const mockProviderAmount = 90_000000n;
  const mockAffiliateAmount = 10_000000n;

  const createMockLog = (to: string, amount: bigint) => ({
    address: mockTokenAddress,
    topics: [
      transferTopic,
      '0x0000000000000000000000000000000000000000000000000000000000000000', // from (not indexed in mock data, but we need 3 topics for viem usually. wait, from is indexed. so we need to pad it)
      '0x000000000000000000000000' + to.slice(2).toLowerCase() // to (indexed)
    ],
    // data is value (not indexed)
    data: '0x' + amount.toString(16).padStart(64, '0')
  });

  it('returns success: true when both transfers are found', async () => {
    const mockClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockHash: '0xabc',
        logs: [
          createMockLog(mockProviderAddress, mockProviderAmount),
          createMockLog(mockAffiliateAddress, mockAffiliateAmount)
        ]
      })
    } as unknown as PublicClient;

    const result = await verifyAffiliateTransaction({
      client: mockClient,
      txHash: '0x123',
      tokenAddress: mockTokenAddress,
      providerAddress: mockProviderAddress,
      providerAmount: mockProviderAmount,
      affiliateAddress: mockAffiliateAddress,
      affiliateAmount: mockAffiliateAmount
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns success: false when provider transfer is missing', async () => {
    const mockClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockHash: '0xabc',
        logs: [
          createMockLog(mockAffiliateAddress, mockAffiliateAmount)
        ]
      })
    } as unknown as PublicClient;

    const result = await verifyAffiliateTransaction({
      client: mockClient,
      txHash: '0x123',
      tokenAddress: mockTokenAddress,
      providerAddress: mockProviderAddress,
      providerAmount: mockProviderAmount,
      affiliateAddress: mockAffiliateAddress,
      affiliateAmount: mockAffiliateAmount
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Provider transfer not found in transaction logs');
  });

  it('returns success: false when affiliate transfer is missing', async () => {
    const mockClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockHash: '0xabc',
        logs: [
          createMockLog(mockProviderAddress, mockProviderAmount)
        ]
      })
    } as unknown as PublicClient;

    const result = await verifyAffiliateTransaction({
      client: mockClient,
      txHash: '0x123',
      tokenAddress: mockTokenAddress,
      providerAddress: mockProviderAddress,
      providerAmount: mockProviderAmount,
      affiliateAddress: mockAffiliateAddress,
      affiliateAmount: mockAffiliateAmount
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Affiliate transfer not found in transaction logs');
  });

  it('returns success: false when transaction reverted', async () => {
    const mockClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'reverted'
      })
    } as unknown as PublicClient;

    const result = await verifyAffiliateTransaction({
      client: mockClient,
      txHash: '0x123',
      tokenAddress: mockTokenAddress,
      providerAddress: mockProviderAddress,
      providerAmount: mockProviderAmount,
      affiliateAddress: mockAffiliateAddress,
      affiliateAmount: mockAffiliateAmount
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction reverted');
  });

  it('returns success: true when affiliate amount is 0 and only provider transfer exists', async () => {
    const mockClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockHash: '0xabc',
        logs: [
          createMockLog(mockProviderAddress, 100_000000n)
        ]
      })
    } as unknown as PublicClient;

    const result = await verifyAffiliateTransaction({
      client: mockClient,
      txHash: '0x123',
      tokenAddress: mockTokenAddress,
      providerAddress: mockProviderAddress,
      providerAmount: 100_000000n,
      affiliateAddress: mockAffiliateAddress,
      affiliateAmount: 0n
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('prevents double-counting a single log for both provider and affiliate', async () => {
    // Both require 50_000000n to the same address, but there is only ONE log
    const mockSameAddress = '0x3333333333333333333333333333333333333333';
    const mockClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockHash: '0xabc',
        logs: [
          createMockLog(mockSameAddress, 50_000000n) // only 1 transfer!
        ]
      })
    } as unknown as PublicClient;

    const result = await verifyAffiliateTransaction({
      client: mockClient,
      txHash: '0x123',
      tokenAddress: mockTokenAddress,
      providerAddress: mockSameAddress,
      providerAmount: 50_000000n,
      affiliateAddress: mockSameAddress,
      affiliateAmount: 50_000000n
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Affiliate transfer not found in transaction logs');
  });

  it('allows same address/amount if two separate logs exist', async () => {
    const mockSameAddress = '0x3333333333333333333333333333333333333333';
    const mockClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockHash: '0xabc',
        logs: [
          createMockLog(mockSameAddress, 50_000000n),
          createMockLog(mockSameAddress, 50_000000n)
        ]
      })
    } as unknown as PublicClient;

    const result = await verifyAffiliateTransaction({
      client: mockClient,
      txHash: '0x123',
      tokenAddress: mockTokenAddress,
      providerAddress: mockSameAddress,
      providerAmount: 50_000000n,
      affiliateAddress: mockSameAddress,
      affiliateAmount: 50_000000n
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns success: false when transaction is too old', async () => {
    const mockClient = {
      getTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        blockHash: '0xabc',
        logs: [
          createMockLog(mockProviderAddress, mockProviderAmount),
          createMockLog(mockAffiliateAddress, mockAffiliateAmount)
        ]
      }),
      getBlock: vi.fn().mockResolvedValue({
        timestamp: BigInt(Math.floor(Date.now() / 1000)) - 100n // 100 seconds old
      })
    } as unknown as PublicClient;

    const result = await verifyAffiliateTransaction({
      client: mockClient,
      txHash: '0x123',
      tokenAddress: mockTokenAddress,
      providerAddress: mockProviderAddress,
      providerAmount: mockProviderAmount,
      affiliateAddress: mockAffiliateAddress,
      affiliateAmount: mockAffiliateAmount,
      maxAgeSeconds: 60 // Max 60 seconds
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Transaction is too old');
  });
});