'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { registerDevice, DeviceInfo } from '@/lib/clientDevice';
import { CapturedImage } from '@/lib/imageCapture';
import { runGeneration, FlowError } from '@/lib/generateFlow';
import { PublicPreset } from '@/lib/types';
import CameraView from './CameraView';
import PresetGrid from './PresetGrid';
import HiddenParentAccess from './HiddenParentAccess';
import InstallPrompt from './InstallPrompt';

type Step = 'loading' | 'home' | 'camera' | 'preview' | 'creating' | 'result' | 'error';

export default function CameraApp() {
  const [step, setStep] = useState<Step>('loading');
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [presets, setPresets] = useState<PublicPreset[]>([]);
  const [captured, setCaptured] = useState<CapturedImage | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const [dev, presetRes] = await Promise.all([
          registerDevice(),
          fetch('/api/presets').then((r) => r.json()),
        ]);
        setDevice(dev);
        setPresets(presetRes.presets ?? []);
        setStep('home');
      } catch {
        setErrorMsg('Could not start. Ask a grown-up.');
        setStep('error');
      }
    })();
  }, []);

  const resetPhoto = () => {
    if (captured) URL.revokeObjectURL(captured.previewUrl);
    setCaptured(null);
  };

  const handleCapture = (img: CapturedImage) => {
    setCaptured(img);
    setStep('preview');
  };

  const handlePickPreset = async (presetId: string) => {
    if (!device || !captured) return;
    setStep('creating');
    try {
      const { url } = await runGeneration(
        { blob: captured.blob, contentType: captured.contentType },
        presetId,
      );
      setResultUrl(url);
      setStep('result');
    } catch (err) {
      const msg =
        err instanceof FlowError ? err.message : 'Magic did not work. Try again!';
      setErrorMsg(msg);
      setStep('error');
    }
  };

  // ── Screens ────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <Centered>
        <div className="text-6xl animate-sparkle">✨</div>
        <p className="mt-4 text-xl font-bold text-charcoal">Magic Camera</p>
      </Centered>
    );
  }

  if (step === 'camera') {
    return <CameraView onCapture={handleCapture} onCancel={() => setStep('home')} />;
  }

  if (step === 'creating') {
    return (
      <Centered>
        <div className="text-7xl animate-sparkle">🪄</div>
        <p className="mt-6 text-2xl font-extrabold text-charcoal">Making magic…</p>
        <p className="mt-2 text-base text-slate">This can take a little while</p>
        <div className="mt-6 text-3xl animate-spin-slow">✨</div>
      </Centered>
    );
  }

  if (step === 'error') {
    return (
      <Centered>
        <div className="text-6xl">🙈</div>
        <p className="mt-4 max-w-xs text-center text-xl font-bold text-charcoal">
          {errorMsg}
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          {captured && (
            <button className="btn-primary" onClick={() => setStep('preview')}>
              Try again
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => {
              resetPhoto();
              setStep('home');
            }}
          >
            Home
          </button>
        </div>
      </Centered>
    );
  }

  if (step === 'result' && resultUrl) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 p-4 no-select">
        <div className="toy-card flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl}
            alt="Your magic photo"
            className="mx-auto max-h-[60dvh] w-auto rounded-toy object-contain"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-primary" onClick={() => setStep('preview')}>
            ✨ Again
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              resetPhoto();
              setStep('camera');
            }}
          >
            📸 New
          </button>
        </div>
        <Link href="/gallery" className="btn-secondary w-full">
          🖼️ My Gallery
        </Link>
      </div>
    );
  }

  if (step === 'preview' && captured) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 p-4 no-select">
        <div className="toy-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={captured.previewUrl}
            alt="Your photo"
            className="mx-auto max-h-[34dvh] w-auto rounded-toy object-contain"
          />
        </div>
        <button
          className="btn-secondary self-start"
          onClick={() => {
            resetPhoto();
            setStep('camera');
          }}
        >
          ↺ Retake
        </button>
        <p className="px-1 text-lg font-extrabold text-charcoal">Pick your magic!</p>
        <PresetGrid presets={presets} onPick={handlePickPreset} />
      </div>
    );
  }

  // ── Home ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col items-center justify-between p-6 no-select">
      <HiddenParentAccess>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-charcoal">
          <span aria-hidden>✨</span> Magic Camera
        </h1>
      </HiddenParentAccess>

      <div className="toy-card flex w-full max-w-sm flex-col items-center bg-camera-blue-light py-10">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-charcoal text-6xl shadow-toy">
          📷
        </div>
        <p className="mt-6 text-center text-lg font-bold text-slate">
          Take a photo and make it magic!
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <button className="btn-primary text-2xl" onClick={() => setStep('camera')}>
          📸 Take Photo
        </button>
        <Link href="/gallery" className="btn-secondary w-full">
          🖼️ My Gallery
        </Link>
        <InstallPrompt />
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 no-select">
      {children}
    </div>
  );
}
