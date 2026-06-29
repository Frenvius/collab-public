import { tiles } from "./canvas-state.js";

const GLUE_EPS = 1;

function yRangesTouch(a, b, tol = 0) {
  return a.y < b.y + b.height + tol && a.y + a.height > b.y - tol;
}

function xRangesTouch(a, b, tol = 0) {
  return a.x < b.x + b.width + tol && a.x + a.width > b.x - tol;
}

function isGluedOnSide(t, o, side) {
  switch (side) {
    case "e":
      return Math.abs(o.x - (t.x + t.width)) <= GLUE_EPS && yRangesTouch(t, o);
    case "w":
      return Math.abs(o.x + o.width - t.x) <= GLUE_EPS && yRangesTouch(t, o);
    case "s":
      return Math.abs(o.y - (t.y + t.height)) <= GLUE_EPS && xRangesTouch(t, o);
    case "n":
      return Math.abs(o.y + o.height - t.y) <= GLUE_EPS && xRangesTouch(t, o);
    default:
      return false;
  }
}

/**
 * Walks the glue graph outward from `root` along one side, returning every tile
 * rigidly attached in that direction (chained: neighbours of neighbours).
 * @param {import('./canvas-state.js').Tile} root
 * @param {'e'|'w'|'n'|'s'} side
 * @param {(tile: import('./canvas-state.js').Tile) => boolean} [filter] keep only matching tiles in the chain
 * @returns {import('./canvas-state.js').Tile[]}
 */
export function collectGluedChain(root, side, filter) {
  const result = [];
  const seen = new Set([root.id]);
  const queue = [root];
  while (queue.length) {
    const t = queue.shift();
    for (const o of tiles) {
      if (seen.has(o.id)) continue;
      if (filter && !filter(o)) continue;
      if (isGluedOnSide(t, o, side)) {
        seen.add(o.id);
        result.push(o);
        queue.push(o);
      }
    }
  }
  return result;
}

/**
 * Finds the nearest edge a dragged tile should magnetise to on each axis.
 * Considers both adjacency (sit flush against a neighbour) and alignment
 * (share a left/right/top/bottom edge). Returns the snapped top-left, with
 * `null` on an axis when nothing is within `threshold` (canvas units).
 * @param {import('./canvas-state.js').Tile} tile
 * @param {number} threshold
 * @returns {{ x: number | null, y: number | null }}
 */
export function computeDragSnap(tile, threshold) {
  const L = tile.x;
  const R = tile.x + tile.width;
  const T = tile.y;
  const B = tile.y + tile.height;

  let bestX = null;
  let bestXd = threshold;
  let bestY = null;
  let bestYd = threshold;

  const considerX = (targetX) => {
    const d = Math.abs(targetX - tile.x);
    if (d < bestXd) {
      bestXd = d;
      bestX = targetX;
    }
  };
  const considerY = (targetY) => {
    const d = Math.abs(targetY - tile.y);
    if (d < bestYd) {
      bestYd = d;
      bestY = targetY;
    }
  };

  for (const o of tiles) {
    if (o.id === tile.id) continue;
    const oL = o.x;
    const oR = o.x + o.width;
    const oT = o.y;
    const oB = o.y + o.height;

    if (T < oB + threshold && B > oT - threshold) {
      considerX(oR);
      considerX(oL - tile.width);
      considerX(oL);
      considerX(oR - tile.width);
    }
    if (L < oR + threshold && R > oL - threshold) {
      considerY(oB);
      considerY(oT - tile.height);
      considerY(oT);
      considerY(oB - tile.height);
    }
  }

  return { x: bestX, y: bestY };
}
