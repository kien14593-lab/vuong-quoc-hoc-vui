import '@fontsource/nunito/vietnamese-800.css';
import '@fontsource/nunito/latin-800.css';
import * as THREE from 'three';
import { ITEMS, type ItemCat } from '../src/core/items';
import { isKid, kidKey, playerKey, type Kid } from '../src/core/outfits';
import type { Equipped } from '../src/core/state';
import { setupLights } from '../src/engine/lighting';
import { disposeTree } from '../src/engine/merge';
import { glbSpec, preloadGlb, setGlbEnabled, type GlbSpec } from '../src/models/glb';
import { buildModel, collectTicks } from '../src/models/registry';
import { animateRig, rigOf, type AnimState, type Rig } from '../src/models/rig';

/**
 * Thử đồ cho bé AI (dành cho phát triển): lưới ảnh bé trai / bé gái đeo từng món, nhìn trước / nghiêng / sau.
 *  kids=trai,gai          bé nào
 *  items=all              mũ, balo, phụ kiện (cả món ẩn) – hoặc hat | backpack | acc | danh sách mã (none = không đeo gì)
 *                         đeo nhiều món cùng lúc: ghép bằng "+" (vd hat_wizard+bag_rocket+acc_cape)
 *  views=0,90,180         góc nhìn (độ: 0 trước, 90 nghiêng trái, 180 sau)
 *  anim=idle|walk|run|wave|air|happy|ride|talk   f=0 (thời điểm trong một chu kỳ, 0..1)
 *  outfit=outfit_the_thao bộ đồ (bé chưa có thì mặc đồ thường ngày)
 *  mat=lambert|toon|standard  đổi vật liệu của bé (so sánh "mem" / "hoat-hinh" / "goc")
 *  zoom=1 ty=0.5 tx=0     phóng to; tâm nhìn theo chiều cao (0 chân – 1 đỉnh đầu), lệch ngang (phần chiều cao, + bên trái bé)
 *  cw=200 ch=260          cỡ mỗi ô (px)
 *  glb=0                  dùng bé dựng bằng code
 * Xong thì window.__done = true.
 */
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const list = (k: string, d: string) => (q.get(k) ?? d).split(',').map((s) => s.trim()).filter(Boolean);
const wrap = document.getElementById('wrap')!;
const info = document.getElementById('info')!;
const w = window as unknown as { __done?: boolean };

type AnimName = 'idle' | 'walk' | 'run' | 'wave' | 'air' | 'happy' | 'ride' | 'talk';
const STATES: Record<AnimName, Partial<AnimState>> = {
  idle: {},
  walk: { move: 1.4 },
  run: { move: 1.4, run: true },
  wave: { wave: true },
  air: { air: true },
  happy: { happy: 1 },
  ride: { move: 0.46, ride: true },
  talk: { talk: true },
};
/** Một chu kỳ (giây) của mỗi kiểu cử động (giống dev/rig.ts). */
const PERIOD: Record<AnimName, number> = {
  idle: 3,
  walk: 1 / 2.3,
  run: 1 / (2.3 * 1.35),
  wave: (2 * Math.PI) / 10,
  air: 1,
  happy: (2 * Math.PI) / 9,
  ride: 1,
  talk: (2 * Math.PI) / 9,
};
const SLOT: Partial<Record<ItemCat, keyof Equipped>> = { hat: 'hat', backpack: 'backpack', acc: 'acc' };

const KIDS = list('kids', 'trai,gai').filter(isKid) as Kid[];
const VIEWS = list('views', '0,90,180').map(Number);
const ANIM = (q.get('anim') ?? 'idle') as AnimName;
const OUTFIT = q.get('outfit') ?? undefined;
const MAT = q.get('mat') as GlbSpec['material'] | null;

function items(): string[] {
  const sel = list('items', 'all');
  const out: string[] = [];
  for (const s of sel) {
    if (s === 'all') out.push('none', ...ITEMS.filter((d) => SLOT[d.cat]).map((d) => d.id));
    else if (s === 'none') out.push('none');
    else if (s === 'hat' || s === 'backpack' || s === 'acc') out.push(...ITEMS.filter((d) => d.cat === s).map((d) => d.id));
    else out.push(s);
  }
  return [...new Set(out)];
}

function equipFor(id: string): Partial<Equipped> {
  const eq: Partial<Equipped> = OUTFIT ? { outfit: OUTFIT } : {};
  for (const one of id.split(/[+\s]+/)) {
    const d = ITEMS.find((x) => x.id === one);
    const slot = d && SLOT[d.cat];
    if (slot) (eq as Record<string, string | null>)[slot] = one;
  }
  return eq;
}

interface Puppet {
  root: THREE.Group;
  model: THREE.Object3D;
  rig: Rig;
  ticks: ((dt: number, t: number) => void)[];
  t: number;
}

