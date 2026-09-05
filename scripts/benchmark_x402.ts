import { verifyTransaction } from '../src/lib/x402/verifier.js';
import { createX402Response } from '../src/lib/x402/challenge.js';
import { PublicClient, Address, Hash, encodeEventTopics, parseAbiItem } from 'viem';

const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;
const NEXUSSYN_TREASURY_WALLET = '0xb438d36b425b504724a1c72aa0941c80cb940995' as Address;

const transferAbiItem = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

function createMockClient(): PublicClient {
  return {
    getTransactionReceipt: async ({ hash }: { hash: Hash }) => {
      // Simulate network latency (e.g., RPC call taking between 50ms and 150ms)
      const latency = Math.floor(Math.random() * 100) + 50;
      await new Promise(resolve => setTimeout(resolve, latency));

      const fromAddress = '0x1234567890123456789012345678901234567890' as Address;
      const expectedAmount = 1000000n; // 1 USDC (6 decimals)

      const topics = encodeEventTopics({
        abi: [transferAbiItem],
        eventName: 'Transfer',
        args: {
            from: fromAddress,
            to: NEXUSSYN_TREASURY_WALLET,
        }
      });

      const data = '0x' + expectedAmount.toString(16).padStart(64, '0');

      return {
        status: 'success',
        blockHash: '0xabc' as Hash,
        logs: [
          {
            address: USDC_ADDRESS_BASE,
            data,
            topics: topics as any,
          }
        ]
      } as any;
    }
  } as unknown as PublicClient;
}

async function runBenchmark(concurrentRequests: number, totalRequests: number) {
  console.log(`Starting x402 Benchmark...`);
  console.log(`Concurrent requests: ${concurrentRequests}`);
  console.log(`Total requests: ${totalRequests}`);

  const mockClient = createMockClient();
  let completed = 0;
  let successful = 0;
  let failed = 0;

  const latencies: number[] = [];

  const runTask = async () => {
    while (completed < totalRequests) {
      // It's possible multiple workers enter this while loop when completed is close to totalRequests,
      // we check it again and increment atomically (though JS is single-threaded async).
      const taskIndex = completed++;
      if (taskIndex >= totalRequests) {
        completed--; // Rollback if we overshot
        break;
      }

      const startTime = performance.now();
      try {
        const nonce = `nonce-${taskIndex}`;
        const price = 1;

        // 1. Generate challenge
        const response = createX402Response({ price, nonce });
        if (response.status !== 402) {
          throw new Error('Expected 402 status');
        }

        // 2. Simulate Verification
        const txHash = `0xabcdef${taskIndex.toString().padStart(58, '0')}` as Hash;
        const verifyResult = await verifyTransaction({
           client: mockClient,
           txHash,
           tokenAddress: USDC_ADDRESS_BASE,
           expectedAmount: 1000000n, // 1 USDC
           expectedRecipient: NEXUSSYN_TREASURY_WALLET
        });

        if (verifyResult.success) {
           successful++;
        } else {
           failed++;
           console.error(`Verification failed for task ${taskIndex}: ${verifyResult.error}`);
        }
      } catch (err) {
        failed++;
        console.error(`Task ${taskIndex} threw error:`, err);
      } finally {
        const endTime = performance.now();
        latencies.push(endTime - startTime);
      }
    }
  };

  const startTime = performance.now();

  // Launch concurrent workers
  const workers = Array(concurrentRequests).fill(null).map(() => runTask());
  await Promise.all(workers);

  const endTime = performance.now();
  const totalTimeSec = (endTime - startTime) / 1000;

  const tps = totalRequests / totalTimeSec;

  const totalLatency = latencies.reduce((acc, val) => acc + val, 0);
  const avgLatency = totalLatency / latencies.length;

  latencies.sort((a, b) => a - b);
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];

  console.log(`\n--- Benchmark Results ---`);
  console.log(`Total time: ${totalTimeSec.toFixed(2)}s`);
  console.log(`Successful verifications: ${successful}`);
  console.log(`Failed verifications: ${failed}`);
  console.log(`Transactions Per Second (TPS): ${tps.toFixed(2)}`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`P95 Latency: ${p95Latency?.toFixed(2)}ms`);
}

async function main() {
   await runBenchmark(50, 500);
}

main().catch(console.error);
