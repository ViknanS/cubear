import { FACELETS, FACE_NORMAL, dot, faceletAt, rotateClockwise } from './geometry';
import { FACES, type Face } from './types';

export type MoveSuffix = '' | "'" | '2';
export interface Move {
  face: Face;
  /** Clockwise quarter turns: 1 = X, 2 = X2, 3 = X' */
  turns: 1 | 2 | 3;
}

export const ALL_MOVES: string[] = FACES.flatMap((f) => [f, `${f}'`, `${f}2`]);

export function parseMove(token: string): Move {
  const m = /^([URFDLB])(['’2]?)$/.exec(token.trim());
  if (!m) throw new Error(`Invalid move "${token}"`);
  const face = m[1] as Face;
  const turns = m[2] === '2' ? 2 : m[2] ? 3 : 1;
  return { face, turns };
}

export function moveToString(m: Move): string {
  return m.face + (m.turns === 1 ? '' : m.turns === 2 ? '2' : "'");
}

export function parseAlgorithm(alg: string): string[] {
  return alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => moveToString(parseMove(t)));
}

export function invertMove(token: string): string {
  const m = parseMove(token);
  return moveToString({ face: m.face, turns: (4 - m.turns) as 1 | 2 | 3 });
}

export function invertAlgorithm(moves: string[]): string[] {
  return [...moves].reverse().map(invertMove);
}

/** Facelet permutation for a single clockwise quarter turn of each face. dest[i] = where sticker i goes. */
const QUARTER: Record<Face, number[]> = Object.fromEntries(
  FACES.map((f) => {
    const axis = FACE_NORMAL[f];
    const dest = FACELETS.map((g, i) => {
      if (dot(g.pos, axis) !== 1) return i;
      return faceletAt(rotateClockwise(g.pos, axis, 1), rotateClockwise(g.normal, axis, 1));
    });
    return [f, dest];
  }),
) as Record<Face, number[]>;

/** Generic: apply a move to any 54-length array (facelet letters, color names, samples...). */
export function applyMoveArray<T>(state: readonly T[], token: string): T[] {
  const { face, turns } = parseMove(token);
  let cur = state.slice();
  const dest = QUARTER[face];
  for (let t = 0; t < turns; t++) {
    const next = cur.slice();
    for (let i = 0; i < 54; i++) next[dest[i]] = cur[i];
    cur = next;
  }
  return cur;
}

export function applyMoves<T>(state: readonly T[], moves: string[]): T[] {
  return moves.reduce<T[]>((s, m) => applyMoveArray(s, m), state.slice());
}

export function applyMovesToString(facelets: string, moves: string[]): string {
  return applyMoves(facelets.split(''), moves).join('');
}

/** Indices of the 21 stickers (9 face + 12 side) affected by turning this face. */
export function layerFacelets(face: Face): number[] {
  const axis = FACE_NORMAL[face];
  return FACELETS.map((g, i) => (dot(g.pos, axis) === 1 ? i : -1)).filter((i) => i >= 0);
}

export function describeMove(token: string): string {
  const { face, turns } = parseMove(token);
  const name = { U: 'top', D: 'bottom', R: 'right', L: 'left', F: 'front', B: 'back' }[face];
  if (turns === 2) return `Turn the ${name} face 180° (half turn).`;
  const dir = turns === 1 ? 'clockwise' : 'counterclockwise';
  const hint =
    face === 'B'
      ? ' (as seen from behind the cube)'
      : face === 'D'
        ? ' (as seen from below)'
        : face === 'U'
          ? ' (as seen from above)'
          : face === 'R' || face === 'L'
            ? ` (as seen from the ${name} side)`
            : '';
  return `Rotate the ${name} face 90° ${dir}${hint}.`;
}

/** Plain-English description of how the stickers on the FRONT face move, from the user's viewpoint. */
export function frontViewHint(token: string): string {
  const { face, turns } = parseMove(token);
  const half = turns === 2;
  const cw = turns === 1;
  switch (face) {
    case 'R':
      return half ? 'Push the right column a half turn.' : cw ? 'Push the right column UP, away from you.' : 'Pull the right column DOWN, toward you.';
    case 'L':
      return half ? 'Push the left column a half turn.' : cw ? 'Pull the left column DOWN, toward you.' : 'Push the left column UP, away from you.';
    case 'U':
      return half ? 'Swing the top row a half turn.' : cw ? 'Swing the top row to the LEFT.' : 'Swing the top row to the RIGHT.';
    case 'D':
      return half ? 'Swing the bottom row a half turn.' : cw ? 'Swing the bottom row to the RIGHT.' : 'Swing the bottom row to the LEFT.';
    case 'F':
      return half ? 'Turn the whole front face a half turn.' : cw ? 'Turn the front face like a clock hand (clockwise).' : 'Turn the front face against the clock (counterclockwise).';
    case 'B':
      return half
        ? 'Turn the back layer a half turn.'
        : cw
          ? 'Turn the back layer so its top row moves to YOUR RIGHT (it looks counterclockwise from the front).'
          : 'Turn the back layer so its top row moves to YOUR LEFT (it looks clockwise from the front).';
  }
}
