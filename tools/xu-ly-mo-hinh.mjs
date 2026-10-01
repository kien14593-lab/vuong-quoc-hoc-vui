#!/usr/bin/env node
/**
 * Xử lý mô hình AI (Meshy, Tripo...) cho game Vương Quốc Toán Học.
 *
 *   node tools/xu-ly-mo-hinh.mjs            (hoặc nhấp đúp CapNhatMoHinh.bat)
 *
 * 1. Đọc mọi tệp .glb trong thư mục mo-hinh-ai/  (vd. gau.glb, gau-di.glb, gau@vay-tay.glb)
 * 2. Nhận tên nhân vật + động tác theo bảng src/assets/models/ai-names.json (tiếng Việt không dấu cũng được)
 * 3. Tối ưu: thu nhỏ ảnh (webp 1024), nén lưới (meshopt), bỏ dữ liệu thừa; tệp động tác chỉ giữ phần chuyển động
 * 4. Ghi vào src/assets/models/ai/<khóa>.glb, <khóa>@<động tác>.glb  +  config.json (từ mo-hinh-ai/cau-hinh.json)
 *
 * Tùy chọn: --anh 2048 (cỡ ảnh tối đa), --giam 0.5 (giảm số tam giác còn 50%), --xem (chỉ xem, không ghi),
 *           --vao <thư mục> --ra <thư mục> (đổi thư mục vào/ra – dùng để thử nghiệm)
 */
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, simplify, textureCompress, weld } from '@gltf-transform/functions';
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
};

/* ------------------------------------------------------------------ */
/* Tham số dòng lệnh                                                    */
/* ------------------------------------------------------------------ */
const TEX_SIZE = Number(arg('anh', 1024)) || 1024;
const REDUCE = arg('giam', null) === null ? null : Number(arg('giam'));
const DRY = arg('xem', false) === true;
const AUTO_TRI_LIMIT = 60000;

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
      else if (sk === 'di-tai-cho' || k === 'inPlace') o.inPlace = Boolean(v);
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
  return { out, warn };
}

/* ------------------------------------------------------------------ */
/* Xử lý                                                                */
/* ------------------------------------------------------------------ */
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

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

