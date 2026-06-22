/**
 * BOM-montering (Steg 9) — ren funktion.
 *
 * Tar ett `designSystem()`-resultat och sätter ihop en itemiserad
 * komponentlista med SEK-priser från komponentdatabasen. Kabel ingår som
 * metervara (fram + retur) och säkringen matchas mot beräknad märkström.
 *
 * Komponentvalet använder seed-databasen (`SEED_COMPONENTS`) i v1. Logiken är
 * medvetet enkel och försedd med noteringar/varningar där antaganden görs —
 * den kurerade databasen och finare matchning hör till senare faser.
 */

import type { DesignSystemResult } from "../engine/index.js";
import { mpptCheck } from "../engine/index.js";
import type { BatteryChemistry } from "../engine/battery.js";
import type { Component } from "../data/types.js";
import { SEED_COMPONENTS } from "../data/seed.js";
import { eligibleInverters, eligibleShunts, eligibleCables, eligibleFuses, num } from "./selection.js";

/** En rad i BOM:en. */
export interface BomLineItem {
  component: Component;
  quantity: number;
  unitPriceSek: number;
  lineTotalSek: number;
  /** Förklaring/antagande på svenska. */
  note?: string;
}

/** Val som styr komponentmatchningen. */
export interface BomOptions {
  /** Vald batterikemi (matchas mot seed-batteriernas spec) för auto-val. */
  batteryChemistry: BatteryChemistry;
  /** Enkelvägslängd för huvudkabeln, m (samma som matades till Steg 8). */
  mainCableLengthM: number;
  /** Vald batterimodell (komponent-id). Anges den används den; annars auto via kemi. */
  batteryComponentId?: string;
  /** Manuellt antal batterier (> 0). Annars auto-beräknat. */
  batteryQuantity?: number;
  /** Vald panelmodell (komponent-id). Anges den används den; annars första panelen. */
  panelComponentId?: string;
  /** Manuellt antal paneler (> 0). Annars auto-beräknat. */
  panelQuantity?: number;
  /** Vald växelriktarmodell (komponent-id). Annars minsta passande. */
  inverterComponentId?: string;
  /** Vald shuntmodell (komponent-id). Annars minsta passande. */
  shuntComponentId?: string;
  /** Vald huvudkabelmodell (komponent-id). Annars minsta passande area. */
  cableComponentId?: string;
  /** Vald säkringsmodell (komponent-id). Annars minsta passande märkström. */
  fuseComponentId?: string;
}

/** Resultat av BOM-monteringen. */
export interface Bom {
  items: BomLineItem[];
  /** Summa exkl. ev. avdrag, SEK. */
  totalSek: number;
  /** Underlag för grönt avdrag (sol + batteri), SEK. Netto är Fas 5. */
  greenEligibleSek: number;
  /** Varningar på svenska (saknade komponenter, antaganden). */
  warnings: string[];
}

function byType(components: readonly Component[], typ: Component["typ"]): Component[] {
  return components.filter((c) => c.typ === typ);
}

/**
 * Fördelar VE.Direct-enheter på GX:ens portar. Enheter utöver antalet
 * VE.Direct-portar ansluts via VE.Direct-till-USB.
 */
export function veDirectCablePlan(deviceCount: number, ports: number): { direct: number; usb: number } {
  const direct = Math.max(0, Math.min(deviceCount, ports));
  const usb = Math.max(0, deviceCount - ports);
  return { direct, usb };
}

