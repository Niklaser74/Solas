import { describe, it, expect } from "vitest";
import { designSystem, type DesignSystemInput } from "../../engine/index.js";
import { assembleBom } from "../assembleBom.js";

const stuga: DesignSystemInput = {
  appliances: [
    { name: "LED-lampor", watt: 10, hoursPerDay: 4, quantity: 4 },
    { name: "Kylskåp", watt: 45, hoursPerDay: 24, surgeWatt: 135 },
    { name: "Vattenpump", watt: 50, hoursPerDay: 0.5, surgeWatt: 150 },
    { name: "TV", watt: 40, hoursPerDay: 3 },
    { name: "Laddare", watt: 30, hoursPerDay: 2 },
  ],
  battery: { autonomyDays: 3, dod: 0.5, tempFactor: 0.9, efficiency: 0.95 },
  solar: { peakSunHoursWorstMonth: 1.5, systemLosses: 0.75, snowFactor: 0.7 },
  inverter: { hasInductiveLoads: true },
  mainCable: { lengthM: 2.5 },
};

const husbil: DesignSystemInput = {
  appliances: [
    { name: "Kompressorkyl", watt: 50, hoursPerDay: 12, surgeWatt: 150 },
    { name: "LED-spots", watt: 8, hoursPerDay: 5, quantity: 6 },
    { name: "Vattenpump", watt: 70, hoursPerDay: 0.3, surgeWatt: 210 },
    { name: "USB/laddare", watt: 60, hoursPerDay: 2 },
    { name: "Mikrovågsugn", watt: 700, hoursPerDay: 0.1 },
  ],
  battery: { autonomyDays: 2, dod: 0.8, tempFactor: 0.95, efficiency: 0.95 },
  solar: { peakSunHoursWorstMonth: 3, systemLosses: 0.75 },
  inverter: { hasInductiveLoads: true },
  mainCable: { lengthM: 1.5 },
};

const villa: DesignSystemInput = {
  appliances: [
    { name: "Kyl/frys", watt: 120, hoursPerDay: 24 },
    { name: "Belysning", watt: 200, hoursPerDay: 5 },
    { name: "Uttag diverse", watt: 300, hoursPerDay: 4 },
    { name: "Vattenpump", watt: 800, hoursPerDay: 1, surgeWatt: 2400 },
    { name: "Tvättmaskin", watt: 500, hoursPerDay: 1, surgeWatt: 1500 },
  ],
  battery: { autonomyDays: 1, dod: 0.8, tempFactor: 1.0, efficiency: 0.95 },
  solar: { peakSunHoursWorstMonth: 2.5, systemLosses: 0.75, snowFactor: 0.9 },
  inverter: { hasInductiveLoads: true },
  mainCable: { lengthM: 2 },
};

describe("assembleBom — Stuga AGM (handräknat facit)", () => {
  const bom = assembleBom(designSystem(stuga), { batteryChemistry: "AGM", mainCableLengthM: 2.5 });

  it("har inga varningar", () => {
    expect(bom.warnings).toEqual([]);
  });

  it("väljer 8 AGM-batterier (845 Ah / 110 Ah)", () => {
    const batt = bom.items.find((i) => i.component.typ === "battery");
    expect(batt?.quantity).toBe(8);
    expect(batt?.component.specs.chemistry).toBe("AGM");
  });

  it("väljer 11 paneler (1835 Wp / 175 Wp)", () => {
    const panel = bom.items.find((i) => i.component.typ === "panel");
    expect(panel?.quantity).toBe(11);
  });

  it("väljer minsta passande växelriktare (Phoenix 1200)", () => {
    const inv = bom.items.find((i) => i.component.typ === "inverter");
    expect(inv?.component.id).toBe("inverter-phoenix-12-1200");
  });

  it("kabel som metervara dubblas (fram + retur)", () => {
    const cable = bom.items.find((i) => i.component.typ === "cable");
    expect(cable?.quantity).toBe(5); // ceil(2.5 × 2)
  });

  it("har 8 rader, korrekt total och grönt underlag", () => {
    expect(bom.items).toHaveLength(8);
    expect(bom.totalSek).toBe(44689);
    expect(bom.greenEligibleSek).toBe(36205); // batteri + paneler + MPPT
  });
});

describe("assembleBom — Husbil LiFePO4", () => {
  const bom = assembleBom(designSystem(husbil), { batteryChemistry: "LiFePO4", mainCableLengthM: 1.5 });

  it("är komplett utan varningar", () => {
    expect(bom.warnings).toEqual([]);
    expect(bom.totalSek).toBeGreaterThan(0);
  });

  it("väljer 3 LiFePO4-batterier (242.6 Ah / 100 Ah)", () => {
    const batt = bom.items.find((i) => i.component.typ === "battery");
    expect(batt?.quantity).toBe(3);
  });

  it("väljer 50 mm² kabel och 150 A säkring", () => {
    expect(bom.items.find((i) => i.component.typ === "cable")?.component.id).toBe("cable-50mm2");
    expect(bom.items.find((i) => i.component.typ === "fuse")?.component.id).toBe("fuse-mega-150");
  });
});

describe("assembleBom — Liten villa (24 V)", () => {
  const bom = assembleBom(designSystem(villa), { batteryChemistry: "LiFePO4", mainCableLengthM: 2 });

  it("ger positiv total och rader", () => {
    expect(bom.totalSek).toBeGreaterThan(0);
    expect(bom.items.length).toBeGreaterThan(0);
  });

  it("väljer 24 V-växelriktaren", () => {
    expect(bom.items.find((i) => i.component.typ === "inverter")?.component.id).toBe(
      "inverter-multiplus-24-3000-70",
    );
  });

  it("flaggar att panelströmmen kräver mer än en MPPT", () => {
    expect(bom.warnings.some((w) => /MPPT/.test(w))).toBe(true);
    const mppt = bom.items.find((i) => i.component.typ === "mppt");
    expect(mppt?.quantity).toBeGreaterThanOrEqual(2);
  });
});
