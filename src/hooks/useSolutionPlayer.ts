import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Cube3DHandle } from '../components/Cube3D';
import { applyMoves, invertMove } from '../cube/moves';
import type { StickerArray } from '../cube/types';
import { useApp } from '../state/store';
import { sounds } from '../feedback';

/**
 * Drives the 3D cube in lock-step with the solution step stored in the app state.
 * `step` = number of moves already done; the cube shows the state after those moves.
 */
export function useSolutionPlayer(cube: React.RefObject<Cube3DHandle | null>) {
  const stickers = useApp((s) => s.stickers);
  const solution = useApp((s) => s.solution);
  const step = useApp((s) => s.step);
  const setStep = useApp((s) => s.setStep);
  const sound = useApp((s) => s.settings.sound);
  const moves = useMemo(() => solution?.moves ?? [], [solution]);
  const [playing, setPlaying] = useState(false);
  const busy = useRef(false);

  const stateAt = useCallback((n: number): StickerArray => applyMoves(stickers, moves.slice(0, n)), [stickers, moves]);
  const current = moves[step] ?? null;

  // keep the cube visually in sync whenever the step changes from outside an animation
  useEffect(() => {
    if (!busy.current) {
      cube.current?.setState(stateAt(step));
      cube.current?.highlight(current);
    }
  }, [step, stateAt, current, cube]);

  const animate = useCallback(async (from: number, move: string, to: number) => {
    busy.current = true;
    cube.current?.setState(stateAt(from));
    cube.current?.highlight(move);
    await cube.current?.play(move, 520);
    busy.current = false;
    setStep(to);
  }, [cube, setStep, stateAt]);

  const next = useCallback(async () => {
    if (busy.current || step >= moves.length) return;
    if (sound) sounds.move();
    await animate(step, moves[step], step + 1);
  }, [animate, moves, step, sound]);

  const prev = useCallback(async () => {
    if (busy.current || step <= 0) return;
    await animate(step, invertMove(moves[step - 1]), step - 1);
  }, [animate, moves, step]);

  /** Re-play the animation of the current move, then return to the pre-move state. */
  const repeat = useCallback(async () => {
    if (busy.current || !current) return;
    busy.current = true;
    cube.current?.setState(stateAt(step));
    cube.current?.highlight(current);
    await cube.current?.play(current, 650);
    await new Promise((r) => setTimeout(r, 350));
    cube.current?.setState(stateAt(step));
    busy.current = false;
  }, [cube, current, stateAt, step]);

  const restart = useCallback(() => { setPlaying(false); setStep(0); }, [setStep]);
  const goto = useCallback((n: number) => { if (!busy.current) setStep(n); }, [setStep]);

  useEffect(() => {
    if (!playing) return;
    if (step >= moves.length) { setPlaying(false); return; }
    const t = setTimeout(() => void next(), 380);
    return () => clearTimeout(t);
  }, [playing, step, moves.length, next]);

  return { moves, step, current, playing, setPlaying, next, prev, repeat, restart, goto, stateAt };
}
