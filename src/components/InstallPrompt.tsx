'use client';

import { useEffect, useState } from 'react';

// The Chromium "app can be installed" event (not in the standard lib types).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// "Add to Home Screen" button. Always visible (until installed), because Chrome's
// beforeinstallprompt is unreliable and never fires on non-Chromium browsers.
// On click:
//   - if we captured beforeinstallprompt → fire the native install dialog;
//   - iOS Safari → show Share → Add to Home Screen steps;
//   - anything else → show generic "use the browser menu" steps.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [help, setHelp] = useState<null | 'ios' | 'generic'>(null);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const ua = window.navigator.userAgent.toLowerCase();
    const ios =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes('macintosh') && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setHelp(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
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
                <li>
                  Confirm — the Magic Camera icon appears on your home screen.
                </li>
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
