/**
 * Mallar och nordisk referensdata för guiden.
 *
 * Apparatmallar ger en snabbstart för vanliga off-grid-fall. Soldatasetet är
 * ungefärliga worst-month-soltimmar (peak sun hours) för svenska regioner och
 * används för off-grid-dimensionering (Steg 4). Verifiera mot lokal data för
 * skarp projektering.
 */

import type { Appliance } from "../engine/load.js";

/** Projekttyper som har en apparatmall i v1. */
export type TemplateKey = "stuga" | "husbil";

/** Färdiga apparatlistor som startpunkt. */
export const applianceTemplates: Record<TemplateKey, Appliance[]> = {
  stuga: [
    { name: "LED-belysning", watt: 10, hoursPerDay: 4, quantity: 4 },
    { name: "Kyl/frys (kompressor)", watt: 45, hoursPerDay: 24, surgeWatt: 135 },
    { name: "Vattenpump", watt: 50, hoursPerDay: 0.5, surgeWatt: 150 },
    { name: "TV", watt: 40, hoursPerDay: 3 },
    { name: "Telefon-/datorladdning", watt: 30, hoursPerDay: 2 },
  ],
  husbil: [
    { name: "Kompressorkyl", watt: 50, hoursPerDay: 12, surgeWatt: 150 },
    { name: "LED-spots", watt: 8, hoursPerDay: 5, quantity: 6 },
    { name: "Vattenpump", watt: 70, hoursPerDay: 0.3, surgeWatt: 210 },
    { name: "USB/laddare", watt: 60, hoursPerDay: 2 },
    { name: "Mikrovågsugn", watt: 700, hoursPerDay: 0.1 },
  ],
};

/** En region med dimensionerande soltimmar. */
export interface SunRegion {
  /** Visningsnamn. */
  namn: string;
  /** Soltimmar (peak sun hours) under värsta månaden. */
  worstMonthPeakSunHours: number;
  /** Rimlig snöfaktor för vintern i regionen [0–1]. */
  defaultSnowFactor: number;
}

/**
 * Ungefärliga worst-month-soltimmar för svenska regioner. Värdena är
 * konservativa vinterantaganden för off-grid; för årsbalans (ej off-grid)
 * används högre värden.
 */
export const sunRegions: Record<string, SunRegion> = {
  norr: { namn: "Norra Sverige", worstMonthPeakSunHours: 0.5, defaultSnowFactor: 0.6 },
  mellan: { namn: "Mellansverige", worstMonthPeakSunHours: 1.0, defaultSnowFactor: 0.7 },
  syd: { namn: "Södra Sverige", worstMonthPeakSunHours: 1.5, defaultSnowFactor: 0.8 },
};
