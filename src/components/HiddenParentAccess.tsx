'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

// Wraps the logo. A 3-second long-press (hard for a 4-year-old) opens parent mode.
export default function HiddenParentAccess({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    timer.current = setTimeout(() => router.push('/parent'), 3000);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className="no-select inline-block"
    >
      {children}
    </div>
  );
}
