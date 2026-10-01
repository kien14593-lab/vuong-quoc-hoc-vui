import type { Equipped, Look } from '../core/state';
import { h } from './dom';
import { playerPortrait, type Framing } from './portrait';

export interface AvatarOpts {
  /** Góc xoay (độ): 0 = nhìn thẳng, 90 = nghiêng, 180 = sau lưng. */
  yaw?: number;
  framing?: Framing;
  size?: number;
}

/** Ảnh nhân vật người chơi (data URL, vẽ từ mô hình 3D) theo ngoại hình + trang phục. */
export function avatarUrl(look: Look, eq: Equipped, o: AvatarOpts = {}): string {
  return playerPortrait(look, eq, { yaw: o.yaw ?? 12, framing: o.framing ?? 'full', size: o.size ?? 320 });
}

export function avatarImg(look: Look, eq: Equipped, cls = 'avatar', o: AvatarOpts = {}): HTMLImageElement {
  return h<HTMLImageElement>(`img.${cls}`, { src: avatarUrl(look, eq, o), alt: '', draggable: false });
}
