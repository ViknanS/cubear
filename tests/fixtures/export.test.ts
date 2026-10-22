/**
 * `npm run fixtures` — writes the deterministic CV fixtures to disk so they can be inspected:
 *   tests/fixtures/images/*.png    one PNG per lighting / perspective condition
 *   tests/fixtures/video/front-face.y4m  fake camera feed used by the Playwright scan test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
import type { RGBAImage } from '../../src/vision/image';
import { FIXTURES, FIXTURE_FACE, renderFace } from './synth';

const here = dirname(fileURLToPath(import.meta.url));

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(img: RGBAImage): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((img.width * 4 + 1) * img.height);
  for (let y = 0; y < img.height; y++) {
    raw[y * (img.width * 4 + 1)] = 0;
    Buffer.from(img.data.buffer, img.data.byteOffset + y * img.width * 4, img.width * 4).copy(raw, y * (img.width * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** YUV4MPEG2 (4:2:0) — the format Chrome's --use-file-for-fake-video-capture expects. */
export function encodeY4M(img: RGBAImage, frames = 10): Buffer {
  const { width: W, height: H, data } = img;
  const Y = Buffer.alloc(W * H), U = Buffer.alloc((W / 2) * (H / 2)), V = Buffer.alloc((W / 2) * (H / 2));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      Y[y * W + x] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
      if (y % 2 === 0 && x % 2 === 0) {
        const k = (y / 2) * (W / 2) + x / 2;
        U[k] = Math.max(0, Math.min(255, Math.round(128 - 0.168736 * r - 0.331264 * g + 0.5 * b)));
        V[k] = Math.max(0, Math.min(255, Math.round(128 + 0.5 * r - 0.418688 * g - 0.081312 * b)));
      }
    }
  const frame = Buffer.concat([Buffer.from('FRAME\n'), Y, U, V]);
  return Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`), ...Array(frames).fill(frame)]);
}

it('exports fixture images and the fake camera video', () => {
  mkdirSync(join(here, 'images'), { recursive: true });
  for (const f of FIXTURES) writeFileSync(join(here, 'images', `${f.name}.png`), encodePNG(renderFace(f.opts)));
  mkdirSync(join(here, 'video'), { recursive: true });
  const cam = renderFace({ width: 640, height: 480, colors: FIXTURE_FACE, quad: [[200, 120], [440, 120], [440, 360], [200, 360]], noise: 4, seed: 42 });
  writeFileSync(join(here, 'video', 'front-face.y4m'), encodeY4M(cam));
  expect(FIXTURES.length).toBeGreaterThan(5);
});
