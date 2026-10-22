import type { CV } from './detector';

let loading: Promise<CV> | null = null;

/**
 * Lazily load OpenCV.js (~10 MB WASM build) the first time the camera opens, so the home screen stays fast.
 * The file is served from /vendor/opencv.js (copied there by scripts/copy-opencv.mjs) and loaded as a classic
 * script — its UMD wrapper sets `window.cv` to a Promise of the initialised module. Rejects on failure/timeout
 * so the UI can fall back to guide-box mode.
 */
export function loadOpenCV(timeoutMs = 60000): Promise<CV> {
  if (loading) return loading;
  loading = new Promise<CV>((resolve, reject) => {
    const w = window as unknown as { cv?: any };
    const finish = async () => {
      try {
        let cv = w.cv;
        if (!cv) throw new Error('OpenCV.js did not register');
        if (typeof cv.then === 'function' && !cv.Mat) cv = await cv;
        if (!cv.Mat) {
          await new Promise<void>((res) => {
            cv.onRuntimeInitialized = () => res();
          });
        }
        w.cv = cv;
        resolve(cv);
      } catch (e) {
        reject(e);
      }
    };
    if (w.cv) return void finish();
    const timer = setTimeout(() => reject(new Error('OpenCV.js took too long to load')), timeoutMs);
    const s = document.createElement('script');
    s.src = `${import.meta.env.BASE_URL}vendor/opencv.js`;
    s.async = true;
    s.onload = () => { clearTimeout(timer); void finish(); };
    s.onerror = () => { clearTimeout(timer); reject(new Error('Could not download OpenCV.js')); };
    document.head.appendChild(s);
  });
  loading.catch(() => { loading = null; });
  return loading;
}
