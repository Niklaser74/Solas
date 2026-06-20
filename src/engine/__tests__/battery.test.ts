import { describe, it, expect } from "vitest";
import { sizeBattery } from "../battery.js";

describe("sizeBattery", () => {
  it("räknar Ah enligt formeln (handräknat facit)", () => {
    const r = sizeBattery({
      dailyEnergyWh: 1110,
      systemVoltage: 12,
      autonomyDays: 2,
      dod: 0.5,
      tempFactor: 1,
      efficiency: 1,
    });
    // (1110 × 2) / (12 × 0.5 × 1 × 1) = 2220 / 6 = 370 Ah
    expect(r.requiredAh).toBeCloseTo(370, 6);
    expect(r.nominalEnergyWh).toBeCloseTo(4440, 6);
    expect(r.usableEnergyWh).toBeCloseTo(2220, 6);
  });

  it("ger mindre bank för högre DoD (LiFePO4)", () => {
    const r = sizeBattery({
      dailyEnergyWh: 1110,
      systemVoltage: 12,
      autonomyDays: 2,
      dod: 0.8,
      tempFactor: 1,
      efficiency: 1,
    });
    // 2220 / (12 × 0.8) = 231.25 Ah
    expect(r.requiredAh).toBeCloseTo(231.25, 6);
  });

  it("ökar kravet vid kall temperaturderating", () => {
    const warm = sizeBattery({ dailyEnergyWh: 1000, systemVoltage: 12, autonomyDays: 2, dod: 0.8 });
    const cold = sizeBattery({ dailyEnergyWh: 1000, systemVoltage: 12, autonomyDays: 2, dod: 0.8, tempFactor: 0.8 });
    expect(cold.requiredAh).toBeGreaterThan(warm.requiredAh);
  });

  it("avvisar ogiltiga parametrar", () => {
    expect(() => sizeBattery({ dailyEnergyWh: 1000, systemVoltage: 12, autonomyDays: 0, dod: 0.5 })).toThrow(RangeError);
    expect(() => sizeBattery({ dailyEnergyWh: 1000, systemVoltage: 12, autonomyDays: 2, dod: 1.5 })).toThrow(RangeError);
  });
});
