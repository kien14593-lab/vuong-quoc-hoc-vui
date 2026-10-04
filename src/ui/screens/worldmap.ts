import { sfx } from '../../core/audio';
import { profile, type ZoneId } from '../../core/state';
import { bearStage, bearSteps, canTravel, storyObjective, visited, zoneLock, ZONE_META, ZONE_ORDER } from '../../game/story';
import { avatarImg } from '../avatar';
import { button, h } from '../dom';
import { openModal } from '../modal';
import { toast } from '../toast';

/** Đường nối giữa các khu vực trên bản đồ. */
const ROADS: [ZoneId, ZoneId][] = [
  ['village', 'house'],
  ['village', 'forest'],
  ['forest', 'maze'],
  ['maze', 'zoo'],
  ['village', 'park'],
  ['park', 'zoo'],
  ['village', 'castle'],
];

const MAP_W = 1180;
const MAP_H = 780;

/** Bản đồ thế giới: xem các khu vực, đi nhanh tới nơi đã từng đến. */
export function openWorldMap(current: ZoneId, go: (z: ZoneId) => void): void {
  const ob = storyObjective();
  const pos = (z: ZoneId) => ({ x: ZONE_META[z].map.x * MAP_W, y: ZONE_META[z].map.y * MAP_H });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
  svg.setAttribute('class', 'wm-roads');
  for (const [a, b] of ROADS) {
    const pa = pos(a);
    const pb = pos(b);
    const mx = (pa.x + pb.x) / 2 + (pb.y - pa.y) * 0.12;
    const my = (pa.y + pb.y) / 2 - (pb.x - pa.x) * 0.12;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${pa.x},${pa.y} Q${mx},${my} ${pb.x},${pb.y}`);
    path.setAttribute('class', visited(a) && visited(b) ? 'wm-road known' : 'wm-road');
    svg.appendChild(path);
  }

  const map = h('div.wm-map', { style: { width: `${MAP_W}px`, height: `${MAP_H}px` } }, svg);
  for (const id of ZONE_ORDER) {
    const m = ZONE_META[id];
    const p = pos(id);
    const lock = zoneLock(id);
    const known = visited(id);
    const here = id === current;
    const goal = ob?.zone === id && !here;
    const cls = ['wm-node', here ? 'here' : '', lock ? 'locked' : '', known ? 'known' : 'unknown', goal ? 'goal' : ''].filter(Boolean).join('.');
    const node = h(
      `button.${cls}`,
      {
        type: 'button',
        style: { left: `${p.x}px`, top: `${p.y}px`, '--zc': m.color },
        onclick: () => {
          if (here) {
            modal.close();
            return;
          }
          if (lock) {
            sfx('error');
            toast(lock, { icon: '🔒', tone: 'warn', ms: 3600 });
            return;
          }
          if (!canTravel(id)) {
            sfx('error');
            toast('Bạn chưa đến nơi này. Hãy đi bộ tới lần đầu nhé!', { icon: '🧭', tone: 'warn', ms: 3200 });
            return;
          }
          sfx('whoosh');
          modal.close();
          go(id);
        },
      },
      h('span.wm-icon', known || !lock ? m.icon : '❔'),
      h('span.wm-name', m.name),
      lock ? h('span.wm-lock', '🔒') : null,
      goal ? h('span.wm-goal', '!') : null,
      here ? avatarImg(profile().kid, profile().equipped, 'wm-me', { framing: 'head', size: 160, yaw: 16 }) : null,
    );
    map.appendChild(node);
  }

  const side = h('div.wm-side');
  side.appendChild(h('div.wm-h', '📜 Nhiệm vụ'));
  side.appendChild(h('div.wm-objective', ob ? `${ob.icon ?? '📜'} ${ob.text}` : 'Khám phá thế giới và chơi mini-game!'));
  if (ob?.zone) side.appendChild(h('div.wm-where', `Ở: ${ZONE_META[ob.zone].icon} ${ZONE_META[ob.zone].name}`));
  const bs = bearStage();
  if (bs !== 'none') {
    side.appendChild(h('div.wm-h', '🐻 Giúp Chú Gấu đến Sở Thú'));
    const ul = h('ul.wm-steps');
    for (const s of bearSteps()) ul.appendChild(h(`li${s.done ? '.done' : ''}`, h('span.wm-check', s.done ? '✔' : '○'), s.text));
    side.appendChild(ul);
  }
  side.appendChild(h('div.wm-legend', h('div', h('b', '🧭'), ' Chạm vào nơi đã đến để đi nhanh'), h('div', h('b', '🔒'), ' Nơi chưa mở khóa'), h('div', h('b.wm-legend-goal', '!'), ' Nơi có nhiệm vụ')));

  const body = h('div.wm', map, side);
  const modal = openModal({ title: 'Bản đồ Vương Quốc', icon: '🗺️', width: 1780, body, className: 'wm-modal', footer: button('Đóng', () => modal.close(), 'btn-soft') });
}
