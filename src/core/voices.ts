/**
 * Phần thuần của giọng đọc (không dùng DOM/âm thanh, kiểm thử được): chuẩn hóa văn bản theo ngôn ngữ,
 * tách đoạn tiếng Anh «…» khỏi lời tiếng Việt, xếp hạng giọng đọc.
 */

export type Lang = 'vi' | 'en';

export interface SpeechPart {
  text: string;
  lang: Lang;
}

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

/** Chuẩn hóa văn bản để đọc. 'vi': bỏ emoji, đọc ký hiệu toán bằng tiếng Việt; 'en': chỉ bỏ emoji và dấu «». */
export function speechText(text: string, lang: Lang = 'vi'): string {
  if (lang === 'en') {
    return text
      .replace(EMOJI, '')
      .replace(/[«»]/g, '')
      .replace(/_{2,}/g, ' ... ')
      // Đánh vần "a-p-p-l-e" → "A, P, P, L, E" để giọng đọc đọc từng chữ cái (yo-yo, T-shirt giữ nguyên).
      .replace(/\b[a-z](?:-[a-z])+\b/gi, (m) => m.toUpperCase().split('-').join(', '))
      .replace(/\s+\/\s+/g, '. ')
      .replace(/\bIT\b\.?/g, 'I.T.')
      .replace(/\bPE\b\.?/g, 'P.E.')
      .replace(/\s+/g, ' ')
      .trim()
      // Một chữ cái đứng riêng đọc thành tên chữ cái ("b" → "B", "the letter b" → "the letter B").
      .replace(/^([a-z])$/i, (m) => m.toUpperCase())
      .replace(/\bletter ([a-z])\b/gi, (m, c: string) => m.slice(0, -1) + c.toUpperCase());
  }
  return text
    .replace(EMOJI, '')
    .replace(/[«»]/g, '')
    .replace(/(\d)\s*\+\s*(\d)/g, '$1 cộng $2')
    .replace(/(\d)\s*[−-]\s*(\d)/g, '$1 trừ $2')
    .replace(/(\d)\s*[×x]\s*(\d)/g, '$1 nhân $2')
    .replace(/(\d)\s*:\s*(\d)/g, '$1 chia $2')
    .replace(/=\s*\?/g, 'bằng bao nhiêu')
    .replace(/=/g, ' bằng ')
    .replace(/\?{2,}/g, '?')
    .replace(/…/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Có đoạn tiếng Anh đánh dấu «…» không. */
export function hasEnglish(text: string): boolean {
  return text.includes('«');
}

/**
 * Tách lời đọc thành các đoạn theo ngôn ngữ: phần trong «…» là tiếng Anh, phần còn lại là tiếng Việt.
 * Bỏ các đoạn chỉ có dấu câu/emoji.
 */
export function splitLang(text: string): SpeechPart[] {
  const parts: SpeechPart[] = [];
  const re = /«([^»]*)»/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (t: string, lang: Lang) => {
    const clean = t.replace(EMOJI, '').trim();
    if (/[\p{L}\p{N}]/u.test(clean)) parts.push({ text: clean, lang });
  };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index), 'vi');
    push(m[1], 'en');
    last = m.index + m[0].length;
  }
  push(text.slice(last), 'vi');
  return parts;
}

/** Bỏ dấu «» để hiển thị dạng chữ thường (nhãn 3D, thông báo). */
export function plainText(text: string): string {
  return text.replace(/[«»]/g, '');
}

export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
}

const EN_TIERS: RegExp[] = [
  /\b(sonia|libby|ryan|aria|jenny|guy)\b.*\b(natural|online)\b|\b(natural|online)\b.*\b(sonia|libby|ryan|aria|jenny|guy)\b/i,
  /google.*english/i,
  /\b(natural|online)\b/i,
  /\b(hazel|susan|george)\b/i,
  /\b(zira|david|mark)\b/i,
];

// Giữ đúng thứ tự chọn giọng tiếng Việt như trước.
const VI_TIERS: RegExp[] = [/^(?=.*(natural|online))(?=.*(hoaimy|hoài my|female|nữ))/i, /natural|online/i, /hoaimy|an\b/i];

function tierOf(v: VoiceLike, tiers: RegExp[]): number {
  const i = tiers.findIndex((re) => re.test(v.name));
  return i < 0 ? tiers.length : i;
}

/**
 * Xếp hạng giọng đọc cho một ngôn ngữ (tốt nhất trước). Khi mất mạng, giọng cục bộ của máy được ưu tiên
 * (giọng "Online (Natural)" cần Internet).
 */
export function rankVoices<T extends VoiceLike>(voices: readonly T[], lang: Lang, online = true): T[] {
  const tiers = lang === 'en' ? EN_TIERS : VI_TIERS;
  const list = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
  const score = (v: T) => (online || v.localService ? 0 : 100) + tierOf(v, tiers);
  return list
    .map((v, i) => ({ v, i, s: score(v) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.v);
}
