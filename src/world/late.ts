import type * as THREE from 'three';
import { warmUp } from '../engine/core';
import { ensureGlb, glbLoaded, glbReady } from '../models/glb';
import { buildModel } from '../models/registry';
import { wait } from '../ui/dom';

/** Cảnh dùng mô hình tải sau. */
export interface LateHost {
  /** Cảnh đã đóng: thôi hẳn (phần còn lại tải dần ở nền). */
  gone(): boolean;
  /** Tạm chưa tải tệp tiếp theo, chưa thay mô hình (đang chơi trò chơi nhỏ, đang rời đi). */
  hold?(): boolean;
  /** Cảnh (đèn) và camera để chuẩn bị trước ảnh + shader của mô hình vừa tải (engine/core.ts warmUp). */
  scene?: THREE.Scene;
  camera?: THREE.Camera;
  /** Tệp của `key` đã tải xong: thay mô hình dựng bằng code ngay tại chỗ (gọi lại nhiều lần vẫn an toàn). */
  swap(key: string): void;
}

/**
 * Mô hình AI tải sau – cảnh không chờ (hoặc chờ quá hạn) mà tạm dùng mô hình dựng bằng code: thú trong chuồng, dân làng
 * (game/needs.ts ZONE_LATE_MODELS, TITLE_LATE_MODELS), nhân vật chưa tải kịp lúc mở màn hình tiêu đề / chuyển cảnh.
 * Đợi phần phải có (`must`: nhân vật chính của cảnh, thú cưng, bé – `first` trước nhất) tải xong, rồi tải lần lượt theo
 * thứ tự `late` và thay từng mô hình ngay khi tệp của nó xong. Chỉ lo các khóa chưa tải xong lúc gọi (cảnh vừa dựng xong
 * nhân vật – khóa đã tải thì nhân vật đã dùng mô hình AI). Xong khi đã tải hết (hoặc thôi tải) – mô hình cuối có thể
 * còn đang được thay: gọi tiếp loadLate ngay thì mạng không nghỉ.
 */
export async function loadLate(late: readonly string[], must: readonly string[], host: LateHost, first: readonly string[] = []): Promise<void> {
  const todo = late.filter((k) => !glbReady([k]));
  if (!todo.length || host.gone()) return;
  // Chờ chính lần tải (không hỏi lại theo chu kỳ): tệp phải có cuối cùng xong là tệp tải sau đầu tiên bắt đầu ngay, không
  // để khe hở cho tệp nạp nền (glb.ts pump) chen vào rồi bị hủy, tải lại. Đang rời khu vực / chơi trò chơi nhỏ: chưa giục.
  while (!glbReady(must)) {
    if (host.hold?.()) await wait(300);
    else await ensureGlb(must, { first });
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
  // Tải lần lượt theo thứ tự, riêng một nhánh: mạng không nghỉ lúc chuẩn bị / thay mô hình – khe hở thì tệp nạp nền
  // (glb.ts pump) chen vào rồi bị lần ensureGlb kế tiếp hủy, tải lại.
  let fetching = true;
  let wake = (): void => {};
  const fetched = (async () => {
    for (const key of todo) {
      const ok = await fetchKey(key);
      wake();
      if (!ok) break;
    }
    fetching = false;
    wake();
  })();
  void swapAll(todo, host, () => fetching, () => new Promise<void>((r) => ((wake = r), setTimeout(r, 250))));
  return fetched;
}

/**
 * Thay mô hình theo thứ tự tệp xong – tệp đang tải song song từ trước (vd. lúc khởi động màn hình tiêu đề, thú cưng)
 * không phải đợi tệp đứng trước nó trong danh sách. Từng mô hình một: chuẩn bị trước rồi mới thay.
 */
async function swapAll(todo: readonly string[], host: LateHost, fetching: () => boolean, nap: () => Promise<void>): Promise<void> {
  const left = [...todo];
  while (left.length) {
    const i = left.findIndex((k) => glbReady([k]));
    if (i < 0) {
      if (!fetching()) return;
      await nap();
      if (host.gone()) return;
      continue;
    }
    const [key] = left.splice(i, 1);
    // Tệp lỗi: giữ mô hình dựng bằng code.
    if (!glbLoaded(key)) continue;
    // Đang chơi trò chơi nhỏ / đang rời đi: quay lại mới chuẩn bị và thay (không tốn công cho cảnh đang khuất).
    while (host.hold?.()) {
      await wait(300);
      if (host.gone()) return;
    }
    // Đưa ảnh lên GPU và biên dịch shader trước, để lúc thay không khựng. Mẫu dựng thử dùng chung hình khối + vật liệu
    // với mô hình thật (cả thú trong chuồng) nên chuẩn bị một lần là đủ; bỏ đi, không hủy.
    const probe = buildModel(key);
    if (probe.userData.glb) await warmUp(probe, { scene: host.scene, camera: host.camera });
    if (host.gone()) return;
    host.swap(key);
  }
}
