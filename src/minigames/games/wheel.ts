import * as THREE from 'three';
import '../../styles/games/wheel.css';
import { sfx } from '../../core/audio';
import { ball, box, cone, cyl, rbox, torus } from '../../engine/kit';
import { PAL, tint } from '../../engine/materials';
import { textPlate } from '../../engine/text';
import type { MiniHost, MiniInfo, MiniRound } from '../base';
import { MiniGame } from '../base';
import { defineMini } from '../registry';

const COLORS = ['#ff6b6b', '#ffd166', '#4ecdc4', '#6cb8ff', '#b197fc', '#ff9ec7', '#95e1a7', '#ffa94d'];

function pieSegment(i: number, n: number, r: number, color: string): THREE.Mesh {
  const a0 = (i / n) * Math.PI * 2;
  const a1 = ((i + 1) / n) * Math.PI * 2;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(Math.sin(a0) * r, Math.cos(a0) * r);
  shape.absarc(0, 0, r, Math.PI / 2 - a0, Math.PI / 2 - a1, true);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false, curveSegments: 5 });
  geo.translate(0, 0, -0.05);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  mesh.castShadow = true;
  return mesh;
}

class WheelGame extends MiniGame {
  private wheel = new THREE.Group();
  private pointer = new THREE.Group();
  private answerRoot = new THREE.Group();
  private answerTargets: THREE.Object3D[] = [];
  private activeRound: MiniRound | null = null;

  constructor(info: MiniInfo, host: MiniHost) {
    super(info, host);
  }

  protected build(): void {
    this.sky('#98daf7', '#fff3d6', 50, 130);
    this.ground('#a9df76', 90, 90);
    this.view([0, 6.7, 13.8], [0, 1.7, 0], 39);
    this.model('ferris_wheel', undefined, [-7, 0, -5], -0.25, 0.55);
    this.model('park_gate', undefined, [6.6, 0, -4.5], 0.45, 0.65);
    this.model('balloon_stand', undefined, [6.2, 0, 3.5], -0.2, 0.9);
    this.scene.add(this.answerRoot);

    this.wheel.position.set(0, 2.05, -0.25);
    for (let i = 0; i < 10; i++) {
      const seg = pieSegment(i, 10, 2.15, COLORS[i % COLORS.length]);
      this.wheel.add(seg);
      const a = ((i + 0.5) / 10) * Math.PI * 2;
      const label = textPlate(String(i + 2), 0.58, { color: '#2b2233', bg: '#ffffff', border: '#ffd166', radius: 32, pad: 12 });
      label.position.set(Math.sin(a) * 1.33, Math.cos(a) * 1.33, 0.09);
      this.wheel.add(label);
    }
    this.wheel.add(torus(2.18, 0.11, '#ffffff', { seg: 8, ts: 54, cast: false }));
    this.wheel.add(torus(2.38, 0.12, '#ff9ec7', { seg: 8, ts: 54 }));
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      this.wheel.add(ball(0.08, i % 2 ? '#ffd166' : '#6cb8ff', { p: [Math.sin(a) * 2.46, Math.cos(a) * 2.46, 0.12], emissive: i % 2 ? '#ffd166' : '#6cb8ff', glow: 0.45, seg: 8, cast: false }));
    }
    this.wheel.add(ball(0.38, '#fff8ee', { p: [0, 0, 0.18], seg: 12, shiny: 70 }));
    this.wheel.add(cone(0.32, 0.5, '#ffd166', { p: [0, 0.18, 0.42], r: [90, 0, 0], seg: 5, shiny: 60 }));
    this.scene.add(this.wheel);

    this.pointer.add(cone(0.28, 0.75, '#2b2233', { p: [0, 4.62, 0], r: [180, 0, 0], seg: 3 }));
    this.pointer.add(ball(0.13, '#ffd166', { p: [0, 5.03, 0], seg: 8, emissive: '#ffd166', glow: 0.3 }));
    this.scene.add(this.pointer);

