import '../../styles/dashboard.css';
import { button, clear, h, type Child } from '../dom';
import { alertBox, confirmBox, openModal, type ModalHandle } from '../modal';
import { toast } from '../toast';
import { GRADE_NAMES, GRADE_TOPICS, TOPICS, maxLevelFor, startLevel } from '../../math/curriculum';
import type { Grade, Topic } from '../../math/types';
import { badgeDef, levelDef, levelProgress } from '../../core/progression';
import {
  deleteProfile,
  exportProfile,
  hasProfile,
  importProfile,
  listProfiles,
  profile,
  readProfile,
  resetProfileProgress,
  save,
  setGrade,
  type AnswerLog,
  type Goal,
  type Profile,
  writeProfile,
  dayKey,
  weekKey,
} from '../../core/state';
import { goalProgress } from '../../core/goals';

const TABS = [
  ['overview', 'Tổng quan'],
  ['topics', 'Chủ đề'],
  ['progress', 'Tiến độ'],
  ['goals', 'Mục tiêu'],
  ['activity', 'Hoạt động'],
  ['manage', 'Quản lý'],
] as const;

type TabId = (typeof TABS)[number][0];

declare global {
  interface Window {
    __VQTH_DASHBOARD_SKIP_GATE__?: boolean;
  }
}

let activeTab: TabId = 'overview';
let activeProfile: Profile | null = null;
let modal: ModalHandle | null = null;
let contentEl: HTMLElement | null = null;
let headerEl: HTMLElement | null = null;
let railEl: HTMLElement | null = null;

export function openDashboard(): void {
  if (window.__VQTH_DASHBOARD_SKIP_GATE__) {
    showDashboard();
    return;
  }
  showGate();
}

function showGate(): void {
  let a = rand(6, 14);
  let b = rand(6, 12);
  const question = h('strong.dash-gate-question', `${a} × ${b} = ?`);
  const input = h<HTMLInputElement>('input.dash-input', { type: 'number', inputMode: 'numeric', autocomplete: 'off', placeholder: 'Nhập đáp án' });
  const hint = h('p.dash-gate-hint', 'Đây là góc dành cho người lớn. Nếu nhập sai, câu hỏi sẽ đổi mới.');
  const setNew = () => {
    a = rand(6, 14);
    b = rand(6, 12);
    question.textContent = `${a} × ${b} = ?`;
    input.value = '';
    input.focus();
  };
  const check = () => {
    if (Number(input.value) === a * b) {
      gate.close();
      showDashboard();
    } else {
      hint.textContent = 'Chưa đúng. Mời nhập câu mới để tiếp tục.';
      setNew();
    }
  };
  const gate = openModal({
    title: 'Xác nhận người lớn',
    icon: '🔐',
    width: 680,
    className: 'dashboard-gate modal-small',
    body: h('div.dash-gate', h('p', 'Vui lòng trả lời phép tính sau:'), question, input, hint),
    footer: [button('Đóng', () => gate.close(), 'btn-soft'), button('Vào góc phụ huynh', check, 'btn-primary')],
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') check();
  });
  setTimeout(() => input.focus(), 50);
}

function showDashboard(): void {
  const profiles = listProfiles();
  if (!profiles.length) {
    void alertBox('Góc phụ huynh', 'Chưa có hồ sơ học tập nào để xem.', '👪');
    return;
  }
  const currentId = hasProfile() ? profile().id : profiles[0].id;
  activeProfile = readProfile(currentId) ?? readProfile(profiles[0].id);
  activeTab = 'overview';
  headerEl = h('div.dash-header');
  railEl = h('nav.dash-rail');
  contentEl = h('section.dash-content');
  modal = openModal({
    title: 'Góc phụ huynh',
    icon: '👪',
    width: 1500,
    height: 900,
    className: 'dashboard-modal',
    body: h('div.dashboard', h('aside.dash-sidebar', headerEl, railEl), contentEl),
  });
  renderAll();
}

function renderAll(): void {
  if (!activeProfile || !headerEl || !railEl || !contentEl) return;
  renderHeader();
  renderRail();
  renderContent();
}

