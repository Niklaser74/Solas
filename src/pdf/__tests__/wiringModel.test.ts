import { describe, it, expect } from "vitest";
import { designSystem, type DesignSystemInput } from "../../engine/index.js";
import { assembleBom } from "../../bom/assembleBom.js";
import type { Bom } from "../../bom/assembleBom.js";
import { buildWiringModel } from "../WiringDiagram.js";

const stuga: DesignSystemInput = {
  appliances: [
    { name: "LED-lampor", watt: 10, hoursPerDay: 4, quantity: 4 },
    { name: "Kylskåp", watt: 45, hoursPerDay: 24, surgeWatt: 135 },
    { name: "TV", watt: 40, hoursPerDay: 3 },
  ],
  battery: { autonomyDays: 3, dod: 0.5, tempFactor: 0.9, efficiency: 0.95 },
  solar: { peakSunHoursWorstMonth: 1.5, systemLosses: 0.75, snowFactor: 0.7 },
  inverter: { hasInductiveLoads: true },
  mainCable: { lengthM: 2.5 },
};

const design = designSystem(stuga);
const bom = assembleBom(design, { batteryChemistry: "AGM", mainCableLengthM: 2.5 });

describe("buildWiringModel", () => {
  it("skapar noder för komponenttyperna i BOM:en", () => {
    const model = buildWiringModel(bom, design);
    const keys = model.nodes.map((n) => n.key);
    expect(keys).toContain("panel");
    expect(keys).toContain("mppt");
    expect(keys).toContain("battery");
    expect(keys).toContain("inverter");
    expect(keys).toContain("dcbus");
    expect(model.voltage).toBe(design.systemVoltage.voltage);
  });

  it("annoterar batteri→skena med huvudsäkring och kabelarea", () => {
    const model = buildWiringModel(bom, design);
    const edge = model.edges.find((e) => e.from === "battery" && e.to === "dcbus");
    expect(edge).toBeTruthy();
    expect(edge?.label).toMatch(/Huvudsäkring/);
    if (design.mainCable.fuse.ratingA) {
      expect(edge?.label).toContain(`${design.mainCable.fuse.ratingA} A`);
    }
    if (design.mainCable.area.selectedAreaMm2) {
      expect(edge?.label).toContain(`${design.mainCable.area.selectedAreaMm2} mm²`);
    }
  });

  it("utelämnar noder som saknas i BOM:en", () => {
    const noSolar: Bom = { ...bom, items: bom.items.filter((i) => i.component.typ !== "panel") };
    const model = buildWiringModel(noSolar, design);
    expect(model.nodes.map((n) => n.key)).not.toContain("panel");
    // Ingen kant kan referera en saknad nod.
    for (const e of model.edges) {
      const keys = new Set(model.nodes.map((n) => n.key));
      expect(keys.has(e.from) && keys.has(e.to)).toBe(true);
    }
  });
});
