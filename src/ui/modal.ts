import { sfx } from '../core/audio';
import { button, h, type Child } from './dom';
import { layer, popBlock, pushBlock } from './root';

export interface ModalOpts {
  title: string;
  icon?: string;
  body: Child;
  width?: number;
  height?: number;
  className?: string;
  closable?: boolean;
  onClose?: () => void;
  footer?: Child;
}

export interface ModalHandle {
  el: HTMLElement;
  body: HTMLElement;
  close(): void;
  closed: Promise<void>;
  setTitle(t: string): void;
}

const stack: ModalHandle[] = [];

export function modalOpen(): boolean {
  return stack.length > 0;
}

export function openModal(o: ModalOpts): ModalHandle {
  sfx('open');
  const block = pushBlock('modal');
  let resolve!: () => void;
  const closed = new Promise<void>((r) => (resolve = r));
  const body = h('div.modal-body');
  const titleEl = h('div.modal-title-text', o.title);
  const closable = o.closable !== false;
  const card = h(
    `div.modal-card${o.className ? '.' + o.className.split(' ').join('.') : ''}`,
    { style: { width: o.width ? `${o.width}px` : '', height: o.height ? `${o.height}px` : '' } },
    h('div.modal-title', o.icon ? h('span.modal-icon', o.icon) : null, titleEl, closable ? button('✕', () => handle.close(), 'btn-close', { title: 'Đóng' }) : null),
    body,
    o.footer ? h('div.modal-footer', o.footer) : null,
  );
  const el = h('div.modal-backdrop', card);
  if (closable) {
    el.addEventListener('pointerdown', (e) => {
      if (e.target === el) handle.close();
    });
  }
  const append = (c: Child) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(append);
    else body.append(c instanceof Node ? c : String(c));
  };
  append(o.body);
  layer('modal').appendChild(el);
  let isClosed = false;
  const handle: ModalHandle = {
    el,
    body,
    closed,
    setTitle: (t) => (titleEl.textContent = t),
    close: () => {
      if (isClosed) return;
      isClosed = true;
      sfx('click');
      el.classList.add('closing');
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      popBlock(block);
      setTimeout(() => el.remove(), 180);
      o.onClose?.();
      resolve();
    },
  };
  (handle as ModalHandle & { closable: boolean }).closable = closable;
  stack.push(handle);
  return handle;
}

export function closeTopModal(): boolean {
  const top = stack[stack.length - 1] as (ModalHandle & { closable?: boolean }) | undefined;
  if (top && top.closable !== false) {
    top.close();
    return true;
  }
  return false;
}

export function closeAllModals(): void {
  for (const m of [...stack]) m.close();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    if (closeTopModal()) e.preventDefault();
  }
});

/** Hộp xác nhận Có/Không. */
export function confirmBox(text: string, opts: { title?: string; icon?: string; yes?: string; no?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    const m = openModal({
      title: opts.title ?? 'Xác nhận',
      icon: opts.icon ?? '❓',
      width: 760,
      className: 'modal-small',
      body: h('p.confirm-text', text),
      footer: [
        button(opts.no ?? 'Không', () => m.close(), 'btn-soft'),
        button(
          opts.yes ?? 'Đồng ý',
          () => {
            answer = true;
            m.close();
          },
          'btn-primary',
        ),
      ],
      onClose: () => resolve(answer),
    });
  });
}

export function alertBox(title: string, text: Child, icon = '💬', ok = 'Đã hiểu'): Promise<void> {
  const m = openModal({
    title,
    icon,
    width: 820,
    className: 'modal-small',
    body: typeof text === 'string' ? h('p.confirm-text', text) : text,
    footer: button(ok, () => m.close(), 'btn-primary'),
  });
  return m.closed;
}
