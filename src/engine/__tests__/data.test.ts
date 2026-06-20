/**
 * Datavalideringstester (brief §8 lager 3) — komponent-seeden får inte ha
 * orimliga specs, alla priser ska vara ifyllda och id:n unika.
 */
import { describe, it, expect } from "vitest";
import { SEED_COMPONENTS } from "../../data/seed.js";
import type { ComponentType, GreenTechCategory } from "../../data/types.js";

const VALID_TYPES: ComponentType[] = [
  "mppt", "inverter", "battery", "panel", "gx", "cable", "fuse", "busbar", "accessory",
];
const VALID_GREEN: GreenTechCategory[] = ["sol", "batteri", "laddbox", "ingen"];

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

describe("seed-data — generella regler", () => {
  it("har unika id:n", () => {
    const ids = SEED_COMPONENTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("har giltiga typer och grön-kategorier", () => {
    for (const c of SEED_COMPONENTS) {
      expect(VALID_TYPES).toContain(c.typ);
      expect(VALID_GREEN).toContain(c.gronTeknikKategori);
    }
  });

  it("har positivt SEK-pris och icke-tomt modellnamn", () => {
    for (const c of SEED_COMPONENTS) {
      expect(c.prisSek).toBeGreaterThan(0);
      expect(c.modell.trim().length).toBeGreaterThan(0);
    }
  });

  it("har icke-tomt artikelnummer när det anges", () => {
    for (const c of SEED_COMPONENTS) {
      if (c.victronArtikelnr !== undefined) {
        expect(c.victronArtikelnr.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("seed-data — typspecifika specs", () => {
  it("växelriktare har surge ≥ kontinuerlig effekt", () => {
    for (const c of SEED_COMPONENTS.filter((c) => c.typ === "inverter")) {
      const cont = num(c.specs.continuousW);
      const surge = num(c.specs.surgeW);
      expect(cont).toBeGreaterThan(0);
      if (surge !== undefined) expect(surge).toBeGreaterThanOrEqual(cont!);
    }
  });

  it("batterier har rimlig kapacitet och spänning", () => {
    for (const c of SEED_COMPONENTS.filter((c) => c.typ === "battery")) {
      expect(num(c.specs.capacityAh)).toBeGreaterThan(0);
      expect(num(c.specs.energyWh)).toBeGreaterThan(0);
      expect(num(c.specs.nominalVoltageV)).toBeGreaterThan(0);
    }
  });

  it("paneler har Voc > Vmp och positiv Wp", () => {
    for (const c of SEED_COMPONENTS.filter((c) => c.typ === "panel")) {
      const voc = num(c.specs.vocV)!;
      const vmp = num(c.specs.vmpV)!;
      expect(num(c.specs.wp)).toBeGreaterThan(0);
      expect(voc).toBeGreaterThan(vmp);
    }
  });

  it("MPPT har positiv spännings- och strömgräns", () => {
    for (const c of SEED_COMPONENTS.filter((c) => c.typ === "mppt")) {
      expect(num(c.specs.maxPvVoltageV)).toBeGreaterThan(0);
      expect(num(c.specs.maxOutputCurrentA)).toBeGreaterThan(0);
    }
  });
});
