import * as THREE from "three";
import { characters, type CharacterRig } from "./characters.js";

/**
 * The character select stage: the picked character stands on a small disc,
 * turning slowly, and waves (`emote-yes`) each time the pick changes. A
 * director (`setDirector`) may take over the moves instead. It draws
 * on the one shared renderer while the pre-floor screen is up. Also makes the
 * portrait thumbnails for the picker, once.
 */
export class CharacterPreview {
  readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  /** What the character stands in; turned (and lifted, for a hop) as a whole. */
  readonly holder = new THREE.Group();
  private rig: CharacterRig | null = null;
  /** Moves the character each frame instead of the slow turn (the achievements page's show). */
  private director: ((dt: number) => void) | null = null;
  private frame = 0;
  private last = performance.now();
  private running = false;
  /** An element kept just above the character's head (the name on the floor prep). */
  private tag: HTMLElement | null = null;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.scene.background = new THREE.Color(0x141a26);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a3040, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.6);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.08, 40), new THREE.MeshLambertMaterial({ color: 0x3a4660 }));
    disc.position.y = -0.04;
    this.scene.add(disc, this.holder);
  }

  /** Show `name`; the new character waves hello. */
  show(name: string): void {
    if (this.rig) this.holder.remove(this.rig.root);
    this.rig = characters.createRig(name, 1.6, name);
    if (!this.rig) return;
    this.holder.add(this.rig.root);
    const wave = this.rig.clip("emote-yes");
    if (wave) {
      wave.setLoop(THREE.LoopOnce, 1);
      wave.clampWhenFinished = false;
      this.rig.idle?.stop();
      wave.reset().play();
      const rig = this.rig;
      rig.mixer.addEventListener("finished", () => {
        if (!this.director) rig.idle?.reset().play();
      });
    }
  }

  /** The character on stage now, if any. */
  get current(): CharacterRig | null {
    return this.rig;
  }

  /** Hand the character to `fn`, called every frame with the step in seconds; null brings back the slow turn. */
  setDirector(fn: ((dt: number) => void) | null): void {
    this.director = fn;
  }

  /** Keep `el` (position: fixed) just above the character's head, or stop with null. */
  setTag(el: HTMLElement | null): void {
    this.tag = el;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.rig?.mixer.update(dt);
      if (this.director) this.director(dt);
      else this.holder.rotation.y += dt * 0.5;
      this.render();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  /** The stage sits in the right part of the screen, clear of the panel on the left. */
  private render(): void {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.camera.aspect = size.x / Math.max(size.y, 1);
    // Aim so the character stands at about 70% of the width.
    const dist = 8;
    const shift = 0.4 * Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect * dist;
    this.camera.position.set(-shift, 1.6, dist);
    this.camera.lookAt(-shift, 0.8, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    if (this.tag) {
      const box = this.renderer.domElement.getBoundingClientRect();
      const head = new THREE.Vector3(0, 1.7, 0).project(this.camera);
      this.tag.style.left = `${box.left + ((head.x + 1) / 2) * box.width}px`;
      this.tag.style.top = `${box.top + ((1 - head.y) / 2) * box.height}px`;
    }
  }

  /** Head-and-shoulders portraits of every loaded character, as image URLs. */
  static portraits(renderer: THREE.WebGLRenderer, px = 96): Map<string, string> {
    const out = new Map<string, string>();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a3450);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a3040, 1.6));
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.6);
    sun.position.set(1.5, 3, 3);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 1.25, 2.6);
    camera.lookAt(0, 1.05, 0);
    const target = new THREE.WebGLRenderTarget(px, px);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const pixels = new Uint8Array(px * px * 4);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext("2d")!;
    for (const name of characters.available()) {
      const rig = characters.createRig(name, 1.6, name);
      if (!rig) continue;
      rig.mixer.update(0);
      scene.add(rig.root);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, px, px, pixels);
      scene.remove(rig.root);
      // WebGL rows run bottom-up.
      const img = ctx.createImageData(px, px);
      for (let y = 0; y < px; y++) img.data.set(pixels.subarray((px - 1 - y) * px * 4, (px - y) * px * 4), y * px * 4);
      ctx.putImageData(img, 0, 0);
      out.set(name, canvas.toDataURL());
    }
    renderer.setRenderTarget(null);
    target.dispose();
    return out;
  }
}