    this.scene.add(cyl(0.13, 0.18, 4.8, '#6cb8ff', { p: [-1.55, 2.25, -0.55], r: [0, 0, -22], seg: 8 }));
    this.scene.add(cyl(0.13, 0.18, 4.8, '#b197fc', { p: [1.55, 2.25, -0.55], r: [0, 0, 22], seg: 8 }));
    this.scene.add(rbox(4.7, 0.35, 1.8, 0.12, '#d8d0c2', { p: [0, 0.18, -0.55] }));
    for (let i = 0; i < 4; i++) this.scene.add(box(1.5 - i * 0.18, 0.13, 0.65, i % 2 ? '#ffffff' : '#ffe8a3', { p: [0, 0.42 + i * 0.12, 1.05 + i * 0.24] }));

    this.onPointer('tap', (e) => {
      const hit = this.pick(e.clientX, e.clientY, this.answerTargets);
      if (!hit || !this.activeRound) return;
      const ok = this.activeRound.submit(String(hit.userData.value)).correct;
      if (ok) this.fx.burst('star', hit.getWorldPosition(new THREE.Vector3()), { count: 18, spread: 1.1 });
      else this.shake(hit);
    });
  }

  private async spinWheel(): Promise<void> {
    sfx('whoosh');
    const start = this.wheel.rotation.z;
    const extra = Math.PI * 8 + Math.random() * Math.PI * 2;
    await this.tween(1.05, (k) => {
      this.wheel.rotation.z = start + extra * k;
      this.pointer.rotation.z = Math.sin(k * Math.PI * 28) * (1 - k) * 0.18;
    }, { ease: 'outCubic' });
    sfx('tick');
    const factor = 2 + (Math.floor((((-this.wheel.rotation.z % (Math.PI * 2)) + Math.PI * 2) / (Math.PI * 2)) * 10) % 10);
    this.ui.flash(`Bảng ${factor}!`, 'info', 900);
    await this.wait(0.25);
  }

  private makeAnswers(round: MiniRound): void {
    this.clearAnswers();
    const choices = round.q.choices;
    choices.forEach((c, i) => {
      const x = (i - (choices.length - 1) / 2) * 2.35;
      const color = COLORS[i % COLORS.length];
      const g = new THREE.Group();
      g.position.set(x, 1.15, 3.2);
      g.userData.value = c.value;
      g.add(cyl(0.02, 0.02, 1.0, '#ffffff', { p: [0, -0.55, 0], seg: 4, cast: false }));
      g.add(ball(0.72, color, { p: [0, 0.05, 0], s: [0.9, 1.15, 0.9], seg: 16, flat: false, shiny: 70 }));
      g.add(cone(0.14, 0.22, color, { p: [0, -0.62, 0], r: [180, 0, 0], seg: 8 }));
      const t = textPlate(c.label, 0.42, { color: '#2b2233', bg: '#ffffff', border: tint(color, -0.06), radius: 30, pad: 12 });
      t.position.set(0, 0.05, 0.66);
      g.add(t);
      this.answerRoot.add(g);
      this.answerTargets.push(g);
    });
  }

  private clearAnswers(): void {
    for (const a of [...this.answerRoot.children]) this.remove(a);
    this.answerTargets = [];
  }

  private shake(obj: THREE.Object3D): void {
    const x = obj.position.x;
    this.tween(0.35, (k) => {
      obj.position.x = x + Math.sin(k * Math.PI * 8) * 0.18 * (1 - k);
    }, { ease: 'linear' });
    this.fx.burst('dust', obj.getWorldPosition(new THREE.Vector3()), { count: 10, spread: 0.7 });
  }

  protected async play(): Promise<void> {
    while (this.more) {
      await this.spinWheel();
      const q = this.question(['mul', 'div']);
      if (q.context) q.prompt = `${q.context} ${q.prompt}`;
      q.context = 'Chạm bóng có đáp án đúng!';
      const round = this.ask(q, { prompt: q.prompt });
      this.activeRound = round;
      this.makeAnswers(round);
      await round.done;
      this.activeRound = null;
      this.fx.burst('confetti', [0, 3.2, 1.4], { count: 34, spread: 2 });
      await this.wait(0.35);
      this.clearAnswers();
      if (!(await this.nextRound(0.5))) break;
    }
  }
}

defineMini(
  {
    id: 'wheel',
    name: 'Vòng quay – nhân/chia',
    icon: '🎡',
    skill: 'Nhân / chia',
    topics: ['mul', 'div'],
    desc: 'Quay vòng quay may mắn, rồi chạm bóng có đáp án đúng.',
    rounds: 8,
    color: '#c77dff',
    unlock: 1,
  },
  (info, host) => new WheelGame(info, host),
);
