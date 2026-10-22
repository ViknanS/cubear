// Copies the OpenCV.js build into public/vendor so it is served as a cacheable static file
// (loaded lazily with a <script> tag only when the camera opens).
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const src = require.resolve('@techstark/opencv-js/dist/opencv.js');
const dest = join(root, 'public', 'vendor', 'opencv.js');
mkdirSync(dirname(dest), { recursive: true });
if (!existsSync(dest) || statSync(dest).size !== statSync(src).size) {
  copyFileSync(src, dest);
  console.log('[cubear] copied OpenCV.js →', dest);
}
