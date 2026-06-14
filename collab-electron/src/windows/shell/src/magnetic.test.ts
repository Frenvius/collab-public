import { describe, test, expect, beforeEach } from "bun:test";
import { tiles } from "./canvas-state.js";
import { collectGluedChain, computeDragSnap } from "./magnetic.js";

function setTiles(list: any[]) {
  tiles.splice(0, tiles.length, ...list);
}

const box = (id: string, x: number, y: number, width = 100, height = 100) =>
  ({ id, type: "term", x, y, width, height, zIndex: 1 });

beforeEach(() => setTiles([]));

describe("collectGluedChain", () => {
  test("chains through neighbours-of-neighbours on the east side", () => {
    const a = box("a", 0, 0);
    setTiles([a, box("b", 100, 0), box("c", 200, 0)]);
    const chain = collectGluedChain(a, "e").map((t) => t.id);
    expect(chain).toEqual(["b", "c"]);
  });

  test("ignores tiles that do not overlap on the perpendicular axis", () => {
    const a = box("a", 0, 0);
    setTiles([a, box("b", 100, 0), box("far", 100, 500)]);
    const chain = collectGluedChain(a, "e").map((t) => t.id);
    expect(chain).toEqual(["b"]);
  });

  test("ignores tiles separated by a gap", () => {
    const a = box("a", 0, 0);
    setTiles([a, box("b", 140, 0)]);
    expect(collectGluedChain(a, "e")).toHaveLength(0);
  });

  test("walks west independently of east", () => {
    const a = box("a", 200, 0);
    setTiles([box("left", 100, 0), a, box("right", 300, 0)]);
    expect(collectGluedChain(a, "w").map((t) => t.id)).toEqual(["left"]);
    expect(collectGluedChain(a, "e").map((t) => t.id)).toEqual(["right"]);
  });
});

describe("computeDragSnap", () => {
  test("snaps a near right edge flush to a neighbour's left edge", () => {
    setTiles([box("o", 200, 0)]);
    const moving = box("m", 97, 0); // right edge at 197, target 200
    const snap = computeDragSnap(moving, 8);
    expect(snap.x).toBe(100); // tile.x so that right edge == 200
  });

  test("snaps aligned left edges when vertically near", () => {
    setTiles([box("o", 200, 0)]);
    const moving = box("m", 203, 0);
    const snap = computeDragSnap(moving, 8);
    expect(snap.x).toBe(200);
  });

  test("returns null on an axis when nothing is within threshold", () => {
    setTiles([box("o", 500, 500)]);
    const moving = box("m", 0, 0);
    const snap = computeDragSnap(moving, 8);
    expect(snap.x).toBeNull();
    expect(snap.y).toBeNull();
  });
});
