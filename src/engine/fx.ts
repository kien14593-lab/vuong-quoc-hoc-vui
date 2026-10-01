import * as THREE from 'three';

/**
 * Hiệu ứng hạt (lấp lánh, pháo giấy, bụi, mảnh đá vỡ, trái tim...) dùng InstancedMesh → rất nhẹ.
 * Mỗi sân khấu tạo một `Fx` riêng và gọi `update(dt)` mỗi khung hình.
 */
export type FxKind = 'sparkle' | 'confetti' | 'dust' | 'shard' | 'heart' | 'leaf' | 'splash' | 'star';

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;
  wx: number; wy: number; wz: number;
  size: number; life: number; age: number;
  grav: number; drag: number;
  grow: number;
  r: number; g: number; b: number;
}

class Pool {
  mesh: THREE.InstancedMesh;
  ps: P[] = [];
  constructor(geo: THREE.BufferGeometry, material: THREE.Material, readonly cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.userData.dynamic = true;
  }
}

const EMIT_DEFAULTS: Record<FxKind, { count: number; speed: number; up: number; size: number; life: number; grav: number; drag: number; colors: string[]; grow: number }> = {
  sparkle: { count: 18, speed: 3.2, up: 3, size: 0.16, life: 0.9, grav: 2, drag: 1.6, colors: ['#fff6a8', '#ffd84a', '#ffffff', '#ffe58a'], grow: -1 },
  star: { count: 14, speed: 4.5, up: 5, size: 0.22, life: 1.1, grav: 6, drag: 1.0, colors: ['#ffd84a', '#ffe680', '#fff3b0'], grow: -0.8 },
  confetti: { count: 46, speed: 5.5, up: 7, size: 0.16, life: 2.2, grav: 7, drag: 1.4, colors: ['#ff6b6b', '#ffd166', '#74c0fc', '#7bd389', '#b197fc', '#ff9ec4'], grow: 0 },
  dust: { count: 10, speed: 1.6, up: 0.8, size: 0.22, life: 0.6, grav: -0.6, drag: 3, colors: ['#f4eedc', '#ffffff', '#e8dfc9'], grow: -1 },
  shard: { count: 22, speed: 5, up: 6, size: 0.24, life: 1.4, grav: 16, drag: 0.6, colors: ['#bdb8b0', '#a9a59e', '#cfcac2', '#948f88'], grow: -0.7 },
  heart: { count: 8, speed: 1.2, up: 2.4, size: 0.2, life: 1.3, grav: -0.4, drag: 1.5, colors: ['#ff6b9a', '#ff8fb1', '#ffb3c8'], grow: -0.5 },
  leaf: { count: 12, speed: 2.4, up: 2.5, size: 0.16, life: 1.6, grav: 3, drag: 2.2, colors: ['#78c46a', '#5cb85c', '#a3d86b'], grow: -0.4 },
  splash: { count: 16, speed: 2.6, up: 4.5, size: 0.14, life: 0.8, grav: 14, drag: 0.8, colors: ['#bfefff', '#ffffff', '#8fd8e6'], grow: -0.6 },
};

export interface BurstOpts {
  count?: number;
  color?: string | string[];
  speed?: number;
  up?: number;
  size?: number;
  life?: number;
  grav?: number;
  /** Bán kính vùng phát (ngẫu nhiên trong khối cầu). */
  spread?: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

function heartGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.1, -0.3, -0.55, -0.15, -0.5, 0.15);
  s.bezierCurveTo(-0.48, 0.45, -0.12, 0.52, 0, 0.25);
  s.bezierCurveTo(0.12, 0.52, 0.48, 0.45, 0.5, 0.15);
  s.bezierCurveTo(0.55, -0.15, 0.1, -0.3, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -0.125);
  return g;
}

function starGeo(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 0.5 : 0.22;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false });
  g.translate(0, 0, -0.09);
  return g;
}

export class Fx {
  private pools: Record<string, Pool>;
  private kindPool: Record<FxKind, string>;
  private rings: { mesh: THREE.Mesh; age: number; dur: number; r0: number; r1: number; op: number }[] = [];
  readonly root = new THREE.Group();

