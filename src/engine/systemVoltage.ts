/**
 * Steg 2 — Systemspänning.
 *
 * Tumregel baserad på kontinuerlig effekt:
 *   < 1 500 W      → 12 V
 *   1 500–3 000 W  → 24 V
 *   > 3 000 W      → 48 V
 * Manuell override tillåts alltid.
 */

import type { SystemVoltage } from "./units.js";

/** Resultat med rekommenderad spänning och motivering. */
export interface SystemVoltageResult {
  /** Vald systemspänning (rekommendation eller override). */
  voltage: SystemVoltage;
  /** Den tumregelsbaserade rekommendationen, oberoende av override. */
  recommended: SystemVoltage;
  /** True om `voltage` kommer från en manuell override. */
  overridden: boolean;
  /** Kort förklaring på svenska (DIY-pedagogik). */
  rationale: string;
}

/** Trösklar för tumregeln (W). Exporteras för testbarhet. */
export const VOLTAGE_THRESHOLDS = {
  to24V: 1500,
  to48V: 3000,
} as const;

/**
 * Rekommenderar systemspänning utifrån kontinuerlig effekt (typ topplast
 * från Steg 1). Ett `override` returneras oförändrat men rekommendationen
 * räknas ändå ut för jämförelse.
 */
export function recommendSystemVoltage(
  continuousW: number,
  override?: SystemVoltage,
): SystemVoltageResult {
  if (continuousW < 0) {
    throw new RangeError("continuousW kan inte vara negativ.");
  }

  let recommended: SystemVoltage;
  if (continuousW < VOLTAGE_THRESHOLDS.to24V) {
    recommended = 12;
  } else if (continuousW <= VOLTAGE_THRESHOLDS.to48V) {
    recommended = 24;
  } else {
    recommended = 48;
  }

  const voltage = override ?? recommended;
  const overridden = override !== undefined && override !== recommended;

  const rationale = overridden
    ? `Manuellt vald ${voltage} V (tumregeln föreslår ${recommended} V vid ${continuousW} W).`
    : `${recommended} V rekommenderas för ${continuousW} W kontinuerlig effekt.`;

  return { voltage, recommended, overridden, rationale };
}
