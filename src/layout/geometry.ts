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

/** En komponent som ska auto-placeras: fotavtryck + valfri sorteringsvikt. */
export interface ArrangeItem {
  id: string;
  width: number;
  height: number;
  /** Krävt fritt utrymme runt komponenten, mm. */
  clearanceMm?: number;
  /** Sorteringsvikt (lägre = tidigare i flödet, t.ex. batteri före växelriktare). */
  order?: number;
}

/** Inställningar för auto-placering. */
export interface ArrangeOptions {
  /** Marginal mot zonens kanter, mm. */
  marginMm?: number;
  /** Minsta mellanrum mellan komponenter, mm (utöver respektive clearance). */
  gapMm?: number;
}

const DEFAULT_MARGIN_MM = 20;
const DEFAULT_GAP_MM = 20;

/**
 * Placerar komponenterna snyggt i zonen: logisk ordning (via `order`), radvis
 * vänster→höger, utan överlapp och med respekterad clearance. Komponenter som
 * inte ryms på en rad bryts till nästa rad. Returnerar nya positioner — muterar
 * inget och flyttar inte komponenter som redan är i ordning om de inte behöver.
 */
export function autoArrange(
  items: readonly ArrangeItem[],
  zone: { width: number; height: number },
  opts: ArrangeOptions = {},
): Array<{ id: string; x: number; y: number }> {
  const margin = opts.marginMm ?? DEFAULT_MARGIN_MM;
  const baseGap = opts.gapMm ?? DEFAULT_GAP_MM;
  // Radavstånd som tål clearance även mellan komponenter snett över rader.
  const maxClearance = items.reduce((m, it) => Math.max(m, it.clearanceMm ?? 0), 0);
  const rowGap = baseGap + maxClearance;

  const sorted = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (a.it.order ?? 0) - (b.it.order ?? 0) || a.i - b.i)
    .map((x) => x.it);

  const out: Array<{ id: string; x: number; y: number }> = [];
  let cursorX = margin;
  let cursorY = margin;
  let rowHeight = 0;
  let prevClearance = 0;
  let firstInRow = true;

  for (const it of sorted) {
    const clearance = it.clearanceMm ?? 0;
    let gapBefore = firstInRow ? 0 : baseGap + Math.max(prevClearance, clearance);
    // Bryt till ny rad om komponenten (med högermarginal) inte ryms.
    if (!firstInRow && cursorX + gapBefore + it.width + margin > zone.width) {
      cursorY += rowHeight + rowGap;
      cursorX = margin;
      rowHeight = 0;
      gapBefore = 0;
      firstInRow = true;
    }
    const x = cursorX + gapBefore;
    out.push({ id: it.id, x: Math.round(x), y: Math.round(cursorY) });
    cursorX = x + it.width;
    rowHeight = Math.max(rowHeight, it.height);
    prevClearance = clearance;
    firstInRow = false;
  }
  return out;
}

/**
 * Första lediga position (rutnätssökning uppifrån vänster) för en ny komponent,
 * utan överlapp eller clearance-brott mot befintliga. Faller tillbaka på övre
 * vänstra hörnet om ingen plats hittas.
 */
export function firstFreeSpot(
  boxes: readonly PlacedBox[],
  size: SizeGeom,
  zone: { width: number; height: number },
  opts: ArrangeOptions & { stepMm?: number } = {},
): Point {
  const margin = opts.marginMm ?? DEFAULT_MARGIN_MM;
  const gap = opts.gapMm ?? DEFAULT_GAP_MM;
  const step = opts.stepMm ?? DEFAULT_GAP_MM;

  const free = (x: number, y: number): boolean => {
    const candidate: PlacedBox = { id: "__new", x, y, width: size.width, height: size.height, clearanceMm: gap };
    return boxes.every((b) => !rectsOverlap(expand(b, Math.max(b.clearanceMm ?? 0, gap)), candidate));
  };

  for (let y = margin; y + size.height + margin <= zone.height; y += step) {
    for (let x = margin; x + size.width + margin <= zone.width; x += step) {
      if (free(x, y)) return { x, y };
    }
  }
  return { x: margin, y: margin };
}
