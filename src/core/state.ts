import { SAVE_VERSION } from '../config';
import { initialSkill, updateSkill, type SkillChange, type SkillState } from '../math/adaptive';
import type { Grade, Topic } from '../math/types';
import { isOlder, playedAt, type ImportCompare, type ImportSide } from './backup';
import { bus } from './events';
import { item, RETIRED_WEAR, type DecorSlot, type WearSlot } from './items';
import { DEFAULT_OUTFIT, isKid, outfitFits, type Kid } from './outfits';
import { badgeDef, coinsForAttempts, levelFromXp, xpForAttempts } from './progression';
import { storage } from './storage';
import type { VoiceChoice } from './voices';

export type ZoneId = 'village' | 'forest' | 'maze' | 'park' | 'zoo' | 'castle' | 'house';

/** Ngoại hình bé dựng bằng code (dữ liệu cũ – nay bé là mô hình AI, không còn chọn da, tóc, mắt). */
export interface Look {
  skin: number;
  hair: number;
  hairColor: number;
  eyes: number;
}

export interface Equipped {
  /** Bộ đồ đang mặc (vật phẩm loại 'outfit'; mặc định "Đồ thường ngày"). */
  outfit: string;
  hat: string | null;
  backpack: string | null;
  acc: string | null;
  pet: string | null;
  board: string | null;
}

export interface TopicStat {
  q: number;
  first: number;
  attempts: number;
  ms: number;
  last: number;
}

export interface AnswerLog {
  t: number;
  topic: Topic;
  lv: number;
  a: number;
  ms: number;
  src: string;
}

export interface DayStat {
  ms: number;
  q: number;
  first: number;
}

export interface Goal {
  id: string;
  topic: Topic | 'any';
  target: number;
  week: string;
  title: string;
  created: number;
}

export interface Plant {
  seed: string | null;
  growth: number;
}

export interface Profile {
  v: number;
  id: string;
  name: string;
  grade: Grade;
  created: number;
  lastPlayed: number;
  /** Bé trai hay bé gái (mô hình AI) – chọn khi tạo hồ sơ, đổi được trong Túi đồ. */
  kid: Kid;
  look: Look;
  equipped: Equipped;
  xp: number;
  coins: number;
  stars: number;
  tickets: number;
  keys: number;
  inventory: Record<string, number>;
  decor: Partial<Record<DecorSlot, string | null>>;
  plants: Plant[];
  badges: string[];
  flags: Record<string, boolean | number | string>;
  collected: string[];
  quests: Record<string, string>;
  skills: Partial<Record<Topic, SkillState>>;
  stats: Partial<Record<Topic, TopicStat>>;
  log: AnswerLog[];
  days: Record<string, DayStat>;
  goals: Goal[];
  totalMs: number;
  pos: { zone: ZoneId; x: number; y: number } | null;
  mini: Record<string, { best: number; plays: number }>;
  /** Số xu vừa trả lại cho áo, quần, giày cũ – báo cho bé một lần rồi xóa. */
  refund?: number;
}

export interface ProfileSummary {
  id: string;
  name: string;
  grade: Grade;
  created: number;
  lastPlayed: number;
  kid: Kid;
  look: Look;
  equipped: Equipped;
  level: number;
  stars: number;
}

export interface Settings {
  music: number;
  sfx: number;
  voice: boolean;
  voiceRate: number;
  fullscreenHint: boolean;
  /** Chất lượng đồ họa 3D. */
  quality: 'auto' | 'high' | 'low';
  /** Mỗi nhân vật một giọng đọc riêng (tắt: mọi lời dùng giọng dẫn chuyện). */
  charVoices: boolean;
  /** Giọng đọc tiếng Việt bé chọn trên máy này (null = tự động chọn giọng tốt nhất). */
  voiceVi: VoiceChoice | null;
}

const LOG_CAP = 1500;

let current: Profile | null = null;
let saveTimer: number | null = null;

export const DEFAULT_SETTINGS: Settings = {
  music: 0.5,
  sfx: 0.8,
  voice: true,
  voiceRate: 1,
  fullscreenHint: true,
  quality: 'auto',
  charVoices: true,
  voiceVi: null,
};

