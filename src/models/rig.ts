import type * as THREE from 'three';

/**
 * Khung chuyển động đơn giản cho nhân vật & thú (không dùng xương thật, chỉ xoay các nhóm "khớp").
 *
 * Quy ước khớp (đều là Object3D đặt tại điểm xoay):
 *  - body: thân (nhún nhảy, thở)            - head: đầu (gật, nghiêng)
 *  - armL/armR: vai (tay buông thẳng xuống) - legL/legR: hông (chân thẳng xuống)
 *  - legs: thú 4 chân [trước-trái, trước-phải, sau-trái, sau-phải]
 *  - tail: gốc đuôi                          - ears: gốc tai
 *  - eyes: mắt (thu scale.y để chớp mắt)    - wings: cánh (vỗ quanh trục Z)
 *  - mouth: miệng (scale.y khi nói)
 * "Trái" của nhân vật là phía +X (nhân vật nhìn về +Z).
 */
export type RigKind = 'biped' | 'quad' | 'float' | 'bird' | 'static';

export interface Rig {
  root: THREE.Object3D;
  kind: RigKind;
  height: number;
  body?: THREE.Object3D;
  head?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  legs?: THREE.Object3D[];
  tail?: THREE.Object3D;
  ears?: THREE.Object3D[];
  eyes?: THREE.Object3D[];
  wings?: THREE.Object3D[];
  mouth?: THREE.Object3D;
  /** Biên độ bước chân (mặc định 0.7 rad). */
  stride?: number;
  /** Tần số bước (bước/giây khi đi bộ, mặc định 2.2). */
  cadence?: number;
  /** Hoạt cảnh riêng chạy sau hoạt cảnh mặc định. */
  custom?: (rig: Rig, s: AnimState) => void;
  /** Mô hình GLB có xương thật: bộ điều khiển hoạt cảnh thay cho hoạt cảnh dựng bằng code. */
  animator?: { update(s: AnimState): void };
  /** Trạng thái nội bộ. */
  _st?: { phase: number; blinkAt: number; blinkT: number; bodyY: number; seed: number; hop: number; earAt: number };
}

export interface AnimState {
  t: number;
  dt: number;
  /** Tốc độ di chuyển chuẩn hóa 0..1 (1 = đi bộ nhanh). */
  move: number;
  run?: boolean;
  /** Đang ở trên không (nhảy/rơi). */
  air?: boolean;
  talk?: boolean;
  wave?: boolean;
  /** Vui mừng (nhảy cẫng lên) 0..1. */
  happy?: number;
  /** Đang ngồi (trên ván trượt...). */
  ride?: boolean;
}

const base = new WeakMap<THREE.Object3D, { x: number; y: number; z: number; py: number; sx: number; sy: number; sz: number }>();

function rest(o: THREE.Object3D) {
  let b = base.get(o);
  if (!b) {
    b = { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z, py: o.position.y, sx: o.scale.x, sy: o.scale.y, sz: o.scale.z };
    base.set(o, b);
  }
  return b;
}

