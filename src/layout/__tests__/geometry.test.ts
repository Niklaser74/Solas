import { describe, it, expect } from "vitest";
import {
  polylineLengthMm,
  manhattanPath,
  rotatePoint,
  connectionWorldPos,
  cableRunLengthM,
  clearanceViolations,
  outOfBounds,
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
