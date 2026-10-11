import '../styles/mini.css';
import { sfx } from '../core/audio';
import { speak, speakEnglish } from '../core/speech';
import type { Visual } from '../math/types';
import { h } from '../ui/dom';
import { coinIcon } from '../ui/icons';
import { rich } from '../ui/rich';
import { layer, onUIResize, uiCompact, uiInsets, uiSize } from '../ui/root';
import { renderVisual } from '../ui/visuals';
import type { MiniInfo, MiniResult } from './base';
import type { MiniCard } from './registry';

export type FeedbackTone = 'good' | 'retry' | 'hint' | 'steps' | 'info';

/** Safari < 16.2 (iPhone/iPad iOS 15) chưa có color-mix() của CSS: pha sẵn --mg-d / --mg-l bằng JS. */
const NO_COLOR_MIX = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && !CSS.supports('color', 'color-mix(in srgb, red 50%, blue)');

/** Như color-mix(in srgb, a p, b) với màu dạng #rrggbb. */
function mixHex(a: string, b: string, p: number): string {
  const ch = (s: string, i: number) => parseInt(s.slice(1 + 2 * i, 3 + 2 * i), 16);
  let out = '#';
  for (let i = 0; i < 3; i++) out += Math.round(ch(a, i) * p + ch(b, i) * (1 - p)).toString(16).padStart(2, '0');
  return out;
}

/** Biến màu của trò: --mg; máy cũ thêm --mg-d (đậm) và --mg-l (nhạt) như mini.css pha. */
function mgVars(color: string): Record<string, string> {
  const v: Record<string, string> = { '--mg': color };
  if (NO_COLOR_MIX && /^#[0-9a-f]{6}$/i.test(color)) {
    v['--mg-d'] = mixHex(color, '#3a2a5a', 0.72);
    v['--mg-l'] = mixHex(color, '#ffffff', 0.22);
  }
  return v;
}

/**
 * Giao diện chung của trò chơi nhỏ: thanh trên (tên, vòng, điểm, nút thoát), thẻ đề bài,
 * bong bóng phản hồi, hàng nút đáp án, màn hướng dẫn và bảng kết quả.
 * `free` là lớp trống để từng trò tự thêm phần tử HTML riêng (nhãn trên vật thể, đồng hồ đếm...).
 */
export class MiniUI {
  readonly root: HTMLElement;
  /** Lớp tự do cho các phần tử riêng của trò chơi (không chặn chạm vào cảnh 3D). */
  readonly free: HTMLElement;
  private top: HTMLElement;
  private dots: HTMLElement;
  private scoreEl: HTMLElement;
  private headEl: HTMLElement;
  private promptEl: HTMLElement;
  private feedbackEl: HTMLElement;
  private choicesEl: HTMLElement;
  private flashEl: HTMLElement;
  private keyOff: (() => void) | null = null;
  private feedbackTimer = 0;
  private isAnswer: ((i: number) => boolean) | null = null;
  private offResize: () => void;
  private cleanups = new Set<() => void>();
  private destroyed = false;
  /** Đổi mỗi lần có đề mới / xóa đề: thẻ đề bài đang chờ gắn (prompt) của lượt cũ thì bỏ. */
  private promptSeq = 0;

  constructor(
    readonly info: MiniInfo,
    /** Tên, biểu tượng, kĩ năng, cách chơi của lượt này (theo môn). */
    readonly card: MiniCard,
    private o: {
      onQuit: () => void;
      /**
       * Thanh trên / thẻ đề bài che `f` phần trên màn (0–1, theo chiều cao cửa sổ) – chỉ báo khi giao diện phóng to (điện
       * thoại...): lúc thẻ đề vừa gắn (trước khi hiện) và khi đổi cỡ màn (`reset`, f = 0 nếu hết phóng to).
       */
      onCover?: (f: number, reset: boolean) => void;
    },
  ) {
    this.root = h('div.mg-root', { style: mgVars(info.color) as unknown as Partial<CSSStyleDeclaration> });
    this.free = h('div.mg-free');
    this.dots = h('div.mg-dots');
    this.scoreEl = h('b', '0');
    const quit = h('button.mg-quit', { title: 'Thoát', 'aria-label': 'Thoát' }, '✖');
    quit.addEventListener('click', () => {
      sfx('click');
      this.o.onQuit();
    });
    this.top = h(
      'div.mg-top',
      h('div.mg-title', h('span.mg-icon', card.icon), h('span', card.name)),
      this.dots,
      h('div.mg-right', h('div.mg-score', h('span', '⭐'), this.scoreEl), quit),
    );
    this.promptEl = h('div.mg-prompt.hidden');
    this.feedbackEl = h('div.mg-feedback.hidden');
    this.choicesEl = h('div.mg-choices');
    this.flashEl = h('div.mg-flash');
    this.headEl = h('div.mg-head', this.promptEl, this.feedbackEl);
    this.root.append(this.free, this.top, this.headEl, this.choicesEl, this.flashEl);
    layer('hud').appendChild(this.root);
    this.offResize = onUIResize(() => {
      this.layout();
      this.o.onCover?.(uiCompact() ? this.cover({ sample: true }) : 0, true);
    });
    this.layout();
  }

