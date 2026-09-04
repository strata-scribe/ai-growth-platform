import { describe, it, expect } from 'vitest';
import {
  calculateRevenueDistribution,
  calculateReferralBonus,
  calculateAgentNetEarnings,
  createConfig,
  calculatePercentage,
  DEFAULT_CONFIG
} from '../src/utils/revenueCalculator';

describe('Incentives and Commissions Calculator', () => {
  describe('Revenue Distribution (Commission Calculation & Platform Treasury Fee)', () => {
    it('should correctly calculate standard revenue distribution', () => {
      // Platform treasury fee is 15% (3.75% to pool, 11.25% to net platform)
      // Agent gets 85%
      const dist = calculateRevenueDistribution(100);
      expect(dist.grossRevenue).toBe(100);
      expect(dist.agentEarnings).toBe(85);
      expect(dist.platformBreakdown.grossPlatformRevenue).toBe(15);
      expect(dist.platformBreakdown.contributorPoolAmount).toBe(3.75);
      expect(dist.platformBreakdown.netPlatformRevenue).toBe(11.25);
    });

    it('should calculate custom revenue distribution config', () => {
      const config = createConfig({ agentSharePercent: 80, platformSharePercent: 20 });
      const dist = calculateRevenueDistribution(100, config);
      expect(dist.agentEarnings).toBe(80);
      expect(dist.platformBreakdown.grossPlatformRevenue).toBe(20);
      expect(dist.platformBreakdown.contributorPoolAmount).toBe(5);
      expect(dist.platformBreakdown.netPlatformRevenue).toBe(15);
    });

    it('should fail with invalid negative gross revenue', () => {
      expect(() => calculateRevenueDistribution(-100)).toThrow('Gross revenue cannot be negative');
    });
  });

  describe('Affiliate Split Distribution (Referral Bonus)', () => {
    it('should calculate bonus when referral is active', () => {
      const relationship = {
        referrerId: 'A',
        referredAgentId: 'B',
        establishedAt: new Date().toISOString(),
        isActive: true,
      };

      const bonus = calculateReferralBonus(100, relationship);
      expect(bonus.bonusAmount).toBe(25);
      expect(bonus.bonusPercentage).toBe(25);
    });

    it('should return zero bonus when referral is inactive', () => {
      const relationship = {
        referrerId: 'A',
        referredAgentId: 'B',
        establishedAt: new Date().toISOString(),
        isActive: false,
      };

      const bonus = calculateReferralBonus(100, relationship);
      expect(bonus.bonusAmount).toBe(0);
      expect(bonus.bonusPercentage).toBe(0);
    });
  });

  describe('Agent Net Earnings (with Referral Deductions)', () => {
    it('should calculate net earnings without referral', () => {
      const result = calculateAgentNetEarnings('agent-1', 100);
      expect(result.grossEarnings).toBe(100);
      expect(result.referralDeduction).toBe(0);
      expect(result.netEarnings).toBe(100);
    });

    it('should calculate net earnings with an active referral', () => {
      const relationship = {
        referrerId: 'A',
        referredAgentId: 'agent-1',
        establishedAt: new Date().toISOString(),
        isActive: true,
      };

      const result = calculateAgentNetEarnings('agent-1', 100, relationship);
      expect(result.grossEarnings).toBe(100);
      expect(result.referralDeduction).toBe(25);
      expect(result.netEarnings).toBe(75);
      expect(result.referrerInfo?.referrerId).toBe('A');
    });
  });

  describe('Configuration Validation', () => {
    it('should throw if agent and platform shares do not sum to 100', () => {
      expect(() => createConfig({ agentSharePercent: 50, platformSharePercent: 30 }))
        .toThrow('must sum to 100%');
    });

    it('should throw if any percentage is negative', () => {
      expect(() => createConfig({ agentSharePercent: 120, platformSharePercent: -20 }))
        .toThrow('All percentages must be between 0 and 100');
    });

    it('should throw if any percentage is > 100', () => {
      expect(() => createConfig({ contributorPoolPercent: 150 }))
        .toThrow('All percentages must be between 0 and 100');
    });
  });

  describe('calculatePercentage Utility', () => {
    it('should round correctly to two decimal places', () => {
      const result = calculatePercentage(10.123, 85);
      // 10.123 * 0.85 = 8.60455 -> 8.60
      expect(result).toBe(8.60);
    });

    it('should throw error on negative amount', () => {
      expect(() => calculatePercentage(-10, 50)).toThrow('Amount cannot be negative');
    });
  });
});
