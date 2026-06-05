'use client';

import { useState } from 'react';

interface Props {
  deviceId: string;
  mode: 'create' | 'enter';
  onSuccess: () => void;
}

// PIN entry / first-time PIN creation for parent mode.
export default function PinGate({ deviceId, mode, onSuccess }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!/^\d{4,8}$/.test(pin)) {
      setError('PIN must be 4–8 digits');
      return;
    }
    if (mode === 'create' && pin !== confirm) {
      setError('PINs do not match');
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === 'create' ? '/api/parent/setup' : '/api/parent/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Something went wrong');
        return;
      }
      onSuccess();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-camera-blue p-6">
      <div className="panel w-full max-w-sm">
        <h1 className="mb-1 text-xl font-extrabold text-charcoal">
          {mode === 'create' ? 'Create a parent PIN' : 'Grown-ups only'}
        </h1>
        <p className="mb-5 text-sm text-soft-slate">
          {mode === 'create'
            ? 'Set a PIN to protect settings and the gallery.'
            : 'Enter your PIN to manage Magic Camera.'}
        </p>

        <label className="field-label" htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          className="input mb-4"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          maxLength={8}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />

        {mode === 'create' && (
          <>
            <label className="field-label" htmlFor="confirm">
              Confirm PIN
            </label>
            <input
              id="confirm"
              className="input mb-4"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirm}
              maxLength={8}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
            />
          </>
        )}

        {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}

        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? '…' : mode === 'create' ? 'Save PIN' : 'Unlock'}
        </button>

        <a href="/" className="mt-3 block text-center text-sm font-semibold text-slate">
          ← Back to camera
        </a>
      </div>
    </div>
  );
}
