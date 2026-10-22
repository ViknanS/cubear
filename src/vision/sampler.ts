import { rgbToLab, type Lab } from './color';
import { applyH, faceHomography, type Pt } from './homography';
import type { RGBAImage } from './image';

export interface StickerSample {
  lab: Lab;
  /** Spread of the sampled pixels; large values mean the patch straddles a grid line or a glare spot. */
  spread: number;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[s.length >> 1];
};

/**
 * Perspective-correct sampling of the 9 stickers inside a face quad [TL, TR, BR, BL].
 * Each sticker is sampled on a 7×7 lattice in its inner 50 % (away from the black grid lines), and the
 * per-channel median is used so that specular highlights and stray dark pixels don't move the estimate.
 */
export function sampleFace(img: RGBAImage, quad: Pt[]): StickerSample[] | null {
  const H = faceHomography(quad);
  if (!H) return null;
  const out: StickerSample[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const Ls: number[] = [], As: number[] = [], Bs: number[] = [];
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 7; j++) {
          const u = c + 0.25 + (0.5 * j) / 6;
          const v = r + 0.25 + (0.5 * i) / 6;
          const [x, y] = applyH(H, [u, v]);
          const xi = Math.round(x), yi = Math.round(y);
          if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) continue;
          const k = (yi * img.width + xi) * 4;
          const lab = rgbToLab(img.data[k], img.data[k + 1], img.data[k + 2]);
          Ls.push(lab[0]); As.push(lab[1]); Bs.push(lab[2]);
        }
      if (Ls.length < 20) return null; // sticker falls outside the frame
      const lab: Lab = [median(Ls), median(As), median(Bs)];
      const spread = median(As.map((a, i) => Math.hypot(a - lab[1], Bs[i] - lab[2], (Ls[i] - lab[0]) * 0.5)));
      out.push({ lab, spread });
    }
  return out;
}

/** A fixed, centred guide square (used when automatic detection is unavailable or turned off). */
export function guideQuad(width: number, height: number, fraction = 0.6): Pt[] {
  const s = Math.min(width, height) * fraction;
  const x0 = (width - s) / 2, y0 = (height - s) / 2;
  return [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];
}
