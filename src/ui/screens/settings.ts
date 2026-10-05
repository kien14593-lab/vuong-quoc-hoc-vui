import { sfx } from '../../core/audio';
import { isTouchDevice, mobileOs } from '../../core/device';
import { chosenVoiceKey, hasVietnameseVoice, onVoicesChanged, speak, speakParts, viVoiceLabel, viVoiceOptions } from '../../core/speech';
import { getSettings, updateSettings, type Settings } from '../../core/state';
import { engine } from '../../engine/core';
import { backToTitle } from '../../game/app';
import { glbReport } from '../../models/glb';
import { button, clear, h } from '../dom';
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

const VOICE_SAMPLE = 'Xin chào! Mình sẽ đọc câu hỏi cho bạn nghe nhé.';

const QUALITY_OPTS: [Settings['quality'], string][] = [
  ['auto', 'Tự động'],
  ['high', 'Đẹp'],
  ['low', 'Nhẹ (mượt hơn)'],
];

/** Đồ họa: Tự động / Đẹp / Nhẹ – đổi ngay, không cần tải lại trang. */
function qualityRow(): HTMLElement {
  const btns = QUALITY_OPTS.map(([q, label]) => {
    const b = button(
      label,
      () => {
        updateSettings({ quality: q });
        engine.setQuality(q);
        paint();
      },
      'btn-small',
    );
    return [q, b] as const;
  });
  const paint = () => {
    const cur = getSettings().quality;
    for (const [q, b] of btns) {
      b.classList.toggle('btn-green', q === cur);
      b.classList.toggle('btn-soft', q !== cur);
      b.setAttribute('aria-pressed', String(q === cur));
    }
  };
  paint();
  return h('div.set-row', h('span.set-label', '🎮 Đồ họa'), btns.map(([, b]) => b));
}

/** Nghe thử: Thỏ Bông (giọng nữ) rồi Chú Gấu (giọng nam). */
function previewCharVoices(): void {
  speakParts(
    [
      { text: 'Chào bạn! Mình là Thỏ Bông.', lang: 'vi', who: 'tho' },
      { text: 'Còn mình là Chú Gấu!', lang: 'vi', who: 'gau' },
    ],
    { force: true, chars: true },
  );
}

function voiceNote(selectShown: boolean): string {
  if (!hasVietnameseVoice()) {
    return mobileOs()
      ? 'Máy chưa có giọng đọc tiếng Việt. Xem mục "Giọng đọc chưa hay?" bên dưới để tải giọng về máy.'
      : 'Máy tính chưa có giọng đọc tiếng Việt. Để bật: Cài đặt Windows → Thời gian & ngôn ngữ → Giọng nói → Thêm giọng nói → Tiếng Việt. (Microsoft Edge có sẵn giọng đọc trực tuyến khi có mạng.)';
  }
  const nam = viVoiceLabel('nam');
  const head = selectShown ? '' : `Giọng đọc: ${viVoiceLabel('nu') ?? 'tiếng Việt'}. `;
  return head + (nam ? `Giọng nhân vật nam: ${nam}.` : 'Máy chưa có giọng nam tiếng Việt nên nhân vật nam dùng giọng đọc này, đọc trầm hơn.');
}

/** Chọn giọng đọc (chỉ hiện khi máy có từ 2 giọng tiếng Việt) và ghi chú giọng đang dùng. Vẽ lại khi danh sách giọng thay đổi. */
function renderVoicePanel(box: HTMLElement): void {
  clear(box);
  const opts = viVoiceOptions();
  const showSelect = opts.length > 1;
  if (showSelect) {
    const sel = h<HTMLSelectElement>(
      'select.set-select',
      { 'aria-label': 'Chọn giọng đọc' },
      h('option', { value: '' }, 'Tự động (khuyên dùng)'),
      opts.map((o) => h('option', { value: o.key }, o.label)),
    );
    sel.value = chosenVoiceKey();
    sel.addEventListener('change', () => {
      const o = opts.find((x) => x.key === sel.value);
      updateSettings({ voiceVi: o ? { uri: o.key, name: o.name } : null });
      speak(VOICE_SAMPLE, { force: true });
    });
    box.appendChild(h('div.set-row', h('span.set-label', '🎙️ Chọn giọng đọc'), sel));
    const used = viVoiceLabel('nu');
    if (used) box.appendChild(h('div.set-sub', `Đang dùng: ${used}`));
  }
  box.appendChild(h('div.set-note', voiceNote(showSelect)));
}

