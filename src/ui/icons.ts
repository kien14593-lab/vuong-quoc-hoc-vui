import { h } from './dom';

/**
 * Đồng xu vẽ bằng SVG (lớp CSS `.ic-coin`, cỡ 1em theo chữ xung quanh).
 * Không dùng emoji đồng xu (U+1FA99): đó là Emoji 13 – máy Windows 10 ở trường chỉ hiện ô vuông trống.
 * Mỗi lần gọi tạo một phần tử mới (một nút DOM chỉ gắn được vào một chỗ).
 */
export function coinIcon(): HTMLElement {
  return h('span.ic-coin', { role: 'img', 'aria-label': 'xu' });
}
