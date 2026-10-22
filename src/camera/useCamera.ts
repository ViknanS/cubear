import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'paused' | 'denied' | 'no-camera' | 'busy' | 'insecure' | 'unsupported' | 'interrupted' | 'error';

export const CAMERA_MESSAGES: Record<CameraStatus, string> = {
  idle: '',
  starting: 'Starting camera…',
  live: '',
  paused: 'Camera paused while the app is in the background.',
  denied: 'Camera access was blocked. Allow camera access for this site in your browser settings, then tap Retry.',
  'no-camera': 'No camera was found on this device.',
  busy: 'The camera is being used by another app. Close it and tap Retry.',
  insecure: 'Camera access needs a secure (HTTPS) connection. Open the app via its https:// address.',
  unsupported: 'This browser does not support camera access.',
  interrupted: 'The camera stopped unexpectedly. Tap Retry.',
  error: 'Could not start the camera.',
};

export function classifyCameraError(err: unknown): CameraStatus {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'no-camera';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy';
  return 'error';
}

/**
 * Rear camera via getUserMedia. Stops every track on unmount and while the page is hidden
 * (iOS/Android background), and restarts when the page becomes visible again.
 */
export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [videoRef]);

  const start = useCallback(async () => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) return setStatus('insecure');
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unsupported');
    stop();
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      track.addEventListener('ended', () => setStatus('interrupted'));
      const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorch({ supported: !!caps.torch, on: false });
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        v.muted = true;
        await v.play().catch(() => undefined);
      }
      setStatus('live');
    } catch (e) {
      setStatus(classifyCameraError(e));
    }
  }, [stop, videoRef]);

  useEffect(() => {
    if (!active) return;
    void start();
    const onVis = () => {
      if (document.hidden) {
        stop();
        setStatus('paused');
      } else void start();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [active, start, stop]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  }, [torch.on]);

  return { status, retry: start, torch, toggleTorch };
}
