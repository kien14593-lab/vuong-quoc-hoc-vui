import { goalProgress, goalsForWeek } from '../../core/goals';
import { profile, weekKey } from '../../core/state';
import { currentRooms } from '../../game/castle-rooms';
import { bearStage, bearSteps, mazeKeys, on, storyObjective, villageStars, ZONE_META, ZOO_TICKETS, PARK_STARS } from '../../game/story';
import { siteText, st } from '../../game/subject-text';
import type { ZoneId } from '../../core/state';
import { button, h } from '../dom';
import { openModal } from '../modal';

interface Task {
  text: string;
  done: boolean;
}

function zoneTasks(): { zone: ZoneId; tasks: Task[] }[] {
  const p = profile();
  const rooms = currentRooms();
  return [
    {
      zone: 'village',
      tasks: [
        { text: 'Đếm những chiếc hộp', done: on('village.boxes') },
        { text: `Tìm 5 ngôi sao cho Thỏ Bông (${villageStars()}/5)`, done: villageStars() >= 5 },
        { text: st('quest.shop'), done: on('shop.fruit') },
        { text: 'Nói chuyện với Chú Gấu ở cổng rừng', done: on('bear.start') },
      ],
    },
    {
      zone: 'forest',
      tasks: [
        { text: siteText('bridge.quest', 'forest.bridge'), done: on('forest.bridge') },
        { text: 'Dọn tảng đá chặn đường', done: on('forest.rock') },
        { text: 'Mở cây cầu bị khóa cho Chú Gấu', done: on('forest.bearBridge') },
        { text: siteText('stones.obj', 'forest.stones'), done: on('forest.stones') },
      ],
    },
    {
      zone: 'maze',
      tasks: [
        { text: `Tìm 3 chìa khóa (${mazeKeys()}/3)`, done: mazeKeys() >= 3 },
        { text: 'Mở cửa ra của Mê Cung', done: on('maze.exit') },
      ],
    },
    {
      zone: 'park',
      tasks: [
        { text: `Có ${PARK_STARS} ⭐ để vào cổng (${Math.min(p.stars, PARK_STARS)}/${PARK_STARS})`, done: p.stars >= PARK_STARS || on('visited.park') },
        { text: 'Tàu lượn siêu tốc', done: on('park.coaster') },
        { text: st('quest.balls'), done: on('park.balls') },
        { text: 'Vòng quay may mắn', done: on('park.wheel') },
        { text: 'Câu đố của Chú Hề', done: on('park.clown') },
      ],
    },
    {
      zone: 'zoo',
      tasks: [
        { text: `Đưa ${ZOO_TICKETS} vé cho Bác Voi`, done: on('zoo.open') },
        { text: 'Giúp bạn Hươu cao cổ', done: on('zoo.giraffe') },
        { text: 'Cho khỉ ăn chuối', done: on('zoo.monkey') },
        { text: 'Chia cá cho chim cánh cụt', done: on('zoo.penguins') },
      ],
    },
    {
      zone: 'castle',
      tasks: [
        { text: rooms.mul.title, done: on('castle.mul') },
        { text: rooms.frac.title, done: on('castle.frac') },
        { text: rooms.geo.title, done: on('castle.geo') },
        { text: 'Thử thách của Nhà Vua', done: on('castle.king') },
      ],
    },
    {
      zone: 'house',
      tasks: [
        { text: 'Trồng và thu hoạch cây đầu tiên', done: on('house.harvest') },
        { text: 'Trang trí ngôi nhà', done: Object.values(p.decor).some(Boolean) },
      ],
    },
  ];
}

/** Bảng nhiệm vụ: nhiệm vụ chính, hành trình Chú Gấu, việc ở từng khu vực, mục tiêu tuần của phụ huynh. */
export function openQuestBoard(): Promise<void> {
  const ob = storyObjective();
  const left = h('div.qb-col');
  left.appendChild(h('div.qb-main', h('div.qb-main-i', ob?.icon ?? '🎮'), h('div', h('div.qb-label', 'Nhiệm vụ chính'), h('div.qb-main-t', ob?.text ?? 'Khám phá thế giới và chơi mini-game!'), ob?.zone ? h('div.qb-where', `${ZONE_META[ob.zone].icon} ${ZONE_META[ob.zone].name}`) : null)));
  if (bearStage() !== 'none') {
    const ul = h('ul.qb-list');
    for (const s of bearSteps()) ul.appendChild(h(`li${s.done ? '.done' : ''}`, h('span.qb-check', s.done ? '✔' : ''), s.text));
    left.appendChild(h('div.qb-card', h('div.qb-card-h', '🐻 Giúp Chú Gấu đến Sở Thú'), ul));
  }
  const p = profile();
  const goals = goalsForWeek(p, weekKey());
  if (goals.length) {
    const ul = h('ul.qb-list');
    for (const g of goals) {
      const gp = goalProgress(p, g);
      ul.appendChild(h(`li${gp.completed ? '.done' : ''}`, h('span.qb-check', gp.completed ? '✔' : ''), `${g.title} (${Math.min(gp.done, gp.target)}/${gp.target})`));
    }
    left.appendChild(h('div.qb-card.goals', h('div.qb-card-h', '🎯 Mục tiêu tuần này'), ul));
  }
  const right = h('div.qb-col.qb-zones');
  for (const z of zoneTasks()) {
    const m = ZONE_META[z.zone];
    const n = z.tasks.filter((t) => t.done).length;
    const ul = h('ul.qb-list.small');
    for (const t of z.tasks) ul.appendChild(h(`li${t.done ? '.done' : ''}`, h('span.qb-check', t.done ? '✔' : ''), t.text));
    right.appendChild(h(`div.qb-card${n === z.tasks.length ? '.complete' : ''}`, { style: { '--zc': m.color } }, h('div.qb-card-h', `${m.icon} ${m.name}`, h('span.qb-count', `${n}/${z.tasks.length}`)), ul));
  }
  const modal = openModal({ title: 'Bảng nhiệm vụ', icon: '📋', width: 1800, body: h('div.qb', left, right), className: 'qb-modal', footer: button('Đã hiểu!', () => modal.close(), 'btn-primary') });
  return modal.closed;
}
