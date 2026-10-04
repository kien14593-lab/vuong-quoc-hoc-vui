import { audio } from './audio';
import { getSettings, hasProfile, profile, type Settings } from './state';
import { hasEnglish, rankVoices, speechText, splitLang, type Lang, type SpeechPart } from './voices';

export { speechText, plainText, type SpeechPart } from './voices';

/**
 * Đọc lời thoại bằng giọng của hệ điều hành: giọng tiếng Việt cho lời dẫn, giọng tiếng Anh (en-GB/en-US)
 * cho phần tiếng Anh được đánh dấu «…».
 */
const best: Record<Lang, SpeechSynthesisVoice | null> = { vi: null, en: null };
/** Giọng cục bộ dự phòng khi giọng trực tuyến lỗi (mất mạng). */
const local: Record<Lang, SpeechSynthesisVoice | null> = { vi: null, en: null };
let ready = false;

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function pickVoice(): void {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  for (const lang of ['vi', 'en'] as Lang[]) {
    const ranked = rankVoices(voices, lang, online());
    best[lang] = ranked[0] ?? null;
    local[lang] = ranked.find((v) => v.localService) ?? null;
  }
  ready = true;
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', pickVoice);
    window.addEventListener('offline', pickVoice);
  }
}

export function hasVietnameseVoice(): boolean {
  if (!ready) pickVoice();
  return best.vi !== null;
}

export function voiceName(): string | null {
  return best.vi?.name ?? null;
}

export function hasEnglishVoice(): boolean {
  if (!ready) pickVoice();
  return best.en !== null;
}

export function englishVoiceName(): string | null {
  if (!ready) pickVoice();
  return best.en?.name ?? null;
}

/** Có thể ra câu hỏi nghe tiếng Anh: giọng đọc đang bật và máy có giọng tiếng Anh. */
export function canListen(): boolean {
  return getSettings().voice && hasEnglishVoice();
}

function rate(lang: Lang, s: Settings): number {
  if (lang === 'vi') return 0.95 * s.voiceRate;
  const grade = hasProfile() ? profile().grade : 3;
  return (grade <= 2 ? 0.85 : 0.9) * s.voiceRate;
}

let token = 0;

function run(queue: SpeechPart[], i: number, my: number, s: Settings, retried = false): void {
  if (my !== token) return;
  if (i >= queue.length) {
    audio.setDuck(false);
    return;
  }
  const p = queue[i];
  const v = retried ? local[p.lang] : best[p.lang];
  if (!v) {
    run(queue, i + 1, my, s);
    return;
  }
  try {
    const u = new SpeechSynthesisUtterance(p.text);
    u.voice = v;
    u.lang = v.lang;
    u.rate = rate(p.lang, s);
    u.pitch = p.lang === 'vi' ? 1.1 : 1;
    u.onstart = () => audio.setDuck(true);
    u.onend = () => run(queue, i + 1, my, s);
    u.onerror = (e) => {
      if (my !== token) return;
      const err = (e as SpeechSynthesisErrorEvent).error;
      if (err === 'interrupted' || err === 'canceled') {
        audio.setDuck(false);
        return;
      }
      // Giọng trực tuyến lỗi (thường do mất mạng): đọc lại một lần bằng giọng cục bộ.
      if (!retried && !v.localService && local[p.lang] && local[p.lang] !== v) run(queue, i, my, s, true);
      else run(queue, i + 1, my, s);
    };
    speechSynthesis.speak(u);
  } catch {
    audio.setDuck(false);
  }
}

/**
 * Đọc lần lượt nhiều đoạn (ví dụ lời dẫn tiếng Việt rồi từ tiếng Anh). Hủy lời đang đọc trước đó.
 * Đoạn nào máy không có giọng thì bỏ qua (phần tiếng Anh vẫn đọc khi thiếu giọng tiếng Việt).
 */
export function speakParts(parts: SpeechPart[], opts: { force?: boolean } = {}): void {
  if (typeof speechSynthesis === 'undefined') return;
  const s = getSettings();
  if (!s.voice && !opts.force) return;
  if (!ready) pickVoice();
  const queue = parts
    .map((p) => ({ lang: p.lang, text: speechText(p.text, p.lang) }))
    .filter((p) => p.text && best[p.lang]);
  if (!queue.length) return;
  const my = ++token;
  try {
    speechSynthesis.cancel();
  } catch {
    /* bỏ qua */
  }
  run(queue, 0, my, s);
}

/** Đọc một câu. Câu có phần «tiếng Anh» được đọc bằng hai giọng nối tiếp nhau. */
export function speak(text: string, opts: { force?: boolean } = {}): void {
  speakParts(hasEnglish(text) ? splitLang(text) : [{ text, lang: 'vi' }], opts);
}

/** Chỉ đọc phần tiếng Anh (nút Nghe lại của câu hỏi nghe). */
export function speakEnglish(text: string, opts: { force?: boolean } = {}): void {
  speakParts([{ text, lang: 'en' }], opts);
}

export function stopSpeech(): void {
  if (typeof speechSynthesis === 'undefined') return;
  token++;
  try {
    speechSynthesis.cancel();
  } catch {
    /* bỏ qua */
  }
  audio.setDuck(false);
}
