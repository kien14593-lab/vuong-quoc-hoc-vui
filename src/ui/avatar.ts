import type { Kid } from '../core/outfits';
import type { Equipped } from '../core/state';
import { h } from './dom';
import { setPlayerPortrait, type Framing } from './portrait';

export interface AvatarOpts {
  /** Góc xoay (độ): 0 = nhìn thẳng, 90 = nghiêng, 180 = sau lưng. */
  yaw?: number;
  framing?: Framing;
  size?: number;
}

function portraitOpts(o: AvatarOpts): { yaw: number; framing: Framing; size: number } {
  return { yaw: o.yaw ?? 12, framing: o.framing ?? 'full', size: o.size ?? 320 };
}

/** Đặt ảnh bé (vẽ từ mô hình 3D) vào thẻ ảnh có sẵn: chờ mô hình AI thì hiện bóng bé tạm, tải xong tự thay. */
export function setAvatar(img: HTMLImageElement, kid: Kid, eq: Partial<Equipped>, o: AvatarOpts = {}): void {
  setPlayerPortrait(img, kid, eq, portraitOpts(o));
}

/** Thẻ ảnh bé (trai/gái) mặc bộ đồ + mũ, balo, phụ kiện. */
export function avatarImg(kid: Kid, eq: Partial<Equipped>, cls = 'avatar', o: AvatarOpts = {}): HTMLImageElement {
  const img = h<HTMLImageElement>(`img.${cls}`, { alt: '', draggable: false });
  setAvatar(img, kid, eq, o);
  return img;
}
