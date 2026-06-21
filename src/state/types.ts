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
    /** Vald batterimodell (komponent-id), eller null för auto/rekommenderad. */
    selectedComponentId: string | null;
    /** Manuellt antal batterier, eller null för auto-beräknat. */
    quantityOverride: number | null;
    /** Egna batteriparametrar (när "Egen" valts), eller null. */
    customBattery: { nominalVoltageV: number; capacityAh: number; prisSek: number } | null;
  };
  solar: {
    regionKey: string;
    peakSunHoursWorstMonth: number;
    systemLosses: number;
    snowFactor: number;
    /** Vald panelmodell (komponent-id), eller null för auto/rekommenderad. */
    panelComponentId: string | null;
    /** Manuellt antal paneler, eller null för auto-beräknat. */
    panelQuantityOverride: number | null;
    /** Egna panelparametrar (när "Egen" valts), eller null. */
    customPanel: { vocV: number; impA: number; wp: number; prisSek: number } | null;
  };
  inverter: {
    hasInductiveLoads: boolean;
  };
  cable: {
    mainCableLengthM: number;
    maxVoltDropPct: number;
  };
  layout: LayoutState;
}

/** En komponent placerad i layouten. */
export interface LayoutPlacement {
  id: string;
  componentId: string;
  /** Position i zonen, mm (övre vänstra hörnet). */
  x: number;
  y: number;
  /** Rotation i grader (0/90/180/270). */
  rotation: number;
}

/** Ett kabelrun mellan två anslutningspunkter. */
export interface LayoutRun {
  id: string;
  fromPlacementId: string;
  fromPointId: string;
  toPlacementId: string;
  toPointId: string;
  /** Slack i procent (böjradie/marginal). */
  slackPercent: number;
}

/** Fysisk layout (Steg 7): en fri yta + placeringar + kabelrun. */
export interface LayoutState {
  zone: { width: number; height: number };
  placements: LayoutPlacement[];
  runs: LayoutRun[];
}
