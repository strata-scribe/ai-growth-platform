import { PublicClient, parseAbiItem, decodeEventLog, Address, Hash } from 'viem';

export interface AffiliateSplit {
  providerAmount: bigint;
  affiliateAmount: bigint;
}

/**
 * Calculates the split of a total amount between a provider and an affiliate.
 * @param totalAmount The total amount to split.
 * @param affiliateBps The affiliate commission in basis points (1 bps = 0.01%). Must be between 0 and 10000.
 * @returns The provider and affiliate amounts.
 */
export function calculateAffiliateSplit(totalAmount: bigint, affiliateBps: number): AffiliateSplit {
  if (affiliateBps < 0 || affiliateBps > 10000) {
    throw new Error('Affiliate bps must be between 0 and 10000');
  }

  const affiliateAmount = (totalAmount * BigInt(Math.floor(affiliateBps))) / 10000n;
  const providerAmount = totalAmount - affiliateAmount;

  return { providerAmount, affiliateAmount };
}

export interface VerifyAffiliateTransactionParams {
  client: PublicClient;
  txHash: Hash;
  tokenAddress: Address;
  providerAddress: Address;
  providerAmount: bigint;
  affiliateAddress: Address;
  affiliateAmount: bigint;
  maxAgeSeconds?: number;
}

export interface VerifyAffiliateTransactionResult {
  success: boolean;
  error?: string;
}

const transferAbiItem = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

/**
 * Verifies that a transaction includes successful transfers to both a provider and an affiliate.
 * @param params The verification parameters.
 * @returns The verification result.
 */
export async function verifyAffiliateTransaction({
  client,
  txHash,
  tokenAddress,
  providerAddress,
  providerAmount,
  affiliateAddress,
  affiliateAmount,
  maxAgeSeconds,
}: VerifyAffiliateTransactionParams): Promise<VerifyAffiliateTransactionResult> {
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

    // If affiliate amount is 0, we consider affiliate transfer already found
    let providerTransferFound = providerAmount === 0n;
    let affiliateTransferFound = affiliateAmount === 0n;

    // Keep track of which logs we have already matched to prevent a single log
    // from fulfilling both requirements (double-counting vulnerability)
    const matchedLogIndices = new Set<number>();

    for (const [index, log] of receipt.logs.entries()) {
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
            !providerTransferFound &&
            args.to.toLowerCase() === providerAddress.toLowerCase() &&
            args.value === providerAmount
          ) {
            providerTransferFound = true;
            matchedLogIndices.add(index);
          }

          if (
            !affiliateTransferFound &&
            !matchedLogIndices.has(index) &&
            args.to.toLowerCase() === affiliateAddress.toLowerCase() &&
            args.value === affiliateAmount
          ) {
            affiliateTransferFound = true;
            matchedLogIndices.add(index);
          }

          if (providerTransferFound && affiliateTransferFound) {
            break;
          }
        }
      } catch {
        // Ignore decode errors for non-Transfer logs
      }
    }

    if (!providerTransferFound && !affiliateTransferFound) {
      return { success: false, error: 'Expected transfers not found in transaction logs' };
    }

    if (!providerTransferFound) {
      return { success: false, error: 'Provider transfer not found in transaction logs' };
    }

    if (!affiliateTransferFound) {
      return { success: false, error: 'Affiliate transfer not found in transaction logs' };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Unknown error occurred' };
  }
}
