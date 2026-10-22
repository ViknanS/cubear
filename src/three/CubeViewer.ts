import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { StickerArray } from '../cube/types';
import { CubeModel } from './CubeModel';

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export interface ViewerOptions {
  interactive?: boolean;
  autoRotate?: boolean;
  /** Camera distance multiplier (smaller = bigger cube). */
  zoom?: number;
}

/** WebGL renderer + touch orbit controls around a CubeModel. Owns and disposes every GPU resource it creates. */
export class CubeViewer {
  readonly model: CubeModel;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private controls: OrbitControls | null = null;
  private timer = new THREE.Timer();
  private raf = 0;
  private ro: ResizeObserver;
  private targetQuat: THREE.Quaternion | null = null;
  autoRotate: boolean;

  constructor(private host: HTMLElement, initial: StickerArray, opts: ViewerOptions = {}) {
    this.autoRotate = !!opts.autoRotate;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.touchAction = opts.interactive ? 'none' : 'auto';
    host.appendChild(this.renderer.domElement);

    this.model = new CubeModel(initial);
    this.scene.add(this.model.root);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1530, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 6, 7);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b5cf6, 1.0);
    rim.position.set(-6, -2, -4);
    this.scene.add(rim);

    const d = 8.2 * (opts.zoom ?? 1);
    this.camera.position.set(d * 0.55, d * 0.5, d * 0.68);
    this.camera.lookAt(0, 0, 0);

    if (opts.interactive) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enablePan = false;
      this.controls.enableDamping = true;
      this.controls.minDistance = 5;
      this.controls.maxDistance = 16;
    }
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  /** Smoothly orient the whole cube (used by the scanning guide). */
  orientTo(euler: [number, number, number], instant = false) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler, 'XYZ'));
    if (instant) this.model.cubeGroup.quaternion.copy(q);
    else this.targetQuat = q;
  }

  /** Put the camera straight in front of the cube (F face toward viewer, U on top). */
  frontView() {
    const d = this.camera.position.length();
    this.camera.position.set(0, d * 0.28, d * 0.96);
    this.camera.lookAt(0, 0, 0);
    this.controls?.update();
  }

  private resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.model.tick(dt);
    if (this.autoRotate && !this.model.animating) this.model.root.rotation.y += dt * 0.35;
    if (this.targetQuat) {
      this.model.cubeGroup.quaternion.slerp(this.targetQuat, Math.min(1, dt * 5));
      if (this.model.cubeGroup.quaternion.angleTo(this.targetQuat) < 0.001) this.targetQuat = null;
    }
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls?.dispose();
    this.model.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
