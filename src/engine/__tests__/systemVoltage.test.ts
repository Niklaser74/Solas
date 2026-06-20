import { describe, it, expect } from "vitest";
import { recommendSystemVoltage } from "../systemVoltage.js";

describe("recommendSystemVoltage", () => {
  it("följer tumregeln för trösklarna", () => {
    expect(recommendSystemVoltage(1000).recommended).toBe(12);
    expect(recommendSystemVoltage(1499).recommended).toBe(12);
    expect(recommendSystemVoltage(1500).recommended).toBe(24);
    expect(recommendSystemVoltage(3000).recommended).toBe(24);
    expect(recommendSystemVoltage(3001).recommended).toBe(48);
  });

  it("respekterar override och markerar den", () => {
    const r = recommendSystemVoltage(1000, 24);
    expect(r.voltage).toBe(24);
    expect(r.recommended).toBe(12);
    expect(r.overridden).toBe(true);
  });

  it("markerar inte override som lika med rekommendationen", () => {
    const r = recommendSystemVoltage(1000, 12);
    expect(r.overridden).toBe(false);
  });

  it("avvisar negativ effekt", () => {
    expect(() => recommendSystemVoltage(-1)).toThrow(RangeError);
  });
});
