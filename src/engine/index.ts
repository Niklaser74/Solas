/**
 * Dimensas beräkningsmotor — publika API.
 *
 * Varje modul (Steg 1–6 + 8) exporterar rena funktioner. `designSystem` är
 * en bekvämlighet som trär ihop stegen för det enkla off-grid-fallet i v1
 * (en MPPT + en växelriktare + ett batteri, manuell kabellängd).
 */

export * from "./units.js";
export * from "./load.js";
export * from "./systemVoltage.js";
export * from "./battery.js";
export * from "./solar.js";
export * from "./inverter.js";
export * from "./distribution.js";
export * from "./cable.js";

import { analyzeLoad } from "./load.js";
import type { Appliance, LoadAnalysis, LoadOptions } from "./load.js";
import { recommendSystemVoltage } from "./systemVoltage.js";
import type { SystemVoltageResult } from "./systemVoltage.js";
import { sizeBattery } from "./battery.js";
import type { BatteryResult } from "./battery.js";
import { sizeSolar } from "./solar.js";
import type { SolarResult } from "./solar.js";
import { selectInverter } from "./inverter.js";
import type { InverterResult } from "./inverter.js";
import { sizeDistribution } from "./distribution.js";
import type { DistributionResult } from "./distribution.js";
import { sizeCableSegment } from "./cable.js";
import type { CableSegmentResult } from "./cable.js";
import type { SystemVoltage } from "./units.js";

/** Antagen DC-verkningsgrad i växelriktaren när AC-effekt räknas till DC-ström. */
export const INVERTER_DC_EFFICIENCY = 0.9;

/** Samlad indata för en komplett dimensionering (v1 off-grid). */
export interface DesignSystemInput {
  /** Apparatlista (Steg 1). */
  appliances: readonly Appliance[];
  /** Lastalternativ (samtidighetsfaktor). */
  loadOptions?: LoadOptions;
  /** Manuell override av systemspänning (Steg 2). */
  voltageOverride?: SystemVoltage;
  /** Batteriparametrar (Steg 3). */
  battery: {
    autonomyDays: number;
    dod: number;
    tempFactor?: number;
    efficiency?: number;
  };
  /** Solparametrar (Steg 4). */
  solar: {
    peakSunHoursWorstMonth: number;
    systemLosses?: number;
    snowFactor?: number;
  };
  /** Växelriktarparametrar (Steg 5). */
  inverter?: {
    continuousMargin?: number;
    hasInductiveLoads?: boolean;
  };
  /** Huvudkabel batteri → växelriktare (Steg 8). */
  mainCable: {
    /** Enkelvägslängd, m (manuell i v1; från Steg 7 senare). */
    lengthM: number;
    maxVoltDropPct?: number;
  };
}

/** Samlat resultat för alla genomlöpta steg. */
export interface DesignSystemResult {
  load: LoadAnalysis;
  systemVoltage: SystemVoltageResult;
  battery: BatteryResult;
  solar: SolarResult;
  inverter: InverterResult;
  /** Beräknad max kontinuerlig DC-ström, A (batteri → växelriktare). */
  maxContinuousDcCurrentA: number;
  distribution: DistributionResult;
  mainCable: CableSegmentResult;
}

/**
 * Trär ihop dimensioneringsstegen 1→8 för det enkla off-grid-fallet.
 *
 * Returnerar varje stegs resultat oförändrat så att UI/BOM kan visa
 * mellanresultat och motiveringar.
 */
export function designSystem(input: DesignSystemInput): DesignSystemResult {
  const load = analyzeLoad(input.appliances, input.loadOptions);

  const systemVoltage = recommendSystemVoltage(load.peakLoadW, input.voltageOverride);
  const vsys = systemVoltage.voltage;

  const battery = sizeBattery({
    dailyEnergyWh: load.dailyEnergyWh,
    systemVoltage: vsys,
    autonomyDays: input.battery.autonomyDays,
    dod: input.battery.dod,
    tempFactor: input.battery.tempFactor,
    efficiency: input.battery.efficiency,
  });

  const solar = sizeSolar({
    dailyEnergyWh: load.dailyEnergyWh,
    peakSunHoursWorstMonth: input.solar.peakSunHoursWorstMonth,
    systemLosses: input.solar.systemLosses,
    snowFactor: input.solar.snowFactor,
  });

  const inverter = selectInverter({
    peakLoadW: load.peakLoadW,
    surgeW: load.surgeW,
    continuousMargin: input.inverter?.continuousMargin,
    hasInductiveLoads: input.inverter?.hasInductiveLoads,
  });

  // DC-ström batteri → växelriktare vid kontinuerlig topplast.
  const maxContinuousDcCurrentA = inverter.requiredContinuousW / vsys / INVERTER_DC_EFFICIENCY;

  const distribution = sizeDistribution({
    maxContinuousCurrentA: maxContinuousDcCurrentA,
    systemVoltage: vsys,
  });

  const mainCable = sizeCableSegment({
    currentA: maxContinuousDcCurrentA,
    lengthM: input.mainCable.lengthM,
    systemVoltage: vsys,
    maxVoltDropPct: input.mainCable.maxVoltDropPct,
  });

  return {
    load,
    systemVoltage,
    battery,
    solar,
    inverter,
    maxContinuousDcCurrentA,
    distribution,
    mainCable,
  };
}
