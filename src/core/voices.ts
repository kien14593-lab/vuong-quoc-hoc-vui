import { voiceProfile, type VoiceProfile } from './voice-profiles';

/**
 * Phần thuần của giọng đọc (không dùng DOM/âm thanh, kiểm thử được): chuẩn hóa văn bản theo ngôn ngữ,
 * tách đoạn tiếng Anh «…» khỏi lời tiếng Việt, xếp hạng và chọn giọng, lên kế hoạch đọc theo giọng nhân vật.
 */

export type Lang = 'vi' | 'en';

export interface SpeechPart {
  text: string;
  lang: Lang;
  /** Người nói: mã giọng nhân vật (xem voice-profiles.ts). Không có = giọng dẫn chuyện. */
  who?: string;
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
  /**
   * Mã giọng. Trên iPhone/iPad nhiều giọng trùng tên ("Linh"), chỉ mã này phân biệt được chất lượng:
   * com.apple.voice.compact.vi-VN.Linh / com.apple.voice.enhanced.vi-VN.Linh / com.apple.voice.premium.vi-VN.Linh.
   */
  voiceURI?: string;
}

/** Giọng đã chọn trong Cài đặt: lưu theo voiceURI, giữ cả tên để tìm lại khi mã không còn. */
export interface VoiceChoice {
  uri: string;
  name: string;
}

const EN_TIERS: RegExp[] = [
  /\b(sonia|libby|ryan|aria|jenny|guy)\b.*\b(natural|online)\b|\b(natural|online)\b.*\b(sonia|libby|ryan|aria|jenny|guy)\b/i,
  /google.*english/i,
  /\b(natural|online)\b/i,
  /\b(hazel|susan|george)\b/i,
  /\b(zira|david|mark)\b/i,
  /premium|cao cấp/i,
  /enhanced|nâng cao/i,
];

/**
 * Giọng tiếng Việt: Hoài My trực tuyến (Edge) → giọng trực tuyến khác → giọng cao cấp / nâng cao đã tải
 * (iPhone, iPad, Mac) → giọng qua mạng (Android) → Hoài My / Microsoft An cục bộ → còn lại (giọng thường, "Compact").
 * Máy tính giữ đúng thứ tự chọn như trước (Edge: Hoài My Online; Chrome/Windows: Microsoft An).
 */
const VI_TIERS: RegExp[] = [
  /^(?=.*(natural|online))(?=.*(hoaimy|hoài my|female|nữ))/i,
  /natural|online/i,
  /premium|cao cấp/i,
  /enhanced|nâng cao/i,
  /network/i,
  /hoaimy|an\b/i,
];

/** Giọng nam tiếng Việt. Không dùng chữ "nam" đơn lẻ: "Tiếng Việt Việt Nam", "Vietnamese (Vietnam)" không phải giọng nam. */
const MALE_VI: RegExp[] = [/nam ?minh/i, /^microsoft an\b/i, /\bmale\b/i];

/** Giọng vui / rất thô của Apple (Fred, Grandpa, "super-compact"…): xếp sau mọi giọng khác. */
const NOVELTY = /super-?compact|com\.apple\.speech\.synthesis\.voice\.|com\.apple\.eloquence\./i;

/** So mẫu với tên giọng và với voiceURI (nếu khác tên). */
function matches(re: RegExp, v: VoiceLike): boolean {
  return re.test(v.name) || (!!v.voiceURI && v.voiceURI !== v.name && re.test(v.voiceURI));
}

function tierOf(v: VoiceLike, tiers: RegExp[]): number {
  if (matches(NOVELTY, v)) return tiers.length + 1;
  const i = tiers.findIndex((re) => matches(re, v));
  return i < 0 ? tiers.length : i;
}