/** Hướng dẫn tải giọng đọc tốt hơn trên điện thoại / máy tính bảng. */
function phoneVoiceTip(): HTMLElement | null {
  const os = mobileOs();
  if (!os) return null;
  const steps =
    os === 'ios'
      ? [
          'Mở Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt.',
          'Chọn Linh → tải giọng "Linh (Nâng cao)" về máy (nên dùng Wi-Fi).',
          'Mở lại trò chơi → ⚙️ Cài đặt → 🎙️ Chọn giọng đọc → "Linh (Nâng cao)".',
        ]
      : [
          'Mở Cài đặt → tìm "Chuyển văn bản thành giọng nói" (thường ở mục Quản lý chung hoặc Hệ thống → Ngôn ngữ).',
          'Chọn công cụ của Google → ⚙️ → Cài đặt dữ liệu giọng nói → Tiếng Việt → tải giọng về máy.',
          'Mở lại trò chơi → ⚙️ Cài đặt → 🎙️ Chọn giọng đọc.',
        ];
  return h(
    'details.set-tip',
    { open: !hasVietnameseVoice() },
    h('summary', '💡 Giọng đọc chưa hay?'),
    h('ol', steps.map((s) => h('li', s))),
    h('div.set-sub', 'Tên các mục có thể hơi khác tùy máy.'),
  );
}

/** Cửa sổ cài đặt âm thanh, giọng đọc, toàn màn hình. */
export function openSettings(o: { inGame: boolean }): void {
  const s = getSettings();
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const aiCredits = [...new Set(glbReport().filter((r) => r.source === 'ai' && r.credit).map((r) => r.credit!))];
  const voiceToggle = button(s.voice ? '🔊 Đang bật' : '🔇 Đang tắt', () => {
    const on = !getSettings().voice;
    updateSettings({ voice: on });
    voiceToggle.textContent = on ? '🔊 Đang bật' : '🔇 Đang tắt';
    voiceToggle.classList.toggle('btn-green', on);
    if (on) speak(VOICE_SAMPLE, { force: true });
  }, s.voice ? 'btn-green btn-small' : 'btn-small');
  const charToggle = button(s.charVoices ? '🎭 Đang bật' : 'Đang tắt', () => {
    const on = !getSettings().charVoices;
    updateSettings({ charVoices: on });
    charToggle.textContent = on ? '🎭 Đang bật' : 'Đang tắt';
    charToggle.classList.toggle('btn-green', on);
  }, s.charVoices ? 'btn-green btn-small' : 'btn-small');
  const voices = h('div.set-voices');
  renderVoicePanel(voices);
  const offVoices = onVoicesChanged(() => renderVoicePanel(voices));
  const body = h(
    'div.settings',
    slider('Nhạc nền', '🎵', s.music, 0, 1, 0.05, (v) => updateSettings({ music: v }), pct),
    slider('Âm thanh', '🔔', s.sfx, 0, 1, 0.05, (v) => updateSettings({ sfx: v }), pct),
    h('div.set-row', h('span.set-label', '🗣️ Đọc câu hỏi'), voiceToggle, button('Nghe thử', () => speak('Bạn An có 3 quả táo, mẹ cho thêm 2 quả. Hỏi An có tất cả bao nhiêu quả táo?', { force: true }), 'btn-small btn-soft')),
    slider('Tốc độ đọc', '⏩', s.voiceRate, 0.6, 1.4, 0.1, (v) => updateSettings({ voiceRate: v }), (v) => `${v.toFixed(1)}×`),
    h('div.set-row', h('span.set-label', '🎭 Giọng nhân vật'), charToggle, button('Nghe thử giọng nhân vật', () => previewCharVoices(), 'btn-small btn-soft')),
    voices,
    phoneVoiceTip(),
    h('div.set-row', h('span.set-label', '🖥️ Toàn màn hình'), button(isFullscreen() ? 'Thu nhỏ' : 'Phóng to', () => void toggleFullscreen(), 'btn-small btn-blue')),
    qualityRow(),
    h('div.set-sub', 'Tự động: máy tự chỉnh độ nét cho mượt. Hình vẫn bị giật thì chọn “Nhẹ”.'),
    h(
      'div.set-help',
      h('div.set-help-title', '🎮 Cách điều khiển'),
      isTouchDevice()
        ? h(
            'ul',
            h('li', h('b', 'Di chuyển: '), 'kéo nút tròn ở góc dưới bên trái — hoặc chạm vào nơi muốn đến.'),
            h('li', h('b', 'Nói chuyện, mở, nhặt: '), 'chạm vào nhân vật/đồ vật hoặc nút to ở giữa phía dưới.'),
            h('li', h('b', 'Nhảy: '), 'nút ⤴ ở góc dưới bên phải.'),
            h('li', h('b', 'Xoay nhìn: '), 'kéo một ngón trên màn hình. ', h('b', 'Phóng to / thu nhỏ: '), 'chụm hoặc mở hai ngón.'),
            h('li', h('b', 'Trả lời: '), 'chạm vào đáp án.'),
          )
        : h(
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
  openModal({ title: 'Cài đặt', icon: '⚙️', width: 1180, body, footer, onClose: offVoices });
}
