import { describe, it, expect } from "vitest";
import {
  polylineLengthMm,
  manhattanPath,
  rotatePoint,
  connectionWorldPos,
  cableRunLengthM,
  clearanceViolations,
  outOfBounds,
  autoArrange,
  firstFreeSpot,
  imagePointToMm,
} from "../geometry.js";

describe("polylineLengthMm", () => {
  it("summerar segmentlängder", () => {
    expect(polylineLengthMm([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }])).toBe(700);
  });
  it("är 0 för en enda punkt", () => {
    expect(polylineLengthMm([{ x: 5, y: 5 }])).toBe(0);
  });
});

describe("manhattanPath", () => {
  it("ger en L-form via hörn", () => {
    expect(manhattanPath({ x: 0, y: 0 }, { x: 300, y: 400 })).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 400 },
    ]);
  });
  it("ger rak linje när punkterna delar axel", () => {
    expect(manhattanPath({ x: 0, y: 0 }, { x: 0, y: 400 })).toEqual([{ x: 0, y: 0 }, { x: 0, y: 400 }]);
  });
});

describe("rotatePoint", () => {
  it("roterar 90° medurs runt origo", () => {
    const r = rotatePoint({ x: 100, y: 0 }, { x: 0, y: 0 }, 90);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(100, 6);
  });
});

describe("connectionWorldPos", () => {
  it("utan rotation = placering + lokal position", () => {
    const p = connectionWorldPos({
      placement: { x: 50, y: 20, rotation: 0 },
      size: { width: 200, height: 400 },
      local: { x: 10, y: 5 },
    });
    expect(p).toEqual({ x: 60, y: 25 });
  });
  it("roterar runt komponentens mittpunkt", () => {
    const p = connectionWorldPos({
      placement: { x: 0, y: 0, rotation: 90 },
      size: { width: 200, height: 400 },
      local: { x: 10, y: 20 },
    });
    expect(p.x).toBeCloseTo(280, 6);
    expect(p.y).toBeCloseTo(110, 6);
  });
});

describe("cableRunLengthM", () => {
  it("ger meter med slack", () => {
    expect(cableRunLengthM({ pathMm: [{ x: 0, y: 0 }, { x: 0, y: 1000 }], slackPercent: 10 })).toBeCloseTo(1.1, 6);
  });
  it("lägger på inter-zon-påslag", () => {
    const m = cableRunLengthM({
      pathMm: [{ x: 0, y: 0 }, { x: 0, y: 1000 }],
      slackPercent: 10,
      interZoneSurchargeMm: 500,
    });
    expect(m).toBeCloseTo(1.6, 6);
  });
});

describe("clearanceViolations", () => {
  const a = { id: "a", x: 0, y: 0, width: 100, height: 100, clearanceMm: 50 };
  it("flaggar lådor inom clearance", () => {
    const b = { id: "b", x: 120, y: 0, width: 100, height: 100 };
    expect(clearanceViolations([a, b])).toEqual([{ a: "a", b: "b" }]);
  });
  it("godkänner lådor med tillräckligt avstånd", () => {
    const b = { id: "b", x: 200, y: 0, width: 100, height: 100 };
    expect(clearanceViolations([a, b])).toEqual([]);
  });
});

describe("outOfBounds", () => {
  it("hittar komponenter utanför zonen", () => {
    const boxes = [
      { id: "inne", x: 10, y: 10, width: 100, height: 100 },
      { id: "ute", x: 950, y: 10, width: 100, height: 100 },
    ];
    expect(outOfBounds(boxes, { width: 1000, height: 600 })).toEqual(["ute"]);
  });
});

describe("autoArrange", () => {
  const zone = { width: 1000, height: 600 };

  it("sorterar efter order (lägre först) i en rad", () => {
    const out = autoArrange(
      [
        { id: "inv", width: 110, height: 235, order: 5 },
        { id: "batt", width: 200, height: 200, order: 0 },
        { id: "fuse", width: 70, height: 45, order: 1 },
      ],
      zone,
    );
    expect(out.map((p) => p.id)).toEqual(["batt", "fuse", "inv"]);
    // Vänster→höger, stigande x.
    expect(out[0].x).toBeLessThan(out[1].x);
    expect(out[1].x).toBeLessThan(out[2].x);
  });

  it("placerar utan överlapp eller clearance-brott", () => {
    const items = [
      { id: "a", width: 200, height: 200, clearanceMm: 50, order: 0 },
      { id: "b", width: 200, height: 200, clearanceMm: 50, order: 1 },
      { id: "c", width: 200, height: 200, clearanceMm: 50, order: 2 },
    ];
    const pos = new Map(autoArrange(items, zone).map((p) => [p.id, p]));
    const boxes = items.map((it) => ({ ...it, x: pos.get(it.id)!.x, y: pos.get(it.id)!.y }));
    expect(clearanceViolations(boxes)).toEqual([]);
  });

  it("bryter till ny rad när komponenterna inte ryms på bredden", () => {
    const narrow = { width: 500, height: 600 };
    const items = [
      { id: "a", width: 200, height: 100 },
      { id: "b", width: 200, height: 100 },
      { id: "c", width: 200, height: 100 },
    ];
    const out = autoArrange(items, narrow);
    // c ryms inte på rad 1 (200+gap+200+gap+200 > 500) → hamnar lägre.
    const byId = new Map(out.map((p) => [p.id, p]));
    expect(byId.get("c")!.y).toBeGreaterThan(byId.get("a")!.y);
  });

  it("är tom för inga komponenter", () => {
    expect(autoArrange([], zone)).toEqual([]);
  });
});

describe("imagePointToMm", () => {
  it("skalar klickpunkt i visad bild till mm efter måtten", () => {
    const p = imagePointToMm({
      clickPx: { x: 180, y: 70 },
      displayPx: { width: 360, height: 280 },
      realMm: { width: 200, height: 150 },
    });
    // 180/360 = 0.5 → 100 mm, 70/280 = 0.25 → 37.5 → 38 mm.
    expect(p).toEqual({ x: 100, y: 38 });
  });

  it("klampar punkter utanför bilden till kanten", () => {
    const p = imagePointToMm({
      clickPx: { x: -10, y: 999 },
      displayPx: { width: 360, height: 280 },
      realMm: { width: 200, height: 150 },
    });
    expect(p).toEqual({ x: 0, y: 150 });
  });

  it("ger 0 när bilden saknar storlek", () => {
    expect(imagePointToMm({ clickPx: { x: 5, y: 5 }, displayPx: { width: 0, height: 0 }, realMm: { width: 200, height: 150 } })).toEqual({ x: 0, y: 0 });
  });
});

describe("firstFreeSpot", () => {
  const zone = { width: 1000, height: 600 };

  it("hittar en plats som inte krockar med befintliga lådor", () => {
    const boxes = [{ id: "a", x: 20, y: 20, width: 200, height: 200, clearanceMm: 0 }];
    const spot = firstFreeSpot(boxes, { width: 100, height: 100 }, zone);
    const candidate = { id: "new", x: spot.x, y: spot.y, width: 100, height: 100 };
    expect(clearanceViolations([...boxes, candidate])).toEqual([]);
    expect(outOfBounds([candidate], zone)).toEqual([]);
  });

  it("placerar i hörnet när zonen är tom", () => {
    expect(firstFreeSpot([], { width: 100, height: 100 }, zone)).toEqual({ x: 20, y: 20 });
  });
});
