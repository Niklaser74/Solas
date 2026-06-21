/** localStorage-persistens för projekt (Fas 4 ersätter detta med konton). */

import type { ProjectState, LayoutState } from "./types.js";
import { applianceTemplates, sunRegions } from "../data/templates.js";
import { TYPICAL_DOD } from "../engine/battery.js";

const KEY_CURRENT = "dimensas:current";
const KEY_SAVED = "dimensas:saved";

/** Tom standardlayout: en fri yta på 1000×600 mm. */
export function defaultLayout(): LayoutState {
  return { zone: { width: 1000, height: 600 }, placements: [], runs: [] };
}

/** Standardprojekt (stuga-mall). */
export function defaultState(): ProjectState {
  const region = sunRegions.syd;
  return {
    namn: "Mitt off-grid-system",
    typ: "stuga",
    appliances: applianceTemplates.stuga.map((a) => ({ ...a })),
    voltageOverride: null,
    battery: {
      autonomyDays: 3,
      chemistry: "AGM",
      dod: TYPICAL_DOD.AGM,
      tempFactor: 0.9,
      efficiency: 0.95,
      selectedComponentId: null,
      quantityOverride: null,
      customBattery: null,
    },
    solar: {
      regionKey: "syd",
      peakSunHoursWorstMonth: region.worstMonthPeakSunHours,
      systemLosses: 0.75,
      snowFactor: region.defaultSnowFactor,
      panelComponentId: null,
      panelQuantityOverride: null,
      customPanel: null,
    },
    inverter: { hasInductiveLoads: true },
    cable: { mainCableLengthM: 2.5, maxVoltDropPct: 3 },
    layout: defaultLayout(),
  };
}

/** Fyller i fält som saknas i ett inläst (äldre) projekt. */
function normalize(state: ProjectState): ProjectState {
  return {
    ...state,
    layout: state.layout ?? defaultLayout(),
    battery: {
      ...state.battery,
      selectedComponentId: state.battery?.selectedComponentId ?? null,
      quantityOverride: state.battery?.quantityOverride ?? null,
      customBattery: state.battery?.customBattery ?? null,
    },
    solar: {
      ...state.solar,
      panelComponentId: state.solar?.panelComponentId ?? null,
      panelQuantityOverride: state.solar?.panelQuantityOverride ?? null,
      customPanel: state.solar?.customPanel ?? null,
    },
  };
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Läser senast använda projekt, eller standard. */
export function loadCurrent(): ProjectState {
  if (typeof localStorage === "undefined") return defaultState();
  const parsed = safeParse<ProjectState>(localStorage.getItem(KEY_CURRENT));
  return parsed ? normalize(parsed) : defaultState();
}

/** Sparar aktuellt projekt (autospar). */
export function saveCurrent(state: ProjectState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY_CURRENT, JSON.stringify(state));
}

/** Returnerar sparade projekt (namn → state). */
export function listSaved(): Record<string, ProjectState> {
  if (typeof localStorage === "undefined") return {};
  return safeParse<Record<string, ProjectState>>(localStorage.getItem(KEY_SAVED)) ?? {};
}

/** Sparar projektet under sitt namn i den namngivna listan. */
export function saveNamed(state: ProjectState): void {
  if (typeof localStorage === "undefined") return;
  const saved = listSaved();
  saved[state.namn] = state;
  localStorage.setItem(KEY_SAVED, JSON.stringify(saved));
}

/** Tar bort ett sparat projekt. */
export function deleteNamed(namn: string): void {
  if (typeof localStorage === "undefined") return;
  const saved = listSaved();
  delete saved[namn];
  localStorage.setItem(KEY_SAVED, JSON.stringify(saved));
}
