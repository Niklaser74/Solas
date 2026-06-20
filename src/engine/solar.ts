/**
 * Steg 4 — Solpaneler.
 *
 * Räknar fram effektbehov i Wp och hjälper dimensionera MPPT-regulatorn.
 *
 *   Wp_krav = Wh_dygn / (soltimmar_värsta_månad × systemförluster × snöfaktor)
 *
 * För off-grid används värsta-månad-soltimmar (nordiskt dataset, ~vinter).
 */

/** Inparametrar för soldimensionering. */
export interface SolarInput {
  /** Daglig energiförbrukning som ska täckas, Wh/dygn (från Steg 1). */
  dailyEnergyWh: number;
  /**
   * Soltimmar (peak sun hours) under dimensionerande månad. Off-grid:
   * värsta månaden. Nordiskt: lågt vintervärde.
   */
  peakSunHoursWorstMonth: number;
  /** Systemförluster [0–1], MPPT/temp/smuts/kabel. Standard 0.75. */
  systemLosses?: number;
  /** Snöfaktor [0–1] som deratar för snötäckning/vinter. Standard 1.0. */
  snowFactor?: number;
}

/** Resultat av soldimensioneringen. */
export interface SolarResult {
  /** Beräknat effektbehov, Wp. */
  requiredWp: number;
  /** Kort motivering på svenska. */
  rationale: string;
}

/**
 * Dimensionerar solcellseffekt (Wp).
 */
export function sizeSolar(input: SolarInput): SolarResult {
  const {
    dailyEnergyWh,
    peakSunHoursWorstMonth,
    systemLosses = 0.75,
    snowFactor = 1.0,
  } = input;

  if (dailyEnergyWh < 0) throw new RangeError("dailyEnergyWh kan inte vara negativ.");
  if (peakSunHoursWorstMonth <= 0) throw new RangeError("peakSunHoursWorstMonth måste vara > 0.");
  if (systemLosses <= 0 || systemLosses > 1) throw new RangeError("systemLosses måste vara i (0, 1].");
  if (snowFactor <= 0 || snowFactor > 1) throw new RangeError("snowFactor måste vara i (0, 1].");

  const requiredWp = dailyEnergyWh / (peakSunHoursWorstMonth * systemLosses * snowFactor);

  const rationale =
    `${Math.round(requiredWp)} Wp för att täcka ${dailyEnergyWh} Wh/dygn vid ` +
    `${peakSunHoursWorstMonth} soltimmar (förluster ${Math.round(systemLosses * 100)} %` +
    (snowFactor < 1 ? `, snöfaktor ${snowFactor}` : "") +
    `).`;

  return { requiredWp, rationale };
}

/** Inparametrar för MPPT-kontroll mot ett panelarrangemang. */
export interface MpptCheckInput {
  /** Panelens tomgångsspänning Voc vid lägsta temp, V. */
  panelVoc: number;
  /** Panelens ström vid max effekt Imp, A. */
  panelImp: number;
  /** Antal paneler i serie. */
  series: number;
  /** Antal parallella strängar. */
  parallel: number;
  /** MPPT max PV-spänning (absolut gräns), V. */
  mpptMaxV: number;
  /** MPPT max laddström (DC-utgång), A — alternativt PV-strömgräns. */
  mpptMaxA: number;
}

/** Resultat av MPPT-kontrollen. */
export interface MpptCheckResult {
  /** Total array Voc = panelVoc × series, V. */
  arrayVoc: number;
  /** Total array-ström = panelImp × parallel, A. */
  arrayImp: number;
  /** True om array-Voc ligger under MPPT:ns spänningsgräns. */
  voltageOk: boolean;
  /** True om array-strömmen ligger under MPPT:ns strömgräns. */
  currentOk: boolean;
  /** True om både spänning och ström är inom fönstret. */
  ok: boolean;
  /** Varningar på svenska för det som inte stämmer. */
  warnings: string[];
}

/**
 * Kontrollerar att ett panelarrangemang passar en MPPT-regulator: array-Voc
 * under spänningstaket och array-ström under strömtaket. Spänning räknas på
 * Voc vid kallaste väntade temperatur (anropa med kall-korrigerad panelVoc).
 */
export function mpptCheck(input: MpptCheckInput): MpptCheckResult {
  const { panelVoc, panelImp, series, parallel, mpptMaxV, mpptMaxA } = input;

  if (series < 1 || parallel < 1) throw new RangeError("series och parallel måste vara ≥ 1.");

  const arrayVoc = panelVoc * series;
  const arrayImp = panelImp * parallel;
  const voltageOk = arrayVoc <= mpptMaxV;
  const currentOk = arrayImp <= mpptMaxA;

  const warnings: string[] = [];
  if (!voltageOk) {
    warnings.push(
      `Array-Voc ${arrayVoc.toFixed(1)} V överstiger MPPT-gränsen ${mpptMaxV} V — minska antal paneler i serie.`,
    );
  }
  if (!currentOk) {
    warnings.push(
      `Array-ström ${arrayImp.toFixed(1)} A överstiger MPPT-gränsen ${mpptMaxA} A — minska antal parallella strängar eller välj större MPPT.`,
    );
  }

  return { arrayVoc, arrayImp, voltageOk, currentOk, ok: voltageOk && currentOk, warnings };
}
