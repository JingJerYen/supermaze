import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";
import type { Theme } from "./themes.js";

const hex = (c: number) => new THREE.Color(c);

const SKY_VERT = /* glsl */ `
  uniform float radius;
  varying vec3 vDir;
  void main() {
    vDir = position;
    // Centred on the camera every frame, so it never comes closer or clips.
    gl_Position = projectionMatrix * viewMatrix * vec4(position * radius + cameraPosition, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 top;
  uniform vec3 mid;
  uniform vec3 horizon;
  uniform sampler2D pano;
  uniform float hasPano;
  uniform float repeats;
  uniform float span;
  uniform float horizonV;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 c = mix(horizon, mid, smoothstep(0.0, 0.2, h));
    c = mix(c, top, smoothstep(0.2, 0.75, h));
    if (hasPano > 0.5) {
      // Wrapped round the horizon (mirrored copies, so the ends meet), the image's middle due north.
      float u = atan(d.x, -d.z) / 6.2831853 * repeats + 0.5;
      float v = horizonV + asin(clamp(h, -1.0, 1.0)) / span;
      vec3 p = texture2D(pano, vec2(u, clamp(v, 0.002, 0.998))).rgb;
      c = mix(c, p, 1.0 - smoothstep(0.9, 1.0, v));
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

const GROUND_VERT = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GROUND_FRAG = /* glsl */ `
  uniform vec3 base;
  uniform vec3 alt;
  uniform vec3 horizon;
  uniform vec3 lineColor;
  uniform vec2 centre;
  uniform vec2 stretch;
  uniform float scale;
  uniform float fadeStart;
  uniform float fadeEnd;
  uniform float lineEvery;
  varying vec2 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 p = vWorld * stretch / scale;
    float n = noise(p) * 0.65 + noise(p * 3.1 + 7.0) * 0.35;
    vec3 c = mix(base, alt, n);
    if (lineEvery > 0.0) {
      vec2 g = abs(fract(vWorld / lineEvery + 0.5) - 0.5) * lineEvery;
      c = mix(c, lineColor, 1.0 - smoothstep(0.03, 0.09, min(g.x, g.y)));
    }
    float d = distance(vWorld, centre);
    c = mix(c, horizon, smoothstep(fadeStart, fadeEnd, d));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface Backdrop {
  group: THREE.Group;
  setDark(dark: boolean): void;
  dispose(): void;
}

/**
 * What lies around the maze (CLAUDE.md 14): a sky dome in the theme's colours
 * and a wide ground the maze stands on, fading into the horizon colour far out,
 * so the maze sits in a landscape instead of floating in a flat colour. Both
 * are unlit shaders (two draw calls) and hide while the lights are out.
 */
export function createBackdrop(theme: Theme, mapWidth: number, mapHeight: number): Backdrop {
  const b = CLIENT_TUNING.backdrop;
  const [top, mid, horizon] = [theme.sky[0] ?? 0, theme.sky[1] ?? theme.sky[0] ?? 0, theme.sky[theme.sky.length - 1] ?? 0];
  const group = new THREE.Group();

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        radius: { value: b.skyRadius },
        top: { value: hex(top) },
        mid: { value: hex(mid) },
        horizon: { value: hex(horizon) },
        pano: { value: null as THREE.Texture | null },
        hasPano: { value: 0 },
        repeats: { value: b.panoramaRepeats },
        span: { value: 1 },
        horizonV: { value: theme.panorama?.horizonV ?? 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  let pano: THREE.Texture | null = null;
  if (theme.panorama) {
    // Optional: until (or unless) it loads, the gradient alone.
    new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}backdrops/${theme.panorama.file}`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.MirroredRepeatWrapping;
      // No mipmaps: the wrap seam behind the camera would pick the smallest one and draw a line.
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      const img = tex.image as { width: number; height: number };
      const u = sky.material.uniforms;
      u.pano!.value = tex;
      // Square pixels: one copy spans 360 / repeats degrees across, so this many up.
      u.span!.value = (2 * Math.PI) / b.panoramaRepeats / (img.width / img.height);
      u.hasPano!.value = 1;
      if (disposed) tex.dispose();
      else pano = tex;
    });
  }
  let disposed = false;

  const cx = (mapWidth - 1) / 2;
  const cz = (mapHeight - 1) / 2;
  const g = theme.ground;
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(b.groundRadius, 64).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: {
        base: { value: hex(g.base) },
        alt: { value: hex(g.alt) },
        horizon: { value: hex(horizon) },
        lineColor: { value: hex(g.line ?? 0) },
        lineEvery: { value: g.lineEvery ?? 0 },
        centre: { value: new THREE.Vector2(cx, cz) },
        stretch: { value: new THREE.Vector2(g.stretch?.[0] ?? 1, g.stretch?.[1] ?? 1) },
        scale: { value: g.scale },
        fadeStart: { value: Math.hypot(mapWidth, mapHeight) / 2 + b.fadeStartTiles },
        fadeEnd: { value: b.fadeEndTiles },
      },
    }),
  );
  ground.position.set(cx, b.groundY, cz);
  group.add(sky, ground);

  return {
    group,
    setDark(dark) {
      group.visible = !dark;
    },
    dispose() {
      disposed = true;
      pano?.dispose();
      for (const m of [sky, ground]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  };
}
