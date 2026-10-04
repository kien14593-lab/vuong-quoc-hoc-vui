import type { ShapeName, Visual } from '../math/types';
import { fmt } from '../math/util';
import { fromHTML, h } from './dom';

/** Vẽ hình minh họa trực quan cho câu hỏi (SVG + emoji, hiển thị trong giao diện). */
const OL = '#5b4a6e';
const PASTEL = ['#ff8fab', '#7ec8e3', '#ffd166', '#7bd389', '#b79cff', '#ffa96b', '#80e1d1', '#f4a6ff'];

const svgEl = (w: number, hgt: number, body: string, cls = '') =>
  fromHTML<SVGSVGElement>(`<svg class="vis-svg ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}">${body}</svg>`);

const T = (x: number, y: number, text: string, size = 28, fill = OL, weight = 700, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" dominant-baseline="central" font-family="Baloo 2, Segoe UI, sans-serif">${text}</text>`;

/* ---------------- Hình phẳng ---------------- */
function regular(n: number, cx: number, cy: number, r: number, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

export function shapeMarkup(s: ShapeName, cx: number, cy: number, size: number, color: string): string {
  const st = `fill="${color}" stroke="${OL}" stroke-width="4" stroke-linejoin="round"`;
  const r = size / 2;
  switch (s) {
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" ${st}/>`;
    case 'square':
      return `<rect x="${cx - r * 0.9}" y="${cy - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" rx="6" ${st}/>`;
    case 'rectangle':
      return `<rect x="${cx - r * 1.2}" y="${cy - r * 0.7}" width="${r * 2.4}" height="${r * 1.4}" rx="6" ${st}/>`;
    case 'triangle':
      return `<polygon points="${regular(3, cx, cy + r * 0.15, r * 1.05)}" ${st}/>`;
    case 'pentagon':
      return `<polygon points="${regular(5, cx, cy, r)}" ${st}/>`;
    case 'hexagon':
      return `<polygon points="${regular(6, cx, cy, r, 0)}" ${st}/>`;
    case 'oval':
      return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.2}" ry="${r * 0.75}" ${st}/>`;
    case 'diamond':
      return `<polygon points="${cx},${cy - r} ${cx + r * 0.75},${cy} ${cx},${cy + r} ${cx - r * 0.75},${cy}" ${st}/>`;
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.48;
        const a = ((-90 + i * 36) * Math.PI) / 180;
        pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" ${st}/>`;
    }
  }
}

/* ---------------- Đồng hồ ---------------- */
export function clockMarkup(hh: number, mm: number, cx: number, cy: number, r: number): string {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="#ffd6e8" stroke="${OL}" stroke-width="5"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="${OL}" stroke-width="3"/>`;
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 * Math.PI) / 180;
    const big = i % 5 === 0;
    const r1 = r - (big ? 12 : 6);
    s += `<line x1="${cx + Math.sin(a) * r1}" y1="${cy - Math.cos(a) * r1}" x2="${cx + Math.sin(a) * (r - 2)}" y2="${cy - Math.cos(a) * (r - 2)}" stroke="${OL}" stroke-width="${big ? 3 : 1.5}" stroke-linecap="round"/>`;
  }
  for (let n = 1; n <= 12; n++) {
    const a = (n * 30 * Math.PI) / 180;
    s += T(cx + Math.sin(a) * (r - 30), cy - Math.cos(a) * (r - 30) + 2, String(n), r * 0.2);
  }
  const ha = (((hh % 12) + mm / 60) * 30 * Math.PI) / 180;
  const ma = (mm * 6 * Math.PI) / 180;
  s += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(ha) * r * 0.5}" y2="${cy - Math.cos(ha) * r * 0.5}" stroke="#ff6b9a" stroke-width="10" stroke-linecap="round"/>`;
  s += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(ma) * r * 0.78}" y2="${cy - Math.cos(ma) * r * 0.78}" stroke="#4aa3d8" stroke-width="7" stroke-linecap="round"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="8" fill="${OL}"/>`;
  return s;
}

