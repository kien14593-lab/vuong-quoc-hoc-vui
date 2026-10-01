import { sfx } from '../../core/audio';
import { hasVietnameseVoice, speak, voiceName } from '../../core/speech';
import { getSettings, updateSettings } from '../../core/state';
import { backToTitle } from '../../game/app';
import { glbReport } from '../../models/glb';
import { button, h } from '../dom';
import { confirmBox, openModal } from '../modal';
import { openDashboard } from './dashboard';

function slider(label: string, icon: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void, fmt: (v: number) => string): HTMLElement {
  const out = h('span.set-val', fmt(value));
  const input = h<HTMLInputElement>('input.set-range', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = fmt(v);
    onInput(v);
  });
  input.addEventListener('change', () => sfx('pop'));
  return h('div.set-row', h('span.set-label', `${icon} ${label}`), input, out);
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    /* trình duyệt không cho phép */
  }
}

/** Cửa sổ cài đặt âm thanh, giọng đọc, toàn màn hình. */
export function openSettings(o: { inGame: boolean }): void {
  const s = getSettings();
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const voiceOk = hasVietnameseVoice();
  const aiCredits = [...new Set(glbReport().filter((r) => r.source === 'ai' && r.credit).map((r) => r.credit!))];
  const voiceToggle = button(s.voice ? '🔊 Đang bật' : '🔇 Đang tắt', () => {
    const on = !getSettings().voice;
    updateSettings({ voice: on });
    voiceToggle.textContent = on ? '🔊 Đang bật' : '🔇 Đang tắt';
    voiceToggle.classList.toggle('btn-green', on);
    if (on) speak('Xin chào! Mình sẽ đọc câu hỏi cho bạn nghe nhé.', { force: true });
  }, s.voice ? 'btn-green btn-small' : 'btn-small');
  const body = h(
    'div.settings',
    slider('Nhạc nền', '🎵', s.music, 0, 1, 0.05, (v) => updateSettings({ music: v }), pct),
    slider('Âm thanh', '🔔', s.sfx, 0, 1, 0.05, (v) => updateSettings({ sfx: v }), pct),
    h('div.set-row', h('span.set-label', '🗣️ Đọc câu hỏi'), voiceToggle, button('Nghe thử', () => speak('Bạn An có 3 quả táo, mẹ cho thêm 2 quả. Hỏi An có tất cả bao nhiêu quả táo?', { force: true }), 'btn-small btn-soft')),
    slider('Tốc độ đọc', '⏩', s.voiceRate, 0.6, 1.4, 0.1, (v) => updateSettings({ voiceRate: v }), (v) => `${v.toFixed(1)}×`),
    h(
      'div.set-note',
      voiceOk
        ? `Giọng đọc: ${voiceName() ?? 'tiếng Việt'}`
        : 'Máy tính chưa có giọng đọc tiếng Việt. Để bật: Cài đặt Windows → Thời gian & ngôn ngữ → Giọng nói → Thêm giọng nói → Tiếng Việt. (Microsoft Edge có sẵn giọng đọc trực tuyến khi có mạng.)',
    ),
    h('div.set-row', h('span.set-label', '🖥️ Toàn màn hình'), button(isFullscreen() ? 'Thu nhỏ' : 'Phóng to', () => void toggleFullscreen(), 'btn-small btn-blue')),
    h(
      'div.set-help',
      h('div.set-help-title', '🎮 Cách điều khiển'),
      h(
        'ul',
        h('li', h('b', 'Di chuyển: '), 'phím mũi tên hoặc W A S D — hoặc bấm/chạm vào nơi muốn đến.'),
        h('li', h('b', 'Nói chuyện, mở, nhặt: '), 'phím E hoặc Enter — hoặc bấm vào nhân vật/đồ vật.'),
        h('li', h('b', 'Nhảy: '), 'phím Cách (Space). ', h('b', 'Chạy nhanh: '), 'giữ Shift.'),
        h('li', h('b', 'Trả lời: '), 'bấm vào đáp án hoặc phím số 1, 2, 3, 4.'),
        h('li', h('b', 'Bản đồ: '), 'phím M. ', h('b', 'Túi đồ: '), 'phím B.'),
      ),
    ),
    aiCredits.length ? h('div.set-note', `🧸 Mô hình nhân vật 3D: ${aiCredits.join(' · ')}`) : null,
  );
  const footer = o.inGame
    ? [
        button('👪 Góc phụ huynh', () => openDashboard(), 'btn-soft'),
        button(
          '🏠 Về màn hình chính',
          async () => {
            if (await confirmBox('Về màn hình chính? Tiến trình đã được lưu tự động.', { title: 'Tạm dừng', icon: '🏠', yes: 'Về màn hình chính', no: 'Chơi tiếp' })) {
              backToTitle();
            }
          },
          'btn-purple',
        ),
      ]
    : undefined;
  openModal({ title: 'Cài đặt', icon: '⚙️', width: 1180, body, footer });
}
