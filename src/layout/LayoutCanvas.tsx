/** Fysisk layout-planerare (Steg 7) — 2D zon-canvas i SVG.
 *
 *  Rita en fri yta, placera komponenter i verklig storlek, dra kabel mellan
 *  anslutningspunkter och få längder som matar Steg 8. Ingen extern canvas-lib
 *  — ren SVG + pointer-events. Rotation ignoreras i clearance/bounds i v1. */

import { useMemo, useRef, useState } from "react";
import { useProject, useProjectDispatch } from "../state/projectStore.js";
import type { LayoutPlacement, LayoutRun, LayoutState } from "../state/types.js";
import { SEED_COMPONENTS } from "../data/seed.js";
import type { Component } from "../data/types.js";
import { placeableDef, paletteComponents } from "./layoutComponents.js";
import {
  connectionWorldPos,
  manhattanPath,
  cableRunLengthM,
  clearanceViolations,
  outOfBounds,
  autoArrange,
  firstFreeSpot,
  type Point,
} from "./geometry.js";

const MAX_W = 640;
const MAX_H = 420;

/** Logiskt el-flöde vänster→höger vid auto-placering (lägre = tidigare). */
const LAYOUT_ORDER: Partial<Record<Component["typ"], number>> = {
  battery: 0,
  fuse: 1,
  busbar: 2,
  accessory: 3,
  mppt: 4,
  inverter: 5,
  gx: 6,
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`;

const byId = new Map<string, Component>(SEED_COMPONENTS.map((c) => [c.id, c]));

interface PointRef {
  placementId: string;
  pointId: string;
}

function worldPoint(p: LayoutPlacement): (pointId: string) => Point | null {
  const component = byId.get(p.componentId);
  if (!component) return () => null;
  const def = placeableDef(component);
  return (pointId: string) => {
    const local = def.points.find((pt) => pt.id === pointId);
    if (!local) return null;
    return connectionWorldPos({ placement: p, size: def.size, local });
  };
}

export function LayoutCanvas() {
  const { layout } = useProject();
  const dispatch = useProjectDispatch();
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<PointRef | null>(null);
  const [slack, setSlack] = useState(15);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const scale = Math.min(MAX_W / layout.zone.width, MAX_H / layout.zone.height);
  const setLayout = (next: LayoutState) => dispatch({ type: "setLayout", layout: next });

  const placementsById = useMemo(
    () => new Map(layout.placements.map((p) => [p.id, p])),
    [layout.placements],
  );

  /* ---- mutationer ---- */
  const addComponent = (componentId: string) => {
    const component = byId.get(componentId);
    const def = component ? placeableDef(component) : null;
    const existing = layout.placements.map((p) => {
      const d = placeableDef(byId.get(p.componentId)!);
      return { id: p.id, x: p.x, y: p.y, width: d.size.width, height: d.size.height, clearanceMm: d.clearanceMm };
    });
    const spot = def
      ? firstFreeSpot(existing, def.size, layout.zone, { gapMm: def.clearanceMm })
      : { x: 40, y: 40 };
    setLayout({
      ...layout,
      placements: [
        ...layout.placements,
        { id: uid(), componentId, x: spot.x, y: spot.y, rotation: 0 },
      ],
    });
  };

  /** Placerar alla komponenter snyggt: logisk ordning, radvis, utan överlapp. */
  const autoPlace = () => {
    const items = layout.placements.map((p) => {
      const component = byId.get(p.componentId)!;
      const def = placeableDef(component);
      return {
        id: p.id,
        width: def.size.width,
        height: def.size.height,
        clearanceMm: def.clearanceMm,
        order: LAYOUT_ORDER[component.typ] ?? 9,
      };
    });
    const pos = new Map(autoArrange(items, layout.zone).map((q) => [q.id, q]));
    setLayout({
      ...layout,
      placements: layout.placements.map((p) => {
        const q = pos.get(p.id);
        return q ? { ...p, x: q.x, y: q.y, rotation: 0 } : p;
      }),
    });
  };

  const updatePlacement = (id: string, patch: Partial<LayoutPlacement>) =>
    setLayout({
      ...layout,
      placements: layout.placements.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const removePlacement = (id: string) =>
    setLayout({
      ...layout,
      placements: layout.placements.filter((p) => p.id !== id),
      runs: layout.runs.filter((r) => r.fromPlacementId !== id && r.toPlacementId !== id),
    });

  const clickPoint = (ref: PointRef) => {
    if (!pending) {
      setPending(ref);
      return;
    }
    if (pending.placementId === ref.placementId) {
      setPending(null);
      return;
    }
    const run: LayoutRun = {
      id: uid(),
      fromPlacementId: pending.placementId,
      fromPointId: pending.pointId,
      toPlacementId: ref.placementId,
      toPointId: ref.pointId,
      slackPercent: slack,
    };
    setLayout({ ...layout, runs: [...layout.runs, run] });
    setPending(null);
  };

  /* ---- drag ---- */
  const toMm = (clientX: number, clientY: number): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const onPointerDownPlacement = (e: React.PointerEvent, p: LayoutPlacement) => {
    e.stopPropagation();
    setSelected(p.id);
    const m = toMm(e.clientX, e.clientY);
    dragRef.current = { id: p.id, dx: m.x - p.x, dy: m.y - p.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const m = toMm(e.clientX, e.clientY);
    updatePlacement(dragRef.current.id, {
      x: Math.round(m.x - dragRef.current.dx),
      y: Math.round(m.y - dragRef.current.dy),
    });
  };
  const endDrag = () => (dragRef.current = null);

  /* ---- längder & varningar ---- */
  const runLength = (run: LayoutRun): number | null => {
    const from = placementsById.get(run.fromPlacementId);
    const to = placementsById.get(run.toPlacementId);
    if (!from || !to) return null;
    const a = worldPoint(from)(run.fromPointId);
    const b = worldPoint(to)(run.toPointId);
    if (!a || !b) return null;
    return cableRunLengthM({ pathMm: manhattanPath(a, b), slackPercent: run.slackPercent });
  };

  const boxes = layout.placements.map((p) => {
    const def = placeableDef(byId.get(p.componentId)!);
    return { id: p.id, x: p.x, y: p.y, width: def.size.width, height: def.size.height, clearanceMm: def.clearanceMm };
  });
  const clearance = clearanceViolations(boxes);
  const bounds = outOfBounds(boxes, layout.zone);
  const warnings: string[] = [];
  for (const v of clearance) {
    const an = byId.get(placementsById.get(v.a)?.componentId ?? "")?.modell ?? v.a;
    const bn = byId.get(placementsById.get(v.b)?.componentId ?? "")?.modell ?? v.b;
    warnings.push(`För lite fritt utrymme mellan ${an} och ${bn}.`);
  }
  for (const id of bounds) {
    const n = byId.get(placementsById.get(id)?.componentId ?? "")?.modell ?? id;
    warnings.push(`${n} hamnar utanför zonen.`);
  }

  return (
    <div className="layout">
      <div className="palette">
        <span>Lägg till:</span>
        {paletteComponents(SEED_COMPONENTS).map((c) => (
          <button key={c.id} onClick={() => addComponent(c.id)} title={c.modell}>
            + {c.modell}
          </button>
        ))}
        {layout.placements.length > 1 && (
          <button
            className="auto-place"
            onClick={autoPlace}
            title="Ordna alla komponenter snyggt i logisk ordning utan överlapp"
          >
            ✨ Placera automatiskt
          </button>
        )}
      </div>

      <div className="layout-controls">
        <label>
          Zon B (mm)
          <input
            type="number"
            value={layout.zone.width}
            onChange={(e) => setLayout({ ...layout, zone: { ...layout.zone, width: Number(e.target.value) || 1 } })}
          />
        </label>
        <label>
          Zon H (mm)
          <input
            type="number"
            value={layout.zone.height}
            onChange={(e) => setLayout({ ...layout, zone: { ...layout.zone, height: Number(e.target.value) || 1 } })}
          />
        </label>
        <label>
          Slack (%)
          <input type="number" value={slack} onChange={(e) => setSlack(Number(e.target.value))} />
        </label>
        {selected && (
          <>
            <button onClick={() => updatePlacement(selected, { rotation: ((placementsById.get(selected)?.rotation ?? 0) + 90) % 360 })}>
              Rotera ⟳
            </button>
            <button onClick={() => { removePlacement(selected); setSelected(null); }}>Ta bort</button>
          </>
        )}
      </div>

      <p className="hint">
        Klicka på en anslutningspunkt (●) och sedan en annan för att dra kabel. Dra komponenter för att flytta dem,
        eller låt <strong>✨ Placera automatiskt</strong> ordna dem snyggt i logisk ordning utan överlapp.
        {pending && " — välj målpunkt…"}
      </p>

      <svg
        ref={svgRef}
        className="layout-svg"
        width={layout.zone.width * scale}
        height={layout.zone.height * scale}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClick={() => setSelected(null)}
      >
        <rect x={0} y={0} width={layout.zone.width * scale} height={layout.zone.height * scale} className="zone-rect" />

        {/* Kabelrun */}
        {layout.runs.map((run) => {
          const from = placementsById.get(run.fromPlacementId);
          const to = placementsById.get(run.toPlacementId);
          if (!from || !to) return null;
          const a = worldPoint(from)(run.fromPointId);
          const b = worldPoint(to)(run.toPointId);
          if (!a || !b) return null;
          const pts = manhattanPath(a, b).map((p) => `${p.x * scale},${p.y * scale}`).join(" ");
          const mid = manhattanPath(a, b)[1] ?? a;
          const len = runLength(run);
          return (
            <g key={run.id}>
              <polyline points={pts} className="run-line" />
              {len !== null && (
                <text x={mid.x * scale + 4} y={mid.y * scale - 4} className="run-label">
                  {len.toFixed(2)} m
                </text>
              )}
            </g>
          );
        })}

        {/* Komponenter */}
        {layout.placements.map((p) => {
          const component = byId.get(p.componentId);
          if (!component) return null;
          const def = placeableDef(component);
          const cx = (p.x + def.size.width / 2) * scale;
          const cy = (p.y + def.size.height / 2) * scale;
          return (
            <g key={p.id} transform={`rotate(${p.rotation} ${cx} ${cy})`}>
              <rect
                x={p.x * scale}
                y={p.y * scale}
                width={def.size.width * scale}
                height={def.size.height * scale}
                className={`comp-rect${selected === p.id ? " selected" : ""}`}
                onPointerDown={(e) => onPointerDownPlacement(e, p)}
              />
              <text x={(p.x + 4) * scale} y={(p.y + 14) * scale} className="comp-label">
                {component.modell}
              </text>
              {def.points.map((pt) => (
                <circle
                  key={pt.id}
                  cx={(p.x + pt.x) * scale}
                  cy={(p.y + pt.y) * scale}
                  r={5}
                  className={`conn-point${pt.typ.includes("plus") ? " plus" : " minus"}${
                    pending?.placementId === p.id && pending.pointId === pt.id ? " pending" : ""
                  }`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    clickPoint({ placementId: p.id, pointId: pt.id });
                  }}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w, i) => (
            <li key={i}>⚠️ {w}</li>
          ))}
        </ul>
      )}

      {/* Kabelrun-lista */}
      {layout.runs.length > 0 && (
        <table className="run-table">
          <thead>
            <tr>
              <th>Kabelrun</th>
              <th>Längd (enkelväg)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {layout.runs.map((run) => {
              const len = runLength(run);
              const fromName = byId.get(placementsById.get(run.fromPlacementId)?.componentId ?? "")?.modell ?? "?";
              const toName = byId.get(placementsById.get(run.toPlacementId)?.componentId ?? "")?.modell ?? "?";
              return (
                <tr key={run.id}>
                  <td>
                    {fromName} → {toName}
                  </td>
                  <td>{len !== null ? `${len.toFixed(2)} m` : "—"}</td>
                  <td>
                    {len !== null && (
                      <button
                        className="link"
                        onClick={() => dispatch({ type: "patchCable", patch: { mainCableLengthM: Math.round(len * 100) / 100 } })}
                      >
                        Sätt som huvudkabel
                      </button>
                    )}
                    <button className="link" onClick={() => setLayout({ ...layout, runs: layout.runs.filter((r) => r.id !== run.id) })}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
