'use client';

import { useEffect, useState } from 'react';
import { PresetRow } from '@/lib/types';
import ParentGallery from './ParentGallery';

interface Dashboard {
  device: { id: string; name: string | null; isActive: boolean; dailyLimit: number };
  usedToday: number;
  settings: {
    saveOriginals: boolean;
    saveGenerated: boolean;
    autoDeleteOriginalsDays: number;
    autoDeleteGeneratedDays: number;
  } | null;
  presets: PresetRow[];
}

export default function ParentDashboard({
  deviceId,
  onLogout,
}: {
  deviceId: string;
  onLogout: () => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>('');

  const load = async () => {
    const res = await fetch('/api/parent/settings');
    if (res.ok) setData(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const saveSettings = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch('/api/parent/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await load();
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  const savePreset = async (patch: Record<string, unknown>) => {
    await fetch('/api/parent/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await load();
  };

  const logout = async () => {
    await fetch('/api/parent/logout', { method: 'POST' });
    onLogout();
  };

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-camera-blue">
        <span className="text-soft-slate">Loading…</span>
      </div>
    );
  }

  const s = data.settings;

  return (
    <div className="min-h-dvh bg-camera-blue p-4 pb-16">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-charcoal">Parent Dashboard</h1>
          <div className="flex gap-2">
            <a href="/" className="rounded-lg bg-paper-white px-4 py-2 text-sm font-bold text-slate">
              Camera
            </a>
            <button
              onClick={logout}
              className="rounded-lg bg-charcoal px-4 py-2 text-sm font-bold text-paper-white"
            >
              Lock
            </button>
          </div>
        </header>

        {/* Usage + limit */}
        <section className="panel">
          <h2 className="mb-3 text-base font-extrabold text-camera-blue">Usage</h2>
          <p className="mb-4 text-3xl font-extrabold text-charcoal">
            {data.usedToday}
            <span className="text-base font-semibold text-soft-slate">
              {' '}
              / {data.device.dailyLimit} today
            </span>
          </p>

          <label className="field-label" htmlFor="limit">
            Daily generation limit
          </label>
          <div className="flex gap-2">
            <input
              id="limit"
              type="number"
              min={0}
              max={200}
              className="input"
              defaultValue={data.device.dailyLimit}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== data.device.dailyLimit) saveSettings({ dailyLimit: v });
              }}
            />
          </div>

          <label className="mt-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-charcoal">
              Camera active (off = locked)
            </span>
            <input
              type="checkbox"
              className="h-6 w-6 accent-camera-blue"
              checked={data.device.isActive}
              onChange={(e) => saveSettings({ isActive: e.target.checked })}
            />
          </label>
        </section>

        {/* Storage settings */}
        <section className="panel">
          <h2 className="mb-3 text-base font-extrabold text-camera-blue">Storage</h2>
          <Toggle
            label="Save original photos"
            checked={!!s?.saveOriginals}
            onChange={(v) => saveSettings({ saveOriginals: v })}
          />
          <Toggle
            label="Save generated images"
            checked={!!s?.saveGenerated}
            onChange={(v) => saveSettings({ saveGenerated: v })}
          />
          <NumberRow
            label="Auto-delete originals after (days)"
            value={s?.autoDeleteOriginalsDays ?? 30}
            onSave={(v) => saveSettings({ autoDeleteOriginalsDays: v })}
          />
          <NumberRow
            label="Auto-delete generated after (days)"
            value={s?.autoDeleteGeneratedDays ?? 90}
            onSave={(v) => saveSettings({ autoDeleteGeneratedDays: v })}
          />
          <p className="mt-2 text-xs text-soft-slate">
            Auto-delete days are stored for a future scheduled cleanup job (PRD §11).
          </p>
        </section>

        {/* Preset manager */}
        <section className="panel">
          <h2 className="mb-3 text-base font-extrabold text-camera-blue">Magic presets</h2>
          <div className="flex flex-col gap-3">
            {data.presets.map((p) => (
              <PresetEditor key={p.id} preset={p} onSave={savePreset} />
            ))}
          </div>
        </section>

        {/* Gallery management */}
        <section className="panel">
          <h2 className="mb-3 text-base font-extrabold text-camera-blue">Gallery</h2>
          <ParentGallery deviceId={deviceId} />
        </section>

        <p className="text-center text-xs text-slate">
          {saving ? 'Saving…' : savedAt ? `Saved at ${savedAt}` : ''}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm font-semibold text-charcoal">{label}</span>
      <input
        type="checkbox"
        className="h-6 w-6 accent-camera-blue"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function NumberRow({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (v: number) => void;
}) {
  return (
    <div className="py-2">
      <label className="field-label">{label}</label>
      <input
        type="number"
        min={0}
        className="input"
        defaultValue={value}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (v !== value) onSave(v);
        }}
      />
    </div>
  );
}

function PresetEditor({
  preset,
  onSave,
}: {
  preset: PresetRow;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(preset.prompt);

  return (
    <div className="rounded-toy bg-white p-3 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <button
          className="flex items-center gap-2 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="text-2xl">{preset.emoji ?? '✨'}</span>
          <span className="font-bold text-charcoal">{preset.label}</span>
        </button>
        <label className="flex items-center gap-2 text-xs font-semibold text-soft-slate">
          {preset.is_enabled ? 'On' : 'Off'}
          <input
            type="checkbox"
            className="h-6 w-6 accent-camera-blue"
            checked={preset.is_enabled}
            onChange={(e) => onSave({ presetId: preset.id, isEnabled: e.target.checked })}
          />
        </label>
      </div>

      {open && (
        <div className="mt-3">
          <label className="field-label">Prompt</label>
          <textarea
            className="input min-h-[120px]"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="rounded-lg bg-magic-yellow px-4 py-2 text-sm font-bold text-charcoal disabled:opacity-40"
              disabled={prompt.trim() === preset.prompt.trim() || !prompt.trim()}
              onClick={() => onSave({ presetId: preset.id, prompt })}
            >
              Save prompt
            </button>
            <button
              className="rounded-lg bg-paper-white px-4 py-2 text-sm font-bold text-slate"
              onClick={() => setPrompt(preset.prompt)}
            >
              Reset
            </button>
          </div>
          <p className="mt-2 text-xs text-soft-slate">
            Keep child-safe guardrails: no horror, violence, weapons, or adult themes.
          </p>
        </div>
      )}
    </div>
  );
}
