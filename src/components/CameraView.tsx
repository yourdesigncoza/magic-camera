'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { captureFromVideo, captureFromFile, CapturedImage } from '@/lib/imageCapture';

interface Props {
  onCapture: (img: CapturedImage) => void;
  onCancel: () => void;
}

export default function CameraView({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (mode: 'environment' | 'user') => {
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [stop]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFailed(true);
      return;
    }
    start(facing);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const handleSnap = async () => {
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      const img = await captureFromVideo(videoRef.current);
      stop();
      onCapture(img);
    } catch {
      setBusy(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const img = await captureFromFile(file);
      onCapture(img);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-charcoal p-4 no-select">
      <div className="relative flex-1 overflow-hidden rounded-toy-lg bg-black">
        {!failed ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-paper-white">
            <span className="text-5xl">📷</span>
            <p className="text-lg font-bold">Ask a grown-up</p>
            <p className="text-sm text-camera-blue-light">
              The camera needs permission. You can still pick a photo below.
            </p>
            <label className="btn-primary max-w-xs cursor-pointer">
              Choose a photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-[64px_1fr_64px] items-center gap-3">
        <button
          onClick={() => {
            stop();
            onCancel();
          }}
          aria-label="Back"
          className="btn-secondary !min-h-[64px] !px-0"
        >
          ✕
        </button>

        <button
          onClick={handleSnap}
          disabled={failed || busy}
          aria-label="Take photo"
          className="btn-primary !min-h-[80px] text-3xl"
        >
          {busy ? '…' : '📸'}
        </button>

        <button
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          disabled={failed}
          aria-label="Flip camera"
          className="btn-secondary !min-h-[64px] !px-0"
        >
          🔄
        </button>
      </div>
    </div>
  );
}
