/**
 * Interfaces and logic for dynamic pricing optimization.
 */

export interface PricingMetrics {
  /**
   * The total volume of requests over the last 24 hours.
   */
  requestVolume24h: number;

  /**
   * The base compute cost for servicing a request.
   */
  computeCost: number;

  /**
   * The elasticity of demand, determining how sensitive the price is to request volume.
   * A value of 0 means price is inelastic to volume; higher values increase price as volume grows.
   */
  demandElasticity: number;
}

export interface PricingBounds {
  /**
   * The absolute minimum price allowed.
   * Note: The logic will enforce that the actual floor is at least the compute cost.
   */
  safetyFloor: number;

  /**
   * The absolute maximum price allowed.
   */
  ceilingBound: number;
}

export interface DynamicPricingConfig {
  /**
   * The baseline price before dynamic adjustments.
   */
  basePrice: number;

  /**
   * Current metrics affecting the pricing.
   */
  metrics: PricingMetrics;

  /**
   * Safety limits for the pricing.
   */
  bounds: PricingBounds;

  /**
   * Optional scaling factor to normalize request volume.
   * Defaults to 1000 if not provided.
   */
  volumeScaleFactor?: number;
}

/**
 * Calculates a dynamically adjusted price based on volume, compute cost, and elasticity,
 * while ensuring the final price remains within the specified safety floor and ceiling bounds.
 *
 * @param config - The configuration for pricing calculation.
 * @returns The dynamically calculated price.
 */
export function calculateDynamicPrice(config: DynamicPricingConfig): number {
  const { basePrice, metrics, bounds, volumeScaleFactor = 1000 } = config;

  // Calculate demand multiplier
  // Uses the 24h volume normalized by a scaling factor
  const normalizedVolume = metrics.requestVolume24h / volumeScaleFactor;
  const demandMultiplier = 1 + (metrics.demandElasticity * normalizedVolume);

  // Calculate the raw unconstrained price
  const rawPrice = (basePrice * demandMultiplier) + metrics.computeCost;

  // The actual floor should never be less than the compute cost to avoid operating at a loss.
  const effectiveFloor = Math.max(bounds.safetyFloor, metrics.computeCost);

  // Ensure the price is within the bounds
  const boundedPrice = Math.max(effectiveFloor, Math.min(rawPrice, bounds.ceilingBound));

  // Return the bounded price. If effectiveFloor > ceilingBound (which would be a configuration error),
  // it enforces the bounds as best as possible, returning effectiveFloor.
  return boundedPrice;
}
