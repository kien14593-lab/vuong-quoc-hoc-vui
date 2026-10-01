import { h, wait } from './dom';
import { layer } from './root';

/** Thông báo nhỏ trượt xuống từ phía trên. */
export function toast(text: string, opts: { icon?: string; tone?: 'info' | 'good' | 'warn' | 'gold'; ms?: number } = {}): void {
  const host = layer('toast');
  let stack = host.querySelector<HTMLElement>('.toast-stack');
  if (!stack) {
    stack = h('div.toast-stack');
    host.appendChild(stack);
  }
  const el = h(`div.toast.tone-${opts.tone ?? 'info'}`, opts.icon ? h('span.toast-icon', opts.icon) : null, h('span.toast-text', text));
  stack.appendChild(el);
  while (stack.children.length > 4) stack.firstElementChild?.remove();
  void (async () => {
    await wait(opts.ms ?? 2600);
    el.classList.add('out');
    await wait(400);
    el.remove();
  })();
}

/** Phần thưởng bay lên giữa màn hình: "+10 XP", "+3 xu"... */
export function rewardBurst(parts: { icon: string; text: string; cls?: string }[], at?: { x: number; y: number }): void {
  if (!parts.length) return;
  const host = layer('fx');
  const el = h(
    'div.reward-burst',
    { style: at ? { left: `${at.x}px`, top: `${at.y}px` } : {} },
    parts.map((p) => h(`div.reward-chip${p.cls ? '.' + p.cls : ''}`, h('span.rc-icon', p.icon), h('span.rc-text', p.text))),
  );
  host.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/** Pháo giấy chúc mừng. */
export function confetti(n = 70, origin?: { x: number; y: number }): void {
  const host = layer('fx');
  const colors = ['#ff8fab', '#ffd166', '#7ec8e3', '#7bd389', '#b79cff', '#ffa96b'];
  const box = h('div.confetti');
  for (let i = 0; i < n; i++) {
    const p = h('i');
    const x0 = origin ? origin.x : 960 + (Math.random() - 0.5) * 300;
    const y0 = origin ? origin.y : 420;
    const ang = Math.random() * Math.PI * 2;
    const sp = 250 + Math.random() * 520;
    p.style.left = `${x0}px`;
    p.style.top = `${y0}px`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${Math.cos(ang) * sp}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * sp * 0.7 - 200}px`);
    p.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    p.style.animationDelay = `${Math.random() * 0.15}s`;
    if (i % 3 === 0) p.style.borderRadius = '50%';
    box.appendChild(p);
  }
  host.appendChild(box);
  setTimeout(() => box.remove(), 2400);
}
