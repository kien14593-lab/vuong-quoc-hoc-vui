import { sfx } from '../../core/audio';
import { level, profile } from '../../core/state';
import { miniList, miniName } from '../../minigames';
import { h } from '../dom';
import { openModal } from '../modal';
import { toast } from '../toast';

/** Nơi có trò chơi trong thế giới (gợi ý cho trẻ). */
const WHERE: Record<string, string> = {
  number_match: '🏡 Làng',
  market: '🏡 Làng',
  fishing: '🌳 Rừng',
  runner: '🌳 Rừng',
  maze_run: '🌀 Mê Cung',
  shoot_answer: '🎡 Khu Vui Chơi',
  wheel: '🎡 Khu Vui Chơi',
  train: '🎡 Khu Vui Chơi',
  monkey: '🦁 Sở Thú',
  builder: '🏰 Lâu Đài',
  clock: '🏰 Lâu Đài',
  pizza: '🏰 Lâu Đài',
};

/** Danh sách trò chơi nhỏ – chơi ngay từ bất cứ đâu. */
export function openMiniHub(play: (id: string) => void): void {
  const lv = level();
  const p = profile();
  const grid = h('div.mh-grid');
  for (const d of miniList()) {
    const info = d.info;
    const locked = lv < info.unlock;
    const rec = p.mini[info.id];
    grid.appendChild(
      h(
        `button.mh-card${locked ? '.locked' : ''}`,
        {
          type: 'button',
          style: { '--mc': info.color },
          onclick: () => {
            if (locked) {
              sfx('error');
              toast(`Trò "${miniName(info)}" mở khi bạn đạt cấp ${info.unlock}. Cố lên nhé!`, { icon: '🔒', tone: 'warn', ms: 3200 });
              return;
            }
            modal.close();
            play(info.id);
          },
        },
        h('div.mh-icon', locked ? '🔒' : info.icon),
        h('div.mh-name', miniName(info)),
        h('div.mh-skill', info.skill),
        h('div.mh-foot', locked ? `Mở ở cấp ${info.unlock}` : rec?.plays ? `🏆 ${rec.best} điểm · ${rec.plays} lần` : 'Chưa chơi', h('span.mh-where', WHERE[info.id] ?? '')),
      ),
    );
  }
  const modal = openModal({ title: 'Trò chơi', icon: '🎮', width: 1760, body: h('div.mh', h('div.mh-tip', 'Chọn một trò chơi để luyện tập! Mỗi trò cho bạn xu và XP.'), grid), className: 'mh-modal' });
}
