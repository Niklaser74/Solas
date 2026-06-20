/**
 * Steg 8 — Kabel & säkring (KVALITETSSTÄMPELN).
 *
 * Beräknar kabelarea från ström, längd och spänningsfall samt väljer säkring
 * per segment. Räknas enligt IEC/svensk praxis (inte ABYC/NEC). Detta är där
 * konkurrenterna explicit varnar för fel — så det görs rätt och verifierbart.
 *
 * Spänningsfall i DC räknar på total ledarlängd = 2 × enkelvägen (plus +
 * minus). Funktionerna här dubblar längden automatiskt utifrån enkelvägen.
 */

import {
  RHO_COPPER,
  DEFAULT_MAX_VOLT_DROP_PCT,
  FUSE_CONTINUOUS_MARGIN,
  IEC_CABLE_AREAS_MM2,
  ampacityFor,
  nextStandardArea,
  nextStandardFuse,
} from "./units.js";
import type { SystemVoltage } from "./units.js";

/** Resultat av en spänningsfallsberäkning. */
export interface VoltageDrop {
  /** Spänningsfall i volt över fram + retur. */
  volts: number;
  /** Spänningsfall som andel av systemspänningen, %. */
  pct: number;
}

/** Inparametrar för spänningsfall över ett kabelsegment. */
export interface VoltageDropInput {
  /** Ledararea, mm². */
  areaMm2: number;
  /** Ström genom segmentet, A. */
  currentA: number;
  /** Enkelvägslängd (kabeldragväg), m. Dubblas internt för fram + retur. */
  lengthM: number;
  /** Systemspänning, V (för procentberäkning). */
  systemVoltage: SystemVoltage;
}

/**
 * Beräknar spänningsfall över ett segment.
 *
 *   Vdrop = (2 × L × I × ρ) / A
 *
 * Faktorn 2 är fram + retur. ρ = resistivitet för koppar.
 */
export function actualVoltageDrop(input: VoltageDropInput): VoltageDrop {
  const { areaMm2, currentA, lengthM, systemVoltage } = input;
  if (areaMm2 <= 0) throw new RangeError("areaMm2 måste vara > 0.");
  if (currentA < 0 || lengthM < 0) throw new RangeError("currentA och lengthM kan inte vara negativa.");

  const volts = (2 * lengthM * currentA * RHO_COPPER) / areaMm2;
  return { volts, pct: (volts / systemVoltage) * 100 };
}

/** Vad som styrde den valda kabelarean. */
export type AreaGovernedBy = "voltdrop" | "ampacity";

/** Inparametrar för kabelareaberäkning. */
export interface CableAreaInput {
  /** Kontinuerlig ström genom segmentet, A. */
  currentA: number;
  /** Enkelvägslängd, m (från Steg 7 eller manuell inmatning). */
  lengthM: number;
  /** Systemspänning, V. */
  systemVoltage: SystemVoltage;
  /** Tillåtet spänningsfall, % (mål < 3). Standard 3. */
  maxVoltDropPct?: number;
  /**
   * Minsta ampacitet kabeln måste ha utöver lastströmmen, A. Sätts t.ex.
   * till säkringens märkström så att säkringen verkligen skyddar kabeln
   * (kabelns ampacitet ≥ säkring). Standard 0 (endast lastström gäller).
   */
  minAmpacityA?: number;
}

/** Resultat av kabelareaberäkningen. */
export interface CableAreaResult {
  /** Teoretisk minsta area enbart från spänningsfallskravet, mm². */
  minAreaForVoltDropMm2: number;
  /** Vald standardarea (IEC), mm², eller null om inget i serien räcker. */
  selectedAreaMm2: number | null;
  /** Ampacitet för vald area, A. */
  selectedAmpacityA: number | null;
  /** Faktiskt spänningsfall vid vald area. */
  voltageDrop: VoltageDrop | null;
  /** Vilket krav som blev styrande för valet. */
  governedBy: AreaGovernedBy | null;
  /** Varningar på svenska. */
  warnings: string[];
}

/**
 * Räknar fram nödvändig kabelarea för ett segment och väljer närmaste IEC-
 * standardarea som uppfyller *både* spänningsfallskravet och strömtåligheten.
 */
