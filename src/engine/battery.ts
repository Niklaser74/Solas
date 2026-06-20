/**
 * Steg 3 — Batteribank.
 *
 * Räknar fram kapacitetskrav i Ah utifrån daglig energi, autonomidagar,
 * urladdningsdjup (DoD), temperaturderating och verkningsgrad.
 *
 *   Ah_krav = (Wh_dygn × autonomidagar)
 *             / (Vsys × DoD × temp_faktor × verkningsgrad)
 */

import type { SystemVoltage } from "./units.js";

/** Batterikemi med typiska DoD-rekommendationer. */
export type BatteryChemistry = "LiFePO4" | "AGM" | "GEL";

/** Inparametrar för batteridimensionering. */
export interface BatteryInput {
  /** Daglig energiförbrukning, Wh/dygn (från Steg 1). */
  dailyEnergyWh: number;
  /** Systemspänning, V (från Steg 2). */
  systemVoltage: SystemVoltage;
  /** Antal dygn utan laddning som banken ska klara. */
  autonomyDays: number;
  /** Urladdningsdjup [0–1], t.ex. AGM ~0.5, LiFePO4 ~0.8. */
  dod: number;
  /**
   * Temperaturfaktor [0–1] som deratar tillgänglig kapacitet i kyla
   * (viktigt i Sverige). 1.0 = ingen derating.
   */
  tempFactor?: number;
  /** Verkningsgrad för urladdning/inverter [0–1]. Standard 0.95. */
  efficiency?: number;
}

/** Resultat av batteridimensioneringen. */
export interface BatteryResult {
  /** Beräknat kapacitetskrav, Ah vid systemspänning. */
  requiredAh: number;
  /** Total nominell energi i banken som motsvarar requiredAh, Wh. */
  nominalEnergyWh: number;
  /** Faktiskt uttagbar energi givet DoD, temp och verkningsgrad, Wh. */
  usableEnergyWh: number;
  /** Kort motivering på svenska. */
  rationale: string;
}

/** Typiska rekommenderade DoD-värden per kemi (för UI-defaults). */
export const TYPICAL_DOD: Readonly<Record<BatteryChemistry, number>> = {
  LiFePO4: 0.8,
  AGM: 0.5,
  GEL: 0.5,
};

/**
 * Dimensionerar batteribanken.
 *
 * Notera att fram-och-retur-effekter inte gäller här (det är energilagring,
 * inte ledare) — temperaturderating och verkningsgrad styr i stället.
 */
export function sizeBattery(input: BatteryInput): BatteryResult {
  const {
    dailyEnergyWh,
    systemVoltage,
    autonomyDays,
    dod,
    tempFactor = 1.0,
    efficiency = 0.95,
  } = input;

  if (dailyEnergyWh < 0) throw new RangeError("dailyEnergyWh kan inte vara negativ.");
  if (autonomyDays <= 0) throw new RangeError("autonomyDays måste vara > 0.");
  if (dod <= 0 || dod > 1) throw new RangeError("dod måste vara i (0, 1].");
  if (tempFactor <= 0 || tempFactor > 1) throw new RangeError("tempFactor måste vara i (0, 1].");
  if (efficiency <= 0 || efficiency > 1) throw new RangeError("efficiency måste vara i (0, 1].");

  const requiredAh =
    (dailyEnergyWh * autonomyDays) / (systemVoltage * dod * tempFactor * efficiency);

  const nominalEnergyWh = requiredAh * systemVoltage;
  const usableEnergyWh = nominalEnergyWh * dod * tempFactor * efficiency;

  const rationale =
    `${Math.round(requiredAh)} Ah vid ${systemVoltage} V för ${autonomyDays} ` +
    `autonomidagar (DoD ${Math.round(dod * 100)} %, tempfaktor ${tempFactor}, ` +
    `verkningsgrad ${Math.round(efficiency * 100)} %).`;

  return { requiredAh, nominalEnergyWh, usableEnergyWh, rationale };
}
