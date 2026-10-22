import { centerScheme, colorCounts } from './convert';
import { COLORS, FACES, type ColorName, type Face, type StickerArray } from './types';

/** Kociemba facelet indices for corners and edges (URFDLB, 0-based). */
const U = 0, R = 9, F = 18, D = 27, L = 36, B = 45;
export const CORNER_FACELETS: number[][] = [
  [U + 8, R + 0, F + 2], // URF
  [U + 6, F + 0, L + 2], // UFL
  [U + 0, L + 0, B + 2], // ULB
  [U + 2, B + 0, R + 2], // UBR
  [D + 2, F + 8, R + 6], // DFR
  [D + 0, L + 8, F + 6], // DLF
  [D + 6, B + 8, L + 6], // DBL
  [D + 8, R + 8, B + 6], // DRB
];
export const CORNER_FACES: Face[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
export const EDGE_FACELETS: number[][] = [
  [U + 5, R + 1], [U + 7, F + 1], [U + 3, L + 1], [U + 1, B + 1],
  [D + 5, R + 7], [D + 1, F + 7], [D + 3, L + 7], [D + 7, B + 7],
  [F + 5, R + 3], [F + 3, L + 5], [B + 5, L + 3], [B + 3, R + 5],
];
export const EDGE_FACES: Face[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
  ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

export type ValidationCode =
  | 'incomplete'
  | 'color-count'
  | 'centers'
  | 'invalid-corner'
  | 'duplicate-corner'
  | 'invalid-edge'
  | 'duplicate-edge'
  | 'corner-twist'
  | 'edge-flip'
  | 'parity';

export interface ValidationIssue {
  code: ValidationCode;
  message: string;
  /** Sticker indices involved, for highlighting in the UI. */
  stickers: number[];
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  /** Present only when ok. */
  facelets?: string;
}

const POS_NAME = (faces: Face[]) => faces.map((f) => ({ U: 'Up', R: 'Right', F: 'Front', D: 'Down', L: 'Left', B: 'Back' })[f]).join('-');

function parity(perm: number[]): number {
  let inv = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[i] > perm[j]) inv++;
  return inv % 2;
}

/**
 * Validate that 54 colored stickers describe a cube reachable from the solved state.
 * Never modifies the input; reports every problem it can find in the order users should fix them.
 */
export function validateStickers(stickers: StickerArray): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (stickers.length !== 54) {
    return { ok: false, issues: [{ code: 'incomplete', message: `Expected 54 stickers, got ${stickers.length}.`, stickers: [] }] };
  }
  const missing = stickers.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) {
    issues.push({ code: 'incomplete', message: `${missing.length} sticker${missing.length > 1 ? 's have' : ' has'} no color yet.`, stickers: missing });
    return { ok: false, issues };
  }

  const counts = colorCounts(stickers);
  const wrong = COLORS.filter((c) => counts[c] !== 9);
  if (wrong.length) {
    issues.push({
      code: 'color-count',
      message: `Each color must appear exactly 9 times. Found ${wrong.map((c) => `${counts[c]} ${c}`).join(', ')}.`,
      stickers: stickers.map((s, i) => (wrong.includes(s as ColorName) ? i : -1)).filter((i) => i >= 0),
    });
  }

  const scheme = centerScheme(stickers);
  const centerColors = FACES.map((f) => scheme[f]);
  if (new Set(centerColors).size !== 6) {
    issues.push({ code: 'centers', message: 'All six center stickers must have different colors.', stickers: FACES.map((_, i) => 9 * i + 4) });
  }
  if (issues.length) return { ok: false, issues };

  const colorToFace = new Map<ColorName, Face>(FACES.map((f) => [scheme[f], f]));
  const fl = stickers.map((s) => colorToFace.get(s as ColorName)!) as Face[];

  // ---- Corners
  const cp: number[] = [];
  const co: number[] = [];
  const seenCorner = new Map<number, number>();
  CORNER_FACELETS.forEach((fs, pos) => {
    const cols = fs.map((i) => fl[i]);
    const ori = cols.findIndex((c) => c === 'U' || c === 'D');
    const named = cols.map((c) => scheme[c]).join('/');
    let piece = -1;
    if (ori >= 0) {
      const c1 = cols[(ori + 1) % 3];
      const c2 = cols[(ori + 2) % 3];
      piece = CORNER_FACES.findIndex((p) => p[0] === cols[ori] && p[1] === c1 && p[2] === c2);
    }
    if (piece < 0) {
      issues.push({ code: 'invalid-corner', message: `The ${POS_NAME(CORNER_FACES[pos])} corner shows ${named}, which is not a real corner piece.`, stickers: fs });
      return;
    }
    if (seenCorner.has(piece)) {
      issues.push({ code: 'duplicate-corner', message: `The ${named} corner appears twice (${POS_NAME(CORNER_FACES[seenCorner.get(piece)!])} and ${POS_NAME(CORNER_FACES[pos])}).`, stickers: [...CORNER_FACELETS[seenCorner.get(piece)!], ...fs] });
    }
    seenCorner.set(piece, pos);
    cp[pos] = piece;
    co[pos] = ori;
  });

  // ---- Edges
  const ep: number[] = [];
  const eo: number[] = [];
  const seenEdge = new Map<number, number>();
  EDGE_FACELETS.forEach((fs, pos) => {
    const [a, b] = fs.map((i) => fl[i]);
    let piece = EDGE_FACES.findIndex((p) => p[0] === a && p[1] === b);
    let ori = 0;
    if (piece < 0) {
      piece = EDGE_FACES.findIndex((p) => p[0] === b && p[1] === a);
      ori = 1;
    }
    const named = `${scheme[a]}/${scheme[b]}`;
    if (piece < 0) {
      issues.push({ code: 'invalid-edge', message: `The ${POS_NAME(EDGE_FACES[pos])} edge shows ${named}, which is not a real edge piece.`, stickers: fs });
      return;
    }
    if (seenEdge.has(piece)) {
      issues.push({ code: 'duplicate-edge', message: `The ${named} edge appears twice.`, stickers: [...EDGE_FACELETS[seenEdge.get(piece)!], ...fs] });
    }
    seenEdge.set(piece, pos);
    ep[pos] = piece;
    eo[pos] = ori;
  });

  if (issues.length) return { ok: false, issues };

  const twist = co.reduce((a, b) => a + b, 0) % 3;
  if (twist !== 0) {
    issues.push({ code: 'corner-twist', message: 'One corner is twisted in place. This cannot happen by turning faces — re-check corner stickers (or the cube was physically twisted).', stickers: CORNER_FACELETS.flat() });
  }
  const flip = eo.reduce((a, b) => a + b, 0) % 2;
  if (flip !== 0) {
    issues.push({ code: 'edge-flip', message: 'One edge is flipped in place. This cannot happen by turning faces — re-check edge stickers.', stickers: EDGE_FACELETS.flat() });
  }
  if (parity(cp) !== parity(ep)) {
    issues.push({ code: 'parity', message: 'Two pieces appear swapped (permutation parity error). Re-check stickers — often two edge or corner colors were read in the wrong place.', stickers: [] });
  }
  if (issues.length) return { ok: false, issues };

  return { ok: true, issues: [], facelets: fl.join('') };
}

