import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Kenney Mini Characters (CC0) with skeletal animation, from
 * public/models/characters/. All twelve share one texture and the same clip
 * names; a player is assigned one deterministically from their id so every
 * client shows the same person. Missing files -> `ready()` false -> the box
 * placeholder in PlayerView stays.
 */
const NAMES = [
  "character-male-a",
  "character-male-b",
  "character-male-c",
  "character-male-d",
  "character-male-e",
  "character-male-f",
  "character-female-a",
  "character-female-b",
  "character-female-c",
  "character-female-d",
  "character-female-e",
  "character-female-f",
];
const BASE = "/models/characters/";

interface Loaded {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
}

export interface CharacterRig {
  /** Origin at the feet, centred on the tile; front is +Z. */
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction | null;
  walk: THREE.AnimationAction | null;
}

export class CharacterLibrary {
  private readonly loaded: Loaded[] = [];

  async load(): Promise<number> {
    const loader = new GLTFLoader();
    const results = await Promise.all(
      NAMES.map(async (name) => {
        try {
          const gltf = await loader.loadAsync(`${BASE}${name}.glb`);
          return { scene: gltf.scene, clips: gltf.animations } as Loaded;
        } catch {
          return null;
        }
      }),
    );
    for (const r of results) {
      if (!r) continue;
      // Matte look: the toon-style colormap needs no specular highlight, which
      // otherwise flares on the head under the darkness lamp.
      r.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          if ("roughness" in std) {
            std.roughness = 1;
            std.metalness = 0;
          }
        }
      });
      this.loaded.push(r);
    }
    console.info(`[characters] loaded ${this.loaded.length}/${NAMES.length}`);
    return this.loaded.length;
  }

  ready(): boolean {
    return this.loaded.length > 0;
  }

  /** Build a rig for `playerId`, standing `height` world units tall. */
  createRig(playerId: string, height: number): CharacterRig | null {
    if (this.loaded.length === 0) return null;
    const src = this.loaded[hash(playerId) % this.loaded.length] as Loaded;
    const model = cloneSkeleton(src.scene);
    // Skinned bounds are computed from the bind pose; never let the camera cull a player.
    model.traverse((o) => {
      o.frustumCulled = false;
    });

    const box = new THREE.Box3().setFromObject(model);
    const scale = height / Math.max(box.max.y - box.min.y, 1e-6);
    model.scale.setScalar(scale);
    const fitted = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    fitted.getCenter(center);
    model.position.set(-center.x, -fitted.min.y, -center.z);

    const root = new THREE.Group();
    root.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const clip = (name: string) => {
      const c = src.clips.find((k) => k.name === name);
      return c ? mixer.clipAction(c) : null;
    };
    const idle = clip("idle");
    const walk = clip("walk");
    idle?.play();
    return { root, mixer, idle, walk };
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const characters = new CharacterLibrary();
