import * as THREE from 'three';
import '../../styles/games/clock.css';
import { sfx } from '../../core/audio';
import { ball, box, cone, cyl, rbox, torus } from '../../engine/kit';
import { PAL } from '../../engine/materials';
import { fitPlate, textPlate } from '../../engine/text';
import { fmtTime } from '../../math/gen/measure';
import type { MiniHost, MiniInfo, MiniRound } from '../base';
import { MiniGame } from '../base';
import { defineMini } from '../registry';

const CARD_COLORS = ['#ffd166', '#6cb8ff', '#ff9ec7', '#4ecdc4'];

class ClockGame extends MiniGame {
  private face = new THREE.Group();
  private hourHand = new THREE.Group();
  private minuteHand = new THREE.Group();
  private cuckoo = new THREE.Group();
  private targets: THREE.Object3D[] = [];
  private activeRound: MiniRound | null = null;
  private clockLabel: THREE.Object3D | null = null;
  private mode: 'choice' | 'set' = 'choice';
  private currentH = 3;
  private currentM = 0;
  private dragging: 'hour' | 'minute' | null = null;
  private submitButton: THREE.Object3D | null = null;

  constructor(info: MiniInfo, host: MiniHost) {
    super(info, host);
  }

  protected build(): void {
    this.sky('#7ec8ff', '#f8e9ff', 45, 120);
    this.ground('#c8e88c', 70, 70);
    this.view([0, 5.7, 11.2], [0, 1.75, 0], 39);
    this.model('castle_tower', undefined, [-5.7, 0, -4.5], 0.25, 0.38);
    this.model('decor_clock', undefined, [5.2, 0, -3.8], -0.4, 1.5);
    this.scene.add(rbox(7.0, 0.35, 4.2, 0.18, '#efe3c8', { p: [0, 0.18, -0.6] }));
    this.scene.add(rbox(5.7, 4.2, 0.35, 0.16, '#fff8ee', { p: [0, 2.1, -1.75] }));
    this.scene.add(cone(3.3, 1.4, '#b197fc', { p: [0, 4.85, -1.75], seg: 12 }));

    this.face.position.set(0, 1.95, 0);
    this.face.add(cyl(1.85, 1.85, 0.18, '#fff8ee', { r: [90, 0, 0], seg: 48, shiny: 30 }));
    this.face.add(torus(1.87, 0.08, '#ffd166', { r: [0, 0, 0], seg: 8, ts: 48 }));
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const t = textPlate(String(i), 0.28, { color: '#2b2233', bg: '#ffffff', radius: 20, pad: 4 });
      t.position.set(Math.sin(a) * 1.48, Math.cos(a) * 1.48, 0.16);
      this.face.add(t);
    }
    this.hourHand.add(rbox(0.16, 1.0, 0.08, 0.04, '#2b2233', { p: [0, 0.5, 0.27] }));
    this.minuteHand.add(rbox(0.1, 1.55, 0.07, 0.04, '#ff6b6b', { p: [0, 0.78, 0.34] }));
    this.face.add(this.hourHand, this.minuteHand, ball(0.16, '#ffd166', { p: [0, 0, 0.42], seg: 12, shiny: 60 }));
    this.scene.add(this.face);

    this.cuckoo = new THREE.Group();
    this.cuckoo.position.set(0, 3.35, 0.2);
    this.cuckoo.add(rbox(1.0, 0.55, 0.45, 0.08, '#c8915a', { p: [0, 0, 0] }));
    this.cuckoo.add(cone(0.68, 0.5, '#ff6b6b', { p: [0, 0.5, 0], seg: 4, r: [0, 45, 0] }));
    this.cuckoo.add(ball(0.22, '#6cb8ff', { p: [0, -0.08, 0.34], seg: 10, flat: false }));
    this.cuckoo.add(cone(0.08, 0.18, '#ffd166', { p: [0, -0.07, 0.55], r: [90, 0, 0], seg: 6 }));
    this.cuckoo.scale.setScalar(0.01);
    this.scene.add(this.cuckoo);

