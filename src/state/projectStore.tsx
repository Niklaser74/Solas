/** Projekt-state: Context + reducer, autospar och härlett designresultat. */

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode, Dispatch } from "react";
import type { ProjectState, LayoutState } from "./types.js";
import { loadCurrent, saveCurrent } from "./storage.js";
import { designSystem } from "../engine/index.js";
import type { DesignSystemInput, DesignSystemResult } from "../engine/index.js";
import { assembleBom } from "../bom/assembleBom.js";
import type { Bom } from "../bom/assembleBom.js";
import { SEED_COMPONENTS } from "../data/seed.js";
import type { Component } from "../data/types.js";
import {
  CUSTOM_BATTERY_ID,
  CUSTOM_PANEL_ID,
  buildCustomBattery,
  buildCustomPanel,
} from "../data/customComponents.js";

export type ProjectAction =
  | { type: "patch"; patch: Partial<ProjectState> }
  | { type: "patchBattery"; patch: Partial<ProjectState["battery"]> }
  | { type: "patchSolar"; patch: Partial<ProjectState["solar"]> }
  | { type: "patchInverter"; patch: Partial<ProjectState["inverter"]> }
  | { type: "patchDistribution"; patch: Partial<ProjectState["distribution"]> }
  | { type: "patchCable"; patch: Partial<ProjectState["cable"]> }
  | { type: "setLayout"; layout: LayoutState }
  | { type: "upsertLibraryComponent"; component: Component }
  | { type: "removeLibraryComponent"; id: string }
  | { type: "load"; state: ProjectState };

function reducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "patchBattery":
      return { ...state, battery: { ...state.battery, ...action.patch } };
    case "patchSolar":
      return { ...state, solar: { ...state.solar, ...action.patch } };
    case "patchInverter":
      return { ...state, inverter: { ...state.inverter, ...action.patch } };
    case "patchDistribution":
      return { ...state, distribution: { ...state.distribution, ...action.patch } };
    case "patchCable":
      return { ...state, cable: { ...state.cable, ...action.patch } };
    case "setLayout":
      return { ...state, layout: action.layout };
    case "upsertLibraryComponent": {
      const exists = state.componentLibrary.some((c) => c.id === action.component.id);
      return {
        ...state,
        componentLibrary: exists
          ? state.componentLibrary.map((c) => (c.id === action.component.id ? action.component : c))
          : [...state.componentLibrary, action.component],
      };
    }
    case "removeLibraryComponent": {
      const removed = new Set(
        state.layout.placements.filter((p) => p.componentId === action.id).map((p) => p.id),
      );
      return {
        ...state,
        componentLibrary: state.componentLibrary.filter((c) => c.id !== action.id),
        layout: {
          ...state.layout,
          placements: state.layout.placements.filter((p) => p.componentId !== action.id),
          runs: state.layout.runs.filter(
            (r) => !removed.has(r.fromPlacementId) && !removed.has(r.toPlacementId),
          ),
        },
      };
    }
    case "load":
      return action.state;
  }
}

const StateContext = createContext<ProjectState | null>(null);
const DispatchContext = createContext<Dispatch<ProjectAction> | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadCurrent);

  useEffect(() => {
    saveCurrent(state);
  }, [state]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useProject(): ProjectState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useProject måste användas inom ProjectProvider.");
  return ctx;
}

export function useProjectDispatch(): Dispatch<ProjectAction> {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("useProjectDispatch måste användas inom ProjectProvider.");
  return ctx;
}

/** Bygger motorns indata från projekt-state. */
export function toDesignInput(s: ProjectState): DesignSystemInput {
  return {
    appliances: s.appliances,
    voltageOverride: s.voltageOverride ?? undefined,
    battery: {
      autonomyDays: s.battery.autonomyDays,
      dod: s.battery.dod,
      tempFactor: s.battery.tempFactor,
      efficiency: s.battery.efficiency,
    },
    solar: {
      peakSunHoursWorstMonth: s.solar.peakSunHoursWorstMonth,
      systemLosses: s.solar.systemLosses,
      snowFactor: s.solar.snowFactor,
    },
    inverter: { hasInductiveLoads: s.inverter.hasInductiveLoads },
    mainCable: { lengthM: s.cable.mainCableLengthM, maxVoltDropPct: s.cable.maxVoltDropPct },
  };
}

/** Härlett resultat: design + BOM, eller ett felmeddelande vid ogiltig indata. */
export interface DesignOutput {
  design: DesignSystemResult | null;
  bom: Bom | null;
  error: string | null;
}

export function useDesign(): DesignOutput {
  const state = useProject();
  return useMemo(() => {
    try {
      const design = designSystem(toDesignInput(state));
      const customs: Component[] = [];
      if (state.battery.selectedComponentId === CUSTOM_BATTERY_ID && state.battery.customBattery) {
        customs.push(buildCustomBattery(state.battery.customBattery, state.battery.chemistry, state.battery.dod));
      }
      if (state.solar.panelComponentId === CUSTOM_PANEL_ID && state.solar.customPanel) {
        customs.push(buildCustomPanel(state.solar.customPanel));
      }
      const components = customs.length ? [...SEED_COMPONENTS, ...customs] : undefined;
      const bom = assembleBom(
        design,
        {
          batteryChemistry: state.battery.chemistry,
          mainCableLengthM: state.cable.mainCableLengthM,
          batteryComponentId: state.battery.selectedComponentId ?? undefined,
          batteryQuantity: state.battery.quantityOverride ?? undefined,
          panelComponentId: state.solar.panelComponentId ?? undefined,
          panelQuantity: state.solar.panelQuantityOverride ?? undefined,
          inverterComponentId: state.inverter.selectedComponentId ?? undefined,
          shuntComponentId: state.distribution.shuntComponentId ?? undefined,
          cableComponentId: state.cable.cableComponentId ?? undefined,
          fuseComponentId: state.cable.fuseComponentId ?? undefined,
        },
        components,
      );
      return { design, bom, error: null };
    } catch (e) {
      return { design: null, bom: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [state]);
}
