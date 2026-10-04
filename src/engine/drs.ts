/**
 * Tự điều chỉnh độ nét 3D trên máy cảm ứng – phần quyết định (không đụng tới WebGL, để kiểm thử được).
 *
 * Các mức: 0 … max−1 là các nấc tỉ lệ điểm ảnh của `touchLadder` (từ nét nhất tới nhẹ nhất);
 * mức `max` là nấc nhẹ nhất kèm bản đồ bóng nhỏ hơn (chất lượng 'medium').
 * Mỗi 2 giây xem một "cửa sổ": thời gian vẽ từng khung hình trong 2 giây đó.
 */

/** Máy cảm ứng: khung hình 3D tối đa khoảng 2 triệu điểm ảnh (iPad không phải vẽ 3,5 triệu điểm mỗi khung). */
export const TOUCH_PIXEL_BUDGET = 2.0e6;
/** Các nấc tỉ lệ điểm ảnh khi máy vẽ không kịp (hạ độ nét trước, rồi mới giảm bóng đổ). */
const STEPS = [1.75, 1.5, 1.25, 1];
/** Quá nửa số khung hình dưới mức này: màn hình đang chạy 60 khung/giây (iPhone/iPad giới hạn 60, chế độ nguồn điện thấp: 30). */
const HZ60_MS = 22;
/** Khung vẽ trễ: quá 1,25 lần nhịp màn hình. Chậm: trên 10% hai cửa sổ liền, hoặc trên 5% ở 2 trong 3 cửa sổ gần nhất. Dư sức: dưới 2%. */
const SLOW_SHARE = 0.1;
const MEH_SHARE = 0.05;
const ROOMY_SHARE = 0.02;
/** Số cửa sổ dư sức liên tiếp trước khi nâng một nấc (gấp đôi mỗi lần nâng lên mà phải hạ xuống, tối đa 64 ≈ 2 phút). */
const HOLD = 4;
const HOLD_MAX = 64;
/** Nâng lên mà trong chừng này cửa sổ (30 giây) phải hạ lại: lần nâng đó quá sớm. */
const UP_FAILED = 15;
/** Đã thử hạ hẳn mà vẫn 30 khung/giây (máy đang giới hạn 30): chờ 5 phút mới thử lại, rồi lâu dần (tối đa 1 giờ). */
const PROBE_PAUSE = 150;
const PROBE_PAUSE_MAX = 1800;

/** Các nấc tỉ lệ điểm ảnh cho khung vẽ w×h (điểm CSS): nét nhất vừa ngân sách điểm ảnh (tối đa 2), nhẹ nhất là 1. */
export function touchLadder(dpr: number, w: number, h: number): number[] {
  const floor = Math.min(dpr, 1);
  const top = Math.max(floor, Math.min(dpr, 2, Math.sqrt(TOUCH_PIXEL_BUDGET / Math.max(1, w * h))));
  const ladder = [top, ...STEPS.filter((s) => s < top - 0.12 && s >= floor)];
  if (ladder[ladder.length - 1] > floor) ladder.push(floor);
  return ladder;
}

export class DrsPolicy {
  /** Mức hiện tại: 0 = nét nhất; `max` = nấc nhẹ nhất kèm bóng nhỏ. */
  level = 0;
  /** Mức nhẹ nhất (= số nấc tỉ lệ điểm ảnh). */
  max = 1;
  /** Đang sau màn che tải cảnh: khung hình chậm do tải chứ không do vẽ – không tính. */
  loading = false;
  private win = 0;
  private skip = 0;
  /** Tỉ lệ khung trễ của các cửa sổ gần nhất (tối đa 3) kể từ lần đổi mức / bỏ qua gần nhất. */
  private recent: number[] = [];
  private roomyN = 0;
  private hold = HOLD;
  private lastUp = -99;
  /** Lần nâng gần nhất diễn ra lúc màn hình đang chạy 60 khung/giây. */
  private upHz60 = false;
  /** Vừa nâng một nấc: cửa sổ đo đầu tiên sau đó quyết định có giữ không. */
  private checkUp = false;
  private probe: { prev: number; left: number } | null = null;
  private noProbeUntil = 0;
  private probePause = PROBE_PAUSE;

  /** Về mức nét nhất, quên lịch sử (vừa chọn lại chế độ Tự động). */
  reset(): void {
    this.level = 0;
    this.hold = HOLD;
    this.lastUp = -99;
    this.upHz60 = false;
    this.checkUp = false;
    this.probe = null;
    this.noProbeUntil = 0;
    this.probePause = PROBE_PAUSE;
    this.skipNext();
  }

