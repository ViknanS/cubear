import { COLORS, type ColorName } from '../cube/types';
import { colorDistance, defaultPrototypes, type Lab, type Prototypes } from './color';

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}
const PERMS = permutations([0, 1, 2, 3, 4, 5]);

/** Give the six observed centers six distinct color names (optimal one-to-one matching against the reference palette). */
export function nameCenters(centers: Lab[], reference: Prototypes = defaultPrototypes()): ColorName[] {
  let best = PERMS[0], bestCost = Infinity;
  for (const p of PERMS) {
    let cost = 0;
    for (let i = 0; i < 6; i++) cost += colorDistance(centers[i], reference[COLORS[p[i]]]);
    if (cost < bestCost) { bestCost = cost; best = p; }
  }
  return best.map((k) => COLORS[k]);
}

export interface CalibrationResult {
  colors: ColorName[];
  /** Per-sticker confidence 0..1 (margin to the next-best color). */
  confidence: number[];
  prototypes: Prototypes;
}

/**
 * Adaptive whole-cube calibration. The six center stickers are physically guaranteed to be six different
 * colors, so they become the palette for *this* cube under *this* light. Every sticker is then assigned with
 * a capacity constraint of exactly nine per color, and the palette is refined from the assigned stickers.
 * This resolves red/orange and white/yellow confusions that per-sticker thresholds cannot.
 */
export function calibrateCube(samples: Lab[]): CalibrationResult {
  if (samples.length !== 54) throw new Error('calibrateCube needs 54 samples');
  const centerIdx = [4, 13, 22, 31, 40, 49];
  const names = nameCenters(centerIdx.map((i) => samples[i]));
  let protos = Object.fromEntries(names.map((n, k) => [n, samples[centerIdx[k]]])) as Prototypes;
  let colors: ColorName[] = [];

  for (let iter = 0; iter < 3; iter++) {
    const assigned: (ColorName | null)[] = Array(54).fill(null);
    const cap = Object.fromEntries(COLORS.map((c) => [c, 9])) as Record<ColorName, number>;
    centerIdx.forEach((i, k) => { assigned[i] = names[k]; cap[names[k]]--; });
    const cand: [number, ColorName, number][] = [];
    samples.forEach((s, i) => { if (!assigned[i]) for (const c of COLORS) cand.push([i, c, colorDistance(s, protos[c])]); });
    cand.sort((a, b) => a[2] - b[2]);
    for (const [i, c] of cand) if (!assigned[i] && cap[c] > 0) { assigned[i] = c; cap[c]--; }
    colors = assigned as ColorName[];
    // refine palette: mean Lab of each cluster
    protos = Object.fromEntries(
      COLORS.map((c) => {
        const m = samples.filter((_, i) => colors[i] === c);
        return [c, [0, 1, 2].map((d) => m.reduce((s, v) => s + v[d], 0) / m.length) as Lab];
      }),
    ) as Prototypes;
  }

  const confidence = samples.map((s, i) => {
    const own = colorDistance(s, protos[colors[i]]);
    const other = Math.min(...COLORS.filter((c) => c !== colors[i]).map((c) => colorDistance(s, protos[c])));
    return Math.max(0, 1 - own / Math.max(other, 1e-6));
  });
  return { colors, confidence, prototypes: protos };
}

/** Update a live palette using whichever face centers have been scanned so far. */
export function prototypesFromCenters(centers: { color: ColorName; lab: Lab }[]): Prototypes {
  const p = defaultPrototypes();
  for (const c of centers) p[c.color] = c.lab;
  return p;
}
