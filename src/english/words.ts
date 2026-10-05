/** Từ và quy tắc ngữ pháp dùng chung cho bộ câu hỏi Tiếng Anh (chính tả Anh – Anh). */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0..100 → chữ, ví dụ 42 → "forty-two". */
export function numberWord(n: number): string {
  if (n < 0 || n > 100 || !Number.isInteger(n)) throw new Error(`numberWord: ${n}`);
  if (n === 100) return 'one hundred';
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

const ORD = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth',
];

/** 1..31 → số thứ tự bằng chữ, ví dụ 21 → "twenty-first". */
export function ordinalWord(n: number): string {
  if (n < 1 || n > 31 || !Number.isInteger(n)) throw new Error(`ordinalWord: ${n}`);
  if (n < 20) return ORD[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (!o) return TENS[t].replace(/y$/, 'ieth');
  return `${TENS[t]}-${ORD[o]}`;
}

/** 1..31 → "1st", "2nd", "3rd", "11th", "22nd"… */
export function ordinalShort(n: number): string {
  const k = n % 100;
  if (k >= 11 && k <= 13) return `${n}th`;
  const s = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${s}`;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_VI = ['thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy', 'Chủ nhật'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTHS_VI = [
  'tháng Một', 'tháng Hai', 'tháng Ba', 'tháng Tư', 'tháng Năm', 'tháng Sáu',
  'tháng Bảy', 'tháng Tám', 'tháng Chín', 'tháng Mười', 'tháng Mười Một', 'tháng Mười Hai',
];
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
export const VOWELS = ['a', 'e', 'i', 'o', 'u'];

/** Từ bắt đầu bằng nguyên âm nhưng đọc như phụ âm (dùng "a"), hoặc ngược lại (dùng "an"). */
const A_EXCEPT = /^(uni|use|usu|eu|one\b|once\b)/i;
const AN_EXCEPT = /^(hour|honest|honour)/i;

export function article(word: string): 'a' | 'an' {
  const w = word.trim();
  if (AN_EXCEPT.test(w)) return 'an';
  if (A_EXCEPT.test(w)) return 'a';
  return /^[aeiou]/i.test(w) ? 'an' : 'a';
}

export function withArticle(word: string): string {
  return `${article(word)} ${word}`;
}

// Chính tả Anh – Anh: travel → travelling, travelled.
const DOUBLE = new Set(['swim', 'run', 'sit', 'get', 'stop', 'shop', 'put', 'cut', 'begin', 'skip', 'jog', 'clap', 'hop', 'chat', 'plan', 'dig', 'win', 'hug', 'drop', 'nap', 'travel']);

function ingWord(v: string): string {
  if (v === 'be') return 'being';
  if (v === 'see') return 'seeing';
  if (/ie$/.test(v)) return v.slice(0, -2) + 'ying';
  if (DOUBLE.has(v)) return v + v.slice(-1) + 'ing';
  if (/[^aeiouy]e$/.test(v) || /ue$/.test(v)) return v.slice(0, -1) + 'ing';
  return v + 'ing';
}

/** Thêm -ing vào động từ đầu cụm: "ride a bike" → "riding a bike". */
export function ing(phrase: string): string {
  const [first, ...rest] = phrase.split(' ');
  return [ingWord(first), ...rest].join(' ');
}

function sWord(v: string): string {
  if (v === 'have') return 'has';
  if (v === 'be') return 'is';
  if (v === 'do' || v === 'go') return v + 'es';
  if (/(s|x|z|ch|sh)$/.test(v)) return v + 'es';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies';
  return v + 's';
}

/** Ngôi thứ ba số ít cho động từ đầu cụm: "wash the dishes" → "washes the dishes". */
export function thirdPerson(phrase: string): string {
  const [first, ...rest] = phrase.split(' ');
  return [sWord(first), ...rest].join(' ');
}

const IRREGULAR_PAST: Record<string, string> = {
  go: 'went', have: 'had', do: 'did', eat: 'ate', see: 'saw', make: 'made', take: 'took', get: 'got',
  swim: 'swam', run: 'ran', ride: 'rode', fly: 'flew', buy: 'bought', read: 'read', sing: 'sang',
  draw: 'drew', write: 'wrote', drink: 'drank', sleep: 'slept', build: 'built', come: 'came', sit: 'sat',
  be: 'was', feed: 'fed', win: 'won', meet: 'met', give: 'gave', wear: 'wore',
};

function pastWord(v: string): string {
  if (IRREGULAR_PAST[v]) return IRREGULAR_PAST[v];
  if (/e$/.test(v)) return v + 'd';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ied';
  if (DOUBLE.has(v)) return v + v.slice(-1) + 'ed';
  return v + 'ed';
}

/** Quá khứ đơn cho động từ đầu cụm: "visit a farm" → "visited a farm". */
export function past(phrase: string): string {
  const [first, ...rest] = phrase.split(' ');
  return [pastWord(first), ...rest].join(' ');
}

/**
 * Số nhiều theo quy tắc cho từ cuối cụm: "teddy bear" → "teddy bears".
 * Chỉ «-ife» đổi thành «-ives» (knife → knives); giraffe, cafe, safe… chỉ thêm «s».
 * Từ có dạng số nhiều khác (leaf → leaves, wolf → wolves) ghi `pl=` trong dữ liệu.
 */
export function pluralOf(phrase: string): string {
  const parts = phrase.split(' ');
  const last = parts.pop() as string;
  let p: string;
  if (/(s|x|z|ch|sh)$/.test(last)) p = last + 'es';
  else if (/[^aeiou]y$/.test(last)) p = last.slice(0, -1) + 'ies';
  else if (/ife$/.test(last)) p = last.slice(0, -2) + 'ves';
  else p = last + 's';
  return [...parts, p].join(' ');
}

/** Giờ kiểu Anh: 7:00 → "seven o'clock", 7:30 → "half past seven", 7:15 → "quarter past seven", 7:45 → "quarter to eight". */
export function timeWords(h: number, m: number): string {
  const hour = (x: number) => numberWord(((x - 1 + 12) % 12) + 1);
  if (m === 0) return `${hour(h)} o'clock`;
  if (m === 30) return `half past ${hour(h)}`;
  if (m === 15) return `quarter past ${hour(h)}`;
  if (m === 45) return `quarter to ${hour(h + 1)}`;
  if (m < 30) return `${numberWord(m)} past ${hour(h)}`;
  return `${numberWord(60 - m)} to ${hour(h + 1)}`;
}

/** Cách nói giờ tiếng Việt tương ứng. */
export function timeVi(h: number, m: number): string {
  const hh = ((h - 1 + 12) % 12) + 1;
  if (m === 0) return `${hh} giờ đúng`;
  if (m === 30) return `${hh} giờ rưỡi`;
  if (m === 45) return `${hh} giờ 45 phút (${(hh % 12) + 1} giờ kém 15)`;
  return `${hh} giờ ${m} phút`;
}

/** Đánh vần "a-p-p-l-e" (cụm nhiều từ: đánh vần từng từ). */
export function spellOut(word: string): string {
  return word
    .split(' ')
    .map((p) => p.replace(/[^A-Za-z]/g, '').toLowerCase().split('').join('-'))
    .filter(Boolean)
    .join(' / ');
}

/** Cách viết kiểu Mỹ – không bao giờ dùng làm đáp án (bộ sách dùng chính tả Anh). */
export const US_SPELLINGS = ['color', 'colors', 'favorite', 'gray', 'center', 'theater', 'mom', 'donut', 'math', 'neighbor', 'traveling', 'pajamas', 'jewelry', 'eraser'];
