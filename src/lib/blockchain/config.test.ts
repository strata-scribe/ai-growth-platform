import { describe, it, expect } from "vitest";
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_RPC_ENDPOINTS,
  BASE_SEPOLIA_USDC_ADDRESS,
  mockUsdcFaucetHandler
} from "./config";

describe("Blockchain Config", () => {
  it("should have correct Base Sepolia Chain ID", () => {
    expect(BASE_SEPOLIA_CHAIN_ID).toBe(84532);
  });

  it("should have valid RPC endpoints", () => {
    expect(Array.isArray(BASE_SEPOLIA_RPC_ENDPOINTS)).toBe(true);
    expect(BASE_SEPOLIA_RPC_ENDPOINTS.length).toBeGreaterThan(0);
    BASE_SEPOLIA_RPC_ENDPOINTS.forEach(endpoint => {
      expect(endpoint.startsWith("http")).toBe(true);
    });
  });

  it("should have a valid testnet USDC address format", () => {
    expect(/^0x[a-fA-F0-9]{40}$/.test(BASE_SEPOLIA_USDC_ADDRESS)).toBe(true);
  });

  describe("mockUsdcFaucetHandler", () => {
    it("should return a mock transaction hash and success status for a valid request", async () => {
      const validAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
      const amount = 100n;

      const result = await mockUsdcFaucetHandler(validAddress, amount);

      expect(result.success).toBe(true);
      expect(/^0x[a-f0-9]{64}$/.test(result.txHash)).toBe(true);
    });

    it("should throw an error for an invalid address", async () => {
      const invalidAddress = "0xinvalidaddress";
      const amount = 100n;

      await expect(mockUsdcFaucetHandler(invalidAddress, amount)).rejects.toThrow("Invalid address format");
    });

    it("should throw an error for a non-positive amount", async () => {
      const validAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00";
      const amount = 0n;

      await expect(mockUsdcFaucetHandler(validAddress, amount)).rejects.toThrow("Amount must be positive");
    });
  });
});