/** Đọc cài đặt đã lưu: trường thiếu hoặc sai kiểu lấy giá trị mặc định (cài đặt cũ vẫn dùng được). */
export function mergeSettings(raw: unknown): Settings {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
  const vv = r.voiceVi as Record<string, unknown> | null | undefined;
  return {
    music: num(r.music, d.music),
    sfx: num(r.sfx, d.sfx),
    voice: bool(r.voice, d.voice),
    voiceRate: num(r.voiceRate, d.voiceRate),
    fullscreenHint: bool(r.fullscreenHint, d.fullscreenHint),
    quality: r.quality === 'auto' || r.quality === 'high' || r.quality === 'low' ? r.quality : d.quality,
    charVoices: bool(r.charVoices, d.charVoices),
    voiceVi: vv && typeof vv === 'object' && typeof vv.uri === 'string' && typeof vv.name === 'string' ? { uri: vv.uri, name: vv.name } : null,
  };
}

let settings: Settings = mergeSettings(storage.getJSON<unknown>('settings', {}));

export function getSettings(): Settings {
  return settings;
}

export function updateSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  storage.setJSON('settings', settings);
  bus.emit('settings', {});
}

/* ------------------------------------------------------------------ */
/* Ngày & tuần                                                          */
/* ------------------------------------------------------------------ */
export function dayKey(t = Date.now()): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** Khóa tuần: ngày thứ Hai đầu tuần. */
export function weekKey(t = Date.now()): string {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return dayKey(d.getTime());
}

/* ------------------------------------------------------------------ */
/* Hồ sơ                                                                */
/* ------------------------------------------------------------------ */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function newProfile(opts: { name: string; grade: Grade; kid: Kid; look?: Look; equipped?: Partial<Equipped> }): Profile {
  const now = Date.now();
  const equipped: Equipped = {
    outfit: DEFAULT_OUTFIT,
    hat: null,
    backpack: null,
    acc: null,
    pet: null,
    board: null,
    ...opts.equipped,
  };
  const inventory: Record<string, number> = { [DEFAULT_OUTFIT]: 1 };
  return {
    v: SAVE_VERSION,
    id: uid(),
    name: opts.name.trim() || 'Bạn nhỏ',
    grade: opts.grade,
    created: now,
    lastPlayed: now,
    kid: opts.kid,
    look: opts.look ?? kidLook(opts.kid),
    equipped,
    xp: 0,
    coins: 0,
    stars: 0,
    tickets: 0,
    keys: 0,
    inventory,
    decor: {},
    plants: [
      { seed: null, growth: 0 },
      { seed: null, growth: 0 },
      { seed: null, growth: 0 },
    ],
    badges: [],
    flags: {},
    collected: [],
    quests: {},
    skills: {},
    stats: {},
    log: [],
    days: {},
    goals: [],
    totalMs: 0,
    pos: null,
    mini: {},
  };
}

/** Ngoại hình bé dựng bằng code tương ứng (chỉ dùng khi thiếu mô hình AI): bé trai tóc ngắn đen, bé gái hai bím. */
export function kidLook(kid: Kid): Look {
  return { skin: 1, hair: kid === 'gai' ? 3 : 0, hairColor: 0, eyes: 0 };
}

/** Váy (áo váy, chân váy) của hồ sơ cũ – dùng để đoán bé gái. */
const GIRL_WEAR = new Set(['shirt_dress', 'pants_skirt', 'pants_purple']);
/** Chỗ mặc cũ đã bỏ. */
const OLD_SLOTS = ['shirt', 'pants', 'shoes'];

/** Đoán bé trai hay bé gái từ hồ sơ cũ: tóc dài, hai bím hoặc đang mặc váy → bé gái; còn lại → bé trai. */
export function guessKid(p: { look?: Partial<Look> | null; equipped?: object | null }): Kid {
  const hair = p.look?.hair;
  if (hair === 2 || hair === 3) return 'gai';
  const eq = (p.equipped ?? {}) as Record<string, unknown>;
  return OLD_SLOTS.some((s) => typeof eq[s] === 'string' && GIRL_WEAR.has(eq[s] as string)) ? 'gai' : 'trai';
}

/**
 * Áo, quần, giày cũ: bỏ khỏi túi đồ và chỗ mặc, trả lại xu cho món phải mua (đồ được tặng không tính).
 * Dựa vào chính túi đồ nên chạy lại cũng không trả hai lần. Trả về số xu đã trả.
 */
function refundRetired(p: Profile): number {
  let coins = 0;
  for (const [id, n] of Object.entries(p.inventory)) {
    if (!(id in RETIRED_WEAR)) continue;
    coins += RETIRED_WEAR[id] * Math.max(0, Math.floor(Number(n) || 0));
    delete p.inventory[id];
  }
  if (coins > 0) {
    p.coins = (p.coins ?? 0) + coins;
    p.refund = (p.refund ?? 0) + coins;
  }
  return coins;
}

