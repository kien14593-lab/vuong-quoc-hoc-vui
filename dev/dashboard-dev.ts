import '@fontsource/baloo-2/vietnamese-500.css';
import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/vietnamese-700.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/latin-ext-500.css';
import '@fontsource/baloo-2/latin-ext-600.css';
import '@fontsource/baloo-2/latin-ext-700.css';
import '@fontsource/baloo-2/latin-ext-800.css';
import '../src/styles/main.css';
import { initUI } from '../src/ui/root';
import { newProfile, writeProfile, type Profile } from '../src/core/state';
import { openDashboard } from '../src/ui/screens/dashboard';
import { GRADE_TOPICS, TOPICS } from '../src/math/curriculum';
import type { Grade, Topic } from '../src/math/types';

window.__VQTH_DASHBOARD_SKIP_GATE__ = true;

function seedProfile(name: string, grade: Grade, days: number, focus: Topic[]): Profile {
  const p = newProfile({ name, grade, kid: 'gai' });
  p.id = `dash-dev-${grade}-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  p.created = Date.now() - (days + 5) * 86400000;
  p.xp = grade === 2 ? 360 : 820;
  p.coins = grade === 2 ? 145 : 328;
  p.stars = grade === 2 ? 18 : 42;
  p.badges = grade === 2 ? ['cham-chi', 'tram-cau'] : ['cham-chi', 'tram-cau', 'hiep-si', 'nha-toan-hoc'];
  const topics = GRADE_TOPICS[grade];
  for (let d = days - 1; d >= 0; d--) {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(17 + (d % 3), 15, 0, 0);
    const count = d % 5 === 0 ? 0 : 4 + ((d + grade) % 8);
    if (!count) continue;
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    p.days[key] = { ms: count * (90000 + d * 7000), q: 0, first: 0 };
    for (let i = 0; i < count; i++) {
      const topic = i % 3 === 0 ? focus[(i + d) % focus.length] : topics[(i + d) % topics.length];
      const hard = focus.includes(topic) && (i + d) % 4 === 0;
      const attempts = hard ? 3 : (i + d) % 5 === 0 ? 2 : 1;
      const ms = 14000 + ((i + d) % 8) * 3500;
      p.log.push({ t: t.getTime() + i * 900000, topic, lv: 1 + ((i + d) % 4), a: attempts, ms, src: i % 2 ? 'practice' : 'maze' });
      const st = (p.stats[topic] ??= { q: 0, first: 0, attempts: 0, ms: 0, last: 0 });
      st.q += 1;
      st.first += attempts === 1 ? 1 : 0;
      st.attempts += attempts;
      st.ms += ms;
      st.last = t.getTime();
      p.days[key].q += 1;
      p.days[key].first += attempts === 1 ? 1 : 0;
      p.skills[topic] = { level: Math.min(5, 1 + Math.floor(st.q / 8)), streak: attempts === 1 ? 1 : 0, struggle: hard ? 1 : 0, support: hard };
    }
  }
  p.totalMs = Object.values(p.days).reduce((sum, day) => sum + day.ms, 0);
  p.lastPlayed = Date.now() - 2 * 3600000;
  p.goals = [
    { id: `${p.id}-g1`, topic: focus[0] ?? 'any', target: 20, week: currentWeek(), title: `Tuần này hoàn thành 20 bài ${focus[0] ? 'về ' + TOPICS[focus[0]].name.toLowerCase() : 'toán'}`, created: Date.now() - 2 * 86400000 },
    { id: `${p.id}-g2`, topic: 'any', target: 45, week: currentWeek(), title: 'Duy trì thói quen học đều trong tuần', created: Date.now() - 86400000 },
  ];
  return p;
}

function currentWeek(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

writeProfile(seedProfile('Minh Anh', 2, 23, ['mul', 'div']));
writeProfile(seedProfile('Gia Bảo', 4, 35, ['fraction', 'word', 'decimal']));
initUI();
openDashboard();
