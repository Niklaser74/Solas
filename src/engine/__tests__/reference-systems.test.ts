/**
 * Integrationstester — hela pipelinen last → BOM-underlag för referenssystem
 * (brief §8 lager 2). Värdena är handräknade facit; se kommentarer.
 */
import { describe, it, expect } from "vitest";
import { designSystem, type DesignSystemInput } from "../index.js";

describe("Referenssystem 1 — Stuga AGM (12 V)", () => {
  const input: DesignSystemInput = {
    appliances: [
      { name: "LED-lampor", watt: 10, hoursPerDay: 4, quantity: 4 }, // 160 Wh, 40 W
      { name: "Kylskåp", watt: 45, hoursPerDay: 24, surgeWatt: 135 }, // 1080 Wh, 45 W
      { name: "Vattenpump", watt: 50, hoursPerDay: 0.5, surgeWatt: 150 }, // 25 Wh, 50 W, surgeΔ 100
      { name: "TV", watt: 40, hoursPerDay: 3 }, // 120 Wh, 40 W
      { name: "Laddare", watt: 30, hoursPerDay: 2 }, // 60 Wh, 30 W
    ],
    battery: { autonomyDays: 3, dod: 0.5, tempFactor: 0.9, efficiency: 0.95 },
    solar: { peakSunHoursWorstMonth: 1.5, systemLosses: 0.75, snowFactor: 0.7 },
    inverter: { hasInductiveLoads: true },
    mainCable: { lengthM: 2.5 },
  };

  const r = designSystem(input);

  it("last", () => {
    expect(r.load.dailyEnergyWh).toBe(1445);
    expect(r.load.peakLoadW).toBe(205);
    expect(r.load.surgeW).toBe(305);
  });

  it("systemspänning 12 V", () => {
    expect(r.systemVoltage.voltage).toBe(12);
  });

  it("batteri AGM ~845 Ah", () => {
    // (1445 × 3) / (12 × 0.5 × 0.9 × 0.95) = 4335 / 5.13
    expect(r.battery.requiredAh).toBeCloseTo(845.03, 1);
  });

  it("sol ~1835 Wp", () => {
    // 1445 / (1.5 × 0.75 × 0.7) = 1445 / 0.7875
    expect(r.solar.requiredWp).toBeCloseTo(1834.92, 1);
  });

  it("växelriktare", () => {
    expect(r.inverter.requiredContinuousW).toBeCloseTo(256.25, 2); // 205 × 1.25
    expect(r.inverter.requiredSurgeW).toBeCloseTo(396.5, 2); // 305 × 1.3
  });

  it("huvudkabel + säkring", () => {
    expect(r.maxContinuousDcCurrentA).toBeCloseTo(23.727, 2);
    expect(r.mainCable.area.selectedAreaMm2).toBe(6);
    expect(r.mainCable.fuse.ratingA).toBe(30);
    expect(r.mainCable.fuse.ok).toBe(true);
  });
});

describe("Referenssystem 2 — Husbil LiFePO4 (12 V)", () => {
  const input: DesignSystemInput = {
    appliances: [
      { name: "Kompressorkyl", watt: 50, hoursPerDay: 12, surgeWatt: 150 }, // 600 Wh, surgeΔ 100
      { name: "LED-spots", watt: 8, hoursPerDay: 5, quantity: 6 }, // 240 Wh, 48 W
      { name: "Vattenpump", watt: 70, hoursPerDay: 0.3, surgeWatt: 210 }, // 21 Wh, surgeΔ 140
      { name: "USB/laddare", watt: 60, hoursPerDay: 2 }, // 120 Wh
      { name: "Mikrovågsugn", watt: 700, hoursPerDay: 0.1 }, // 70 Wh
    ],
    battery: { autonomyDays: 2, dod: 0.8, tempFactor: 0.95, efficiency: 0.95 },
    solar: { peakSunHoursWorstMonth: 3, systemLosses: 0.75 },
    inverter: { hasInductiveLoads: true },
    mainCable: { lengthM: 1.5 },
  };

  const r = designSystem(input);

  it("last", () => {
    expect(r.load.dailyEnergyWh).toBe(1051);
    expect(r.load.peakLoadW).toBe(928);
    expect(r.load.surgeW).toBe(1068); // 928 + 140
  });

  it("systemspänning 12 V", () => {
    expect(r.systemVoltage.voltage).toBe(12);
  });

  it("batteri LiFePO4 ~242.6 Ah", () => {
    // (1051 × 2) / (12 × 0.8 × 0.95 × 0.95) = 2102 / 8.664
    expect(r.battery.requiredAh).toBeCloseTo(242.61, 1);
  });

  it("växelriktare 1160 W kontinuerligt", () => {
    expect(r.inverter.requiredContinuousW).toBeCloseTo(1160, 2); // 928 × 1.25
  });

  it("huvudkabel styrd av säkring (50 mm², 150 A)", () => {
    expect(r.maxContinuousDcCurrentA).toBeCloseTo(107.41, 1);
    expect(r.mainCable.area.selectedAreaMm2).toBe(50);
    expect(r.mainCable.area.governedBy).toBe("ampacity");
    expect(r.mainCable.fuse.ratingA).toBe(150);
    expect(r.mainCable.fuse.ok).toBe(true);
  });
});

describe("Referenssystem 3 — Liten villa (24 V)", () => {
  const input: DesignSystemInput = {
    appliances: [
      { name: "Kyl/frys", watt: 120, hoursPerDay: 24 }, // 2880 Wh
      { name: "Belysning", watt: 200, hoursPerDay: 5 }, // 1000 Wh
      { name: "Uttag diverse", watt: 300, hoursPerDay: 4 }, // 1200 Wh
      { name: "Vattenpump", watt: 800, hoursPerDay: 1, surgeWatt: 2400 }, // 800 Wh, surgeΔ 1600
      { name: "Tvättmaskin", watt: 500, hoursPerDay: 1, surgeWatt: 1500 }, // 500 Wh, surgeΔ 1000
    ],
    battery: { autonomyDays: 1, dod: 0.8, tempFactor: 1.0, efficiency: 0.95 },
    solar: { peakSunHoursWorstMonth: 2.5, systemLosses: 0.75, snowFactor: 0.9 },
    inverter: { hasInductiveLoads: true },
    mainCable: { lengthM: 2 },
  };

  const r = designSystem(input);

  it("last", () => {
    expect(r.load.dailyEnergyWh).toBe(6380);
    expect(r.load.peakLoadW).toBe(1920);
    expect(r.load.surgeW).toBe(3520); // 1920 + 1600
  });

  it("systemspänning 24 V (1500–3000 W)", () => {
    expect(r.systemVoltage.voltage).toBe(24);
  });

  it("batteri ~349.8 Ah", () => {
    // 6380 / (24 × 0.8 × 1.0 × 0.95) = 6380 / 18.24
    expect(r.battery.requiredAh).toBeCloseTo(349.78, 1);
  });

  it("växelriktare 2400 W kontinuerligt", () => {
    expect(r.inverter.requiredContinuousW).toBeCloseTo(2400, 2); // 1920 × 1.25
  });

  it("huvudkabel 50 mm² / 150 A", () => {
    expect(r.maxContinuousDcCurrentA).toBeCloseTo(111.11, 1);
    expect(r.mainCable.area.selectedAreaMm2).toBe(50);
    expect(r.mainCable.fuse.ratingA).toBe(150);
    expect(r.mainCable.fuse.ok).toBe(true);
  });
});