function migrate(raw: Profile): Profile {
  const kid = isKid(raw.kid) ? raw.kid : guessKid(raw);
  const base = newProfile({ name: raw.name, grade: raw.grade, kid });
  const p: Profile = {
    ...base,
    ...raw,
    v: SAVE_VERSION,
    kid,
    look: raw.look ?? base.look,
    inventory: { ...(raw.inventory ?? base.inventory) },
    equipped: { ...base.equipped, ...raw.equipped },
  };
  const eq = p.equipped as unknown as Record<string, unknown>;
  for (const s of OLD_SLOTS) delete eq[s];
  refundRetired(p);
  if (!outfitFits(kid, p.equipped.outfit)) p.equipped.outfit = DEFAULT_OUTFIT;
  if (!p.inventory[DEFAULT_OUTFIT]) p.inventory[DEFAULT_OUTFIT] = 1;
  return p;
}

function summary(p: Profile): ProfileSummary {
  return { id: p.id, name: p.name, grade: p.grade, created: p.created, lastPlayed: p.lastPlayed, kid: p.kid, look: p.look, equipped: p.equipped, level: levelFromXp(p.xp), stars: p.stars };
}

export function listProfiles(): ProfileSummary[] {
  return storage
    .getJSON<ProfileSummary[]>('profiles', [])
    .map((s) => (isKid(s.kid) && s.equipped?.outfit ? s : { ...s, kid: isKid(s.kid) ? s.kid : guessKid(s), equipped: { ...s.equipped, outfit: s.equipped?.outfit ?? DEFAULT_OUTFIT } }))
    .sort((a, b) => b.lastPlayed - a.lastPlayed);
}

function writeIndex(p: Profile): void {
  const list = storage.getJSON<ProfileSummary[]>('profiles', []).filter((s) => s.id !== p.id);
  list.push(summary(p));
  storage.setJSON('profiles', list);
}

function cancelSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

/** Gỡ hồ sơ đang chơi mà KHÔNG lưu – bản trên máy vừa được thay hoặc xóa, bản cũ trong bộ nhớ không được ghi đè lên. */
function dropProfile(): void {
  cancelSave();
  current = null;
  bus.emit('profile', { id: null });
}

export function saveNow(): void {
  if (!current) return;
  cancelSave();
  current.lastPlayed = Date.now();
  storage.setJSON(`p.${current.id}`, current);
  writeIndex(current);
}

export function save(): void {
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 400);
}

/** Ghi ngay nếu đang chờ ghi (trang sắp bị ẩn / đóng – iPhone, iPad có thể tắt trang bất cứ lúc nào). */
export function flushSave(): void {
  if (saveTimer !== null) saveNow();
}

/** Bản sao hồ sơ trên máy. Hồ sơ đang chơi được lưu ngay trước khi đọc để bản sao không bị cũ. */
export function readProfile(id: string): Profile | null {
  if (current?.id === id) saveNow();
  const p = storage.getJSON<Profile | null>(`p.${id}`, null);
  return p ? migrate(p) : null;
}

export function loadProfile(id: string): Profile | null {
  const p = readProfile(id);
  if (!p) return null;
  current = p;
  saveNow();
  bus.emit('profile', { id });
  return p;
}

export function createProfile(opts: Parameters<typeof newProfile>[0]): Profile {
  current = newProfile(opts);
  saveNow();
  bus.emit('profile', { id: current.id });
  return current;
}

export function deleteProfile(id: string): void {
  storage.remove(`p.${id}`);
  storage.setJSON(
    'profiles',
    storage.getJSON<ProfileSummary[]>('profiles', []).filter((s) => s.id !== id),
  );
  if (current?.id === id) dropProfile();
}

export function exportProfile(id: string): string {
  const p = readProfile(id);
  return JSON.stringify({ app: 'vuong-quoc-toan-hoc', version: SAVE_VERSION, profile: p }, null, 1);
}

