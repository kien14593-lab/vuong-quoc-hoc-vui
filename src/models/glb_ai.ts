/**
 * Mô hình tạo bằng AI (Meshy, Tripo...) – tự nhận tệp trong src/assets/models/ai/:
 *   <khóa>.glb            mô hình chính (có thể kèm hoạt cảnh)        vd. npc_bear.glb
 *   <khóa>@<vai>.glb      tệp hoạt cảnh thêm (walk, run, wave...)     vd. npc_bear@walk.glb
 *   config.json           tinh chỉnh: { "npc_bear": { "height": 2, "rotY": 180, "material": "toon" } }
 * Tên tiếng Việt (gau.glb, gau@di.glb...) cũng được nhận theo bảng ai-names.json.
 * Mô hình AI được ưu tiên hơn mô hình CC0 và mô hình dựng bằng code cùng khóa.
 * Công cụ tools/xu-ly-mo-hinh.mjs (CapNhatMoHinh.bat) tối ưu & chép tệp từ thư mục mo-hinh-ai/ vào đây.
 */
import './glb_cc0';
import { CLIP_ROLES, defineGlbModel, type AnimSource, type ClipRole, type GlbSpec } from './glb';
import names from '../assets/models/ai-names.json';

const files = import.meta.glob<string>('../assets/models/ai/*.glb', { eager: true, query: '?url', import: 'default' });
const configs = import.meta.glob<Record<string, Partial<GlbSpec>>>('../assets/models/ai/*.json', { eager: true, import: 'default' });

export const AI_MODELS: string[] = [];

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, '-');

function keyOf(name: string): string {
  const n = name.toLowerCase();
  if (n in names.keys) return n;
  const s = slug(name);
  for (const [k, list] of Object.entries(names.keys)) if (list.includes(s) || slug(k) === s) return k;
  return n;
}

function roleOf(name: string): ClipRole | undefined {
  const s = slug(name);
  if ((CLIP_ROLES as readonly string[]).includes(s)) return s as ClipRole;
  for (const [r, list] of Object.entries(names.roles)) if (list.includes(s)) return r as ClipRole;
  return undefined;
}

const config: Record<string, Partial<GlbSpec>> = {};
for (const c of Object.values(configs)) for (const [k, v] of Object.entries(c ?? {})) config[keyOf(k)] = { ...config[keyOf(k)], ...v };

const mains = new Map<string, string>();
const anims = new Map<string, AnimSource[]>();
for (const [path, url] of Object.entries(files)) {
  const file = decodeURIComponent(path.split('/').pop() ?? '').replace(/\.glb$/i, '');
  const at = file.indexOf('@');
  if (at > 0) {
    const key = keyOf(file.slice(0, at));
    const role = roleOf(file.slice(at + 1));
    if (!role) {
      console.warn(`[glb-ai] không hiểu tên hoạt cảnh "${file}" (vd. hợp lệ: npc_bear@walk.glb)`);
      continue;
    }
    if (!anims.has(key)) anims.set(key, []);
    anims.get(key)!.push({ src: url, role });
  } else mains.set(keyOf(file), url);
}

for (const [key, src] of mains) {
  AI_MODELS.push(key);
  defineGlbModel(key, { src, animSrc: anims.get(key), source: 'ai', credit: 'Tạo bằng AI', ...config[key] });
}