async function main() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const quiet = new Logger(Logger.Verbosity.ERROR);
  io.setLogger(quiet);

  console.log('');
  console.log('=== XỬ LÝ MÔ HÌNH AI – Vương Quốc Toán Học ===');
  if (!fs.existsSync(IN_DIR)) fs.mkdirSync(IN_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const all = fs.readdirSync(IN_DIR).filter((f) => !f.startsWith('.'));
  const glbs = all.filter((f) => /\.glb$/i.test(f));
  const others = all.filter((f) => /\.(fbx|obj|gltf|blend|usdz|stl|zip)$/i.test(f));
  for (const f of others) {
    console.log(`  ⚠ ${f}: game chỉ dùng định dạng GLB. Hãy tải lại mô hình ở dạng .glb (hoặc giải nén tệp .zip).`);
  }
  if (!glbs.length) {
    console.log(`  Chưa có tệp .glb nào trong thư mục: ${IN_DIR}`);
    console.log('  Xem hướng dẫn: HUONG-DAN-MO-HINH-AI.md');
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
  const { out: config, warn: cfgWarn } = convertConfig(cfgRaw);
  cfgWarn.forEach((w) => console.log('  ⚠ ' + w));

  // Gom theo nhân vật
  const plan = new Map(); // key -> { main?: file, anims: [{file, role}] }
  let bad = 0;
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
      console.log(`  ⚠ ${f}: đã có tệp chính "${e.main}" cho ${KEY_VI[p.key] ?? p.key} – bỏ qua tệp này.`);
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
    console.log(`  ℹ ${KEY_VI[key] ?? key}: không có tệp chính – dùng "${pick.file}" làm mô hình chính.`);
  }

  const written = [];
  const credits = [];
  for (const [key, e] of plan) {
    const label = KEY_VI[key] ?? key;
    console.log('');
    console.log(`▶ ${label} (${key})`);
    // Tệp chính
    const srcPath = path.join(IN_DIR, e.main);
    let doc;
    try {
      doc = await io.read(srcPath);
      doc.setLogger(quiet);
    } catch (err) {
      console.log(`  ✖ Không đọc được ${e.main}: ${err.message}`);
      bad++;
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
    if (!ratio && tris > AUTO_TRI_LIMIT) ratio = Math.max(0.15, AUTO_TRI_LIMIT / tris);
    if (ratio && ratio < 1) steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }));
    steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX_SIZE, TEX_SIZE] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await doc.transform(...steps);
    const outName = `${key}.glb`;
    const outPath = path.join(OUT_DIR, outName);
    if (!DRY) await io.write(outPath, doc);
    const after = DRY ? 0 : fs.statSync(outPath).size;
    written.push(outName);
    console.log(`  ✔ ${e.main} → ${outName}  (${kb(before)} → ${DRY ? '?' : kb(after)}, ${tris.toLocaleString('vi-VN')} tam giác${ratio && ratio < 1 ? ` → còn ~${Math.round(tris * ratio).toLocaleString('vi-VN')}` : ''})`);
    if (!skins) console.log('  ⚠ Mô hình CHƯA có khung xương (chưa "Rig") – nhân vật sẽ chỉ nhún nhảy đơn giản. Hãy dùng chức năng Rig/Animate rồi tải lại.');
    if (clips.length) console.log(`    Động tác trong tệp: ${clips.join(', ')}`);
    else if (skins) console.log('    (Tệp chính không có động tác – cần thêm tệp động tác như gau-di.glb)');
    if (tris > 40000 && !(ratio && ratio < 1)) console.log('  ⚠ Mô hình khá nặng – nên chọn số đa giác thấp hơn (Remesh ~10.000–20.000) để game chạy mượt trên máy yếu.');

    // Tệp động tác
    const roles = new Set();
    for (const a of e.anims) {
      const ap = path.join(IN_DIR, a.file);
      let ad;
      try {
        ad = await io.read(ap);
        ad.setLogger(quiet);
      } catch (err) {
        console.log(`  ✖ Không đọc được ${a.file}: ${err.message}`);
        bad++;
        continue;
      }
      const anims = ad.getRoot().listAnimations();
      if (!anims.length) {
        console.log(`  ✖ ${a.file}: tệp không có động tác nào (khi tải hãy chọn kèm Animation).`);
        bad++;
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
      if (!DRY) await io.write(op, ad);
      written.push(on);
      console.log(`  ✔ ${a.file} → ${on}  (động tác "${ROLE_VI[a.role]}", ${kb(fs.statSync(ap).size)} → ${DRY ? '?' : kb(fs.statSync(op).size)})`);
    }
    const missing = ['idle', 'walk'].filter((r) => !roles.has(r) && e.mainRole !== r);
    if (skins && missing.length && !clips.length) console.log(`    Gợi ý: thêm động tác ${missing.map((r) => `"${ROLE_VI[r]}"`).join(', ')} để nhân vật sinh động hơn.`);
    credits.push(`| ${label} | ${key} | ${config[key]?.credit ?? 'Mô hình tạo bằng AI'} | ${[e.main, ...e.anims.map((a) => a.file)].join(', ')} |`);
  }

  // Xóa tệp cũ do công cụ tạo ra nhưng không còn tệp gốc
  let old = [];
  try {
    old = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).files ?? [];
  } catch {
    old = [];
  }
  const removed = old.filter((f) => !written.includes(f) && fs.existsSync(path.join(OUT_DIR, f)));
  if (!DRY) {
    for (const f of removed) fs.unlinkSync(path.join(OUT_DIR, f));
    const keys = new Set([...plan.keys()]);
    const cfgOut = Object.fromEntries(Object.entries(config).filter(([k]) => keys.has(k)));
    for (const k of keys) {
      if (!cfgOut[k]) cfgOut[k] = {};
      if (!cfgOut[k].credit) cfgOut[k].credit = 'Mô hình tạo bằng AI';
    }
    fs.writeFileSync(path.join(OUT_DIR, 'config.json'), JSON.stringify(cfgOut, null, 2) + '\n', 'utf8');
    fs.writeFileSync(MANIFEST, JSON.stringify({ note: 'Danh sách tệp do tools/xu-ly-mo-hinh.mjs tạo – đừng sửa tay.', files: written }, null, 2) + '\n', 'utf8');
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
  for (const f of removed) console.log(`  🗑 Đã xóa ${f} (không còn tệp gốc trong mo-hinh-ai).`);

  console.log('');
  if (DRY) console.log('Chế độ xem thử (--xem): chưa ghi tệp nào.');
  console.log(`Xong: ${plan.size} nhân vật, ${written.length} tệp${bad ? `, ${bad} lỗi` : ''}. Thư mục kết quả: src\\assets\\models\\ai`);
  if (bad) process.exitCode = 1;
}

main().catch((e) => {
  console.error('✖ Lỗi:', e);
  process.exit(1);
});
