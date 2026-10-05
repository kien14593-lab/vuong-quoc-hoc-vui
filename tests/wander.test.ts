import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { defineModel, type Collider } from '../src/models/registry';
import { Actor } from '../src/world/actor';
import { World, yawTo, type Body } from '../src/world/collide';
import { angDiff, behindYaw, bestYaw, bodyDist, pickWanderTarget, segmentClear, shoulderYaw, yawOrder } from '../src/world/wander';

/**
 * NPC đi lang thang: đứng lại chờ bé, không đi xuyên vật trang trí; camera câu đố tìm góc nhìn thoáng.
 */
const DEG = Math.PI / 180;
// Chạy hết các lời hứa đang chờ (setImmediate: không phụ thuộc độ phân giải đồng hồ ~15 ms của Windows như setTimeout)
const flush = () => new Promise((r) => setImmediate(r));

/** Cách cũ của addColliders (trước khi tách World.shapes) – để chứng minh kết quả không đổi. */
function oldShapes(cols: Collider[], x: number, z: number, rotY: number, scale: number, tag?: string): Body[] {
  const out: Body[] = [];
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  for (const col of cols) {
    const ax = (col.at?.[0] ?? 0) * scale;
    const az = (col.at?.[1] ?? 0) * scale;
    const wx = x + ax * c + az * s;
    const wz = z - ax * s + az * c;
    const top = col.top !== undefined ? col.top * scale : Infinity;
    if (col.kind === 'circle') out.push({ kind: 'circle', x: wx, z: wz, r: col.r * scale, hw: col.r * scale, hd: col.r * scale, c: 1, s: 0, top, on: true, tag });
    else {
      const hw = (col.w * scale) / 2;
      const hd = (col.d * scale) / 2;
      const ry = rotY + ((col.rot ?? 0) * Math.PI) / 180;
      out.push({ kind: 'box', x: wx, z: wz, r: Math.hypot(hw, hd), hw, hd, c: Math.cos(ry), s: Math.sin(ry), top, on: true, tag });
    }
  }
  return out;
}

const box = (x: number, z: number, w: number, d: number, rotDeg = 0): Body => World.shapes([{ kind: 'box', w, d }], x, z, rotDeg * DEG)[0];
const circle = (x: number, z: number, r: number): Body => World.shapes([{ kind: 'circle', r }], x, z)[0];

describe('World.shapes', () => {
  it('ra đúng các vật cản như addColliders cũ, nhưng không thêm vào thế giới', () => {
    const cols: Collider[] = [
      { kind: 'box', w: 2, d: 0.7, top: 1, at: [0.5, 0.2], rot: 15 },
      { kind: 'circle', r: 0.3, at: [-0.4, 0.1] },
      { kind: 'box', w: 1.2, d: 0.6 },
    ];
    const world = new World({ minX: -20, minZ: -20, maxX: 20, maxZ: 20 });
    for (const [x, z, rot, sc] of [[3, -2, 0.6, 1.3], [-7, 5, -2.1, 0.74], [0, 0, 0, 1]] as const) {
      const shapes = World.shapes(cols, x, z, rot, sc, 'deco');
      expect(world.bodies.length % 3).toBe(0);
      const before = world.bodies.length;
      const added = world.addColliders(cols, x, z, rot, sc, 'deco');
      expect(world.bodies.length).toBe(before + 3);
      expect(shapes).toEqual(oldShapes(cols, x, z, rot, sc, 'deco'));
      expect(added).toEqual(shapes);
    }
    expect(World.shapes(undefined, 1, 2)).toEqual([]);
  });
});

describe('segmentClear / bodyDist', () => {
  const hedge = box(1, 0, 0.6, 4); // tường mỏng dọc trục Z tại x = 1 (0.7 … 1.3)

  it('bodyDist: âm bên trong, dương bên ngoài', () => {
    expect(bodyDist(hedge, 1, 0)).toBeCloseTo(-0.3);
    expect(bodyDist(hedge, 0, 0)).toBeCloseTo(0.7);
    expect(bodyDist(hedge, 1.3, 2.5)).toBeCloseTo(0.5);
    expect(bodyDist(circle(0, 0, 0.5), 2, 0)).toBeCloseTo(1.5);
  });

  it('chặn đoạn đi xuyên qua, cho đi song song đủ xa', () => {
    expect(segmentClear(0, 0, 2, 0, [hedge], 0.4)).toBe(false);
    expect(segmentClear(0, -1, 0, 1, [hedge], 0.4)).toBe(true);
    // Điểm đến sát vật quá (nhỏ hơn bán kính thân) cũng bị loại
    expect(segmentClear(0, -1, 0, 1, [hedge], 0.8)).toBe(false);
    // Hình tròn nằm cạnh đường đi
    expect(segmentClear(0, 0, 4, 0, [circle(2, 0.5, 0.3)], 0.3)).toBe(false);
    expect(segmentClear(0, 0, 4, 0, [circle(2, 1, 0.3)], 0.3)).toBe(true);
  });

  it('đang đứng đè lên vật thì được đi ra, không được lấn sâu thêm', () => {
    expect(segmentClear(0.9, 0, -1, 0, [hedge], 0.4)).toBe(true);
    expect(segmentClear(0.5, 0, 1.0, 0, [hedge], 0.4)).toBe(false);
    expect(segmentClear(0.5, 0, 0.5, 1.5, [hedge], 0.4)).toBe(false);
  });

  it('vật đã tắt (on = false) không chặn', () => {
    expect(segmentClear(0, 0, 2, 0, [{ ...hedge, on: false }], 0.4)).toBe(true);
  });
});

