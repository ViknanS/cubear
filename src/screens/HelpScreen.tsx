import { Header, Panel } from '../components/ui';
import { ORIENTATION_STEPS } from '../scan/session';

export function HelpScreen() {
  return (
    <main className="flex-1 flex flex-col fade-in">
      <Header title="How to use CubeAR" />
      <div className="px-4 pb-10 max-w-2xl w-full mx-auto flex flex-col gap-4 text-[15px] leading-relaxed">
        <Panel>
          <h2 className="font-display font-semibold text-lg mb-2">1 · Scan in this exact order</h2>
          <p className="text-[var(--muted)] mb-3">
            Six photos only describe a cube if we know how each face was turned. Follow these turns and keep the same color on top for the first four scans.
          </p>
          <ol className="flex flex-col gap-2">
            {ORIENTATION_STEPS.map((s, i) => (
              <li key={s.face} className="flex gap-3">
                <span className="chip bg-[var(--accent)] text-white shrink-0 h-7">{i + 1} · {s.face}</span>
                <span>{s.instruction}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel>
          <h2 className="font-display font-semibold text-lg mb-2">2 · Tips for a clean scan</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1 text-[var(--muted)]">
            <li>Even, bright light. Avoid a lamp reflecting straight off the stickers.</li>
            <li>Fill about half the frame with one face; hold still until the grid turns green.</li>
            <li><b>Auto</b> mode finds the sticker grid with OpenCV. <b>Guide</b> mode reads whatever is inside the square — use it if Auto struggles.</li>
            <li>“Type colors” lets you enter any face by hand.</li>
            <li>After scanning, every sticker is re-read using the six center stickers as reference colors, which fixes most red/orange and white/yellow mix-ups.</li>
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display font-semibold text-lg mb-2">3 · Following the AR guide</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1 text-[var(--muted)]">
            <li>Hold the cube the way you scanned the first face: <b>front face toward the camera</b>, the first top color on top. Don’t turn the whole cube while solving.</li>
            <li>The highlighted row/column is the layer to turn; the arrow shows which way the front stickers move.</li>
            <li>Back-layer moves (B) are drawn dashed outside the face because that layer is hidden.</li>
            <li>Tap <b>Done · Next</b> after each move. Optional auto-advance only triggers when the camera actually sees the front face change to the expected pattern.</li>
            <li>No camera tracking? Switch to <b>3D view</b> — a clearly labelled animated instruction view.</li>
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display font-semibold text-lg mb-2">Notation</h2>
          <p className="text-[var(--muted)]">
            Letters name the face to turn: <b>U</b>p, <b>D</b>own, <b>L</b>eft, <b>R</b>ight, <b>F</b>ront, <b>B</b>ack. A plain letter is 90° clockwise as seen looking straight at that face; <b>’</b> (prime) is counterclockwise; <b>2</b> is a half turn.
          </p>
        </Panel>
        <Panel>
          <h2 className="font-display font-semibold text-lg mb-2">Limitations</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1 text-[var(--muted)]">
            <li>Detection is classical computer vision (OpenCV contours + color analysis in CIE Lab), not AI. Stickerless cubes or very glossy stickers may need Guide mode or manual entry.</li>
            <li>AR tracking follows one face (the front). It can’t see the back or sides, so B moves and any move that doesn’t change the front pattern always need a manual tap.</li>
            <li>The camera needs HTTPS (or localhost). Everything runs locally in your browser.</li>
          </ul>
        </Panel>
      </div>
    </main>
  );
}
