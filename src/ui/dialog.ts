import { sfx } from '../core/audio';
import { speak, stopSpeech } from '../core/speech';
import { modelDef } from '../models/registry';
import { h, wait } from './dom';
import { modelPortrait } from './portrait';
import { layer, popBlock, pushBlock } from './root';

/** Người nói trong hộp hội thoại. */
export interface Speaker {
  name: string;
  /** Khóa mô hình 3D để vẽ chân dung (ví dụ "npc_rabbit"), hoặc ảnh dựng sẵn (data URL). */
  art?: string;
  /** Tùy chọn dựng mô hình (ví dụ biến thể dân làng). */
  artOpts?: Record<string, unknown>;
  color?: string;
  /** Mã giọng đọc riêng (xem core/voice-profiles.ts); không có = giọng dẫn chuyện. */
  voice?: string;
}

/** Ảnh chân dung (data URL) của người nói, '' nếu không có. */
export function speakerArt(sp: Speaker | null | undefined, size = 256): string {
  if (!sp?.art) return '';
  if (sp.art.startsWith('data:') || sp.art.startsWith('blob:')) return sp.art;
  return modelPortrait(sp.art, { framing: modelDef(sp.art, sp.artOpts)?.portrait ?? 'head', size, yaw: 18, opts: sp.artOpts });
}

let queue: Promise<unknown> = Promise.resolve();
let openCount = 0;

export function dialogOpen(): boolean {
  return openCount > 0;
}

function portrait(sp: Speaker | null): HTMLElement | null {
  const url = speakerArt(sp);
  if (!sp || !url) return null;
  return h('div.dlg-portrait', { style: { background: sp.color ? `${sp.color}33` : '' } }, h('img', { src: url, alt: sp.name, draggable: false }));
}

function build(sp: Speaker | null): { el: HTMLElement; text: HTMLElement; next: HTMLElement; choices: HTMLElement } {
  const text = h('div.dlg-text');
  const next = h('div.dlg-next', '▼');
  const choices = h('div.dlg-choices');
  const pic = portrait(sp);
  const el = h(
    'div.dialog',
    pic,
    h(
      'div.dlg-box',
      sp ? h('div.dlg-name', { style: { background: sp.color ?? '#b79cff' } }, sp.name) : null,
      text,
      choices,
      next,
    ),
  );
  if (!pic) el.classList.add('no-portrait');
  return { el, text, next, choices };
}

/** Hiệu ứng gõ chữ; trả về hàm "hiện hết ngay". */
function typewrite(el: HTMLElement, text: string, onDone: () => void): () => void {
  el.textContent = '';
  const chars = [...text];
  let i = 0;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    el.textContent = text;
    onDone();
  };
  const timer = window.setInterval(() => {
    i += 1;
    el.textContent = chars.slice(0, i).join('');
    if (i % 3 === 0 && chars[i - 1] && chars[i - 1] !== ' ') sfx('tick');
    if (i >= chars.length) finish();
  }, 24);
  return finish;
}

function waitAdvance(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener('pointerdown', onPtr);
      window.removeEventListener('keydown', onKey, true);
      resolve();
    };
    const onPtr = (e: PointerEvent) => {
      e.stopPropagation();
      done();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        done();
      }
    };
    el.addEventListener('pointerdown', onPtr);
    window.addEventListener('keydown', onKey, true);
  });
}

async function runSay(sp: Speaker | null, lines: string[]): Promise<void> {
  const block = pushBlock('dialog');
  openCount++;
  const ui = build(sp);
  layer('dialog').appendChild(ui.el);
  try {
    for (const line of lines) {
      ui.next.classList.remove('show');
      let typing = true;
      speak(line, { who: sp?.voice });
      const finish = typewrite(ui.text, line, () => {
        typing = false;
        ui.next.classList.add('show');
      });
      await waitAdvance(ui.el);
      if (typing) {
        finish();
        await waitAdvance(ui.el);
      }
      sfx('click');
    }
  } finally {
    stopSpeech();
    ui.el.classList.add('out');
    await wait(150);
    ui.el.remove();
    openCount--;
    popBlock(block);
  }
}

/** NPC nói một hoặc nhiều câu. Các lời gọi được xếp hàng lần lượt. */
export function say(sp: Speaker | null, lines: string | string[]): Promise<void> {
  const arr = Array.isArray(lines) ? lines : [lines];
  const p = queue.then(() => runSay(sp, arr));
  queue = p.catch(() => undefined);
  return p;
}

async function runChoose(sp: Speaker | null, text: string, options: string[]): Promise<number> {
  const block = pushBlock('dialog');
  openCount++;
  const ui = build(sp);
  ui.el.classList.add('has-choices');
  layer('dialog').appendChild(ui.el);
  speak(text, { who: sp?.voice });
  const finish = typewrite(ui.text, text, () => undefined);
  try {
    return await new Promise<number>((resolve) => {
      options.forEach((opt, i) => {
        ui.choices.appendChild(
          h(
            'button.btn.dlg-choice',
            {
              type: 'button',
              onclick: (e: MouseEvent) => {
                e.stopPropagation();
                finish();
                sfx('click');
                window.removeEventListener('keydown', onKey, true);
                resolve(i);
              },
            },
            h('span.dlg-choice-num', String(i + 1)),
            opt,
          ),
        );
      });
      const onKey = (e: KeyboardEvent) => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= options.length) {
          e.preventDefault();
          e.stopPropagation();
          finish();
          sfx('click');
          window.removeEventListener('keydown', onKey, true);
          resolve(n - 1);
        }
      };
      window.addEventListener('keydown', onKey, true);
    });
  } finally {
    stopSpeech();
    ui.el.remove();
    openCount--;
    popBlock(block);
  }
}

/** Hỏi người chơi chọn một phương án (trả về chỉ số). */
export function choose(sp: Speaker | null, text: string, options: string[]): Promise<number> {
  const p = queue.then(() => runChoose(sp, text, options));
  queue = p.catch(() => undefined);
  return p;
}
