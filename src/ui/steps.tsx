/** Guidens steg (1–8 + BOM). Varje steg läser/skriver state och visar motorns
 *  resultat med motivering och varningar. */

import type { Appliance } from "../engine/load.js";
import type { SystemVoltage } from "../engine/units.js";
import type { BatteryChemistry } from "../engine/battery.js";
import { TYPICAL_DOD } from "../engine/battery.js";
import { applianceTemplates, sunRegions } from "../data/templates.js";
import type { TemplateKey } from "../data/templates.js";
import { SEED_COMPONENTS } from "../data/seed.js";
import { CUSTOM_BATTERY_ID, CUSTOM_PANEL_ID } from "../data/customComponents.js";
import { useProject, useProjectDispatch, useDesign } from "../state/projectStore.js";
import { LayoutCanvas } from "../layout/LayoutCanvas.js";
import {
  Section,
  NumberField,
  TextField,
  SelectField,
  SegmentedControl,
  CheckboxField,
  ResultCard,
  BomTable,
  Disclaimer,
  Warnings,
  sek,
  nf,
} from "./components.js";

const r1 = (n: number) => nf(n, 1);
const r0 = (n: number) => nf(n, 0);

const specNum = (c: { specs: Record<string, unknown> }, key: string): number =>
  typeof c.specs[key] === "number" ? (c.specs[key] as number) : 0;

const AUTO = "auto";

/** Batterimodeller, sorterade på kapacitet, för modellväljaren. */
const batteryModelOptions = [
  { value: AUTO, label: "Auto (rekommenderad)" },
  ...SEED_COMPONENTS.filter((c) => c.typ === "battery")
    .sort((a, b) => specNum(a, "capacityAh") - specNum(b, "capacityAh"))
    .map((c) => ({ value: c.id, label: c.modell })),
  { value: CUSTOM_BATTERY_ID, label: "Egen (ange parametrar)" },
];

/** Panelmodeller, sorterade på effekt, för modellväljaren. */
const panelModelOptions = [
  { value: AUTO, label: "Auto (rekommenderad)" },
  ...SEED_COMPONENTS.filter((c) => c.typ === "panel")
    .sort((a, b) => specNum(a, "wp") - specNum(b, "wp"))
    .map((c) => ({ value: c.id, label: c.modell })),
  { value: CUSTOM_PANEL_ID, label: "Egen (ange parametrar)" },
];

/* ------------------------------------------------------------------ Steg 1 */

