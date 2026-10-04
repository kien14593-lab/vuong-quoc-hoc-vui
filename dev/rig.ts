import '@fontsource/nunito/vietnamese-800.css';
import '@fontsource/nunito/latin-800.css';
import * as THREE from 'three';
import { setupLights } from '../src/engine/lighting';
import { disposeTree } from '../src/engine/merge';
import type { AutoRigResult, V3 } from '../src/models/autorig';
import { glbAutoRig, preloadGlb } from '../src/models/glb';
import { buildModel, collectTicks } from '../src/models/registry';
import { animateRig, rigOf, type AnimState, type Rig } from '../src/models/rig';

/**
 * Thử nghiệm xương tự dựng cho mô hình AI không có xương (dành cho phát triển).
 *  key=npc_clown   mô hình (khóa)
 *  mode=weights    tô màu theo trọng số da + lưới nhãn 2D + khớp   (anim=walk... yaw=30 t=1.3 rig=1|0)
 *  mode=strip      dải khung hình   rig=both|1|0  dist=close|game  yaw=30  anims=walk,run,wave,air,happy,ride  frames=8
 *  mode=perf       đo thời gian dò xương, dựng mô hình, mỗi khung hình (n=20)
 * Xong thì window.__done = true (để công cụ chụp ảnh chờ).
 */
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const KEY = q.get('key') ?? 'npc_clown';
const MODE = q.get('mode') ?? 'weights';
const wrap = document.getElementById('wrap')!;
const info = document.getElementById('info')!;
const BONE_HEX = ['#a8a8a8', '#ffcf3f', '#ef5350', '#42a5f5', '#43a047', '#ab47bc'];
const BONE_NAMES = ['thân', 'đầu', 'tay T', 'tay P', 'chân T', 'chân P'];
const COLORS = BONE_HEX.map((c) => new THREE.Color(c));
const RGB = BONE_HEX.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const w = window as unknown as { __done?: boolean; __rig?: unknown };

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
/** Một chu kỳ (giây): các khung trong dải trải đều trên chu kỳ này. */
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

interface Puppet {
  root: THREE.Group;
  model: THREE.Object3D;
  rig: Rig;
  ticks: ((dt: number, t: number) => void)[];
  t: number;
}

