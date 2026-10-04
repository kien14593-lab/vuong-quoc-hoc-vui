#!/usr/bin/env node
/**
 * Xử lý mô hình AI (Tencent HY 3D, Meshy, Tripo...) cho game Vương Quốc Học Vui.
 *
 *   node tools/xu-ly-mo-hinh.mjs            (hoặc nhấp đúp CapNhatMoHinh.bat)
 *
 * 1. Đọc mọi tệp .glb trong thư mục mo-hinh-ai/  (vd. gau.glb, gau-di.glb, gau@vay-tay.glb)
 * 2. Nhận tên nhân vật + động tác theo bảng src/assets/models/ai-names.json (tiếng Việt không dấu cũng được)
 * 3. Tối ưu: thu nhỏ ảnh (webp 1024), lưới quá dày (> 60.000 tam giác, vd. 1,5 triệu của HY 3D) tự giảm còn
 *    ~60.000 tam giác (riêng từng nhân vật: "tam-giac" trong cau-hinh.json), nén lưới (meshopt), bỏ dữ liệu thừa;
 *    tệp động tác chỉ giữ phần chuyển động
 * 4. Ghi vào src/assets/models/ai/<khóa>.glb, <khóa>@<động tác>.glb  +  config.json (từ mo-hinh-ai/cau-hinh.json),
 *    GHI-CONG.md (bảng ghi công) và .tao-tu-dong.txt (danh sách tệp do công cụ tạo)
 *
 * Chỉ nhân vật CÓ tệp gốc trong mo-hinh-ai/ lần này mới được làm lại (tệp cũ của nhân vật đó không còn dùng thì xóa).
 * Nhân vật đã lắp từ trước mà tệp gốc không còn ở đây (vd. lắp trên máy khác) được GIỮ NGUYÊN. Muốn gỡ hẳn: --go <tên>.
 *
 * Tùy chọn: --anh 2048 (cỡ ảnh tối đa), --giam 0.5 (giảm số tam giác còn 50%), --xem (chỉ xem, không ghi),
 *           --go gau (gỡ mô hình AI của nhân vật; nhiều tên: --go gau,tho hoặc --go gau --go tho),
 *           --vao <thư mục> --ra <thư mục> (đổi thư mục vào/ra – dùng để thử nghiệm)
 */
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, dequantize, meshopt, prune, resample, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
/** Mọi giá trị của một tùy chọn lặp lại được: --go gau --go tho,meo → ['gau', 'tho', 'meo'] ('' = thiếu tên). */
const argAll = (name) => {
  const vals = [];
  argv.forEach((a, i) => {
    let v = null;
    if (a === `--${name}`) v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
    else if (a.startsWith(`--${name}=`)) v = a.slice(name.length + 3);
    if (v === null) return;
    const parts = v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    vals.push(...(parts.length ? parts : ['']));
  });
  return vals;
};
const IN_DIR = path.resolve(ROOT, String(arg('vao', 'mo-hinh-ai')));
const OUT_DIR = path.resolve(ROOT, String(arg('ra', path.join('src', 'assets', 'models', 'ai'))));
const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'assets', 'models', 'ai-names.json'), 'utf8'));
const MANIFEST = path.join(OUT_DIR, '.tao-tu-dong.txt');
const ROLES = ['idle', 'walk', 'run', 'jump', 'fall', 'wave', 'talk', 'happy', 'eat', 'sit', 'swim', 'fly', 'attack', 'hit', 'death'];
const ROLE_VI = { idle: 'đứng yên', walk: 'đi', run: 'chạy', jump: 'nhảy', fall: 'rơi', wave: 'vẫy tay', talk: 'nói', happy: 'vui mừng', eat: 'ăn', sit: 'ngồi', swim: 'bơi', fly: 'bay', attack: 'tấn công', hit: 'bị trúng', death: 'ngã' };
const ROLE_HINT = {
  idle: /idle|stand|breath/i,
  walk: /walk/i,
  run: /run|jog|sprint|gallop/i,
  jump: /jump|hop/i,
  wave: /wave|hello|greet/i,
  talk: /talk|speak|yes|nod/i,
  happy: /dance|cheer|happy|victory|clap/i,
  sit: /sit/i,
  eat: /eat|graz|peck/i,
};
/** Tên tiếng Việt cho khóa (để báo cáo). */
const KEY_VI = {
  npc_bear: 'Chú Gấu', npc_rabbit: 'Thỏ Bông', npc_robot: 'Robot Bíp', npc_cat: 'Cô Mèo', npc_owl: 'Bác Cú', npc_squirrel: 'Cô Sóc',
  npc_turtle: 'Ông Rùa', npc_deer: 'Bạn Nai', npc_elephant: 'Bác Voi', npc_king: 'Nhà Vua', npc_knight: 'Hiệp Sĩ Thỏ', npc_clown: 'Chú Hề',
  npc_villager: 'Dân làng',
  pet_dog: 'Cún con', pet_cat: 'Mèo mướp con', pet_rabbit: 'Thỏ con', pet_panda: 'Gấu trúc con', pet_fox: 'Cáo con',
  pet_penguin: 'Chim cánh cụt con', pet_dino: 'Khủng long tí hon',
  animal_giraffe: 'Hươu cao cổ', animal_monkey: 'Khỉ', animal_penguin: 'Chim cánh cụt (Sở Thú)', animal_zebra: 'Ngựa vằn',
  animal_hippo: 'Hà mã', animal_lion: 'Sư tử',
};