  /** Số nấc tỉ lệ điểm ảnh đổi (khung vẽ đổi kích thước): giữ nguyên ý nghĩa mức hiện tại. */
  setSteps(n: number): void {
    n = Math.max(1, n);
    if (n === this.max) return;
    this.level = this.level >= this.max ? n : Math.min(this.level, n - 1);
    if (this.probe) this.probe.prev = Math.min(this.probe.prev, n - 1);
    this.max = n;
  }

  /** Bỏ qua cửa sổ đo kế tiếp (vừa đổi cảnh / kích thước / độ nét: vài khung đầu thường chậm). */
  skipNext(): void {
    this.skip = Math.max(this.skip, 1);
    this.recent = [];
    this.roomyN = 0;
  }

  /** Vừa mất ngữ cảnh WebGL (máy thiếu bộ nhớ): về mức nhẹ nhất, rất lâu sau mới nâng lại. */
  safeMode(): void {
    this.level = this.max;
    this.hold = HOLD_MAX;
    this.checkUp = false;
    this.probe = null;
    this.skipNext();
  }

  /**
   * Một cửa sổ đo. `ms`: thời gian từng khung hình (ms), đã xếp tăng dần. Trả về true nếu đổi mức.
   * Chậm → hạ một mức; dư sức `hold` cửa sổ liền → nâng một mức. Vừa nâng mà cửa sổ đầu tiên đã chậm hơn → hạ lại ngay;
   * nâng mà sớm phải hạ lại thì lần sau chờ lâu gấp đôi.
   * Màn hình chỉ chạy 30 khung/giây: có thể do máy vẽ không kịp, cũng có thể do chế độ nguồn điện thấp – thử hạ hẳn
   * xuống mức nhẹ nhất 2 cửa sổ: lên lại 60 thì giữ mức thấp (nâng dần sau); vẫn 30 thì trả lại như cũ và lâu sau mới thử lại.
   */
  window(ms: readonly number[]): boolean {
    this.win++;
    if (this.loading || this.skip > 0) {
      if (!this.loading) this.skip--;
      this.recent = [];
      this.roomyN = 0;
      return false;
    }
    if (!ms.length) return false;
    const hz60 = ms[Math.floor(ms.length / 2)] < HZ60_MS;
    const probe = this.probe;
    if (probe) {
      if (hz60) this.probe = null;
      else if (--probe.left <= 0) {
        this.probe = null;
        this.noProbeUntil = this.win + this.probePause;
        this.probePause = Math.min(PROBE_PAUSE_MAX, this.probePause * 2);
        return this.set(probe.prev);
      }
      return false;
    }
    const late = (hz60 ? 1000 / 60 : 1000 / 30) * 1.25;
    let n = 0;
    for (const v of ms) if (v > late) n++;
    const over = n / ms.length;
    const check = this.checkUp;
    this.checkUp = false;
    // Vừa nâng độ nét mà rơi từ 60 xuống 30 khung/giây, hoặc khựng nhiều: hạ lại ngay.
    if (check && ((this.upHz60 && !hz60) || over > SLOW_SHARE)) return this.down();
    const r = this.recent;
    r.push(over);
    if (r.length > 3) r.shift();
    const k = r.length;
    const mid = k === 3 ? r[0] + r[1] + r[2] - Math.max(r[0], r[1], r[2]) - Math.min(r[0], r[1], r[2]) : 0;
    if ((k >= 2 && r[k - 1] > SLOW_SHARE && r[k - 2] > SLOW_SHARE) || mid > MEH_SHARE) return this.down();
    if (over >= ROOMY_SHARE) {
      this.roomyN = 0;
      return false;
    }
    this.roomyN++;
    if (!hz60 && this.level < this.max && this.win >= this.noProbeUntil && this.roomyN >= 2) {
      this.probe = { prev: this.level, left: 2 };
      return this.set(this.max);
    }
    if (this.roomyN < this.hold) return false;
    this.roomyN = 0;
    return this.up(hz60);
  }

  private down(): boolean {
    if (this.win - this.lastUp <= UP_FAILED) this.hold = Math.min(HOLD_MAX, this.hold * 2);
    this.lastUp = -99;
    return this.set(this.level + 1);
  }

  private up(hz60: boolean): boolean {
    if (!this.set(this.level - 1)) return false;
    this.lastUp = this.win;
    this.upHz60 = hz60;
    this.checkUp = true;
    return true;
  }

  private set(l: number): boolean {
    const v = Math.max(0, Math.min(this.max, l));
    if (v === this.level) return false;
    this.level = v;
    this.skipNext();
    return true;
  }
}