function renderHeader(): void {
  if (!activeProfile || !headerEl) return;
  clear(headerEl);
  const profiles = listProfiles();
  const picker = h('div.dash-profile-picker');
  if (profiles.length > 1) {
    const select = h<HTMLSelectElement>('select.dash-select', {}, ...profiles.map((p) => h('option', { value: p.id, selected: p.id === activeProfile!.id }, `${p.name} · ${GRADE_NAMES[p.grade]}`)));
    select.addEventListener('change', () => {
      activeProfile = readProfile(select.value) ?? activeProfile;
      renderAll();
    });
    picker.append(select);
  }
  headerEl.append(
    h('div.dash-kicker', 'Hồ sơ đang xem'),
    h('div.dash-child-name', activeProfile.name),
    h('div.dash-child-meta', `${GRADE_NAMES[activeProfile.grade]} · ${levelDef(levelProgress(activeProfile.xp).level).title}`),
    picker,
  );
}

function renderRail(): void {
  if (!railEl) return;
  clear(railEl);
  for (const [id, label] of TABS) {
    railEl.append(
      button(label, () => {
        activeTab = id;
        renderRail();
        renderContent();
      }, `dash-tab ${activeTab === id ? 'active' : ''}`),
    );
  }
}

function renderContent(): void {
  if (!activeProfile || !contentEl) return;
  clear(contentEl);
  const p = activeProfile;
  if (activeTab === 'overview') contentEl.append(renderOverview(p));
  else if (activeTab === 'topics') contentEl.append(renderTopics(p));
  else if (activeTab === 'progress') contentEl.append(renderProgress(p));
  else if (activeTab === 'goals') contentEl.append(renderGoals(p));
  else if (activeTab === 'activity') contentEl.append(renderActivity(p));
  else contentEl.append(renderManage(p));
}

function renderOverview(p: Profile): HTMLElement {
  const totals = totalQuestions(p);
  const level = levelProgress(p.xp);
  const badgeEls = p.badges.slice(0, 12).map((id) => {
    const b = badgeDef(id);
    return h('span.dash-badge', { title: b?.name ?? id, style: { background: b?.color ?? '#e7f1ee' } }, b?.icon ?? '✓');
  });
  return h(
    'div.dash-section',
    titleBlock('Tổng quan học tập', 'Tóm tắt nhẹ nhàng để phụ huynh nắm tình hình mà không làm gián đoạn giờ chơi.'),
    h(
      'div.dash-metric-grid',
      metric('Thời gian chơi', formatDuration(p.totalMs)),
      metric('Câu đã làm', fmt(totals.q)),
      metric('Đúng lần đầu', `${percent(totals.first, totals.q)}%`),
      metric('Ngày đã chơi', fmt(Object.keys(p.days).length)),
      metric('Chuỗi hiện tại', `${currentStreak(p)} ngày`),
      metric('Xu / sao', `${fmt(p.coins)} / ${fmt(p.stars)}`),
    ),
    h(
      'div.dash-two',
      card('Cấp độ hiện tại', h('div.dash-level', h('strong', `Cấp ${level.level}`), h('span', levelDef(level.level).title), progress(level.pct), h('small', level.max ? 'Đã đạt cấp cao nhất' : `${level.cur}/${level.need} XP tới cấp sau`))),
      card('Huy hiệu đã nhận', h('div.dash-badges', badgeEls.length ? badgeEls : h('p.dash-muted', 'Chưa có huy hiệu. Hãy khích lệ bé tiếp tục luyện tập.'))),
    ),
    h('div.dash-two', card('14 ngày gần đây', dayBars(p)), card('8 tuần gần đây', weekChart(p))),
  );
}

