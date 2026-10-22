import { useEffect, useRef, useState } from 'react';
import type { ColorName } from '../cube/types';
import { classify, defaultPrototypes, MIN_CONFIDENCE, type Lab, type Prototypes } from '../vision/color';
import { detectFace, type CV } from '../vision/detector';
import type { Pt } from '../vision/homography';
import { meanLuminance } from '../vision/image';
import { loadOpenCV } from '../vision/opencvLoader';
import { guideQuad, sampleFace } from '../vision/sampler';

export type TrackMode = 'auto' | 'guide';

export interface FrameResult {
  /** Face quad in *video pixel* coordinates, or null when no face is located. */
  quad: Pt[] | null;
  colors: ColorName[] | null;
  labs: Lab[] | null;
  confidence: number[] | null;
  detConfidence: number;
  lowLight: boolean;
  mode: TrackMode;
  /** Same colors for several consecutive frames, every sticker above the confidence threshold. */
  stable: boolean;
  t: number;
}

const PROC_W = 360;

/**
 * Per-frame vision loop (~12 fps): downscale the video frame, find the face with OpenCV (or use the fixed guide
 * box), sample and classify the 9 stickers, and report the result. All work happens in one reusable canvas.
 */
export function useFaceTracker(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  opts: { enabled: boolean; mode: TrackMode; protos?: Prototypes; onFrame?: (r: FrameResult) => void },
) {
  const [cvState, setCvState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const cvRef = useRef<CV | null>(null);
  const [result, setResult] = useState<FrameResult | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let alive = true;
    loadOpenCV()
      .then((cv) => { if (alive) { cvRef.current = cv; setCvState('ready'); } })
      .catch(() => alive && setCvState('failed'));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!opts.enabled) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    let raf = 0, last = 0, busy = false;
    const history: string[] = [];

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const v = videoRef.current;
      if (busy || now - last < 80 || !v || v.readyState < 2 || !v.videoWidth || document.hidden) return;
      last = now;
      busy = true;
      try {
        const { mode, protos } = optsRef.current;
        const scale = PROC_W / v.videoWidth;
        const w = PROC_W, h = Math.round(v.videoHeight * scale);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const lum = meanLuminance(img);
        const useAuto = mode === 'auto' && cvRef.current;
        let quad: Pt[] | null = null, detConfidence = 0;
        if (useAuto) {
          const det = detectFace(cvRef.current, img);
          if (det) { quad = det.quad; detConfidence = det.confidence; }
        } else {
          quad = guideQuad(w, h);
          detConfidence = 1;
        }
        let colors: ColorName[] | null = null, labs: Lab[] | null = null, confidence: number[] | null = null;
        if (quad) {
          const samples = sampleFace(img, quad);
          if (samples) {
            const p = protos ?? defaultPrototypes();
            const cls = samples.map((s) => classify(s.lab, p));
            colors = cls.map((c) => c.color);
            labs = samples.map((s) => s.lab);
            // glare / misalignment penalty from patch spread
            confidence = cls.map((c, i) => (samples[i].spread > 14 ? c.confidence * 0.5 : c.confidence));
          } else quad = null;
        }
        const sig = colors && confidence && confidence.every((c) => c >= MIN_CONFIDENCE) && detConfidence >= 0.6 ? colors.join() : '';
        history.push(sig);
        if (history.length > 4) history.shift();
        const stable = !!sig && history.length === 4 && history.every((x) => x === sig);
        const r: FrameResult = {
          quad: quad ? quad.map(([x, y]) => [x / scale, y / scale] as Pt) : null,
          colors, labs, confidence, detConfidence,
          lowLight: lum < 45,
          mode: useAuto ? 'auto' : 'guide',
          stable,
          t: now,
        };
        setResult(r);
        optsRef.current.onFrame?.(r);
      } catch (e) {
        console.warn('[tracker]', e);
      } finally {
        busy = false;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [opts.enabled, videoRef]);

  return { result, cvState };
}
