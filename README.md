# CubeAR — Smart AR Rubik's Cube Solver

Scan a physical 3×3 Rubik's Cube with your phone camera, validate it, solve it with Kociemba's two-phase algorithm, and follow arrows drawn on the live camera image until it's solved. Everything runs client-side in the browser — no accounts, no servers, no uploads.

```
Open CubeAR → Scan 6 faces → Correct / verify → Solve (Web Worker) → AR guide on the live camera → Solved 🎉
```

## Features

| Area | What it does |
|---|---|
| **Camera scanning** | Rear camera via `getUserMedia`; OpenCV.js finds sticker contours (blur → auto-Canny → dilate → convex 4-gons), fits a 3×3 lattice + homography, samples each sticker in its perspective-corrected inner 50 % using per-channel medians (robust to glare and grid lines), and classifies colors in CIE L\*a\*b\*. Unstable or low-confidence frames cannot be captured. **Guide mode** (fixed square) and **Type colors** are available as fallbacks. |
| **Adaptive calibration** | After 6 faces, the six *center stickers* become this cube's palette and all 54 stickers are re-assigned with an exactly-9-per-color constraint, then the palette is refined. Fixes red/orange and white/yellow mix-ups in dim or warm light (covered by tests). |
| **Orientation protocol** | F → R → B → L (turn whole cube left, same top) → U (tip top toward camera) → D (tip bottom up). With this protocol the image's row order *is* the Kociemba facelet order, so no guessing is needed. An animated 3D cube shows each reorientation. Duplicate/opposite-face mistakes are flagged live. |
| **Verification** | Unfolded net (tap to fix any sticker), rotatable 3D reconstruction, per-face rotate and per-face rescan, color counts. |
| **Validation** | 54 stickers, 9 of each color, 6 distinct centers, real corner/edge pieces, no duplicates, corner twist, edge flip, permutation parity. Clear messages; never silently "fixes" the cube. If a face was held at the wrong angle, it *suggests* a rotation that makes the cube valid — applied only when you tap it. |
| **Solver** | `cubejs` (Kociemba two-phase) in a **Web Worker**; pruning tables pre-built in the background on app start. Every solution is replayed on an independent move engine and rejected if it doesn't solve the cube. Solved cubes return 0 moves. |
| **AR guide** | Tracks the front face every frame, matches its 9 colors against the expected pattern under all 4 in-plane rotations (so arrows stay attached to the right layer even if the phone rotates), highlights the layer and draws an animated arrow via a homography. If the wrong face is shown it tells you which center to face the camera; if the cube leaves the frame the overlay disappears. B moves are drawn dashed (hidden layer). |
| **Move verification** | Optional auto-advance only when the camera sees the front face change to the *post-move* pattern for 6 consecutive frames; moves that don't visibly change the front face always need a tap. A sustained mismatch offers "Rescan & re-solve". |
| **3D viewer** | Three.js cube with touch orbit/zoom, animated layer turns, highlighting, playback (prev/next/play/pause/repeat/restart). After each turn the state is **read back from the rotated geometry** and checked against the move engine. Also the explicitly-labelled fallback when camera tracking isn't possible. |
| **Extras** | Manual entry, demo scramble, solution preview, sounds, spoken instructions, progress bars, light/dark theme, local session persistence, help page, torch toggle, low-light hint, camera pause in background. |

## Run it locally

Requires **Node.js 20+** (tested with Node 22).

```bash
npm install          # also copies OpenCV.js to public/vendor/
npm run dev          # http://localhost:5173  (also printed with your LAN IP)
npm test             # unit tests (Vitest)
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build
npm run test:e2e     # browser tests (Playwright, see below)
```

### Testing on your phone during development

Browsers only allow camera access on **HTTPS or localhost**. Options:
- Deploy to GitHub Pages (HTTPS) — simplest; see below.
- Or tunnel your dev server: `npx localtunnel --port 5173` / `ngrok http 5173`, then open the https URL on the phone.

## Tests

`npm test` — 64 unit tests (plus the fixture export):
- **Cube engine**: every one of the 18 moves agrees with the cubejs reference implementation; inverses, X4 = identity, order of `R U R' U'` is 6; Kociemba facelet orientation mapping.
- **Validation**: wrong counts, duplicate centers, impossible edges, single flipped edge, single twisted corner, parity violation, input never mutated, rotation-fix suggestion.
- **Solver**: solved → 0 moves; demo scramble; 25 random valid states solved and verified; non-standard color schemes.
- **Vision** (real OpenCV.js in Node): deterministic synthetic camera frames — frontal, perspective, rotated, dim, warm tungsten, side gradient, glare, far away — face detection, grid fit, color reading, rejection of empty frames, and whole-cube calibration (including a case where the uncalibrated palette fails and calibration recovers all 54 stickers).
- **Scanning / AR**: six-face session assembly, orientation protocol checked against the 3D model, duplicate warnings, AR arrow directions derived from the cube model for every move type, face matching under rotation, step verifier debouncing.
- **3D**: geometry read-back equals engine state for all 18 animated moves.
- **Controls**: next/prev/restart/pause/resume/clamping.