  /** Kích thước vùng giao diện (đơn vị logic; máy tính ≥ 1920×1080, điện thoại có thể chỉ ~1280×640). */
  size(): { w: number; h: number } {
    const { w, h: hh } = uiSize();
    return { w, h: hh };
  }

  /**
   * Phần trên màn (0–1, theo chiều cao cửa sổ, tính cả lề an toàn) bị thanh trên và thẻ đề bài che, cộng một khoảng đệm.
   * `sample`: tính cả một thẻ đề mẫu (một dòng ngữ cảnh + một dòng câu hỏi) – dùng trước khi có đề thật.
   * Số đo offset* không tính transform (tỉ lệ giao diện, hiệu ứng bật thẻ) nên đã là px logic.
   */
  cover(opt: { sample?: boolean } = {}): number {
    const head = this.headEl.offsetTop;
    let bottom = this.top.offsetTop + this.top.offsetHeight;
    if (this.promptEl.childElementCount) bottom = Math.max(bottom, head + this.promptEl.offsetTop + this.promptEl.offsetHeight);
    if (opt.sample) {
      const dummy = h(
        'div.mg-prompt.hidden',
        { style: { position: 'absolute', visibility: 'hidden' } },
        h('div.mg-context', 'Ag'),
        h('div.mg-q', h('span.mg-qtext', 'Ag'), h('button.mg-speak', '🔊')),
      );
      this.headEl.appendChild(dummy);
      bottom = Math.max(bottom, head + dummy.offsetHeight);
      dummy.remove();
    }
    const sa = uiInsets();
    return (sa.t + bottom + 10) / (uiSize().h + sa.t + sa.b);
  }

  private layout(): void {
    const { w, h: hh } = uiSize();
    this.root.style.width = `${w}px`;
    this.root.style.height = `${hh}px`;
  }

  /* ---------------- Thanh trên ---------------- */
  setRound(i: number, n: number): void {
    if (this.dots.childElementCount !== n) {
      this.dots.replaceChildren(...Array.from({ length: n }, () => h('i')));
    }
    Array.from(this.dots.children).forEach((d, k) => {
      d.classList.toggle('done', k < i);
      d.classList.toggle('now', k === i);
    });
  }

  setScore(n: number): void {
    const prev = Number(this.scoreEl.textContent) || 0;
    this.scoreEl.textContent = String(n);
    if (n > prev) {
      this.scoreEl.parentElement?.classList.remove('bump');
      void this.scoreEl.offsetWidth;
      this.scoreEl.parentElement?.classList.add('bump');
    }
  }

