import { applyMoveArray, parseMove } from '../cube/moves';
import type { ColorName, StickerArray } from '../cube/types';
import type { Pt } from '../vision/homography';

/** The 9 stickers of the front face (F = facelets 18..26), row-major as the user sees them. */
export function frontFace(stickers: StickerArray): ColorName[] {
  return stickers.slice(18, 27) as ColorName[];
}

/** Rotate a 3×3 row-major array clockwise q quarter turns (as it appears on screen). */
export function rotateGrid<T>(g: T[], q: number): T[] {
  let out = g.slice();
  for (let k = 0; k < ((q % 4) + 4) % 4; k++) {
    const n = out.slice();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) n[c * 3 + (2 - r)] = out[r * 3 + c];
    out = n;
  }
  return out;
}

export interface FaceMatch {
  /**
   * How many quarter turns clockwise the expected front face appears rotated in the image
   * (0 = cube held upright with U on top).
   */
  rotation: number;
  matches: number;
  /** False when several rotations fit equally well (symmetric pattern) — orientation is then assumed upright. */
  unique: boolean;
}

/** Compare a detected face with the expected front face under all four in-plane rotations. */
export function matchFace(detected: ColorName[], expected: ColorName[]): FaceMatch {
  const scores = [0, 1, 2, 3].map((q) => rotateGrid(expected, q).reduce((s, c, i) => s + (c === detected[i] ? 1 : 0), 0));
  const best = Math.max(...scores);
  const winners = scores.map((s, q) => (s === best ? q : -1)).filter((q) => q >= 0);
  return { rotation: winners.includes(0) ? 0 : winners[0], matches: best, unique: winners.length === 1 };
}

export interface ArrowSpec {
  /** Cells to highlight on the front face, [row, col], in upright face coordinates (0..2). */
  cells: [number, number][];
  /** Arrow polyline in face units (0..3, x right, y down, upright orientation). */
  path: Pt[];
  /** True when the turning layer is behind the visible face (B moves). */
  behind: boolean;
  double: boolean;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 24): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

/**
 * Arrow geometry for a move, drawn on the FRONT face while the cube is held in the solving orientation
 * (scanned Front toward the camera, scanned Up on top). Directions were derived from the cube model:
 * R moves the right column up, L moves the left column down, U moves the top row left, D moves the
 * bottom row right, F is clockwise on screen, and B (behind) appears counterclockwise from the front.
 */
export function arrowFor(move: string): ArrowSpec {
  const { face, turns } = parseMove(move);
  const sign = turns === 3 ? -1 : 1;
  const double = turns === 2;
  const col = (c: number) => [0, 1, 2].map((r) => [r, c] as [number, number]);
  const row = (r: number) => [0, 1, 2].map((c) => [r, c] as [number, number]);
  const vertical = (x: number, up: boolean): Pt[] => (up ? [[x, 2.75], [x, 0.25]] : [[x, 0.25], [x, 2.75]]);
  const horizontal = (y: number, left: boolean): Pt[] => (left ? [[2.75, y], [0.25, y]] : [[0.25, y], [2.75, y]]);
  switch (face) {
    case 'R':
      return { cells: col(2), path: vertical(2.5, sign > 0), behind: false, double };
    case 'L':
      return { cells: col(0), path: vertical(0.5, sign < 0), behind: false, double };
    case 'U':
      return { cells: row(0), path: horizontal(0.5, sign > 0), behind: false, double };
    case 'D':
      return { cells: row(2), path: horizontal(2.5, sign < 0), behind: false, double };
    case 'F': {
      const cells = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => [r, c] as [number, number]));
      // y points down on screen, so increasing angle is clockwise on screen.
      const p = sign > 0 ? arc(1.5, 1.5, 1.05, -2.4, 1.9) : arc(1.5, 1.5, 1.05, 1.9, -2.4);
      return { cells, path: p, behind: false, double };
    }
    case 'B': {
      // B clockwise (seen from behind) looks counterclockwise from the front. Drawn outside the face, dashed.
      const p = sign > 0 ? arc(1.5, 1.5, 1.95, -0.6, -2.6) : arc(1.5, 1.5, 1.95, -2.6, -0.6);
      return { cells: [], path: p, behind: true, double };
    }
  }
}

/** Rotate a point in face units (0..3) clockwise by q quarter turns about the face center. */
export function rotateFacePoint([x, y]: Pt, q: number): Pt {
  let px = x - 1.5, py = y - 1.5;
  for (let k = 0; k < ((q % 4) + 4) % 4; k++) [px, py] = [-py, px];
  return [px + 1.5, py + 1.5];
}

export type StepObservation = 'before' | 'after' | 'mismatch' | 'ambiguous';

/**
 * Classify what the camera currently sees relative to the current move.
 * 'after' is only reported when the move visibly changes the front face AND the detected face matches the
 * post-move pattern better than the pre-move one — otherwise auto-advance must not happen.
 */
export function observeStep(detected: ColorName[], stateBefore: StickerArray, move: string): { obs: StepObservation; rotation: number } {
  const before = frontFace(stateBefore);
  const after = frontFace(applyMoveArray(stateBefore, move));
  const changes = before.filter((c, i) => c !== after[i]).length;
  const mb = matchFace(detected, before);
  const ma = matchFace(detected, after);
  if (changes >= 2 && ma.matches >= 8 && ma.matches > mb.matches) return { obs: 'after', rotation: ma.rotation };
  if (mb.matches >= 8) return { obs: changes === 0 ? 'ambiguous' : 'before', rotation: mb.rotation };
  if (mb.matches <= 5 && ma.matches <= 5) return { obs: 'mismatch', rotation: mb.rotation };
  return { obs: 'ambiguous', rotation: mb.rotation };
}

/** True when this move cannot be confirmed from the front face alone (B turns, or a change that is invisible). */
export function moveVerifiableFromFront(stateBefore: StickerArray, move: string): boolean {
  const before = frontFace(stateBefore);
  const after = frontFace(applyMoveArray(stateBefore, move));
  return before.filter((c, i) => c !== after[i]).length >= 2;
}

/**
 * Debounces observations: auto-advance only after N consecutive confident 'after' frames;
 * flags a probable wrong move after M consecutive 'mismatch' frames.
 */
export class StepVerifier {
  private afterStreak = 0;
  private mismatchStreak = 0;
  constructor(private readonly need = 6, private readonly mismatchNeed = 25) {}
  reset() { this.afterStreak = 0; this.mismatchStreak = 0; }
  push(obs: StepObservation): 'advance' | 'wrong-move' | null {
    if (obs === 'after') { this.afterStreak++; this.mismatchStreak = 0; }
    else if (obs === 'mismatch') { this.mismatchStreak++; this.afterStreak = 0; }
    else { this.afterStreak = 0; this.mismatchStreak = Math.max(0, this.mismatchStreak - 1); }
    if (this.afterStreak >= this.need) { this.reset(); return 'advance'; }
    if (this.mismatchStreak >= this.mismatchNeed) { this.mismatchStreak = 0; return 'wrong-move'; }
    return null;
  }
}
