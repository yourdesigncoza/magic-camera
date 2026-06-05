'use client';

import { useEffect, useState } from 'react';
import {
  initInstallCapture,
  getInstallState,
  subscribe,
  promptInstall,
} from '@/lib/pwaInstall';

// "Add to Home Screen" button. Always visible until installed. Reads the
// globally-captured install event (see pwaInstall.ts) so a real one-tap install
// works even though this button mounts after the event has already fired.
//   - captured prompt available → fire the native install dialog;
//   - iOS Safari → Share → Add to Home Screen steps;
//   - otherwise → generic "use the browser menu" steps.
export default function InstallPrompt() {
  const [, force] = useState(0);
  const [isIOS, setIsIOS] = useState(false);
  const [help, setHelp] = useState<null | 'ios' | 'generic'>(null);

  useEffect(() => {
    initInstallCapture();
    const unsub = subscribe(() => force((n) => n + 1));
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(
      /iphone|ipad|ipod/.test(ua) ||
        (ua.includes('macintosh') && navigator.maxTouchPoints > 1),
    );
    return unsub;
  }, []);

  const { canPrompt, installed } = getInstallState();
  if (installed) return null;

  const onClick = async () => {
    if (canPrompt) {
      await promptInstall();
      return;
    }
    setHelp(isIOS ? 'ios' : 'generic');
  };

  return (
    <>
      <button onClick={onClick} className="btn-secondary w-full">
        📲 Add to Home Screen
      </button>

      {help && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/80 p-4"
          onClick={() => setHelp(null)}
        >
          <div className="panel w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-extrabold text-charcoal">
              Add Magic Camera to your phone
            </h2>
            {help === 'ios' ? (
              <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-slate">
                <li>
                  Tap the <strong>Share</strong> button{' '}
                  <span aria-hidden>(the square with an arrow ↑)</span> at the bottom of
                  Safari.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> — the icon appears on your home screen.
                </li>
              </ol>
            ) : (
              <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-slate">
                <li>
                  Open the browser menu <strong>⋮</strong> (top-right in Chrome).
                </li>
                <li>
                  Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </li>
                <li>Confirm — the Magic Camera icon appears on your home screen.</li>
              </ol>
            )}
            <button className="btn-primary" onClick={() => setHelp(null)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
