/**
 * Geometri för fysisk layout (Steg 7) — rena, testbara funktioner.
 *
 * Allt räknas i millimeter i zonens koordinatsystem (origo övre vänstra
 * hörnet). Kabellängd matar Steg 8: `cableRunLengthM` ger enkelvägslängd i
 * meter; spänningsfallsmotorn dubblar sedan för fram + retur.
 */

/** En punkt i zonen, mm. */
export interface Point {
  x: number;
  y: number;
}

/** Total längd för en polyline, mm. */
export function polylineLengthMm(points: readonly Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/** Rätvinklig (manhattan) dragväg mellan två punkter: horisontellt → vertikalt. */
export function manhattanPath(from: Point, to: Point): Point[] {
  if (from.x === to.x || from.y === to.y) return [from, to];
  return [from, { x: to.x, y: from.y }, to];
}

/** Roterar en punkt `deg` grader (medurs) runt `origin`. */
export function rotatePoint(p: Point, origin: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** En komponents placering i zonen. */
export interface PlacementGeom {
  x: number;
  y: number;
  rotation: number;
}

/** Komponentens mått (B×H), mm. */
export interface SizeGeom {
  width: number;
  height: number;
}

/**
 * Absolut position för en anslutningspunkt, med hänsyn till placeringens
 * position och rotation (runt komponentens mittpunkt).
 */
export function connectionWorldPos(args: {
  placement: PlacementGeom;
  size: SizeGeom;
  /** Lokal position på komponenten (från övre vänstra hörnet), mm. */
  local: Point;
}): Point {
  const { placement, size, local } = args;
  const abs = { x: placement.x + local.x, y: placement.y + local.y };
  const center = { x: placement.x + size.width / 2, y: placement.y + size.height / 2 };
  return rotatePoint(abs, center, placement.rotation);
}

/**
 * Enkelvägslängd för ett kabelrun, m.
 *   längd = polyline × (1 + slack%) + inter-zon-påslag
 */
export function cableRunLengthM(args: {
  pathMm: readonly Point[];
  /** Slack i procent (böjradie/marginal). Standard 0. */
  slackPercent?: number;
  /** Påslag för dragning mellan zoner, mm. Standard 0. */
  interZoneSurchargeMm?: number;
}): number {
  const slack = args.slackPercent ?? 0;
  const surcharge = args.interZoneSurchargeMm ?? 0;
  const raw = polylineLengthMm(args.pathMm) * (1 + slack / 100) + surcharge;
  return raw / 1000;
}

/** En placerad komponent som en axelinriktad ruta (för clearance/bounds). */
export interface PlacedBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Krävt fritt utrymme runt komponenten, mm. */
  clearanceMm?: number;
}

function expand(b: PlacedBox, m: number): PlacedBox {
  return { ...b, x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: b.height + 2 * m };
}

function rectsOverlap(a: PlacedBox, b: PlacedBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Par av komponenter som bryter mot varandras clearance (eller överlappar).
 * Clearance mellan två lådor tas som den största av deras krav.
 */
export function clearanceViolations(boxes: readonly PlacedBox[]): Array<{ a: string; b: string }> {
  const out: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const gap = Math.max(boxes[i].clearanceMm ?? 0, boxes[j].clearanceMm ?? 0);
      if (rectsOverlap(expand(boxes[i], gap), boxes[j])) out.push({ a: boxes[i].id, b: boxes[j].id });
    }
  }
  return out;
}

/** Komponenter som sticker utanför zonens gränser. */
export function outOfBounds(
  boxes: readonly PlacedBox[],
  zone: { width: number; height: number },
): string[] {
  return boxes
    .filter((b) => b.x < 0 || b.y < 0 || b.x + b.width > zone.width || b.y + b.height > zone.height)
    .map((b) => b.id);
}