/** Sätter ihop en BOM från ett dimensioneringsresultat. */
export function assembleBom(
  design: DesignSystemResult,
  opts: BomOptions,
  components: readonly Component[] = SEED_COMPONENTS,
): Bom {
  const items: BomLineItem[] = [];
  const warnings: string[] = [];
  const vsys = design.systemVoltage.voltage;

  const add = (component: Component, quantity: number, note?: string) => {
    const unitPriceSek = component.prisSek;
    items.push({
      component,
      quantity,
      unitPriceSek,
      lineTotalSek: unitPriceSek * quantity,
      note,
    });
  };

  // --- Batteri (vald modell eller auto via kemi) ---
  const battery = opts.batteryComponentId
    ? components.find((c) => c.typ === "battery" && c.id === opts.batteryComponentId)
    : byType(components, "battery").find((c) => c.specs.chemistry === opts.batteryChemistry);
  if (!battery) {
    warnings.push(
      opts.batteryComponentId
        ? "Vald batterimodell hittades inte i databasen."
        : `Inget ${opts.batteryChemistry}-batteri i databasen.`,
    );
  } else {
    const battV = num(battery.specs.nominalVoltageV) ?? vsys;
    const capAh = num(battery.specs.capacityAh) ?? 0;
    const series = Math.max(1, Math.round(vsys / battV));
    const autoParallel = capAh > 0 ? Math.ceil(design.battery.requiredAh / capAh) : 1;
    const autoQty = series * autoParallel;
    const manualQty = opts.batteryQuantity && opts.batteryQuantity > 0 ? opts.batteryQuantity : null;
    const quantity = manualQty ?? autoQty;
    const note = manualQty
      ? `Manuellt antal ${quantity} (förslag: ${autoQty}).`
      : `${series} i serie × ${autoParallel} parallellt för ${vsys} V och ${Math.round(design.battery.requiredAh)} Ah-behov.`;
    add(battery, quantity, note);
    const providedAh = (quantity / series) * capAh;
    if (capAh > 0 && providedAh < design.battery.requiredAh) {
      warnings.push(
        `Batteribanken ger ~${Math.round(providedAh)} Ah men behovet är ${Math.round(design.battery.requiredAh)} Ah.`,
      );
    }
  }

  // --- Solpaneler (vald modell eller första panelen) ---
  const panel = opts.panelComponentId
    ? components.find((c) => c.typ === "panel" && c.id === opts.panelComponentId)
    : byType(components, "panel")[0];
  let panelCount = 0;
  if (!panel) {
    warnings.push(
      opts.panelComponentId ? "Vald panelmodell hittades inte i databasen." : "Ingen solpanel i databasen.",
    );
  } else {
    const panelWp = num(panel.specs.wp) ?? 1;
    const autoCount = Math.ceil(design.solar.requiredWp / panelWp);
    const manualCount = opts.panelQuantity && opts.panelQuantity > 0 ? opts.panelQuantity : null;
    panelCount = manualCount ?? autoCount;
    const note = manualCount
      ? `Manuellt antal ${panelCount} × ${panelWp} Wp ≈ ${panelCount * panelWp} Wp (förslag: ${autoCount}).`
      : `${panelCount} × ${panelWp} Wp ≈ ${panelCount * panelWp} Wp.`;
    add(panel, panelCount, note);
    if (panelCount * panelWp < design.solar.requiredWp) {
      warnings.push(
        `Solcellseffekten ${panelCount * panelWp} Wp är under behovet ${Math.round(design.solar.requiredWp)} Wp.`,
      );
    }
  }

  // --- MPPT (förenklad dimensionering i v1) ---
  const mppt = byType(components, "mppt")[0];
  let mpptQty = 0;
  if (!mppt) {
    warnings.push("Ingen MPPT i databasen.");
  } else if (panel && panelCount > 0) {
    const panelVoc = num(panel.specs.vocV) ?? 0;
    const panelImp = num(panel.specs.impA) ?? 0;
    const mpptMaxV = num(mppt.specs.maxPvVoltageV) ?? Infinity;
    const mpptMaxA = num(mppt.specs.maxOutputCurrentA) ?? Infinity;
    const series = Math.min(panelCount, Math.max(1, Math.floor(mpptMaxV / Math.max(panelVoc, 1))));
    const parallel = Math.ceil(panelCount / series);
    const check = mpptCheck({ panelVoc, panelImp, series, parallel, mpptMaxV, mpptMaxA });
    mpptQty = check.currentOk ? 1 : Math.max(1, Math.ceil(check.arrayImp / mpptMaxA));
    for (const w of check.warnings) warnings.push(`MPPT: ${w}`);
    add(mppt, mpptQty, `Förenklad dimensionering (${series}S${parallel}P) — verifiera PV-fönstret.`);
  } else {
    mpptQty = 1;
    add(mppt, 1);
  }

  // --- Växelriktare (vald modell eller minsta passande) ---
  const inverter = opts.inverterComponentId
    ? components.find((c) => c.typ === "inverter" && c.id === opts.inverterComponentId)
    : eligibleInverters(design, components)[0];
  if (!inverter) {
    warnings.push(
      opts.inverterComponentId
        ? "Vald växelriktarmodell hittades inte i databasen."
        : `Ingen växelriktare i databasen klarar ${Math.round(design.inverter.requiredContinuousW)} W vid ${vsys} V.`,
    );
  } else {
    add(inverter, 1, `≥ ${Math.round(design.inverter.requiredContinuousW)} W kontinuerligt.`);
    const cont = num(inverter.specs.continuousW) ?? 0;
    if (cont < design.inverter.requiredContinuousW) {
      warnings.push(
        `Vald växelriktare ger ${cont} W men behovet är ${Math.round(design.inverter.requiredContinuousW)} W.`,
      );
    }
  }

  // --- GX-enhet ---
  const gx = byType(components, "gx")[0];
  if (gx && design.distribution.recommendGx) add(gx, 1);

  // --- SmartShunt (vald modell eller minsta passande) ---
  const shunt = opts.shuntComponentId
    ? components.find((c) => c.typ === "accessory" && c.id === opts.shuntComponentId)
    : eligibleShunts(design, components)[0];
  const shuntAdded = Boolean(shunt);
  if (shunt) {
    add(shunt, 1, `${design.distribution.shuntRatingA} A.`);
    const maxA = num(shunt.specs.maxCurrentA) ?? 0;
    if (maxA < design.distribution.shuntRatingA) {
      warnings.push(`Vald shunt klarar ${maxA} A men behovet är ${design.distribution.shuntRatingA} A.`);
    }
  } else if (opts.shuntComponentId) {
    warnings.push("Vald shuntmodell hittades inte i databasen.");
  }

  // --- Busbar / Lynx (vid högre strömmar) ---
  if (design.maxContinuousDcCurrentA > 100) {
    const busbar = byType(components, "busbar")[0];
    if (busbar) add(busbar, 1, `Busbar ≥ ${Math.round(design.distribution.busbarMinCurrentA)} A.`);
  }

  // --- VE.Direct-kommunikation till GX ---
  if (gx && design.distribution.recommendGx) {
    const veDevices = mpptQty + (shuntAdded ? 1 : 0);
    const ports = num(gx.specs.veDirectPorts) ?? 3;
    const { direct, usb } = veDirectCablePlan(veDevices, ports);
    if (direct > 0) {
      const veCable = components.find((c) => c.id === "acc-vedirect-18");
      if (veCable) add(veCable, direct, `${direct} VE.Direct-enhet(er) till GX.`);
      else warnings.push("Ingen VE.Direct-kabel i databasen.");
    }
    if (usb > 0) {
      const veUsb = components.find((c) => c.id === "acc-vedirect-usb");
      if (veUsb) add(veUsb, usb, `${usb} enhet(er) utöver GX:ns ${ports} VE.Direct-portar — ansluts via USB.`);
      else warnings.push("Ingen VE.Direct-USB-kabel i databasen.");
    }
  }

  // --- VE.Bus-kommunikation (MultiPlus → GX) ---
  if (inverter && inverter.specs.comms === "VE.Bus" && gx && design.distribution.recommendGx) {
    const rj45 = components.find((c) => c.id === "acc-rj45-utp-5m");
    if (rj45) add(rj45, 1, "VE.Bus → GX (RJ45 UTP).");
    else warnings.push("Ingen RJ45 UTP-kabel i databasen.");
  }

  // --- Huvudkabel (metervara, fram + retur; vald modell eller minsta passande) ---
  const area = design.mainCable.area.selectedAreaMm2;
  const cable = opts.cableComponentId
    ? components.find((c) => c.typ === "cable" && c.id === opts.cableComponentId)
    : eligibleCables(design, components)[0];
  if (area === null) {
    warnings.push("Kabelarea kunde inte bestämmas — se Steg 8.");
  } else if (!cable) {
    warnings.push(
      opts.cableComponentId ? "Vald kabelmodell hittades inte i databasen." : `Ingen kabel ≥ ${area} mm² i databasen.`,
    );
  } else {
    const meters = Math.ceil(opts.mainCableLengthM * 2); // fram + retur
    const cableArea = num(cable.specs.areaMm2);
    const under = (cableArea ?? 0) < area;
    const note =
      `${meters} m (${opts.mainCableLengthM} m fram + retur), ${cableArea} mm²` +
      (cableArea !== area && !under ? ` (närmaste ≥ ${area} mm²).` : ".");
    add(cable, meters, note);
    if (under) warnings.push(`Vald kabel ${cableArea} mm² är under behovet ${area} mm².`);
  }

  // --- Säkring (huvudsäkring, vald modell eller minsta passande) ---
  const fuseRating = design.mainCable.fuse.ratingA;
  if (fuseRating !== null) {
    const fuse = opts.fuseComponentId
      ? components.find((c) => c.typ === "fuse" && c.id === opts.fuseComponentId)
      : eligibleFuses(design, components)[0];
    if (!fuse) {
      warnings.push(
        opts.fuseComponentId ? "Vald säkringsmodell hittades inte i databasen." : `Ingen säkring ≥ ${fuseRating} A i databasen.`,
      );
    } else {
      add(fuse, 1, `Huvudsäkring ${num(fuse.specs.ratingA)} A (behov ≥ ${fuseRating} A).`);
      const rating = num(fuse.specs.ratingA) ?? 0;
      if (rating < fuseRating) warnings.push(`Vald säkring ${rating} A är under behovet ${fuseRating} A.`);
    }
  }

  const totalSek = items.reduce((s, i) => s + i.lineTotalSek, 0);
  const greenEligibleSek = items
    .filter((i) => i.component.gronTeknikKategori === "sol" || i.component.gronTeknikKategori === "batteri")
    .reduce((s, i) => s + i.lineTotalSek, 0);

  return { items, totalSek, greenEligibleSek, warnings };
}