function renderTopics(p: Profile): HTMLElement {
  const gradeTopics = GRADE_TOPICS[p.grade];
  const rows = gradeTopics.map((topic) => topicSummary(p, topic));
  const weak = rows.filter((r) => r.q >= 3 && (r.acc < 70 || r.avgAttempts >= 2)).sort((a, b) => a.acc - b.acc || b.q - a.q);
  const learned = rows.filter((r) => r.q > 0).sort((a, b) => b.q - a.q);
  const untouched = rows.filter((r) => r.q === 0);
  return h(
    'div.dash-section',
    titleBlock('Chủ đề đã học', 'Theo dõi từng mảng kiến thức phù hợp với lớp hiện tại.'),
    h('div.dash-two', topicList('Chủ đề còn yếu', weak, true), topicList('Chủ đề đã luyện tập', learned, false)),
    card('Chưa luyện tập', untouched.length ? h('div.dash-chip-list', untouched.map((r) => h('span.dash-chip.empty', TOPICS[r.topic].name))) : h('p.dash-muted', 'Bé đã thử tất cả chủ đề của lớp này.')),
  );
}

function renderProgress(p: Profile): HTMLElement {
  return h(
    'div.dash-section',
    titleBlock('Tiến độ theo tuần', 'Biểu đồ câu hỏi, độ chính xác và thời lượng học trong các ngày gần đây.'),
    h('div.dash-two', card('Câu hỏi và độ chính xác - 8 tuần', weekChart(p)), card('Số phút mỗi ngày - 14 ngày', dayBars(p))),
    card('Tiến độ theo kỹ năng và lớp học', skillBars(p)),
  );
}

function renderGoals(p: Profile): HTMLElement {
  const topicSelect = h<HTMLSelectElement>('select.dash-select', {}, h('option', { value: 'any' }, 'Tất cả chủ đề'), ...GRADE_TOPICS[p.grade].map((t) => h('option', { value: t }, TOPICS[t].name)));
  const targetInput = h<HTMLInputElement>('input.dash-input', { type: 'number', min: 1, max: 200, value: '20' });
  const titleInput = h<HTMLInputElement>('input.dash-input', { type: 'text', value: 'Tuần này hoàn thành 20 bài' });
  const create = () => {
    const target = Math.max(1, Math.floor(Number(targetInput.value) || 1));
    const topic = topicSelect.value as Topic | 'any';
    const topicName = topic === 'any' ? 'toán' : TOPICS[topic].name.toLowerCase();
    const goal: Goal = { id: `goal-${Date.now().toString(36)}`, topic, target, week: weekKey(), title: titleInput.value.trim() || `Tuần này hoàn thành ${target} bài ${topicName}`, created: Date.now() };
    p.goals.push(goal);
    persistActive(p);
    renderContent();
    toast('Đã tạo mục tiêu mới.', { icon: '✓', tone: 'good' });
  };
  const list = h('div.dash-goal-list', p.goals.length ? p.goals.slice().reverse().map((goal) => goalItem(p, goal)) : h('p.dash-muted', 'Chưa có mục tiêu. Hãy đặt một mục tiêu nhỏ cho tuần này.'));
  return h('div.dash-section', titleBlock('Mục tiêu', 'Tạo mục tiêu tuần để phụ huynh và giáo viên cùng theo dõi.'), card('Tạo mục tiêu mới', h('div.dash-form-grid', labelWrap('Chủ đề', topicSelect), labelWrap('Số bài', targetInput), labelWrap('Tên mục tiêu', titleInput), h('label.dash-field.dash-field-action', button('Tạo mục tiêu', create, 'btn-green btn-small')))), card('Danh sách mục tiêu', list));
}

function renderActivity(p: Profile): HTMLElement {
  const rows = p.log.slice(-15).reverse();
  return h(
    'div.dash-section',
    titleBlock('Hoạt động gần đây', 'Khoảng 15 câu trả lời mới nhất, dùng để trao đổi nhanh với trẻ.'),
    card('Lịch sử trả lời', h('table.dash-table', h('thead', h('tr', h('th', 'Thời gian'), h('th', 'Chủ đề'), h('th', 'Mức'), h('th', 'Lần thử'), h('th', 'Nguồn'))), h('tbody', rows.length ? rows.map(activityRow) : h('tr', h('td', { colSpan: 5 }, 'Chưa có hoạt động.'))))),
  );
}

