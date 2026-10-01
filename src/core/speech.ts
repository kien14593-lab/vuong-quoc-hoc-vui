import { audio } from './audio';
import { getSettings } from './state';

/** Đọc lời thoại bằng giọng tiếng Việt của hệ điều hành (nếu có). */
let voice: SpeechSynthesisVoice | null = null;
let ready = false;

function pickVoice(): void {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  const vi = voices.filter((v) => v.lang.toLowerCase().startsWith('vi'));
  voice =
    vi.find((v) => /natural|online/i.test(v.name) && /hoaimy|hoài my|female|nữ/i.test(v.name)) ??
    vi.find((v) => /natural|online/i.test(v.name)) ??
    vi.find((v) => /hoaimy|an\b/i.test(v.name)) ??
    vi[0] ??
    null;
  ready = true;
}

if (typeof speechSynthesis !== 'undefined') {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function hasVietnameseVoice(): boolean {
  if (!ready) pickVoice();
  return voice !== null;
}

export function voiceName(): string | null {
  return voice?.name ?? null;
}

/** Chuẩn hóa văn bản để đọc: bỏ emoji, đọc ký hiệu toán. */
export function speechText(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
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

export function speak(text: string, opts: { force?: boolean } = {}): void {
  if (typeof speechSynthesis === 'undefined') return;
  const s = getSettings();
  if (!s.voice && !opts.force) return;
  if (!ready) pickVoice();
  if (!voice) return;
  const clean = speechText(text);
  if (!clean) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95 * s.voiceRate;
    u.pitch = 1.1;
    u.onstart = () => audio.setDuck(true);
    u.onend = () => audio.setDuck(false);
    u.onerror = () => audio.setDuck(false);
    speechSynthesis.speak(u);
  } catch {
    /* bỏ qua */
  }
}

export function stopSpeech(): void {
  if (typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
  } catch {
    /* bỏ qua */
  }
  audio.setDuck(false);
}
