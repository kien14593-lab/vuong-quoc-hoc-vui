#!/usr/bin/env node
/**
 * Xử lý mô hình AI (Tencent HY 3D, Meshy, Tripo...) cho game Vương Quốc Học Vui.
 *
 *   node tools/xu-ly-mo-hinh.mjs            (hoặc nhấp đúp CapNhatMoHinh.bat)
 *
 * 1. Đọc mọi tệp .glb trong thư mục mo-hinh-ai/  (vd. gau.glb, gau-di.glb, gau@vay-tay.glb)
 * 2. Nhận tên nhân vật + động tác theo bảng src/assets/models/ai-names.json (tiếng Việt không dấu cũng được)
 * 3. Tối ưu: thu nhỏ ảnh (webp 1024; riêng từng nhân vật: "anh"), lưới quá dày (> 60.000 tam giác, vd. 1,5 triệu
 *    của HY 3D) tự giảm còn ~60.000 tam giác (riêng từng nhân vật: "tam-giac" trong cau-hinh.json), nén lưới
 *    (meshopt, hướng mặt 8 bit), bỏ dữ liệu thừa (vật liệu "mem"/"hoat-hinh": bỏ ảnh kim loại/độ nhám và ảnh che
 *    sáng – game không dùng); tô kín khe giữa các mảnh ảnh trước và sau khi giảm (hết vệt lưới xám mảnh trên mô hình
 *    HY 3D; tắt riêng: "sua-vet-nut": false); tệp động tác chỉ giữ phần chuyển động
 * 4. Ghi vào src/assets/models/ai/<khóa>.glb, <khóa>@<động tác>.glb  +  config.json (từ mo-hinh-ai/cau-hinh.json),
 *    GHI-CONG.md (bảng ghi công) và .tao-tu-dong.txt (danh sách tệp do công cụ tạo)
 *
 * Bé (nhân vật chính): be-trai.glb, be-gai.glb (mặc đồ thường ngày); bộ đồ: be-trai-<bộ đồ>.glb, be-gai-<bộ đồ>.glb
 * (vd. be-trai-the-thao.glb → player_trai__the_thao). Tên, giá, biểu tượng của bộ đồ ghi trong mục "bo-do" của
 * cau-hinh.json (không ghi thì dùng mặc định). Bé được dò xương sẵn (tools/xuong-tu-dong.mjs) để đi bằng chân;
 * kết luận "đi bằng chân" hay "nhún" in ra ngay khi xử lý.
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
import { ghiDuoc, ghiTrongSo, luoiDeDo, napTs, napXuong } from './xuong-tu-dong.mjs';

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
  npc_villager: 'Dân làng', player_trai: 'Bé trai', player_gai: 'Bé gái',
  pet_dog: 'Cún con', pet_cat: 'Mèo mướp con', pet_rabbit: 'Thỏ con', pet_panda: 'Gấu trúc con', pet_fox: 'Cáo con',
  pet_penguin: 'Chim cánh cụt con', pet_dino: 'Khủng long tí hon',
  animal_giraffe: 'Hươu cao cổ', animal_monkey: 'Khỉ', animal_penguin: 'Chim cánh cụt (Sở Thú)', animal_zebra: 'Ngựa vằn',
  animal_hippo: 'Hà mã', animal_lion: 'Sư tử',
};

/* ------------------------------------------------------------------ */
/* Bé (nhân vật chính) và bộ đồ                                         */
/* ------------------------------------------------------------------ */
/** Khóa của bé trai, bé gái (be-trai.glb, be-gai.glb – mặc đồ thường ngày). */
const KIDS = ['player_trai', 'player_gai'];
/** Khóa bộ đồ: <khóa bé>__<mã bộ đồ>, vd. be-trai-the-thao.glb → player_trai__the_thao. */
const OUTFIT_SEP = '__';
/** Bộ đồ chưa ghi giá trong cau-hinh.json. */
const OUTFIT_PRICE = 60;
const OUTFIT_ICON = '👕';
/** Tên, biểu tượng có sẵn của các bộ đồ hay gặp (dùng khi tên tệp viết không dấu và cau-hinh.json chưa ghi tên). */
const OUTFIT_KNOWN = {
  the_thao: ['Đồ thể thao', '⚽'],
  phi_hanh_gia: ['Đồ phi hành gia', '🚀'],
  hiep_si: ['Đồ hiệp sĩ', '🛡️'],
  hiep_si_nho: ['Đồ hiệp sĩ nhỏ', '🛡️'],
  vay_cong_chua: ['Váy công chúa', '👑'],
  cong_chua: ['Váy công chúa', '👑'],
  sieu_nhan: ['Đồ siêu nhân', '🦸'],
  do_ngu: ['Đồ ngủ', '🌙'],
  ngu: ['Đồ ngủ', '🌙'],
  boi: ['Đồ bơi', '🩱'],
  mua_dong: ['Đồ mùa đông', '🧣'],
  ao_dai: ['Áo dài', '👗'],
};
/** Biểu tượng đoán theo từ trong mã bộ đồ. */
const OUTFIT_ICON_HINT = [
  [/_vay_|_dam_/, '👗'],
  [/_the_thao_|_bong_da_/, '⚽'],
  [/_phi_hanh_|_vu_tru_/, '🚀'],
  [/_hiep_si_/, '🛡️'],
  [/_cong_chua_|_hoang_tu_|_vua_/, '👑'],
  [/_mua_dong_|_len_/, '🧣'],
];
const isKidKey = (key) => KIDS.includes(String(key).split(OUTFIT_SEP)[0]);

