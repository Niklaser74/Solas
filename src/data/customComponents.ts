/**
 * Bygger syntetiska komponenter från användarens egna parametrar, så att
 * "Egen" i guiden går genom samma BOM-väg som de fördefinierade modellerna.
 * Sentinel-id:na används också som dropdown-värde i guiden.
 */

import type { Component } from "./types.js";
import type { BatteryChemistry } from "../engine/battery.js";

export const CUSTOM_BATTERY_ID = "custom-battery";
export const CUSTOM_PANEL_ID = "custom-panel";

export interface CustomBatterySpec {
  nominalVoltageV: number;
  capacityAh: number;
  prisSek: number;
}

export interface CustomPanelSpec {
  vocV: number;
  impA: number;
  wp: number;
  prisSek: number;
}

/** Egen batterikomponent. Kemi/DoD följer batteristegets val. */
export function buildCustomBattery(
  spec: CustomBatterySpec,
  chemistry: BatteryChemistry,
  dod: number,
): Component {
  return {
    id: CUSTOM_BATTERY_ID,
    typ: "battery",
    modell: `Eget batteri ${spec.nominalVoltageV} V / ${spec.capacityAh} Ah`,
    specs: {
      nominalVoltageV: spec.nominalVoltageV,
      capacityAh: spec.capacityAh,
      energyWh: spec.nominalVoltageV * spec.capacityAh,
      chemistry,
      recommendedDod: dod,
    },
    prisSek: spec.prisSek,
    gronTeknikKategori: "batteri",
  };
}

/** Egen solpanel. Spänningen tolkas som tomgångsspänning (Voc). */
export function buildCustomPanel(spec: CustomPanelSpec): Component {
  return {
    id: CUSTOM_PANEL_ID,
    typ: "panel",
    modell: `Egen panel ${spec.wp} W`,
    specs: {
      wp: spec.wp,
      vocV: spec.vocV,
      vmpV: spec.vocV,
      impA: spec.impA,
      iscA: spec.impA,
    },
    prisSek: spec.prisSek,
    gronTeknikKategori: "sol",
  };
}
