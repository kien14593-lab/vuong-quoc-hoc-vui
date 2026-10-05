import { sfx } from '../core/audio';
import { speak, stopSpeech } from '../core/speech';
import { AttemptTracker, finishQuestion, type Stage, type SubmitResult } from '../game/challenge';
import type { Question } from '../math/types';
import { speakerArt, type Speaker } from './dialog';
import { h, wait } from './dom';
import { layer, popBlock, pushBlock, uiScale } from './root';
import { confetti } from './toast';
import { renderVisual } from './visuals';

export interface AskOptions {
  /** Nguồn câu hỏi (ghi vào nhật ký học tập), ví dụ "forest:bridge". */
  src: string;
  speaker?: Speaker | null;
  title?: string;
  icon?: string;
  rewards?: boolean;
  /** Gọi mỗi lần chọn sai (để thế giới phản ứng, ví dụ cầu rung). */
  onWrong?: (stage: Stage) => void;
  /** Không hiện phần thưởng bay (mini-game tự xử lý). */
  quiet?: boolean;
  /** Ẩn hình minh họa (câu hỏi đã có tình huống trong thế giới). */
  noVisual?: boolean;
  compact?: boolean;
}

export interface AskResult {
  attempts: number;
  ms: number;
  value: string;
  xp: number;
  coins: number;
}

let active = 0;
export function questionOpen(): boolean {
  return active > 0;
}

let solver: (() => boolean) | null = null;
/** (Gỡ lỗi) Chọn đáp án đúng cho câu hỏi đang hiện. */
export function solveOpenQuestion(): boolean {
  return solver?.() ?? false;
}

function speakerChip(sp: Speaker | null | undefined): HTMLElement | null {
  if (!sp) return null;
  const url = speakerArt(sp, 160);
  return h(
    'div.q-speaker',
    url ? h('img', { src: url, alt: '', draggable: false }) : null,
    h('span', { style: { background: sp.color ?? '#b79cff' } }, sp.name),
  );
}

function helperBubble(): { el: HTMLElement; show(msg: string, tone: string, steps?: string[]): Promise<void>; hide(): void } {
  const el = h('div.q-helper');
  // Màn thấp (điện thoại nằm ngang): gợi ý nằm trong bảng câu hỏi cuộn được → cuộn xuống cho thấy.
  const reveal = () => {
    const box = el.parentElement;
    if (box && box.scrollHeight > box.clientHeight + 1) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  };
  return {
    el,
    async show(msg, tone, steps) {
      el.className = `q-helper show tone-${tone}`;
      el.innerHTML = '';
      el.appendChild(h('div.q-helper-msg', msg));
      reveal();
      if (steps && steps.length) {
        const ol = h('ol.q-steps');
        el.appendChild(ol);
        for (const s of steps) {
          await wait(650);
          ol.appendChild(h('li', s));
          sfx('pop');
          reveal();
        }
      }
    },
    hide() {
      el.className = 'q-helper';
    },
  };
}