describe('pickWanderTarget', () => {
  it('lấy điểm ngẫu nhiên đầu tiên hợp lệ, mỗi lần thử dùng 2 số ngẫu nhiên', () => {
    const seq = [0, 1, 0.25, 1, 0.5, 0.25];
    let i = 0;
    const rnd = () => seq[i++];
    const seen: [number, number][] = [];
    const p = pickWanderTarget({ x: 1, z: 2, r: 2 }, (x, z) => (seen.push([x, z]), seen.length === 3), rnd);
    expect(i).toBe(6);
    expect(seen[0][0]).toBeCloseTo(3);
    expect(seen[0][1]).toBeCloseTo(2);
    expect(seen[1][0]).toBeCloseTo(1);
    expect(seen[1][1]).toBeCloseTo(4);
    expect(p!.x).toBeCloseTo(0);
    expect(p!.z).toBeCloseTo(2);
  });

  it('không điểm nào hợp lệ → null sau 6 lần thử', () => {
    let n = 0;
    expect(pickWanderTarget({ x: 0, z: 0, r: 1 }, () => (n++, false))).toBeNull();
    expect(n).toBe(6);
  });
});

describe('shoulderYaw / yawOrder / bestYaw', () => {
  it('camera sau lưng bé, lệch 40° về phía gần góc hiện tại', () => {
    // NPC ở gốc, bé ở phía +Z → camera "sau lưng bé" có yaw 0 (giống FollowCam: yaw 0 = camera ở +Z).
    expect(behindYaw(0, 0, 0, 2)).toBeCloseTo(0);
    expect(behindYaw(0, 0, 2, 0)).toBeCloseTo(Math.PI / 2);
    expect(shoulderYaw(0, 0, 0, 2, 0.3)).toBeCloseTo(40 * DEG);
    expect(shoulderYaw(0, 0, 0, 2, -0.3)).toBeCloseTo(-40 * DEG);
    // Bé ở phía -Z, camera đang ở +Z (yaw 0): xoay về bên gần hơn, góc lệch luôn đúng 40° so với đường sau lưng bé
    const y = shoulderYaw(0, 0, 0, -2, 0.1);
    expect(Math.abs(angDiff(y, Math.PI))).toBeCloseTo(40 * DEG);
    expect(Math.abs(angDiff(y, 0.1))).toBeLessThan(Math.PI - 40 * DEG + 1e-6);
    // Bé đứng trùng chỗ NPC → giữ nguyên
    expect(shoulderYaw(1, 1, 1, 1, 0.7)).toBe(0.7);
  });

  // Góc thử, tính bằng độ so với base = 1 rad
  const rel = (y: number) => Math.round(((y - 1) / DEG) * 10) / 10 + 0;

  it('thử lần lượt 0, ±20°… ±80°, ưu tiên phía `prefer`', () => {
    expect([...yawOrder(1, 1 + 0.5)].map(rel)).toEqual([0, 20, -20, 40, -40, 60, -60, 80, -80]);
    expect([...yawOrder(1, 1 - 0.5)].map(rel).slice(0, 3)).toEqual([0, -20, 20]);
    expect([...yawOrder(1)].map(rel).slice(0, 3)).toEqual([0, 20, -20]);
  });

  it('bestYaw: góc đầu tiên thấy đủ; không có thì góc thấy nhiều nhất (gần base nhất); không thấy gì → null', () => {
    const tried: number[] = [];
    expect(bestYaw(1, (y) => (tried.push(rel(y)), 0), 2, 1 + 0.5)).toBeNull();
    expect(tried).toEqual([0, 20, -20, 40, -40, 60, -60, 80, -80]);
    expect(bestYaw(1, () => 2, 2)).toBe(1);
    // Chỉ 60° thấy đủ → dừng ngay ở 60°, không tốn tia cho các góc sau
    tried.length = 0;
    const at60 = (y: number) => (tried.push(rel(y)), rel(y) === 60 ? 2 : 0);
    expect(rel(bestYaw(1, at60, 2, 1 + 0.5)!)).toBe(60);
    expect(tried).toEqual([0, 20, -20, 40, -40, 60]);
    // Không góc nào đủ: lấy điểm cao nhất; bằng điểm thì góc thử trước (gần base hơn)
    const part = (y: number) => ([-40, 60, -80].includes(rel(y)) ? 1 : 0);
    expect(rel(bestYaw(1, part, 2, 1 + 0.5)!)).toBe(-40);
    const more = (y: number) => (rel(y) === 80 ? 1.5 : part(y));
    expect(rel(bestYaw(1, more, 2, 1 + 0.5)!)).toBe(80);
  });
});

