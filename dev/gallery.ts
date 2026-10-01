import '@fontsource/baloo-2/vietnamese-800.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/nunito/vietnamese-800.css';
import '@fontsource/nunito/latin-800.css';
import * as THREE from 'three';
import { engine } from '../src/engine/core';
import { setupLights, setupSky } from '../src/engine/lighting';
import { PAL } from '../src/engine/materials';
import { loadFonts } from '../src/engine/text';
import { buildModel, collectTicks, modelDef, modelKeys, setRawModels } from '../src/models/registry';
import { animateRig, rigOf } from '../src/models/rig';
import { bakeStatic } from '../src/engine/merge';
import { glbReport, preloadGlb, setGlbEnabled } from '../src/models/glb';

/**
 * Thư viện xem thử mô hình 3D (dành cho phát triển).
 * Tham số URL:
 *  keys=a,b,c      chỉ hiện các khóa này          prefix=npc_     lọc theo tiền tố
 *  tags=tree       lọc theo thẻ                    variants=0      không bung biến thể
 *  yaw=45 pitch=50 góc camera (độ)                 zoom=1          phóng to/thu nhỏ
 *  anim=walk|run|talk|wave|happy|air|idle          rotate=30       xoay mô hình (độ/giây)
 *  labels=0        ẩn nhãn                         bake=1          thử gộp tĩnh
 *  gap=0.8         khoảng cách                     width=24        bề rộng hàng tối đa
 *  raw=1           không gộp lưới mô hình (gỡ lỗi)
 *  glb=0           tắt mô hình GLB (xem mô hình dựng bằng code)    glb=only  chỉ hiện mô hình GLB
 */
const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);