function puppet(kid: Kid, eq: Partial<Equipped>): Puppet {
  const root = new THREE.Group();
  const model = buildModel('player', { kid, eq });
  root.add(model);
  if (ANIM === 'ride') {
    const b = buildModel('board_skate', {});
    b.position.y = 0.02;
    root.add(b);
    model.position.y = 0.16;
  }
  const rig = rigOf(model)!;
  rig._st = { phase: 0, blinkAt: 1e9, blinkT: -1, bodyY: 0, seed: 0, hop: 0, earAt: 1e9 };
  return { root, model, rig, ticks: collectTicks(model), t: 0 };
}

function step(p: Puppet, st: Partial<AnimState>, until: number, dt = 1 / 60): void {
  while (p.t < until - 1e-9) {
    p.t += dt;
    animateRig(p.rig, { t: p.t, dt, move: 0, ...st });
    for (const f of p.ticks) f(dt, p.t);
  }
}

function renderer(width: number, height: number): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.setPixelRatio(1);
  r.setSize(width, height, false);
  return r;
}

function stage(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6eee8');
  const lights = setupLights(scene, 'high', 5);
  lights.follow(new THREE.Vector3(0, 0, 0));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshLambertMaterial({ color: '#bcd9a8' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return scene;
}

/** Camera cận cảnh, hơi chúc xuống, xoay quanh bé theo góc yaw. */
function camera(aspect: number, H: number, yawDeg: number): THREE.PerspectiveCamera {
  const fov = 30;
  const half = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const pitch = THREE.MathUtils.degToRad(num('pitch', 8));
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const ty = H * num('ty', 0.5);
  const tx = H * num('tx', 0);
  const d = (H * 0.68) / half / num('zoom', 1);
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.05, 100);
  cam.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * d, ty + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
  cam.lookAt(tx, ty, 0);
  return cam;
}

function grid(): void {
  const ids = items();
  const cw = num('cw', 200);
  const ch = num('ch', 260);
  const LW = 130;
  const TH = 26;
  const cols = KIDS.length * VIEWS.length;
  const out = document.createElement('canvas');
  out.width = LW + cols * cw;
  out.height = TH + ids.length * ch;
  wrap.appendChild(out);
  const g = out.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, out.width, out.height);
  g.font = '800 13px Nunito, sans-serif';
  g.fillStyle = '#263238';
  let c = 0;
  for (const kid of KIDS) for (const v of VIEWS) g.fillText(`${kid === 'trai' ? 'Bé trai' : 'Bé gái'} · ${v}°`, LW + c++ * cw + 8, 18);
  const r = renderer(cw, ch);
  const scene = stage();
  const st = STATES[ANIM] ?? {};
  const f = num('f', 0);
  let row = 0;
  for (const id of ids) {
    c = 0;
    for (const kid of KIDS) {
      const p = puppet(kid, equipFor(id));
      scene.add(p.root);
      step(p, st, 1.5);
      step(p, st, 1.5 + PERIOD[ANIM] * f);
      p.root.updateMatrixWorld(true);
      for (const v of VIEWS) {
        r.render(scene, camera(cw / ch, p.rig.height, v));
        g.drawImage(r.domElement, LW + c++ * cw, TH + row * ch);
      }
      if (!p.model.userData.modelKey) {
        g.fillStyle = '#c62828';
        g.fillText('bé dựng bằng code', LW + (c - VIEWS.length) * cw + 8, TH + row * ch + 18);
      }
      scene.remove(p.root);
      disposeTree(p.root);
    }
    id.split(/[+\s]+/).forEach((one, i) => {
      const y = TH + row * ch + i * 38;
      g.fillStyle = '#263238';
      g.fillText(one, 6, y + 22);
      g.fillStyle = '#607d8b';
      g.fillText(ITEMS.find((x) => x.id === one)?.name ?? 'không đeo gì', 6, y + 40);
    });
    g.strokeStyle = '#d0d7d3';
    g.strokeRect(0.5, TH + row * ch + 0.5, out.width - 1, ch - 1);
    row++;
  }
  info.textContent = `anim=${ANIM} f=${f} mat=${MAT ?? 'theo cấu hình'} outfit=${OUTFIT ?? '—'} ${out.width}×${out.height}`;
  w.__done = true;
}

async function main() {
  const mods = import.meta.glob('../src/models/*.ts');
  for (const [path, load] of Object.entries(mods)) {
    if (path.endsWith('/index.ts')) continue;
    await load();
  }
  if (q.get('glb') === '0') setGlbEnabled(false);
  const keys = KIDS.flatMap((k) => [kidKey(k), playerKey(k, OUTFIT ?? null)]);
  await preloadGlb([...new Set([...keys, 'board_skate'])]);
  // Đổi vật liệu trước lần dựng đầu tiên (mô hình được chuẩn bị một lần cho mỗi khóa).
  if (MAT) for (const k of keys) {
    const s = glbSpec(k) as GlbSpec | undefined;
    if (s) s.material = MAT;
  }
  grid();
}

main().catch((e) => {
  info.textContent = 'Lỗi: ' + (e as Error).message;
  console.error(e);
  w.__done = true;
});