function renderManage(p: Profile): HTMLElement {
  const gradeSelect = h<HTMLSelectElement>('select.dash-select', {}, ...([1, 2, 3, 4, 5] as Grade[]).map((g) => h('option', { value: String(g), selected: g === p.grade }, GRADE_NAMES[g])));
  const fileInput = h<HTMLInputElement>('input.dash-file-hidden', { type: 'file', accept: 'application/json,.json' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const imported = importProfile(await file.text());
      activeProfile = imported;
      toast('Đã nhập hồ sơ thành công.', { icon: '✓', tone: 'good' });
      renderAll();
    } catch (err) {
      void alertBox('Không nhập được hồ sơ', err instanceof Error ? err.message : 'Tệp không hợp lệ.', '⚠️');
    }
  });
  const changeGrade = async () => {
    const next = Number(gradeSelect.value) as Grade;
    if (next === p.grade) return;
    if (!(await confirmBox(`Đổi sang ${GRADE_NAMES[next]}? Các mức thích ứng theo kỹ năng sẽ được đặt lại để phù hợp với lớp mới.`, { title: 'Đổi lớp học', icon: '🎓', yes: 'Đổi lớp' }))) return;
    p.grade = next;
    p.skills = {};
    if (hasProfile() && profile().id === p.id) setGrade(next);
    else writeProfile(p);
    activeProfile = readProfile(p.id) ?? p;
    renderAll();
  };
  return h(
    'div.dash-section',
    titleBlock('Quản lý hồ sơ', 'Xuất, nhập hoặc điều chỉnh hồ sơ khi có sự đồng ý của người lớn.'),
    h('div.dash-two',
      card('Sao lưu dữ liệu', h('p.dash-muted', 'Tải hồ sơ ra tệp JSON để lưu trữ hoặc gửi cho giáo viên.'), button('Xuất hồ sơ JSON', () => downloadProfile(p), 'btn-blue btn-small'), h('div.dash-import', button('Nhập hồ sơ JSON', () => fileInput.click(), 'btn-soft btn-small'), fileInput)),
      card('Lớp học', h('p.dash-muted', 'Đổi lớp sẽ đặt lại mức thích ứng, nhưng không xóa lịch sử câu hỏi.'), h('div.dash-inline', gradeSelect, button('Cập nhật lớp', changeGrade, 'btn-green btn-small'))),
    ),
    card('Vùng nguy hiểm', h('div.dash-danger-row', button('Đặt lại tiến độ', () => resetProgress(p), 'btn-yellow btn-small'), button('Xóa hồ sơ', () => removeProfile(p), 'btn-primary btn-small'))),
  );
}

function titleBlock(title: string, sub: string): HTMLElement {
  return h('header.dash-title-block', h('h2', title), h('p', sub));
}

function card(title: string, ...body: Child[]): HTMLElement {
  return h('article.dash-card', h('h3', title), body);
}

function metric(label: string, value: string): HTMLElement {
  return h('div.dash-metric', h('span', label), h('strong', value));
}

function progress(pct: number): HTMLElement {
  return h('div.dash-progress', h('span', { style: { width: `${Math.max(0, Math.min(1, pct)) * 100}%` } }));
}

function topicSummary(p: Profile, topic: Topic) {
  const st = p.stats[topic];
  const q = st?.q ?? 0;
  const first = st?.first ?? 0;
  const attempts = st?.attempts ?? 0;
  const ms = st?.ms ?? 0;
  return { topic, q, acc: q ? Math.round((first / q) * 100) : 0, avgAttempts: q ? attempts / q : 0, avgMs: q ? ms / q : 0, level: p.skills[topic]?.level ?? startLevel(topic, p.grade) };
}

