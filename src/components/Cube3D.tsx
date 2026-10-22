import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { StickerArray } from '../cube/types';
import { CubeViewer, webglAvailable, type ViewerOptions } from '../three/CubeViewer';
import { CubeNet } from './CubeNet';

export interface Cube3DHandle {
  play(move: string, ms?: number): Promise<void>;
  setState(s: StickerArray): void;
  highlight(move: string | null): void;
  highlightStickers(ids: number[]): void;
  orient(euler: [number, number, number], instant?: boolean): void;
  frontView(): void;
}

interface Props extends ViewerOptions {
  stickers: StickerArray;
  className?: string;
  label?: string;
}

/** React wrapper around CubeViewer. Falls back to a 2D net when WebGL is unavailable. */
export const Cube3D = forwardRef<Cube3DHandle, Props>(function Cube3D({ stickers, className, label, ...opts }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<CubeViewer | null>(null);
  const [gl] = useState(() => typeof window !== 'undefined' && webglAvailable());

  useEffect(() => {
    if (!gl || !host.current) return;
    viewer.current = new CubeViewer(host.current, stickers, opts);
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
    // the viewer is created once per mount; later sticker changes go through setState
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useEffect(() => {
    if (viewer.current && !viewer.current.model.animating) viewer.current.model.setState(stickers);
  }, [stickers]);

  useEffect(() => {
    if (viewer.current) viewer.current.autoRotate = !!opts.autoRotate;
  }, [opts.autoRotate]);

  useImperativeHandle(ref, () => ({
    play: (m, ms) => viewer.current?.model.animateMove(m, ms) ?? Promise.resolve(),
    setState: (s) => viewer.current?.model.setState(s),
    highlight: (m) => viewer.current?.model.highlightMove(m),
    highlightStickers: (ids) => viewer.current?.model.setHighlightedStickers(ids),
    orient: (e, i) => viewer.current?.orientTo(e, i),
    frontView: () => viewer.current?.frontView(),
  }));

  if (!gl) {
    return (
      <div className={className} aria-label={label}>
        <p className="text-xs text-[var(--muted)] mb-2">3D view unavailable on this device (no WebGL) — showing the cube net.</p>
        <CubeNet stickers={stickers} compact />
      </div>
    );
  }
  return <div ref={host} className={className} aria-label={label ?? '3D cube'} role="img" />;
});
