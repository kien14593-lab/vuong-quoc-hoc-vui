/**
 * Ngân hàng từ vựng Tiếng Anh: đọc dữ liệu từ data/g1..g5.ts thành danh sách từ có cấu trúc.
 * Dữ liệu là từ thông dụng xếp theo chủ đề Unit; nghĩa, câu ví dụ, hình (emoji) do nhóm tự soạn.
 */
import type { Grade } from '../math/types';
import { G1 } from './data/g1';
import { G2 } from './data/g2';
import { G3 } from './data/g3';
import { G4 } from './data/g4';
import { G5 } from './data/g5';

export interface Word {
  /** Mã duy nhất, ví dụ "g3u5:swimming". */
  id: string;
  w: string;
  vi: string;
  e: string;
  tags: string[];
  grade: Grade;
  unit: number;
  /** Dùng được cho câu hỏi hình (emoji thể hiện rõ nghĩa). */
  pic: boolean;
  /** Từ vốn ở dạng số nhiều (grapes, shoes). */
  pw: boolean;
  /** Danh từ không đếm được (milk, rice). */
  nc: boolean;
  /** Số nhiều bất quy tắc. */
  pl?: string;
  /** Từ đồng nghĩa – không bao giờ làm phương án nhiễu cho nhau. */
  alt: string[];
  /** Nhóm dễ nhầm – không làm phương án nhiễu cho nhau. */
  grp?: string;
  sex?: 'm' | 'f';
  /** Mã màu (Unit màu sắc). */
  hex?: string;
  /** Câu ví dụ tự soạn. */
  ex?: string;
}

/** Nhãn chủ đề hợp lệ. */
export const TAGS = [
  'toy', 'school', 'transport', 'animal', 'people', 'fruit', 'food', 'veg', 'drink', 'kitchen', 'nature', 'home',
  'music', 'clothes', 'family', 'job', 'weather', 'body', 'place', 'shape', 'word', 'action', 'number', 'sport',
  'festival', 'adj', 'colour', 'feeling', 'subject', 'greeting', 'hobby', 'room', 'country', 'time', 'day', 'month',
  'game', 'season', 'health', 'illness',
] as const;

const RAW: Record<Grade, string[]> = { 1: G1, 2: G2, 3: G3, 4: G4, 5: G5 };

export function parseLine(line: string, grade: Grade, unit: number): Word {
  const [w, vi, e, tagStr, ...extras] = line.trim().split('|');
  const word: Word = {
    id: `g${grade}u${unit}:${w}`,
    w,
    vi,
    e,
    tags: (tagStr ?? '').split(',').filter(Boolean),
    grade,
    unit,
    pic: true,
    pw: false,
    nc: false,
    alt: [],
  };
  for (const x of extras) {
    const eq = x.indexOf('=');
    const key = eq < 0 ? x : x.slice(0, eq);
    const val = eq < 0 ? '' : x.slice(eq + 1);
    if (key === 'np') word.pic = false;
    else if (key === 'pw') word.pw = true;
    else if (key === 'nc') word.nc = true;
    else if (key === 'pl') word.pl = val;
    else if (key === 'alt') word.alt.push(val);
    else if (key === 'grp') word.grp = val;
    else if (key === 'm' || key === 'f') word.sex = key;
    else if (key === 'hex') word.hex = val;
    else if (key === 'ex') word.ex = val;
    else throw new Error(`Dữ liệu từ sai ở ${word.id}: "${x}"`);
  }
  return word;
}

function parseUnit(block: string, grade: Grade, unit: number): Word[] {
  return block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .map((l) => parseLine(l, grade, unit));
}

/** BY_UNIT[grade][unit - 1] = các từ của Unit. */
export const BY_UNIT: Record<Grade, Word[][]> = {
  1: RAW[1].map((b, i) => parseUnit(b, 1, i + 1)),
  2: RAW[2].map((b, i) => parseUnit(b, 2, i + 1)),
  3: RAW[3].map((b, i) => parseUnit(b, 3, i + 1)),
  4: RAW[4].map((b, i) => parseUnit(b, 4, i + 1)),
  5: RAW[5].map((b, i) => parseUnit(b, 5, i + 1)),
};

export const BANK: Word[] = ([1, 2, 3, 4, 5] as Grade[]).flatMap((g) => BY_UNIT[g].flat());

export function unitWords(grade: Grade, unit: number): Word[] {
  return BY_UNIT[grade][unit - 1] ?? [];
}

const gradeCache = new Map<string, Word[]>();

/** Từ của Unit 1..upto (null = mọi Unit) trong một lớp; mỗi từ chỉ một lần (lấy Unit sớm nhất). */
export function gradeWords(grade: Grade, upto: number | null = null): Word[] {
  const key = `${grade}:${upto ?? 'all'}`;
  const hit = gradeCache.get(key);
  if (hit) return hit;
  const units = BY_UNIT[grade];
  const n = Math.min(units.length, upto ?? units.length);
  const seen = new Set<string>();
  const out: Word[] = [];
  for (let u = 0; u < n; u++) {
    for (const w of units[u]) {
      const k = w.w.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(w);
    }
  }
  gradeCache.set(key, out);
  return out;
}