export function requiredCableArea(input: CableAreaInput): CableAreaResult {
  const {
    currentA,
    lengthM,
    systemVoltage,
    maxVoltDropPct = DEFAULT_MAX_VOLT_DROP_PCT,
  } = input;

  if (currentA < 0 || lengthM < 0) throw new RangeError("currentA och lengthM kan inte vara negativa.");
  if (maxVoltDropPct <= 0) throw new RangeError("maxVoltDropPct måste vara > 0.");

  const allowedVolts = systemVoltage * (maxVoltDropPct / 100);
  const minAreaForVoltDropMm2 =
    allowedVolts > 0 ? (2 * lengthM * currentA * RHO_COPPER) / allowedVolts : Infinity;

  // Minsta standardarea som klarar spänningsfallet.
  const voltDropArea = nextStandardArea(minAreaForVoltDropMm2);
  // Ampacitetskravet är lastströmmen, men minst minAmpacityA (säkringen).
  const ampacityNeedA = Math.max(currentA, input.minAmpacityA ?? 0);
  // Minsta standardarea vars ampacitet räcker.
  const ampacityArea =
    IEC_CABLE_AREAS_MM2.find((a) => (ampacityFor(a) ?? 0) >= ampacityNeedA) ?? null;

  const warnings: string[] = [];

  if (voltDropArea === null) {
    warnings.push(
      `Inget tvärsnitt i IEC-serien klarar < ${maxVoltDropPct} % spänningsfall för ${currentA} A över ${lengthM} m — dela upp lasten eller höj systemspänningen.`,
    );
  }
  if (ampacityArea === null) {
    warnings.push(
      `Inget tvärsnitt i IEC-serien har ampacitet för ${currentA} A — använd parallella ledare eller större kabel.`,
    );
  }
  if (voltDropArea === null || ampacityArea === null) {
    return {
      minAreaForVoltDropMm2,
      selectedAreaMm2: null,
      selectedAmpacityA: null,
      voltageDrop: null,
      governedBy: null,
      warnings,
    };
  }

  const selectedAreaMm2 = Math.max(voltDropArea, ampacityArea);
  const governedBy: AreaGovernedBy = voltDropArea >= ampacityArea ? "voltdrop" : "ampacity";
  const selectedAmpacityA = ampacityFor(selectedAreaMm2) ?? null;
  const voltageDrop = actualVoltageDrop({ areaMm2: selectedAreaMm2, currentA, lengthM, systemVoltage });

  return {
    minAreaForVoltDropMm2,
    selectedAreaMm2,
    selectedAmpacityA,
    voltageDrop,
    governedBy,
    warnings,
  };
}

/** Inparametrar för säkringsval. */
export interface FuseInput {
  /** Kontinuerlig ström genom segmentet, A. */
  currentA: number;
  /** Ampacitet för kabeln säkringen skyddar, A. */
  cableAmpacityA: number;
}

/** Resultat av säkringsvalet. */
export interface FuseResult {
  /** Vald standardsäkring, A, eller null om ingen passar. */
  ratingA: number | null;
  /** True om säkringen både skyddar kabeln och tål kontinuerlig last. */
  ok: boolean;
  /** Varningar på svenska. */
  warnings: string[];
}

/**
 * Väljer säkring för ett segment.
 *
 * Regel: säkring ≥ 1.25 × kontinuerlig ström (löser inte vid normal last)
 * och ≤ kabelns ampacitet (skyddar kabeln). Om ingen standardsäkring ryms i
 * det intervallet är kabeln underdimensionerad — flaggas.
 */
export function selectFuse(input: FuseInput): FuseResult {
  const { currentA, cableAmpacityA } = input;
  if (currentA < 0) throw new RangeError("currentA kan inte vara negativ.");
  if (cableAmpacityA <= 0) throw new RangeError("cableAmpacityA måste vara > 0.");

  const minRating = currentA * FUSE_CONTINUOUS_MARGIN;
  const ratingA = nextStandardFuse(minRating);
  const warnings: string[] = [];

  if (ratingA === null) {
    warnings.push(`Ingen standardsäkring ≥ ${minRating.toFixed(1)} A i serien.`);
    return { ratingA: null, ok: false, warnings };
  }

  if (ratingA > cableAmpacityA) {
    warnings.push(
      `Säkring ${ratingA} A överstiger kabelns ampacitet ${cableAmpacityA} A — kabeln skyddas inte. Öka kabelarean.`,
    );
    return { ratingA, ok: false, warnings };
  }

  return { ratingA, ok: true, warnings };
}

/** Kombinerat resultat för ett kabelsegment: area + spänningsfall + säkring. */
export interface CableSegmentResult {
  area: CableAreaResult;
  fuse: FuseResult;
}

/**
 * Bekvämlighet: dimensionerar ett komplett segment (kabelarea + säkring) i
 * ett anrop med korrekt ordning:
 *   1. Säkring väljs från lastströmmen (≥ 1.25 × ström).
 *   2. Kabeln dimensioneras så att den klarar spänningsfallet *och* har
 *      ampacitet ≥ säkringen (så att säkringen skyddar kabeln).
 *   3. Säkringsvalet valideras mot den valda kabelns ampacitet.
 * Detta undviker den klassiska fällan att kabeln klarar lasten men inte
 * skyddas av sin egen säkring.
 */
export function sizeCableSegment(input: CableAreaInput): CableSegmentResult {
  const fuseRating = nextStandardFuse(input.currentA * FUSE_CONTINUOUS_MARGIN);
  const area = requiredCableArea({
    ...input,
    minAmpacityA: Math.max(input.minAmpacityA ?? 0, fuseRating ?? 0),
  });
  const fuse =
    area.selectedAmpacityA !== null
      ? selectFuse({ currentA: input.currentA, cableAmpacityA: area.selectedAmpacityA })
      : { ratingA: fuseRating, ok: false, warnings: ["Kabelarea kunde inte bestämmas — säkring ej verifierad."] };
  return { area, fuse };
}
