'use client';

import { PublicPreset } from '@/lib/types';

interface Props {
  presets: PublicPreset[];
  onPick: (presetId: string) => void;
  disabled?: boolean;
}

export default function PresetGrid({ presets, onPick, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p.id)}
          disabled={disabled}
          className="preset-tile"
          aria-label={p.label}
        >
          <span className="text-4xl" aria-hidden>
            {p.emoji ?? '✨'}
          </span>
          <span className="text-sm font-extrabold leading-tight text-charcoal">
            {p.label}
          </span>
        </button>
      ))}
    </div>
  );
}
