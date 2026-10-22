import { describe, expect, it } from 'vitest';
import { arrowFor, matchFace, moveVerifiableFromFront, observeStep, rotateFacePoint, rotateGrid, StepVerifier, frontFace } from '../../src/ar/guide';
import { faceletsToStickers } from '../../src/cube/convert';
import { FACELETS } from '../../src/cube/geometry';
import { applyMoveArray, applyMovesToString, parseAlgorithm } from '../../src/cube/moves';
import { FACES, STANDARD_SCHEME, solvedFacelets, type ColorName, type Face } from '../../src/cube/types';
import { validateStickers } from '../../src/cube/validate';
import { rgbToLab } from '../../src/vision/color';
import { assembleStickers, calibratedStickers, nextFaceToScan, ORIENTATION_STEPS, SCAN_ORDER, scanWarning, scannedCount, type ScanCaptures } from '../../src/scan/session';
import { STICKER_RGB } from '../fixtures/synth';

const truth = faceletsToStickers(applyMovesToString(solvedFacelets(), parseAlgorithm("R U2 F' L D2 B R' U' F2 L2 D B2 U R2 F")), STANDARD_SCHEME);

function capture(face: Face, colors = truth.slice(9 * FACES.indexOf(face), 9 * FACES.indexOf(face) + 9) as ColorName[]) {
  return { face, colors, samples: colors.map((c) => rgbToLab(...STICKER_RGB[c])), confidence: colors.map(() => 1), source: 'auto' as const };
}

describe('six-face scanning session', () => {
  it('walks F, R, B, L, U, D and assembles the exact cube', () => {
    let caps: ScanCaptures = {};
    const seen: Face[] = [];
    for (let i = 0; i < 6; i++) {
      const f = nextFaceToScan(caps)!;
      seen.push(f);
      caps = { ...caps, [f]: capture(f) };
      expect(scannedCount(caps)).toBe(i + 1);
    }
    expect(seen).toEqual(SCAN_ORDER);
    expect(nextFaceToScan(caps)).toBeNull();
    expect(assembleStickers(caps)).toEqual(truth);
    const cal = calibratedStickers(caps)!;
    expect(cal.stickers).toEqual(truth);
    expect(validateStickers(cal.stickers).ok).toBe(true);
  });

  it('leaves unscanned faces empty and re-scanning a face replaces it', () => {
    let caps: ScanCaptures = { F: capture('F') };
    expect(assembleStickers(caps).filter((s) => s === null)).toHaveLength(45);
    expect(calibratedStickers(caps)).toBeNull();
    const wrong = capture('F', Array(9).fill('blue'));
    caps = { ...caps, F: wrong };
    expect(assembleStickers(caps).slice(18, 27)).toEqual(Array(9).fill('blue'));
  });

  it('orientation protocol: each step brings the right face to the camera with the right neighbour on top', () => {
    // Verify with the geometric model: rotate the face normal by the step's Euler angles → must point at the camera (+z).
    const rot = ([x, y, z]: number[], [ax, ay]: number[]) => {
      // apply X then Y rotation (Three.js 'XYZ' order applies Z, Y, X to vectors... we only use single-axis rotations here)
      let v = [x, y, z];
      v = [v[0], v[1] * Math.cos(ax) - v[2] * Math.sin(ax), v[1] * Math.sin(ax) + v[2] * Math.cos(ax)];
      v = [v[0] * Math.cos(ay) + v[2] * Math.sin(ay), v[1], -v[0] * Math.sin(ay) + v[2] * Math.cos(ay)];
      return v.map((n) => Math.round(n) + 0);
    };
    for (const step of ORIENTATION_STEPS) {
      const i = FACES.indexOf(step.face);
      expect(rot(FACELETS[9 * i + 4].normal, step.euler), step.face).toEqual([0, 0, 1]);
      const top = FACES.indexOf(step.topNeighbour);
      expect(rot(FACELETS[9 * top + 4].normal, step.euler), step.face + ' top').toEqual([0, 1, 0]);
      // the top row of the face (row 0) must border the topNeighbour face
      expect(rot(FACELETS[9 * i + 1].pos, step.euler)[1]).toBe(1);
    }
  });

  it('warns when a face is scanned twice', () => {
    const caps: ScanCaptures = { F: capture('F') };
    expect(scanWarning(caps, 'R', truth[22] as ColorName)).toMatch(/already scanned/);
    expect(scanWarning(caps, 'R', 'red')).toBeNull();
  });
});

