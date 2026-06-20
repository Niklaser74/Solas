import { describe, it, expect } from "vitest";
import { actualVoltageDrop, requiredCableArea, selectFuse, sizeCableSegment } from "../cable.js";

describe("actualVoltageDrop", () => {
  it("dubblar längden för fram + retur (handräknat facit)", () => {
    const r = actualVoltageDrop({ areaMm2: 25, currentA: 130, lengthM: 3, systemVoltage: 12 });
    // (2 × 3 × 130 × 0.0175) / 25 = 13.65 / 25 = 0.546 V
    expect(r.volts).toBeCloseTo(0.546, 6);
    expect(r.pct).toBeCloseTo(4.55, 4); // 0.546 / 12 × 100
  });
});

describe("requiredCableArea", () => {
  it("väljer area styrd av spänningsfall", () => {
    const r = requiredCableArea({ currentA: 40, lengthM: 5, systemVoltage: 12, maxVoltDropPct: 3 });
    // minArea = (2 × 5 × 40 × 0.0175) / 0.36 = 19.44 → IEC 25 mm²
    expect(r.minAreaForVoltDropMm2).toBeCloseTo(19.444, 2);
    expect(r.selectedAreaMm2).toBe(25);
    expect(r.governedBy).toBe("voltdrop");
    expect(r.selectedAmpacityA).toBe(115);
    expect(r.voltageDrop?.pct).toBeLessThan(3);
  });

  it("väljer area styrd av ampacitet vid kort längd", () => {
    const r = requiredCableArea({ currentA: 100, lengthM: 1, systemVoltage: 24, maxVoltDropPct: 3 });
    // voltdrop kräver bara ~6 mm², men 100 A kräver minst 25 mm² (115 A)
    expect(r.selectedAreaMm2).toBe(25);
    expect(r.governedBy).toBe("ampacity");
  });

  it("returnerar null + varning när inget tvärsnitt räcker", () => {
    const r = requiredCableArea({ currentA: 50, lengthM: 100, systemVoltage: 12, maxVoltDropPct: 3 });
    expect(r.selectedAreaMm2).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("selectFuse", () => {
  it("väljer säkring ≥ 1.25 × ström och ≤ ampacitet", () => {
    const r = selectFuse({ currentA: 40, cableAmpacityA: 115 });
    expect(r.ratingA).toBe(50); // nästa standard ≥ 50
    expect(r.ok).toBe(true);
  });

  it("flaggar när säkringen överstiger kabelns ampacitet", () => {
    const r = selectFuse({ currentA: 100, cableAmpacityA: 115 });
    // 1.25 × 100 = 125 > 115 → säkringen skyddar inte kabeln
    expect(r.ratingA).toBe(125);
    expect(r.ok).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("sizeCableSegment", () => {
  it("dimensionerar kabeln så att säkringen skyddar den", () => {
    // 148 A → säkring 200 A → kabeln måste ha ampacitet ≥ 200 → 70 mm²
    const r = sizeCableSegment({ currentA: 148, lengthM: 2, systemVoltage: 12, maxVoltDropPct: 3 });
    expect(r.fuse.ratingA).toBe(200);
    expect(r.area.selectedAreaMm2).toBe(70);
    expect(r.area.governedBy).toBe("ampacity");
    expect(r.fuse.ok).toBe(true);
    expect(r.area.voltageDrop?.pct).toBeLessThan(3);
  });
});
