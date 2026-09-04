import { PublicClient, parseAbiItem, decodeEventLog, Address, Hash } from 'viem';

export interface VerifyTransactionParams {
  client: PublicClient;
  txHash: Hash;
  tokenAddress: Address;
  expectedAmount: bigint;
  expectedRecipient: Address;
  maxAgeSeconds?: number;
}

export interface VerifyTransactionResult {
  success: boolean;
  error?: string;
}

const transferAbiItem = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

export async function verifyTransaction({
  client,
  txHash,
  tokenAddress,
  expectedAmount,
  expectedRecipient,
  maxAgeSeconds,
}: VerifyTransactionParams): Promise<VerifyTransactionResult> {
  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      return { success: false, error: 'Transaction reverted' };
    }

    if (maxAgeSeconds !== undefined) {
      const block = await client.getBlock({ blockHash: receipt.blockHash });
      const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
      const ageSeconds = Number(currentTimestamp - block.timestamp);

      if (ageSeconds > maxAgeSeconds) {
        return { success: false, error: `Transaction is too old (${ageSeconds}s > ${maxAgeSeconds}s)` };
      }
    }

    let transferFound = false;

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) {
        continue;
      }

      try {
        const decoded = decodeEventLog({
          abi: [transferAbiItem],
          data: log.data,
          topics: (log as unknown as { topics: [] }).topics,
        }) as { eventName: string, args: { from: string; to: string; value: bigint } };

        if (decoded.eventName === 'Transfer') {
          const args = decoded.args;
          if (
            args.to.toLowerCase() === expectedRecipient.toLowerCase() &&
            args.value === expectedAmount
          ) {
            transferFound = true;
            break;
          }
        }
      } catch {
        // Ignore decode errors for non-Transfer logs
      }
    }

    if (!transferFound) {
      return { success: false, error: 'Expected transfer not found in transaction logs' };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown error occurred' };
  }
}