/* ------------------------------------------------------------------ */
/* Tham số dòng lệnh                                                    */
/* ------------------------------------------------------------------ */
const TEX_SIZE = Number(arg('anh', 1024)) || 1024;
const REDUCE = arg('giam', null) === null ? null : Number(arg('giam'));
const DRY = arg('xem', false) === true;
const GO = argAll('go');
/** Lưới dày hơn mức này được tự giảm về đúng mức này (vd. HY 3D: 1.500.000 → 60.000 tam giác). Đổi riêng: "tam-giac". */
const AUTO_TRI_LIMIT = 60000;
/** Sai lệch hình dạng tối đa khi giảm lưới (tỉ lệ theo kích thước mô hình: 0,01 = 1%). */
const SIMPLIFY_ERROR = 0.01;
/** Trọng số pháp tuyến khi giảm lưới – giữ mặt cong mượt, tránh vệt gãy khi tô bóng. */
const NORMAL_WEIGHT = 1;

/* ------------------------------------------------------------------ */
/* Tên tệp → khóa + động tác                                            */
/* ------------------------------------------------------------------ */
const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\(\d+\)/g, ' ')
    .replace(/[\s_.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

function keyOf(name) {
  const s = slug(name);
  if (!s) return null;
  for (const [k, list] of Object.entries(NAMES.keys)) {
    if (slug(k) === s || list.map(slug).includes(s)) return k;
  }
  return null;
}

function roleOf(name) {
  const s = slug(name);
  if (!s) return null;
  if (ROLES.includes(s)) return s;
  for (const [r, list] of Object.entries(NAMES.roles)) if (list.map(slug).includes(s)) return r;
  return null;
}

/** "gau@di", "gau-di", "chu-gau-vay-tay", "Gấu đi" → { key: 'npc_bear', role: 'walk' }. */
function parseName(file) {
  const base = file.replace(/\.(glb|gltf)$/i, '');
  const at = base.indexOf('@');
  if (at > 0) {
    const key = keyOf(base.slice(0, at));
    const role = roleOf(base.slice(at + 1));
    return { key, role, roleText: base.slice(at + 1), explicit: true };
  }
  const key = keyOf(base);
  if (key) return { key, role: null };
  const parts = slug(base).split('-');
  for (let i = parts.length - 1; i > 0; i--) {
    const k = keyOf(parts.slice(0, i).join('-'));
    const r = roleOf(parts.slice(i).join('-'));
    if (k && r) return { key: k, role: r };
  }
  return { key: null, role: null };
}

/* ------------------------------------------------------------------ */
/* Cấu hình tiếng Việt → cấu hình mô hình                               */
/* ------------------------------------------------------------------ */
const MATERIAL = { mem: 'lambert', 'mem-mai': 'lambert', lambert: 'lambert', 'hoat-hinh': 'toon', toon: 'toon', goc: 'standard', 'nguyen-ban': 'standard', standard: 'standard' };

function convertConfig(raw) {
  const out = {};
  /** Khóa → số tam giác tối đa riêng ("tam-giac"). Chỉ dùng lúc giảm lưới, không ghi vào config.json của game. */
  const tris = {};
  const warn = [];
  for (const [name, c] of Object.entries(raw ?? {})) {
    if (name.startsWith('_')) continue;
    const key = keyOf(name);
    if (!key) {
      warn.push(`cau-hinh.json: không biết nhân vật "${name}" – bỏ qua.`);
      continue;
    }
    const o = {};
    for (const [k, v] of Object.entries(c ?? {})) {
      const sk = slug(k);
      if (sk === 'chieu-cao' || k === 'height') o.height = Number(v);
      else if (sk === 'xoay' || k === 'rotY') o.rotY = Number(v);
      else if (sk === 'ty-le' || sk === 'ti-le' || k === 'scale') o.scale = Number(v);
      else if (sk === 'nang-len' || sk === 'ha-xuong') o.offset = [0, sk === 'ha-xuong' ? -Number(v) : Number(v), 0];
      else if (sk === 'vat-lieu' || k === 'material') {
        const m = MATERIAL[slug(v)];
        if (m) o.material = m;
        else warn.push(`cau-hinh.json: "${name}" – vật liệu "${v}" không hợp lệ (dùng: mem, hoat-hinh, goc).`);
      } else if (sk === 'nguon' || k === 'credit') o.credit = String(v);
      else if (sk === 'tam-giac' || k === 'triangles') {
        const n = Math.round(Number(v));
        if (n >= 1000) tris[key] = n;
        else warn.push(`cau-hinh.json: "${name}" – "tam-giac" phải là số từ 1000 trở lên (vd. 40000) – bỏ qua.`);
      } else if (sk === 'di-tai-cho' || k === 'inPlace') o.inPlace = Boolean(v);
      else if (sk === 'toc-do-di' || k === 'walkRate') o.walkRate = Number(v);
      else if (sk === 'toc-do-chay' || k === 'runRate') o.runRate = Number(v);
      else if (sk === 'mau' || k === 'colors') o.colors = v;
      else if (sk === 'an' || k === 'hide') o.hide = Array.isArray(v) ? v : [v];
      else if (sk === 'dong-tac' || k === 'clips') {
        const clips = {};
        for (const [r, clip] of Object.entries(v ?? {})) {
          const role = roleOf(r);
          if (role) clips[role] = clip;
          else warn.push(`cau-hinh.json: "${name}" – động tác "${r}" không hợp lệ.`);
        }
        o.clips = clips;
      } else warn.push(`cau-hinh.json: "${name}" – không hiểu mục "${k}" (bỏ qua).`);
    }
    out[key] = { ...out[key], ...o };
  }
  return { out, tris, warn };
}

/* ------------------------------------------------------------------ */
/* Xử lý                                                                */
/* ------------------------------------------------------------------ */
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const num = (n) => n.toLocaleString('vi-VN');
const label = (key) => KEY_VI[key] ?? key;
/** Khóa nhân vật của một tệp kết quả: npc_bear.glb, npc_bear@walk.glb → npc_bear. */
const outKey = (file) => file.replace(/\.glb$/i, '').split('@')[0];
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
};

function triangles(doc) {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      const pos = p.getAttribute('POSITION');
      if (p.getMode() !== 4) continue;
      t += idx ? idx.getCount() / 3 : pos ? pos.getCount() / 3 : 0;
    }
  }
  return Math.round(t);
}

