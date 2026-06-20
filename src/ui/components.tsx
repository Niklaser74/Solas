/** Delade UI-byggstenar för guiden, enligt Dimensas brand-system.
 *  Grotesk för ord, mono för mätbara tal. Svenska etiketter. */

import type { ReactNode } from "react";
import type { Bom } from "../bom/assembleBom.js";

/** Svensk talformatering: decimalkomma, tunt mellanslag som tusentalsavgränsare. */
export const nf = (n: number, decimals = 0): string =>
  new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(n);

export const sek = (n: number): string =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

/** Sektion med eyebrow (stegnummer i mono) + rubrik (grotesk). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const m = /^(Steg\s+\d+\w*)\s*[—-]\s*(.+)$/.exec(title);
  const eyebrow = m?.[1];
  const heading = m?.[2] ?? title;
  return (
    <section className="section">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{heading}</h2>
      {children}
    </section>
  );
}

export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <input
          className="num"
          type="number"
          value={Number.isFinite(props.value) ? props.value : ""}
          step={props.step ?? 1}
          min={props.min}
          onChange={(e) => props.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
        {props.suffix && <em className="unit-pill">{props.suffix}</em>}
      </span>
    </label>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <input type="text" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      </span>
    </label>
  );
}

export function SelectField<T extends string | number>(props: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <select
          value={String(props.value)}
          onChange={(e) => {
            const opt = props.options.find((o) => String(o.value) === e.target.value);
            if (opt) props.onChange(opt.value);
          }}
        >
          {props.options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

/** Segmenterad kontroll (12/24/48 V m.m.) — mono, aktiv = accent. */
export function SegmentedControl<T extends string | number>(props: {
  label?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      {props.label && <span className="field-label">{props.label}</span>}
      <div className="segmented" role="tablist">
        {props.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={o.value === props.value}
            className={`seg${o.value === props.value ? " active" : ""}`}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CheckboxField(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="field field-checkbox">
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}

export function ResultCard(props: {
  rows: Array<{ label: string; value: string }>;
  rationale?: string;
  warnings?: string[];
}) {
  return (
    <div className="result-card">
      <dl>
        {props.rows.map((r) => (
          <div key={r.label} className="result-row">
            <dt>{r.label}</dt>
            <dd className="num">{r.value}</dd>
          </div>
        ))}
      </dl>
      {props.rationale && <p className="rationale">{props.rationale}</p>}
      <Warnings warnings={props.warnings} />
    </div>
  );
}

export function Warnings({ warnings }: { warnings?: string[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <ul className="callout-warning">
      {warnings.map((w, i) => (
        <li key={i}>
          <WarnIcon />
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
}

function WarnIcon() {
  return (
    <svg className="warn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4 2.5 20.5h19L12 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

/** Obligatorisk disclaimer — ordagrann brand-text. */
export function Disclaimer() {
  return (
    <div className="disclaimer">
      <p>Dimensas är ett oberoende verktyg för Victron-baserade system. Inte anslutet till, eller godkänt av, Victron Energy.</p>
      <p>Endast för planering — verifiera mot gällande standard och tillverkarens specifikation.</p>
    </div>
  );
}

export function BomTable({ bom }: { bom: Bom }) {
  return (
    <table className="bom-table">
      <thead>
        <tr>
          <th>Artikel</th>
          <th>Antal</th>
          <th>À-pris</th>
          <th>Summa</th>
        </tr>
      </thead>
      <tbody>
        {bom.items.map((i) => (
          <tr key={i.component.id}>
            <td>
              <span className="bom-name">{i.component.modell}</span>
              {i.component.victronArtikelnr && <span className="bom-art num">{i.component.victronArtikelnr}</span>}
              {i.note && <small className="bom-note">{i.note}</small>}
            </td>
            <td className="num">{i.quantity}</td>
            <td className="num">{sek(i.unitPriceSek)}</td>
            <td className="num">{sek(i.lineTotalSek)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bom-total">
          <th colSpan={3}>Totalt</th>
          <th className="num">{sek(bom.totalSek)}</th>
        </tr>
        <tr>
          <td colSpan={3}>Underlag grönt avdrag (sol + batteri)</td>
          <td className="num">{sek(bom.greenEligibleSek)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
