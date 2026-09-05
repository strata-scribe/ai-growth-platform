export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const BASE_SEPOLIA_RPC_ENDPOINTS = [
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com"
];

// Testnet USDC address on Base Sepolia
export const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/**
 * Mock USDC faucet handler for local development and testing
 * Simulates a successful token transfer transaction on testnet.
 */
export async function mockUsdcFaucetHandler(
  address: string,
  amount: bigint
): Promise<{ txHash: string; success: boolean }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid address format");
  }

  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }

  // Return a mock transaction hash
  return {
    txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    success: true
  };
}
