/** Tiện ích tạo phần tử DOM gọn gàng: h('div.panel#id', {onclick}, ...con). */
export type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = Record<string, unknown>;

function isAttrs(v: unknown): v is Attrs {
  return typeof v === 'object' && v !== null && !(v instanceof Node) && !Array.isArray(v);
}

export function append(el: Element, kids: Child[]): void {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

export function h<T extends HTMLElement = HTMLElement>(sel: string, attrs?: Attrs | Child, ...kids: Child[]): T {
  const m = /^([a-z0-9-]*)((?:[.#][\w-]+)*)$/i.exec(sel);
  const tag = (m && m[1]) || 'div';
  const el = document.createElement(tag) as T;
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g) ?? []) {
      if (part[0] === '.') el.classList.add(part.slice(1));
      else el.id = part.slice(1);
    }
  }
  if (isAttrs(attrs)) applyAttrs(el, attrs);
  else if (attrs !== undefined) kids.unshift(attrs as Child);
  append(el, kids);
  return el;
}

export function applyAttrs(el: HTMLElement, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      for (const c of String(v).split(/\s+/)) if (c) el.classList.add(c);
    } else if (k === 'style') {
      if (typeof v === 'string') el.style.cssText += v;
      else
        for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
          if (sv === undefined || sv === null) continue;
          if (sk.startsWith('--')) el.style.setProperty(sk, String(sv));
          else (el.style as unknown as Record<string, unknown>)[sk] = sv;
        }
    } else if (k === 'dataset') {
      Object.assign(el.dataset, v);
    } else if (k === 'html') {
      el.innerHTML = String(v);
    } else if (k === 'text') {
      el.textContent = String(v);
    } else if (k in el && typeof v !== 'string') {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
}

/** Tạo phần tử từ chuỗi HTML/SVG. */
export function fromHTML<T extends Element = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

/** Nút bấm tiêu chuẩn. */
export function button(label: Child, onClick: (e: MouseEvent) => void, cls = '', attrs: Attrs = {}): HTMLButtonElement {
  const extra = cls.split(/\s+/).filter(Boolean);
  return h<HTMLButtonElement>(`button.btn${extra.map((c) => '.' + c).join('')}`, { type: 'button', onclick: onClick, ...attrs }, label);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