function topicList(title: string, rows: ReturnType<typeof topicSummary>[], weak: boolean): HTMLElement {
  return card(title, rows.length ? h('div.dash-topic-list', rows.map((r) => h('div.dash-topic-row', h('div', h('strong', TOPICS[r.topic].name), h('small', `${r.q} câu · đúng lần đầu ${r.acc}%`)), h('div', h('span', `${r.avgAttempts.toFixed(1)} lần`), h('small', `${formatSeconds(r.avgMs)} · mức ${r.level}`)), weak ? h('b.dash-warn', 'Cần ôn') : null))) : h('p.dash-muted', weak ? 'Chưa có chủ đề nào cần lưu ý rõ rệt.' : 'Chưa có dữ liệu luyện tập.'));
}

function skillBars(p: Profile): HTMLElement {
  return h('div.dash-skill-list', GRADE_TOPICS[p.grade].map((topic) => {
    const max = maxLevelFor(topic, p.grade);
    const min = startLevel(topic, p.grade);
    const lv = p.skills[topic]?.level ?? min;
    return h('div.dash-skill-row', h('div', h('strong', TOPICS[topic].name), h('small', `Mức ${lv}/${max}`)), progress(max <= 1 ? 1 : lv / max));
  }));
}

function goalItem(p: Profile, goal: Goal): HTMLElement {
  const gp = goalProgress(p, goal);
  const del = () => {
    p.goals = p.goals.filter((g) => g.id !== goal.id);
    persistActive(p);
    renderContent();
  };
  return h('div.dash-goal-item', h('div.dash-goal-top', h('strong', goal.title), h('span', gp.completed ? 'Hoàn thành' : `${gp.done}/${gp.target}`)), progress(gp.pct), h('div.dash-goal-meta', h('span', `${goal.topic === 'any' ? 'Tất cả chủ đề' : TOPICS[goal.topic].name} · tuần ${goal.week}`), button('Xóa', del, 'btn-soft btn-small')));
}

function weekChart(p: Profile): SVGSVGElement {
  const weeks = lastWeeks(8);
  const data = weeks.map((week) => {
    const entries = p.log.filter((e) => weekKey(e.t) === week);
    return { week, q: entries.length, acc: percent(entries.filter((e) => e.a <= 1).length, entries.length) };
  });
  const maxQ = Math.max(5, ...data.map((d) => d.q));
  const w = 620, hgt = 250, left = 48, bottom = 42, top = 18;
  const plotH = hgt - top - bottom;
  const bw = 42;
  const gap = (w - left - 20) / data.length;
  const pts = data.map((d, i) => `${left + i * gap + bw / 2},${top + plotH - (d.acc / 100) * plotH}`).join(' ');
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'dash-chart' });
  svg.append(svgEl('line', { x1: left, y1: top + plotH, x2: w - 10, y2: top + plotH, class: 'axis' }));
  data.forEach((d, i) => {
    const x = left + i * gap;
    const bh = (d.q / maxQ) * plotH;
    svg.append(svgEl('rect', { x, y: top + plotH - bh, width: bw, height: Math.max(2, bh), rx: 10, class: 'bar' }));
    svg.append(svgEl('text', { x: x + bw / 2, y: hgt - 14, class: 'label' }, shortDate(d.week)));
  });
  svg.append(svgEl('polyline', { points: pts, class: 'line' }));
  data.forEach((d, i) => svg.append(svgEl('circle', { cx: left + i * gap + bw / 2, cy: top + plotH - (d.acc / 100) * plotH, r: 5, class: 'dot' })));
  svg.append(svgEl('text', { x: 8, y: 24, class: 'legend' }, 'Cột: số câu · Đường: % đúng lần đầu'));
  return svg;
}

