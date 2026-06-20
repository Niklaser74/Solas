import { describe, it, expect } from "vitest";
import { sizeSolar, mpptCheck } from "../solar.js";

describe("sizeSolar", () => {
  it("räknar Wp enligt formeln (handräknat facit)", () => {
    const r = sizeSolar({ dailyEnergyWh: 1110, peakSunHoursWorstMonth: 2, systemLosses: 0.75, snowFactor: 1 });
    // 1110 / (2 × 0.75 × 1) = 740 Wp
    expect(r.requiredWp).toBeCloseTo(740, 6);
  });

  it("ökar Wp-behovet med snöfaktor", () => {
    const r = sizeSolar({ dailyEnergyWh: 1110, peakSunHoursWorstMonth: 2, systemLosses: 0.75, snowFactor: 0.8 });
    // 1110 / (2 × 0.75 × 0.8) = 925 Wp
    expect(r.requiredWp).toBeCloseTo(925, 6);
  });

  it("avvisar noll soltimmar", () => {
    expect(() => sizeSolar({ dailyEnergyWh: 1000, peakSunHoursWorstMonth: 0 })).toThrow(RangeError);
  });
});

describe("mpptCheck", () => {
  it("godkänner ett arrangemang inom MPPT-fönstret", () => {
    const r = mpptCheck({ panelVoc: 22.6, panelImp: 8.5, series: 3, parallel: 1, mpptMaxV: 100, mpptMaxA: 30 });
    expect(r.arrayVoc).toBeCloseTo(67.8, 6);
    expect(r.ok).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });

  it("flaggar för hög spänning", () => {
    const r = mpptCheck({ panelVoc: 22.6, panelImp: 8.5, series: 5, parallel: 1, mpptMaxV: 100, mpptMaxA: 30 });
    expect(r.voltageOk).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/Voc/);
  });

  it("flaggar för hög ström", () => {
    const r = mpptCheck({ panelVoc: 22.6, panelImp: 8.5, series: 3, parallel: 4, mpptMaxV: 100, mpptMaxA: 30 });
    expect(r.currentOk).toBe(false);
    expect(r.ok).toBe(false);
  });
});