/** Hồ sơ gốc trong tệp sao lưu (chưa chuyển dạng). Tệp hỏng / không phải của game → báo lỗi. */
function readBackup(json: string): Profile {
  let data: { app?: unknown; profile?: Profile } | null;
  try {
    data = JSON.parse(json) as typeof data;
  } catch {
    throw new Error('Tệp không đúng định dạng.');
  }
  if (!data || typeof data !== 'object' || data.app !== 'vuong-quoc-toan-hoc' || !data.profile || typeof data.profile !== 'object' || !data.profile.id) {
    throw new Error('Tệp không đúng định dạng.');
  }
  return data.profile;
}

/** Đọc tệp sao lưu thành hồ sơ (chưa ghi gì xuống máy). Tệp hỏng / không phải của game → báo lỗi. */
export function parseProfileFile(json: string): Profile {
  return migrate(readBackup(json));
}

/** Tệp sao lưu đã đọc, so với bản cùng hồ sơ trên máy – chưa ghi gì. */
export interface ImportCheck extends ImportCompare {
  /** Hồ sơ trong tệp (đã chuyển sang dạng mới) – được ghi xuống máy khi bấm "Nhập". */
  profile: Profile;
}

function importSide(p: Profile, lastPlayed: number | null): ImportSide {
  return { name: p.name, grade: p.grade, stars: p.stars, level: levelFromXp(p.xp), lastPlayed };
}

/**
 * Đọc tệp sao lưu và so với bản cùng hồ sơ trên máy (không ghi gì). Ngày chơi lần cuối lấy từ hồ sơ gốc – chuyển dạng
 * sẽ điền "bây giờ" khi thiếu. Hồ sơ đang chơi được so bằng bản trong bộ nhớ và KHÔNG lưu trước,
 * để bấm "Thôi" thì trên máy không có gì thay đổi.
 */
export function checkImport(json: string): ImportCheck {
  const raw = readBackup(json);
  const p = migrate(raw);
  const file = importSide(p, playedAt(raw.lastPlayed));
  const playing = current?.id === p.id;
  let device: ImportSide | null = null;
  if (current && playing) device = importSide(current, playedAt(current.lastPlayed));
  else {
    const stored = storage.getJSON<Profile | null>(`p.${p.id}`, null);
    if (stored && typeof stored === 'object') device = importSide(migrate(stored), playedAt(stored.lastPlayed));
  }
  return { profile: p, file, device, playing, older: isOlder(file.lastPlayed, device?.lastPlayed ?? null) };
}

/**
 * Nhập tệp sao lưu. Hồ sơ đã có trên máy (kể cả hồ sơ đang chơi) → `ask` hỏi lại kèm bảng so sánh;
 * "Thôi" → không ghi gì, trả về null. Hồ sơ mới → nhập luôn, không hỏi.
 * Kết quả có `playing` = vừa thay hồ sơ đang chơi → người gọi đưa game về màn hình chính.
 */
export async function importBackup(json: string, ask: (c: ImportCheck & { device: ImportSide }) => Promise<boolean>): Promise<ImportCheck | null> {
  const c = checkImport(json);
  const { device } = c;
  if (device && !(await ask({ ...c, device }))) return null;
  const playing = current?.id === c.profile.id;
  storeImported(c.profile);
  return { ...c, playing };
}

/**
 * Ghi hồ sơ vừa nhập xuống máy. Trùng hồ sơ đang chơi thì gỡ hồ sơ đó ra (không lưu) –
 * nếu không, bản cũ trong bộ nhớ sẽ ghi đè bản vừa nhập ở lần lưu kế tiếp. Người gọi đưa game về màn hình chính.
 */
export function storeImported(p: Profile): Profile {
  if (current?.id === p.id) dropProfile();
  storage.setJSON(`p.${p.id}`, p);
  writeIndex(p);
  return p;
}

export function importProfile(json: string): Profile {
  return storeImported(parseProfileFile(json));
}

export function unloadProfile(): void {
  saveNow();
  current = null;
  bus.emit('profile', { id: null });
}

export function hasProfile(): boolean {
  return current !== null;
}

export function profile(): Profile {
  if (!current) throw new Error('Chưa chọn hồ sơ người chơi');
  return current;
}

/* ------------------------------------------------------------------ */
/* Ví: xu, sao, vé, chìa khóa                                           */
/* ------------------------------------------------------------------ */
function emitWallet(): void {
  const p = profile();
  bus.emit('wallet', { coins: p.coins, stars: p.stars, tickets: p.tickets, keys: p.keys });
}

export function addCoins(n: number): void {
  profile().coins = Math.max(0, profile().coins + n);
  emitWallet();
  save();
}