  constructor(private scene: THREE.Scene, cap = 400) {
    const glow = new THREE.MeshBasicMaterial({ toneMapped: false });
    const lit = new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide });
    this.pools = {
      oct: new Pool(new THREE.OctahedronGeometry(0.5, 0), glow, cap),
      star: new Pool(starGeo(), glow, cap / 2),
      card: new Pool(new THREE.BoxGeometry(1, 0.08, 0.6), lit, cap),
      rock: new Pool(new THREE.IcosahedronGeometry(0.5, 0), lit, cap),
      puff: new Pool(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshLambertMaterial({ flatShading: true }), cap / 2),
      heart: new Pool(heartGeo(), glow, cap / 4),
    };
    this.kindPool = { sparkle: 'oct', star: 'star', confetti: 'card', dust: 'puff', shard: 'rock', heart: 'heart', leaf: 'card', splash: 'oct' };
    for (const p of Object.values(this.pools)) this.root.add(p.mesh);
    this.root.name = 'fx';
    this.root.userData.dynamic = true;
    scene.add(this.root);
  }

  burst(kind: FxKind, at: THREE.Vector3 | [number, number, number], o: BurstOpts = {}): void {
    const d = EMIT_DEFAULTS[kind];
    const pool = this.pools[this.kindPool[kind]];
    const pos = Array.isArray(at) ? _p.set(at[0], at[1], at[2]) : _p.copy(at);
    const n = o.count ?? d.count;
    const colors = o.color ? (Array.isArray(o.color) ? o.color : [o.color]) : d.colors;
    const speed = o.speed ?? d.speed;
    const up = o.up ?? d.up;
    const spread = o.spread ?? 0.2;
    for (let i = 0; i < n; i++) {
      if (pool.ps.length >= pool.cap) pool.ps.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      _c.set(colors[(Math.random() * colors.length) | 0]);
      pool.ps.push({
        x: pos.x + (Math.random() - 0.5) * spread * 2,
        y: pos.y + (Math.random() - 0.5) * spread,
        z: pos.z + (Math.random() - 0.5) * spread * 2,
        vx: Math.cos(a) * sp,
        vy: up * (0.5 + Math.random() * 0.7),
        vz: Math.sin(a) * sp,
        rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
        wx: (Math.random() - 0.5) * 12, wy: (Math.random() - 0.5) * 12, wz: (Math.random() - 0.5) * 12,
        size: (o.size ?? d.size) * (0.7 + Math.random() * 0.6),
        life: (o.life ?? d.life) * (0.75 + Math.random() * 0.5),
        age: 0,
        grav: o.grav ?? d.grav,
        drag: d.drag,
        grow: d.grow,
        r: _c.r, g: _c.g, b: _c.b,
      });
    }
  }

  /** Vòng sáng lan rộng trên mặt đất (khi nhặt đồ, mở khóa...). */
  ring(at: THREE.Vector3 | [number, number, number], o: { color?: string; r0?: number; r1?: number; dur?: number; y?: number } = {}): void {
    const m = new THREE.MeshBasicMaterial({ color: o.color ?? '#fff3a0', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), m);
    const p = Array.isArray(at) ? new THREE.Vector3(...at) : at.clone();
    mesh.position.copy(p);
    mesh.position.y += o.y ?? 0.05;
    mesh.renderOrder = 5;
    this.root.add(mesh);
    this.rings.push({ mesh, age: 0, dur: o.dur ?? 0.7, r0: o.r0 ?? 0.3, r1: o.r1 ?? 2.2, op: 0.85 });
  }

  update(dt: number): void {
    for (const pool of Object.values(this.pools)) {
      const ps = pool.ps;
      let w = 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.age += dt;
        if (p.age >= p.life) continue;
        const dr = Math.exp(-p.drag * dt);
        p.vx *= dr;
        p.vz *= dr;
        p.vy = p.vy * (p.grav < 0 ? dr : 1) - p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.03 && p.grav > 0) {
          p.y = 0.03;
          p.vy *= -0.3;
          p.vx *= 0.6;
          p.vz *= 0.6;
          p.wx *= 0.5;
          p.wz *= 0.5;
        }
        p.rx += p.wx * dt;
        p.ry += p.wy * dt;
        p.rz += p.wz * dt;
        ps[w++] = p;
      }
      ps.length = w;
      const mesh = pool.mesh;
      for (let i = 0; i < w; i++) {
        const p = ps[i];
        const k = p.age / p.life;
        let sc = p.size;
        if (p.grow < 0) sc *= 1 + p.grow * k * k;
        else if (p.grow > 0) sc *= 1 + p.grow * k;
        if (k < 0.1) sc *= k / 0.1;
        _e.set(p.rx, p.ry, p.rz);
        _q.setFromEuler(_e);
        _s.setScalar(Math.max(0.0001, sc));
        _p.set(p.x, p.y, p.z);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
        _c.setRGB(p.r, p.g, p.b);
        mesh.setColorAt(i, _c);
      }
      mesh.count = w;
      if (w > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const k = Math.min(1, r.age / r.dur);
      const e = 1 - Math.pow(1 - k, 3);
      r.mesh.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = r.op * (1 - k);
      if (k >= 1) {
        this.root.remove(r.mesh);
        r.mesh.geometry.dispose();
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.scene.remove(this.root);
    for (const p of Object.values(this.pools)) {
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      p.mesh.dispose();
    }
    for (const r of this.rings) {
      r.mesh.geometry.dispose();
      (r.mesh.material as THREE.Material).dispose();
    }
    this.rings = [];
  }
}