/** "Đồ thể thao", "bo-do-the-thao", "do_the_thao" → "the_thao"; đồ thường ngày → '' (bé mặc đồ mặc định). */
function outfitId(name) {
  const s = slug(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(bo_do|do)_(?=.)/, '');
  return ['thuong_ngay', 'mac_dinh', 'binh_thuong', 'hang_ngay'].includes(s) ? '' : s;
}

/**
 * Tên tệp/tên trong cấu hình của bé: "be-trai" → { key: 'player_trai' }; "be-gai-the-thao", "Bé gái – Đồ thể thao"
 * → { key: 'player_gai__the_thao', kid: 'player_gai', outfit: 'the_thao', text: 'Đồ thể thao' }. Phần sau tên bé luôn
 * là bộ đồ (không phải động tác). null nếu không phải bé.
 */
function kidOf(name) {
  // NFC: tên gõ kiểu "Unicode tổ hợp" (dấu tách rời) vẫn giữ được chữ có dấu làm tên bộ đồ.
  const base = String(name).normalize('NFC').replace(/\.(glb|gltf)$/i, '');
  const parts = slug(base).split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = parts.length; i > 0; i--) {
    const kid = keyOf(parts.slice(0, i).join('-'));
    if (!KIDS.includes(kid)) continue;
    const rest = parts.slice(i).join('-');
    const outfit = rest ? outfitId(rest) : '';
    const words = base
      .replace(/\(\d+\)/g, ' ')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    const text = (words.length === parts.length ? words : parts).slice(i).join(' ');
    return { key: outfit ? kid + OUTFIT_SEP + outfit : kid, kid, outfit, text };
  }
  return null;
}

/** Tên nhân vật (kể cả bé + bộ đồ) → khóa. */
const resolveKey = (name) => kidOf(name)?.key ?? keyOf(name);

/** Tên, giá, biểu tượng mặc định của bộ đồ (từ tên tệp có dấu, hoặc bảng có sẵn). named = tên đã đẹp (có dấu). */
function outfitDefaults(id, text) {
  const known = OUTFIT_KNOWN[id];
  const t = String(text ?? '').trim();
  const accented = t !== '' && t.toLowerCase() !== slug(t).replace(/-/g, ' ');
  const cap = (s) => s.charAt(0).toLocaleUpperCase('vi') + s.slice(1);
  const name = accented
    ? /^(đồ|bộ|váy|áo|quần|đầm)(\s|$)/i.test(t)
      ? cap(t)
      : `Đồ ${t}`
    : (known?.[0] ?? `Đồ ${id.replace(/_/g, ' ')}`);
  const hint = OUTFIT_ICON_HINT.find(([rx]) => rx.test(`_${id}_`));
  return { name, price: OUTFIT_PRICE, icon: known?.[1] ?? hint?.[1] ?? OUTFIT_ICON, level: 1, named: accented || Boolean(known) };
}

/* ------------------------------------------------------------------ */
/* Tham số dòng lệnh                                                    */
/* ------------------------------------------------------------------ */
const TEX_SIZE = Number(arg('anh', 1024)) || 1024;
/** --anh trên dòng lệnh thắng "anh" riêng trong cau-hinh.json (như --giam thắng "tam-giac"). */
const TEX_CLI = arg('anh', null) !== null;
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