    this.onPointer('tap', (e) => {
      if (!this.activeRound) return;
      if (this.mode === 'choice') {
        const hit = this.pick(e.clientX, e.clientY, this.targets);
        if (!hit) return;
        const ok = this.activeRound.submit(String(hit.userData.value)).correct;
        if (ok) this.fx.burst('star', hit.getWorldPosition(new THREE.Vector3()), { count: 16, spread: 1 });
        else this.shake(hit);
      } else if (this.submitButton && this.pick(e.clientX, e.clientY, [this.submitButton])) {
        const value = this.isEn ? this.E.clockValue(this.currentH, this.currentM) : fmtTime(this.currentH, this.currentM);
        const ok = this.activeRound.submit(value).correct;
        if (!ok) this.shake(this.submitButton);
      }
    });
    this.onPointer('down', (e) => {
      if (this.mode !== 'set') return;
      const p = this.clockPoint(e);
      if (!p) return;
      const d = Math.hypot(p.x, p.y);
      if (d < 0.4 || d > 1.85) return;
      this.dragging = d < 1.2 ? 'hour' : 'minute';
      this.dragTo(e);
    });
    this.onPointer('move', (e) => this.dragTo(e));
    this.onPointer('up', () => (this.dragging = null));
  }

  private setClock(h: number, m: number): void {
    this.currentH = ((h - 1 + 12) % 12) + 1;
    this.currentM = ((m % 60) + 60) % 60;
    const minuteAngle = (this.currentM / 60) * Math.PI * 2;
    const hourAngle = (((this.currentH % 12) + this.currentM / 60) / 12) * Math.PI * 2;
    this.minuteHand.rotation.z = -minuteAngle;
    this.hourHand.rotation.z = -hourAngle;
  }

  private clockPoint(e: PointerEvent): THREE.Vector3 | null {
    const p = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = this.ray(e.clientX, e.clientY).ray.intersectPlane(plane, p);
    if (!hit) return null;
    return p.sub(this.face.position);
  }

  private dragTo(e: PointerEvent): void {
    if (!this.dragging) return;
    const p = this.clockPoint(e);
    if (!p) return;
    const angle = Math.atan2(p.x, p.y);
    if (this.dragging === 'minute') {
      const m = Math.round((((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 12) * 5;
      this.setClock(this.currentH, m % 60);
    } else {
      const h = Math.round((((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 12) || 12;
      this.setClock(h, this.currentM);
    }
    sfx('tick');
  }

  private setHandsVisible(visible: boolean): void {
    this.hourHand.visible = visible;
    this.minuteHand.visible = visible;
  }

  private visualTimeFrom(q: MiniRound['q']): [number, number] | null {
    if (q.visual?.kind === 'clock') return [q.visual.h, q.visual.m];
    const duration = q.prompt.match(/^(\d+) giờ(?: (\d+) phút)? = \? phút$/);
    if (duration) return [Number(duration[1]), Number(duration[2] ?? 0)];
    return null;
  }

  private makeChoiceCards(round: MiniRound): void {
    this.clearTargets();
    round.q.choices.forEach((c, i) => {
      const x = (i - (round.q.choices.length - 1) / 2) * 1.9;
      const g = new THREE.Group();
      g.position.set(x, 0.95, 3.1);
      g.userData.value = c.value;
      g.add(rbox(1.7, 0.85, 0.18, 0.16, CARD_COLORS[i % CARD_COLORS.length], { shiny: 45 }));
      const o = { color: '#2b2233', bg: '#ffffff', border: CARD_COLORS[i % CARD_COLORS.length], radius: 24, pad: 8 };
      const t = this.isEn ? fitPlate(c.label, 1.55, 0.5, o) : textPlate(c.label, 0.32, o);
      t.position.set(0, 0, 0.12);
      g.add(t);
      this.scene.add(g);
      this.targets.push(g);
    });
  }

  private setClockLabel(text: string | null): void {
    if (this.clockLabel) this.remove(this.clockLabel);
    this.clockLabel = null;
    if (!text) return;
    const label = textPlate(text, 0.34, { color: '#195b4a', bg: '#fff8ee', border: '#7bd389', radius: 24, pad: 8 });
    label.position.set(0, -2.2, 0.2);
    this.face.add(label);
    this.clockLabel = label;
  }

  private makeSubmit(): void {
    this.clearTargets();
    const g = new THREE.Group();
    g.position.set(0, 0.85, 3.3);
    g.add(rbox(2.2, 0.85, 0.18, 0.18, '#7bd389', { shiny: 50 }));
    const t = textPlate('XONG!', 0.42, { color: '#195b4a', bg: '#ffffff', border: '#7bd389', radius: 28, pad: 8 });
    t.position.set(0, 0, 0.12);
    g.add(t);
    this.scene.add(g);
    this.submitButton = g;
  }

  private setQuestion(): MiniRound['q'] {
    const h = 1 + Math.floor(Math.random() * 12);
    const minutePool = this.grade === 1 ? [0] : this.grade === 2 ? [0, 30, 15, 45] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const m = minutePool[Math.floor(Math.random() * minutePool.length)];
    const ans = fmtTime(h, m);
    const wrong1 = fmtTime((h % 12) + 1, m);
    const wrong2 = fmtTime(h, (m + 15) % 60);
    const wrong3 = fmtTime(((h + 10) % 12) + 1, m);
    return this.makeQuestion({
      topic: 'time',
      prompt: `Kéo kim để chỉ ${ans}`,
      answer: ans,
      choices: [ans, wrong1, wrong2, wrong3],
      hint: 'Kim dài chỉ phút. Kim ngắn chỉ giờ.',
      steps: [`Đặt kim ngắn vào khoảng số ${h}.`, `Đặt kim dài vào ${m === 0 ? 'số 12' : `${m} phút`}.`, `Đồng hồ chỉ ${ans}.`],
      speech: `Kéo kim đồng hồ để chỉ ${ans}.`,
    });
  }

  private async popCuckoo(): Promise<void> {
    await this.tween(0.22, (k) => this.cuckoo.scale.setScalar(k), { ease: 'outBack' });
    this.fx.burst('heart', this.cuckoo.getWorldPosition(new THREE.Vector3()), { count: 12, spread: 0.8 });
    await this.wait(0.45);
    await this.tween(0.18, (k) => this.cuckoo.scale.setScalar(1 - k), { ease: 'inCubic' });
  }

  private clearTargets(): void {
    for (const t of this.targets) this.remove(t);
    this.targets = [];
    if (this.submitButton) {
      this.remove(this.submitButton);
      this.submitButton = null;
    }
  }

  private shake(obj: THREE.Object3D): void {
    const x = obj.position.x;
    this.tween(0.35, (k) => (obj.position.x = x + Math.sin(k * Math.PI * 8) * 0.14 * (1 - k)), { ease: 'linear' });
    this.fx.burst('dust', obj.getWorldPosition(new THREE.Vector3()), { count: 8, spread: 0.6 });
  }

  /** Lượt Tiếng Anh: vòng chẵn nhìn đồng hồ chọn câu «half past seven», vòng lẻ đọc câu rồi kéo kim. */
  private async playEn(): Promise<void> {
    const set = this.round % 2 === 1;
    const r = this.enMake('en_time', (E, o, L) => E.clockRound(o, L, set ? 'set' : 'read'));
    if (r && set) {
      this.mode = 'set';
      this.setHandsVisible(true);
      this.setClock(r.h === 12 && r.m === 0 ? 3 : 12, 0);
      this.setClockLabel(null);
      const round = this.ask(r.q, { prompt: r.q.prompt });
      this.activeRound = round;
      this.makeSubmit();
      await round.done;
      return;
    }
    this.mode = 'choice';
    const q = r?.q ?? this.enQ({ short: true }, ['en_time']);
    const shown = this.visualTimeFrom(q);
    this.setHandsVisible(!!shown);
    if (shown) this.setClock(shown[0], shown[1]);
    this.setClockLabel(null);
    const round = this.ask(q, { prompt: q.prompt, visual: !shown });
    this.activeRound = round;
    this.makeChoiceCards(round);
    await round.done;
  }

  protected async play(): Promise<void> {
    while (this.more) {
      if (this.isEn) {
        await this.playEn();
      } else if (this.round % 2 === 0) {
        this.mode = 'choice';
        const q = this.question('time');
        const shown = this.visualTimeFrom(q);
        if (shown) {
          this.setHandsVisible(true);
          this.setClock(shown[0], shown[1]);
        } else {
          this.setHandsVisible(false);
        }
        this.setClockLabel(q.context && q.visual?.kind === 'clock' ? 'Bắt đầu' : null);
        const round = this.ask(q, { prompt: q.prompt });
        this.activeRound = round;
        this.makeChoiceCards(round);
        await round.done;
      } else {
        this.mode = 'set';
        const q = this.setQuestion();
        this.setHandsVisible(true);
        this.setClock(12, 0);
        this.setClockLabel(null);
        const round = this.ask(q, { prompt: q.prompt });
        this.activeRound = round;
        this.makeSubmit();
        await round.done;
      }
      this.activeRound = null;
      await this.popCuckoo();
      this.clearTargets();
      if (!(await this.nextRound())) break;
    }
  }
}

defineMini(
  {
    id: 'clock',
    name: 'Đồng hồ bí ẩn',
    icon: '🕐',
    skill: 'Thời gian',
    topics: ['time'],
    desc: 'Đọc giờ, rồi kéo kim đồng hồ đến thời gian đúng.',
    rounds: 8,
    color: '#ffc94d',
    unlock: 3,
    en: {
      name: 'Đồng hồ tiếng Anh',
      skill: 'Giờ bằng tiếng Anh',
      desc: 'Nhìn đồng hồ chọn câu đọc giờ đúng, rồi nghe câu tiếng Anh và kéo kim cho đúng giờ.',
    },
    both: 'Đồng hồ',
    enTopics: ['en_time'],
  },
  (info, host) => new ClockGame(info, host),
);