/* ---------------- Phân số ---------------- */
export function pieMarkup(n: number, d: number, cx: number, cy: number, r: number, color = '#ff8fab'): string {
  if (d === 1) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${n >= 1 ? color : '#fff'}" stroke="${OL}" stroke-width="4"/>`;
  let s = '';
  for (let i = 0; i < d; i++) {
    const a0 = ((i / d) * 360 - 90) * (Math.PI / 180);
    const a1 = (((i + 1) / d) * 360 - 90) * (Math.PI / 180);
    const large = 1 / d > 0.5 ? 1 : 0;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    s += `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${i < n ? color : '#ffffff'}" stroke="${OL}" stroke-width="3.5" stroke-linejoin="round"/>`;
  }
  return s;
}

function barMarkup(n: number, d: number, x: number, y: number, w: number, hgt: number, color = '#7ec8e3'): string {
  let s = '';
  const cw = w / d;
  for (let i = 0; i < d; i++) s += `<rect x="${x + i * cw}" y="${y}" width="${cw}" height="${hgt}" fill="${i < n ? color : '#ffffff'}" stroke="${OL}" stroke-width="3.5"/>`;
  return s + `<rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="4" fill="none" stroke="${OL}" stroke-width="4.5"/>`;
}

/* ---------------- Khối lập phương mười ---------------- */
function blocksMarkup(nv: number, x0: number, y0: number): { s: string; w: number } {
  const hundreds = Math.floor(nv / 100);
  const tens = Math.floor((nv % 100) / 10);
  const ones = nv % 10;
  const u = 13;
  let s = '';
  let x = x0;
  for (let i = 0; i < hundreds; i++) {
    s += `<rect x="${x}" y="${y0}" width="${u * 10}" height="${u * 10}" fill="#ffd166" stroke="${OL}" stroke-width="2.5"/>`;
    for (let k = 1; k < 10; k++) s += `<line x1="${x + k * u}" y1="${y0}" x2="${x + k * u}" y2="${y0 + u * 10}" stroke="${OL}" stroke-width="0.8" opacity=".5"/><line x1="${x}" y1="${y0 + k * u}" x2="${x + u * 10}" y2="${y0 + k * u}" stroke="${OL}" stroke-width="0.8" opacity=".5"/>`;
    x += u * 10 + 10;
  }
  for (let i = 0; i < tens; i++) {
    s += `<rect x="${x}" y="${y0}" width="${u}" height="${u * 10}" rx="2" fill="#7ec8e3" stroke="${OL}" stroke-width="2.5"/>`;
    for (let k = 1; k < 10; k++) s += `<line x1="${x}" y1="${y0 + k * u}" x2="${x + u}" y2="${y0 + k * u}" stroke="${OL}" stroke-width="1" opacity=".6"/>`;
    x += u + 6;
  }
  if (ones) x += 4;
  for (let i = 0; i < ones; i++) {
    const col = Math.floor(i / 5);
    const row = i % 5;
    s += `<rect x="${x + col * (u + 4)}" y="${y0 + u * 10 - (row + 1) * (u + 4) + 4}" width="${u}" height="${u}" rx="2" fill="#ff8fab" stroke="${OL}" stroke-width="2.5"/>`;
  }
  if (ones) x += Math.ceil(ones / 5) * (u + 4);
  return { s, w: x - x0 };
}

/* ---------------- Khối không gian ---------------- */
function solidMarkup(kind: 'cube' | 'box' | 'cylinder' | 'sphere', cx: number, cy: number): string {
  const st = `stroke="${OL}" stroke-width="4" stroke-linejoin="round"`;
  switch (kind) {
    case 'cube': {
      const a = 110;
      const o = 40;
      const x = cx - a / 2 - o / 2;
      const y = cy - a / 2 + o / 2;
      return `<polygon points="${x},${y} ${x + o},${y - o} ${x + a + o},${y - o} ${x + a},${y}" fill="#ffe08a" ${st}/><polygon points="${x + a},${y} ${x + a + o},${y - o} ${x + a + o},${y + a - o} ${x + a},${y + a}" fill="#f2b84b" ${st}/><rect x="${x}" y="${y}" width="${a}" height="${a}" fill="#ffd166" ${st}/>`;
    }
    case 'box': {
      const w = 170;
      const hh = 90;
      const o = 40;
      const x = cx - w / 2 - o / 2;
      const y = cy - hh / 2 + o / 2;
      return `<polygon points="${x},${y} ${x + o},${y - o} ${x + w + o},${y - o} ${x + w},${y}" fill="#a8dcf0" ${st}/><polygon points="${x + w},${y} ${x + w + o},${y - o} ${x + w + o},${y + hh - o} ${x + w},${y + hh}" fill="#5fb3d6" ${st}/><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#7ec8e3" ${st}/>`;
    }
    case 'cylinder':
      return `<path d="M${cx - 60} ${cy - 60} L${cx - 60} ${cy + 60} A60 20 0 0 0 ${cx + 60} ${cy + 60} L${cx + 60} ${cy - 60}" fill="#ffb3c8" ${st}/><ellipse cx="${cx}" cy="${cy - 60}" rx="60" ry="20" fill="#ffd6e2" ${st}/>`;
    case 'sphere':
      return `<defs><radialGradient id="sg" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#b8e6b8"/><stop offset="1" stop-color="#5fbf6e"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="80" fill="url(#sg)" ${st}/><ellipse cx="${cx}" cy="${cy}" rx="80" ry="22" fill="none" stroke="${OL}" stroke-width="2" stroke-dasharray="6 6" opacity=".5"/>`;
  }
}

