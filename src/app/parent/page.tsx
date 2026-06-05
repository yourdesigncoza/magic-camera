'use client';

import { useEffect, useState } from 'react';
import { registerDevice } from '@/lib/clientDevice';
import PinGate from '@/components/parent/PinGate';
import ParentDashboard from '@/components/parent/ParentDashboard';

type State =
  | { phase: 'loading' }
  | { phase: 'gate'; deviceId: string; mode: 'create' | 'enter' }
  | { phase: 'dashboard'; deviceId: string };

export default function ParentPage() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  const init = async () => {
    try {
      const dev = await registerDevice();
      const status = await fetch(`/api/parent/status?deviceId=${dev.deviceId}`).then((r) =>
        r.json(),
      );
      if (status.authed) {
        setState({ phase: 'dashboard', deviceId: dev.deviceId });
      } else {
        setState({
          phase: 'gate',
          deviceId: dev.deviceId,
          mode: status.hasPin ? 'enter' : 'create',
        });
      }
    } catch {
      setState({ phase: 'loading' });
    }
  };

  useEffect(() => {
    init();
  }, []);

  if (state.phase === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-camera-blue">
        <span className="text-soft-slate">Loading…</span>
      </div>
    );
  }

  if (state.phase === 'gate') {
    return (
      <PinGate
        deviceId={state.deviceId}
        mode={state.mode}
        onSuccess={() => setState({ phase: 'dashboard', deviceId: state.deviceId })}
      />
    );
  }

  return (
    <ParentDashboard
      deviceId={state.deviceId}
      onLogout={() => setState({ phase: 'gate', deviceId: state.deviceId, mode: 'enter' })}
    />
  );
}
