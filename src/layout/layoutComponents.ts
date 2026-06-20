/**
 * Adapter mellan komponentdatabasen och layout-canvasen.
 *
 * Ger varje komponent en ritbar storlek och anslutningspunkter. Saknas mått
 * eller punkter i seeden syntetiseras rimliga standardvärden (två DC-poler på
 * höger kant) så att planeraren fungerar redan innan databasen är komplett.
 */

import type { Component } from "../data/types.js";

/** Lokal anslutningspunkt på en komponent (mm från övre vänstra hörnet). */
export interface LocalPoint {
  id: string;
  typ: string;
  x: number;
  y: number;
}

/** Ritbar definition av en komponent. */
export interface PlaceableDef {
  size: { width: number; height: number };
  points: LocalPoint[];
  clearanceMm: number;
}

/** Komponenttyper som får placeras i layouten (paneler/kabel hör ej hemma i facket). */
export const LAYOUT_TYPES: Component["typ"][] = [
  "battery",
  "inverter",
  "mppt",
  "gx",
  "busbar",
  "accessory",
  "fuse",
];

const FALLBACK_SIZE: Partial<Record<Component["typ"], { width: number; height: number }>> = {
  accessory: { width: 90, height: 40 },
  busbar: { width: 350, height: 120 },
  fuse: { width: 70, height: 45 },
  inverter: { width: 110, height: 235 },
  mppt: { width: 113, height: 130 },
  gx: { width: 145, height: 45 },
  battery: { width: 200, height: 200 },
};

export function placeableDef(component: Component): PlaceableDef {
  const size = component.matt
    ? { width: component.matt.width, height: component.matt.height }
    : FALLBACK_SIZE[component.typ] ?? { width: 120, height: 120 };

  const declared = component.anslutningspunkter;
  const points: LocalPoint[] =
    declared && declared.length > 0
      ? declared.map((p) => ({ id: p.id, typ: p.typ, x: p.x, y: p.y }))
      : [
          { id: "dc+", typ: "dc_plus", x: size.width, y: size.height * 0.33 },
          { id: "dc-", typ: "dc_minus", x: size.width, y: size.height * 0.66 },
        ];

  return { size, points, clearanceMm: component.monteringskrav?.clearanceMm ?? 0 };
}

/** Komponenter ur databasen som kan placeras i layouten. */
export function paletteComponents(components: readonly Component[]): Component[] {
  return components.filter((c) => LAYOUT_TYPES.includes(c.typ));
}
