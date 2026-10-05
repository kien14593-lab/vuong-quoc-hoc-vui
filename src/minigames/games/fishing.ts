import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { ball, box, capsule, cone, cyl, disc, rbox, torus, tube } from '../../engine/kit';
import { PAL, tint } from '../../engine/materials';
import { fitPlate, textPlate } from '../../engine/text';
import { fmt, fracStr } from '../../math/util';
import type { Question } from '../../math/types';
import { MiniGame, type MiniHost, type MiniInfo, type MiniRound } from '../base';
import { defineMini } from '../registry';

type FishTarget = THREE.Group & { userData: { value: string; rank: number; ok?: boolean; baseX: number; baseZ: number } };
const ss = { flat: false } as const;

type FishValue = { label: string; rank: number; value?: string };

function answerPlate(value: string, color = '#6cc4f0', fit = false): THREE.Mesh {
  const o = { bg: '#fff8ee', border: color, color: '#4b3d68', size: 132, pad: 48, radius: 92, weight: 900, doubleSided: true };
  return fit ? fitPlate(value, 1.55, 0.9, o) : textPlate(value, 0.9, o);
}

class FishingGame extends MiniGame {
  private fish: FishTarget[] = [];
  private bobber = new THREE.Group();
  private rodTip = new THREE.Vector3(-3.9, 1.45, 1.2);
  private bucket!: THREE.Group;
  private fisher!: THREE.Group;
  private reelBusy = false;

  constructor(info: MiniInfo, host: MiniHost) {
    super(info, host);
  }