/**
 * Look for whole-face rotations (centers stay put) that would turn an invalid scan into a valid cube.
 * Used to SUGGEST fixes for faces held at the wrong angle — never applied without the user's confirmation.
 */
export function suggestFaceRotations(stickers: StickerArray): { rotations: number[]; stickers: StickerArray }[] {
  if (validateStickers(stickers).ok) return [];
  const results: { rotations: number[]; stickers: StickerArray }[] = [];
  const rotated = (s: StickerArray, face: number, q: number) => rotateFaceStickers(s, face, q);
  for (let code = 1; code < 4096; code++) {
    const rots = [0, 1, 2, 3, 4, 5].map((f) => (code >> (2 * f)) & 3);
    let s = stickers;
    rots.forEach((q, f) => { if (q) s = rotated(s, f, q); });
    if (validateStickers(s).ok) {
      results.push({ rotations: rots, stickers: s });
      if (results.length > 3) break;
    }
  }
  // Prefer the fewest rotated faces.
  return results.sort((a, b) => a.rotations.filter(Boolean).length - b.rotations.filter(Boolean).length);
}

/** Rotate the 9 stickers of one face clockwise by q quarter turns (as seen from outside). */
export function rotateFaceStickers<T>(s: readonly T[], face: number, q: number): T[] {
  const out = s.slice();
  const base = face * 9;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      let rr = r, cc = c;
      for (let k = 0; k < (q % 4 + 4) % 4; k++) [rr, cc] = [cc, 2 - rr];
      out[base + rr * 3 + cc] = s[base + r * 3 + c];
    }
  return out;
}
