/** Minimal RGBA image shape — satisfied by browser ImageData and by test fixtures in Node. */
export interface RGBAImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export function meanLuminance(img: RGBAImage, step = 8): number {
  let s = 0, n = 0;
  for (let y = 0; y < img.height; y += step)
    for (let x = 0; x < img.width; x += step) {
      const i = (y * img.width + x) * 4;
      s += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
      n++;
    }
  return n ? s / n : 0;
}
