/** Delade UI-byggstenar för guiden. Svenska etiketter, enkel CSS. */

import type { ReactNode } from "react";
import type { Bom } from "../bom/assembleBom.js";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
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
      <span>{props.label}</span>
      <span className="field-input">
        <input
          type="number"
          value={Number.isFinite(props.value) ? props.value : ""}
          step={props.step ?? 1}
          min={props.min}
          onChange={(e) => props.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
        {props.suffix && <em>{props.suffix}</em>}
      </span>
    </label>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>{props.label}</span>
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
      <span>{props.label}</span>
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
            <dd>{r.value}</dd>
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
    <ul className="warnings">
      {warnings.map((w, i) => (
        <li key={i}>⚠️ {w}</li>
      ))}
    </ul>
  );
}

export function Disclaimer() {
  return (
    <p className="disclaimer">
      Endast planeringshjälpmedel. Kabelarea, säkringar och komponentval måste verifieras mot gällande
      standard (IEC/svensk praxis) och tillverkarnas datablad före installation. Dimensas är ett oberoende
      verktyg för Victron-system och är inte kopplat till Victron Energy.
    </p>
  );
}

export const sek = (n: number): string =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

export function BomTable({ bom }: { bom: Bom }) {
  return (
    <table className="bom-table">
      <thead>
        <tr>
          <th>Komponent</th>
          <th>Antal</th>
          <th>À-pris</th>
          <th>Radsumma</th>
        </tr>
      </thead>
      <tbody>
        {bom.items.map((i) => (
          <tr key={i.component.id}>
            <td>
              {i.component.modell}
              {i.note && <small className="bom-note">{i.note}</small>}
            </td>
            <td>{i.quantity}</td>
            <td>{sek(i.unitPriceSek)}</td>
            <td>{sek(i.lineTotalSek)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th colSpan={3}>Totalt</th>
          <th>{sek(bom.totalSek)}</th>
        </tr>
        <tr>
          <td colSpan={3}>Underlag grönt avdrag (sol + batteri)</td>
          <td>{sek(bom.greenEligibleSek)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