`npm run fixtures` writes the fixture images to `tests/fixtures/images/*.png` and the fake-camera video `tests/fixtures/video/front-face.y4m`.

`npm run test:e2e` — 8 Playwright tests against the production build on a Pixel 7 profile: home, demo solve in the Web Worker, solution stepping, AR controls + labelled 3D fallback + success screen, camera-denied fallback, manual entry, sticker correction, session persistence, and **real OpenCV detection in Chrome using a fake camera stream** of a cube face (capture enabled, duplicate face rejected).
If Playwright's own browser can't be downloaded, point it at any Chrome/Chromium: `CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

### What has *not* been tested
Automated tests use synthetic images and Chrome's fake camera. **No physical-phone camera or AR session has been tested yet.** Before a demo, check on real devices:
- Detection with your cube's sticker style (stickerless or very glossy cubes may need Guide mode).
- Lighting: color accuracy under your room lights; red/orange in dim light.
- iPhone Safari camera start, torch support (often unavailable on iOS), backgrounding/resume.
- AR frame rate and battery on a mid-range Android phone.
- Auto-advance reliability (off by default).

## Deploy to GitHub Pages

The Vite config uses `base: './'`, so the build works at `https://<user>.github.io/<repo>/`. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every push to `main`.

```bash
cd cubear
git init
git add .
git commit -m "CubeAR: AR Rubik's cube solver"
git branch -M main
# create an empty repo named cubear on github.com first (or: gh repo create cubear --public --source=. --push)
git remote add origin https://github.com/<your-username>/cubear.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Open the **Actions** tab and wait for "Deploy CubeAR to GitHub Pages" to finish (re-run it once if the first run happened before Pages was enabled). Your app is live at:

```
https://<your-username>.github.io/cubear/
```

Verify: open that URL — you should see the CubeAR home screen (not the README). `curl -sI https://<your-username>.github.io/cubear/ | head -1` should return `HTTP/2 200`.

## Project structure

```
src/
  cube/        types, facelet geometry, move engine, validation, color↔facelet conversion
  solver/      cubejs Kociemba core, Web Worker, worker client, playback state machine
  vision/      Lab color, homography, perspective sampler, OpenCV detector, calibration, OpenCV loader
  scan/        six-face session + orientation protocol
  ar/          AR guidance logic (face matching, arrows, step verification) + canvas overlay renderer
  camera/      getUserMedia hook, per-frame tracker hook
  three/       CubeModel (scene graph + animation + state read-back), CubeViewer (WebGL renderer)
  components/  Cube3D, CubeNet, FaceEditor, MoveList, CameraFallback, UI primitives
  screens/     Home, Scan, Verify, Solution, AR, Success, Help
  state/       zustand store (persisted), demo cube
tests/
  unit/        Vitest suites        e2e/   Playwright suites        fixtures/   synthetic CV images/video
scripts/copy-opencv.mjs   copies OpenCV.js into public/vendor
.github/workflows/deploy.yml
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "Camera access needs a secure (HTTPS) connection" | Use the GitHub Pages URL, localhost, or an https tunnel. |
| Camera blocked | Allow camera for the site in browser settings, then tap **Retry**. iOS: Settings → Safari → Camera. |
| "Loading the vision engine…" for long | OpenCV.js is ~10 MB, downloaded once then cached. Use **Guide** mode meanwhile. |
| Grid not found | Fill ~half the frame with one face, avoid glare, add light, or switch to **Guide** mode / **Type colors**. |
| Validation error after scanning | Fix pulsing/red-outlined stickers, try the suggested face rotation, or rescan that face. |
| `public/vendor/opencv.js` missing | Run `npm install` or `node scripts/copy-opencv.mjs`. |
| Blank page on GitHub Pages | Make sure Pages source is **GitHub Actions** and the workflow succeeded. |

## Tech stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Three.js · OpenCV.js 5 · cubejs (Kociemba) · zustand · Vitest · Playwright

Detection is classical computer vision (OpenCV + color science), not machine learning.

## License

MIT
