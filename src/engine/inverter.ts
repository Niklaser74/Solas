/**
 * Steg 5 — Växelriktare/laddare.
 *
 * Från topplast + surge (Steg 1) räknas ut vilken kontinuerlig effekt och
 * surge-förmåga växelriktaren måste ha (MultiPlus / Phoenix / Multi RS).
 */

/** Inparametrar för växelriktarval. */
export interface InverterInput {
  /** Samtidig topplast, W (från Steg 1). */
  peakLoadW: number;
  /** Värsta momentana effekt inkl. startström, W (från Steg 1). */
  surgeW: number;
  /**
   * Marginal på kontinuerlig effekt [≥1]. Standard 1.25 (25 % huvudrum så att
   * växelriktaren inte går nära max kontinuerligt).
   */
  continuousMargin?: number;
  /**
   * Förekommer induktiva laster (pump, kompressor, motor)? Höjer kravet på
   * surge-förmåga. Standard true (konservativt).
   */
  hasInductiveLoads?: boolean;
}

/** Resultat av växelriktardimensioneringen. */
export interface InverterResult {
  /** Rekommenderad minsta kontinuerlig effekt, W. */
  requiredContinuousW: number;
  /** Rekommenderad minsta surge-förmåga, W. */
  requiredSurgeW: number;
  /** Kort motivering på svenska. */
  rationale: string;
}

/**
 * Dimensionerar växelriktarens effektkrav.
 *
 * - Kontinuerlig effekt = topplast × marginal.
 * - Surge-krav = uppmätt surge, höjt med extra påslag om induktiva laster
 *   finns (deras inrush är svår att mäta exakt).
 */
export function selectInverter(input: InverterInput): InverterResult {
  const {
    peakLoadW,
    surgeW,
    continuousMargin = 1.25,
    hasInductiveLoads = true,
  } = input;

  if (peakLoadW < 0 || surgeW < 0) throw new RangeError("Effekt kan inte vara negativ.");
  if (surgeW < peakLoadW) throw new RangeError("surgeW kan inte vara mindre än peakLoadW.");
  if (continuousMargin < 1) throw new RangeError("continuousMargin måste vara ≥ 1.");

  const requiredContinuousW = peakLoadW * continuousMargin;
  const inductiveBoost = hasInductiveLoads ? 1.3 : 1.0;
  const requiredSurgeW = Math.max(surgeW * inductiveBoost, requiredContinuousW);

  const rationale =
    `Minst ${Math.round(requiredContinuousW)} W kontinuerligt (topplast ${Math.round(peakLoadW)} W ` +
    `× ${continuousMargin}) och ${Math.round(requiredSurgeW)} W surge` +
    (hasInductiveLoads ? " (induktiva laster — extra surge-marginal)." : ".");

  return { requiredContinuousW, requiredSurgeW, rationale };
}
