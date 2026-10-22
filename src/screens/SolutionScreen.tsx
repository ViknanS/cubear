import { useRef } from 'react';
import { Cube3D, type Cube3DHandle } from '../components/Cube3D';
import { MoveList } from '../components/MoveList';
import { Header, Panel, ProgressBar } from '../components/ui';
import { describeMove, frontViewHint } from '../cube/moves';
import { useSolutionPlayer } from '../hooks/useSolutionPlayer';
import { useApp } from '../state/store';

export function SolutionScreen() {
  const cube = useRef<Cube3DHandle>(null);
  const solution = useApp((s) => s.solution);
  const go = useApp((s) => s.go);
  const markStarted = useApp((s) => s.markStarted);
  const p = useSolutionPlayer(cube);

  if (!solution) {
    return (
      <main className="flex-1 flex flex-col">
        <Header title="Solution" />
        <div className="p-6 text-center text-[var(--muted)]">No solution yet. <button className="underline" onClick={() => go('home')}>Start over</button></div>
      </main>
    );
  }
  const total = solution.moves.length;
  const solvedAlready = total === 0;

  return (
    <main className="flex-1 flex flex-col fade-in">
      <Header title="Solution" />
      <div className="px-4 pb-36 max-w-3xl w-full mx-auto flex flex-col gap-4">
        <Panel className="flex items-center gap-4">
          <div>
            <div className="text-4xl font-display font-bold" data-testid="move-count">{total}</div>
            <div className="text-xs text-[var(--muted)]">moves</div>
          </div>
          <div className="text-sm text-[var(--muted)] flex-1">
            {solvedAlready
              ? 'Your cube is already solved — nothing to do!'
              : <>Kociemba two-phase solution, verified by replaying every move on the scanned state. Computed in {Math.max(1, Math.round(solution.ms))} ms.</>}
          </div>
        </Panel>

        <Panel className="relative !p-0 overflow-hidden">
          <Cube3D ref={cube} stickers={p.stateAt(p.step)} interactive className="w-full h-[300px]" label="Solution animation" />
          <div className="absolute top-3 left-3 chip glass" data-testid="step-label">
            {p.step >= total ? 'Solved ✓' : `Step ${p.step + 1} of ${total}`}
          </div>
        </Panel>

        {!solvedAlready && (
          <>
            <Panel>
              <ProgressBar value={total ? p.step / total : 1} label="Solution progress" />
              {p.current ? (
                <div className="mt-3">
                  <div className="flex items-baseline gap-3">
                    <span className="move-chip text-3xl" style={{ color: 'var(--accent)' }}>{p.current}</span>
                    <span className="text-sm">{describeMove(p.current)}</span>
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-1">Holding the cube with the scanned front toward you: {frontViewHint(p.current)}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--ok)]">All moves done.</p>
              )}
              <div className="grid grid-cols-5 gap-2 mt-4">
                <button className="btn btn-ghost btn-icon" onClick={p.restart} aria-label="Restart solution">⏮</button>
                <button className="btn btn-ghost btn-icon" onClick={p.prev} disabled={p.step === 0} aria-label="Previous move">◀</button>
                <button className="btn btn-ghost btn-icon" onClick={() => p.setPlaying(!p.playing)} disabled={p.step >= total} aria-label={p.playing ? 'Pause preview' : 'Play preview'}>{p.playing ? '❚❚' : '▶'}</button>
                <button className="btn btn-ghost btn-icon" onClick={p.next} disabled={p.step >= total} aria-label="Next move">▶▏</button>
                <button className="btn btn-ghost btn-icon" onClick={p.repeat} disabled={!p.current} aria-label="Repeat animation">↻</button>
              </div>
            </Panel>
            <Panel>
              <h2 className="text-sm font-semibold mb-2">Move sequence</h2>
              <MoveList moves={solution.moves} step={p.step} onPick={p.goto} />
            </Panel>
          </>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 px-4 safe-bottom pt-3 glass-strong !border-x-0 !border-b-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          {solvedAlready ? (
            <button className="btn btn-primary flex-1 h-14" onClick={() => go('success')}>Finish</button>
          ) : (
            <button className="btn btn-primary flex-1 h-14" onClick={() => { p.setPlaying(false); markStarted(); go('ar'); }} data-testid="start-ar">
              Start AR Guide
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
