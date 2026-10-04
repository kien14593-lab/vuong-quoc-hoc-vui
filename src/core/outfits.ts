import type { ItemDef } from './items';

/**
 * BÉ (NHÂN VẬT CHÍNH) VÀ BỘ ĐỒ – mô hình AI, tự nhận theo tệp (không cần sửa code khi thêm bộ đồ mới):
 *   player_trai.glb, player_gai.glb            bé trai / bé gái mặc "Đồ thường ngày" (miễn phí, ai cũng có)
 *   player_trai__<mã>.glb, player_gai__<mã>.glb  một bộ đồ của từng bé, vd. player_gai__the_thao.glb
 * Công cụ tools/xu-ly-mo-hinh.mjs tạo các tệp này từ mo-hinh-ai/be-trai.glb, be-gai-the-thao.glb... và ghi tên,
 * giá, biểu tượng của bộ đồ (mục "bo-do" trong cau-hinh.json) vào config.json → { "outfit": { name, price, icon, level } }.
 * Bộ đồ chỉ có cho một bé (vd. váy công chúa chỉ có be-gai-vay-cong-chua.glb) thì chỉ bé đó thấy trong cửa hàng.
 */
export type Kid = 'trai' | 'gai';

export const KIDS: readonly Kid[] = ['trai', 'gai'];

export const KID_NAMES: Record<Kid, string> = { trai: 'Bé trai', gai: 'Bé gái' };

/** Bộ đồ mặc định: mọi bé đều có, miễn phí. */
export const DEFAULT_OUTFIT = 'outfit_thuong_ngay';

/** Bộ đồ chưa ghi giá / biểu tượng (trùng giá trị mặc định của công cụ xu-ly-mo-hinh.mjs). */
export const OUTFIT_PRICE = 60;
export const OUTFIT_ICON = '👕';

/** Phần "outfit" công cụ ghi trong config.json cho mỗi tệp bộ đồ. */
export interface OutfitMeta {
  id?: string;
  name?: string;
  price?: number;
  icon?: string;
  level?: number;
}

/** Khóa mô hình của bé mặc đồ thường ngày. */
export function kidKey(kid: Kid): string {
  return `player_${kid}`;
}

export function isKid(v: unknown): v is Kid {
  return v === 'trai' || v === 'gai';
}

const KEY_RE = /^player_(trai|gai)(?:__([a-z0-9_]+))?$/;

/** "the_thao" → "Đồ the thao" (tên tạm khi cấu hình chưa có tên tiếng Việt). */
function fallbackName(code: string): string {
  return `Đồ ${code.replace(/_/g, ' ')}`;
}

/**
 * Danh mục bộ đồ dựng từ danh sách khóa mô hình có tệp + cấu hình (config.json). Luôn có "Đồ thường ngày" đứng đầu;
 * các bộ đồ khác xếp theo giá rồi theo tên. Mỗi bộ đồ ghi khóa mô hình của từng bé có tệp (`models`).
 */
export function outfitCatalog(keys: Iterable<string>, config: Record<string, { outfit?: OutfitMeta } | undefined> = {}): ItemDef[] {
  const base: ItemDef = {
    id: DEFAULT_OUTFIT,
    name: 'Đồ thường ngày',
    cat: 'outfit',
    price: 0,
    level: 1,
    icon: OUTFIT_ICON,
    desc: 'Bộ đồ quen thuộc của bé.',
    models: { trai: kidKey('trai'), gai: kidKey('gai') },
  };
  const found = new Map<string, ItemDef>();
  const named = new Set<string>();
  for (const key of [...keys].sort()) {
    const m = KEY_RE.exec(key);
    if (!m || !m[2]) continue;
    const kid = m[1] as Kid;
    const id = `outfit_${m[2]}`;
    const meta = config[key]?.outfit ?? {};
    let o = found.get(id);
    if (!o) {
      o = { id, name: fallbackName(m[2]), cat: 'outfit', price: OUTFIT_PRICE, level: 1, icon: OUTFIT_ICON, models: {} };
      found.set(id, o);
    }
    // Tên/giá/biểu tượng: lấy từ tệp đầu tiên có ghi (công cụ ghi giống nhau cho cả hai bé).
    if (meta.name && !named.has(id)) {
      o.name = meta.name;
      named.add(id);
    }
    if (typeof meta.price === 'number' && meta.price >= 0) o.price = Math.round(meta.price);
    if (meta.icon) o.icon = meta.icon;
    if (typeof meta.level === 'number' && meta.level >= 1) o.level = Math.round(meta.level);
    o.models![kid] = key;
  }
  const rest = [...found.values()].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, 'vi'));
  return [base, ...rest];
}

/* ------------------------------------------------------------------ */
/* Danh mục thật: theo các tệp có trong src/assets/models/ai/            */
/* ------------------------------------------------------------------ */
const files = import.meta.glob<string>('../assets/models/ai/*.glb', { eager: true, query: '?url', import: 'default' });
const configs = import.meta.glob<Record<string, { outfit?: OutfitMeta }>>('../assets/models/ai/*.json', { eager: true, import: 'default' });

/** Tên tệp (không đuôi) → khóa: bỏ tệp hoạt cảnh (<khóa>@<vai>.glb). */
export function keysFromFiles(paths: Iterable<string>): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const file = decodeURIComponent(p.split('/').pop() ?? '').replace(/\.glb$/i, '');
    if (file && !file.includes('@')) out.push(file.toLowerCase());
  }
  return out;
}

const CONFIG: Record<string, { outfit?: OutfitMeta }> = {};
for (const c of Object.values(configs)) for (const [k, v] of Object.entries(c ?? {})) CONFIG[k] = { ...CONFIG[k], ...v };

/** Mọi bộ đồ (vật phẩm loại 'outfit'). */
export const OUTFITS: ItemDef[] = outfitCatalog(keysFromFiles(Object.keys(files)), CONFIG);

const BY_ID = new Map(OUTFITS.map((o) => [o.id, o]));

/**
 * Khóa mô hình của bé mặc bộ đồ: đồ thường ngày → player_<bé>; bộ đồ không có cho bé này (hoặc không còn tệp) → null.
 */
export function outfitKey(kid: Kid, outfit: string | null | undefined, list: Map<string, ItemDef> = BY_ID): string | null {
  if (!outfit || outfit === DEFAULT_OUTFIT) return kidKey(kid);
  return list.get(outfit)?.models?.[kid] ?? null;
}

/** Bộ đồ bé này mặc được (có tệp mô hình), theo thứ tự trong cửa hàng. */
export function kidOutfits(kid: Kid): ItemDef[] {
  return OUTFITS.filter((o) => outfitKey(kid, o.id) !== null);
}

/** Bé mặc bộ đồ này được không. */
export function outfitFits(kid: Kid, outfit: string | null | undefined): boolean {
  return !!outfit && outfitKey(kid, outfit) !== null;
}

/** Khóa mô hình cần nạp để vẽ bé mặc bộ đồ (bộ đồ không có cho bé → đồ thường ngày). */
export function playerKey(kid: Kid, outfit: string | null | undefined): string {
  return outfitKey(kid, outfit) ?? kidKey(kid);
}
