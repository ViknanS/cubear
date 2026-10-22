import * as THREE from 'three';
import { FACELETS, faceletAt, type Vec3 } from '../cube/geometry';
import { FACE_NORMAL } from '../cube/geometry';
import { applyMoveArray, parseMove } from '../cube/moves';
import { COLOR_HEX, UNKNOWN_HEX, type Face, type StickerArray } from '../cube/types';

interface Anim {
  move: string;
  axis: THREE.Vector3;
  target: number;
  elapsed: number;
  duration: number;
  pivot: THREE.Group;
  cubies: THREE.Object3D[];
  resolve: () => void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function roundedSquare(size: number, radius: number): THREE.ShapeGeometry {
  const s = size / 2, r = radius;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  return new THREE.ShapeGeometry(shape, 4);
}

/**
 * Renderer-independent scene graph of a 3×3 cube. Stickers know which facelet they represent; layer turns are
 * animated by parenting the layer's cubies to a pivot. When a turn finishes the cube state is re-derived from
 * the *actual rotated geometry* and checked against the move engine, then cubies snap back home and are recolored.
 * This keeps the visual cube and the logical state provably in sync.
 */
export class CubeModel {
  readonly root = new THREE.Group();
  readonly cubeGroup = new THREE.Group();
  private cubies: THREE.Mesh[] = [];
  private stickers: THREE.Mesh[] = [];
  private stickerMats: THREE.MeshStandardMaterial[] = [];
  private anim: Anim | null = null;
  private queue: Promise<void> = Promise.resolve();
  private highlighted = new Set<number>();
  private disposables: { dispose(): void }[] = [];
  state: StickerArray;
  /** Set after each turn: the state read back from the rotated geometry (should equal `state`). */
  lastGeometryState: StickerArray | null = null;
  onStateChange?: (s: StickerArray) => void;

  constructor(initial: StickerArray) {
    this.state = initial.slice();
    this.root.add(this.cubeGroup);
    const body = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0b0d14, roughness: 0.55, metalness: 0.1 });
    const stickerGeo = roundedSquare(0.84, 0.12);
    this.disposables.push(body, bodyMat, stickerGeo);

    const byPos = new Map<string, THREE.Mesh>();
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          const m = new THREE.Mesh(body, bodyMat);
          m.position.set(x, y, z);
          m.userData.home = [x, y, z];
          this.cubeGroup.add(m);
          this.cubies.push(m);
          byPos.set(`${x},${y},${z}`, m);
        }

    FACELETS.forEach((g, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: UNKNOWN_HEX, roughness: 0.35, metalness: 0.05, emissive: 0x000000 });
      const s = new THREE.Mesh(stickerGeo, mat);
      const n = new THREE.Vector3(...g.normal);
      s.position.copy(n.clone().multiplyScalar(0.485));
      s.lookAt(n.clone().multiplyScalar(2));
      s.userData.facelet = i;
      byPos.get(g.pos.join(','))!.add(s);
      this.stickers[i] = s;
      this.stickerMats[i] = mat;
      this.disposables.push(mat);
    });
    this.applyColors();
  }

  setState(s: StickerArray) {
    this.state = s.slice();
    this.applyColors();
  }

  private applyColors() {
    // Highlighting dims every sticker that is NOT in the turning layer, so true colors are never tinted.
    const any = this.highlighted.size > 0;
    this.stickerMats.forEach((m, i) => {
      const c = this.state[i];
      m.color.set(c ? COLOR_HEX[c] : UNKNOWN_HEX);
      if (any && !this.highlighted.has(i)) m.color.multiplyScalar(0.32);
      m.emissive.set(0x000000);
      m.emissiveIntensity = 0;
    });
  }

  /** Glow the stickers of the layer this move turns (or clear with null). */
  highlightMove(move: string | null) {
    this.highlighted.clear();
    if (move) {
      const n = FACE_NORMAL[parseMove(move).face];
      FACELETS.forEach((g, i) => { if (g.pos[0] * n[0] + g.pos[1] * n[1] + g.pos[2] * n[2] === 1) this.highlighted.add(i); });
    }
    this.applyColors();
  }

  setHighlightedStickers(ids: number[]) {
    this.highlighted = new Set(ids);
    this.applyColors();
  }

  get animating() {
    return this.anim !== null;
  }

  /** Queue a face turn. Resolves when the turn is finished and the state has been updated. */
  animateMove(move: string, durationMs = 450): Promise<void> {
    const run = () =>
      new Promise<void>((resolve) => {
        const { face, turns } = parseMove(move);
        const n = FACE_NORMAL[face as Face];
        const axis = new THREE.Vector3(...n);
        const pivot = new THREE.Group();
        this.cubeGroup.add(pivot);
        const cubies = this.cubies.filter((c) => {
          const h = c.userData.home as Vec3;
          return h[0] * n[0] + h[1] * n[1] + h[2] * n[2] === 1;
        });
        cubies.forEach((c) => pivot.attach(c));
        const target = -(turns === 3 ? -1 : turns) * (Math.PI / 2); // clockwise seen from outside = negative about the outward normal
        this.anim = { move, axis, target, elapsed: 0, duration: Math.max(1, durationMs), pivot, cubies, resolve };
        if (durationMs <= 0) this.tick(1);
      });
    this.queue = this.queue.then(run);
    return this.queue;
  }

  /** Advance the current animation by dt seconds. */
  tick(dt: number) {
    const a = this.anim;
    if (!a) return;
    a.elapsed += dt * 1000;
    const t = Math.min(1, a.elapsed / a.duration);
    a.pivot.setRotationFromAxisAngle(a.axis, a.target * ease(t));
    if (t >= 1) this.finish();
  }

  private finish() {
    const a = this.anim!;
    a.pivot.setRotationFromAxisAngle(a.axis, a.target);
    this.root.updateMatrixWorld(true);
    // read back state from geometry
    const fromGeo: StickerArray = Array(54).fill(null);
    const inv = new THREE.Matrix4().copy(this.cubeGroup.matrixWorld).invert();
    this.stickers.forEach((s, i) => {
      const p = new THREE.Vector3().setFromMatrixPosition(s.matrixWorld).applyMatrix4(inv);
      const cub = s.parent!;
      const cp = new THREE.Vector3().setFromMatrixPosition(cub.matrixWorld).applyMatrix4(inv);
      const nrm = p.clone().sub(cp).normalize();
      const idx = faceletAt([cp.x, cp.y, cp.z].map(Math.round) as Vec3, [nrm.x, nrm.y, nrm.z].map(Math.round) as Vec3);
      fromGeo[idx] = this.state[i];
    });
    const next = applyMoveArray(this.state, a.move);
    this.lastGeometryState = fromGeo;
    if (fromGeo.some((c, i) => c !== next[i])) console.error('[CubeModel] geometry/state mismatch after', a.move);
    // snap home
    a.cubies.forEach((c) => {
      this.cubeGroup.attach(c);
      const h = c.userData.home as Vec3;
      c.position.set(...h);
      c.rotation.set(0, 0, 0);
    });
    this.cubeGroup.remove(a.pivot);
    this.state = next;
    this.applyColors();
    this.anim = null;
    this.onStateChange?.(this.state);
    a.resolve();
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
