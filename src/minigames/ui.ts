import '../styles/mini.css';
import { sfx } from '../core/audio';
import { speak } from '../core/speech';
import type { Visual } from '../math/types';
import { h } from '../ui/dom';
import { coinIcon } from '../ui/icons';
import { layer, onUIResize, uiSize } from '../ui/root';
import { renderVisual } from '../ui/visuals';
import type { MiniInfo, MiniResult } from './base';
import { miniName } from './registry';

export type FeedbackTone = 'good' | 'retry' | 'hint' | 'steps' | 'info';

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

  constructor(
    readonly info: MiniInfo,
    private o: { onQuit: () => void },
  ) {
    this.root = h('div.mg-root', { style: { '--mg': info.color } as unknown as Partial<CSSStyleDeclaration> });
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
      h('div.mg-title', h('span.mg-icon', info.icon), h('span', miniName(info))),
      this.dots,
      h('div.mg-right', h('div.mg-score', h('span', '⭐'), this.scoreEl), quit),
    );
    this.promptEl = h('div.mg-prompt.hidden');
    this.feedbackEl = h('div.mg-feedback.hidden');
    this.choicesEl = h('div.mg-choices');
    this.flashEl = h('div.mg-flash');
    this.root.append(this.free, this.top, h('div.mg-head', this.promptEl, this.feedbackEl), this.choicesEl, this.flashEl);
    layer('hud').appendChild(this.root);
    this.offResize = onUIResize(() => this.layout());
    this.layout();
  }

  /** Kích thước vùng giao diện (đơn vị logic; máy tính ≥ 1920×1080, điện thoại có thể chỉ ~1280×640). */
  size(): { w: number; h: number } {
    const { w, h: hh } = uiSize();
    return { w, h: hh };
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
  /** Hiện đề bài (và đọc to). `visual` = hình minh họa của câu hỏi (tùy chọn). */
  prompt(text: string, context?: string, speech?: string, visual?: Visual): void {
    const say = h('button.mg-speak', { title: 'Nghe lại', 'aria-label': 'Nghe lại' }, '🔊');
    say.addEventListener('click', () => speak(speech ?? text, { force: true }));
    this.promptEl.replaceChildren(
      ...(context ? [h('div.mg-context', context)] : []),
      h('div.mg-q', h('span.mg-qtext', text), say),
      ...(visual ? [renderVisual(visual)] : []),
    );
    this.promptEl.classList.remove('hidden');
    this.promptEl.classList.remove('pop');
    void this.promptEl.offsetWidth;
    this.promptEl.classList.add('pop');
    this.hideFeedback();
    speak(speech ?? text);
  }

  clearPrompt(): void {
    this.promptEl.classList.add('hidden');
    this.hideFeedback();
    this.clearChoices();
  }

  /* ---------------- Phản hồi ---------------- */
  feedback(msg: string, tone: FeedbackTone, steps?: string[]): void {
    window.clearTimeout(this.feedbackTimer);
    this.feedbackEl.className = `mg-feedback tone-${tone}`;
    this.feedbackEl.replaceChildren(
      h('div.mg-fb-msg', msg),
      ...(steps?.length ? [h('ol.mg-steps', ...steps.map((s) => h('li', s)))] : []),
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
      const b = h<HTMLButtonElement>('button.mg-choice', { style: { '--i': String(i) } as unknown as Partial<CSSStyleDeclaration> }, h('span.mg-key', String(i + 1)), h('span.mg-label', label));
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
          h('div.mg-big-icon', this.info.icon),
          h('h1', miniName(this.info)),
          h('div.mg-skill', `Luyện: ${this.info.skill}`),
          h('p.mg-desc', this.info.desc),
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
      speak(`${miniName(this.info)}. ${this.info.desc}`);
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
          h('div.mg-big-icon', this.info.icon),
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
