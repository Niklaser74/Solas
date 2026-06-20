/**
 * Steg 1 — Behovsanalys / last.
 *
 * Tar en apparatlista och räknar fram daglig energi, topplast och surge
 * (startström). Output matar systemspänning (Steg 2), batteribank (Steg 3),
 * sol (Steg 4) och växelriktare (Steg 5).
 */

/** En apparat i lastlistan. */
export interface Appliance {
  /** Namn, t.ex. "Kylskåp" eller "Vattenpump". */
  name: string;
  /** Kontinuerlig effekt vid drift, W. */
  watt: number;
  /** Drifttimmar per dygn. */
  hoursPerDay: number;
  /** Antal av denna apparat. Standard 1. */
  quantity?: number;
  /**
   * Startström/inrush som momentan effekt, W (induktiva laster: pumpar,
   * kompressorer). Utelämnas för rent resistiva laster.
   */
  surgeWatt?: number;
}

/** Resultat av lastanalysen. */
export interface LoadAnalysis {
  /** Daglig energiförbrukning, Wh/dygn. */
  dailyEnergyWh: number;
  /** Samtidig topplast vid drift, W. */
  peakLoadW: number;
  /**
   * Värsta momentana effekt inkl. startström, W. Modelleras som topplast +
   * det enskilt största startström-överskottet (en motor startar i taget).
   */
  surgeW: number;
}

/** Parametrar för lastanalysen. */
export interface LoadOptions {
  /**
   * Samtidighetsfaktor [0–1] för topplast: andel av apparaterna som antas
   * vara igång samtidigt. Standard 1.0 (konservativt: alla samtidigt).
   */
  simultaneityFactor?: number;
}

/**
 * Analyserar en apparatlista.
 *
 * - `dailyEnergyWh = Σ watt · hoursPerDay · quantity`
 * - `peakLoadW = simultaneityFactor · Σ watt · quantity`
 * - `surgeW = peakLoadW + max(0, surgeWatt − watt)` över apparaterna
 */
export function analyzeLoad(
  appliances: readonly Appliance[],
  options: LoadOptions = {},
): LoadAnalysis {
  const simultaneity = options.simultaneityFactor ?? 1.0;
  if (simultaneity <= 0 || simultaneity > 1) {
    throw new RangeError("simultaneityFactor måste vara i intervallet (0, 1].");
  }

  let dailyEnergyWh = 0;
  let runningLoadW = 0;
  let largestSurgeDeltaW = 0;

  for (const a of appliances) {
    const qty = a.quantity ?? 1;
    if (a.watt < 0 || a.hoursPerDay < 0 || qty < 0) {
      throw new RangeError(`Ogiltiga värden för apparat "${a.name}".`);
    }
    dailyEnergyWh += a.watt * a.hoursPerDay * qty;
    runningLoadW += a.watt * qty;

    if (a.surgeWatt !== undefined) {
      const delta = a.surgeWatt - a.watt;
      if (delta > largestSurgeDeltaW) largestSurgeDeltaW = delta;
    }
  }

  const peakLoadW = runningLoadW * simultaneity;

  return {
    dailyEnergyWh,
    peakLoadW,
    surgeW: peakLoadW + largestSurgeDeltaW,
  };
}
