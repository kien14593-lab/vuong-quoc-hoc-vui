import { SAVE_VERSION } from '../config';
import { initialSkill, updateSkill, type SkillChange, type SkillState } from '../math/adaptive';
import type { Grade, Topic } from '../math/types';
import { bus } from './events';
import { item, type DecorSlot, type WearSlot } from './items';
import { badgeDef, coinsForAttempts, levelFromXp, xpForAttempts } from './progression';
import { storage } from './storage';

export type ZoneId = 'village' | 'forest' | 'maze' | 'park' | 'zoo' | 'castle' | 'house';

export interface Look {
  skin: number;
  hair: number;
  hairColor: number;
  eyes: number;
}

export interface Equipped {
  shirt: string;
  pants: string;
  shoes: string;
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
}

export interface ProfileSummary {
  id: string;
  name: string;
  grade: Grade;
  created: number;
  lastPlayed: number;
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
}

const LOG_CAP = 1500;

let current: Profile | null = null;
let saveTimer: number | null = null;

export const DEFAULT_SETTINGS: Settings = { music: 0.5, sfx: 0.8, voice: true, voiceRate: 1, fullscreenHint: true, quality: 'auto' };
let settings: Settings = { ...DEFAULT_SETTINGS, ...storage.getJSON<Partial<Settings>>('settings', {}) };

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

export function newProfile(opts: { name: string; grade: Grade; look: Look; equipped: Partial<Equipped> }): Profile {
  const now = Date.now();
  const equipped: Equipped = {
    shirt: 'shirt_blue',
    pants: 'pants_jean',
    shoes: 'shoes_red',
    hat: null,
    backpack: null,
    acc: null,
    pet: null,
    board: null,
    ...opts.equipped,
  };
  const inventory: Record<string, number> = {};
  for (const id of ['shirt_blue', 'shirt_pink', 'shirt_yellow', 'shirt_green', 'pants_jean', 'pants_skirt', 'pants_shorts', 'shoes_red']) inventory[id] = 1;
  return {
    v: SAVE_VERSION,
    id: uid(),
    name: opts.name.trim() || 'Bạn nhỏ',
    grade: opts.grade,
    created: now,
    lastPlayed: now,
    look: opts.look,
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

function migrate(p: Profile): Profile {
  const base = newProfile({ name: p.name, grade: p.grade, look: p.look, equipped: p.equipped });
  return { ...base, ...p, v: SAVE_VERSION, equipped: { ...base.equipped, ...p.equipped } };
}

function summary(p: Profile): ProfileSummary {
  return { id: p.id, name: p.name, grade: p.grade, created: p.created, lastPlayed: p.lastPlayed, look: p.look, equipped: p.equipped, level: levelFromXp(p.xp), stars: p.stars };
}

export function listProfiles(): ProfileSummary[] {
  return storage.getJSON<ProfileSummary[]>('profiles', []).sort((a, b) => b.lastPlayed - a.lastPlayed);
}

function writeIndex(p: Profile): void {
  const list = storage.getJSON<ProfileSummary[]>('profiles', []).filter((s) => s.id !== p.id);
  list.push(summary(p));
  storage.setJSON('profiles', list);
}

export function saveNow(): void {
  if (!current) return;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
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

export function readProfile(id: string): Profile | null {
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
  if (current?.id === id) current = null;
}

export function exportProfile(id: string): string {
  const p = readProfile(id);
  return JSON.stringify({ app: 'vuong-quoc-toan-hoc', version: SAVE_VERSION, profile: p }, null, 1);
}

export function importProfile(json: string): Profile {
  const data = JSON.parse(json) as { app?: string; profile?: Profile };
  if (data.app !== 'vuong-quoc-toan-hoc' || !data.profile || !data.profile.id) throw new Error('Tệp không đúng định dạng.');
  const p = migrate(data.profile);
  storage.setJSON(`p.${p.id}`, p);
  writeIndex(p);
  return p;
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
  const eq = profile().equipped;
  if ((slot === 'shirt' || slot === 'pants' || slot === 'shoes') && !id) return;
  (eq as unknown as Record<string, string | null>)[slot] = id;
  bus.emit('look', {});
  save();
}

export function setLook(look: Partial<Look>): void {
  Object.assign(profile().look, look);
  bus.emit('look', {});
  save();
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
  const fresh = newProfile({ name: old.name, grade: old.grade, look: old.look, equipped: old.equipped });
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
