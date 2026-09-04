/**
 * AI Agent Platform Revenue Sharing Calculator
 * 
 * Revenue Distribution Model:
 * - Executing Agent: 85% of gross revenue
 * - Platform: 15% of gross revenue
 *   - Contributor Pool: 25% of platform revenue (3.75% of gross)
 *   - Platform Net: 75% of platform revenue (11.25% of gross)
 * - Referral Bonus: 25% of referred agent's net earnings
 * 
 * @module RevenueSharing
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type Percentage = number;
export type Currency = number;
export type EntityId = string;
export type ISOTimestamp = string;

export interface RevenueShareConfig {
  readonly agentSharePercent: Percentage;
  readonly platformSharePercent: Percentage;
  readonly contributorPoolPercent: Percentage;
  readonly referralBonusPercent: Percentage;
}

export interface PlatformRevenueBreakdown {
  readonly grossPlatformRevenue: Currency;
  readonly contributorPoolAmount: Currency;
  readonly netPlatformRevenue: Currency;
  readonly percentages: {
    readonly contributorPoolOfGross: Percentage;
    readonly netPlatformOfGross: Percentage;
  };
}

export interface RevenueDistribution {
  readonly grossRevenue: Currency;
  readonly agentEarnings: Currency;
  readonly platformBreakdown: PlatformRevenueBreakdown;
  readonly calculatedAt: ISOTimestamp;
  readonly configUsed: RevenueShareConfig;
}

export interface ReferralRelationship {
  readonly referrerId: EntityId;
  readonly referredAgentId: EntityId;
  readonly establishedAt: ISOTimestamp;
  readonly isActive: boolean;
}

export interface ReferralBonus {
  readonly referrerId: EntityId;
  readonly referredAgentId: EntityId;
  readonly referredAgentEarnings: Currency;
  readonly bonusAmount: Currency;
  readonly bonusPercentage: Percentage;
}

export interface AgentNetEarnings {
  readonly agentId: EntityId;
  readonly grossEarnings: Currency;
  readonly referralDeduction: Currency;
  readonly netEarnings: Currency;
  readonly referrerInfo: ReferralBonus | null;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONFIG: RevenueShareConfig = {
  agentSharePercent: 85,
  platformSharePercent: 15,
  contributorPoolPercent: 25,
  referralBonusPercent: 25,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

export const createConfig = (
  partial: Partial<RevenueShareConfig> = {}
): RevenueShareConfig => {
  const config: RevenueShareConfig = {
    ...DEFAULT_CONFIG,
    ...partial,
  };

  if (config.agentSharePercent + config.platformSharePercent !== 100) {
    throw new Error(
      `Agent share (${config.agentSharePercent}%) and platform share ` +
      `(${config.platformSharePercent}%) must sum to 100%`
    );
  }

  const percentages = [
    config.agentSharePercent,
    config.platformSharePercent,
    config.contributorPoolPercent,
    config.referralBonusPercent,
  ];

  if (percentages.some(p => p < 0 || p > 100)) {
    throw new Error('All percentages must be between 0 and 100');
  }

  return config;
};

export const calculatePercentage = (
  amount: Currency,
  percentage: Percentage
): Currency => {
  if (amount < 0) {
    throw new Error('Amount cannot be negative');
  }
  return Math.round((amount * percentage / 100) * 100) / 100;
};

export const getCurrentTimestamp = (): ISOTimestamp => new Date().toISOString();

// ============================================================================
// Core Revenue Calculation Functions
// ============================================================================

export const calculateRevenueDistribution = (
  grossRevenue: Currency,
  config: RevenueShareConfig = DEFAULT_CONFIG
): RevenueDistribution => {
  if (grossRevenue < 0) {
    throw new Error('Gross revenue cannot be negative');
  }

  const agentEarnings = calculatePercentage(grossRevenue, config.agentSharePercent);
  const grossPlatformRevenue = calculatePercentage(grossRevenue, config.platformSharePercent);
  const contributorPoolAmount = calculatePercentage(
    grossPlatformRevenue,
    config.contributorPoolPercent
  );
  const netPlatformRevenue = grossPlatformRevenue - contributorPoolAmount;

  const platformBreakdown: PlatformRevenueBreakdown = {
    grossPlatformRevenue,
    contributorPoolAmount,
    netPlatformRevenue,
    percentages: {
      contributorPoolOfGross: (contributorPoolAmount / grossRevenue) * 100,
      netPlatformOfGross: (netPlatformRevenue / grossRevenue) * 100,
    },
  };

  return {
    grossRevenue,
    agentEarnings,
    platformBreakdown,
    calculatedAt: getCurrentTimestamp(),
    configUsed: config,
  };
};

export const calculateReferralBonus = (
  referredAgentEarnings: Currency,
  referralRelationship: ReferralRelationship,
  config: RevenueShareConfig = DEFAULT_CONFIG
): ReferralBonus => {
  if (!referralRelationship.isActive) {
    return {
      referrerId: referralRelationship.referrerId,
      referredAgentId: referralRelationship.referredAgentId,
      referredAgentEarnings,
      bonusAmount: 0,
      bonusPercentage: 0,
    };
  }

  const bonusAmount = calculatePercentage(
    referredAgentEarnings,
    config.referralBonusPercent
  );

  return {
    referrerId: referralRelationship.referrerId,
    referredAgentId: referralRelationship.referredAgentId,
    referredAgentEarnings,
    bonusAmount,
    bonusPercentage: config.referralBonusPercent,
  };
};

export const calculateAgentNetEarnings = (
  agentId: EntityId,
  grossEarnings: Currency,
  referralRelationship: ReferralRelationship | null = null,
  config: RevenueShareConfig = DEFAULT_CONFIG
): AgentNetEarnings => {
  if (referralRelationship === null || !referralRelationship.isActive) {
    return {
      agentId,
      grossEarnings,
      referralDeduction: 0,
      netEarnings: grossEarnings,
      referrerInfo: null,
    };
  }

  const referralBonus = calculateReferralBonus(
    grossEarnings,
    referralRelationship,
    config
  );

  return {
    agentId,
    grossEarnings,
    referralDeduction: referralBonus.bonusAmount,
    netEarnings: grossEarnings - referralBonus.bonusAmount,
    referrerInfo: referralBonus,
  };
};