/** Tìm từ theo chữ (không phân biệt hoa thường) trong toàn bộ ngân hàng. */
const WORD_SET = new Set(BANK.map((w) => w.w.toLowerCase()));
export function isBankWord(s: string): boolean {
  return WORD_SET.has(s.toLowerCase());
}

/* ---------------- Phương án nhiễu không gây nhầm ---------------- */

const CLASSIFIERS = new Set(['con', 'cái', 'quả', 'củ', 'chiếc', 'đôi', 'tờ', 'quyển', 'cuốn', 'bông', 'bức', 'ngôi', 'tấm']);

function viCore(vi: string): string {
  return vi
    .toLowerCase()
    .split(/[,;()]/)[0]
    .split(/\s+/)
    .filter((x) => x && !CLASSIFIERS.has(x))
    .join(' ');
}

function containsWords(a: string, b: string): boolean {
  return ` ${a} `.includes(` ${b} `);
}

/** Một từ đơn là phần đầu/cuối của từ kia (ball ⊂ football, rain ⊂ rainbow). */
function affix(a: string, b: string): boolean {
  if (a.includes(' ') || b.includes(' ')) return false;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 3 && s !== l && (l.startsWith(s) || l.endsWith(s));
}

/**
 * Nhóm từ dễ nhầm với nhau (hình gần giống hoặc nghĩa chồng lên nhau) – không đứng cạnh nhau
 * trong một câu hỏi. Thầy cô có thể thêm nhóm mới.
 */
const CONFUSABLE: string[][] = [
  ['car', 'taxi', 'van', 'driver'],
  ['boat', 'ship', 'boating'],
  ['hat', 'cap', 'sun hat'],
  ['shoes', 'boots', 'hiking', 'go hiking'],
  ['tree', 'forest', 'school garden', 'climb trees', 'plant trees'],
  ['sea', 'beach', 'island', 'swim in the sea'],
  ['face', 'smile', 'happy', 'head', 'funny'],
  ['eye', 'eyes', 'look'],
  ['hand', 'wave', 'finger', 'arm', 'touch', 'hello', 'hi', 'help'],
  ['leg', 'foot', 'on foot'],
  ['run', 'running', 'go out'],
  ['draw', 'drawing', 'paint pictures', 'painting', 'draw pictures', 'art', 'art room', 'artist'],
  ['book', 'books', 'reading', 'read books', 'read stories', 'story', 'library', 'bookcase', 'bookshop', 'notebook'],
  ['bike', 'cycling', 'ride a bike'],
  ['camp', 'camping', 'go camping', 'tent', 'campfire', 'fire'],
  ['party', 'birthday', 'celebrate', 'happy new year'],
  ['pupil', 'boy', 'girl', 'baby', 'classmate'],
  ['birthday', 'cake', 'cupcake', 'candle'],
  ['fish', 'aquarium', 'fishing', 'go fishing'],
  ['sun', 'sunny', 'summer', 'hot', 'summer holiday'],
  ['moon', 'mooncake', 'lantern', 'mid-autumn festival'],
  ['hen', 'rooster', 'chicken'],
  ['noodles', 'pasta'],
  ['salad', 'vegetables', 'eat vegetables'],
  ['cup', 'tea', 'drink'],
  ['house', 'village', 'garden'],
  ['city', 'town'],
  ['maths', 'plus', 'minus', 'number', 'abacus'],
  ['medal', 'prize', 'trophy', 'win'],
  ['flag', 'race'],
  ['leaf', 'autumn'],
  ['fever', 'thermometer'],
  ['shop', 'supermarket', 'shopping centre', 'go shopping', 'shopping bag'],
];

/**
 * Từ chỉ chung (bird, fruit…) – không đứng cạnh các từ thuộc nhóm của nó (parrot, apple…).
 * Giá trị: từ cụ thể, hoặc "#nhãn" = mọi từ mang nhãn đó.
 */
