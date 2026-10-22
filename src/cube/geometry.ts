import { FACES, type Face } from './types';

export type Vec3 = [number, number, number];

export interface FaceletGeom {
  /** Cubie position, each coordinate in {-1, 0, 1}. x = right, y = up, z = toward the viewer (front). */
  pos: Vec3;
  /** Outward sticker normal (unit axis vector). */
  normal: Vec3;
}

export const FACE_NORMAL: Record<Face, Vec3> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

/**
 * Position of sticker (row, col) on a face, using the standard unfolded-net convention:
 * every face is viewed from outside with U on top (for side faces), B on top (for U)
 * and F on top (for D). This matches the Kociemba / cubejs facelet string.
 */
function stickerPos(face: Face, r: number, c: number): Vec3 {
  switch (face) {
    case 'U':
      return [c - 1, 1, r - 1];
    case 'R':
      return [1, 1 - r, 1 - c];
    case 'F':
      return [c - 1, 1 - r, 1];
    case 'D':
      return [c - 1, -1, 1 - r];
    case 'L':
      return [-1, 1 - r, c - 1];
    case 'B':
      return [1 - c, 1 - r, -1];
  }
}

export const FACELETS: FaceletGeom[] = FACES.flatMap((f) => {
  const out: FaceletGeom[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push({ pos: stickerPos(f, r, c), normal: FACE_NORMAL[f] });
  return out;
});

const key = (p: Vec3, n: Vec3) => `${p.join(',')}|${n.join(',')}`;
const LOOKUP = new Map<string, number>(FACELETS.map((g, i) => [key(g.pos, g.normal), i]));

export function faceletAt(pos: Vec3, normal: Vec3): number {
  const k = key(pos.map((v) => Math.round(v) + 0) as Vec3, normal.map((v) => Math.round(v) + 0) as Vec3);
  const i = LOOKUP.get(k);
  if (i === undefined) throw new Error(`No facelet at ${k}`);
  return i;
}

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Rotate v by quarterTurns * 90° CLOCKWISE as seen looking at the face whose outward normal is `axis`
 * (i.e. by -90° per quarter turn under the right-hand rule).
 */
export function rotateClockwise(v: Vec3, axis: Vec3, quarterTurns: number): Vec3 {
  let out = v;
  const q = ((quarterTurns % 4) + 4) % 4;
  for (let i = 0; i < q; i++) {
    const ax = cross(axis, out);
    const d = dot(axis, out);
    // Rodrigues with theta = -90°: v' = -(a × v) + a (a · v)
    out = [-ax[0] + axis[0] * d, -ax[1] + axis[1] * d, -ax[2] + axis[2] * d];
  }
  return out.map((x) => x + 0) as Vec3;
}