export function spendCoins(n: number): boolean {
  const p = profile();
  if (p.coins < n) return false;
  p.coins -= n;
  emitWallet();
  save();
  return true;
}

export function addStars(n: number): void {
  profile().stars += n;
  emitWallet();
  save();
}

export function addTickets(n: number): void {
  profile().tickets = Math.max(0, profile().tickets + n);
  emitWallet();
  save();
}

export function addKeys(n: number): void {
  profile().keys = Math.max(0, profile().keys + n);
  emitWallet();
  save();
}

/** Cộng XP; trả về cấp mới nếu lên cấp. */
export function addXp(n: number): number | null {
  const p = profile();
  const before = levelFromXp(p.xp);
  p.xp += n;
  const after = levelFromXp(p.xp);
  bus.emit('xp', { xp: p.xp, level: after });
  save();
  if (after > before) {
    bus.emit('levelup', { level: after });
    return after;
  }
  return null;
}

export function level(): number {
  return levelFromXp(profile().xp);
}

/* ------------------------------------------------------------------ */
/* Vật phẩm                                                             */
/* ------------------------------------------------------------------ */
export function hasItem(id: string): boolean {
  return (profile().inventory[id] ?? 0) > 0;
}

export function itemCount(id: string): number {
  return profile().inventory[id] ?? 0;
}

export function giveItem(id: string, n = 1): void {
  const inv = profile().inventory;
  inv[id] = (inv[id] ?? 0) + n;
  bus.emit('inventory', { id });
  save();
}

export function takeItem(id: string, n = 1): boolean {
  const inv = profile().inventory;
  if ((inv[id] ?? 0) < n) return false;
  inv[id] -= n;
  if (inv[id] <= 0) delete inv[id];
  bus.emit('inventory', { id });
  save();
  return true;
}

export function equip(slot: WearSlot | 'pet' | 'board', id: string | null): void {
  const p = profile();
  if (slot === 'outfit' && (!id || !outfitFits(p.kid, id))) return;
  (p.equipped as unknown as Record<string, string | null>)[slot] = id;
  bus.emit('look', {});
  save();
}

/** Đổi bé trai ↔ bé gái: giữ mọi bộ đồ đã có; bộ đang mặc chưa có cho bé này thì mặc "Đồ thường ngày". */
export function setKid(kid: Kid): void {
  const p = profile();
  if (!isKid(kid) || p.kid === kid) return;
  p.kid = kid;
  p.look = { ...p.look, hair: kidLook(kid).hair };
  if (!outfitFits(kid, p.equipped.outfit)) p.equipped.outfit = DEFAULT_OUTFIT;
  bus.emit('look', {});
  save();
}

/** Số xu vừa trả lại cho áo, quần, giày cũ mà bé chưa được báo (0 nếu không có) – lấy xong thì xóa. */
export function takeRefundNotice(): number {
  const p = profile();
  const n = p.refund ?? 0;
  if (p.refund !== undefined) {
    delete p.refund;
    save();
  }
  return n;
}

/** Bé và đồ đang mặc của hồ sơ đang chơi (tùy chọn dựng mô hình 'player'); chưa chọn hồ sơ → {} (bé mẫu). */
export function playerLook(): { kid?: Kid; eq?: Equipped } {
  return current ? { kid: current.kid, eq: { ...current.equipped } } : {};
}

export function setDecor(slot: DecorSlot, id: string | null): void {
  profile().decor[slot] = id;
  save();
}

/* ------------------------------------------------------------------ */
/* Cờ cốt truyện, vật phẩm đã nhặt, huy hiệu                            */
/* ------------------------------------------------------------------ */
export function flag(k: string): boolean | number | string | undefined {
  return profile().flags[k];
}

export function setFlag(k: string, v: boolean | number | string = true): void {
  profile().flags[k] = v;
  save();
}

export function isCollected(id: string): boolean {
  return profile().collected.includes(id);
}

export function markCollected(id: string): void {
  if (!isCollected(id)) {
    profile().collected.push(id);
    save();
  }
}

export function hasBadge(id: string): boolean {
  return profile().badges.includes(id);
}

/** Trao huy hiệu; trả về true nếu là huy hiệu mới. */
export function awardBadge(id: string): boolean {
  if (!badgeDef(id) || hasBadge(id)) return false;
  profile().badges.push(id);
  bus.emit('badge', { id });
  save();
  return true;
}

export function questState(id: string): string | undefined {
  return profile().quests[id];
}

