/* eslint-disable @typescript-eslint/no-explicit-any */
import { applyH, computeHomography, invertH, isConvexQuad, polygonArea, type Pt } from './homography';
import type { RGBAImage } from './image';

/** The OpenCV.js module object (typed loosely; the package's typings don't cover every overload we use). */
export type CV = any;

export interface StickerBlob {
  center: Pt;
  size: number; // sqrt(area) in px
  angle: number; // dominant edge angle in radians, folded into (-45°, 45°]
}

export interface FaceDetection {
  /** Outer boundary of the face: [TL, TR, BR, BL] in image pixels. */
  quad: Pt[];
  /** Number of the 9 grid cells that contained a detected sticker. */
  cellsFound: number;
  /** Mean reprojection error of sticker centers, in sticker pitches. */
  error: number;
  /** 0..1 */
  confidence: number;
  stickers: StickerBlob[];
}

const fold = (a: number) => {
  let t = a % (Math.PI / 2);
  if (t > Math.PI / 4) t -= Math.PI / 2;
  if (t <= -Math.PI / 4) t += Math.PI / 2;
  return t;
};

/**
 * Classical CV sticker finder (OpenCV.js):
 * grayscale → Gaussian blur → Canny (auto thresholds from the median) → dilate → contours →
 * keep convex 4-gons that are roughly square and roughly the same size.
 * Every Mat is released in `finally` to avoid WASM heap leaks.
 */
export function findStickers(cv: CV, img: RGBAImage): StickerBlob[] {
  const mats: any[] = [];
  const track = <T>(m: T) => (mats.push(m), m);
  try {
    const src = track(cv.matFromImageData({ data: img.data, width: img.width, height: img.height } as ImageData));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const blur = track(new cv.Mat());
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

    // auto-Canny thresholds
    const hist: number[] = new Array(256).fill(0);
    const d = blur.data as Uint8Array;
    for (let i = 0; i < d.length; i += 3) hist[d[i]]++;
    let acc = 0, med = 0;
    const total = Math.ceil(d.length / 3);
    for (; med < 256; med++) { acc += hist[med]; if (acc >= total / 2) break; }
    const lo = Math.max(10, 0.5 * med), hi = Math.min(255, Math.max(40, 1.2 * med));

    const edges = track(new cv.Mat());
    cv.Canny(blur, edges, lo, hi);
    const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)));
    cv.dilate(edges, edges, kernel);

    const contours = track(new cv.MatVector());
    const hierarchy = track(new cv.Mat());
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const frameArea = img.width * img.height;
    const blobs: StickerBlob[] = [];
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      try {
        const area = cv.contourArea(c);
        if (area < frameArea / 900 || area > frameArea / 12) continue;
        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.06 * peri, true);
        const ok4 = approx.rows === 4 && cv.isContourConvex(approx);
        approx.delete();
        if (!ok4) continue;
        const rect = cv.minAreaRect(c);
        const w = rect.size.width, h = rect.size.height;
        if (!w || !h) continue;
        const aspect = Math.max(w, h) / Math.min(w, h);
        const fill = area / (w * h);
        if (aspect > 1.6 || fill < 0.7) continue;
        blobs.push({ center: [rect.center.x, rect.center.y], size: Math.sqrt(area), angle: fold((rect.angle * Math.PI) / 180) });
      } finally {
        c.delete();
      }
    }
    return dedupe(blobs);
  } finally {
    for (const m of mats) m.delete();
  }
}

/** Contours of the inner and outer edge of the same sticker produce near-duplicates; keep one. */
function dedupe(blobs: StickerBlob[]): StickerBlob[] {
  const out: StickerBlob[] = [];
  for (const b of blobs.sort((a, b) => b.size - a.size)) {
    if (!out.some((o) => Math.hypot(o.center[0] - b.center[0], o.center[1] - b.center[1]) < 0.5 * Math.min(o.size, b.size))) out.push(b);
  }
  return out;
}

/**
 * Fit a 3×3 lattice to sticker blobs. Stickers are projected onto the dominant grid axes, snapped to integer
 * lattice coordinates, and the best-populated 3×3 window is used to fit a homography (least squares) from
 * face coordinates to the image. Works even when a few stickers were missed (e.g. glare), as long as the
 * found ones span all three rows and columns.
 */