function ApplianceEditor() {
  const { appliances } = useProject();
  const dispatch = useProjectDispatch();

  const update = (next: Appliance[]) => dispatch({ type: "patch", patch: { appliances: next } });
  const edit = (i: number, patch: Partial<Appliance>) =>
    update(appliances.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  return (
    <table className="appliance-table">
      <thead>
        <tr>
          <th>Apparat</th>
          <th>Effekt (W)</th>
          <th>Tim/dygn</th>
          <th>Antal</th>
          <th>Surge (W)</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {appliances.map((a, i) => (
          <tr key={i}>
            <td>
              <input value={a.name} onChange={(e) => edit(i, { name: e.target.value })} />
            </td>
            <td>
              <input type="number" value={a.watt} min={0} onChange={(e) => edit(i, { watt: Number(e.target.value) })} />
            </td>
            <td>
              <input
                type="number"
                value={a.hoursPerDay}
                min={0}
                step={0.5}
                onChange={(e) => edit(i, { hoursPerDay: Number(e.target.value) })}
              />
            </td>
            <td>
              <input
                type="number"
                value={a.quantity ?? 1}
                min={1}
                onChange={(e) => edit(i, { quantity: Number(e.target.value) })}
              />
            </td>
            <td>
              <input
                type="number"
                value={a.surgeWatt ?? ""}
                min={0}
                placeholder="—"
                onChange={(e) => edit(i, { surgeWatt: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </td>
            <td>
              <button className="link" onClick={() => update(appliances.filter((_, idx) => idx !== i))}>
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={6}>
            <button onClick={() => update([...appliances, { name: "Ny apparat", watt: 0, hoursPerDay: 0 }])}>
              + Lägg till apparat
            </button>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

export function LoadStep() {
  const state = useProject();
  const dispatch = useProjectDispatch();
  const { design, error } = useDesign();

  const loadTemplate = (key: TemplateKey) =>
    dispatch({ type: "patch", patch: { typ: key, appliances: applianceTemplates[key].map((a) => ({ ...a })) } });

  return (
    <Section title="Steg 1 — Behovsanalys / last">
      <div className="row">
        <TextField label="Projektnamn" value={state.namn} onChange={(namn) => dispatch({ type: "patch", patch: { namn } })} />
        <div className="templates">
          <span>Mall:</span>
          <button onClick={() => loadTemplate("stuga")}>Stuga</button>
          <button onClick={() => loadTemplate("husbil")}>Husbil</button>
        </div>
      </div>
      <ApplianceEditor />
      {design && (
        <ResultCard
          rows={[
            { label: "Daglig energi", value: `${r0(design.load.dailyEnergyWh)} Wh/dygn` },
            { label: "Topplast", value: `${r0(design.load.peakLoadW)} W` },
            { label: "Surge (startström)", value: `${r0(design.load.surgeW)} W` },
          ]}
        />
      )}
      {error && <Warnings warnings={[error]} />}
    </Section>
  );
}

/* ------------------------------------------------------------------ Steg 2 */

export function VoltageStep() {
  const state = useProject();
  const dispatch = useProjectDispatch();
  const { design } = useDesign();

  const value = state.voltageOverride === null ? "auto" : String(state.voltageOverride);
  const onChange = (v: string) =>
    dispatch({ type: "patch", patch: { voltageOverride: v === "auto" ? null : (Number(v) as SystemVoltage) } });

  return (
    <Section title="Steg 2 — Systemspänning">
      <SegmentedControl
        label="Systemspänning"
        value={value}
        options={[
          { value: "auto", label: "Auto" },
          { value: "12", label: "12 V" },
          { value: "24", label: "24 V" },
          { value: "48", label: "48 V" },
        ]}
        onChange={onChange}
      />
      {design && (
        <ResultCard
          rows={[
            { label: "Vald spänning", value: `${design.systemVoltage.voltage} V` },
            { label: "Rekommendation", value: `${design.systemVoltage.recommended} V` },
          ]}
          rationale={design.systemVoltage.rationale}
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ Steg 3 */

export function BatteryStep() {
  const state = useProject();
  const dispatch = useProjectDispatch();
  const { design, bom } = useDesign();

  const setChemistry = (chemistry: BatteryChemistry) =>
    dispatch({ type: "patchBattery", patch: { chemistry, dod: TYPICAL_DOD[chemistry] } });

  const setBatteryModel = (id: string) => {
    if (id === AUTO) {
      dispatch({ type: "patchBattery", patch: { selectedComponentId: null } });
      return;
    }
    if (id === CUSTOM_BATTERY_ID) {
      dispatch({
        type: "patchBattery",
        patch: {
          selectedComponentId: id,
          customBattery: state.battery.customBattery ?? { nominalVoltageV: 12, capacityAh: 100, prisSek: 0 },
        },
      });
      return;
    }
    const c = SEED_COMPONENTS.find((x) => x.id === id);
    const chem = c?.specs.chemistry;
    const dod = c?.specs.recommendedDod;
    dispatch({
      type: "patchBattery",
      patch: {
        selectedComponentId: id,
        ...(typeof chem === "string" ? { chemistry: chem as BatteryChemistry } : {}),
        ...(typeof dod === "number" ? { dod } : {}),
      },
    });
  };

  const custom = state.battery.customBattery;
  const patchCustomBattery = (patch: Partial<NonNullable<typeof custom>>) =>
    dispatch({
      type: "patchBattery",
      patch: { customBattery: { ...(custom ?? { nominalVoltageV: 12, capacityAh: 100, prisSek: 0 }), ...patch } },
    });

  const battLine = bom?.items.find((i) => i.component.typ === "battery");

  return (
    <Section title="Steg 3 — Batteribank">
      <div className="grid">
        <SelectField
          label="Batterimodell"
          value={state.battery.selectedComponentId ?? AUTO}
          options={batteryModelOptions}
          onChange={setBatteryModel}
        />
        {state.battery.selectedComponentId === CUSTOM_BATTERY_ID && (
          <>
            <NumberField
              label="Spänning (V)"
              value={custom?.nominalVoltageV ?? 12}
              step={0.1}
              min={0.1}
              suffix="V"
              onChange={(nominalVoltageV) => patchCustomBattery({ nominalVoltageV })}
            />
            <NumberField
              label="Kapacitet (Ah)"
              value={custom?.capacityAh ?? 100}
              min={1}
              suffix="Ah"
              onChange={(capacityAh) => patchCustomBattery({ capacityAh })}
            />
            <NumberField
              label="Pris (kr)"
              value={custom?.prisSek ?? 0}
              min={0}
              suffix="kr"
              onChange={(prisSek) => patchCustomBattery({ prisSek })}
            />
          </>
        )}
        <SelectField<BatteryChemistry>
          label="Batterikemi (för auto)"
          value={state.battery.chemistry}
          options={[
            { value: "LiFePO4", label: "LiFePO4" },
            { value: "AGM", label: "AGM" },
            { value: "GEL", label: "GEL" },
          ]}
          onChange={setChemistry}
        />
        <NumberField
          label="Autonomidagar"
          value={state.battery.autonomyDays}
          min={1}
          onChange={(autonomyDays) => dispatch({ type: "patchBattery", patch: { autonomyDays } })}
        />
        <NumberField
          label="Urladdningsdjup (DoD)"
          value={state.battery.dod}
          step={0.05}
          min={0.1}
          onChange={(dod) => dispatch({ type: "patchBattery", patch: { dod } })}
        />
        <NumberField
          label="Temperaturfaktor"
          value={state.battery.tempFactor}
          step={0.05}
          min={0.1}
          onChange={(tempFactor) => dispatch({ type: "patchBattery", patch: { tempFactor } })}
        />
        <NumberField
          label="Verkningsgrad"
          value={state.battery.efficiency}
          step={0.01}
          min={0.5}
          onChange={(efficiency) => dispatch({ type: "patchBattery", patch: { efficiency } })}
        />
        <NumberField
          label="Antal batterier (0 = auto)"
          value={state.battery.quantityOverride ?? 0}
          min={0}
          onChange={(v) =>
            dispatch({ type: "patchBattery", patch: { quantityOverride: v > 0 ? Math.round(v) : null } })
          }
        />
      </div>
      {design && (
        <ResultCard
          rows={[
            { label: "Kapacitetsbehov", value: `${r0(design.battery.requiredAh)} Ah` },
            { label: "Uttagbar energi", value: `${r0(design.battery.usableEnergyWh)} Wh` },
            ...(battLine
              ? [
                  { label: "Valt batteri", value: `${battLine.quantity} × ${battLine.component.modell}` },
                  { label: "Batterikostnad", value: sek(battLine.lineTotalSek) },
                ]
              : []),
          ]}
          rationale={design.battery.rationale}
          warnings={bom?.warnings.filter((w) => /batteri/i.test(w))}
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ Steg 4 */

export function SolarStep() {
  const state = useProject();
  const dispatch = useProjectDispatch();
  const { design, bom } = useDesign();

  const setRegion = (regionKey: string) => {
    const region = sunRegions[regionKey];
    dispatch({
      type: "patchSolar",
      patch: region
        ? { regionKey, peakSunHoursWorstMonth: region.worstMonthPeakSunHours, snowFactor: region.defaultSnowFactor }
        : { regionKey },
    });
  };

  const setPanelModel = (id: string) => {
    if (id === CUSTOM_PANEL_ID) {
      dispatch({
        type: "patchSolar",
        patch: {
          panelComponentId: id,
          customPanel: state.solar.customPanel ?? { wp: 175, vocV: 22, impA: 8, prisSek: 0 },
        },
      });
      return;
    }
    dispatch({ type: "patchSolar", patch: { panelComponentId: id === AUTO ? null : id } });
  };

  const customPanel = state.solar.customPanel;
  const patchCustomPanel = (patch: Partial<NonNullable<typeof customPanel>>) =>
    dispatch({
      type: "patchSolar",
      patch: { customPanel: { ...(customPanel ?? { wp: 175, vocV: 22, impA: 8, prisSek: 0 }), ...patch } },
    });

  const panelLine = bom?.items.find((i) => i.component.typ === "panel");

  return (
    <Section title="Steg 4 — Solpaneler">
      <div className="grid">
        <SelectField
          label="Panelmodell"
          value={state.solar.panelComponentId ?? AUTO}
          options={panelModelOptions}
          onChange={setPanelModel}
        />
        {state.solar.panelComponentId === CUSTOM_PANEL_ID && (
          <>
            <NumberField
              label="Effekt (W)"
              value={customPanel?.wp ?? 175}
              min={1}
              suffix="W"
              onChange={(wp) => patchCustomPanel({ wp })}
            />
            <NumberField
              label="Spänning Voc (V)"
              value={customPanel?.vocV ?? 22}
              step={0.1}
              min={0.1}
              suffix="V"
              onChange={(vocV) => patchCustomPanel({ vocV })}
            />
            <NumberField
              label="Ström (A)"
              value={customPanel?.impA ?? 8}
              step={0.1}
              min={0.1}
              suffix="A"
              onChange={(impA) => patchCustomPanel({ impA })}
            />
            <NumberField
              label="Pris (kr)"
              value={customPanel?.prisSek ?? 0}
              min={0}
              suffix="kr"
              onChange={(prisSek) => patchCustomPanel({ prisSek })}
            />
          </>
        )}
        <SelectField
          label="Region"
          value={state.solar.regionKey}
          options={Object.entries(sunRegions).map(([k, v]) => ({ value: k, label: v.namn }))}
          onChange={setRegion}
        />
        <NumberField
          label="Soltimmar (värsta månad)"
          value={state.solar.peakSunHoursWorstMonth}
          step={0.1}
          min={0.1}
          suffix="h"
          onChange={(peakSunHoursWorstMonth) => dispatch({ type: "patchSolar", patch: { peakSunHoursWorstMonth } })}
        />
        <NumberField
          label="Systemförluster"
          value={state.solar.systemLosses}
          step={0.05}
          min={0.1}
          onChange={(systemLosses) => dispatch({ type: "patchSolar", patch: { systemLosses } })}
        />
        <NumberField
          label="Snöfaktor"
          value={state.solar.snowFactor}
          step={0.05}
          min={0.1}
          onChange={(snowFactor) => dispatch({ type: "patchSolar", patch: { snowFactor } })}
        />
        <NumberField
          label="Antal paneler (0 = auto)"
          value={state.solar.panelQuantityOverride ?? 0}
          min={0}
          onChange={(v) =>
            dispatch({ type: "patchSolar", patch: { panelQuantityOverride: v > 0 ? Math.round(v) : null } })
          }
        />
      </div>
      {design && (
        <ResultCard
          rows={[
            { label: "Effektbehov", value: `${r0(design.solar.requiredWp)} Wp` },
            ...(panelLine
              ? [
                  { label: "Valda paneler", value: `${panelLine.quantity} × ${panelLine.component.modell}` },
                  { label: "Panelkostnad", value: sek(panelLine.lineTotalSek) },
                ]
              : []),
          ]}
          rationale={design.solar.rationale}
          warnings={bom?.warnings.filter((w) => /panel|solcell/i.test(w))}
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ Steg 5 */

export function InverterStep() {
  const state = useProject();
  const dispatch = useProjectDispatch();
  const { design } = useDesign();

  return (
    <Section title="Steg 5 — Växelriktare">
      <CheckboxField
        label="Induktiva laster (pump, kompressor, motor) — kräver extra surge-marginal"
        checked={state.inverter.hasInductiveLoads}
        onChange={(hasInductiveLoads) => dispatch({ type: "patchInverter", patch: { hasInductiveLoads } })}
      />
      {design && (
        <ResultCard
          rows={[
            { label: "Kontinuerlig effekt", value: `≥ ${r0(design.inverter.requiredContinuousW)} W` },
            { label: "Surge-förmåga", value: `≥ ${r0(design.inverter.requiredSurgeW)} W` },
          ]}
          rationale={design.inverter.rationale}
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ Steg 6 */

export function DistributionStep() {
  const { design } = useDesign();
  return (
    <Section title="Steg 6 — DC-distribution & övervakning">
      {design && (
        <ResultCard
          rows={[
            { label: "Max DC-ström", value: `${r1(design.maxContinuousDcCurrentA)} A` },
            { label: "Busbar/Lynx", value: `≥ ${r0(design.distribution.busbarMinCurrentA)} A` },
            { label: "SmartShunt", value: `${design.distribution.shuntRatingA} A` },
            { label: "GX-enhet", value: design.distribution.recommendGx ? "Rekommenderas" : "—" },
          ]}
          rationale={design.distribution.rationale}
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ Steg 7 */

export function LayoutStep() {
  return (
    <Section title="Steg 7 — Fysisk layout & kabeldragning">
      <p className="hint">
        Rita ytan, placera komponenter i verklig storlek och dra kabel. Längden från ett run kan sättas som
        huvudkabel och matar då Steg 8. (Mallbibliotek och flera zoner kommer senare.)
      </p>
      <LayoutCanvas />
    </Section>
  );
}

/* ------------------------------------------------------------------ Steg 8 */

export function CableStep() {
  const state = useProject();
  const dispatch = useProjectDispatch();
  const { design } = useDesign();
  const cable = design?.mainCable;

  return (
    <Section title="Steg 8 — Kabel & säkring">
      <p className="hint">
        Kabellängd matas in manuellt i v1. Den fysiska layout-planeraren (Steg 7) som ritar dragvägen kommer i en
        senare fas.
      </p>
      <div className="grid">
        <NumberField
          label="Huvudkabel, enkelväg"
          value={state.cable.mainCableLengthM}
          step={0.5}
          min={0}
          suffix="m"
          onChange={(mainCableLengthM) => dispatch({ type: "patchCable", patch: { mainCableLengthM } })}
        />
        <NumberField
          label="Max spänningsfall"
          value={state.cable.maxVoltDropPct}
          step={0.5}
          min={0.5}
          suffix="%"
          onChange={(maxVoltDropPct) => dispatch({ type: "patchCable", patch: { maxVoltDropPct } })}
        />
      </div>
      {cable && (
        <ResultCard
          rows={[
            { label: "Kabelarea", value: cable.area.selectedAreaMm2 ? `${cable.area.selectedAreaMm2} mm²` : "—" },
            { label: "Styrt av", value: cable.area.governedBy ?? "—" },
            {
              label: "Spänningsfall",
              value: cable.area.voltageDrop ? `${r1(cable.area.voltageDrop.pct)} %` : "—",
            },
            {
              label: "Säkring",
              value: cable.fuse.ratingA ? `${cable.fuse.ratingA} A ${cable.fuse.ok ? "✓" : "⚠️"}` : "—",
            },
          ]}
          warnings={[...cable.area.warnings, ...cable.fuse.warnings]}
        />
      )}
    </Section>
  );
}

/* --------------------------------------------------------------------- BOM */

export function BomStep({ onExport, exporting }: { onExport: () => void; exporting: boolean }) {
  const { bom } = useDesign();
  return (
    <Section title="Steg 9 — BOM & offert">
      {bom && (
        <>
          <Warnings warnings={bom.warnings} />
          <BomTable bom={bom} />
          <p className="green-note">
            Grönt avdrag-netto beräknas i installatörsläget (Fas 5). Här visas {sek(bom.greenEligibleSek)} som
            avdragsunderlag (sol + batteri).
          </p>
          <button className="primary" onClick={onExport} disabled={exporting}>
            {exporting ? "Genererar PDF…" : "Exportera PDF"}
          </button>
          <Disclaimer />
        </>
      )}
    </Section>
  );
}
