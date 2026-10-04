import { audio } from './audio';
import { bus } from './events';
import { QA } from './qa';
import { getSettings, hasProfile, profile } from './state';
import {
  hasEnglish,
  pickVoices,
  planSpeech,
  rankVoices,
  splitLang,
  voiceKey,
  voiceLabels,
  findChosen,
  type SpeechPart,
  type SpeechStep,
  type VoiceChoice,
  type VoicePick,
} from './voices';

export { speechText, plainText, type SpeechPart } from './voices';

/**
 * Đọc lời thoại bằng giọng của hệ điều hành: giọng tiếng Việt cho lời dẫn (mỗi nhân vật một giọng riêng,
 * xem voice-profiles.ts), giọng tiếng Anh (en-GB/en-US) cho phần tiếng Anh được đánh dấu «…».
 */
type V = SpeechSynthesisVoice;

const NONE: VoicePick<V> = { vi: [], nu: null, nam: null, en: null };
let all: V[] = [];
let pick: VoicePick<V> = NONE;
/** Lựa chọn chỉ trong các giọng cục bộ: dự phòng khi giọng trực tuyến lỗi (mất mạng). */
let local: VoicePick<V> = NONE;
let ready = false;
let choiceKey = '';
const listeners = new Set<() => void>();

function online(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function chosen(): VoiceChoice | null {
  return getSettings().voiceVi ?? null;
}

function pickVoice(): void {
  if (typeof speechSynthesis === 'undefined') return;
  let voices: V[];
  try {
    voices = speechSynthesis.getVoices();
  } catch {
    return;
  }
  if (!voices.length) return;
  const on = online();
  const c = chosen();
  all = voices;
  pick = pickVoices(voices, on, c);
  local = pickVoices(
    voices.filter((v) => v.localService),
    on,
    c,
  );
  choiceKey = c?.uri ?? '';
  ready = true;
  for (const f of [...listeners]) {
    try {
      f();
    } catch (err) {
      console.error('[speech]', err);
    }
  }
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', pickVoice);
    window.addEventListener('offline', pickVoice);
  }
  // Đổi "Chọn giọng đọc" trong Cài đặt → chọn lại giọng.
  bus.on('settings', () => {
    if ((chosen()?.uri ?? '') !== choiceKey) pickVoice();
  });
}

/** Báo khi danh sách giọng hoặc giọng được chọn thay đổi. Trả về hàm hủy đăng ký. */
export function onVoicesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Đọc lại danh sách giọng của máy. */
export function refreshVoices(): void {
  pickVoice();
}

export function hasVietnameseVoice(): boolean {
  if (!ready) pickVoice();
  return pick.nu !== null;
}

/** Giọng dẫn chuyện (và nhân vật nữ). */
export function voiceName(): string | null {
  if (!ready) pickVoice();
  return pick.nu?.name ?? null;
}

/** Giọng nam tiếng Việt (nhân vật nam); null nếu máy không có. */
export function maleVoiceName(): string | null {
  if (!ready) pickVoice();
  return pick.nam?.name ?? null;
}

/** Tên dễ đọc của giọng đang dùng, giống ô "Chọn giọng đọc" (vd. "Hoài My (cần mạng)", "Linh (Nâng cao)"). */
export function viVoiceLabel(kind: 'nu' | 'nam'): string | null {
  if (!ready) pickVoice();
  const v = pick[kind];
  if (!v) return null;
  const ranked = rankVoices(all, 'vi', true);
  const i = ranked.indexOf(v);
  return i >= 0 ? voiceLabels(ranked)[i] : v.name;
}

export function hasEnglishVoice(): boolean {
  if (!ready) pickVoice();
  return pick.en !== null;
}

export function englishVoiceName(): string | null {
  if (!ready) pickVoice();
  return pick.en?.name ?? null;
}

/** Có thể ra câu hỏi nghe tiếng Anh: giọng đọc đang bật và máy có giọng tiếng Anh. */
export function canListen(): boolean {
  return getSettings().voice && hasEnglishVoice();
}

export interface VoiceOption {
  /** Giá trị lưu: voiceURI (không có thì tên). */
  key: string;
  label: string;
  name: string;
  uri: string;
  local: boolean;
}

/** Các giọng tiếng Việt của máy cho ô "Chọn giọng đọc" (thứ tự cố định, không đổi khi mất mạng). */
export function viVoiceOptions(): VoiceOption[] {
  if (!ready) pickVoice();
  const ranked = rankVoices(all, 'vi', true);
  const labels = voiceLabels(ranked);
  return ranked.map((v, i) => ({ key: voiceKey(v), label: labels[i], name: v.name, uri: v.voiceURI || '', local: v.localService }));
}

/** Giọng đang được chọn trong Cài đặt nếu máy còn giọng đó ('' = tự động). */
export function chosenVoiceKey(): string {
  if (!ready) pickVoice();
  const v = findChosen(rankVoices(all, 'vi', true), chosen());
  return v ? voiceKey(v) : '';
}