export function fitGrid(blobs: StickerBlob[]): FaceDetection | null {
  if (blobs.length < 5) return null;
  const sizes = blobs.map((b) => b.size).sort((a, b) => a - b);
  const medSize = sizes[sizes.length >> 1];
  const cand = blobs.filter((b) => b.size > 0.6 * medSize && b.size < 1.6 * medSize);
  if (cand.length < 5) return null;

  // dominant angle via circular mean of 4θ
  const sx = cand.reduce((s, b) => s + Math.cos(4 * b.angle), 0);
  const sy = cand.reduce((s, b) => s + Math.sin(4 * b.angle), 0);
  const theta = Math.atan2(sy, sx) / 4;
  const u: Pt = [Math.cos(theta), Math.sin(theta)];
  const v: Pt = [-Math.sin(theta), Math.cos(theta)];

  // pitch: median nearest-neighbour distance
  const nn = cand.map((a) => Math.min(...cand.filter((b) => b !== a).map((b) => Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]))));
  const pitch = [...nn].sort((a, b) => a - b)[nn.length >> 1];
  if (!pitch || pitch < medSize * 0.9 || pitch > medSize * 1.9) return null;

  const cx = cand.reduce((s, b) => s + b.center[0], 0) / cand.length;
  const cy = cand.reduce((s, b) => s + b.center[1], 0) / cand.length;
  const origin = cand.reduce((best, b) => (Math.hypot(b.center[0] - cx, b.center[1] - cy) < Math.hypot(best.center[0] - cx, best.center[1] - cy) ? b : best)).center;

  const lattice = cand
    .map((b) => {
      const dx = b.center[0] - origin[0], dy = b.center[1] - origin[1];
      const pu = (dx * u[0] + dy * u[1]) / pitch;
      const pv = (dx * v[0] + dy * v[1]) / pitch;
      return { b, i: Math.round(pu), j: Math.round(pv), err: Math.hypot(pu - Math.round(pu), pv - Math.round(pv)) };
    })
    .filter((p) => p.err < 0.35);

  // best 3×3 window
  let best: typeof lattice = [], bi = 0, bj = 0;
  for (let i0 = -2; i0 <= 0; i0++)
    for (let j0 = -2; j0 <= 0; j0++) {
      const inWin = lattice.filter((p) => p.i >= i0 && p.i <= i0 + 2 && p.j >= j0 && p.j <= j0 + 2);
      const cells = new Set(inWin.map((p) => `${p.i},${p.j}`)).size;
      if (cells > new Set(best.map((p) => `${p.i},${p.j}`)).size) { best = inWin; bi = i0; bj = j0; }
    }
  const cellSet = new Set(best.map((p) => `${p.i},${p.j}`));
  const rows = new Set(best.map((p) => p.j)), cols = new Set(best.map((p) => p.i));
  if (cellSet.size < 5 || rows.size < 3 || cols.size < 3) return null;

  const src: Pt[] = best.map((p) => [p.i - bi + 0.5, p.j - bj + 0.5]);
  const dst: Pt[] = best.map((p) => p.b.center);
  const H = computeHomography(src, dst);
  if (!H) return null;
  const quad: Pt[] = ([[0, 0], [3, 0], [3, 3], [0, 3]] as Pt[]).map((p) => applyH(H, p));
  if (!isConvexQuad(quad)) return null;

  const Hi = invertH(H);
  const error = best.reduce((s, p, k) => {
    const [x, y] = applyH(Hi, p.b.center);
    return s + Math.hypot(x - src[k][0], y - src[k][1]);
  }, 0) / best.length;
  if (error > 0.25) return null;

  const confidence = Math.max(0, Math.min(1, (cellSet.size / 9) * (1 - error / 0.25) ** 0.5));
  return { quad, cellsFound: cellSet.size, error, confidence, stickers: best.map((p) => p.b) };
}

export function detectFace(cv: CV, img: RGBAImage): FaceDetection | null {
  const det = fitGrid(findStickers(cv, img));
  if (!det) return null;
  // sanity: the face must be a reasonable fraction of the frame
  const frac = polygonArea(det.quad) / (img.width * img.height);
  if (frac < 0.02 || frac > 0.95) return null;
  return det;
}
