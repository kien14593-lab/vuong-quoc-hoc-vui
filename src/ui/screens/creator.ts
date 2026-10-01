import { sfx } from '../../core/audio';
import { EYE_COLORS, HAIR_COLORS, HAIR_STYLES, item, SKIN_TONES } from '../../core/items';
import { createProfile, type Equipped, type Look } from '../../core/state';
import { enterWorld } from '../../game/app';
import type { Grade } from '../../math/types';
import { avatarUrl } from '../avatar';
import { button, h } from '../dom';
import { openModal } from '../modal';
import { toast } from '../toast';

const SHIRTS = ['shirt_blue', 'shirt_pink', 'shirt_yellow', 'shirt_green'];
const PANTS = ['pants_jean', 'pants_skirt', 'pants_shorts'];

function rnd(n: number): number {
  return Math.floor(Math.random() * n);
}

/** Màn hình tạo nhân vật mới. */
export function openCreator(): void {
  const look: Look = { skin: rnd(SKIN_TONES.length), hair: rnd(HAIR_STYLES.length), hairColor: rnd(HAIR_COLORS.length), eyes: rnd(EYE_COLORS.length) };
  const eq: Equipped = { shirt: SHIRTS[rnd(SHIRTS.length)], pants: PANTS[rnd(PANTS.length)], shoes: 'shoes_red', hat: null, backpack: null, acc: null, pet: null, board: null };
  let grade: Grade = 1;
  const views = [15, 60, 120, 180, 240, 300];
  let view = 0;

  const preview = h<HTMLImageElement>('img.cr-avatar', { alt: '', draggable: false });
  const nameInput = h<HTMLInputElement>('input.cr-name', { type: 'text', maxlength: 14, placeholder: 'Nhập tên của bạn...', spellcheck: false, autocomplete: 'off' });
  const refresh: (() => void)[] = [];
  const update = () => {
    preview.src = avatarUrl(look, eq, { yaw: views[view], framing: 'full', size: 560 });
    refresh.forEach((f) => f());
  };

  const swatchRow = (colors: string[], get: () => number, set: (i: number) => void) => {
    const row = h('div.cr-swatches');
    const btns = colors.map((c, i) =>
      h('button.cr-swatch', {
        type: 'button',
        style: { background: c },
        onclick: () => {
          set(i);
          sfx('pop');
          update();
        },
      }),
    );
    btns.forEach((b) => row.appendChild(b));
    refresh.push(() => btns.forEach((b, i) => b.classList.toggle('on', get() === i)));
    return row;
  };

  const optionRow = <T,>(opts: T[], label: (o: T) => HTMLElement | string, get: () => T, set: (o: T) => void, cls = '') => {
    const row = h(`div.cr-options${cls ? '.' + cls : ''}`);
    const btns = opts.map((o) =>
      h(
        'button.cr-opt',
        {
          type: 'button',
          onclick: () => {
            set(o);
            sfx('pop');
            update();
          },
        },
        label(o),
      ),
    );
    btns.forEach((b) => row.appendChild(b));
    refresh.push(() => btns.forEach((b, i) => b.classList.toggle('on', get() === opts[i])));
    return row;
  };

  const hairThumbs: HTMLImageElement[] = [];
  const hairRow = optionRow(
    HAIR_STYLES.map((_, i) => i),
    (i) => {
      const img = h<HTMLImageElement>('img.cr-hair-thumb', { alt: '', draggable: false });
      hairThumbs[i] = img;
      return h('span.cr-hair', img, h('span', HAIR_STYLES[i]));
    },
    () => look.hair,
    (i) => (look.hair = i),
    'hair',
  );
  refresh.push(() => hairThumbs.forEach((img, i) => (img.src = avatarUrl({ ...look, hair: i }, { ...eq, hat: null }, { yaw: 20, framing: 'head', size: 160 }))));

  const shirtRow = optionRow(
    SHIRTS,
    (id) => h('span.cr-cloth', h('i', { style: { background: item(id)?.color ?? '#ccc' } }), item(id)?.name.replace('Áo phông ', '') ?? id),
    () => eq.shirt,
    (id) => (eq.shirt = id),
  );
  const pantsRow = optionRow(
    PANTS,
    (id) => h('span.cr-cloth', h('i', { style: { background: item(id)?.color ?? '#ccc' } }), item(id)?.name ?? id),
    () => eq.pants,
    (id) => (eq.pants = id),
  );
  const gradeRow = optionRow<Grade>(
    [1, 2, 3, 4, 5],
    (g) => h('span.cr-grade', `Lớp ${g}`),
    () => grade,
    (g) => (grade = g),
    'grades',
  );

  const randomize = () => {
    look.skin = rnd(SKIN_TONES.length);
    look.hair = rnd(HAIR_STYLES.length);
    look.hairColor = rnd(HAIR_COLORS.length);
    look.eyes = rnd(EYE_COLORS.length);
    eq.shirt = SHIRTS[rnd(SHIRTS.length)];
    eq.pants = PANTS[rnd(PANTS.length)];
    sfx('whoosh');
    update();
  };

  const turn = (d: number) => {
    view = (view + d + views.length) % views.length;
    update();
  };

  const section = (title: string, ...kids: (HTMLElement | null)[]) => h('div.cr-section', h('div.cr-label', title), ...kids);

  const body = h(
    'div.creator',
    h(
      'div.cr-left',
      h('div.cr-stage', preview),
      h('div.cr-turn', button('◀', () => turn(-1), 'btn-round btn-soft', { title: 'Xoay trái' }), button('🎲 Ngẫu nhiên', randomize, 'btn-yellow'), button('▶', () => turn(1), 'btn-round btn-soft', { title: 'Xoay phải' })),
    ),
    h(
      'div.cr-right',
      section('Tên của bạn', nameInput),
      section('Bạn học lớp mấy?', gradeRow, h('div.cr-hint', 'Câu hỏi trong game sẽ phù hợp với lớp của bạn.')),
      section('Kiểu tóc', hairRow),
      h('div.cr-two', section('Màu tóc', swatchRow(HAIR_COLORS, () => look.hairColor, (i) => (look.hairColor = i))), section('Màu da', swatchRow(SKIN_TONES, () => look.skin, (i) => (look.skin = i)))),
      h('div.cr-two', section('Màu mắt', swatchRow(EYE_COLORS, () => look.eyes, (i) => (look.eyes = i))), section('Quần – váy', pantsRow)),
      section('Áo', shirtRow),
    ),
  );

  const start = () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.classList.remove('shake');
      void nameInput.offsetWidth;
      nameInput.classList.add('shake');
      nameInput.focus();
      toast('Hãy nhập tên của bạn nhé!', { icon: '✏️', tone: 'warn' });
      sfx('error');
      return;
    }
    createProfile({ name, grade, look: { ...look }, equipped: { ...eq } });
    sfx('levelup');
    modal.close();
    void enterWorld();
  };

  const modal = openModal({
    title: 'Tạo nhân vật của bạn',
    icon: '🎨',
    width: 1720,
    body,
    className: 'creator-modal',
    footer: button('Bắt đầu phiêu lưu! 🚀', start, 'btn-primary btn-big'),
  });
  nameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') start();
  });
  update();
  setTimeout(() => nameInput.focus(), 300);
}
