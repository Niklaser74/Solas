import { describe, it, expect } from "vitest";
import { designSystem, type DesignSystemInput } from "../../engine/index.js";
import { assembleBom, veDirectCablePlan } from "../assembleBom.js";
import { SEED_COMPONENTS } from "../../data/seed.js";
import {
  buildCustomBattery,
  buildCustomPanel,
  CUSTOM_BATTERY_ID,
  CUSTOM_PANEL_ID,
} from "../../data/customComponents.js";

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

  it("väljer minsta passande shunt (SmartShunt 300A)", () => {
    const shunt = bom.items.find((i) => i.component.id.startsWith("shunt-"));
    expect(shunt?.component.id).toBe("shunt-smartshunt-300");
  });

  it("har 9 rader, korrekt total och grönt underlag", () => {
    expect(bom.items).toHaveLength(9); // + VE.Direct-kabel
    expect(bom.totalSek).toBe(44727); // 44927 − 200 (300A-shunt 990 i st. f. 500A 1190)
    expect(bom.greenEligibleSek).toBe(36205); // batteri + paneler + MPPT (VE.Direct = ingen)
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

describe("assembleBom — manuellt val", () => {
  const design = designSystem(stuga); // AGM, requiredAh ≈ 845

  it("använder vald batterimodell istället för auto", () => {
    const bom = assembleBom(design, {
      batteryChemistry: "AGM",
      mainCableLengthM: 2.5,
      batteryComponentId: "battery-lifepo4-12-200",
    });
    const batt = bom.items.find((i) => i.component.typ === "battery");
    expect(batt?.component.id).toBe("battery-lifepo4-12-200");
    // 845 Ah / 200 Ah → 5 st (12 V, serie 1)
    expect(batt?.quantity).toBe(5);
  });

  it("respekterar manuellt antal och varnar vid underdimension", () => {
    const bom = assembleBom(design, {
      batteryChemistry: "AGM",
      mainCableLengthM: 2.5,
      batteryComponentId: "battery-lifepo4-12-200",
      batteryQuantity: 2,
    });
    const batt = bom.items.find((i) => i.component.typ === "battery");
    expect(batt?.quantity).toBe(2);
    expect(bom.warnings.some((w) => /Batteribanken ger/.test(w))).toBe(true);
  });

  it("använder vald panelmodell", () => {
    const bom = assembleBom(design, {
      batteryChemistry: "AGM",
      mainCableLengthM: 2.5,
      panelComponentId: "panel-mono-350",
    });
    const panel = bom.items.find((i) => i.component.typ === "panel");
    expect(panel?.component.id).toBe("panel-mono-350");
    // 1835 Wp / 350 Wp → 6 st
    expect(panel?.quantity).toBe(6);
  });

  it("respekterar manuellt panelantal och varnar vid underdimension", () => {
    const bom = assembleBom(design, {
      batteryChemistry: "AGM",
      mainCableLengthM: 2.5,
      panelQuantity: 2,
    });
    const panel = bom.items.find((i) => i.component.typ === "panel");
    expect(panel?.quantity).toBe(2);
    expect(bom.warnings.some((w) => /Solcellseffekten/.test(w))).toBe(true);
  });
});

describe("assembleBom — egna parametrar", () => {
  const design = designSystem(stuga); // AGM, requiredAh ≈ 845, requiredWp ≈ 1835

  it("använder eget batteri med angivna parametrar och pris", () => {
    const custom = buildCustomBattery({ nominalVoltageV: 12, capacityAh: 250, prisSek: 9000 }, "LiFePO4", 0.8);
    const bom = assembleBom(
      design,
      { batteryChemistry: "AGM", mainCableLengthM: 2.5, batteryComponentId: CUSTOM_BATTERY_ID },
      [...SEED_COMPONENTS, custom],
    );
    const batt = bom.items.find((i) => i.component.typ === "battery");
    expect(batt?.component.id).toBe(CUSTOM_BATTERY_ID);
    // 845 Ah / 250 Ah → 4 st (12 V, serie 1), 4 × 9000 kr
    expect(batt?.quantity).toBe(4);
    expect(batt?.lineTotalSek).toBe(36000);
  });

  it("använder egen panel med angiven effekt och pris", () => {
    const custom = buildCustomPanel({ wp: 400, vocV: 45, impA: 10, prisSek: 2500 });
    const bom = assembleBom(
      design,
      { batteryChemistry: "AGM", mainCableLengthM: 2.5, panelComponentId: CUSTOM_PANEL_ID },
      [...SEED_COMPONENTS, custom],
    );
    const panel = bom.items.find((i) => i.component.typ === "panel");
    expect(panel?.component.id).toBe(CUSTOM_PANEL_ID);
    // 1835 Wp / 400 Wp → 5 st, 5 × 2500 kr
    expect(panel?.quantity).toBe(5);
    expect(panel?.lineTotalSek).toBe(12500);
  });
});

describe("assembleBom — byt komponent (manuella val utöver batteri/panel)", () => {
  const design = designSystem(stuga); // 12 V, väljer Phoenix 1200 / minsta kabel & säkring
  const base = { batteryChemistry: "AGM" as const, mainCableLengthM: 2.5 };

  it("använder vald växelriktarmodell istället för minsta passande", () => {
    const bom = assembleBom(design, { ...base, inverterComponentId: "inverter-multiplus-12-1600-70" });
    expect(bom.items.find((i) => i.component.typ === "inverter")?.component.id).toBe(
      "inverter-multiplus-12-1600-70",
    );
  });

  it("använder vald shuntmodell istället för minsta passande", () => {
    const bom = assembleBom(design, { ...base, shuntComponentId: "shunt-smartshunt-500" });
    const shunt = bom.items.find((i) => i.component.id.startsWith("shunt-"));
    expect(shunt?.component.id).toBe("shunt-smartshunt-500");
  });

  it("använder vald kabel- och säkringsmodell", () => {
    const bom = assembleBom(design, {
      ...base,
      cableComponentId: "cable-70mm2",
      fuseComponentId: "fuse-mega-200",
    });
    expect(bom.items.find((i) => i.component.typ === "cable")?.component.id).toBe("cable-70mm2");
    expect(bom.items.find((i) => i.component.typ === "fuse")?.component.id).toBe("fuse-mega-200");
  });

  it("varnar när vald säkring är underdimensionerad", () => {
    const villaDesign = designSystem(villa); // högre ström → behöver > 100 A säkring
    const bom = assembleBom(villaDesign, {
      batteryChemistry: "LiFePO4",
      mainCableLengthM: 2,
      fuseComponentId: "fuse-mega-100",
    });
    expect(bom.warnings.some((w) => /Vald säkring/.test(w))).toBe(true);
  });
});

describe("veDirectCablePlan", () => {
  it("fördelar enheter på portar och USB", () => {
    expect(veDirectCablePlan(2, 3)).toEqual({ direct: 2, usb: 0 });
    expect(veDirectCablePlan(3, 3)).toEqual({ direct: 3, usb: 0 });
    expect(veDirectCablePlan(5, 3)).toEqual({ direct: 3, usb: 2 });
    expect(veDirectCablePlan(0, 3)).toEqual({ direct: 0, usb: 0 });
  });
});

describe("assembleBom — VE.Direct-kablage", () => {
  const bom = assembleBom(designSystem(stuga), { batteryChemistry: "AGM", mainCableLengthM: 2.5 });

  it("lägger till en VE.Direct-kabel per VE.Direct-enhet (MPPT + shunt)", () => {
    const ve = bom.items.find((i) => i.component.id === "acc-vedirect-18");
    expect(ve?.quantity).toBe(2);
  });

  it("lägger inte till VE.Direct-USB när enheterna ryms på portarna", () => {
    expect(bom.items.some((i) => i.component.id === "acc-vedirect-usb")).toBe(false);
  });
});

describe("assembleBom — VE.Bus-kablage (MultiPlus → GX)", () => {
  it("lägger till en RJ45 UTP-kabel när MultiPlus (VE.Bus) valts", () => {
    const bom = assembleBom(designSystem(villa), { batteryChemistry: "LiFePO4", mainCableLengthM: 2 });
    const inv = bom.items.find((i) => i.component.typ === "inverter");
    expect(inv?.component.id).toBe("inverter-multiplus-24-3000-70");
    const rj45 = bom.items.find((i) => i.component.id === "acc-rj45-utp-5m");
    expect(rj45?.quantity).toBe(1);
  });

  it("lägger inte till RJ45 UTP-kabel när Phoenix (utan VE.Bus) valts", () => {
    const bom = assembleBom(designSystem(stuga), { batteryChemistry: "AGM", mainCableLengthM: 2.5 });
    expect(bom.items.find((i) => i.component.typ === "inverter")?.component.id).toBe(
      "inverter-phoenix-12-1200",
    );
    expect(bom.items.some((i) => i.component.id === "acc-rj45-utp-5m")).toBe(false);
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
