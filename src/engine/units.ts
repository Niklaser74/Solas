/**
 * Delade typer och konstanter för beräkningsmotorn.
 *
 * Alla funktioner i `src/engine` är rena (inga sidoeffekter) och bygger på
 * dessa gemensamma byggstenar. Värden är valda konservativt för
 * planeringssyfte — se README §Disclaimer.
 */

/** Systemspänning i volt. Off-grid v1 stödjer 12/24/48 V. */
export type SystemVoltage = 12 | 24 | 48;

/**
 * Resistivitet för koppar, Ω·mm²/m.
 *
 * Designvärde nära driftstemperatur (~0.0175 vid ~20 °C; stiger med
 * temperatur). Används för spänningsfall i DC-kablar. Konservativt val i
 * linje med vanlig marin/DC-praxis. Ledare antas vara koppar.
 */
export const RHO_COPPER = 0.0175;

/**
 * IEC standard-tvärsnittsareor (mm²). Kabelarea väljs alltid uppåt till
 * närmaste värde i denna serie.
 */
export const IEC_CABLE_AREAS_MM2: readonly number[] = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240,
] as const;

/**
 * Strömtålighet (ampacitet) per area, A — typiska värden för finkardelig
 * DC-batterikabel, ~30 °C omgivning, ej buntad. Verklig installation måste
 * deratas för buntning, högre omgivningstemperatur och förläggningssätt
 * (jfr IEC 60364-5-52). Konservativ utgångspunkt för planering — verifiera
 * mot kabeltillverkarens datablad.
 */
export const AMPACITY_BY_AREA_MM2: Readonly<Record<number, number>> = {
  1.5: 18,
  2.5: 25,
  4: 34,
  6: 45,
  10: 63,
  16: 85,
  25: 115,
  35: 143,
  50: 178,
  70: 227,
  95: 277,
  120: 325,
  150: 370,
  185: 425,
  240: 500,
};

/**
 * Vanliga DC-säkringsvärden (A). Omfattar små bladsäkringar upp till
 * MEGA/ANL-storlekar för batteri-huvudsäkring.
 */
export const STANDARD_FUSE_RATINGS_A: readonly number[] = [
  5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 150, 200, 250, 300, 400, 500,
] as const;

/** Standardmål för spänningsfall i DC-system (%). */
export const DEFAULT_MAX_VOLT_DROP_PCT = 3;

/**
 * Säkringsmarginal mot kontinuerlig ström. Säkring väljs ≥ 1.25 × ström så
 * att den inte löser ut vid normal kontinuerlig last.
 */
export const FUSE_CONTINUOUS_MARGIN = 1.25;

/** Returnerar närmaste standardarea ≥ `minAreaMm2`, eller `null` om för stor. */
export function nextStandardArea(minAreaMm2: number): number | null {
  for (const area of IEC_CABLE_AREAS_MM2) {
    if (area >= minAreaMm2) return area;
  }
  return null;
}

/** Ampacitet för en given standardarea, eller `undefined` om okänd. */
export function ampacityFor(areaMm2: number): number | undefined {
  return AMPACITY_BY_AREA_MM2[areaMm2];
}

/** Returnerar närmaste standardsäkring ≥ `minRatingA`, eller `null`. */
export function nextStandardFuse(minRatingA: number): number | null {
  for (const rating of STANDARD_FUSE_RATINGS_A) {
    if (rating >= minRatingA) return rating;
  }
  return null;
}