/* ---------------- Emoji nhóm ---------------- */
function emojiGroup(emoji: string, count: number, crossFrom = Infinity): HTMLElement {
  const g = h('div.vis-group');
  const perRow = count > 10 ? 10 : 5;
  g.style.gridTemplateColumns = `repeat(${Math.min(perRow, Math.max(1, count))}, auto)`;
  for (let i = 0; i < count; i++) g.appendChild(h(`span.emo${i >= crossFrom ? '.crossed' : ''}`, emoji));
  if (count > 15) g.classList.add('dense');
  return g;
}

function compareItem(value: string, style: 'stones' | 'balls' | 'cards', i: number): HTMLElement {
  return h(`div.cmp-item.cmp-${style}`, { style: { '--c': PASTEL[i % PASTEL.length] } as unknown as Partial<CSSStyleDeclaration> }, h('span', value));
}

/** Hình của một từ: emoji to, hoặc ô màu (câu hỏi về màu sắc). */
function picture(emoji: string | undefined, hex: string | undefined, caption: string | undefined): HTMLElement {
  return h(
    'div.vis-pic',
    hex ? h('span.vis-swatch', { style: { background: hex } }) : emoji ? h('span.vis-emoji', emoji) : null,
    caption ? h('div.vis-caption', caption) : null,
  );
}

export interface VisualOptions {
  /** Thẻ "Nghe" (câu hỏi nghe tiếng Anh): bấm để nghe lại. */
  onListen?: () => void;
}

