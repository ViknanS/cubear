import { CAMERA_MESSAGES, type CameraStatus } from '../camera/useCamera';

/** Shown in place of the live feed whenever the camera can't run; always offers a way forward. */
export function CameraFallback({ status, onRetry, onManual, manualLabel = 'Enter colors manually instead' }: { status: CameraStatus; onRetry: () => void; onManual: () => void; manualLabel?: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 z-10" data-testid="camera-fallback">
      <div className="glass-strong rounded-3xl p-6 max-w-sm text-center fade-in">
        <div className="text-4xl mb-3" aria-hidden>📷</div>
        <h2 className="font-display text-lg font-semibold mb-2">Camera unavailable</h2>
        <p className="text-sm text-[var(--muted)] mb-5" role="alert">{CAMERA_MESSAGES[status]}</p>
        <div className="flex flex-col gap-3">
          {status !== 'insecure' && status !== 'unsupported' && status !== 'no-camera' && (
            <button className="btn btn-primary" onClick={onRetry}>Retry camera</button>
          )}
          <button className="btn btn-ghost" onClick={onManual}>{manualLabel}</button>
        </div>
      </div>
    </div>
  );
}