  /* ---------------- Đề bài ---------------- */
  /**
   * Hiện đề bài (và đọc to). `visual` = hình minh họa của câu hỏi (tùy chọn).
   * `en` = phần tiếng Anh của câu hỏi (nút "Nghe lại" của câu hỏi nghe chỉ đọc phần này).
   */
  prompt(text: string, context?: string, speech?: string, visual?: Visual, en?: string): void {
    const seq = ++this.promptSeq;
    this.hideFeedback();
    speak(speech ?? text);
    // Thẻ đề bài gắn vào sau khung hình kế tiếp: khung đó dành vẽ lần đầu các vật 3D vừa dựng của vòng mới, dồn thêm bố cục
    // thẻ đề vào cùng khung thì máy yếu khựng đúng lúc vòng chơi bắt đầu. Lời đọc vẫn bắt đầu ngay (còn trong lượt chạm).
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (seq !== this.promptSeq || this.destroyed) return;
        const say = h('button.mg-speak', { title: 'Nghe lại', 'aria-label': 'Nghe lại' }, '🔊');
        say.addEventListener('click', () => speak(speech ?? text, { force: true }));
        this.promptEl.replaceChildren(
          ...(context ? [h('div.mg-context', rich(context))] : []),
          h('div.mg-q', h('span.mg-qtext', rich(text)), say),
          ...(visual ? [renderVisual(visual, { onListen: () => en && speakEnglish(en, { force: true }) })] : []),
        );
        this.promptEl.classList.remove('hidden');
        this.promptEl.classList.remove('pop');
        void this.promptEl.offsetWidth;
        // Điện thoại: thẻ đề cao hơn mẫu (đề dài, có hình) → trò chơi hạ khung nhìn thêm trước khi thẻ hiện.
        if (uiCompact()) this.o.onCover?.(this.cover(), false);
        this.promptEl.classList.add('pop');
      }),
    );
  }

  clearPrompt(): void {
    this.promptSeq++;
    this.promptEl.classList.add('hidden');
    this.hideFeedback();
    this.clearChoices();
  }

  /* ---------------- Phản hồi ---------------- */
  feedback(msg: string, tone: FeedbackTone, steps?: string[]): void {
    window.clearTimeout(this.feedbackTimer);
    this.feedbackEl.className = `mg-feedback tone-${tone}`;
    this.feedbackEl.replaceChildren(
      h('div.mg-fb-msg', rich(msg)),
      ...(steps?.length ? [h('ol.mg-steps', ...steps.map((s) => h('li', rich(s))))] : []),
    );
    void this.feedbackEl.offsetWidth;
    this.feedbackEl.classList.add('show');
    const ms = tone === 'good' ? 1400 : tone === 'retry' ? 2200 : tone === 'hint' ? 5000 : tone === 'steps' ? 9000 : 2500;
    this.feedbackTimer = window.setTimeout(() => this.hideFeedback(), ms);
  }

  hideFeedback(): void {
    window.clearTimeout(this.feedbackTimer);
    this.feedbackEl.classList.remove('show');
    this.feedbackEl.classList.add('hidden');
  }

  /* ---------------- Nút đáp án ---------------- */
  /**
   * Hiện hàng nút đáp án ở cuối màn hình (phím 1..n để chọn).
   * `onPick(i)` trả về true nếu đúng. `isAnswer(i)` dùng để chỉ ra đáp án khi trẻ cần hướng dẫn.
   */
  choices(labels: string[], onPick: (i: number) => boolean, isAnswer?: (i: number) => boolean): void {
    this.clearChoices();
    this.isAnswer = isAnswer ?? null;
    const btns = labels.map((label, i) => {
      const b = h<HTMLButtonElement>('button.mg-choice', { style: { '--i': String(i) } as unknown as Partial<CSSStyleDeclaration> }, h('span.mg-key', String(i + 1)), h('span.mg-label', rich(label)));
      b.addEventListener('click', () => pick(i));
      return b;
    });
    const pick = (i: number) => {
      const b = btns[i];
      if (!b || b.disabled || this.choicesEl.classList.contains('locked')) return;
      sfx('click');
      const ok = onPick(i);
      if (ok) {
        b.classList.add('ok');
      } else {
        b.classList.add('bad');
        b.disabled = true;
      }
    };
    this.choicesEl.replaceChildren(...btns);
    this.choicesEl.classList.remove('locked');
    this.choicesEl.classList.add('show');
    const onKey = (e: KeyboardEvent) => {
      const n = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : e.code.startsWith('Numpad') ? Number(e.code.slice(6)) : NaN;
      if (n >= 1 && n <= btns.length) {
        e.preventDefault();
        pick(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    this.keyOff = () => window.removeEventListener('keydown', onKey);
  }

  /** Khóa các nút (sau khi đã trả lời đúng). */
  lockChoices(): void {
    this.choicesEl.classList.add('locked');
    this.keyOff?.();
    this.keyOff = null;
  }

  /** Làm nổi bật đáp án đúng (bước hướng dẫn từng bước). */
  guideChoices(): void {
    if (!this.isAnswer) return;
    Array.from(this.choicesEl.children).forEach((b, i) => b.classList.toggle('guide', !!this.isAnswer?.(i)));
  }

  clearChoices(): void {
    this.keyOff?.();
    this.keyOff = null;
    this.isAnswer = null;
    this.choicesEl.classList.remove('show');
    this.choicesEl.replaceChildren();
  }

  /* ---------------- Chữ lớn ---------------- */
  /** Hiện chữ lớn giữa màn hình trong chốc lát ("Vòng 2", "Giỏi quá!"...). */
  flash(text: string, tone: 'good' | 'info' | 'warn' = 'info', ms = 1100): void {
    const el = h(`div.mg-flash-item.tone-${tone}`, text);
    el.style.animationDuration = `${ms}ms`;
    this.flashEl.appendChild(el);
    window.setTimeout(() => el.remove(), ms + 50);
  }

  /** Chữ nổi nhỏ tại một điểm màn hình (ví dụ "+3" bay lên trên vật thể). */
  floatText(text: string, x: number, y: number, tone: 'good' | 'bad' | 'info' = 'good'): void {
    const el = h(`div.mg-float.tone-${tone}`, text);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.free.appendChild(el);
    window.setTimeout(() => el.remove(), 1200);
  }

  /* ---------------- Màn hướng dẫn ---------------- */
  intro(): Promise<void> {
    return new Promise((resolve) => {
      const start = h<HTMLButtonElement>('button.mg-btn.mg-btn-go', 'Bắt đầu ▶');
      const card = h(
        'div.mg-overlay.mg-intro',
        h(
          'div.mg-card',
          h('div.mg-big-icon', this.card.icon),
          h('h1', this.card.name),
          h('div.mg-skill', `Luyện: ${this.card.skill}`),
          h('p.mg-desc', this.card.desc),
          h('div.mg-meta', `${this.info.rounds} vòng · Mỗi câu đúng ngay được ⭐⭐⭐`),
          start,
        ),
      );
      const off = () => window.removeEventListener('keydown', onKey);
      const go = () => {
        if (!card.isConnected) return;
        sfx('pop');
        off();
        this.cleanups.delete(off);
        card.classList.add('out');
        window.setTimeout(() => card.remove(), 250);
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
          e.preventDefault();
          go();
        }
      };
      start.addEventListener('click', go);
      window.addEventListener('keydown', onKey);
      this.cleanups.add(off);
      this.root.appendChild(card);
      speak(`${this.card.name}. ${this.card.desc}`);
    });
  }

  /* ---------------- Bảng kết quả ---------------- */
  /** Hiện kết quả. Trả về true nếu trẻ chọn "Chơi lại". */
  results(r: MiniResult): Promise<boolean> {
    this.clearPrompt();
    return new Promise((resolve) => {
      const again = h<HTMLButtonElement>('button.mg-btn.mg-btn-again', '🔁 Chơi lại');
      const home = h<HTMLButtonElement>('button.mg-btn.mg-btn-home', '🏠 Quay về');
      const stars = h('div.mg-stars', ...[0, 1, 2].map((i) => h(`span.mg-star${i < r.stars ? '.on' : ''}`, { style: { '--d': `${0.25 + i * 0.25}s` } as unknown as Partial<CSSStyleDeclaration> }, '★')));
      const msg = r.stars === 3 ? 'Xuất sắc! Bạn thật giỏi!' : r.stars === 2 ? 'Làm tốt lắm! Cố lên nhé!' : 'Hoàn thành rồi! Chơi lại để giỏi hơn nhé!';
      const card = h(
        'div.mg-overlay.mg-results',
        h(
          'div.mg-card',
          h('div.mg-big-icon', this.card.icon),
          h('h1', msg),
          stars,
          h('div.mg-score-line', `Điểm: ${r.score} / ${r.max}`),
          r.best ? h('div.mg-best', '🏆 Kỷ lục mới!') : null,
          h('div.mg-rewards', h('span.mg-reward.coin', coinIcon(), ` +${r.coins} xu`), h('span.mg-reward.xp', `✨ +${r.xp} XP`)),
          h('div.mg-actions', again, home),
        ),
      );
      const off = () => window.removeEventListener('keydown', onKey);
      const done = (v: boolean) => {
        if (!card.isConnected) return;
        sfx('click');
        off();
        this.cleanups.delete(off);
        card.remove();
        resolve(v);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
          e.preventDefault();
          done(false);
        }
      };
      again.addEventListener('click', () => done(true));
      home.addEventListener('click', () => done(false));
      window.setTimeout(() => {
        if (!card.isConnected) return;
        window.addEventListener('keydown', onKey);
        this.cleanups.add(off);
      }, 600);
      this.root.appendChild(card);
      speak(msg);
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.clearTimeout(this.feedbackTimer);
    this.keyOff?.();
    for (const off of this.cleanups) off();
    this.cleanups.clear();
    this.offResize();
    this.root.remove();
  }
}