/**
 * Giảm số tam giác bằng meshoptimizer, có tính cả pháp tuyến (NORMAL) để mặt cong không bị vệt gãy khi tô bóng
 * (chỉ dựa vào vị trí như simplify() của gltf-transform thì má, mõm... có vệt gãy). Đường nối UV được giữ nguyên;
 * dừng sớm nếu hình dạng sai lệch quá SIMPLIFY_ERROR. Cần chạy weld() trước.
 */
function simplifyMesh(ratio) {
  return (doc) => {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        const pos = prim.getAttribute('POSITION')?.getArray();
        if (prim.getMode() !== 4 || !idx || !(pos instanceof Float32Array)) continue;
        const nrm = prim.getAttribute('NORMAL')?.getArray();
        const src = new Uint32Array(idx.getArray());
        const target = Math.floor((ratio * src.length) / 3) * 3;
        const w = NORMAL_WEIGHT;
        const [dst] =
          nrm instanceof Float32Array
            ? MeshoptSimplifier.simplifyWithAttributes(src, pos, 3, nrm, 3, [w, w, w], null, target, SIMPLIFY_ERROR)
            : MeshoptSimplifier.simplify(src, pos, 3, target, SIMPLIFY_ERROR);
        if (!dst.length || dst.length >= src.length) continue;
        prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(dst).setBuffer(idx.getBuffer() ?? doc.getRoot().listBuffers()[0]));
        if (idx.listParents().length === 1) idx.dispose();
        compactPrimitive(prim); // bỏ đỉnh không dùng (và chọn chỉ số 16-bit khi đủ)
      }
    }
  };
}