/** Thông tin giọng đọc (công cụ gỡ lỗi __vq.voices()). */
export function voiceInfo() {
  if (!ready) pickVoice();
  const d = (v: V | null) => (v ? { name: v.name, uri: v.voiceURI, lang: v.lang, local: v.localService } : null);
  return { ready, online: online(), chosen: chosen(), nu: d(pick.nu), nam: d(pick.nam), en: d(pick.en), vi: pick.vi.map((v) => d(v)) };
}

export interface SpeakOpts {
  /** Đọc cả khi đã tắt giọng đọc (nút Nghe thử, nút 🔊). */
  force?: boolean;
  /** Người nói (mã giọng nhân vật); không có = giọng dẫn chuyện. */
  who?: string | null;
  /** Bật/tắt giọng nhân vật cho riêng lần đọc này (mặc định theo Cài đặt). */
  chars?: boolean;
}

export interface VoiceLogEntry {
  speaker: string | null;
  profile: string;
  voice: string;
  uri: string;
  lang: string;
  rate: number;
  pitch: number;
  text: string;
  retry: boolean;
  queued: number;
  started: number | null;
  ended: number | null;
  error: string | null;
}

const LOG_CAP = 500;
const log: VoiceLogEntry[] | null = (() => {
  if (!QA || typeof window === 'undefined') return null;
  const w = window as unknown as { __vqVoiceLog?: VoiceLogEntry[] };
  if (!w.__vqVoiceLog) w.__vqVoiceLog = [];
  return w.__vqVoiceLog;
})();
const now = () => Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now());

function enRate(): number {
  return (hasProfile() ? profile().grade : 3) <= 2 ? 0.85 : 0.9;
}

let token = 0;

function run(steps: SpeechStep<V>[], i: number, my: number, retried = false): void {
  if (my !== token) return;
  if (i >= steps.length) {
    audio.setDuck(false);
    return;
  }
  const st = steps[i];
  const use = retried && st.retry ? st.retry : { voice: st.voice, pitch: st.pitch };
  let entry: VoiceLogEntry | null = null;
  if (log) {
    entry = {
      speaker: st.who,
      profile: st.profile,
      voice: use.voice.name,
      uri: use.voice.voiceURI,
      lang: use.voice.lang,
      rate: st.rate,
      pitch: use.pitch,
      text: st.text,
      retry: retried,
      queued: now(),
      started: null,
      ended: null,
      error: null,
    };
    log.push(entry);
    if (log.length > LOG_CAP) log.splice(0, log.length - LOG_CAP);
  }
  try {
    const u = new SpeechSynthesisUtterance(st.text);
    u.voice = use.voice;
    u.lang = use.voice.lang;
    u.rate = st.rate;
    u.pitch = use.pitch;
    u.onstart = () => {
      if (entry) entry.started = now();
      audio.setDuck(true);
    };
    u.onend = () => {
      if (entry) entry.ended = now();
      run(steps, i + 1, my);
    };
    u.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error;
      if (entry) entry.error = err || 'error';
      if (my !== token) return;
      if (err === 'interrupted' || err === 'canceled') {
        audio.setDuck(false);
        return;
      }
      // Giọng trực tuyến lỗi (thường do mất mạng): đọc lại một lần bằng giọng cục bộ.
      if (!retried && st.retry) run(steps, i, my, true);
      else run(steps, i + 1, my);
    };
    speechSynthesis.speak(u);
  } catch (err) {
    if (entry) entry.error = String(err);
    audio.setDuck(false);
  }
}

/**
 * Đọc lần lượt nhiều đoạn (ví dụ lời dẫn tiếng Việt rồi từ tiếng Anh). Hủy lời đang đọc trước đó.
 * Đoạn nào máy không có giọng thì bỏ qua (phần tiếng Anh vẫn đọc khi thiếu giọng tiếng Việt).
 */
export function speakParts(parts: SpeechPart[], opts: SpeakOpts = {}): void {
  if (typeof speechSynthesis === 'undefined') return;
  const s = getSettings();
  if (!s.voice && !opts.force) return;
  if (!ready) pickVoice();
  const who = opts.who || undefined;
  const steps = planSpeech(
    who ? parts.map((p) => (p.who ? p : { ...p, who })) : parts,
    pick,
    local,
    { voiceRate: s.voiceRate, charVoices: opts.chars ?? s.charVoices !== false, enRate: enRate() },
  );
  if (!steps.length) return;
  const my = ++token;
  try {
    speechSynthesis.cancel();
  } catch {
    /* bỏ qua */
  }
  run(steps, 0, my);
}

/** Đọc một câu. Câu có phần «tiếng Anh» được đọc bằng hai giọng nối tiếp nhau. */
export function speak(text: string, opts: SpeakOpts = {}): void {
  speakParts(hasEnglish(text) ? splitLang(text) : [{ text, lang: 'vi' }], opts);
}

/** Chỉ đọc phần tiếng Anh (nút Nghe lại của câu hỏi nghe). */
export function speakEnglish(text: string, opts: SpeakOpts = {}): void {
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