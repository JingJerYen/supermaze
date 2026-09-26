import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Real art pipeline. Drop a .glb into apps/client/public/models/ under the file
 * name listed here and it replaces the placeholder at startup; nothing else
 * changes. Models are normalised on load: uniformly scaled so their largest
 * dimension equals `fitSize` tiles, centred on x/z, bottom resting on y = 0.
 */
export interface ModelSpec {
  file: string;
  /** Target size of the largest bounding-box dimension, in tiles. */
  fitSize: number;
  /** Extra yaw in degrees if the model's front is not +Z. */
  rotationYDeg?: number;
}

export type ModelName = "key" | "box";

export const MODEL_MANIFEST: Record<ModelName, ModelSpec> = {
  key: { file: "key.glb", fitSize: 0.6 },
  box: { file: "box.glb", fitSize: 0.6 },
};

const MODELS_BASE = "/models/";

export class ModelLibrary {
  private readonly templates = new Map<ModelName, THREE.Object3D>();
  private readonly loader = new GLTFLoader();

  /** Load every model in the manifest; missing files are skipped, not errors. */
  async load(): Promise<{ loaded: ModelName[]; missing: ModelName[] }> {
    const loaded: ModelName[] = [];
    const missing: ModelName[] = [];
    await Promise.all(
      (Object.keys(MODEL_MANIFEST) as ModelName[]).map(async (name) => {
        const spec = MODEL_MANIFEST[name];
        const url = MODELS_BASE + spec.file;
        if (!(await exists(url))) {
          missing.push(name);
          return;
        }
        try {
          const gltf = await this.loader.loadAsync(url);
          this.templates.set(name, normalise(gltf.scene, spec));
          loaded.push(name);
        } catch (e) {
          console.warn(`[models] failed to load ${url}:`, e);
          missing.push(name);
        }
      }),
    );
    if (loaded.length) console.info(`[models] loaded: ${loaded.join(", ")}`);
    if (missing.length) console.info(`[models] using placeholders for: ${missing.join(", ")}`);
    return { loaded, missing };
  }

  has(name: ModelName): boolean {
    return this.templates.has(name);
  }

  /** A fresh instance, or null when the model was not provided. */
  instantiate(name: ModelName): THREE.Object3D | null {
    const t = this.templates.get(name);
    return t ? t.clone(true) : null;
  }
}

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const type = res.headers.get("content-type") ?? "";
    // A dev server may answer a missing file with the SPA's index.html; that is not a model.
    return res.ok && !type.includes("text/html");
  } catch {
    return false;
  }
}

/** Wrap and transform so the model fits `fitSize`, sits on the ground and is centred. */
export function normalise(scene: THREE.Object3D, spec: ModelSpec): THREE.Object3D {
  const wrapper = new THREE.Group();
  wrapper.add(scene);
  if (spec.rotationYDeg) scene.rotation.y = THREE.MathUtils.degToRad(spec.rotationYDeg);

  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = spec.fitSize / maxDim;
  scene.scale.setScalar(scale);

  const fitted = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3();
  fitted.getCenter(center);
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= fitted.min.y;

  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return wrapper;
}

/** Shared library; main.ts awaits `load()` once before the first frame. */
export const models = new ModelLibrary();
