import { describe, it, expect } from "vitest";
import { selectInverter } from "../inverter.js";

describe("selectInverter", () => {
  it("räknar kontinuerlig effekt och surge med induktiva laster (facit)", () => {
    const r = selectInverter({ peakLoadW: 130, surgeW: 250, continuousMargin: 1.25, hasInductiveLoads: true });
    expect(r.requiredContinuousW).toBeCloseTo(162.5, 6); // 130 × 1.25
    expect(r.requiredSurgeW).toBeCloseTo(325, 6); // max(250 × 1.3, 162.5)
  });

  it("utan induktiva laster används surge oförändrat", () => {
    const r = selectInverter({ peakLoadW: 130, surgeW: 250, continuousMargin: 1.25, hasInductiveLoads: false });
    expect(r.requiredSurgeW).toBeCloseTo(250, 6);
  });

  it("surge underskrider aldrig kontinuerlig effekt", () => {
    const r = selectInverter({ peakLoadW: 1000, surgeW: 1000, continuousMargin: 1.25, hasInductiveLoads: false });
    expect(r.requiredSurgeW).toBeGreaterThanOrEqual(r.requiredContinuousW);
  });

  it("avvisar surge mindre än topplast", () => {
    expect(() => selectInverter({ peakLoadW: 200, surgeW: 100 })).toThrow(RangeError);
  });
});