/** Dựng phần tử minh họa cho một câu hỏi. */
export function renderVisual(v: Visual, o: VisualOptions = {}): HTMLElement {
  const wrap = h(`div.visual.vis-${v.kind}`);
  switch (v.kind) {
    case 'picture':
      wrap.appendChild(picture(v.emoji, v.hex, v.caption));
      break;
    case 'listen':
      wrap.appendChild(
        h(
          'button.btn.vis-listen-btn',
          { type: 'button', title: 'Nghe lại', onclick: () => o.onListen?.() },
          h('span.vis-listen-ic', '🔊'),
          h('span.vis-listen-tx', 'Nghe lại'),
        ),
      );
      break;
    case 'letters': {
      if (v.emoji || v.caption) wrap.appendChild(picture(v.emoji, undefined, v.caption));
      const row = h('div.vis-tiles', { lang: 'en' });
      for (const t of v.tiles) row.appendChild(t === null ? h('span.tile.blank', '?') : t === ' ' ? h('span.tile.gap') : h('span.tile', t));
      wrap.appendChild(row);
      break;
    }
    case 'objects': {
      if (v.op === '-' && v.groups.length === 1) {
        const total = v.groups[0];
        wrap.appendChild(emojiGroup(v.emoji, total, total - (v.crossOut ?? 0)));
      } else {
        v.groups.forEach((n, i) => {
          if (i > 0) wrap.appendChild(h('span.vis-op', v.op === '-' ? '−' : '+'));
          wrap.appendChild(emojiGroup(v.emoji, n));
        });
      }
      break;
    }
    case 'groups':
      for (let i = 0; i < v.groups; i++) {
        const g = emojiGroup(v.emoji, v.each);
        g.classList.add('boxed');
        g.style.setProperty('--c', PASTEL[i % PASTEL.length]);
        wrap.appendChild(g);
      }
      break;
    case 'share': {
      wrap.appendChild(emojiGroup(v.emoji, v.total));
      wrap.appendChild(h('span.vis-op', '→'));
      const plates = h('div.vis-plates');
      for (let i = 0; i < v.parts; i++) plates.appendChild(h('div.plate', { style: { '--c': PASTEL[i % PASTEL.length] } as unknown as Partial<CSSStyleDeclaration> }, '🍽️'));
      wrap.appendChild(plates);
      break;
    }
    case 'compare':
      v.values.forEach((val, i) => wrap.appendChild(compareItem(val, v.style, i)));
      break;
    case 'pair':
      wrap.append(compareItem(v.left, 'cards', 0), h('div.pair-q', '?'), compareItem(v.right, 'cards', 1));
      break;
    case 'blocks': {
      let body = '';
      let x = 10;
      v.numbers.forEach((nv, i) => {
        if (i > 0) {
          body += T(x + 22, 75, v.op === '-' ? '−' : '+', 54);
          x += 54;
        }
        const b = blocksMarkup(nv, x, 10);
        body += b.s;
        body += T(x + b.w / 2, 158, String(nv), 30);
        x += b.w + 16;
      });
      wrap.appendChild(svgEl(Math.max(200, x), 180, body));
      break;
    }
    case 'place': {
      const cols: [string, number, string][] = [];
      if (v.hundreds) cols.push(['Trăm', v.hundreds, '#ffd166']);
      cols.push(['Chục', v.tens, '#7ec8e3'], ['Đơn vị', v.ones, '#ff8fab']);
      for (const [label, n, c] of cols) {
        const unit = label === 'Trăm' ? 100 : label === 'Chục' ? 10 : 1;
        const b = blocksMarkup(n * unit, 6, 6);
        wrap.appendChild(h('div.place-col', { style: { '--c': c } as unknown as Partial<CSSStyleDeclaration> }, h('div.place-head', label), svgEl(Math.max(60, b.w + 12), 146, b.s)));
      }
      break;
    }
    case 'clock':
      wrap.appendChild(svgEl(250, 250, clockMarkup(v.h, v.m, 125, 125, 105)));
      break;
    case 'fraction':
      wrap.appendChild(v.shape === 'pie' ? svgEl(230, 230, pieMarkup(v.n, v.d, 115, 115, 100)) : svgEl(520, 120, barMarkup(v.n, v.d, 10, 20, 500, 80)));
      break;
    case 'fractionPair':
      wrap.append(svgEl(200, 200, pieMarkup(v.a[0], v.a[1], 100, 100, 88)), h('div.pair-q', '?'), svgEl(200, 200, pieMarkup(v.b[0], v.b[1], 100, 100, 88, '#7ec8e3')));
      break;
    case 'shape':
      wrap.appendChild(svgEl(260, 230, shapeMarkup(v.shape, 130, 115, 180, PASTEL[v.shape.length % PASTEL.length])));
      break;
    case 'shapes': {
      const n = v.shapes.length;
      const size = n > 6 ? 90 : 120;
      const gap = size + 30;
      const w = n * gap;
      wrap.appendChild(svgEl(w, size + 40, v.shapes.map((s, i) => shapeMarkup(s, gap / 2 + i * gap, (size + 40) / 2, size * 0.8, PASTEL[i % PASTEL.length])).join('')));
      break;
    }
    case 'angle': {
      const cx = 150;
      const cy = 200;
      const L = 170;
      const a = (-v.degrees * Math.PI) / 180;
      const x2 = cx + Math.cos(a) * L;
      const y2 = cy + Math.sin(a) * L;
      const ar = 50;
      const large = v.degrees > 180 ? 1 : 0;
      let body = `<line x1="${cx}" y1="${cy}" x2="${cx + L + 60}" y2="${cy}" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>`;
      body += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>`;
      if (v.degrees === 90) body += `<path d="M${cx + 34} ${cy} L${cx + 34} ${cy - 34} L${cx} ${cy - 34}" fill="#ffd166" fill-opacity=".6" stroke="#ff6b9a" stroke-width="4"/>`;
      else body += `<path d="M${cx} ${cy} L${cx + ar} ${cy} A${ar} ${ar} 0 ${large} 0 ${cx + Math.cos(a) * ar} ${cy + Math.sin(a) * ar} Z" fill="#ffd166" fill-opacity=".6" stroke="#ff6b9a" stroke-width="4"/>`;
      body += `<circle cx="${cx}" cy="${cy}" r="7" fill="${OL}"/>`;
      wrap.appendChild(svgEl(440, 230, body));
      break;
    }
    case 'solid':
      wrap.appendChild(svgEl(300, 240, solidMarkup(v.solid, 150, 125)));
      break;
    case 'rect': {
      const maxW = 420;
      const maxH = 170;
      const k = Math.min(maxW / v.w, maxH / v.h, v.grid ? 40 : 60);
      const w = v.w * k;
      const hh = v.h * k;
      const x = 90;
      const y = 30;
      let body = `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${v.square ? '#ffe08a' : '#a8dcf0'}" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>`;
      if (v.grid) {
        for (let i = 1; i < v.w; i++) body += `<line x1="${x + i * k}" y1="${y}" x2="${x + i * k}" y2="${y + hh}" stroke="${OL}" stroke-width="2" opacity=".6"/>`;
        for (let j = 1; j < v.h; j++) body += `<line x1="${x}" y1="${y + j * k}" x2="${x + w}" y2="${y + j * k}" stroke="${OL}" stroke-width="2" opacity=".6"/>`;
      } else {
        const unitLabel = v.unit === '?' ? '?' : `${fmt(v.w)} ${v.unit}`;
        const unitLabelH = v.unit === '?' ? '?' : `${fmt(v.h)} ${v.unit}`;
        body += T(x + w / 2, y + hh + 26, unitLabel, 28);
        if (!v.square || v.unit === '?') body += T(x + w + 14, y + hh / 2, unitLabelH, 28, OL, 700, 'start');
      }
      wrap.appendChild(svgEl(x + w + 170, hh + 80, body));
      break;
    }
    case 'triangle': {
      if (v.height) {
        const body = `<polygon points="60,190 380,190 150,30" fill="#ffd6e2" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/><line x1="150" y1="30" x2="150" y2="190" stroke="#ff6b9a" stroke-width="4" stroke-dasharray="10 7"/><rect x="150" y="172" width="18" height="18" fill="none" stroke="#ff6b9a" stroke-width="3"/>${T(220, 214, `đáy ${fmt(v.a)} ${v.unit}`, 26)}${T(100, 110, `cao ${fmt(v.height)} ${v.unit}`, 24, '#d6336c', 700, 'end')}`;
        wrap.appendChild(svgEl(460, 240, body));
      } else {
        const body = `<polygon points="70,190 390,190 200,30" fill="#d9f7dc" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>${T(230, 216, `${fmt(v.a)} ${v.unit}`, 26)}${T(120, 100, `${fmt(v.b)} ${v.unit}`, 26, OL, 700, 'end')}${T(306, 100, `${fmt(v.c)} ${v.unit}`, 26, OL, 700, 'start')}`;
        wrap.appendChild(svgEl(460, 240, body));
      }
      break;
    }
    case 'circle': {
      let body = `<circle cx="130" cy="120" r="100" fill="#ece4ff" stroke="${OL}" stroke-width="5"/><circle cx="130" cy="120" r="5" fill="${OL}"/>`;
      if (v.showDiameter) body += `<line x1="30" y1="120" x2="230" y2="120" stroke="#ff6b9a" stroke-width="4"/>${T(130, 100, `d = ${fmt(v.r * 2)} ${v.unit}`, 26)}`;
      else body += `<line x1="130" y1="120" x2="230" y2="120" stroke="#ff6b9a" stroke-width="4"/>${T(180, 100, `r = ${fmt(v.r)} ${v.unit}`, 26)}`;
      wrap.appendChild(svgEl(260, 240, body));
      break;
    }
    case 'sequence':
      v.items.forEach((it, i) => {
        wrap.appendChild(h(`div.seq-car${it === null ? '.missing' : ''}`, { style: { '--c': PASTEL[i % PASTEL.length] } as unknown as Partial<CSSStyleDeclaration> }, h('span', it ?? '?')));
      });
      wrap.prepend(h('div.seq-engine', '🚂'));
      break;
    case 'money': {
      for (const it of v.items) {
        wrap.appendChild(h('div.price-tag', h('div.pt-emoji', it.emoji), h('div.pt-name', `${it.qty && it.qty > 1 ? it.qty + ' ' : ''}${it.name}`), h('div.pt-price', `${fmt(it.price)} xu${it.qty && it.qty > 1 ? ' / 1' : ''}`)));
      }
      if (v.budget !== undefined) wrap.appendChild(h('div.wallet', h('div.pt-emoji', '👛'), h('div.pt-name', 'Bạn có'), h('div.pt-price', `${fmt(v.budget)} xu`)));
      break;
    }
    case 'ruler': {
      const max = Math.max(10, v.length + 2);
      const k = Math.min(58, 1100 / max);
      const x0 = 30;
      let body = `<rect x="${x0 - 14}" y="110" width="${max * k + 28}" height="80" rx="8" fill="#fff1c1" stroke="${OL}" stroke-width="4"/>`;
      for (let i = 0; i <= max; i++) {
        body += `<line x1="${x0 + i * k}" y1="110" x2="${x0 + i * k}" y2="${136}" stroke="${OL}" stroke-width="3"/>`;
        body += T(x0 + i * k, 160, String(i), 22, OL, 600);
        if (i < max) body += `<line x1="${x0 + (i + 0.5) * k}" y1="110" x2="${x0 + (i + 0.5) * k}" y2="124" stroke="${OL}" stroke-width="2"/>`;
      }
      const L = v.length * k;
      if (v.object === 'ribbon') body += `<rect x="${x0}" y="62" width="${L}" height="30" rx="6" fill="#ff8fab" stroke="${OL}" stroke-width="4"/>`;
      else {
        const col = v.object === 'pencil' ? '#ffd166' : '#7ec8e3';
        body += `<rect x="${x0}" y="60" width="${L - 34}" height="34" rx="4" fill="${col}" stroke="${OL}" stroke-width="4"/><polygon points="${x0 + L - 34},60 ${x0 + L},77 ${x0 + L - 34},94" fill="#f3dcc0" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/><polygon points="${x0 + L - 10},72 ${x0 + L},77 ${x0 + L - 10},82" fill="${OL}"/>`;
        if (v.object === 'pencil') body += `<rect x="${x0}" y="60" width="16" height="34" rx="4" fill="#ff8fab" stroke="${OL}" stroke-width="4"/>`;
      }
      body += `<line x1="${x0}" y1="40" x2="${x0}" y2="110" stroke="#ff6b9a" stroke-width="3" stroke-dasharray="6 5"/><line x1="${x0 + L}" y1="40" x2="${x0 + L}" y2="110" stroke="#ff6b9a" stroke-width="3" stroke-dasharray="6 5"/>`;
      wrap.appendChild(svgEl(max * k + 60, 200, body));
      break;
    }
    case 'lengths': {
      const max = Math.max(...v.items.map((i) => i.length));
      const k = 640 / max;
      let body = `<line x1="200" y1="10" x2="200" y2="${v.items.length * 56 + 10}" stroke="#ff6b9a" stroke-width="3" stroke-dasharray="6 5"/>`;
      v.items.forEach((it, i) => {
        const y = 18 + i * 56;
        body += T(185, y + 18, it.name, 26, OL, 700, 'end');
        body += `<rect x="200" y="${y}" width="${it.length * k}" height="36" rx="10" fill="${it.color}" stroke="${OL}" stroke-width="4"/>`;
      });
      wrap.appendChild(svgEl(880, v.items.length * 56 + 24, body));
      break;
    }
    case 'ratio':
      wrap.append(emojiGroup(v.a.emoji, v.a.count), h('span.vis-op', 'và'), emojiGroup(v.b.emoji, v.b.count));
      break;
    case 'grid100': {
      const c = 19;
      let body = '';
      const shaded = v.tenths * 10 + v.hundredths;
      for (let col = 0; col < 10; col++) {
        for (let row = 0; row < 10; row++) {
          const idx = col * 10 + row;
          body += `<rect x="${10 + col * c}" y="${10 + row * c}" width="${c}" height="${c}" fill="${idx < shaded ? '#7bd389' : '#ffffff'}" stroke="${OL}" stroke-width="1.2"/>`;
        }
      }
      body += `<rect x="10" y="10" width="${c * 10}" height="${c * 10}" fill="none" stroke="${OL}" stroke-width="4"/>`;
      wrap.appendChild(svgEl(c * 10 + 20, c * 10 + 20, body));
      break;
    }
  }
  return wrap;
}
