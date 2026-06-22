import { describe, it, expect } from "vitest";
import { designSystem, type DesignSystemInput } from "../../engine/index.js";
import { assembleBom } from "../assembleBom.js";
import { eligibleInverters, eligibleShunts, eligibleCables, eligibleFuses } from "../selection.js";

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

describe("selection — eligible[0] matchar assembleBom:s auto-val", () => {
  for (const [name, input, chem] of [
    ["stuga", stuga, "AGM"],
    ["villa", villa, "LiFePO4"],
  ] as const) {
    const design = designSystem(input);
    const bom = assembleBom(design, { batteryChemistry: chem, mainCableLengthM: input.mainCable.lengthM });

    it(`${name}: växelriktare`, () => {
      const auto = bom.items.find((i) => i.component.typ === "inverter")?.component.id;
      expect(eligibleInverters(design)[0]?.id).toBe(auto);
    });

    it(`${name}: kabel`, () => {
      const auto = bom.items.find((i) => i.component.typ === "cable")?.component.id;
      expect(eligibleCables(design)[0]?.id).toBe(auto);
    });

    it(`${name}: säkring`, () => {
      const auto = bom.items.find((i) => i.component.typ === "fuse")?.component.id;
      expect(eligibleFuses(design)[0]?.id).toBe(auto);
    });

    it(`${name}: shunt`, () => {
      const auto = bom.items.find((i) => i.component.id.startsWith("shunt-"))?.component.id;
      expect(eligibleShunts(design)[0]?.id).toBe(auto);
    });
  }
});

describe("selection — kompatibilitet", () => {
  it("växelriktare filtreras på systemspänning (24 V villa → inga 12 V-modeller)", () => {
    const ids = eligibleInverters(designSystem(villa)).map((c) => c.id);
    expect(ids.every((id) => !id.includes("-12-"))).toBe(true);
    expect(ids).toContain("inverter-multiplus-24-3000-70");
  });

  it("shunt exkluderar accessoarer utan maxCurrentA (VE.Direct/RJ45)", () => {
    const ids = eligibleShunts(designSystem(stuga)).map((c) => c.id);
    expect(ids.every((id) => id.startsWith("shunt-"))).toBe(true);
  });

  it("kablar och säkringar är sorterade stigande (minsta passande först)", () => {
    const design = designSystem(stuga);
    const cables = eligibleCables(design).map((c) => Number(c.specs.areaMm2));
    const fuses = eligibleFuses(design).map((c) => Number(c.specs.ratingA));
    expect(cables).toEqual([...cables].sort((a, b) => a - b));
    expect(fuses).toEqual([...fuses].sort((a, b) => a - b));
  });
});
