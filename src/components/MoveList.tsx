import { useEffect, useRef } from 'react';

export function MoveList({ moves, step, onPick }: { moves: string[]; step: number; onPick?: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Only scroll the page if the current chip is actually off-screen (never on first render).
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${step}"]`);
    if (!el || step === 0) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 110 || r.top < 70) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [step]);
  return (
    <div ref={box} className="flex flex-wrap gap-1.5" data-testid="move-list">
      {moves.map((m, i) => (
        <button
          key={i}
          data-i={i}
          onClick={() => onPick?.(i)}
          className="move-chip px-2.5 h-9 rounded-xl text-sm transition-all"
          style={{
            background: i === step ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : i < step ? 'rgba(61,220,151,.16)' : 'var(--panel)',
            color: i === step ? 'white' : i < step ? 'var(--ok)' : 'var(--text)',
            border: '1px solid var(--border)',
            transform: i === step ? 'scale(1.08)' : undefined,
          }}
          aria-current={i === step ? 'step' : undefined}
          aria-label={`Move ${i + 1}: ${m}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
