import { COLORS, FACES, FACE_NAMES, type ColorName, type Face, type StickerArray } from './types';

export class ConversionError extends Error {}

/** Map each face to the color of its center sticker. */
export function centerScheme(stickers: StickerArray): Record<Face, ColorName> {
  const out = {} as Record<Face, ColorName>;
  FACES.forEach((f, i) => {
    const c = stickers[9 * i + 4];
    if (!c) throw new ConversionError(`The ${FACE_NAMES[f]} center sticker has no color.`);
    out[f] = c;
  });
  return out;
}

/** Convert 54 color stickers into a URFDLB facelet string using the centers as the color→face key. */
export function stickersToFacelets(stickers: StickerArray): string {
  const scheme = centerScheme(stickers);
  const colorToFace = new Map<ColorName, Face>();
  for (const f of FACES) {
    if (colorToFace.has(scheme[f])) throw new ConversionError('Two faces have the same center color.');
    colorToFace.set(scheme[f], f);
  }
  return stickers
    .map((s, i) => {
      if (!s) throw new ConversionError(`Sticker ${i + 1} has no color.`);
      const f = colorToFace.get(s);
      if (!f) throw new ConversionError(`Color ${s} is not a center color.`);
      return f;
    })
    .join('');
}

export function faceletsToStickers(facelets: string, scheme: Record<Face, ColorName>): StickerArray {
  return facelets.split('').map((f) => scheme[f as Face]);
}

export function colorCounts(stickers: StickerArray): Record<ColorName, number> {
  const counts = Object.fromEntries(COLORS.map((c) => [c, 0])) as Record<ColorName, number>;
  for (const s of stickers) if (s) counts[s]++;
  return counts;
}