function dayBars(p: Profile): SVGSVGElement {
  const days = lastDays(14);
  const data = days.map((d) => ({ day: d, min: Math.round((p.days[d]?.ms ?? 0) / 60000) }));
  const max = Math.max(5, ...data.map((d) => d.min));
  const w = 620, hgt = 250, left = 34, bottom = 42, top = 18;
  const plotH = hgt - top - bottom;
  const gap = (w - left - 18) / data.length;
  const bw = 24;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'dash-chart dash-chart-days' });
  svg.append(svgEl('line', { x1: left, y1: top + plotH, x2: w - 10, y2: top + plotH, class: 'axis' }));
  data.forEach((d, i) => {
    const x = left + i * gap;
    const bh = (d.min / max) * plotH;
    svg.append(svgEl('rect', { x, y: top + plotH - bh, width: bw, height: Math.max(2, bh), rx: 8, class: 'bar alt' }));
    svg.append(svgEl('text', { x: x + bw / 2, y: hgt - 14, class: 'label' }, d.day.slice(8)));
  });
  svg.append(svgEl('text', { x: 8, y: 24, class: 'legend' }, 'Số phút học/chơi mỗi ngày'));
  return svg;
}

function activityRow(e: AnswerLog): HTMLElement {
  return h('tr', h('td', formatDateTime(e.t)), h('td', TOPICS[e.topic].name), h('td', String(e.lv)), h('td', `${e.a} lần`), h('td', sourceName(e.src)));
}

function labelWrap(label: string, el: HTMLElement): HTMLElement {
  return h('label.dash-field', h('span', label), el);
}

function downloadProfile(p: Profile): void {
  const blob = new Blob([exportProfile(p.id)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vuong-quoc-hoc-vui-${slug(p.name)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function resetProgress(p: Profile): Promise<void> {
  if (!(await confirmBox(`Đặt lại toàn bộ tiến độ của ${p.name}? Hành động này giữ tên và lớp nhưng xóa XP, tiền, thống kê, mục tiêu và lịch sử.`, { title: 'Đặt lại tiến độ', icon: '⚠️', yes: 'Đặt lại' }))) return;
  resetProfileProgress(p.id);
  activeProfile = readProfile(p.id);
  renderAll();
}

async function removeProfile(p: Profile): Promise<void> {
  if (!(await confirmBox(`Xóa vĩnh viễn hồ sơ của ${p.name}? Hãy xuất JSON trước nếu cần sao lưu.`, { title: 'Xóa hồ sơ', icon: '⚠️', yes: 'Xóa hồ sơ' }))) return;
  deleteProfile(p.id);
  const next = listProfiles()[0];
  if (!next) {
    modal?.close();
    return;
  }
  activeProfile = readProfile(next.id);
  renderAll();
}

function persistActive(p: Profile): void {
  if (hasProfile() && profile().id === p.id) save();
  else writeProfile(p);
}

function totalQuestions(p: Profile): { q: number; first: number } {
  return Object.values(p.stats).reduce((acc, st) => ({ q: acc.q + (st?.q ?? 0), first: acc.first + (st?.first ?? 0) }), { q: 0, first: 0 });
}

function currentStreak(p: Profile): number {
  let streak = 0;
  let t = new Date(`${dayKey()}T00:00:00`).getTime();
  while (p.days[dayKey(t)]?.q || p.days[dayKey(t)]?.ms) {
    streak += 1;
    t -= 86400000;
  }
  return streak;
}

function lastDays(n: number): string[] {
  const out: string[] = [];
  const base = new Date(`${dayKey()}T00:00:00`).getTime();
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(base - i * 86400000));
  return out;
}

function lastWeeks(n: number): string[] {
  const out: string[] = [];
  const base = new Date(`${weekKey()}T00:00:00`).getTime();
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(base - i * 7 * 86400000));
  return out;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text) el.textContent = text;
  return el;
}

function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}g ${m}p` : `${m}p`;
}

function formatSeconds(ms: number): string {
  return `${Math.max(1, Math.round(ms / 1000))} giây`;
}

function percent(a: number, b: number): number {
  return b ? Math.round((a / b) * 100) : 0;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

function formatDateTime(t: number): string {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(t));
}

function shortDate(key: string): string {
  return `${key.slice(8)}/${key.slice(5, 7)}`;
}

function sourceName(src: string): string {
  const map: Record<string, string> = { maze: 'Mê cung', village: 'Làng', minigame: 'Trò chơi nhỏ', practice: 'Luyện tập', castle: 'Lâu đài' };
  return map[src] ?? src;
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ho-so';
}

function rand(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}


