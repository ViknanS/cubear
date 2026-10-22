import { COLOR_HEX, type ColorName } from '../cube/types';
import { applyH, faceHomography, type Pt } from '../vision/homography';
import { rotateFacePoint, type ArrowSpec } from './guide';

/** Map a point in video pixels to CSS pixels of an element that shows the video with `object-fit: cover`. */
export function videoToScreen(video: HTMLVideoElement, el: HTMLElement): (p: Pt) => Pt {
  const vw = video.videoWidth || 1, vh = video.videoHeight || 1;
  const cw = el.clientWidth, ch = el.clientHeight;
  const s = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2;
  return ([x, y]) => [x * s + ox, y * s + oy];
}

export function prepareCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

/** Detected 3×3 grid drawn onto the physical face (scan screen). */
export function drawDetectionGrid(ctx: CanvasRenderingContext2D, quad: Pt[], colors: ColorName[] | null, confidence: number[] | null, good: boolean) {
  const H = faceHomography(quad);
  if (!H) return;
  const P = (u: number, v: number) => applyH(H, [u, v]);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = good ? 'rgba(80,220,160,0.95)' : 'rgba(110,150,255,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 3; i++) {
    const a = P(i, 0), b = P(i, 3), c = P(0, i), d = P(3, i);
    ctx.moveTo(...a); ctx.lineTo(...b); ctx.moveTo(...c); ctx.lineTo(...d);
  }
  ctx.stroke();
  if (!colors) return;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const k = r * 3 + c;
      const [x, y] = P(c + 0.5, r + 0.5);
      const rad = Math.max(6, Math.hypot(...(P(c + 0.5, r + 0.5).map((v, i) => v - P(c + 0.85, r + 0.5)[i]) as Pt)) * 0.55);
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_HEX[colors[k]];
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = confidence && confidence[k] < 0.2 ? '#ffb020' : 'rgba(5,8,20,0.85)';
      ctx.stroke();
      if (confidence && confidence[k] < 0.2) {
        ctx.fillStyle = '#111';
        ctx.font = `bold ${Math.round(rad)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x, y + 1);
      }
    }
}

function drawHead(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, size: number) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  ctx.beginPath();
  ctx.moveTo(to[0] + Math.cos(a) * size * 0.3, to[1] + Math.sin(a) * size * 0.3);
  ctx.lineTo(to[0] + Math.cos(a + 2.5) * size, to[1] + Math.sin(a + 2.5) * size);
  ctx.lineTo(to[0] + Math.cos(a - 2.5) * size, to[1] + Math.sin(a - 2.5) * size);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw the move instruction on the tracked face. `quad` is the face in screen coordinates; `rotation` is how far
 * (clockwise quarter turns) the cube is rotated in the image, so arrows stay attached to the physical layers.
 */
export function drawMoveArrow(ctx: CanvasRenderingContext2D, quad: Pt[], spec: ArrowSpec, rotation: number, t: number) {
  const H = faceHomography(quad);
  if (!H) return;
  const P = (p: Pt) => applyH(H, rotateFacePoint(p, rotation));
  const faceSize = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]);

  // highlight layer
  const pulse = 0.28 + 0.12 * Math.sin(t / 220);
  ctx.fillStyle = `rgba(79,124,255,${pulse})`;
  ctx.strokeStyle = 'rgba(160,185,255,0.95)';
  ctx.lineWidth = 2;
  for (const [r, c] of spec.cells) {
    const pts = ([[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]] as Pt[]).map(P);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // arrow body (animated dash flow)
  const path = spec.path.map(P);
  const width = Math.max(6, faceSize * 0.075);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(139,92,246,0.9)';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = spec.behind ? 'rgba(196,170,255,0.95)' : '#ffffff';
  ctx.lineWidth = width;
  if (spec.behind) ctx.setLineDash([width * 1.4, width * 1.1]);
  ctx.lineDashOffset = -t / 30;
  ctx.beginPath();
  path.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = spec.behind ? 'rgba(196,170,255,0.95)' : '#ffffff';
  drawHead(ctx, path[path.length - 2], path[path.length - 1], width * 2.1);
  if (spec.double) {
    const mid = path[Math.floor(path.length / 2)];
    ctx.font = `800 ${Math.round(width * 2.2)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,12,30,0.9)';
    ctx.strokeText('×2', mid[0] + width * 1.8, mid[1] - width * 1.8);
    ctx.fillText('×2', mid[0] + width * 1.8, mid[1] - width * 1.8);
  }
  ctx.restore();
}