/** "gau@di", "gau-di", "chu-gau-vay-tay", "Gấu đi" → { key: 'npc_bear', role: 'walk' }; "be-trai-the-thao" → bộ đồ của bé. */
function parseName(file) {
  const base = file.replace(/\.(glb|gltf)$/i, '');
  const at = base.indexOf('@');
  if (at > 0) {
    const key = resolveKey(base.slice(0, at));
    const role = roleOf(base.slice(at + 1));
    return { key, role, roleText: base.slice(at + 1), explicit: true };
  }
  const kid = kidOf(base);
  if (kid) return { key: kid.key, role: null, kid };
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

/** Mục "bo-do" của cau-hinh.json: { "the-thao": { "ten": "Đồ thể thao", "gia": 60, "bieu-tuong": "⚽" } } hoặc "the-thao": "Đồ thể thao". */
function convertOutfits(raw, warn) {
  const out = {};
  for (const [name, c] of Object.entries(raw ?? {})) {
    if (name.startsWith('_')) continue;
    const id = outfitId(name);
    if (!id) {
      warn.push(`cau-hinh.json: "bo-do" – "${name}" là đồ thường ngày (luôn miễn phí, không cần cài) – bỏ qua.`);
      continue;
    }
    const m = {};
    const entries = typeof c === 'string' ? [['ten', c]] : Object.entries(c ?? {});
    for (const [k, v] of entries) {
      const sk = slug(k);
      if (sk === 'ten' || k === 'name') m.name = String(v).trim();
      else if (sk === 'gia' || k === 'price') {
        const n = Math.round(Number(v));
        if (Number.isFinite(n) && n >= 0) m.price = n;
        else warn.push(`cau-hinh.json: bộ đồ "${name}" – giá "${v}" không hợp lệ (ghi số xu, vd. 60).`);
      } else if (sk === 'bieu-tuong' || sk === 'hinh' || k === 'icon') m.icon = String(v).trim();
      else if (sk === 'cap' || sk === 'cap-do' || k === 'level') {
        const n = Math.round(Number(v));
        if (Number.isFinite(n) && n >= 1) m.level = n;
        else warn.push(`cau-hinh.json: bộ đồ "${name}" – cấp "${v}" không hợp lệ (ghi số, vd. 1).`);
      } else warn.push(`cau-hinh.json: bộ đồ "${name}" – không hiểu mục "${k}" (dùng: ten, gia, bieu-tuong, cap).`);
    }
    if (m.icon !== undefined && !okIcon(m.icon)) {
      warn.push(`cau-hinh.json: bộ đồ "${name}" – biểu tượng "${m.icon}" không dùng được (cần đúng 1 emoji hiện được trên Windows 10) – tạm dùng biểu tượng mặc định.`);
      delete m.icon;
    }
    if (m.name !== undefined) {
      const clean = stripEmoji(m.name);
      if (clean !== m.name) warn.push(`cau-hinh.json: bộ đồ "${name}" – tên có emoji không hiện được trên Windows 10, đã bỏ: "${clean}".`);
      if (clean) m.name = clean;
      else delete m.name;
    }
    out[id] = { ...out[id], ...m };
  }
  return out;
}

function convertConfig(raw) {
  const out = {};
  /** Khóa → số tam giác tối đa riêng ("tam-giac"). Chỉ dùng lúc giảm lưới, không ghi vào config.json của game. */
  const tris = {};
  /** Khóa → cỡ ảnh tối đa riêng ("anh", px) và tắt sửa vệt nứt ("sua-vet-nut": false). Chỉ dùng lúc xử lý, không ghi vào config.json. */
  const texs = {};
  const seams = {};
  const warn = [];
  let outfits = {};
  for (const [name, c] of Object.entries(raw ?? {})) {
    if (name.startsWith('_')) continue;
    if (['bo-do', 'outfits'].includes(slug(name))) {
      outfits = { ...outfits, ...convertOutfits(c, warn) };
      continue;
    }
    const key = resolveKey(name);
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
      } else if (sk === 'anh' || k === 'texture') {
        const n = Math.round(Number(v));
        if (n >= 64 && n <= 8192) texs[key] = n;
        else warn.push(`cau-hinh.json: "${name}" – "anh" phải là cỡ ảnh từ 64 đến 8192 (vd. 512) – bỏ qua.`);
      } else if (sk === 'sua-vet-nut' || k === 'fixSeams') {
        if (typeof v === 'boolean') seams[key] = v;
        else warn.push(`cau-hinh.json: "${name}" – "sua-vet-nut" chỉ nhận true hoặc false – bỏ qua.`);
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
      } else if (sk === 'gan-do' || k === 'dress') {
        // Chỗ gắn mũ/kính ("dau") và balo/khăn ("than") của bé: [dịch ngang, lên, ra trước (mét), phóng to].
        const d = {};
        for (const [part, arr] of Object.entries(v ?? {})) {
          const sp = slug(part);
          const slot = sp === 'dau' || part === 'head' ? 'head' : sp === 'than' || part === 'body' ? 'body' : null;
          const nums = Array.isArray(arr) ? arr.map(Number) : [];
          if (slot && nums.length >= 3 && nums.length <= 4 && nums.every(Number.isFinite)) d[slot] = nums;
          else warn.push(`cau-hinh.json: "${name}" – "gan-do": "${part}" không hợp lệ (vd. "dau": [0, 0.02, 0, 1.05] = dịch ngang, lên, ra trước (mét), phóng to).`);
        }
        if (Object.keys(d).length) o.dress = d;
      } else warn.push(`cau-hinh.json: "${name}" – không hiểu mục "${k}" (bỏ qua).`);
    }
    out[key] = { ...out[key], ...o };
  }
  return { out, outfits, tris, texs, seams, warn };
}

