import type * as THREE from 'three';
import { warmUp } from '../engine/core';
import { ensureGlb, glbLoaded, glbReady } from '../models/glb';
import { buildModel } from '../models/registry';
import { wait } from '../ui/dom';

/** Cảnh dùng mô hình tải sau. */
export interface LateHost {
  /** Cảnh đã đóng: thôi hẳn (phần còn lại tải dần ở nền). */
  gone(): boolean;
  /** Tạm chưa tải tệp tiếp theo (đang chơi trò chơi nhỏ, đang rời khu vực). */
  hold?(): boolean;
  /** Cảnh (đèn) và camera để chuẩn bị trước ảnh + shader của mô hình vừa tải (engine/core.ts warmUp). */
  scene?: THREE.Scene;
  camera?: THREE.Camera;
  /** Tệp của `key` đã tải xong: thay mô hình dựng bằng code ngay tại chỗ (gọi lại nhiều lần vẫn an toàn). */
  swap(key: string): void;
}

/**
 * Mô hình AI tải sau (game/needs.ts ZONE_LATE_MODELS, TITLE_LATE_MODELS – thú trong chuồng, dân làng): cảnh không chờ
 * mà tạm dùng mô hình dựng bằng code; đợi phần phải có (`must`: nhân vật chính của cảnh, thú cưng, bé) tải xong, rồi
 * tải lần lượt theo thứ tự `late` và thay từng mô hình ngay khi tệp của nó xong.
 */
export async function loadLate(late: readonly string[], must: readonly string[], host: LateHost): Promise<void> {
  if (glbReady(late)) return;
  while (!glbReady(must)) {
    await wait(300);
    if (host.gone()) return;
  }
  /** Tải tệp của `key` (đợi lúc cảnh tạm dừng); false: thôi hẳn. */
  const fetchKey = async (key: string): Promise<boolean> => {
    while (!glbLoaded(key) && host.hold?.()) {
      await wait(300);
      if (host.gone()) return false;
    }
    if (!glbLoaded(key)) {
      await ensureGlb([key]);
      // Chưa xong mà thôi tải (rời khu vực): dừng hẳn.
      if (host.gone() || !glbReady([key])) return false;
    }
    return true;
  };
  let next = late.length ? fetchKey(late[0]) : null;
  for (let i = 0; i < late.length; i++) {
    const key = late[i];
    if (!(await next)) return;
    // Tải tệp kế ngay, song song lúc chuẩn bị tệp này: khe chờ warmUp không để tệp nạp nền (glb.ts pump) chen vào rồi
    // bị lần ensureGlb kế tiếp hủy, tải lại.
    next = i + 1 < late.length ? fetchKey(late[i + 1]) : null;
    if (!glbLoaded(key)) continue;
    // Đưa ảnh lên GPU và biên dịch shader trước, để lúc thay không khựng. Mẫu dựng thử dùng chung hình khối + vật liệu
    // với mô hình thật (cả thú trong chuồng) nên chuẩn bị một lần là đủ; bỏ đi, không hủy.
    const probe = buildModel(key);
    if (probe.userData.glb) await warmUp(probe, { scene: host.scene, camera: host.camera });
    if (host.gone()) return;
    host.swap(key);
  }
}