function puppet(rigged: boolean, ride: boolean): Puppet {
  const root = new THREE.Group();
  const model = buildModel(KEY, { autoRig: rigged });
  root.add(model);
  if (ride) {
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

/** Camera: close = cận cảnh ngang tầm; game = như camera trong game (fov 38, chúc 50°, người cao ~100px trên khung 180px). */
function camera(dist: string, aspect: number, H: number, yawDeg: number): THREE.PerspectiveCamera {
  const close = dist !== 'game';
  const fov = close ? 30 : 38;
  const half = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const pitch = THREE.MathUtils.degToRad(close ? 8 : 50);
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const ty = H * 0.5;
  const d = close ? (H * 0.68) / half : (1.8 * H) / (2 * half);
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.05, 100);
  cam.position.set(Math.sin(yaw) * Math.cos(pitch) * d, ty + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
  cam.lookAt(0, ty, 0);
  return cam;
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
const f3 = (v: number) => (Math.round(v * 1000) / 1000).toString();
const v3 = (p: V3) => `(${p.map(f3).join(', ')})`;

function summary(res: AutoRigResult): string {
  const j = res.joints;
  const a = res.anchors;
  return [
    `${KEY}: ok=${res.ok} chân=${res.legs} tay=${res.arms}  dò ${f1(res.ms)} ms  cao ${f3(res.height)} m`,
    `ghi chú: ${res.notes.join('; ') || '-'}`,
    `hông ${v3(j.pelvis)}  cổ ${v3(j.neck)}`,
    `vai T ${v3(j.shoulderL)}  vai P ${v3(j.shoulderR)}`,
    `háng T ${v3(j.hipL)}  háng P ${v3(j.hipR)}`,
    `hạ tay ${res.relax.map(f3).join(' / ')} rad   góc tay ${res.armAngle.map((x) => f1((x * 180) / Math.PI)).join(' / ')}°`,
    `đầu ${v3(a.head)} r ${v3(a.headR)} đỉnh ${f3(a.headTop)} mặt z ${f3(a.faceZ)}`,
    `ngực y ${f3(a.chestY)} trước ${f3(a.chestFrontZ)} sau ${f3(a.chestBackZ)} nửa ngang ${f3(a.chestHalfW)}`,
    `bàn tay T ${v3(a.handL)} P ${v3(a.handR)}`,
  ].join('\n');
}

/* ---------------- weights ---------------- */
function weights(): void {
  const res = glbAutoRig(KEY);
  if (!res?.debug) {
    info.textContent = `Không dò được ${KEY} (chưa có GLB?)`;
    w.__done = true;
    return;
  }
  const d = res.debug;
  w.__rig = { ...res, skin: undefined, debug: undefined };

  // 3D: tô màu theo trọng số
  const W3 = num('w3d', 520);
  const H3 = num('h3d', 640);
  const r = renderer(W3, H3);
  wrap.appendChild(r.domElement);
  const scene = stage();
  const anim = (q.get('anim') ?? 'idle') as AnimName;
  const p = puppet(q.get('rig') !== '0', anim === 'ride');
  scene.add(p.root);
  if (q.get('color') !== '0') {
    p.model.traverse((x) => {
      const sm = x as THREE.SkinnedMesh;
      if (!sm.isSkinnedMesh) return;
      const geo = sm.geometry.clone();
      const si = geo.getAttribute('skinIndex').array as ArrayLike<number>;
      const sw = geo.getAttribute('skinWeight').array as ArrayLike<number>;
      const n = si.length / 4;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let cr = 0;
        let cg = 0;
        let cb = 0;
        for (let k = 0; k < 4; k++) {
          const c = COLORS[si[i * 4 + k]];
          const wt = sw[i * 4 + k];
          cr += c.r * wt;
          cg += c.g * wt;
          cb += c.b * wt;
        }
        col[i * 3] = cr;
        col[i * 3 + 1] = cg;
        col[i * 3 + 2] = cb;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      sm.geometry = geo;
      sm.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    });
  }
  // Điểm khớp (vẽ xuyên qua lưới)
  const rig = p.rig;
  for (const b of [rig.body, rig.head, rig.armL, rig.armR, rig.legL, rig.legR]) {
    if (!b) continue;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicMaterial({ color: '#111', depthTest: false }));
    m.renderOrder = 10;
    b.add(m);
  }
  const cam = camera('close', W3 / H3, rig.height, num('yaw', 0));
  const tFix = q.has('t') ? num('t', 1) : -1;
  if (tFix >= 0) {
    step(p, STATES[anim], tFix);
    r.render(scene, cam);
  } else {
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      step(p, STATES[anim], p.t + Math.min(0.1, (now - last) / 1000));
      last = now;
      r.render(scene, cam);
      requestAnimationFrame(loop);
    };
    loop();
  }

  // 2D: lưới nhãn & trọng số
  const px = num('px', 2.5);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(d.W * px);
  cv.height = Math.ceil(d.R * px);
  const g = cv.getContext('2d')!;
  const img = new ImageData(d.W, d.R);
  for (let j = 0; j < d.R; j++) {
    for (let i = 0; i < d.W; i++) {
      const k = j * d.W + i;
      const o = ((d.R - 1 - j) * d.W + i) * 4;
      if (d.lab[k] < 0) continue;
      let cr = 0;
      let cg = 0;
      let cb = 0;
      for (let b = 0; b < 6; b++) {
        const wt = d.wts[k * 6 + b];
        cr += RGB[b][0] * wt;
        cg += RGB[b][1] * wt;
        cb += RGB[b][2] * wt;
      }
      img.data[o] = cr;
      img.data[o + 1] = cg;
      img.data[o + 2] = cb;
      img.data[o + 3] = 255;
    }
  }
  const tmp = document.createElement('canvas');
  tmp.width = d.W;
  tmp.height = d.R;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = false;
  g.drawImage(tmp, 0, 0, cv.width, cv.height);
  const toPx = (p: V3): [number, number] => [((p[0] - d.x0) / d.cell) * px, cv.height - ((p[1] - d.y0) / d.cell) * px];
  const dot = (p: V3, color: string, rad = 4) => {
    const [x, y] = toPx(p);
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    g.stroke();
  };
  const J = res.joints;
  for (const p2 of [J.pelvis, J.neck, J.shoulderL, J.shoulderR, J.hipL, J.hipR]) dot(p2, '#111');
  const A = res.anchors;
  dot(A.head, '#ff6f00', 3);
  dot([A.head[0], A.headTop, A.head[2]], '#ff6f00', 3);
  dot(A.handL, '#00897b', 3);
  dot(A.handR, '#00897b', 3);
  dot([A.head[0], A.chestY, 0], '#6a1b9a', 3);
  {
    const [ci, cj, cr] = d.headCircle;
    g.beginPath();
    g.arc((ci + 0.5) * px, cv.height - (cj + 0.5) * px, cr * px, 0, Math.PI * 2);
    g.strokeStyle = '#ff6f00';
    g.lineWidth = 1.5;
    g.stroke();
  }
  wrap.appendChild(cv);

  info.innerHTML = '';
  info.append(summary(res) + '\n');
  const lg = document.createElement('div');
  lg.innerHTML = BONE_NAMES.map((n, i) => `<span style="color:${BONE_HEX[i]}">■</span> ${n}`).join(' &nbsp; ');
  info.append(lg);
  w.__done = true;
}

/* ---------------- strip ---------------- */
function strip(): void {
  const dist = q.get('dist') ?? 'close';
  const yaw = num('yaw', 30);
  const frames = num('frames', 8);
  const anims = (q.get('anims') ?? 'walk,run,wave,air,happy,ride').split(',') as AnimName[];
  const rq = q.get('rig') ?? 'both';
  const variants = rq === 'both' ? [true, false] : [rq !== '0'];
  const cw = num('cw', dist === 'game' ? 140 : 200);
  const ch = num('ch', dist === 'game' ? 180 : 260);
  const LW = 70;
  const rows = anims.length * variants.length;
  const out = document.createElement('canvas');
  out.id = 'strip';
  out.width = LW + frames * cw;
  out.height = rows * ch;
  wrap.appendChild(out);
  const g = out.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, out.width, out.height);
  const r = renderer(cw, ch);
  const scene = stage();
  let row = 0;
  for (const a of anims) {
    for (const rg of variants) {
      const p = puppet(rg, a === 'ride');
      scene.add(p.root);
      const cam = camera(dist, cw / ch, p.rig.height, yaw);
      const st = STATES[a];
      step(p, st, 1.5);
      const t0 = p.t;
      for (let f = 0; f < frames; f++) {
        step(p, st, t0 + (PERIOD[a] * f) / frames);
        r.render(scene, cam);
        g.drawImage(r.domElement, LW + f * cw, row * ch);
      }
      g.fillStyle = '#263238';
      g.font = '800 14px Nunito, sans-serif';
      g.fillText(a, 6, row * ch + 22);
      g.fillStyle = rg ? '#2e7d32' : '#c62828';
      g.fillText(rg ? 'xương' : 'nhún', 6, row * ch + 42);
      g.strokeStyle = '#d0d7d3';
      g.strokeRect(0.5, row * ch + 0.5, out.width - 1, ch - 1);
      scene.remove(p.root);
      disposeTree(p.root);
      row++;
    }
  }
  info.textContent = `${KEY} dist=${dist} yaw=${yaw} ${out.width}×${out.height}`;
  w.__done = true;
}

