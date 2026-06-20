import { describe, it, expect } from "vitest";
import { analyzeLoad, type Appliance } from "../load.js";

const appliances: Appliance[] = [
  { name: "LED-lampor", watt: 10, hoursPerDay: 4, quantity: 3 }, // 120 Wh, 30 W
  { name: "Kylskåp", watt: 40, hoursPerDay: 24, surgeWatt: 120 }, // 960 Wh, 40 W, surgeΔ 80
  { name: "Vattenpump", watt: 60, hoursPerDay: 0.5, surgeWatt: 180 }, // 30 Wh, 60 W, surgeΔ 120
];

describe("analyzeLoad", () => {
  it("summerar daglig energi, topplast och surge (handräknat facit)", () => {
    const r = analyzeLoad(appliances);
    expect(r.dailyEnergyWh).toBe(1110);
    expect(r.peakLoadW).toBe(130);
    // surge = peak (130) + största startström-överskott (180-60 = 120)
    expect(r.surgeW).toBe(250);
  });

  it("tillämpar samtidighetsfaktor på topplast", () => {
    const r = analyzeLoad(appliances, { simultaneityFactor: 0.5 });
    expect(r.peakLoadW).toBe(65);
    expect(r.surgeW).toBe(185); // 65 + 120
    expect(r.dailyEnergyWh).toBe(1110); // energi påverkas inte
  });

  it("hanterar tom lista", () => {
    expect(analyzeLoad([])).toEqual({ dailyEnergyWh: 0, peakLoadW: 0, surgeW: 0 });
  });

  it("avvisar ogiltig samtidighetsfaktor", () => {
    expect(() => analyzeLoad(appliances, { simultaneityFactor: 0 })).toThrow(RangeError);
    expect(() => analyzeLoad(appliances, { simultaneityFactor: 1.5 })).toThrow(RangeError);
  });
});
