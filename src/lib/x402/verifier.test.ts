import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTransaction } from './verifier';
import { PublicClient, encodeEventTopics, encodeAbiParameters, parseAbiItem } from 'viem';

describe('verifyTransaction', () => {
  const mockClient = {
    getTransactionReceipt: vi.fn(),
    getBlock: vi.fn(),
  } as unknown as PublicClient;

  const transferAbiItem = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

  const txHash = '0x1234567890123456789012345678901234567890123456789012345678901234';
  const tokenAddress = '0x0000000000000000000000000000000000000001';
  const fromAddress = '0x0000000000000000000000000000000000000002';
  const expectedRecipient = '0x0000000000000000000000000000000000000003';
  const expectedAmount = 1000n;

  const validTopics = encodeEventTopics({
    abi: [transferAbiItem],
    eventName: 'Transfer',
    args: {
      from: fromAddress,
      to: expectedRecipient,
    },
  });

  const validData = encodeAbiParameters(
    [{ type: 'uint256', name: 'value' }],
    [expectedAmount]
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000000 * 1000)); // Timestamp: 1000000
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return success for a valid transaction', async () => {
    vi.mocked(mockClient.getTransactionReceipt).mockResolvedValue({
      status: 'success',
      blockHash: '0xabc',
      logs: [
        {
          address: tokenAddress,
          topics: validTopics,
          data: validData,
        },
      ],
    } as never);

    vi.mocked(mockClient.getBlock).mockResolvedValue({
      timestamp: 999990n, // 10 seconds ago
    } as never);

    const result = await verifyTransaction({
      client: mockClient,
      txHash: txHash as `0x${string}`,
      tokenAddress: tokenAddress as `0x${string}`,
      expectedAmount,
      expectedRecipient: expectedRecipient as `0x${string}`,
      maxAgeSeconds: 60,
    });

    expect(result).toEqual({ success: true });
  });

  it('should return failure if transaction reverted', async () => {
    vi.mocked(mockClient.getTransactionReceipt).mockResolvedValue({
      status: 'reverted',
      blockHash: '0xabc',
      logs: [],
    } as never);

    const result = await verifyTransaction({
      client: mockClient,
      txHash: txHash as `0x${string}`,
      tokenAddress: tokenAddress as `0x${string}`,
      expectedAmount,
      expectedRecipient: expectedRecipient as `0x${string}`,
    });

    expect(result).toEqual({ success: false, error: 'Transaction reverted' });
  });

  it('should return failure if transaction is too old', async () => {
    vi.mocked(mockClient.getTransactionReceipt).mockResolvedValue({
      status: 'success',
      blockHash: '0xabc',
      logs: [
        {
          address: tokenAddress,
          topics: validTopics,
          data: validData,
        },
      ],
    } as never);

    vi.mocked(mockClient.getBlock).mockResolvedValue({
      timestamp: 999900n, // 100 seconds ago
    } as never);

    const result = await verifyTransaction({
      client: mockClient,
      txHash: txHash as `0x${string}`,
      tokenAddress: tokenAddress as `0x${string}`,
      expectedAmount,
      expectedRecipient: expectedRecipient as `0x${string}`,
      maxAgeSeconds: 60, // 60s max age
    });

    expect(result).toEqual({ success: false, error: 'Transaction is too old (100s > 60s)' });
  });

  it('should return failure if transfer log has wrong token address', async () => {
    vi.mocked(mockClient.getTransactionReceipt).mockResolvedValue({
      status: 'success',
      blockHash: '0xabc',
      logs: [
        {
          address: '0x0000000000000000000000000000000000000004', // Wrong token
          topics: validTopics,
          data: validData,
        },
      ],
    } as never);

    const result = await verifyTransaction({
      client: mockClient,
      txHash: txHash as `0x${string}`,
      tokenAddress: tokenAddress as `0x${string}`,
      expectedAmount,
      expectedRecipient: expectedRecipient as `0x${string}`,
    });

    expect(result).toEqual({ success: false, error: 'Expected transfer not found in transaction logs' });
  });

  it('should return failure if transfer log has wrong recipient', async () => {
    const wrongTopics = encodeEventTopics({
      abi: [transferAbiItem],
      eventName: 'Transfer',
      args: {
        from: fromAddress,
        to: '0x0000000000000000000000000000000000000005', // Wrong recipient
      },
    });

    vi.mocked(mockClient.getTransactionReceipt).mockResolvedValue({
      status: 'success',
      blockHash: '0xabc',
      logs: [
        {
          address: tokenAddress,
          topics: wrongTopics,
          data: validData,
        },
      ],
    } as never);

    const result = await verifyTransaction({
      client: mockClient,
      txHash: txHash as `0x${string}`,
      tokenAddress: tokenAddress as `0x${string}`,
      expectedAmount,
      expectedRecipient: expectedRecipient as `0x${string}`,
    });

    expect(result).toEqual({ success: false, error: 'Expected transfer not found in transaction logs' });
  });

  it('should return failure if transfer log has wrong amount', async () => {
    const wrongData = encodeAbiParameters(
      [{ type: 'uint256', name: 'value' }],
      [500n] // Wrong amount
    );

    vi.mocked(mockClient.getTransactionReceipt).mockResolvedValue({
      status: 'success',
      blockHash: '0xabc',
      logs: [
        {
          address: tokenAddress,
          topics: validTopics,
          data: wrongData,
        },
      ],
    } as never);

    const result = await verifyTransaction({
      client: mockClient,
      txHash: txHash as `0x${string}`,
      tokenAddress: tokenAddress as `0x${string}`,
      expectedAmount,
      expectedRecipient: expectedRecipient as `0x${string}`,
    });

    expect(result).toEqual({ success: false, error: 'Expected transfer not found in transaction logs' });
  });

  it('should handle RPC errors gracefully', async () => {
    vi.mocked(mockClient.getTransactionReceipt).mockRejectedValue(new Error('RPC Error'));

    const result = await verifyTransaction({
      client: mockClient,
      txHash: txHash as `0x${string}`,
      tokenAddress: tokenAddress as `0x${string}`,
      expectedAmount,
      expectedRecipient: expectedRecipient as `0x${string}`,
    });

    expect(result).toEqual({ success: false, error: 'RPC Error' });
  });
});
