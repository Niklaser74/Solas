/**
 * Editor för egna produkter: ladda upp en bild, ange mått (mm) och klicka ut
 * anslutningspunkter direkt på bilden. Resultatet är en `Component` som läggs i
 * projektets bibliotek och kan placeras i layouten med riktig bild i stället för
 * en platshållare.
 */

import { useMemo, useState } from "react";
import type { Component, ComponentType, ConnectionType } from "../data/types.js";
import { imagePointToMm } from "./geometry.js";
import { fileToScaledDataUrl } from "./imageUtil.js";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `lib-${Math.random().toString(36).slice(2)}`;

/** Komponenttyper som får skapas (samma som kan placeras i layouten). */
const TYPE_OPTIONS: { value: ComponentType; label: string }[] = [
  { value: "battery", label: "Batteri" },
  { value: "inverter", label: "Växelriktare" },
  { value: "mppt", label: "Solcellsregulator (MPPT)" },
  { value: "gx", label: "GX / styrenhet" },
  { value: "busbar", label: "Samlingsskena" },
  { value: "fuse", label: "Säkring" },
  { value: "accessory", label: "Tillbehör" },
];

/** Anslutningstyper med etikett. Plus/minus färgas i listan och canvasen. */
const CONNECTION_OPTIONS: { value: ConnectionType; label: string }[] = [
  { value: "dc_plus", label: "DC +" },
  { value: "dc_minus", label: "DC −" },
  { value: "pv_plus", label: "PV +" },
  { value: "pv_minus", label: "PV −" },
  { value: "ac_in", label: "AC in" },
  { value: "ac_out", label: "AC ut" },
  { value: "ve_bus", label: "VE.Bus" },
  { value: "ve_direct", label: "VE.Direct" },
  { value: "ve_can", label: "VE.Can" },
];

interface EditPoint {
  id: string;
  typ: ConnectionType;
  x: number;
  y: number;
}

const MAX_DISPLAY_W = 360;
const MAX_DISPLAY_H = 280;

export function ComponentEditor({
  existing,
  onSave,
  onClose,
}: {
  existing?: Component | null;
  onSave: (component: Component) => void;
  onClose: () => void;
}) {
  const [namn, setNamn] = useState(existing?.modell ?? "");
  const [typ, setTyp] = useState<ComponentType>(existing?.typ ?? "accessory");
  const [width, setWidth] = useState(existing?.matt?.width ?? 200);
  const [height, setHeight] = useState(existing?.matt?.height ?? 150);
  const [clearance, setClearance] = useState(existing?.monteringskrav?.clearanceMm ?? 0);
  const [bildUrl, setBildUrl] = useState<string | undefined>(existing?.bildUrl);
  const [points, setPoints] = useState<EditPoint[]>(
    (existing?.anslutningspunkter ?? []).map((p) => ({ id: p.id, typ: p.typ, x: p.x, y: p.y })),
  );
  const [penType, setPenType] = useState<ConnectionType>("dc_plus");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bildens visade storlek (px), proportionell mot måtten.
  const display = useMemo(() => {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const scale = Math.min(MAX_DISPLAY_W / w, MAX_DISPLAY_H / h);
    return { width: w * scale, height: h * scale };
  }, [width, height]);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setBildUrl(await fileToScaledDataUrl(file));
    } catch {
      setError("Kunde inte läsa bilden.");
    } finally {
      setBusy(false);
    }
  };

  const addPointAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const local = imagePointToMm({
      clickPx: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      displayPx: { width: rect.width, height: rect.height },
      realMm: { width, height },
    });
    setPoints((ps) => [...ps, { id: uid(), typ: penType, x: local.x, y: local.y }]);
  };

  const save = () => {
    if (!namn.trim()) return setError("Ange ett namn.");
    if (width <= 0 || height <= 0) return setError("Bredd och höjd måste vara större än 0.");
    const component: Component = {
      id: existing?.id ?? uid(),
      typ,
      modell: namn.trim(),
      specs: existing?.specs ?? {},
      matt: { width, height, depth: existing?.matt?.depth ?? 0 },
      anslutningspunkter: points.map((p) => ({ id: p.id, typ: p.typ, x: p.x, y: p.y })),
      monteringskrav: clearance > 0 ? { clearanceMm: clearance } : undefined,
      bildUrl,
      prisSek: existing?.prisSek ?? 0,
      gronTeknikKategori: existing?.gronTeknikKategori ?? "ingen",
    };
    onSave(component);
  };

  return (
    <div className="editor-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="editor" onClick={(e) => e.stopPropagation()}>
        <header className="editor-head">
          <h3>{existing ? "Redigera produkt" : "Ny egen produkt"}</h3>
          <button className="link" onClick={onClose} aria-label="Stäng">
            ✕
          </button>
        </header>

        <div className="editor-body">
          <div className="editor-fields">
            <label>
              Namn
              <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="t.ex. Egen 200Ah LiFePO4" />
            </label>
            <label>
              Typ
              <select value={typ} onChange={(e) => setTyp(e.target.value as ComponentType)}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="editor-row">
              <label>
                Bredd (mm)
                <input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value) || 0)} />
              </label>
              <label>
                Höjd (mm)
                <input type="number" min={1} value={height} onChange={(e) => setHeight(Number(e.target.value) || 0)} />
              </label>
              <label>
                Clearance (mm)
                <input type="number" min={0} value={clearance} onChange={(e) => setClearance(Number(e.target.value) || 0)} />
              </label>
            </div>
            <label>
              Produktbild
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label>
              Anslutningstyp att placera
              <select value={penType} onChange={(e) => setPenType(e.target.value as ConnectionType)}>
                {CONNECTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {points.length > 0 && (
              <ul className="point-list">
                {points.map((p) => (
                  <li key={p.id}>
                    <span className={`dot ${p.typ.includes("plus") ? "plus" : p.typ.includes("minus") ? "minus" : "neutral"}`} />
                    <select
                      value={p.typ}
                      onChange={(e) =>
                        setPoints((ps) => ps.map((q) => (q.id === p.id ? { ...q, typ: e.target.value as ConnectionType } : q)))
                      }
                    >
                      {CONNECTION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="muted">
                      {p.x}, {p.y} mm
                    </span>
                    <button className="link" onClick={() => setPoints((ps) => ps.filter((q) => q.id !== p.id))}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="editor-preview">
            <p className="hint">
              {bildUrl
                ? "Klicka på bilden för att placera en anslutningspunkt."
                : "Ladda upp en bild för att placera anslutningspunkter."}
            </p>
            <div
              className="preview-stage"
              style={{ width: display.width, height: display.height }}
              onClick={bildUrl ? addPointAt : undefined}
            >
              {bildUrl ? (
                <img src={bildUrl} alt={namn || "Produkt"} draggable={false} />
              ) : (
                <div className="preview-empty">Ingen bild</div>
              )}
              {points.map((p) => (
                <span
                  key={p.id}
                  className={`pt ${p.typ.includes("plus") ? "plus" : p.typ.includes("minus") ? "minus" : "neutral"}`}
                  style={{
                    left: (p.x / Math.max(1, width)) * display.width,
                    top: (p.y / Math.max(1, height)) * display.height,
                  }}
                  title={p.typ}
                />
              ))}
            </div>
          </div>
        </div>

        {error && <p className="editor-error">⚠️ {error}</p>}

        <footer className="editor-foot">
          <button className="ghost" onClick={onClose}>
            Avbryt
          </button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? "Bearbetar bild…" : "Spara produkt"}
          </button>
        </footer>
      </div>
    </div>
  );
}
