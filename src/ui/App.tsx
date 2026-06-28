/** Dimensas guide — stepper-wizard genom steg 1→8 + BOM. */

import { useState } from "react";
import { useProject, useDesign } from "../state/projectStore.js";
import { usePdfExport } from "../pdf/usePdfExport.js";
import { Logo } from "./Logo.js";
import {
  LoadStep,
  VoltageStep,
  BatteryStep,
  SolarStep,
  InverterStep,
  DistributionStep,
  LayoutStep,
  CableStep,
  BomStep,
} from "./steps.js";

const STEPS = [
  "Last",
  "Spänning",
  "Batteri",
  "Sol",
  "Växelriktare",
  "DC-distribution",
  "Layout",
  "Kabel & säkring",
  "BOM & offert",
];

export function App() {
  const [step, setStep] = useState(0);
  const project = useProject();
  const { design, bom } = useDesign();
  const { exportPdf, exporting } = usePdfExport();

  const onExport = (opts?: { wiring?: boolean; mounting?: boolean }) => {
    if (design && bom) {
      void exportPdf({
        namn: project.namn,
        typ: project.typ,
        design,
        bom,
        layout: project.layout,
        componentLibrary: project.componentLibrary,
        includeWiring: opts?.wiring ?? false,
        includeMounting: opts?.mounting ?? false,
        watermark: true,
      });
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <Logo />
        <span className="tagline">Victron systemdesigner — last → BOM</span>
      </header>

      <nav className="stepper">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={`step-chip${i === step ? " active" : ""}${i < step ? " done" : ""}`}
            onClick={() => setStep(i)}
          >
            <span className="step-no">{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {step === 0 && <LoadStep />}
        {step === 1 && <VoltageStep />}
        {step === 2 && <BatteryStep />}
        {step === 3 && <SolarStep />}
        {step === 4 && <InverterStep />}
        {step === 5 && <DistributionStep />}
        {step === 6 && <LayoutStep />}
        {step === 7 && <CableStep />}
        {step === 8 && <BomStep onExport={onExport} exporting={exporting} />}
      </main>

      <footer className="app-footer">
        <button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          ← Föregående
        </button>
        <span className="step-count">
          Steg {step + 1} av {STEPS.length}
        </span>
        <button disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
          Nästa →
        </button>
      </footer>
    </div>
  );
}