/* ------------------------------------------------------------------ */
/* Xử lý                                                                */
/* ------------------------------------------------------------------ */
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const num = (n) => n.toLocaleString('vi-VN');
/** Tên bộ đồ theo mã (để báo cáo: "Bé trai – Đồ thể thao"). */
const OUTFIT_LABEL = new Map();
const label = (key) => {
  const [kid, outfit] = String(key).split(OUTFIT_SEP);
  if (outfit && KIDS.includes(kid)) return `${KEY_VI[kid]} – ${OUTFIT_LABEL.get(outfit) ?? outfit}`;
  return KEY_VI[key] ?? key;
};
/** Cấu hình bộ đồ thừa hưởng từ bé (ghi đè được bằng mục "be-trai-<bộ đồ>" trong cau-hinh.json). */
const KID_INHERIT = ['height', 'rotY', 'scale', 'offset', 'material', 'credit', 'dress'];

/** Bỏ emoji không hiện được trên Windows 10 (≤ Emoji 12.0, quy tắc của tests/emoji12.ts). */
let emojiIssues = () => [];
const stripEmoji = (text) => {
  const issues = emojiIssues(text);
  if (!issues.length) return text;
  const drop = new Set();
  for (const e of issues) for (let i = 0; i < Array.from(e.text).length; i++) drop.add(e.at + i);
  return Array.from(text)
    .filter((_, i) => !drop.has(i))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
};
/** Biểu tượng bộ đồ: đúng một emoji hiện được trên Windows 10. */
const okIcon = (s) => /\p{Extended_Pictographic}/u.test(s) && Array.from(s).length <= 4 && !emojiIssues(s).length;

/** Dò xương cho bé (tư thế chữ A) ngay trong công cụ: ghi trọng số da vào lưới, in kết luận đi bằng chân hay nhún. */
async function bakeKid(doc, rotY) {
  const rig = await napXuong();
  const ds = luoiDeDo(doc, rotY);
  if (!ghiDuoc(ds)) {
    console.log('  ℹ Không lưu sẵn xương được (lưới dùng chung nhiều chỗ) – trò chơi sẽ tự dò khi nạp.');
    return null;
  }
  const res = rig.autoRig(ds.map((x) => x.input));
  const verdict = rig.rigReport(res);
  if (verdict.walk) ghiTrongSo(doc, ds, res);
  if (verdict.walk && !verdict.lines.length) console.log(`  🚶 Dáng đi: ĐI BẰNG CHÂN (xương tự dựng, dò trong ${Math.round(res.ms)} ms).`);
  else if (verdict.walk) console.log('  🚶 Dáng đi: ĐI BẰNG CHÂN (xương tự dựng) – nhưng có điều nên xem lại:');
  else console.log('  ⚠ Dáng đi: NHÚN NHẢY – bé vẫn chơi được nhưng không bước chân, vì:');
  for (const l of verdict.lines) console.log(`     • ${l}`);
  if (verdict.lines.length) console.log('     (Xem hình: node tools/kiem-tra-xuong.mjs <tệp>.glb – hoặc tạo lại ảnh theo hướng dẫn tư thế chữ A.)');
  return rig.bakeRig(res, rotY);
}
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

/**
 * Vật liệu "mem"/"hoat-hinh": game vẽ bằng Lambert/Toon (src/models/glb.ts convertMaterial), không dùng ảnh kim
 * loại/độ nhám và ảnh che sáng → bỏ hai ảnh đó (nhìn y hệt, tệp nhẹ hơn). Hệ số kim loại về 0 để game vẫn chọn đúng
 * kiểu vẽ như khi còn ảnh (Phong chỉ dùng khi kim loại > 0.5 mà không có ảnh kim loại). Trả về số ảnh đã bỏ.
 */
function dropUnusedPbr(doc) {
  let n = 0;
  for (const mat of doc.getRoot().listMaterials()) {
    if (mat.getMetallicRoughnessTexture()) {
      mat.setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(1);
      n++;
    }
    if (mat.getOcclusionTexture()) {
      mat.setOcclusionTexture(null);
      n++;
    }
  }
  return n;
}

