/** Guidens projekt-state — den redigerbara indatan till motorn. */

import type { Appliance } from "../engine/load.js";
import type { SystemVoltage } from "../engine/units.js";
import type { BatteryChemistry } from "../engine/battery.js";
import type { ProjectType } from "../data/types.js";

export interface ProjectState {
  namn: string;
  typ: ProjectType;
  appliances: Appliance[];
  /** Manuell override av systemspänning, eller null för rekommendation. */
  voltageOverride: SystemVoltage | null;
  battery: {
    autonomyDays: number;
    chemistry: BatteryChemistry;
    dod: number;
    tempFactor: number;
    efficiency: number;
  };
  solar: {
    regionKey: string;
    peakSunHoursWorstMonth: number;
    systemLosses: number;
    snowFactor: number;
  };
  inverter: {
    hasInductiveLoads: boolean;
  };
  cable: {
    mainCableLengthM: number;
    maxVoltDropPct: number;
  };
}
