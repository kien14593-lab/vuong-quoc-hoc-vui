import { audio } from '../../core/audio';
import { deleteProfile, listProfiles, loadProfile } from '../../core/state';
import { enterWorld } from '../../game/app';
import { subjectLabel, TAGLINE } from '../../game/subject-text';
import { avatarImg } from '../avatar';
import { button, h } from '../dom';
import { confirmBox, openModal, type ModalHandle } from '../modal';
import { layer } from '../root';
import { openCreator } from './creator';
import { openDashboard } from './dashboard';
import { openSettings } from './settings';

let el: HTMLElement | null = null;

function logo(): HTMLElement {
  const colors = ['#ff6f91', '#ff9f43', '#ffc93c', '#5fcf80', '#4bb4de', '#9b7bff', '#ff7eb6'];
  const big = h('div.tl-big');
  [...'Học Vui'].forEach((ch, i) => {
    big.appendChild(ch === ' ' ? h('span.sp', ' ') : h('span', { style: { color: colors[i % colors.length], animationDelay: `${i * 0.12}s` } }, ch));
  });
  return h('div.title-logo', h('div.tl-small', '✨ Vương Quốc ✨'), big, h('div.tl-sub', TAGLINE));
}

export function showTitleMenu(): void {
  hideTitleMenu();
  const play = button('▶  Chơi', () => onPlay(), 'btn-primary btn-big title-play');
  el = h(
    'div.title-screen',
    logo(),
    h('div.title-buttons', play, h('div.title-row', button('⚙️ Cài đặt', () => openSettings({ inGame: false }), 'btn-soft'), button('👪 Góc phụ huynh', () => openDashboard(), 'btn-soft'))),
    h('div.title-foot', 'Dành cho học sinh lớp 1 – 5 · Không cần mạng Internet'),
  );
  layer('panel').appendChild(el);
}

export function hideTitleMenu(): void {
  el?.remove();
  el = null;
}

function onPlay(): void {
  audio.music('title');
  const profiles = listProfiles();
  if (!profiles.length) {
    openCreator();
    return;
  }
  openPicker();
}

function openPicker(): void {
  const grid = h('div.profile-grid');
  let modal: ModalHandle;
  const render = () => {
    grid.innerHTML = '';
    for (const p of listProfiles()) {
      const card = h(
        'button.profile-card',
        {
          type: 'button',
          onclick: () => {
            if (!loadProfile(p.id)) return;
            modal.close();
            void enterWorld();
          },
        },
        h('div.pc-avatar', avatarImg(p.kid, p.equipped, 'pc-img')),
        h('div.pc-name', p.name),
        h('div.pc-info', `Lớp ${p.grade} · Cấp ${p.level} · ⭐ ${p.stars}`),
        h('div.pc-info.pc-subj', subjectLabel(p.subject)),
        h(
          'span.pc-del',
          {
            title: 'Xóa hồ sơ',
            onclick: async (e: MouseEvent) => {
              e.stopPropagation();
              const ok = await confirmBox(`Xóa hồ sơ của "${p.name}"? Toàn bộ tiến trình chơi sẽ bị mất và không lấy lại được.`, { title: 'Xóa hồ sơ', icon: '🗑️', yes: 'Xóa', no: 'Giữ lại' });
              if (ok) {
                deleteProfile(p.id);
                if (!listProfiles().length) {
                  modal.close();
                  return;
                }
                render();
              }
            },
          },
          '🗑️',
        ),
      );
      grid.appendChild(card);
    }
    grid.appendChild(
      h(
        'button.profile-card.pc-new',
        {
          type: 'button',
          onclick: () => {
            modal.close();
            openCreator();
          },
        },
        h('div.pc-plus', '+'),
        h('div.pc-name', 'Bạn mới'),
        h('div.pc-info', 'Tạo nhân vật'),
      ),
    );
  };
  render();
  modal = openModal({ title: 'Ai đang chơi nhỉ?', icon: '🧒', width: 1500, body: grid, className: 'picker-modal' });
}