  protected build(): void {
    this.sky('#8fd8ff', '#e9f8ff', 35, 95);
    this.ground('#9bd66e', 80, 80);
    // Tiếng Anh: thẻ đề bài (hình + nghĩa) cao hơn → nhìn cao hơn, hồ thấp xuống để nhãn con cá xa không bị che.
    if (this.isEn) this.view([0, 6.0, 7.1], [0, 1.6, -0.2], 35);
    else this.view([0, 5.25, 7.1], [0, 0.72, -0.2], 35);
    this.scene.add(disc(4.4, '#7ed8e8', { p: [0, 0.012, 0], seg: 48 }));
    this.scene.add(torus(4.1, 0.16, '#cdeca0', { p: [0, 0.03, 0], r: [90, 0, 0], ts: 64, seg: 8 }));
    this.scene.add(rbox(2.7, 0.22, 1.25, 0.08, PAL.wood, { p: [-3.6, 0.14, 1.0], base: true }));
    for (let i = 0; i < 5; i++) this.scene.add(box(0.12, 0.08, 1.34, tint(PAL.wood, i % 2 ? -0.08 : 0.04), { p: [-4.7 + i * 0.52, 0.32, 1.0] }));
    for (const x of [-4.75, -2.55]) for (const z of [0.35, 1.65]) this.scene.add(cyl(0.07, 0.09, 0.6, PAL.woodDark, { p: [x, 0.3, z], seg: 8 }));
    this.fisher = this.model('player', undefined, [-4.0, 0.35, 0.9], -0.55, 0.72);
    const st = this.anim(this.fisher);
    if (st) st.ride = true;
    this.scene.add(tube([[-3.75, 1.1, 1.08], [-3.05, 1.7, 0.35], [-2.2, 1.35, -0.1]], 0.018, '#8a5a3b', { radial: 6 }));
    this.bobber.add(ball(0.08, '#ff6b6b', { seg: 10 }), ball(0.045, '#ffffff', { p: [0, 0.045, 0], seg: 8 }));
    this.bobber.visible = false;
    this.scene.add(this.bobber);
    this.bucket = this.model('crate', undefined, [-2.4, 0.06, 1.55], 0.2, 0.45);
    this.bucket.name = 'fish_bucket';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 3.4 + (i % 3) * 0.22;
      this.scene.add(capsule(0.035, 0.55, i % 2 ? '#7abf5a' : '#6aa34b', { p: [Math.cos(a) * r, 0.32, Math.sin(a) * r], r: [10, 0, Math.sin(a) * 18], seg: 7 }));
    }
    for (const p of [[1.8, 0, 1.4], [2.5, 0, -1.6], [-0.5, 0, -2.3]] as [number, number, number][]) {
      this.scene.add(disc(0.42, '#76c56a', { p: [p[0], 0.035, p[2]], seg: 16 }));
      this.scene.add(ball(0.09, '#ff9ec7', { p: [p[0] + 0.12, 0.08, p[2] + 0.05], s: [1, 0.35, 1], seg: 8 }));
    }
    this.onPointer('tap', (e) => void this.tapFish(e));
  }

  protected tick(_dt: number, t: number): void {
    for (let i = 0; i < this.fish.length; i++) {
      const f = this.fish[i];
      if (!f.parent) continue;
      const x = f.userData.baseX + Math.sin(t * 0.7 + i) * 0.16;
      const z = f.userData.baseZ + Math.cos(t * 0.55 + i * 2) * 0.12;
      const nx = x / 2.55;
      const nz = z / 1.45;
      const d = Math.max(1, Math.sqrt(nx * nx + nz * nz));
      f.position.x = x / d;
      f.position.z = z / d;
      f.rotation.y = Math.sin(t * 0.9 + i) * 0.25;
    }
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearFish();
      const { q, values, accept } = this.makeFishingQuestion();
      this.spawnFish(values, accept);
      const round = this.ask(q, { buttons: false, visual: true });
      await round.done;
      await this.successCatch();
      if (!(await this.nextRound())) break;
    }
  }

  private makeFishingQuestion(): { q: Question; values: FishValue[]; accept: string[] } {
    if (this.isEn) {
      const q = this.enQ({ short: true });
      const values = q.choices.slice(0, 4).map((c, i) => ({ label: c.label, value: c.value, rank: i }));
      return { q, values, accept: q.accept?.length ? q.accept : [q.answer] };
    }
    const grade = this.grade;
    let values: { label: string; rank: number }[] = [];
    if (grade <= 2) {
      const base = 4 + this.round * 2;
      values = [base, base + 2, base - 1, base + 4].map((n) => ({ label: fmt(n), rank: n }));
    } else if (grade === 3) {
      const base = 80 + this.round * 9;
      values = [base, base + 15, base - 12, base + 7].map((n) => ({ label: fmt(n), rank: n }));
    } else if (grade === 4) {
      values = [1.25, 1.5, 1.75, 2.05].map((n) => ({ label: fmt(n + this.round / 10), rank: n + this.round / 10 }));
    } else {
      const fr = [
        [1, 2],
        [2, 3],
        [3, 4],
        [5, 6],
      ] as const;
      values = fr.map(([n, d]) => ({ label: fracStr(n, d), rank: n / d }));
    }
    const mode = this.round % 3;
    let prompt = '';
    let accept: string[] = [];
    if (mode === 0) {
      const sorted = [...values].sort((a, b) => a.rank - b.rank);
      const threshold = sorted[1].rank;
      const thLabel = sorted[1].label;
      prompt = `Câu cá có số lớn hơn ${thLabel}`;
      accept = values.filter((v) => v.rank > threshold).map((v) => v.label);
    } else if (mode === 1) {
      const min = values.reduce((a, b) => (a.rank < b.rank ? a : b));
      prompt = 'Câu cá mang số bé nhất';
      accept = [min.label];
    } else {
      const max = values.reduce((a, b) => (a.rank > b.rank ? a : b));
      prompt = 'Câu cá mang số lớn nhất';
      accept = [max.label];
    }
    const q = this.makeQuestion({
      topic: 'compare',
      prompt,
      answer: accept[0],
      accept,
      choices: values.map((v) => v.label),
      hint: 'Nhìn các số trên lưng cá rồi so sánh từ bé đến lớn.',
      steps: ['Đọc từng số trên cá.', 'Tìm số thỏa yêu cầu.', 'Chạm đúng con cá đó để câu lên.'],
      context: 'Hồ cá số',
    });
    return { q, values, accept };
  }

  private spawnFish(values: FishValue[], accept: string[]): void {
    const spots: [number, number][] = this.isEn
      ? [
          [-2.15, 0.35],
          [-0.75, -0.25],
          [1.95, 0.05],
          [0.55, 1.1],
        ]
      : [
          [-2.05, 0.15],
          [-0.45, -0.65],
          [1.9, -0.15],
          [0.9, 1.25],
        ];
    values.forEach((v, i) => {
      const g = new THREE.Group() as FishTarget;
      this.model('critter_fish', { color: ['#ffa94d', '#4dabf7', '#ffd166', '#ff8fab'][i] }, [0, 0, 0], Math.PI * (i % 2 ? 0.9 : 0.1), 2.0, g);
      const badge = answerPlate(v.label, undefined, this.isEn);
      badge.position.set(0, 1.5, 0.22);
      badge.rotation.x = -0.15;
      g.add(badge, ball(1.05, '#ffffff', { ...ss, p: [0, 0.85, 0], opacity: 0.001, cast: false }));
      g.position.set(spots[i][0], 0.08, spots[i][1]);
      g.userData.value = v.value ?? v.label;
      g.userData.rank = v.rank;
      g.userData.ok = accept.includes(g.userData.value);
      g.userData.baseX = spots[i][0];
      g.userData.baseZ = spots[i][1];
      this.scene.add(g);
      this.fish.push(g);
    });
  }

  private async tapFish(e: PointerEvent): Promise<void> {
    if (this.reelBusy || !this.current) return;
    const f = this.pick(e.clientX, e.clientY, this.fish);
    if (!f) return;
    this.reelBusy = true;
    const target = f.position.clone().add(new THREE.Vector3(0, 0.45, 0));
    await this.castLine(target);
    const result = this.current.submit(f.userData.value);
    if (result.correct) {
      sfx('splash');
      this.fx.burst('splash', target.toArray() as [number, number, number], { count: 18, spread: 0.8 });
      await this.reelFish(f);
    } else {
      sfx('wrong');
      this.fx.burst('splash', target.toArray() as [number, number, number], { count: 14, spread: 0.7 });
      const x0 = f.position.x;
      this.tween(0.45, (k) => {
        f.position.x = x0 + Math.sin(k * Math.PI * 6) * 0.2 * (1 - k);
        f.rotation.z = Math.sin(k * Math.PI * 8) * 0.4;
      });
      await this.wait(0.45);
      f.rotation.z = 0;
    }
    this.bobber.visible = false;
    this.reelBusy = false;
  }

  private async castLine(target: THREE.Vector3): Promise<void> {
    this.bobber.visible = true;
    const start = this.rodTip.clone();
    this.tween(0.5, (k) => {
      const h = Math.sin(k * Math.PI) * 1.1;
      this.bobber.position.lerpVectors(start, target, k);
      this.bobber.position.y += h;
    }, { ease: 'outCubic' });
    sfx('whoosh');
    await this.wait(0.5);
  }

  private async reelFish(f: FishTarget): Promise<void> {
    const start = f.position.clone();
    const end = this.bucket.position.clone().add(new THREE.Vector3(0, 0.7, 0));
    this.tween(0.7, (k) => {
      f.position.lerpVectors(start, end, k);
      f.position.y += Math.sin(k * Math.PI) * 1.0;
      f.rotation.z = k * Math.PI * 2;
    }, { ease: 'inOutCubic' });
    await this.wait(0.72);
    this.remove(f);
    this.fish = this.fish.filter((x) => x !== f);
  }

  private async successCatch(): Promise<void> {
    const good = this.fish.find((f) => f.userData.ok);
    if (good?.parent) await this.reelFish(good);
    this.fx.burst('star', this.bucket.position.clone().add(new THREE.Vector3(0, 1, 0)).toArray() as [number, number, number], { count: 24, spread: 1 });
    const st = this.anim(this.fisher);
    if (st) st.happy = 1;
    await this.wait(0.45);
    if (st) st.happy = 0;
  }

  private clearFish(): void {
    for (const f of this.fish) if (f.parent) this.remove(f);
    this.fish = [];
  }
}

defineMini(
  {
    id: 'fishing',
    name: '🎣 Câu cá số – so sánh',
    icon: '🎣',
    skill: 'So sánh số',
    topics: ['compare'],
    desc: 'Chạm con cá mang số đúng. Câu lên thật khéo và thả vào xô nhé!',
    rounds: 8,
    color: '#6cc4f0',
    unlock: 2,
    en: {
      name: 'Câu cá chữ',
      skill: 'Từ vựng, chữ cái',
      desc: 'Chạm con cá mang từ hoặc chữ cái đúng. Câu lên thật khéo và thả vào xô nhé!',
    },
    both: 'Câu cá',
    enTopics: ['en_vocab', 'en_phonics', 'en_spell'],
  },
  (info, host) => new FishingGame(info, host),
);
