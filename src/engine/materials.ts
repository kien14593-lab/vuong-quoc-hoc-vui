import * as THREE from 'three';

/**
 * Vật liệu dùng chung (được lưu đệm theo màu + tùy chọn) để tiết kiệm bộ nhớ và cho phép gộp lưới tĩnh.
 * Phong cách: low-poly, màu pastel, đổ bóng phẳng (flat shading) cho cảnh vật; mịn (smooth) cho nhân vật.
 */
export interface MatOpts {
  /** Đổ bóng phẳng kiểu low-poly (mặc định: true). */
  flat?: boolean;
  /** Màu tự phát sáng (đèn, cửa sổ ban đêm, đá quý...). */
  emissive?: THREE.ColorRepresentation;
  glow?: number;
  /** Độ bóng (dùng Phong) – ví dụ 40 cho nhựa bóng, 80 cho kim loại. */
  shiny?: number;
  opacity?: number;
  side?: THREE.Side;
  /** Không chịu ánh sáng (màu phẳng tuyệt đối). */
  unlit?: boolean;
  depthWrite?: boolean;
  fog?: boolean;
}

const cache = new Map<string, THREE.Material>();

export function mat(color: THREE.ColorRepresentation, o: MatOpts = {}): THREE.Material {
  const key = `${typeof color === 'object' ? (color as THREE.Color).getHexString() : String(color)}|${o.flat !== false ? 1 : 0}|${o.emissive ?? ''}|${o.glow ?? ''}|${o.shiny ?? ''}|${o.opacity ?? 1}|${o.side ?? 0}|${o.unlit ? 1 : 0}|${o.depthWrite ?? ''}|${o.fog ?? ''}`;
  let m = cache.get(key);
  if (m) return m;
  const transparent = o.opacity !== undefined && o.opacity < 1;
  const common = {
    color,
    transparent,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    depthWrite: o.depthWrite ?? !transparent,
    fog: o.fog ?? true,
  };
  if (o.unlit) {
    m = new THREE.MeshBasicMaterial(common);
  } else if (o.shiny) {
    m = new THREE.MeshPhongMaterial({
      ...common,
      flatShading: o.flat !== false,
      shininess: o.shiny,
      specular: new THREE.Color(0x3a3a3a),
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.glow ?? 1,
    });
  } else {
    m = new THREE.MeshLambertMaterial({
      ...common,
      flatShading: o.flat !== false,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.glow ?? 1,
    });
  }
  m.userData.shared = true;
  cache.set(key, m);
  return m;
}

/** Vật liệu mịn (cho nhân vật, thú, đồ vật tròn trịa). */
export function smooth(color: THREE.ColorRepresentation, o: MatOpts = {}): THREE.Material {
  return mat(color, { ...o, flat: false });
}

/** Bảng màu chính của thế giới (pastel, dịu mắt). */
export const PAL = {
  grass: '#a9d66f',
  grassLight: '#bfe283',
  grassDark: '#93c75f',
  meadow: '#b7dd7c',
  path: '#f1e6cc',
  pathEdge: '#e2d3ae',
  plaza: '#efe9df',
  stoneTile: '#e6e0d6',
  sand: '#f3e2b0',
  dirt: '#d9b98a',
  water: '#8fd8e6',
  waterDeep: '#6cc4d8',
  waterFoam: '#ffffff',
  bank: '#cfe5a0',
  wood: '#b98552',
  woodLight: '#d7a56d',
  woodDark: '#8b5a3c',
  trunk: '#8b5e3c',
  leaf1: '#5cb85c',
  leaf2: '#78c46a',
  leaf3: '#4fae7a',
  leaf4: '#94cf63',
  leaf5: '#3f9e6e',
  pine: '#3f9e72',
  pink: '#ff9ec4',
  blossom: '#ffc2d6',
  rock: '#c9c6c0',
  rockDark: '#a9a59e',
  wall: '#f6f0e4',
  wallShade: '#e8dfcf',
  roofOrange: '#f2a65a',
  roofCoral: '#ef8c7a',
  roofTeal: '#6fb7b7',
  roofBlue: '#7aa7e0',
  roofPurple: '#b39ddb',
  door: '#7b4a2e',
  window: '#7cc3e8',
  frame: '#ffffff',
  white: '#ffffff',
  cream: '#fff8ee',
  ink: '#3d3550',
  gold: '#ffcf4a',
  red: '#ff6b6b',
  orange: '#ffa94d',
  yellow: '#ffd166',
  green: '#7bd389',
  blue: '#74c0fc',
  purple: '#b197fc',
  lavender: '#d0c4f7',
  skyTop: '#8fd0f5',
  skyHorizon: '#e9f6ea',
  fog: '#d8ecd0',
} as const;

/** Làm sáng (+) / tối (−) một màu hex. */
export function tint(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl, THREE.SRGBColorSpace);
  hsl.l = Math.max(0, Math.min(1, hsl.l + amt));
  c.setHSL(hsl.h, hsl.s, hsl.l, THREE.SRGBColorSpace);
  return `#${c.getHexString()}`;
}