/* ---------------- perf ---------------- */
function perf(): void {
  const n = num('n', 20);
  const lines: string[] = [];
  const ts: number[] = [];
  let res: AutoRigResult | null = null;
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    res = glbAutoRig(KEY);
    ts.push(performance.now() - t);
  }
  lines.push(`dò xương (gồm lấy đỉnh, có lưới gỡ lỗi): ${ts.map(f1).join(' / ')} ms (autoRig ${f1(res?.ms ?? 0)} ms)`);
  let t = performance.now();
  const first = buildModel(KEY, { autoRig: true });
  lines.push(`dựng lần đầu có xương (dò + trọng số + dựng): ${f1(performance.now() - t)} ms  rigged=${!!first.userData.rigged}`);
  disposeTree(first);
  for (const rg of [true, false]) {
    t = performance.now();
    for (let i = 0; i < 10; i++) disposeTree(buildModel(KEY, { autoRig: rg }));
    lines.push(`dựng bản sao ${rg ? 'có xương' : 'nhún'}: ${f3((performance.now() - t) / 10)} ms`);
  }
  const W = 800;
  const H = 600;
  const r = renderer(W, H);
  wrap.appendChild(r.domElement);
  const gl = r.getContext();
  const px = new Uint8Array(4);
  for (const rg of [true, false]) {
    const scene = stage();
    const ps: Puppet[] = [];
    const side = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const p = puppet(rg, false);
      p.root.position.set(((i % side) - side / 2) * 1.2, 0, (Math.floor(i / side) - side / 2) * 1.2);
      scene.add(p.root);
      ps.push(p);
    }
    const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    cam.position.set(0, side * 1.6, side * 2.2);
    cam.lookAt(0, 0.8, 0);
    let tA = 0;
    let tU = 0;
    let tR = 0;
    const N = 120;
    for (let f = 0; f < N + 30; f++) {
      const a0 = performance.now();
      for (const p of ps) step(p, STATES.walk, p.t + 1 / 60);
      const a1 = performance.now();
      scene.updateMatrixWorld();
      const a2 = performance.now();
      r.render(scene, cam);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const a3 = performance.now();
      if (f >= 30) {
        tA += a1 - a0;
        tU += a2 - a1;
        tR += a3 - a2;
      }
    }
    lines.push(
      `${n} bản ${rg ? 'có xương' : 'nhún'}: hoạt cảnh ${f3(tA / N)} ms, ma trận ${f3(tU / N)} ms, vẽ+đồng bộ GPU ${f3(tR / N)} ms /khung`,
    );
    for (const p of ps) disposeTree(p.root);
  }
  info.textContent = lines.join('\n');
  w.__rig = lines;
  w.__done = true;
}

async function main() {
  const mods = import.meta.glob('../src/models/*.ts');
  for (const [path, load] of Object.entries(mods)) {
    if (path.endsWith('/index.ts')) continue;
    await load();
  }
  await preloadGlb([KEY, 'board_skate']);
  if (MODE === 'strip') strip();
  else if (MODE === 'perf') perf();
  else weights();
}

main().catch((e) => {
  info.textContent = 'Lỗi: ' + (e as Error).message;
  console.error(e);
  w.__done = true;
});
