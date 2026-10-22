import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { faceletsToStickers } from '../../src/cube/convert';
import { applyMovesToString, parseAlgorithm } from '../../src/cube/moves';
import { solvedFacelets, type ColorName } from '../../src/cube/types';
import { validateStickers } from '../../src/cube/validate';
import { calibrateCube } from '../../src/vision/calibrate';
import { classify, defaultPrototypes, labToRgb, rgbToLab, MIN_CONFIDENCE } from '../../src/vision/color';
import { detectFace, type CV } from '../../src/vision/detector';
import { applyH, computeHomography, invertH, type Pt } from '../../src/vision/homography';
import { guideQuad, sampleFace } from '../../src/vision/sampler';
import { FIXTURES, FIXTURE_FACE, STICKER_RGB, frontal, renderFace } from '../fixtures/synth';

let cv: CV;
beforeAll(async () => {
  // OpenCV.js 5 (UMD) exports a Promise that resolves to the initialised module. Loading it through
  // require() avoids ESM interop wrapping that Promise in a namespace object.
  cv = await createRequire(import.meta.url)('@techstark/opencv-js');
}, 60000);

describe('color science', () => {
  it('Lab round trip and known values', () => {
    expect(rgbToLab(255, 255, 255)[0]).toBeCloseTo(100, 0);
    expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 0);
    expect(labToRgb(rgbToLab(200, 50, 30))).toEqual([200, 50, 30]);
  });

  it('classifies typical sticker colors (with confidence) under neutral light', () => {
    const p = defaultPrototypes();
    for (const [name, rgb] of Object.entries(STICKER_RGB)) {
      const c = classify(rgbToLab(...rgb), p);
      expect(c.color).toBe(name);
      expect(c.confidence).toBeGreaterThan(MIN_CONFIDENCE);
    }
  });
});

describe('homography', () => {
  it('maps 4 points exactly and inverts', () => {
    const src: Pt[] = [[0, 0], [3, 0], [3, 3], [0, 3]];
    const dst: Pt[] = [[100, 52], [228, 62], [240, 196], [86, 182]];
    const H = computeHomography(src, dst)!;
    src.forEach((p, i) => {
      const q = applyH(H, p);
      expect(q[0]).toBeCloseTo(dst[i][0], 6);
      expect(q[1]).toBeCloseTo(dst[i][1], 6);
      const back = applyH(invertH(H), q);
      expect(back[0]).toBeCloseTo(p[0], 6);
    });
  });
});

describe('perspective sampling', () => {
  it('reads all 9 stickers from a known quad (perspective fixture)', () => {
    const f = FIXTURES.find((x) => x.name === 'perspective-tilt')!;
    const samples = sampleFace(renderFace(f.opts), f.opts.quad)!;
    const p = defaultPrototypes();
    expect(samples.map((s) => classify(s.lab, p).color)).toEqual(FIXTURE_FACE);
  });

  it('guide quad is centred and square', () => {
    const q = guideQuad(400, 300, 0.5);
    expect(q[0]).toEqual([125, 75]);
    expect(q[2]).toEqual([275, 225]);
  });
});

describe('OpenCV face detection on deterministic fixtures', () => {
  for (const fx of FIXTURES) {
    it(`detects the face and grid: ${fx.name}`, () => {
      const img = renderFace(fx.opts);
      const det = detectFace(cv, img);
      expect(det, 'face should be detected').not.toBeNull();
      // detected outer corners within 6% of the face size of the truth
      const size = Math.hypot(fx.opts.quad[1][0] - fx.opts.quad[0][0], fx.opts.quad[1][1] - fx.opts.quad[0][1]);
      det!.quad.forEach((p, i) => expect(Math.hypot(p[0] - fx.opts.quad[i][0], p[1] - fx.opts.quad[i][1])).toBeLessThan(0.06 * size));
      expect(det!.cellsFound).toBeGreaterThanOrEqual(7);
      const samples = sampleFace(img, det!.quad)!;
      expect(samples).toHaveLength(9);
    });
  }

  it('reads correct colors from detected grid under neutral, rotated and glare conditions', () => {
    for (const name of ['frontal-neutral', 'rotated-18deg', 'glare-on-sticker', 'perspective-tilt', 'side-gradient']) {
      const fx = FIXTURES.find((x) => x.name === name)!;
      const img = renderFace(fx.opts);
      const det = detectFace(cv, img)!;
      const colors = sampleFace(img, det.quad)!.map((s) => classify(s.lab, defaultPrototypes()).color);
      expect(colors, name).toEqual(FIXTURE_FACE);
    }
  });

  it('rejects frames without a cube', () => {
    const blank = renderFace({ colors: FIXTURE_FACE, quad: [[-500, -500], [-400, -500], [-400, -400], [-500, -400]] });
    expect(detectFace(cv, blank)).toBeNull();
  });
});

describe('whole-cube calibration from six center stickers', () => {
  function scanCube(lighting: { gain?: number; tint?: [number, number, number] }) {
    const facelets = applyMovesToString(solvedFacelets(), parseAlgorithm("R U2 F' L D2 B R' U' F2 L2 D B2 U R2 F"));
    const truth = faceletsToStickers(facelets, { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' });
    const labs = [];
    for (let f = 0; f < 6; f++) {
      const colors = truth.slice(9 * f, 9 * f + 9) as ColorName[];
      const img = renderFace({ colors, quad: frontal(), seed: 20 + f, ...lighting });
      const det = detectFace(cv, img)!;
      expect(det).not.toBeNull();
      labs.push(...sampleFace(img, det.quad)!.map((s) => s.lab));
    }
    return { truth, labs };
  }

  it('recovers the exact cube under warm tungsten light', () => {
    const { truth, labs } = scanCube({ tint: [1.1, 0.92, 0.68] });
    const cal = calibrateCube(labs);
    expect(cal.colors).toEqual(truth);
    expect(validateStickers(cal.colors).ok).toBe(true);
  });

  it('recovers the exact cube in dim light', () => {
    const { truth, labs } = scanCube({ gain: 0.5 });
    expect(calibrateCube(labs).colors).toEqual(truth);
  });

  it('fixes dim warm light where the fixed default palette misreads stickers', () => {
    const { truth, labs } = scanCube({ gain: 0.5, tint: [1.1, 0.92, 0.68] });
    const naive = labs.map((l) => classify(l, defaultPrototypes()).color);
    expect(naive.filter((c, i) => c !== truth[i]).length).toBeGreaterThan(5); // the uncalibrated palette fails…
    expect(calibrateCube(labs).colors).toEqual(truth); // …center calibration recovers every sticker
  });
});