async function main() {
  await loadFonts();
  if (q.get('raw') === '1') setRawModels(true);
  // Nạp từng tệp mô hình riêng rẽ: một tệp lỗi không làm hỏng cả thư viện.
  const loadErrors: string[] = [];
  const mods = import.meta.glob('../src/models/*.ts');
  for (const [path, load] of Object.entries(mods)) {
    if (path.endsWith('/index.ts')) continue;
    try {
      await load();
    } catch (e) {
      console.error('Lỗi nạp ' + path, e);
      loadErrors.push(path.split('/').pop() ?? path);
    }
  }
  if (q.get('glb') === '0') setGlbEnabled(false);
  else await preloadGlb();
  const container = document.body;
  engine.init(container, (q.get('quality') as 'high' | 'low') ?? 'high');
  engine.canvas.style.position = 'fixed';
  engine.canvas.style.inset = '0';

  const scene = new THREE.Scene();
  setupSky(scene, '#a6dcf7', '#e4f3df', 400, 900);
  const lights = setupLights(scene, 'high', 40);

  let keys = q.get('keys')?.split(',').filter(Boolean) ?? modelKeys(q.get('prefix') ?? '');
  const tag = q.get('tags');
  if (tag) keys = keys.filter((k) => modelDef(k)?.tags?.includes(tag));
  if (q.get('glb') === 'only') keys = keys.filter((k) => modelDef(k)?.tags?.includes('glb'));
  const expand = q.get('variants') !== '0';

  interface Item { key: string; label: string; obj: THREE.Object3D; w: number; d: number; h: number; x: number; z: number }
  const items: Item[] = [];
  for (const key of keys) {
    const def = modelDef(key);
    const vars: Record<string, unknown>[] = expand && def?.variants?.length ? def.variants : [{}];
    vars.forEach((v, i) => {
      let obj: THREE.Object3D;
      try {
        obj = buildModel(key, v);
      } catch (e) {
        console.error(`build ${key}`, e);
        obj = buildModel('__missing__');
      }
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      items.push({
        key,
        label: vars.length > 1 ? `${key} #${i + 1}` : key,
        obj,
        w: Math.max(0.6, size.x),
        d: Math.max(0.6, size.z),
        h: size.y,
        x: 0,
        z: 0,
      });
    });
  }

  // Xếp theo hàng
  const gap = num('gap', 0.9);
  const area = items.reduce((s, it) => s + (it.w + gap) * (it.d + gap), 0);
  const maxW = num('width', Math.max(8, Math.sqrt(area) * 1.5));
  let x = 0;
  let z = 0;
  let rowD = 0;
  let row: Item[] = [];
  const rows: Item[][] = [];
  for (const it of items) {
    if (x > 0 && x + it.w > maxW) {
      rows.push(row);
      row = [];
      z += rowD + gap + 0.7;
      x = 0;
      rowD = 0;
    }
    it.x = x + it.w / 2;
    it.z = z + it.d / 2;
    x += it.w + gap;
    rowD = Math.max(rowD, it.d);
    row.push(it);
  }
  if (row.length) rows.push(row);
  const totalW = Math.max(...rows.map((r) => r[r.length - 1].x + r[r.length - 1].w / 2));
  const totalD = z + rowD;

  const world = new THREE.Group();
  for (const it of items) {
    it.obj.position.x += it.x - totalW / 2;
    it.obj.position.z += it.z - totalD / 2;
    world.add(it.obj);
  }
  scene.add(world);
  let drawInfo = '';
  if (q.get('bake') === '1') {
    const res = bakeStatic(world);
    scene.remove(world);
    scene.add(res.group);
    drawInfo = ` · baked ${res.drawCalls} draws / ${res.vertices} verts`;
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(totalW + 30, totalD + 30).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: q.get('bg') ?? PAL.grass }),
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // Camera
  const yaw = THREE.MathUtils.degToRad(num('yaw', 45));
  const pitch = THREE.MathUtils.degToRad(num('pitch', 50));
  const camera = new THREE.PerspectiveCamera(num('fov', 35), 1, 0.1, 1000);
  const maxH = Math.max(1, ...items.map((i) => i.h));
  const center = new THREE.Vector3(0, maxH * 0.3, 0);
  const fit = () => {
    const aspect = engine.w / engine.h;
    const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * aspect);
    // Ước lượng bán kính cần nhìn thấy
    const rx = totalW / 2 + 1;
    const rz = totalD / 2 + 1;
    const r = Math.max(rx, rz * 0.8, maxH);
    const dist = (Math.max(r / Math.sin(Math.min(vf, hf)), 4) * 1.02) / num('zoom', 1);
    camera.position.set(
      center.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      center.y + Math.sin(pitch) * dist,
      center.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(center);
    camera.far = dist * 4;
    camera.updateProjectionMatrix();
  };

  const labelsEl = document.getElementById('labels')!;
  const showLabels = q.get('labels') !== '0';
  const labels = showLabels
    ? items.map((it) => {
        const el = document.createElement('div');
        el.className = 'lbl' + (it.obj.userData.missing ? ' missing' : '');
        el.textContent = it.label;
        labelsEl.appendChild(el);
        return el;
      })
    : [];

  const ticks = collectTicks(scene);
  const anim = q.get('anim') ?? 'idle';
  const rotSpeed = THREE.MathUtils.degToRad(num('rotate', 0));
  const v = new THREE.Vector3();
  lights.follow(new THREE.Vector3(0, 0, 0));

  engine.setStage({
    scene,
    camera,
    onResize: fit,
    update(dt, t) {
      for (const tk of ticks) tk(dt, t);
      for (const it of items) {
        if (rotSpeed) it.obj.rotation.y += rotSpeed * dt;
        const rig = rigOf(it.obj);
        if (rig)
          animateRig(rig, {
            t,
            dt,
            move: anim === 'walk' ? 1 : anim === 'run' ? 1.3 : 0,
            run: anim === 'run',
            talk: anim === 'talk',
            wave: anim === 'wave',
            happy: anim === 'happy' ? 1 : 0,
            air: anim === 'air',
          });
      }
      labels.forEach((el, i) => {
        const it = items[i];
        v.set(it.obj.position.x, 0, it.obj.position.z + it.d / 2 + 0.15).project(camera);
        el.style.left = `${((v.x + 1) / 2) * engine.w}px`;
        el.style.top = `${((1 - v.y) / 2) * engine.h}px`;
      });
    },
  });
  fit();
  const info = document.getElementById('info')!;
  setTimeout(() => {
    const r = engine.renderer.info.render;
    info.textContent = `${items.length} mô hình · ${r.calls} lệnh vẽ · ${r.triangles} tam giác${drawInfo}${loadErrors.length ? ' · LỖI NẠP: ' + loadErrors.join(', ') : ''}`;
    (window as unknown as Record<string, unknown>).__gallery = { ready: true, calls: r.calls, triangles: r.triangles, items: items.length };
    (window as unknown as Record<string, unknown>).__glb = glbReport;
    (window as unknown as Record<string, unknown>).__catalog = () =>
      modelKeys().map((k) => {
        const d = modelDef(k)!;
        const h = typeof d.height === 'function' ? (d.height as (o: unknown) => number)(d.variants?.[0] ?? {}) : d.height;
        return { key: k, tags: d.tags ?? [], h: typeof h === 'number' ? Math.round(h * 100) / 100 : undefined, desc: d.desc ?? '' };
      });
  }, 600);
}

main().catch((e) => {
  console.error(e);
  document.body.textContent = String(e);
});