async function main() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const quiet = new Logger(Logger.Verbosity.ERROR);
  io.setLogger(quiet);

  console.log('');
  console.log('=== XỬ LÝ MÔ HÌNH AI – Vương Quốc Học Vui ===');
  if (!DRY) {
    fs.mkdirSync(IN_DIR, { recursive: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  let bad = 0;

  // Nhân vật cần gỡ (--go)
  const removeKeys = new Map(); // khóa -> tên đã gõ
  for (const name of GO) {
    const key = name ? keyOf(path.basename(name).replace(/\.(glb|gltf)$/i, '')) : null;
    if (key) removeKeys.set(key, name);
    else {
      console.log(
        name
          ? `  ✖ --go ${name}: không nhận ra nhân vật. Viết tên như tên tệp, ví dụ: --go gau, --go tho, --go gau,tho.`
          : '  ✖ --go: thiếu tên nhân vật cần gỡ, ví dụ: --go gau',
      );
      bad++;
    }
  }

  const all = fs.existsSync(IN_DIR) ? fs.readdirSync(IN_DIR).filter((f) => !f.startsWith('.')) : [];
  const glbs = all.filter((f) => /\.glb$/i.test(f));
  const others = all.filter((f) => /\.(fbx|obj|gltf|blend|usdz|stl|zip)$/i.test(f));
  for (const f of others) {
    console.log(`  ⚠ ${f}: game chỉ dùng định dạng GLB. Hãy tải lại mô hình ở dạng .glb (hoặc giải nén tệp .zip).`);
  }

  // Cấu hình
  let cfgRaw = {};
  const cfgPath = path.join(IN_DIR, 'cau-hinh.json');
  if (fs.existsSync(cfgPath)) {
    try {
      cfgRaw = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
      console.log(`  ✖ cau-hinh.json bị lỗi cú pháp: ${e.message}`);
      process.exitCode = 1;
    }
  }
  const { out: config, tris: triLimits, warn: cfgWarn } = convertConfig(cfgRaw);
  cfgWarn.forEach((w) => console.log('  ⚠ ' + w));

  // Gom theo nhân vật
  const plan = new Map(); // key -> { main?: file, anims: [{file, role}] }
  for (const f of glbs) {
    const p = parseName(f);
    if (!p.key) {
      console.log(`  ✖ ${f}: không nhận ra nhân vật. Đổi tên tệp, ví dụ: gau.glb, tho.glb, meo.glb, cu.glb, vua.glb (xem danh sách trong hướng dẫn).`);
      bad++;
      continue;
    }
    if (p.explicit && !p.role) {
      console.log(`  ✖ ${f}: không hiểu động tác "${p.roleText}". Dùng: dung, di, chay, nhay, vay-tay, noi, vui, ngoi, an.`);
      bad++;
      continue;
    }
    if (!plan.has(p.key)) plan.set(p.key, { main: null, anims: [] });
    const e = plan.get(p.key);
    if (p.role) e.anims.push({ file: f, role: p.role });
    else if (e.main) {
      console.log(`  ⚠ ${f}: đã có tệp chính "${e.main}" cho ${label(p.key)} – bỏ qua tệp này.`);
    } else e.main = f;
  }
  // Nhân vật chỉ có tệp động tác: dùng tệp "đứng yên" (hoặc tệp đầu tiên) làm tệp chính.
  for (const [key, e] of plan) {
    if (e.main) continue;
    const pickIdx = Math.max(0, e.anims.findIndex((a) => a.role === 'idle'));
    const pick = e.anims[pickIdx];
    if (!pick) continue;
    e.main = pick.file;
    e.mainRole = pick.role;
    e.anims.splice(pickIdx, 1);
    console.log(`  ℹ ${label(key)}: không có tệp chính – dùng "${pick.file}" làm mô hình chính.`);
  }
  // Vừa có lệnh gỡ vừa có tệp gốc: gỡ, bỏ qua tệp gốc.
  for (const key of removeKeys.keys()) {
    const e = plan.get(key);
    if (!e) continue;
    plan.delete(key);
    const files = [e.main, ...e.anims.map((a) => a.file)].join(', ');
    console.log(
      `  ⚠ ${label(key)}: có lệnh gỡ (--go) nhưng mo-hinh-ai vẫn còn ${files} – lần này bỏ qua tệp đó. ` +
        `Hãy xóa hoặc chuyển tệp đó đi chỗ khác, nếu không lần chạy sau ${label(key)} sẽ được lắp lại.`,
    );
  }

  // Kết quả các lần chạy trước: nhân vật không có tệp gốc lần này thì giữ nguyên (tệp gốc .glb không đưa vào kho mã,
  // nên máy khác / bản sao mới không có tệp gốc của nhân vật đã lắp).
  const outBefore = new Map(); // khóa -> các tệp .glb đang có trong thư mục kết quả
  if (fs.existsSync(OUT_DIR)) {
    for (const f of fs.readdirSync(OUT_DIR).filter((f) => /\.glb$/i.test(f)).sort()) {
      const k = outKey(f);
      if (!outBefore.has(k)) outBefore.set(k, []);
      outBefore.get(k).push(f);
    }
  }
  const prevSources = readJson(MANIFEST)?.nguon ?? {};
  const prevCfg = readJson(path.join(OUT_DIR, 'config.json')) ?? {};
  const hadState = ['config.json', 'GHI-CONG.md', path.basename(MANIFEST)].some((f) => fs.existsSync(path.join(OUT_DIR, f)));
  try {
    // Bảng ghi công cũ (khi danh sách tệp chưa ghi tệp gốc): | Tên | khóa | nguồn | tệp gốc |
    for (const line of fs.readFileSync(path.join(OUT_DIR, 'GHI-CONG.md'), 'utf8').split(/\r?\n/)) {
      const cells = line.split('|').map((s) => s.trim());
      if (cells.length >= 6 && /^[a-z0-9_]+$/.test(cells[2]) && !prevSources[cells[2]] && cells[4] && cells[4] !== '–') {
        prevSources[cells[2]] = cells[4].split(/,\s*/);
      }
    }
  } catch {
    /* chưa có bảng ghi công */
  }
  const kept = new Map(); // khóa -> các tệp giữ nguyên
  for (const [key, files] of outBefore) {
    if (plan.has(key) || removeKeys.has(key)) continue;
    kept.set(key, files);
    console.log(`  ℹ ${label(key)}: không có tệp gốc trong mo-hinh-ai – giữ nguyên mô hình đã lắp (${files.join(', ')}).`);
  }
  if (!glbs.length && !GO.length) {
    if (kept.size) console.log('  ℹ Không có tệp .glb mới trong mo-hinh-ai – chỉ cập nhật cấu hình (cau-hinh.json) cho các nhân vật đã lắp.');
    else {
      console.log(`  Chưa có tệp .glb nào trong thư mục: ${IN_DIR}`);
      console.log('  Xem hướng dẫn: HUONG-DAN-MO-HINH-AI.md');
    }
  }

  const produced = []; // tệp kết quả của các nhân vật làm lại lần này
  const done = new Map(); // khóa -> tệp gốc đã dùng
  let writtenCount = 0;
  for (const [key, e] of plan) {
    console.log('');
    console.log(`▶ ${label(key)} (${key})`);
    const old = outBefore.get(key) ?? [];
    // Tệp chính
    const srcPath = path.join(IN_DIR, e.main);
    let doc;
    try {
      doc = await io.read(srcPath);
      doc.setLogger(quiet);
    } catch (err) {
      console.log(`  ✖ Không đọc được ${e.main}: ${err.message}`);
      bad++;
      if (old.length) {
        kept.set(key, old);
        console.log(`  ℹ Giữ nguyên mô hình cũ (${old.join(', ')}).`);
      }
      continue;
    }
    const before = fs.statSync(srcPath).size;
    const tris = triangles(doc);
    const skins = doc.getRoot().listSkins().length;
    const clips = doc.getRoot().listAnimations().map((a) => a.getName() || '(không tên)');
    if (e.mainRole && clips.length === 1) doc.getRoot().listAnimations()[0].setName(e.mainRole);
    else if (clips.length === 1 && !Object.values(ROLE_HINT).some((rx) => rx.test(clips[0]))) {
      // Tệp chính kèm 1 động tác tên chung chung (vd. "Armature|clip0") – coi là "đứng yên".
      doc.getRoot().listAnimations()[0].setName('idle');
      clips[0] = `${clips[0]} → đứng yên`;
    }
    const steps = [dedup(), prune({ keepLeaves: true }), resample()];
    let ratio = REDUCE;
    const triLimit = triLimits[key] ?? AUTO_TRI_LIMIT;
    if (!ratio && tris > triLimit) ratio = triLimit / tris;
    const reduce = Boolean(ratio && ratio < 1);
    if (reduce) steps.push(dequantize(), weld(), simplifyMesh(ratio));
    steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX_SIZE, TEX_SIZE] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await doc.transform(...steps);
    const trisAfter = triangles(doc);
    const outName = `${key}.glb`;
    const outPath = path.join(OUT_DIR, outName);
    if (!DRY) {
      await io.write(outPath, doc);
      writtenCount++;
    }
    const after = DRY ? 0 : fs.statSync(outPath).size;
    produced.push(outName);
    console.log(`  ✔ ${e.main} → ${outName}  (${kb(before)} → ${DRY ? '?' : kb(after)}, ${num(tris)} tam giác${trisAfter < tris ? ` → còn ${num(trisAfter)}` : ''})`);
    if (reduce && trisAfter > tris * ratio * 1.5) console.log(`  ℹ Chỉ giảm được còn ${num(trisAfter)} tam giác – giảm thêm sẽ làm méo hình.`);
    if (!skins) console.log('  ℹ Mô hình chưa có khung xương – trò chơi tự cho nhân vật nhún nhảy, "thở", lắc lư nhẹ. (Muốn cử động thật: gắn xương bằng Rig/Animate của trang AI rồi tải lại – không bắt buộc.)');
    if (clips.length) console.log(`    Động tác trong tệp: ${clips.join(', ')}`);
    else if (skins) console.log('    (Tệp chính không có động tác – cần thêm tệp động tác như gau-di.glb)');
    if (trisAfter > 40000 && !reduce) console.log('  ⚠ Mô hình khá nặng – nên chọn số đa giác thấp hơn (Remesh ~10.000–20.000) để game chạy mượt trên máy yếu.');

    // Tệp động tác
    const roles = new Set();
    const keepOld = (role) => {
      const on = `${key}@${role}.glb`;
      if (!old.includes(on) || produced.includes(on)) return;
      produced.push(on);
      console.log(`    ℹ Giữ bản cũ ${on}.`);
    };
    for (const a of e.anims) {
      const ap = path.join(IN_DIR, a.file);
      let ad;
      try {
        ad = await io.read(ap);
        ad.setLogger(quiet);
      } catch (err) {
        console.log(`  ✖ Không đọc được ${a.file}: ${err.message}`);
        bad++;
        keepOld(a.role);
        continue;
      }
      const anims = ad.getRoot().listAnimations();
      if (!anims.length) {
        console.log(`  ✖ ${a.file}: tệp không có động tác nào (khi tải hãy chọn kèm Animation).`);
        bad++;
        keepOld(a.role);
        continue;
      }
      if (roles.has(a.role)) console.log(`  ⚠ ${a.file}: trùng động tác "${ROLE_VI[a.role]}" – tệp sau sẽ ghi đè.`);
      roles.add(a.role);
      // Chỉ giữ chuyển động: bỏ lưới, vật liệu, ảnh.
      const root = ad.getRoot();
      for (const n of root.listNodes()) {
        n.setMesh(null);
        n.setSkin(null);
      }
      for (const m of root.listMeshes()) m.dispose();
      for (const s of root.listSkins()) s.dispose();
      for (const m of root.listMaterials()) m.dispose();
      for (const t of root.listTextures()) t.dispose();
      // Nếu tệp có nhiều động tác: giữ động tác hợp tên nhất (vd. "Running" cho chạy), bỏ phần còn lại.
      let keep = anims[0];
      if (anims.length > 1) {
        const hint = ROLE_HINT[a.role];
        keep = (hint && anims.find((an) => hint.test(an.getName()))) || anims[0];
        for (const an of anims) if (an !== keep) an.dispose();
      }
      keep.setName(a.role);
      await ad.transform(prune({ keepLeaves: true }), resample(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
      const on = `${key}@${a.role}.glb`;
      const op = path.join(OUT_DIR, on);
      if (!DRY) {
        await io.write(op, ad);
        writtenCount++;
      }
      if (!produced.includes(on)) produced.push(on);
      console.log(`  ✔ ${a.file} → ${on}  (động tác "${ROLE_VI[a.role]}", ${kb(fs.statSync(ap).size)} → ${DRY ? '?' : kb(fs.statSync(op).size)})`);
    }
    const missing = ['idle', 'walk'].filter((r) => !roles.has(r) && e.mainRole !== r);
    if (skins && missing.length && !clips.length) console.log(`    Gợi ý: thêm động tác ${missing.map((r) => `"${ROLE_VI[r]}"`).join(', ')} để nhân vật sinh động hơn.`);
    done.set(key, [e.main, ...e.anims.map((a) => a.file)]);
  }

  // Tệp cần xóa: của nhân vật bị gỡ (--go), và tệp cũ không còn dùng của nhân vật vừa làm lại (vd. động tác đã bỏ).
  const toDelete = []; // [tệp, lý do]
  const gone = [];
  for (const [key, name] of removeKeys) {
    const files = outBefore.get(key) ?? [];
    if (!files.length && !prevCfg[key] && !prevSources[key]) {
      console.log(`  ℹ --go ${name}: ${label(key)} chưa có mô hình AI nào để gỡ.`);
      continue;
    }
    gone.push(key);
    for (const f of files) toDelete.push([f, `gỡ ${label(key)} theo --go`]);
    if (config[key]) console.log(`  ℹ cau-hinh.json vẫn còn phần cài đặt của ${label(key)} – không sao, phần đó chỉ dùng khi lắp lại mô hình.`);
  }
  for (const key of done.keys()) {
    for (const f of outBefore.get(key) ?? []) if (!produced.includes(f)) toDelete.push([f, 'không còn tệp gốc tương ứng trong mo-hinh-ai']);
  }

  // config.json, danh sách tệp và bảng ghi công: nhân vật vừa làm lại + nhân vật giữ nguyên.
  const keys = [...new Set([...done.keys(), ...kept.keys()])].sort();
  const cfgOut = {};
  const sources = {};
  const credits = [];
  for (const key of keys) {
    // Nhân vật giữ nguyên: ưu tiên cau-hinh.json, không có thì dùng cấu hình lần trước.
    const c = { ...((done.has(key) ? config[key] : (config[key] ?? prevCfg[key])) ?? {}) };
    if (!c.credit) c.credit = 'Mô hình tạo bằng AI';
    cfgOut[key] = c;
    sources[key] = done.get(key) ?? prevSources[key] ?? [];
    credits.push(`| ${label(key)} | ${key} | ${c.credit} | ${sources[key].join(', ') || '–'} |`);
  }
  const files = [...produced, ...[...kept.values()].flat()].sort();
  if (!DRY) for (const [f] of toDelete) fs.rmSync(path.join(OUT_DIR, f), { force: true });
  if (!DRY && (keys.length || hadState)) {
    fs.writeFileSync(path.join(OUT_DIR, 'config.json'), JSON.stringify(cfgOut, null, 2) + '\n', 'utf8');
    const manifest = { note: 'Danh sách tệp do tools/xu-ly-mo-hinh.mjs tạo – đừng sửa tay.', files, nguon: sources };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    const md = [
      '# Ghi công mô hình AI',
      '',
      'Tệp này do `tools/xu-ly-mo-hinh.mjs` tạo tự động.',
      '',
      '| Nhân vật | Khóa | Nguồn / giấy phép | Tệp gốc |',
      '|---|---|---|---|',
      ...credits,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'GHI-CONG.md'), md, 'utf8');
  }
  if (toDelete.length || gone.length) console.log('');
  for (const [f, why] of toDelete) console.log(`  🗑 ${DRY ? 'Sẽ xóa' : 'Đã xóa'} ${f} (${why}).`);
  for (const key of gone) console.log(`  ✔ ${DRY ? 'Sẽ gỡ' : 'Đã gỡ'} mô hình AI của ${label(key)} – trò chơi dùng lại nhân vật có sẵn.`);

  console.log('');
  if (DRY) console.log('Chế độ xem thử (--xem): chưa ghi hay xóa tệp nào.');
  const rel = path.relative(ROOT, OUT_DIR);
  const shownOut = rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : OUT_DIR;
  const summary = [`${done.size} nhân vật ${DRY ? 'sẽ được' : 'được'} cập nhật`];
  if (kept.size) summary.push(`${kept.size} giữ nguyên`);
  if (gone.length) summary.push(`${gone.length} được gỡ`);
  console.log(`Xong: ${summary.join(', ')}; ${writtenCount} tệp .glb đã ghi${bad ? `, ${bad} lỗi` : ''}. Thư mục kết quả: ${shownOut}`);
  if (bad) process.exitCode = 1;
}

main().catch((e) => {
  console.error('✖ Lỗi:', e);
  process.exit(1);
});
