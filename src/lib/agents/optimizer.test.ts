import { describe, it, expect } from "vitest";
import { calculateDynamicPrice, DynamicPricingConfig } from './optimizer';

describe('calculateDynamicPrice', () => {
  it('should calculate the base price when elasticity is 0', () => {
    const config: DynamicPricingConfig = {
      basePrice: 10,
      metrics: {
        requestVolume24h: 5000,
        computeCost: 2,
        demandElasticity: 0,
      },
      bounds: {
        safetyFloor: 1,
        ceilingBound: 20,
      }
    };
    // demandMultiplier = 1 + (0 * 5000/1000) = 1
    // rawPrice = (10 * 1) + 2 = 12
    // bounded = 12
    expect(calculateDynamicPrice(config)).toBe(12);
  });

  it('should calculate a higher price with elasticity and volume', () => {
    const config: DynamicPricingConfig = {
      basePrice: 10,
      metrics: {
        requestVolume24h: 5000, // normalized = 5
        computeCost: 2,
        demandElasticity: 0.1, // multiplier = 1 + (0.1 * 5) = 1.5
      },
      bounds: {
        safetyFloor: 1,
        ceilingBound: 50,
      }
    };
    // rawPrice = (10 * 1.5) + 2 = 17
    expect(calculateDynamicPrice(config)).toBe(17);
  });

  it('should enforce the safety floor', () => {
    const config: DynamicPricingConfig = {
      basePrice: 5,
      metrics: {
        requestVolume24h: 1000,
        computeCost: 1,
        demandElasticity: 0,
      },
      bounds: {
        safetyFloor: 10, // Higher than rawPrice = 6
        ceilingBound: 50,
      }
    };
    expect(calculateDynamicPrice(config)).toBe(10);
  });

  it('should enforce the compute cost as the absolute minimum floor', () => {
    const config: DynamicPricingConfig = {
      basePrice: 1,
      metrics: {
        requestVolume24h: 0,
        computeCost: 5,
        demandElasticity: 0,
      },
      bounds: {
        safetyFloor: 2, // Less than compute cost
        ceilingBound: 50,
      }
    };
    // rawPrice = (1 * 1) + 5 = 6
    // In this specific case, rawPrice is 6 which is above computeCost.
    // Let's modify so rawPrice is lower than computeCost (not possible with positive basePrice, but let's test a very low base price)
    const config2: DynamicPricingConfig = {
      basePrice: 0,
      metrics: {
        requestVolume24h: 0,
        computeCost: 5,
        demandElasticity: 0,
      },
      bounds: {
        safetyFloor: 2, // Less than compute cost
        ceilingBound: 50,
      }
    };
    // rawPrice = (0 * 1) + 5 = 5
    // floor = max(2, 5) = 5
    expect(calculateDynamicPrice(config2)).toBe(5);
  });

  it('should enforce the ceiling bound', () => {
    const config: DynamicPricingConfig = {
      basePrice: 10,
      metrics: {
        requestVolume24h: 100000, // normalized = 100
        computeCost: 5,
        demandElasticity: 0.5, // multiplier = 1 + (0.5 * 100) = 51
      },
      bounds: {
        safetyFloor: 5,
        ceilingBound: 100, // rawPrice = (10 * 51) + 5 = 515
      }
    };
    expect(calculateDynamicPrice(config)).toBe(100);
  });
});
