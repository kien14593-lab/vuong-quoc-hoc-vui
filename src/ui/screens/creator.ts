import { sfx } from '../../core/audio';
import { DEFAULT_OUTFIT, KID_NAMES, KIDS, type Kid } from '../../core/outfits';
import { createProfile } from '../../core/state';
import { enterWorld } from '../../game/app';
import { SUBJECT_MODES, subjectLabel } from '../../game/subject-text';
import type { Grade, SubjectMode } from '../../math/types';
import { avatarImg } from '../avatar';
import { button, h } from '../dom';
import { openModal } from '../modal';
import { toast } from '../toast';

/** Màn hình tạo nhân vật mới: chọn bé trai / bé gái, nhập tên, chọn lớp và môn học. */
export function openCreator(): void {
  let kid: Kid | null = null;
  let grade: Grade = 1;
  let subject: SubjectMode = 'both';

  const nameInput = h<HTMLInputElement>('input.cr-name', { type: 'text', maxlength: 14, placeholder: 'Nhập tên của bạn...', spellcheck: false, autocomplete: 'off' });
  const refresh: (() => void)[] = [];
  const update = () => refresh.forEach((f) => f());

  /* Hai thẻ lớn: bé trai, bé gái (ảnh vẽ từ mô hình AI, chờ tải thì hiện bóng bé tạm). */
  const kidsEl = h('div.cr-kids');
  const kidCards = KIDS.map((k) =>
    h(
      `button.cr-kid.${k}`,
      {
        type: 'button',
        onclick: () => {
          kid = k;
          sfx('pop');
          update();
        },
      },
      h('div.cr-kid-stage', avatarImg(k, { outfit: DEFAULT_OUTFIT }, 'cr-kid-img', { framing: 'full', size: 480, yaw: 14 })),
      h('div.cr-kid-name', KID_NAMES[k]),
    ),
  );
  kidCards.forEach((c) => kidsEl.appendChild(c));
  refresh.push(() => {
    kidsEl.classList.toggle('picked', kid !== null);
    kidCards.forEach((c, i) => c.classList.toggle('on', KIDS[i] === kid));
  });

  const gradeRow = h('div.cr-options.grades');
  const gradeBtns = ([1, 2, 3, 4, 5] as Grade[]).map((g) =>
    h(
      'button.cr-opt',
      {
        type: 'button',
        onclick: () => {
          grade = g;
          sfx('pop');
          update();
        },
      },
      h('span.cr-grade', `Lớp ${g}`),
    ),
  );
  gradeBtns.forEach((b) => gradeRow.appendChild(b));
  refresh.push(() => gradeBtns.forEach((b, i) => b.classList.toggle('on', grade === i + 1)));

  const subjectRow = h('div.cr-options.subjects');
  const subjectBtns = SUBJECT_MODES.map((m) =>
    h(
      'button.cr-opt',
      {
        type: 'button',
        onclick: () => {
          subject = m;
          sfx('pop');
          update();
        },
      },
      subjectLabel(m),
    ),
  );
  subjectBtns.forEach((b) => subjectRow.appendChild(b));
  const subjectNote = h('div.cr-hint');
  refresh.push(() => {
    subjectBtns.forEach((b, i) => b.classList.toggle('on', SUBJECT_MODES[i] === subject));
    subjectNote.textContent = subject !== 'math' && grade <= 2 ? 'Tiếng Anh lớp 1–2: làm quen qua hình và âm thanh.' : 'Mọi câu đố trong game sẽ theo môn bạn chọn.';
  });

  const section = (title: string, ...kids: (HTMLElement | null)[]) => h('div.cr-section', h('div.cr-label', title), ...kids);

  const body = h(
    'div.creator',
    h('div.cr-left', h('div.cr-label', 'Bạn là bé trai hay bé gái?'), kidsEl),
    h(
      'div.cr-right',
      section('Tên của bạn', nameInput),
      section('Bạn học lớp mấy?', gradeRow, h('div.cr-hint', 'Câu hỏi trong game sẽ phù hợp với lớp của bạn.')),
      section('Bạn muốn học môn gì?', subjectRow, subjectNote),
      h('div.cr-hint.cr-later', '👕 Sau này bạn có thể đổi bé và mặc bộ đồ mới trong Túi đồ.'),
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
    if (!kid) {
      kidsEl.classList.remove('shake');
      void kidsEl.offsetWidth;
      kidsEl.classList.add('shake');
      toast('Hãy chọn bé trai hoặc bé gái nhé!', { icon: '👆', tone: 'warn' });
      sfx('error');
      return;
    }
    createProfile({ name, grade, kid, subject });
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
