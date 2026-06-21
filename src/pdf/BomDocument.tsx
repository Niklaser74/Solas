/** PDF-dokument för BOM/offert (@react-pdf/renderer). */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { DesignSystemResult } from "../engine/index.js";
import type { Bom } from "../bom/assembleBom.js";
import type { LayoutState } from "../state/types.js";
import { WiringDiagram } from "./WiringDiagram.js";
import { MountingDiagram } from "./MountingDiagram.js";

const sek = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);
const nfmt = (n: number, d = 0) =>
  new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: d }).format(n);
const r0 = (n: number) => nfmt(n, 0);
const r1 = (n: number) => nfmt(n, 1);

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#15181B", fontFamily: "Helvetica" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0C7A4D" },
  meta: { color: "#8A8980", marginBottom: 12 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 6 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E0DED6", paddingVertical: 3 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#15181B", paddingBottom: 3, fontFamily: "Helvetica-Bold" },
  cName: { width: "52%" },
  cQty: { width: "12%", textAlign: "right" },
  cUnit: { width: "18%", textAlign: "right" },
  cSum: { width: "18%", textAlign: "right" },
  totalRow: { flexDirection: "row", marginTop: 6, fontFamily: "Helvetica-Bold" },
  note: { fontSize: 7, color: "#8A8980" },
  disclaimer: { marginTop: 18, fontSize: 8, color: "#8A8980" },
  watermark: {
    position: "absolute",
    top: 320,
    left: 90,
    fontSize: 80,
    color: "#E6E4DC",
    transform: "rotate(-35deg)",
    fontFamily: "Helvetica-Bold",
  },
});

export interface BomDocumentProps {
  namn: string;
  typ: string;
  design: DesignSystemResult;
  bom: Bom;
  /** Fysisk layout (Steg 7) — krävs för montageschemat. */
  layout?: LayoutState;
  /** Lägg till kopplingsschema-sida. */
  includeWiring?: boolean;
  /** Lägg till montageschema-sida. */
  includeMounting?: boolean;
  /** Visa vattenstämpel (gratisnivå). */
  watermark?: boolean;
  date?: Date;
}

export function BomDocument({
  namn,
  typ,
  design,
  bom,
  layout,
  includeWiring = false,
  includeMounting = false,
  watermark = true,
  date = new Date(),
}: BomDocumentProps) {
  const summary: Array<[string, string]> = [
    ["Daglig energi", `${r0(design.load.dailyEnergyWh)} Wh/dygn`],
    ["Topplast / surge", `${r0(design.load.peakLoadW)} / ${r0(design.load.surgeW)} W`],
    ["Systemspänning", `${design.systemVoltage.voltage} V`],
    ["Batteribank", `${r0(design.battery.requiredAh)} Ah`],
    ["Solpaneler", `${r0(design.solar.requiredWp)} Wp`],
    ["Växelriktare", `≥ ${r0(design.inverter.requiredContinuousW)} W`],
    [
      "Huvudkabel",
      design.mainCable.area.selectedAreaMm2
        ? `${design.mainCable.area.selectedAreaMm2} mm² (${r1(design.mainCable.area.voltageDrop?.pct ?? 0)} % fall)`
        : "—",
    ],
    ["Huvudsäkring", design.mainCable.fuse.ratingA ? `${design.mainCable.fuse.ratingA} A` : "—"],
  ];

  return (
    <Document title={`Dimensas — ${namn}`}>
      <Page size="A4" style={styles.page}>
        {watermark && <Text style={styles.watermark} fixed>UTKAST</Text>}

        <Text style={styles.title}>Dimensas — systemförslag</Text>
        <Text style={styles.meta}>
          {namn} · {typ} · {date.toLocaleDateString("sv-SE")}
        </Text>

        <Text style={styles.h2}>Systemsammanfattning</Text>
        {summary.map(([k, v]) => (
          <View style={styles.sumRow} key={k}>
            <Text>{k}</Text>
            <Text>{v}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Komponentlista (BOM)</Text>
        <View style={styles.headRow}>
          <Text style={styles.cName}>Komponent</Text>
          <Text style={styles.cQty}>Antal</Text>
          <Text style={styles.cUnit}>À-pris</Text>
          <Text style={styles.cSum}>Summa</Text>
        </View>
        {bom.items.map((i) => (
          <View style={styles.row} key={i.component.id} wrap={false}>
            <View style={styles.cName}>
              <Text>{i.component.modell}</Text>
              {i.note && <Text style={styles.note}>{i.note}</Text>}
            </View>
            <Text style={styles.cQty}>{i.quantity}</Text>
            <Text style={styles.cUnit}>{sek(i.unitPriceSek)}</Text>
            <Text style={styles.cSum}>{sek(i.lineTotalSek)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.cName}>Totalt</Text>
          <Text style={styles.cQty} />
          <Text style={styles.cUnit} />
          <Text style={styles.cSum}>{sek(bom.totalSek)}</Text>
        </View>
        <View style={styles.sumRow}>
          <Text>Underlag grönt avdrag (sol + batteri)</Text>
          <Text>{sek(bom.greenEligibleSek)}</Text>
        </View>

        <Text style={styles.disclaimer}>
          Dimensas är ett oberoende verktyg för Victron-baserade system. Inte anslutet till, eller godkänt av, Victron
          Energy. Endast för planering — verifiera mot gällande standard och tillverkarens specifikation.
        </Text>
      </Page>

      {includeWiring && <WiringDiagram design={design} bom={bom} />}
      {includeMounting && <MountingDiagram layout={layout ?? { zone: { width: 1000, height: 600 }, placements: [], runs: [] }} />}
    </Document>
  );
}