describe('manual color correction', () => {
  it('editing one sticker changes exactly that sticker and is caught/cleared by validation', () => {
    const edited = [...truth];
    edited[0] = edited[0] === 'red' ? 'orange' : 'red';
    expect(validateStickers(edited).ok).toBe(false);
    edited[0] = truth[0];
    expect(validateStickers(edited).ok).toBe(true);
    expect(edited).toEqual(truth);
  });
});

describe('AR guidance geometry', () => {
  /** Screen displacement (x right, y down) of a front-face sticker under the move, from the cube model. */
  function screenMotion(move: string, row: number, col: number) {
    const src = 18 + 3 * row + col;
    const ids = applyMoveArray(Array.from({ length: 54 }, (_, i) => i), move);
    const dest = ids.indexOf(src);
    const a = FACELETS[src].pos, b = FACELETS[dest].pos;
    return [b[0] - a[0], -(b[1] - a[1])];
  }
  const dir = (p: number[][]) => [p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]];

  it.each(['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'"])('%s arrow points the way the stickers really move', (m) => {
    const spec = arrowFor(m);
    const [r, c] = spec.cells[1];
    const motion = screenMotion(m, r, c);
    const d = dir(spec.path);
    expect(motion[0] * d[0] + motion[1] * d[1]).toBeGreaterThan(0);
  });

  it('F arrow is clockwise on screen, F\' counterclockwise', () => {
    // top-middle sticker under F moves right on screen
    expect(screenMotion('F', 0, 1)[0]).toBeGreaterThan(0);
    const p = arrowFor('F').path;
    const topIdx = p.reduce((bi, q, i) => (q[1] < p[bi][1] ? i : bi), 0);
    expect(p[topIdx + 1][0] - p[topIdx][0]).toBeGreaterThan(0);
    const p2 = arrowFor("F'").path;
    const t2 = p2.reduce((bi, q, i) => (q[1] < p2[bi][1] ? i : bi), 0);
    expect(p2[t2 + 1][0] - p2[t2][0]).toBeLessThan(0);
  });

  it('B arrow (behind) moves the top of the back layer the way the model says', () => {
    // U sticker row 0 col 1 belongs to the back layer; under B it moves toward -x (screen left)
    const src = 1;
    const ids = applyMoveArray(Array.from({ length: 54 }, (_, i) => i), 'B');
    const dest = ids.indexOf(src);
    expect(FACELETS[dest].pos[0]).toBeLessThan(FACELETS[src].pos[0]);
    const p = arrowFor('B').path;
    const topIdx = p.reduce((bi, q, i) => (q[1] < p[bi][1] ? i : bi), 0);
    expect(p[Math.min(topIdx + 1, p.length - 1)][0] - p[Math.max(topIdx - 1, 0)][0]).toBeLessThan(0);
    expect(arrowFor('B').behind).toBe(true);
  });

  it('matches the expected face under any in-plane rotation', () => {
    const exp = frontFace(truth);
    for (let q = 0; q < 4; q++) {
      const m = matchFace(rotateGrid(exp, q), exp);
      expect(m.matches).toBe(9);
      if (m.unique) expect(m.rotation).toBe(q);
    }
    expect(rotateFacePoint([3, 0], 1)).toEqual([3, 3]);
  });

  it('observes before/after states and only auto-advances on sustained confirmed change', () => {
    const move = 'R';
    expect(moveVerifiableFromFront(truth, move)).toBe(true);
    const before = frontFace(truth);
    const after = frontFace(applyMoveArray(truth, move));
    expect(observeStep(before, truth, move).obs).toBe('before');
    expect(observeStep(after, truth, move).obs).toBe('after');
    const v = new StepVerifier(3, 5);
    expect(v.push('after')).toBeNull();
    expect(v.push('before')).toBeNull(); // streak broken
    expect(v.push('after')).toBeNull();
    expect(v.push('after')).toBeNull();
    expect(v.push('after')).toBe('advance');
    for (let i = 0; i < 4; i++) expect(v.push('mismatch')).toBeNull();
    expect(v.push('mismatch')).toBe('wrong-move');
  });

  it('B moves on a solved cube cannot be verified from the front', () => {
    const solved = faceletsToStickers(solvedFacelets(), STANDARD_SCHEME);
    expect(moveVerifiableFromFront(solved, 'B')).toBe(false);
  });
});