describe('Actor: NPC đi lang thang', () => {
  defineModel('test_wander_npc', { build: () => new THREE.Group(), height: 1.5 });
  const make = () => {
    const a = new Actor('test_wander_npc', { x: 0, z: 0, radius: 0.4 });
    a.wander = { x: 0, z: 0, r: 3, next: 0, pause: [2.5, 6] };
    return a;
  };

  it('bé lại gần → đứng lại, quay dần về phía bé; bé đi xa 2–3 giây mới đi tiếp', async () => {
    for (let run = 0; run < 12; run++) {
      const a = make();
      a.update(0.016, 0.1);
      expect(a.moving).toBe(true);
      // Thứ tự như trong game: actor.update rồi zone.updateInteract gọi attend, mỗi khung hình
      a.attend(4, 0);
      a.update(0.016, 0.116);
      a.attend(4, 0);
      await flush();
      expect(a.moving).toBe(false);
      expect(a.yawGoal).toBeCloseTo(yawTo(a.pos.x, a.pos.z, 4, 0));
      // Quay mượt: sau một khung hình vẫn còn lệch nhiều (không quay ngoắt một lần)
      expect(Math.abs(angDiff(a.yaw, a.yawGoal))).toBeGreaterThan(0.5);
      // Bé đứng lâu bên cạnh: NPC không bỏ đi
      let t = 0.216;
      for (; t < 20; t += 0.1) {
        a.update(0.1, t);
        a.attend(4, 0);
        await flush();
        expect(a.moving).toBe(false);
      }
      expect(Math.abs(angDiff(a.yaw, a.yawGoal))).toBeLessThan(0.01);
      // Bé đi xa (lần attend cuối ở t − 0.1): NPC đi tiếp sau 2–3 giây
      const left = t - 0.1;
      let resumed = -1;
      for (; t < 30; t += 0.05) {
        a.update(0.05, t);
        if (a.moving) {
          resumed = t;
          break;
        }
      }
      expect(resumed - left).toBeGreaterThanOrEqual(2);
      expect(resumed - left).toBeLessThanOrEqual(3.1);
    }
  });

  it('đi tới nơi bình thường thì nghỉ theo `pause` như cũ', async () => {
    const a = make();
    a.update(0.016, 1);
    expect(a.moving).toBe(true);
    const w = a.wander!;
    a.stop(true);
    await flush();
    expect(w.next).toBeGreaterThanOrEqual(1 + 2.5);
    expect(w.next).toBeLessThanOrEqual(1 + 6);
  });

  it('đang nói chuyện (wander tạm tắt) thì lời hứa đi cũ không ghi đè lịch', async () => {
    const a = make();
    a.update(0.016, 1);
    const w = a.wander!;
    a.wander = null;
    a.stop(false);
    await flush();
    expect(w.next).toBe(Infinity);
    w.next = 5;
    a.wander = w;
    await flush();
    expect(w.next).toBe(5);
  });

  it('không chọn điểm đến xuyên qua vật trang trí', async () => {
    const hedge = box(1, 0, 0.6, 8);
    for (const avoid of [undefined, [hedge]]) {
      const a = make();
      a.wander!.avoid = avoid;
      let crossed = 0;
      let picks = 0;
      for (let i = 0; i < 300; i++) {
        a.setPos(0, 0);
        a.wander!.next = 0;
        a.update(0.016, i);
        const p = a.path?.[a.path.length - 1];
        a.stop(true);
        await flush();
        if (!p) continue;
        picks++;
        if (!segmentClear(0, 0, p.x, p.z, [hedge], 0.4)) crossed++;
      }
      if (avoid) {
        expect(crossed).toBe(0);
        expect(picks).toBeGreaterThan(200);
      } else expect(crossed).toBeGreaterThan(30);
    }
  });

  it('không còn chỗ nào hợp lệ → đứng yên chờ lượt sau, không đi xuyên', () => {
    const a = make();
    a.wander!.avoid = [circle(0, 0, 0.2), box(0, 0, 9, 9)];
    a.setPos(0, 0);
    a.update(0.016, 1);
    expect(a.moving).toBe(false);
    expect(a.wander!.next).toBeGreaterThan(1);
    expect(a.wander!.next).toBeLessThan(Infinity);
  });

  it('mọi điểm đều bị tường chặn, không vật trang trí nào cản đường về → về tâm vùng như cũ', () => {
    const walls = { lineWalkable: () => false } as unknown as World;
    for (const avoid of [undefined, [circle(20, 20, 1)]]) {
      const a = make();
      a.wander!.avoid = avoid;
      a.setPos(2, 0);
      a.update(0.016, 1, walls);
      expect(a.moving).toBe(true);
      expect(a.path?.[a.path.length - 1]).toEqual({ x: 0, z: 0 });
    }
  });
});