export function setQuestState(id: string, state: string): void {
  profile().quests[id] = state;
  bus.emit('quest', { id });
  save();
}

/* ------------------------------------------------------------------ */
/* Kỹ năng & thống kê học tập                                           */
/* ------------------------------------------------------------------ */
export function skill(topic: Topic): SkillState {
  const p = profile();
  let s = p.skills[topic];
  if (!s) {
    s = initialSkill(topic, p.grade);
    p.skills[topic] = s;
  }
  return s;
}

export interface AnswerResult {
  xp: number;
  coins: number;
  change: SkillChange;
  levelUp: number | null;
}

/** Ghi nhận một câu hỏi đã hoàn thành (sau khi trẻ chọn đúng). */
export function recordAnswer(topic: Topic, lv: number, attempts: number, ms: number, src: string, opts: { rewards?: boolean } = {}): AnswerResult {
  const p = profile();
  const now = Date.now();
  const first = attempts <= 1;
  const st = (p.stats[topic] ??= { q: 0, first: 0, attempts: 0, ms: 0, last: 0 });
  st.q += 1;
  st.first += first ? 1 : 0;
  st.attempts += attempts;
  st.ms += Math.min(ms, 300000);
  st.last = now;
  p.log.push({ t: now, topic, lv, a: attempts, ms: Math.min(ms, 300000), src });
  if (p.log.length > LOG_CAP) p.log.splice(0, p.log.length - LOG_CAP);
  const dk = dayKey(now);
  const day = (p.days[dk] ??= { ms: 0, q: 0, first: 0 });
  day.q += 1;
  day.first += first ? 1 : 0;
  const upd = updateSkill(skill(topic), attempts, topic, p.grade);
  p.skills[topic] = upd.state;
  let xp = 0;
  let coins = 0;
  let levelUp: number | null = null;
  if (opts.rewards !== false) {
    xp = xpForAttempts(attempts);
    coins = coinsForAttempts(attempts);
    addCoins(coins);
    levelUp = addXp(xp);
  }
  growPlants();
  bus.emit('answer', { topic, firstTry: first });
  save();
  return { xp, coins, change: upd.change, levelUp };
}

/** Cây trong vườn lớn thêm mỗi khi hoàn thành một thử thách. */
function growPlants(): void {
  for (const pl of profile().plants) if (pl.seed) pl.growth += 1;
}

export function addPlayTime(ms: number): void {
  if (!current) return;
  const p = current;
  p.totalMs += ms;
  const dk = dayKey();
  const day = (p.days[dk] ??= { ms: 0, q: 0, first: 0 });
  day.ms += ms;
  save();
}

export function setGrade(grade: Grade): void {
  const p = profile();
  p.grade = grade;
  p.skills = {};
  save();
}

export function setPosition(zone: ZoneId, x: number, y: number): void {
  if (!current) return;
  current.pos = { zone, x: Math.round(x), y: Math.round(y) };
  save();
}

export function recordMini(id: string, score: number): { best: boolean } {
  const p = profile();
  const m = (p.mini[id] ??= { best: 0, plays: 0 });
  m.plays += 1;
  const best = score > m.best;
  if (best) m.best = score;
  save();
  return { best };
}

export function itemName(id: string): string {
  return item(id)?.name ?? id;
}

/** Ghi một hồ sơ bất kỳ (kể cả không phải hồ sơ đang chơi) xuống localStorage. */
export function writeProfile(p: Profile): void {
  const next = migrate({ ...p, v: SAVE_VERSION });
  storage.setJSON(`p.${next.id}`, next);
  writeIndex(next);
  if (current?.id === next.id) current = next;
}

/** Đặt lại tiến độ học tập, giữ tên, lớp, ngoại hình và trang bị cơ bản. */
export function resetProfileProgress(id: string): Profile | null {
  const old = readProfile(id);
  if (!old) return null;
  const fresh = newProfile({ name: old.name, grade: old.grade, kid: old.kid, look: old.look, equipped: old.equipped });
  const reset: Profile = {
    ...fresh,
    id: old.id,
    created: old.created,
    lastPlayed: Date.now(),
    look: old.look,
    equipped: old.equipped,
    inventory: old.inventory,
    decor: old.decor,
    plants: old.plants,
    flags: {},
    collected: [],
    quests: {},
    pos: old.pos,
  };
  storage.setJSON(`p.${reset.id}`, reset);
  writeIndex(reset);
  if (current?.id === reset.id) current = reset;
  return reset;
}