/** Hiện bảng câu hỏi (nửa dưới màn hình – thế giới vẫn hiện phía trên). Kết thúc khi trẻ chọn đúng. */
export function ask(q: Question, o: AskOptions): Promise<AskResult> {
  return new Promise((resolve) => {
    active++;
    const block = pushBlock('question');
    const tracker = new AttemptTracker(q);
    const feedback = h('div.q-feedback');
    const helper = helperBubble();
    const choicesEl = h('div.q-choices');
    const longLabels = q.choices.some((c) => c.label.length > 9);
    if (longLabels) choicesEl.classList.add('long');
    const replay = h('button.btn.btn-round.q-speak', { type: 'button', title: 'Nghe lại', onclick: () => speak(q.speech, { force: true }) }, '🔊');
    const panel = h(
      `div.qpanel${o.compact ? '.compact' : ''}`,
      h('div.q-head', speakerChip(o.speaker), o.title ? h('div.q-title', o.icon ? `${o.icon} ` : '', o.title) : h('div.q-title'), replay),
      q.context ? h('div.q-context', q.context) : null,
      h('div.q-prompt', q.prompt),
      q.visual && !o.noVisual ? h('div.q-visual', renderVisual(q.visual)) : null,
      choicesEl,
      feedback,
      helper.el,
    );
    const backdrop = h('div.q-backdrop', panel);
    let busy = false;
    const buttons: HTMLButtonElement[] = [];
    const pick = async (i: number) => {
      if (busy) return;
      const c = q.choices[i];
      const btn = buttons[i];
      if (!c || btn.disabled) return;
      const r: SubmitResult = tracker.submit(c.value);
      feedback.textContent = r.message;
      feedback.className = `q-feedback show stage-${r.stage}`;
      if (r.correct) {
        busy = true;
        btn.classList.add('correct');
        sfx('correct');
        speak('Chính xác! Tuyệt vời!');
        const rect = btn.getBoundingClientRect();
        const root = layer('fx').getBoundingClientRect();
        const s = uiScale();
        confetti(40, { x: (rect.left + rect.width / 2 - root.left) / s, y: (rect.top - root.top) / s });
        helper.hide();
        await wait(1300);
        stopSpeech();
        backdrop.classList.add('out');
        await wait(220);
        backdrop.remove();
        window.removeEventListener('keydown', onKey, true);
        popBlock(block);
        active--;
        if (solver === solve) solver = null;
        const res = finishQuestion(q, tracker.attempts, tracker.ms, { src: o.src, rewards: o.rewards, quiet: o.quiet });
        resolve({ attempts: tracker.attempts, ms: tracker.ms, value: c.value, xp: res.xp, coins: res.coins });
        return;
      }
      sfx('wrong');
      btn.classList.add('wrong');
      btn.disabled = true;
      o.onWrong?.(r.stage);
      if (r.stage === 'retry') {
        speak('Chưa đúng rồi. Hãy thử lại nhé!');
      } else if (r.stage === 'hint') {
        sfx('hint');
        speak('Gợi ý: ' + q.hint);
        void helper.show(`💡 ${q.hint}`, 'hint');
      } else {
        sfx('hint');
        speak('Mình cùng làm từng bước nhé! ' + q.steps.join(' '));
        busy = true;
        await helper.show('🧩 Mình cùng làm từng bước nhé!', 'steps', q.steps);
        busy = false;
        buttons.forEach((b, k) => {
          const val = q.choices[k].value;
          if ((q.accept?.length ? q.accept.includes(val) : val === q.answer) && !b.disabled) b.classList.add('guide');
        });
      }
    };
    q.choices.forEach((c, i) => {
      const b = h<HTMLButtonElement>('button.btn.q-choice', { type: 'button', onclick: () => void pick(i) }, h('span.q-key', String(i + 1)), h('span.q-label', c.label));
      buttons.push(b);
      choicesEl.appendChild(b);
    });
    const solve = () => {
      const i = q.choices.findIndex((c) => (q.accept?.length ? q.accept.includes(c.value) : c.value === q.answer));
      if (i < 0 || busy) return false;
      void pick(i);
      return true;
    };
    solver = solve;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= q.choices.length) {
        e.preventDefault();
        e.stopPropagation();
        void pick(n - 1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    layer('panel').appendChild(backdrop);
    sfx('pop');
    speak((q.context ? q.context + ' ' : '') + q.speech);
  });
}

/* ------------------------------------------------------------------ */
/* Thẻ đề bài cho thử thách "vật lý" (bước lên đá, đi qua cửa, ném bóng) */
/* ------------------------------------------------------------------ */
export interface PromptCard {
  el: HTMLElement;
  tracker: AttemptTracker;
  /** Ghi nhận lựa chọn của trẻ, hiện phản hồi phù hợp. */
  submit(value: string): SubmitResult;
  close(): void;
  /** Ghi nhận hoàn thành + thưởng. */
  finish(o?: { rewards?: boolean; quiet?: boolean }): { xp: number; coins: number };
}

export function promptCard(q: Question, o: { src: string; speaker?: Speaker | null; title?: string; icon?: string; showVisual?: boolean }): PromptCard {
  const tracker = new AttemptTracker(q);
  const feedback = h('div.q-feedback');
  const helper = helperBubble();
  const el = h(
    'div.prompt-card',
    h('div.q-head', speakerChip(o.speaker), h('div.q-title', o.icon ? `${o.icon} ` : '', o.title ?? ''), h('button.btn.btn-round.q-speak', { type: 'button', onclick: () => speak(q.speech, { force: true }) }, '🔊')),
    q.context ? h('div.q-context', q.context) : null,
    h('div.q-prompt', q.prompt),
    o.showVisual && q.visual ? h('div.q-visual', renderVisual(q.visual)) : null,
    feedback,
    helper.el,
  );
  layer('panel').appendChild(el);
  speak((q.context ? q.context + ' ' : '') + q.speech);
  let closed = false;
  return {
    el,
    tracker,
    submit(value: string) {
      const r = tracker.submit(value);
      feedback.textContent = r.message;
      feedback.className = `q-feedback show stage-${r.stage}`;
      if (r.correct) {
        sfx('correct');
        speak('Chính xác! Tuyệt vời!');
        helper.hide();
      } else {
        sfx('wrong');
        if (r.stage === 'retry') speak('Chưa đúng rồi. Hãy thử lại nhé!');
        else if (r.stage === 'hint') {
          speak('Gợi ý: ' + q.hint);
          void helper.show(`💡 ${q.hint}`, 'hint');
        } else {
          speak('Mình cùng làm từng bước nhé! ' + q.steps.join(' '));
          void helper.show('🧩 Mình cùng làm từng bước nhé!', 'steps', q.steps);
        }
      }
      return r;
    },
    close() {
      if (closed) return;
      closed = true;
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    },
    finish(fo = {}) {
      const res = finishQuestion(q, Math.max(1, tracker.attempts), tracker.ms, { src: o.src, rewards: fo.rewards, quiet: fo.quiet });
      return { xp: res.xp, coins: res.coins };
    },
  };
}