function rankWith<T extends VoiceLike>(list: readonly T[], tiers: RegExp[], online: boolean): T[] {
  const score = (v: T) => (online || v.localService ? 0 : 100) + tierOf(v, tiers);
  return list
    .map((v, i) => ({ v, i, s: score(v) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.v);
}

/**
 * Xếp hạng giọng đọc cho một ngôn ngữ (tốt nhất trước). Khi mất mạng, giọng cục bộ của máy được ưu tiên
 * (giọng "Online (Natural)" cần Internet).
 */
export function rankVoices<T extends VoiceLike>(voices: readonly T[], lang: Lang, online = true): T[] {
  const list = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
  return rankWith(list, lang === 'en' ? EN_TIERS : VI_TIERS, online);
}

/** Giọng nam tiếng Việt (Nam Minh, Microsoft An…). */
export function isMaleVi(v: VoiceLike): boolean {
  return MALE_VI.some((re) => matches(re, v));
}

/** Khóa ổn định của một giọng: voiceURI, không có thì tên. */
export function voiceKey(v: VoiceLike): string {
  return v.voiceURI || v.name;
}

/** Tìm giọng đã chọn trong danh sách đã xếp hạng: đúng voiceURI trước; mã không còn thì giọng tốt nhất cùng tên. */
export function findChosen<T extends VoiceLike>(ranked: readonly T[], c: VoiceChoice | null | undefined): T | null {
  if (!c) return null;
  return ranked.find((v) => voiceKey(v) === c.uri) ?? ranked.find((v) => v.name === c.name) ?? null;
}

export interface VoicePick<T extends VoiceLike = VoiceLike> {
  /** Giọng tiếng Việt, tốt nhất trước. */
  vi: T[];
  /** Giọng dẫn chuyện và nhân vật nữ: giọng chọn trong Cài đặt, không thì giọng tiếng Việt tốt nhất. */
  nu: T | null;
  /** Giọng nam tiếng Việt; null nếu máy không có. */
  nam: T | null;
  en: T | null;
}

/**
 * Chọn giọng cho mọi vai. `chosen` (Cài đặt → Chọn giọng đọc) thay giọng dẫn chuyện; khi mất mạng bỏ qua
 * giọng đã chọn nếu nó cần mạng.
 */
export function pickVoices<T extends VoiceLike>(voices: readonly T[], online = true, chosen?: VoiceChoice | null): VoicePick<T> {
  const vi = rankVoices(voices, 'vi', online);
  const c = findChosen(vi, chosen);
  return {
    vi,
    nu: c && (online || c.localService) ? c : (vi[0] ?? null),
    nam: rankWith(vi.filter(isMaleVi), MALE_VI, online)[0] ?? null,
    en: rankVoices(voices, 'en', online)[0] ?? null,
  };
}

export interface VoiceUse<T extends VoiceLike = VoiceLike> {
  voice: T;
  pitch: number;
}

/** Cao độ của nhân vật nam khi máy chỉ có giọng nữ: đọc trầm hơn (×0.85), giữ trong khoảng 0.6–1.5. */
export function malePitchFallback(pitch: number): number {
  return Math.min(1.5, Math.max(0.6, pitch * 0.85));
}

/** Giọng và cao độ cho một hồ sơ giọng; null nếu máy không có giọng tiếng Việt. */
export function resolveVoice<T extends VoiceLike>(p: VoiceProfile, pick: VoicePick<T>): VoiceUse<T> | null {
  const pref = p.prefer ? pick.vi.find((v) => matches(p.prefer!, v)) : undefined;
  if (pref) return { voice: pref, pitch: p.pitch };
  if (p.base === 'nam' && pick.nam) return { voice: pick.nam, pitch: p.pitch };
  if (!pick.nu) return null;
  return { voice: pick.nu, pitch: p.base === 'nam' ? malePitchFallback(p.pitch) : p.pitch };
}

export interface PlanOpts {
  /** Tốc độ đọc trong Cài đặt. */
  voiceRate: number;
  /** Cài đặt "Giọng nhân vật": tắt thì mọi lời dùng giọng dẫn chuyện. */
  charVoices: boolean;
  /** Tốc độ tiếng Anh theo lớp (0.85 lớp 1–2, 0.9 lớp 3–5). */
  enRate: number;
}

export interface SpeechStep<T extends VoiceLike = VoiceLike> {
  lang: Lang;
  /** Lời đã chuẩn hóa để đọc. */
  text: string;
  who: string | null;
  /** Hồ sơ giọng đã dùng: 'narrator', 'en' hoặc mã nhân vật. */
  profile: string;
  voice: T;
  rate: number;
  pitch: number;
  /** Đọc lại một lần bằng giọng cục bộ khi giọng trực tuyến lỗi (thường do mất mạng). */
  retry: VoiceUse<T> | null;
}

function fallback<T extends VoiceLike>(v: T, r: VoiceUse<T> | null): VoiceUse<T> | null {
  return !v.localService && r && r.voice !== v ? r : null;
}

/**
 * Lên kế hoạch đọc: mỗi đoạn một giọng. Lời tiếng Việt theo giọng của người nói, phần tiếng Anh «…» luôn dùng
 * giọng tiếng Anh (cao độ 1). Đoạn rỗng hoặc máy không có giọng thì bỏ qua.
 * `local`: lựa chọn chỉ trong các giọng cục bộ (dự phòng khi mất mạng).
 */
export function planSpeech<T extends VoiceLike>(parts: readonly SpeechPart[], pick: VoicePick<T>, local: VoicePick<T>, o: PlanOpts): SpeechStep<T>[] {
  const out: SpeechStep<T>[] = [];
  for (const p of parts) {
    const text = speechText(p.text, p.lang);
    if (!text) continue;
    const who = p.who ?? null;
    if (p.lang === 'en') {
      if (!pick.en) continue;
      const retry = fallback(pick.en, local.en ? { voice: local.en, pitch: 1 } : null);
      out.push({ lang: 'en', text, who, profile: 'en', voice: pick.en, rate: o.enRate * o.voiceRate, pitch: 1, retry });
      continue;
    }
    const { id, profile } = voiceProfile(who, o.charVoices);
    const use = resolveVoice(profile, pick);
    if (!use) continue;
    const retry = fallback(use.voice, resolveVoice(profile, local));
    out.push({ lang: 'vi', text, who, profile: id, voice: use.voice, rate: profile.rate * o.voiceRate, pitch: use.pitch, retry });
  }
  return out;
}

/** Chất lượng giọng Apple đọc từ voiceURI / tên (premium → Cao cấp, enhanced → Nâng cao, compact → Cơ bản). */
export function voiceQuality(v: VoiceLike): 'Cao cấp' | 'Nâng cao' | 'Cơ bản' | null {
  const uri = v.voiceURI ?? '';
  const s = `${uri} ${v.name}`;
  // iOS cũ (com.apple.ttsbundle.Linh-premium): "premium" là bản "Nâng cao" trong Cài đặt.
  if (/com\.apple\.ttsbundle\..*premium/i.test(uri)) return 'Nâng cao';
  if (/premium|cao cấp/i.test(s)) return 'Cao cấp';
  if (/enhanced|nâng cao/i.test(s)) return 'Nâng cao';
  if (/compact|cơ bản/i.test(s) || /^com\.apple\./i.test(uri)) return 'Cơ bản';
  return null;
}

/**
 * Nhãn cho ô "Chọn giọng đọc" (theo thứ tự `ranked`): giọng Apple ghi tên + chất lượng ("Linh (Nâng cao)"),
 * giọng Microsoft / Google ghi tên người đọc ("Hoài My"), tên chỉ có chữ thì giữ nguyên ("Tiếng Việt Việt Nam"),
 * còn mã khó đọc trên Android ("vi-vn-x-gft-local") ghi "Giọng 1, 2…".
 * Thêm "(cần mạng)" cho giọng trực tuyến. Nhãn trùng được đánh số.
 */
export function voiceLabels(ranked: readonly VoiceLike[]): string[] {
  const used = new Map<string, number>();
  let n = 0;
  return ranked.map((v) => {
    const q = voiceQuality(v);
    const name = v.name.trim();
    const ms = /^microsoft\s+(.+?)(?:\s+online\b.*|\s+-\s.*)?$/i.exec(name);
    let label = q
      ? `${name.replace(/\s*\([^)]*\)\s*$/, '').trim() || 'Giọng'} (${q})`
      : ms
        ? ms[1]
        : /^google\s/i.test(name) || /^[\p{L}\s]+$/u.test(name)
          ? name
          : `Giọng ${++n}`;
    const k = (used.get(label) ?? 0) + 1;
    used.set(label, k);
    if (k > 1) label += ` ${k}`;
    return v.localService ? label : `${label} (cần mạng)`;
  });
}