/** Tệp .glb (đã lắp) còn ảnh kim loại/độ nhám không – chỉ đọc phần JSON. null = không đọc được. */
function glbHasMr(p) {
  try {
    const b = fs.readFileSync(p);
    if (b.readUInt32LE(0) !== 0x46546c67) return null;
    const j = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    return (j.materials ?? []).some((m) => m.pbrMetallicRoughness?.metallicRoughnessTexture);
  } catch {
    return null;
  }
}

/**
 * Sửa vệt nứt ("sua-vet-nut", bật sẵn): ảnh của HY 3D có khe tối/mờ giữa các mảnh ảnh (đảo UV); sau khi giảm lưới
 * và thu nhỏ ảnh, mép mảnh lấy nhầm màu khe → vệt lưới xám mảnh trên mô hình. Mọi điểm ảnh nằm ngoài tất cả tam giác
 * UV (của mọi lưới dùng ảnh đó) được tô bằng màu của điểm ảnh gần nhất nằm trong mảnh; điểm ảnh trong mảnh giữ
 * nguyên từng byte. Chạy trên ảnh gốc và ghi lại PNG (không mất dữ liệu). Trả về số ảnh đã sửa.
 * Gọi 2 lần: trước khi giảm lưới (theo mọi tam giác gốc) và sau khi giảm (theo tam giác còn lại; quiet: không báo lại).
 */
async function padUvGaps(doc, { quiet = false } = {}) {
  const users = new Map(); // ảnh → [{ prim, tc }]
  const why = new Map(); // ảnh → lý do không sửa được an toàn
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (!mat) continue;
      const slots = [
        [mat.getBaseColorTexture(), mat.getBaseColorTextureInfo()],
        [mat.getNormalTexture(), mat.getNormalTextureInfo()],
        [mat.getMetallicRoughnessTexture(), mat.getMetallicRoughnessTextureInfo()],
        [mat.getOcclusionTexture(), mat.getOcclusionTextureInfo()],
        [mat.getEmissiveTexture(), mat.getEmissiveTextureInfo()],
      ];
      for (const [tex, info] of slots) {
        if (!tex) continue;
        if (!users.has(tex)) users.set(tex, []);
        users.get(tex).push({ prim, tc: info?.getTexCoord() ?? 0 });
        if (info?.getExtension('KHR_texture_transform')) why.set(tex, 'có KHR_texture_transform');
        else if (prim.getMode() !== 4) why.set(tex, 'lưới không phải tam giác');
      }
    }
  }
  // Điểm ảnh có ô vuông chạm ít nhất một tam giác UV (tọa độ tâm điểm ảnh); null = có UV ngoài 0..1 (ảnh lặp).
  const coverage = (list, W, H) => {
    const mask = new Uint8Array(W * H);
    for (const { prim, tc } of list) {
      const a = prim.getAttribute(`TEXCOORD_${tc}`);
      if (!a) continue;
      const uv = new Float64Array(a.getCount() * 2);
      const el = [];
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, el);
        if (!(el[0] >= -1e-3 && el[0] <= 1 + 1e-3 && el[1] >= -1e-3 && el[1] <= 1 + 1e-3)) return null;
        uv[2 * i] = el[0] * W - 0.5;
        uv[2 * i + 1] = el[1] * H - 0.5;
      }
      const idx = prim.getIndices()?.getArray();
      const n = idx ? idx.length : a.getCount();
      for (let t = 0; t + 2 < n; t += 3) {
        const i0 = 2 * (idx ? idx[t] : t);
        const i1 = 2 * (idx ? idx[t + 1] : t + 1);
        const i2 = 2 * (idx ? idx[t + 2] : t + 2);
        const x0 = uv[i0];
        const y0 = uv[i0 + 1];
        const x1 = uv[i1];
        const y1 = uv[i1 + 1];
        const x2 = uv[i2];
        const y2 = uv[i2 + 1];
        const s = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0) >= 0 ? 1 : -1;
        // Nới mỗi cạnh nửa ô điểm ảnh (chuẩn L1) để nhận cả điểm ảnh chỉ chạm mép tam giác.
        const m0 = 0.5 * (Math.abs(x1 - x0) + Math.abs(y1 - y0));
        const m1 = 0.5 * (Math.abs(x2 - x1) + Math.abs(y2 - y1));
        const m2 = 0.5 * (Math.abs(x0 - x2) + Math.abs(y0 - y2));
        const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2) + 0.5));
        const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2) + 0.5));
        for (let y = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 0.5)); y <= maxY; y++) {
          for (let x = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 0.5)); x <= maxX; x++) {
            if (s * ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)) < -m0) continue;
            if (s * ((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) < -m1) continue;
            if (s * ((x0 - x2) * (y - y2) - (y0 - y2) * (x - x2)) < -m2) continue;
            mask[y * W + x] = 1;
          }
        }
      }
    }
    return mask;
  };
  const ids = new Map(); // lưới → số thứ tự: bộ nhớ đệm theo đúng đối tượng lưới + bộ UV + cỡ ảnh, không theo tên
  const masks = new Map();
  let fixed = 0;
  for (const [tex, list] of users) {
    const name = tex.getName() || tex.getURI() || `ảnh số ${doc.getRoot().listTextures().indexOf(tex) + 1}`;
    const skip = (reason) => quiet || console.log(`  ⚠ Sửa vệt nứt: bỏ qua ${name} (${reason}).`);
    if (why.has(tex)) {
      skip(why.get(tex));
      continue;
    }
    if (tex.listParents().some((p) => p.propertyType !== 'Root' && p.propertyType !== 'Material')) {
      skip('ảnh còn dùng ở phần mở rộng của vật liệu');
      continue;
    }
    let img;
    try {
      img = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
    } catch {
      skip('không đọc được ảnh');
      continue;
    }
    const { data, info } = img;
    const W = info.width;
    const H = info.height;
    const ch = info.channels;
    for (const u of list) if (!ids.has(u.prim)) ids.set(u.prim, ids.size);
    const mk = `${W}x${H}|${list.map((u) => `${ids.get(u.prim)}:${u.tc}`).join(',')}`;
    if (!masks.has(mk)) masks.set(mk, coverage(list, W, H));
    const mask = masks.get(mk);
    if (!mask) {
      skip('UV nằm ngoài 0..1');
      continue;
    }
    // Loang từ mọi điểm ảnh trong mảnh ra ngoài (theo 4 hướng): điểm ảnh ngoài nhận màu điểm gần nhất.
    const N = W * H;
    const seen = new Uint8Array(N);
    const q = new Int32Array(N);
    let qt = 0;
    for (let i = 0; i < N; i++) {
      if (!mask[i]) continue;
      seen[i] = 1;
      q[qt++] = i;
    }
    if (!qt || qt === N) continue;
    const go = (k, j) => {
      if (seen[k]) return;
      seen[k] = 1;
      data.copyWithin(k * ch, j * ch, j * ch + ch);
      q[qt++] = k;
    };
    for (let qh = 0; qh < qt; qh++) {
      const j = q[qh];
      const x = j % W;
      if (x > 0) go(j - 1, j);
      if (x < W - 1) go(j + 1, j);
      if (j >= W) go(j - W, j);
      if (j < N - W) go(j + W, j);
    }
    const png = await sharp(data, { raw: { width: W, height: H, channels: ch } }).png({ compressionLevel: 3 }).toBuffer();
    tex.setImage(new Uint8Array(png)).setMimeType('image/png');
    fixed++;
  }
  return fixed;
}

