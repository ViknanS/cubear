import { useState } from 'react';
import { COLORS, COLOR_HEX, UNKNOWN_HEX, type ColorName, type Sticker } from '../cube/types';

export function ColorPalette({ value, onChange }: { value: ColorName | null; onChange: (c: ColorName) => void }) {
  return (
    <div className="flex gap-2 justify-center flex-wrap" role="radiogroup" aria-label="Paint color">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          data-testid={`palette-${c}`}
          onClick={() => onChange(c)}
          className="w-11 h-11 rounded-xl transition-transform active:scale-90"
          style={{
            background: COLOR_HEX[c],
            outline: value === c ? '3px solid var(--accent)' : '1px solid rgba(255,255,255,.15)',
            outlineOffset: 2,
            transform: value === c ? 'scale(1.06)' : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** Modal to type in one face by hand (used when automatic detection struggles). */
export function FaceEditor({ title, initial, onSave, onCancel }: { title: string; initial?: Sticker[]; onSave: (c: ColorName[]) => void; onCancel: () => void }) {
  const [cells, setCells] = useState<Sticker[]>(initial ?? Array(9).fill(null));
  const [paint, setPaint] = useState<ColorName>('white');
  const done = cells.every(Boolean);
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-3" role="dialog" aria-modal aria-label={title}>
      <div className="glass-strong rounded-3xl p-5 w-full max-w-sm fade-in safe-bottom">
        <h2 className="font-display text-lg font-semibold mb-1">{title}</h2>
        <p className="text-sm text-[var(--muted)] mb-4">Pick a color, then tap stickers exactly as you see the face in the camera.</p>
        <div className="grid grid-cols-3 gap-2 w-48 mx-auto mb-4 p-2 rounded-2xl bg-black/60">
          {cells.map((c, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Sticker ${i + 1}: ${c ?? 'unset'}`}
              onClick={() => setCells((p) => p.map((v, k) => (k === i ? paint : v)))}
              className="aspect-square rounded-lg active:scale-90 transition-transform"
              style={{ background: c ? COLOR_HEX[c] : UNKNOWN_HEX }}
            />
          ))}
        </div>
        <ColorPalette value={paint} onChange={setPaint} />
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={!done} onClick={() => onSave(cells as ColorName[])}>Save face</button>
        </div>
      </div>
    </div>
  );
}
