/**
 * Steg 6 — DC-distribution & övervakning.
 *
 * Lättviktig vägledning för busbars/Lynx, shunt och GX-enhet utifrån max
 * kontinuerlig DC-ström. Detaljerad produktmatchning sker mot
 * komponentdatabasen (src/data) i senare faser.
 */

import type { SystemVoltage } from "./units.js";

/** Inparametrar för distributionsdimensionering. */
export interface DistributionInput {
  /** Högsta kontinuerliga DC-ström i systemet, A. */
  maxContinuousCurrentA: number;
  /** Systemspänning, V (från Steg 2). */
  systemVoltage: SystemVoltage;
}

/** Resultat med rekommendationer för DC-distribution. */
export interface DistributionResult {
  /** Minsta busbar/Lynx-strömtålighet, A (med marginal). */
  busbarMinCurrentA: number;
  /** Rekommenderad shunt-storlek, A (närmaste vanliga: 300, 500 eller 1000). */
  shuntRatingA: 300 | 500 | 1000;
  /** Rekommenderas en GX-enhet (Cerbo/GX Touch) för övervakning? */
  recommendGx: boolean;
  /** Kort motivering på svenska. */
  rationale: string;
}

/** Marginal på busbar-/Lynx-strömtålighet mot max kontinuerlig ström. */
export const BUSBAR_MARGIN = 1.3;

/**
 * Ger vägledning för DC-distribution. Busbar dimensioneras med marginal över
 * max ström; shunt väljs till minsta passande storlek (300/500/1000 A). GX
 * rekommenderas alltid för system med övervakningsbehov (default).
 */
export function sizeDistribution(input: DistributionInput): DistributionResult {
  const { maxContinuousCurrentA } = input;
  if (maxContinuousCurrentA < 0) throw new RangeError("maxContinuousCurrentA kan inte vara negativ.");

  const busbarMinCurrentA = maxContinuousCurrentA * BUSBAR_MARGIN;
  const shuntRatingA: 300 | 500 | 1000 =
    maxContinuousCurrentA <= 300 ? 300 : maxContinuousCurrentA <= 500 ? 500 : 1000;

  const rationale =
    `Busbar/Lynx ≥ ${Math.round(busbarMinCurrentA)} A (max ${Math.round(maxContinuousCurrentA)} A ` +
    `× ${BUSBAR_MARGIN}), SmartShunt ${shuntRatingA} A.`;

  return {
    busbarMinCurrentA,
    shuntRatingA,
    recommendGx: true,
    rationale,
  };
}
