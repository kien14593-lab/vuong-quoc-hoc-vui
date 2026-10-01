import * as THREE from 'three';
import type { Quality } from './core';

/**
 * Ánh sáng chung cho mọi khu vực: trời (hemisphere) + mặt trời có bóng đổ mềm, đi theo người chơi.
 */
export interface LightRig {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  /** Dời vùng bóng đổ theo mục tiêu (người chơi). */
  follow(target: THREE.Vector3): void;
  setQuality(q: Quality): void;
  /** Đổi tâm trạng ánh sáng (ví dụ lâu đài hơi tím, rừng hơi xanh). */
  mood(m: Partial<LightMood>): void;
}

export interface LightMood {
  sky: string;
  ground: string;
  hemi: number;
  sun: string;
  sunI: number;
  ambient: number;
  shadow: number;
}

export const DEFAULT_MOOD: LightMood = {
  sky: '#e3f4ff',
  ground: '#a9c98a',
  hemi: 1.55,
  sun: '#fff1dc',
  sunI: 2.15,
  ambient: 0.25,
  shadow: 0.5,
};

const SUN_DIR = new THREE.Vector3(-0.55, 1.0, 0.42).normalize();

export function setupLights(scene: THREE.Scene, q: Quality = 'high', span = 26): LightRig {
  const hemi = new THREE.HemisphereLight(DEFAULT_MOOD.sky, DEFAULT_MOOD.ground, DEFAULT_MOOD.hemi);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#ffffff', DEFAULT_MOOD.ambient);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(DEFAULT_MOOD.sun, DEFAULT_MOOD.sunI);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  cam.left = -span;
  cam.right = span;
  cam.top = span;
  cam.bottom = -span;
  cam.near = 1;
  cam.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  sun.shadow.intensity = DEFAULT_MOOD.shadow;
  scene.add(sun);
  scene.add(sun.target);
  const texel = new THREE.Vector3();

  const setQ = (qq: Quality) => {
    const size = qq === 'high' ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    sun.shadow.radius = qq === 'high' ? 3 : 1.5;
  };
  setQ(q);

  return {
    hemi,
    sun,
    ambient,
    follow(target) {
      // Bám theo theo bước bằng kích thước 1 texel bóng để bóng không "rung".
      const step = (span * 2) / sun.shadow.mapSize.x;
      texel.set(Math.round(target.x / step) * step, 0, Math.round(target.z / step) * step);
      sun.target.position.copy(texel);
      sun.position.copy(texel).addScaledVector(SUN_DIR, 50);
    },
    setQuality: setQ,
    mood(m) {
      const mm = { ...DEFAULT_MOOD, ...m };
      hemi.color.set(mm.sky);
      hemi.groundColor.set(mm.ground);
      hemi.intensity = mm.hemi;
      sun.color.set(mm.sun);
      sun.intensity = mm.sunI;
      ambient.intensity = mm.ambient;
      sun.shadow.intensity = mm.shadow;
    },
  };
}

/** Độ cao so với chân trời (độ) → tỉ lệ pha màu đỉnh trời (đổi nhanh sát chân trời, chậm dần lên cao). */
const SKY_STOPS: [number, number][] = [
  [-90, 0],
  [-1, 0],
  [0, 0.1],
  [1.5, 0.42],
  [4, 0.64],
  [10, 0.8],
  [25, 0.93],
  [50, 1],
  [90, 1],
];

/**
 * Bầu trời gradient + sương mù cho khung cảnh xa.
 * Gradient theo hướng nhìn (ảnh toàn cảnh), không theo màn hình: sát chân trời trời có đúng màu sương,
 * nên mặt đất xa hòa vào trời ở mọi góc camera (không còn đường chân trời gắt).
 */
export function setupSky(scene: THREE.Scene, top = '#9fd8f7', horizon = '#e6f5e3', fogNear = 45, fogFar = 95): void {
  const H = 256;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  const a = new THREE.Color(horizon);
  const b = new THREE.Color(top);
  const mix = new THREE.Color();
  // Hàng trên cùng của ảnh = thiên đỉnh (+90°), giữa = chân trời (0°), dưới cùng = −90°.
  for (const [deg, k] of [...SKY_STOPS].reverse()) gr.addColorStop(0.5 - deg / 180, `#${mix.lerpColors(a, b, k).getHexString()}`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, c.width, H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  scene.background = tex;
  scene.fog = new THREE.Fog(horizon, fogNear, fogFar);
}
