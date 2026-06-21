/** Montageschema (fysisk layout från Steg 7) för PDF-exporten.
 *
 *  Ritar zonen, de placerade komponenterna (i skala, med rotation) och de
 *  ritade kabeldragningarna. Återanvänder geometri-hjälparna från layout-
 *  planeraren så att ritningen matchar canvasen i Steg 7. */

import { Page, View, Text, Svg, G, Rect, Polyline, Circle, StyleSheet, Text as SvgText } from "@react-pdf/renderer";
import type { LayoutPlacement, LayoutState } from "../state/types.js";
import { SEED_COMPONENTS } from "../data/seed.js";
import type { Component } from "../data/types.js";
import { placeableDef } from "../layout/layoutComponents.js";
import { connectionWorldPos, manhattanPath, cableRunLengthM, type Point } from "../layout/geometry.js";

const MAX_W = 523;
const MAX_H = 560;

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#15181B", fontFamily: "Helvetica" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0C7A4D" },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 10 },
  meta: { color: "#8A8980", marginBottom: 12 },
  disclaimer: { marginTop: 18, fontSize: 8, color: "#8A8980" },
});

const byId = new Map<string, Component>(SEED_COMPONENTS.map((c) => [c.id, c]));

const r1 = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(n);

/** Absolut mm-position för en anslutningspunkt på en placering. */
function worldPoint(p: LayoutPlacement, pointId: string): Point | null {
  const component = byId.get(p.componentId);
  if (!component) return null;
  const def = placeableDef(component);
  const local = def.points.find((pt) => pt.id === pointId);
  if (!local) return null;
  return connectionWorldPos({ placement: p, size: def.size, local });
}

export function MountingDiagram({ layout }: { layout: LayoutState }) {
  const { zone, placements, runs } = layout;
  const placementById = new Map(placements.map((p) => [p.id, p]));
  const scale = Math.min(MAX_W / zone.width, MAX_H / zone.height);
  const svgW = zone.width * scale;
  const svgH = zone.height * scale;

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Montageschema</Text>
      <Text style={styles.h2}>Fysisk placering (Steg 7)</Text>

      {placements.length === 0 ? (
        <Text style={styles.meta}>Ingen layout ritad i Steg 7 — montageschemat är tomt.</Text>
      ) : (
        <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
          <Rect x={0} y={0} width={svgW} height={svgH} fill="#FBFAF6" stroke="#C9C7BD" strokeWidth={1} />

          {/* Kabeldragningar (under komponenterna). */}
          {runs.map((run) => {
            const from = placementById.get(run.fromPlacementId);
            const to = placementById.get(run.toPlacementId);
            if (!from || !to) return null;
            const a = worldPoint(from, run.fromPointId);
            const b = worldPoint(to, run.toPointId);
            if (!a || !b) return null;
            const path = manhattanPath(a, b);
            const points = path.map((p) => `${p.x * scale},${p.y * scale}`).join(" ");
            const lenM = cableRunLengthM({ pathMm: path, slackPercent: run.slackPercent });
            const mid = path[Math.floor(path.length / 2)];
            return (
              <G key={run.id}>
                <Polyline points={points} stroke="#0C7A4D" strokeWidth={1.2} fill="none" />
                <SvgText x={mid.x * scale + 2} y={mid.y * scale - 2} style={{ fontSize: 7, fontFamily: "Helvetica" }} fill="#0C7A4D">
                  {`${r1(lenM)} m`}
                </SvgText>
              </G>
            );
          })}

          {/* Placerade komponenter. */}
          {placements.map((p) => {
            const component = byId.get(p.componentId);
            if (!component) return null;
            const def = placeableDef(component);
            const x = p.x * scale;
            const y = p.y * scale;
            const w = def.size.width * scale;
            const h = def.size.height * scale;
            const cx = x + w / 2;
            const cy = y + h / 2;
            return (
              <G key={p.id} transform={`rotate(${p.rotation} ${cx} ${cy})`}>
                <Rect x={x} y={y} width={w} height={h} rx={2} fill="#EDEAE0" stroke="#15181B" strokeWidth={0.8} />
                <SvgText x={x + 3} y={y + 11} style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }} fill="#15181B">
                  {component.modell}
                </SvgText>
                {def.points.map((pt) => (
                  <Circle
                    key={pt.id}
                    cx={x + pt.x * scale}
                    cy={y + pt.y * scale}
                    r={2}
                    fill={pt.typ.includes("minus") ? "#15181B" : "#C0392B"}
                  />
                ))}
              </G>
            );
          })}
        </Svg>
      )}

      <View>
        <Text style={styles.disclaimer}>
          Skalenlig principskiss av komponentplaceringen. Kontrollera verkliga mått, kylning/clearance, infästning och
          kabelvägar på plats innan montage.
        </Text>
      </View>
    </Page>
  );
}