const approach = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Cập nhật tư thế cho một khung hình. */
export function animateRig(rig: Rig, s: AnimState): void {
  if (rig.animator) {
    rig.animator.update(s);
    rig.custom?.(rig, s);
    return;
  }
  const st = (rig._st ??= {
    phase: Math.random() * 6,
    blinkAt: s.t + 1 + Math.random() * 3,
    blinkT: -1,
    bodyY: 0,
    seed: Math.random() * 100,
    hop: 0,
    earAt: s.t + 2 + Math.random() * 4,
  });
  const dt = s.dt;
  const t = s.t + st.seed;
  const mv = Math.min(1.4, s.move);
  const cad = (rig.cadence ?? 2.2) * (s.run ? 1.35 : 1);
  st.phase += dt * Math.PI * 2 * cad * Math.min(1, mv * 1.2) * (mv > 0.02 ? 1 : 0);
  const ph = st.phase;
  const stride = (rig.stride ?? 0.7) * Math.min(1, mv) * (s.run ? 1.15 : 1);

  // Chớp mắt
  if (rig.eyes?.length) {
    if (st.blinkT < 0 && s.t >= st.blinkAt) st.blinkT = 0;
    let k = 1;
    if (st.blinkT >= 0) {
      st.blinkT += dt;
      const bt = st.blinkT / 0.14;
      k = bt < 0.5 ? 1 - bt * 2 * 0.9 : 0.1 + (bt - 0.5) * 2 * 0.9;
      if (bt >= 1) {
        st.blinkT = -1;
        st.blinkAt = s.t + 2.2 + Math.random() * 3.2;
        k = 1;
      }
    }
    for (const e of rig.eyes) e.scale.y = rest(e).sy * Math.max(0.1, Math.min(1, k));
  }

  // Vui mừng: nhảy tưng tưng
  st.hop = approach(st.hop, s.happy ?? 0, 6, dt);
  const hopY = st.hop > 0.01 ? Math.abs(Math.sin(t * 9)) * 0.28 * st.hop : 0;

  if (rig.kind === 'biped') {
    const swing = s.air ? 0 : Math.sin(ph) * stride;
    if (rig.legL) rig.legL.rotation.x = rest(rig.legL).x + (s.air ? -0.5 : s.ride ? -0.15 : swing);
    if (rig.legR) rig.legR.rotation.x = rest(rig.legR).x + (s.air ? 0.35 : s.ride ? 0.1 : -swing);
    const armSwing = s.air ? 0 : Math.sin(ph) * stride * 0.9;
    if (rig.armL) {
      const r = rest(rig.armL);
      rig.armL.rotation.x = approach(rig.armL.rotation.x, r.x - armSwing, 18, dt);
      const up = s.air ? 0.9 : s.ride ? 0.6 : st.hop > 0.3 ? 2.4 * st.hop : 0.06 + Math.sin(t * 2.1) * 0.03;
      rig.armL.rotation.z = approach(rig.armL.rotation.z, r.z + up, 10, dt);
    }
    if (rig.armR) {
      const r = rest(rig.armR);
      if (s.wave) {
        rig.armR.rotation.x = approach(rig.armR.rotation.x, r.x - 0.2, 10, dt);
        rig.armR.rotation.z = approach(rig.armR.rotation.z, r.z - 2.5 + Math.sin(t * 10) * 0.35, 12, dt);
      } else {
        rig.armR.rotation.x = approach(rig.armR.rotation.x, r.x + armSwing, 18, dt);
        const up = s.air ? 0.9 : s.ride ? 0.6 : st.hop > 0.3 ? 2.4 * st.hop : 0.06 + Math.sin(t * 2.1) * 0.03;
        rig.armR.rotation.z = approach(rig.armR.rotation.z, r.z - up, 10, dt);
      }
    }
    if (rig.body) {
      const r = rest(rig.body);
      const bob = mv > 0.02 && !s.air ? Math.abs(Math.sin(ph)) * 0.07 * Math.min(1, mv) : 0;
      st.bodyY = approach(st.bodyY, bob, 20, dt);
      rig.body.position.y = r.py + st.bodyY;
      const breath = 1 + Math.sin(t * 2.2) * 0.012;
      rig.body.scale.set(r.sx * (2 - breath), r.sy * breath, r.sz * (2 - breath));
      rig.body.rotation.x = approach(rig.body.rotation.x, r.x + (s.run && mv > 0.1 ? 0.12 : mv > 0.1 ? 0.05 : 0), 8, dt);
      rig.body.rotation.y = r.y + (mv > 0.02 ? Math.sin(ph) * 0.06 * Math.min(1, mv) : 0);
    }
  } else if (rig.kind === 'quad') {
    const legs = rig.legs ?? [];
    const amp = s.air ? 0 : (rig.stride ?? 0.6) * Math.min(1, mv);
    legs.forEach((l, i) => {
      const off = i === 0 || i === 3 ? 0 : Math.PI;
      l.rotation.x = rest(l).x + (s.air ? (i < 2 ? -0.6 : 0.6) : Math.sin(ph + off) * amp);
    });
    if (rig.body) {
      const r = rest(rig.body);
      const bob = mv > 0.02 ? Math.abs(Math.sin(ph)) * 0.05 * Math.min(1, mv) : 0;
      st.bodyY = approach(st.bodyY, bob, 20, dt);
      rig.body.position.y = r.py + st.bodyY;
      const breath = 1 + Math.sin(t * 2.4) * 0.015;
      rig.body.scale.y = r.sy * breath;
    }
  } else if (rig.kind === 'float' || rig.kind === 'bird') {
    if (rig.body) {
      const r = rest(rig.body);
      rig.body.position.y = r.py + Math.sin(t * 2.2) * 0.08;
    }
  }

  // Đầu: nói chuyện thì gật gù, đứng yên thì thỉnh thoảng nghiêng
  if (rig.head) {
    const r = rest(rig.head);
    const nod = s.talk ? Math.sin(t * 9) * 0.07 : 0;
    const look = mv < 0.05 ? Math.sin(t * 0.7) * 0.12 : 0;
    const tilt = mv < 0.05 ? Math.sin(t * 0.45 + 1) * 0.05 : 0;
    rig.head.rotation.x = approach(rig.head.rotation.x, r.x + nod - (s.air ? 0.1 : 0), 12, dt);
    rig.head.rotation.y = approach(rig.head.rotation.y, r.y + look, 4, dt);
    rig.head.rotation.z = approach(rig.head.rotation.z, r.z + tilt, 4, dt);
  }
  if (rig.mouth) {
    const r = rest(rig.mouth);
    rig.mouth.scale.y = r.sy * (s.talk ? 0.6 + Math.abs(Math.sin(t * 14)) * 1.2 : 1);
  }
  if (rig.tail) {
    const r = rest(rig.tail);
    const wag = (0.25 + st.hop * 0.5 + (s.talk ? 0.2 : 0)) * Math.sin(t * (6 + st.hop * 8));
    rig.tail.rotation.y = r.y + wag;
  }
  if (rig.ears?.length) {
    let twitch = 0;
    if (s.t > st.earAt) {
      const k = s.t - st.earAt;
      if (k > 0.3) st.earAt = s.t + 2.5 + Math.random() * 4;
      else twitch = Math.sin(k * 42) * 0.22 * (1 - k / 0.3);
    }
    rig.ears.forEach((e, i) => {
      e.rotation.z = rest(e).z + (i === 0 ? twitch : -twitch);
    });
  }
  if (rig.wings?.length) {
    const fast = rig.kind === 'bird' || rig.kind === 'float';
    const sp = fast ? 16 : 3;
    const amp = fast ? 0.7 : 0.08 + st.hop * 0.6;
    rig.wings.forEach((w, i) => {
      const f = Math.sin(t * sp) * amp;
      w.rotation.z = rest(w).z + (i === 0 ? f : -f);
    });
  }
  rig.root.position.y = rest(rig.root).py + hopY;
  rig.custom?.(rig, s);
}

/** Lấy khung chuyển động gắn trong mô hình (nếu có). */
export function rigOf(obj: THREE.Object3D): Rig | undefined {
  return obj.userData.rig as Rig | undefined;
}