const HYPER: Record<string, string[]> = {
  bird: ['parrot', 'peacock', 'owl', 'swan', 'duck', 'hen', 'rooster', 'penguin'],
  fish: ['whale', 'dolphin', 'goldfish'],
  flower: ['rose', 'peach blossom', 'apricot blossom'],
  flowers: ['rose', 'peach blossom', 'apricot blossom'],
  vegetables: ['#veg'],
  'eat vegetables': ['#veg'],
  'eat fruit': ['#fruit'],
  drink: ['#drink'],
  'fizzy drinks': ['milkshake', 'lemonade', 'juice'],
  animal: ['#animal'],
  pet: ['#animal'],
  'fast food': ['pizza', 'hot dog', 'chips', 'sandwich'],
  sweets: ['lollipop', 'chocolate'],
  number: ['#number'],
  game: ['puzzle', 'dice', 'play chess', 'playing chess', 'play board games'],
  'play games': ['puzzle', 'dice', 'play chess', 'playing chess', 'play board games'],
  'play board games': ['dice', 'game', 'play chess', 'playing chess'],
  clothes: ['#clothes'],
  'new clothes': ['#clothes'],
  family: ['#family'],
  colour: ['#colour'],
  weather: ['#weather'],
  season: ['#season'],
  job: ['#job'],
  country: ['#country'],
  month: ['#month'],
  day: ['#day'],
  week: ['#day'],
  weekend: ['#day'],
  today: ['#day'],
  subject: ['#subject'],
  hobby: ['#hobby'],
  'free time': ['#hobby'],
  transport: ['#transport'],
  place: ['#place'],
  activity: ['#action', '#hobby'],
  'sports day': ['#sport'],
  music: ['#music'],
  man: ['#job', '#family', 'friend', 'friends', 'pupil', 'classmate', 'parents'],
  woman: ['#job', '#family', 'friend', 'friends', 'pupil', 'classmate', 'parents'],
  boy: ['#job', '#family', 'friend', 'friends', 'pupil', 'classmate', 'parents'],
  girl: ['#job', '#family', 'friend', 'friends', 'pupil', 'classmate', 'parents'],
};

/** Hai nhãn không đứng cạnh nhau (hình tròn ⭕/ô vuông 🟦 dễ bị hiểu là màu). */
const TAG_CLASH: [string, string][] = [['colour', 'shape']];

const lc = (s: string) => s.toLowerCase();
const emo = (e: string) => e.replace(/\uFE0F/g, '');

function addTo(m: Map<string, Set<string>>, k: string, v: string): void {
  let s = m.get(k);
  if (!s) m.set(k, (s = new Set()));
  s.add(v);
}

// Gộp thông tin của cùng một từ ở mọi lớp (fish 🐟 ở Lớp 1 và 🐠 ở Lớp 2 đều là "fish").
const EMO = new Map<string, Set<string>>();
const GRP = new Map<string, Set<string>>();
const ALT = new Map<string, Set<string>>();
const TAGSET = new Map<string, Set<string>>();
const SETS = new Map<string, Set<string>>();
for (const w of BANK) {
  const k = lc(w.w);
  addTo(EMO, k, emo(w.e));
  if (w.grp) addTo(GRP, k, w.grp);
  for (const a of w.alt) {
    addTo(ALT, k, lc(a));
    addTo(ALT, lc(a), k);
  }
  for (const t of w.tags) addTo(TAGSET, k, t);
}
CONFUSABLE.forEach((set, i) => set.forEach((x) => addTo(SETS, x, String(i))));

function meets(a: Set<string> | undefined, b: Set<string> | undefined): boolean {
  if (!a || !b) return false;
  for (const x of a) if (b.has(x)) return true;
  return false;
}

function hyper(general: string, other: string): boolean {
  const list = HYPER[general];
  if (!list) return false;
  const tags = TAGSET.get(other);
  return list.some((x) => (x.startsWith('#') ? !!tags?.has(x.slice(1)) : x === other));
}

/** Hai từ (viết thường) có thể gây nhầm – dùng cả cho từ không có trong ngân hàng (chỉ so chữ). */
export function wordsConflict(aw: string, bw: string): boolean {
  if (aw === bw) return true;
  if (meets(EMO.get(aw), EMO.get(bw)) || meets(GRP.get(aw), GRP.get(bw)) || meets(SETS.get(aw), SETS.get(bw))) return true;
  if (ALT.get(aw)?.has(bw)) return true;
  if (containsWords(aw, bw) || containsWords(bw, aw) || affix(aw, bw)) return true;
  if (hyper(aw, bw) || hyper(bw, aw)) return true;
  const ta = TAGSET.get(aw);
  const tb = TAGSET.get(bw);
  if (ta && tb && TAG_CLASH.some(([x, y]) => (ta.has(x) && tb.has(y)) || (ta.has(y) && tb.has(x)))) return true;
  return false;
}

/**
 * Hai từ có thể gây nhầm khi đứng cạnh nhau trong một câu hỏi: cùng chữ, cùng hình (ở bất kì lớp nào),
 * cùng nghĩa, đồng nghĩa, cùng nhóm dễ nhầm, từ chung – từ riêng (bird/parrot), hoặc từ này nằm trong
 * từ kia (ball/football) → không dùng làm phương án nhiễu cho nhau.
 */
export function conflicts(a: Word, b: Word): boolean {
  if (a === b) return true;
  if (emo(a.e) === emo(b.e) || (a.grp && a.grp === b.grp)) return true;
  if (wordsConflict(lc(a.w), lc(b.w))) return true;
  const av = viCore(a.vi);
  const bv = viCore(b.vi);
  if (!av || !bv || av === bv || containsWords(av, bv) || containsWords(bv, av)) return true;
  return false;
}