async function main() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const quiet = new Logger(Logger.Verbosity.ERROR);
  io.setLogger(quiet);
  try {
    ({ emojiIssues } = await napTs(path.join(ROOT, 'tests', 'emoji12.ts')));
  } catch {
    /* thiếu tệp quy tắc emoji: bỏ qua bước kiểm tra biểu tượng */
  }

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
    const key = name ? resolveKey(path.basename(name).replace(/\.(glb|gltf)$/i, '')) : null;
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
  const { out: config, outfits: outfitCfg, tris: triLimits, texs: texSizes, seams: seamFix, warn: cfgWarn } = convertConfig(cfgRaw);
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
    } else {
      e.main = f;
      if (p.kid?.outfit && /^(v?\d+|moi|cu|new|old|final|copy|ban_sao|lan_\d+)$/.test(p.kid.outfit)) {
        const base = p.kid.kid === 'player_trai' ? 'be-trai.glb' : 'be-gai.glb';
        console.log(`  ⚠ ${f}: được hiểu là BỘ ĐỒ "${p.kid.outfit}" của ${KEY_VI[p.kid.kid]}. Nếu đây là bé mặc đồ thường ngày, hãy đổi tên tệp thành ${base}.`);
      }
    }
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
  }

  // Bộ đồ: tên, giá, biểu tượng chung cho cả hai bé (cau-hinh.json mục "bo-do" > tên tệp có dấu > bảng có sẵn).
  const allKeys = new Set([...plan.keys(), ...kept.keys()]);
  const outfitMeta = new Map(); // mã bộ đồ -> { id, name, price, icon, level }
  for (const key of removeKeys.keys()) {
    const m = prevCfg[key]?.outfit;
    if (m?.id && m.name) OUTFIT_LABEL.set(m.id, m.name);
  }
  {
    const cand = new Map();
    const noBase = new Set();
    for (const key of [...allKeys].sort()) {
      const [kid, id] = key.split(OUTFIT_SEP);
      if (!id || !KIDS.includes(kid)) continue;
      const src = plan.get(key)?.main ?? (prevSources[key] ?? [])[0];
      const d = outfitDefaults(id, src ? (kidOf(path.basename(src))?.text ?? '') : '');
      const cur = cand.get(id);
      if (!cur || (!cur.named && d.named)) cand.set(id, d);
      if (!allKeys.has(kid)) noBase.add(kid);
    }
    for (const [id, d] of cand) {
      const c = outfitCfg[id] ?? {};
      const name = stripEmoji(c.name ?? d.name) || d.name;
      const icon = c.icon ?? (okIcon(d.icon) ? d.icon : OUTFIT_ICON);
      outfitMeta.set(id, { id, name, price: c.price ?? d.price, icon, level: c.level ?? d.level });
      OUTFIT_LABEL.set(id, name);
      if (!c.name && !d.named) {
        console.log(
          `  ⚠ Bộ đồ "${id}" chưa có tên tiếng Việt – tạm gọi "${name}". Đặt tên trong cau-hinh.json, mục "bo-do": ` +
            `"${id.replace(/_/g, '-')}": { "ten": "Đồ ...", "gia": ${d.price} }.`,
        );
      }
    }
    for (const kid of noBase) {
      const base = kid === 'player_trai' ? 'be-trai.glb' : 'be-gai.glb';
      console.log(`  ⚠ Có bộ đồ của ${KEY_VI[kid]} nhưng chưa có ${base} (bé mặc đồ thường ngày) – hãy thêm ${base} để trò chơi dùng đúng bé này.`);
    }
    for (const id of Object.keys(outfitCfg)) {
      if (!cand.has(id)) console.log(`  ℹ cau-hinh.json: bộ đồ "${id}" chưa có tệp be-trai-${id.replace(/_/g, '-')}.glb hay be-gai-${id.replace(/_/g, '-')}.glb – chưa bán trong cửa hàng.`);
    }
  }
  for (const [key, files] of kept) {
    console.log(`  ℹ ${label(key)}: không có tệp gốc trong mo-hinh-ai – giữ nguyên mô hình đã lắp (${files.join(', ')}).`);
  }
  /** Cấu hình dùng khi xử lý/ghi: bộ đồ thừa hưởng chiều cao, góc xoay, vật liệu... của bé. */
  const cfgFor = (key) => {
    const [kid, id] = key.split(OUTFIT_SEP);
    const outfit = Boolean(id) && KIDS.includes(kid);
    const own = { ...((outfit || !kept.has(key) ? config[key] : (config[key] ?? prevCfg[key])) ?? {}) };
    delete own.rig;
    delete own.outfit;
    if (!outfit) return own;
    const base = cfgFor(kid);
    const inh = {};
    for (const f of KID_INHERIT) if (base[f] !== undefined) inh[f] = base[f];
    return { ...inh, ...own };
  };
  for (const [key, files] of kept) {
    const main = files.find((f) => !f.includes('@'));
    if (!main || cfgFor(key).material !== 'standard' || (prevCfg[key]?.material ?? 'lambert') === 'standard') continue;
    if (glbHasMr(path.join(OUT_DIR, main)) === false) {
      console.log(
        `  ⚠ ${label(key)}: đổi "vat-lieu" sang "goc" – bản đã lắp không còn ảnh kim loại/độ nhám (kiểu "mem"/"hoat-hinh" ` +
          'không dùng) nên sẽ trông mờ hơn. Chép lại tệp gốc vào mo-hinh-ai rồi chạy lại để có vật liệu gốc đầy đủ.',
      );
    }
  }
  const rigs = new Map(); // khóa bé/bộ đồ -> xương đã dò (lưu vào config.json)
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
    const mode = cfgFor(key).material ?? 'lambert';
    if (mode !== 'standard' && dropUnusedPbr(doc)) {
      console.log(`  ℹ Bỏ ảnh kim loại/độ nhám (vật liệu "${mode === 'toon' ? 'hoat-hinh' : 'mem'}" không dùng) – tệp nhẹ hơn, nhìn y như cũ.`);
    }
    const seamOn = (seamFix[key] ?? seamFix[key.split(OUTFIT_SEP)[0]]) !== false;
    if (seamOn) {
      const n = await padUvGaps(doc);
      if (n) console.log(`  ℹ Sửa vệt nứt: tô kín khe giữa các mảnh ảnh (${n} ảnh).`);
    }
    const steps = [dedup(), prune({ keepLeaves: true }), resample()];
    let ratio = REDUCE;
    const triLimit = triLimits[key] ?? triLimits[key.split(OUTFIT_SEP)[0]] ?? AUTO_TRI_LIMIT;
    if (!ratio && tris > triLimit) ratio = triLimit / tris;
    const reduce = Boolean(ratio && ratio < 1);
    if (reduce) steps.push(dequantize(), weld(), simplifyMesh(ratio));
    await doc.transform(...steps);
    // Tô lại lần 2 theo các mảnh UV còn dùng sau khi giảm: mảnh tí hon không còn tam giác nào (chấm màu áo, giày
    // nằm sát mép tóc) bị tô đè bằng màu mảnh gần nhất → hết vệt màu ở ảnh thu nhỏ (mipmap) khi nhìn từ xa.
    if (seamOn && reduce) await padUvGaps(doc, { quiet: true });
    // Bé, bộ đồ: dò xương trên lưới đã giảm (trước khi nén), ghi trọng số vào tệp.
    if (isKidKey(key) && !skins) {
      const r = await bakeKid(doc, cfgFor(key).rotY ?? 0);
      if (r) rigs.set(key, r);
    }
    // Bộ đồ dùng cỡ ảnh của bé nếu không ghi riêng.
    const texSize = (!TEX_CLI && (texSizes[key] ?? texSizes[key.split(OUTFIT_SEP)[0]])) || TEX_SIZE;
    // Hướng mặt 8 bit (mặc định 10 bit, tốn gấp đôi): ảnh chụp gần trong game lệch tối đa 1–2 mức màu – nhìn y hệt.
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize] }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizeNormal: 8 }),
    );
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
    if (!skins && !isKidKey(key)) console.log('  ℹ Mô hình chưa có khung xương – trò chơi tự cho nhân vật nhún nhảy, "thở", lắc lư nhẹ. (Muốn cử động thật: gắn xương bằng Rig/Animate của trang AI rồi tải lại – không bắt buộc.)');
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

  // Bé, bộ đồ giữ nguyên (không có tệp gốc lần này): dùng lại xương đã dò; dò lại khi đổi góc xoay hay cách dò mới.
  for (const [key, files] of kept) {
    if (!isKidKey(key)) continue;
    const rotY = cfgFor(key).rotY ?? 0;
    const prev = prevCfg[key]?.rig;
    const { RIG_VERSION } = await napXuong();
    if (prev && prev.v === RIG_VERSION && (prev.rotY ?? 0) === rotY) {
      rigs.set(key, prev);
      continue;
    }
    const main = files.find((f) => !f.includes('@'));
    if (!main) continue;
    const p = path.join(OUT_DIR, main);
    try {
      const d = await io.read(p);
      d.setLogger(quiet);
      if (d.getRoot().listSkins().length) continue;
      console.log('');
      console.log(`▶ ${label(key)}: ${!prev ? 'chưa dò xương' : prev.v !== RIG_VERSION ? 'có cách dò xương mới' : 'đổi góc xoay'} – dò lại trên ${main}.`);
      const r = await bakeKid(d, rotY);
      if (r) rigs.set(key, r);
      if (r && !DRY) {
        await io.write(p, d);
        writtenCount++;
      }
    } catch (err) {
      console.log(`  ✖ Không dò lại được xương của ${main}: ${err.message} – trò chơi sẽ tự dò khi nạp.`);
    }
  }

  // config.json, danh sách tệp và bảng ghi công: nhân vật vừa làm lại + nhân vật giữ nguyên.
  const keys = [...new Set([...done.keys(), ...kept.keys()])].sort();
  const cfgOut = {};
  const sources = {};
  const credits = [];
  for (const key of keys) {
    // Nhân vật giữ nguyên: ưu tiên cau-hinh.json, không có thì dùng cấu hình lần trước.
    const c = cfgFor(key);
    if (!c.credit) c.credit = 'Mô hình tạo bằng AI';
    if (rigs.has(key)) c.rig = rigs.get(key);
    const [kid, id] = key.split(OUTFIT_SEP);
    if (id && KIDS.includes(kid) && outfitMeta.has(id)) c.outfit = outfitMeta.get(id);
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
  for (const key of gone) {
    const [kid, id] = key.split(OUTFIT_SEP);
    const why = id && KIDS.includes(kid)
      ? 'cửa hàng thôi bán bộ đồ này; bé nào đang mặc sẽ mặc lại đồ thường ngày'
      : KIDS.includes(key)
        ? 'trò chơi tạm dùng bé dựng sẵn (hình đơn giản) cho tới khi có mô hình mới'
        : 'trò chơi dùng lại nhân vật có sẵn';
    console.log(`  ✔ ${DRY ? 'Sẽ gỡ' : 'Đã gỡ'} mô hình AI của ${label(key)} – ${why}.`);
  }

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
