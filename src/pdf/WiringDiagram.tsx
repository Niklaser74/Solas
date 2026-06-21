/** Auto-genererat kopplingsschema (förenklad enlinje) för PDF-exporten.
 *
 *  Koden har ingen logisk kopplingsgraf — vi härleder ett översiktsschema från
 *  vilka komponenttyper som finns i BOM:en och dimensioneringsresultatet. */

import { Page, View, Text, Svg, G, Rect, Line, StyleSheet, Text as SvgText } from "@react-pdf/renderer";
import type { DesignSystemResult } from "../engine/index.js";
import type { Bom } from "../bom/assembleBom.js";

const r0 = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n);

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#15181B", fontFamily: "Helvetica" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0C7A4D" },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 10 },
  disclaimer: { marginTop: 18, fontSize: 8, color: "#8A8980" },
});

/** En nod i schemat (komponentblock). */
export interface WiringNode {
  key: string;
  label: string;
  sub: string;
}

/** En förbindelse mellan två noder. */
export interface WiringEdge {
  from: string;
  to: string;
  label: string;
  dashed?: boolean;
}

export interface WiringModel {
  nodes: WiringNode[];
  edges: WiringEdge[];
  voltage: number;
}

/** Bygger schemamodellen från BOM + design. Ren funktion (testbar). */
export function buildWiringModel(bom: Bom, design: DesignSystemResult): WiringModel {
  const has = (typ: string) => bom.items.some((i) => i.component.typ === typ);
  const qty = (typ: string) => bom.items.filter((i) => i.component.typ === typ).reduce((s, i) => s + i.quantity, 0);
  const v = design.systemVoltage.voltage;

  const nodes: WiringNode[] = [];
  const edges: WiringEdge[] = [];

  const hasBus = has("battery") && has("inverter");

  if (has("panel")) nodes.push({ key: "panel", label: "Solpaneler", sub: `${qty("panel")} st · ${r0(design.solar.requiredWp)} Wp` });
  if (has("mppt")) nodes.push({ key: "mppt", label: "MPPT", sub: "Laddregulator" });
  if (has("gx")) nodes.push({ key: "gx", label: "GX (Cerbo)", sub: "Övervakning" });
  if (has("battery")) nodes.push({ key: "battery", label: "Batteribank", sub: `${r0(design.battery.requiredAh)} Ah @ ${v} V` });
  if (hasBus) nodes.push({ key: "dcbus", label: "DC-skena / Lynx", sub: `≥ ${r0(design.distribution.busbarMinCurrentA)} A` });
  if (has("inverter")) nodes.push({ key: "inverter", label: "Växelriktare", sub: `≥ ${r0(design.inverter.requiredContinuousW)} W` });
  if (has("inverter")) nodes.push({ key: "ac", label: "230 V AC", sub: "Förbrukare" });

  const keys = new Set(nodes.map((n) => n.key));
  const edge = (from: string, to: string, label: string, dashed = false) => {
    if (keys.has(from) && keys.has(to)) edges.push({ from, to, label, dashed });
  };

  const area = design.mainCable.area.selectedAreaMm2;
  const fuseA = design.mainCable.fuse.ratingA;
  const cableTxt = area ? ` · ${area} mm²` : "";

  edge("panel", "mppt", `PV ${r0(design.solar.requiredWp)} Wp`);
  edge("mppt", "dcbus", `DC ${v} V`);
  edge("battery", "dcbus", `${fuseA ? `Huvudsäkring ${fuseA} A` : "Huvudsäkring"}${cableTxt}`);
  edge("dcbus", "inverter", `DC ${v} V · ${r0(design.maxContinuousDcCurrentA)} A`);
  edge("inverter", "ac", "230 V");
  edge("gx", "dcbus", "VE.Direct / VE.Bus", true);

  return { nodes, edges, voltage: v };
}

/* ----------------------------------------------------------- PDF-rendering */

const W = 523;
const H = 320;
const BOX_W = 135;
const BOX_H = 50;
const COL_X: Record<number, number> = { 0: 10, 1: 194, 2: 378 };
const ROW_Y: Record<number, number> = { 0: 26, 1: 150, 2: 250 };

/** Fast rutnätsposition per nod-key. */
const GRID: Record<string, { col: number; row: number }> = {
  panel: { col: 0, row: 0 },
  mppt: { col: 1, row: 0 },
  gx: { col: 2, row: 0 },
  battery: { col: 0, row: 1 },
  dcbus: { col: 1, row: 1 },
  inverter: { col: 2, row: 1 },
  ac: { col: 2, row: 2 },
};

function boxAt(key: string) {
  const g = GRID[key];
  if (!g) return null;
  const x = COL_X[g.col];
  const y = ROW_Y[g.row];
  return { x, y, cx: x + BOX_W / 2, cy: y + BOX_H / 2 };
}

export function WiringDiagram({ design, bom }: { design: DesignSystemResult; bom: Bom }) {
  const model = buildWiringModel(bom, design);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Kopplingsschema (översikt)</Text>
      <Text style={styles.h2}>Förenklat enlinjeschema</Text>

      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Förbindelser först (under boxarna). */}
        {model.edges.map((e, i) => {
          const a = boxAt(e.from);
          const b = boxAt(e.to);
          if (!a || !b) return null;
          return (
            <G key={`e${i}`}>
              <Line
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                stroke={e.dashed ? "#8A8980" : "#0C7A4D"}
                strokeWidth={e.dashed ? 1 : 1.4}
                {...(e.dashed ? { strokeDasharray: "4, 3" } : {})}
              />
              <SvgText
                x={(a.cx + b.cx) / 2}
                y={(a.cy + b.cy) / 2 - 2}
                style={{ fontSize: 7, fontFamily: "Helvetica" }}
                fill="#5C5B54"
              >
                {e.label}
              </SvgText>
            </G>
          );
        })}

        {/* Noder. */}
        {model.nodes.map((n) => {
          const b = boxAt(n.key);
          if (!b) return null;
          return (
            <G key={n.key}>
              <Rect x={b.x} y={b.y} width={BOX_W} height={BOX_H} rx={4} fill="#F4F2EA" stroke="#15181B" strokeWidth={1} />
              <SvgText x={b.x + 8} y={b.y + 20} style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }} fill="#15181B">
                {n.label}
              </SvgText>
              <SvgText x={b.x + 8} y={b.y + 36} style={{ fontSize: 8, fontFamily: "Helvetica" }} fill="#5C5B54">
                {n.sub}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      <View>
        <Text style={styles.disclaimer}>
          Schemat är en förenklad principskiss för planering — inte en elektrisk installationsritning. Säkringar,
          jordning, kablage och placering måste verifieras mot gällande standard och tillverkarens anvisningar.
        </Text>
      </View>
    </Page>
  );
}
