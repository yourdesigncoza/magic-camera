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
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

// A friendly "Add to Home Screen" button.
// - Chromium (Android/desktop): uses the captured beforeinstallprompt event.
// - iOS Safari: no install API, so it shows Share → Add to Home Screen instructions.
// - Already installed / unsupported: renders nothing.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    // iPad on iOS 13+ reports as Mac, so also check touch points.
    const ios =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes('macintosh') && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // stop the mini-infobar; we drive our own button
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  // Chromium: only show once the browser says it's installable.
  if (deferred) {
    return (
      <button onClick={install} className="btn-secondary w-full">
        📲 Add to Home Screen
      </button>
    );
  }

  // iOS: manual instructions (Safari has no install API).
  if (isIOS) {
    return (
      <>
        <button onClick={() => setShowIosHelp(true)} className="btn-secondary w-full">
          📲 Add to Home Screen
        </button>
        {showIosHelp && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/80 p-4"
            onClick={() => setShowIosHelp(false)}
          >
            <div
              className="panel w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-2 text-lg font-extrabold text-charcoal">
                Add Magic Camera to your phone
              </h2>
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
                  Tap <strong>Add</strong> — the Magic Camera icon appears on your home
                  screen.
                </li>
              </ol>
              <button className="btn-primary" onClick={() => setShowIosHelp(false)}>
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
