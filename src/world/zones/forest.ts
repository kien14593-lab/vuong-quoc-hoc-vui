import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { isCollected, setFlag } from '../../core/state';
import { ball, box, cone, cyl, dodeca, group, rbox, tube } from '../../engine/kit';
import { mat, PAL } from '../../engine/materials';
import { CAST } from '../../game/cast';
import { on, reward, zoneLock } from '../../game/story';
import { mixedQ, siteSubject, storyQ } from '../../game/subject';
import { deerTip, siteText, st } from '../../game/subject-text';
import type { Question } from '../../math/types';
import { say } from '../../ui/dialog';
import { toast } from '../../ui/toast';
import { Zone, type Npc, type PickSpot, type Spawn } from '../zone';

const BRIDGE_Z = 12.4;
const ROCK_Z = 3.0;
const LOCK_Z = -6.0;
const STONE_Z = -18.4;
const FOREST_FLAGS = ['forest.bridge', 'forest.rock', 'forest.bearBridge', 'forest.stones'] as const;
const WOOD = PAL.wood;
const WOOD_DARK = PAL.woodDark;

type LockBridge = {
  root: THREE.Group;
  planks: THREE.Object3D[];
  deck: THREE.Object3D;
  lock: THREE.Object3D;
  chain: THREE.Object3D;
};

/** 🌳 RỪNG THÔNG THÁI – nơi Bác Cú sống: cây cầu của Bác Cú, đá chắn đường và hành trình của Chú Gấu. */
export class ForestZone extends Zone {
  private owl!: Npc;
  private squirrel!: Npc;
  private drawBridge!: THREE.Object3D;
  private drawDeck: THREE.Object3D | null = null;
  private rock: THREE.Object3D | null = null;
  private lockBridge!: LockBridge;
  private stoneQuestion!: Question;
  private choiceStones: THREE.Object3D[] = [];
  private riseStones: THREE.Object3D[] = [];
  private stonesStarted = false;

  constructor(spawn: Spawn) {
    super(
      {
        id: 'forest',
        title: 'Rừng Thông Thái',
        icon: '🌳',
        sub: st('sub.forest'),
        music: 'forest',
        area: { hw: 24, hd: 32, r: 10 },
        margin: 18,
        ground: '#8fcf67',
        sky: ['#99d9ff', '#e8f8dd'],
        fog: [50, 112],
        mood: { sky: '#dff9cf', ground: '#4b7655', sun: '#fff3c4', hemi: 1.65, shadow: 0.55 },
        cam: { yaw: 0, pitch: 54, dist: 18, minDist: 11, maxDist: 30 },
        seed: 22,
        spawns: {
          start: { x: 0, z: 28.5, rot: 180 },
          from_village: { x: 0, z: 28.5, rot: 180 },
          from_maze: { x: 0, z: -28.5, rot: 0 },
        },
      },
      spawn,
    );
  }

  protected build(): void {
    // "Cả hai": chọn môn cho các thử thách chưa qua ngay khi dựng, để biển báo và lời thoại khớp với câu hỏi.
    for (const site of FOREST_FLAGS) if (!on(site)) siteSubject(site);
    this.stoneQuestion = storyQ('bearStones', { site: 'forest.stones' });
    this.buildTerrain();
    this.buildStoryBeats();
    this.buildSideContent();
    this.buildForestLife();

    this.portal(0, 30.6, 'village', 'from_forest', { label: 'Ngôi Làng', r: 1.6 });
    this.portal(0, -30.6, 'maze', 'from_forest', { label: 'Mê Cung Kỳ Bí', lock: () => zoneLock('maze'), r: 1.6 });
  }

  protected onEnter(first: boolean): void {
    if (first && !on('forest.bridge')) {
      this.bubble(this.owl.actor.root, 'Chào mừng đến Rừng Thông Thái!', this.owl.actor.height + 0.7, 3600);
      toast('Đi theo đường tới Bác Cú để mở cầu nhé!', { icon: '🌉', tone: 'good', ms: 3600 });
    }
  }

  override objective(): { text: string; icon?: string } | null {
    if (!on('forest.bridge')) return { text: siteText('bridge.obj', 'forest.bridge'), icon: '🌉' };
    if (!on('forest.rock')) return { text: 'Dọn tảng đá chặn đường', icon: '⛏️' };
    if (!on('forest.bearBridge')) return { text: 'Mở cây cầu bị khóa cho Chú Gấu', icon: '🔒' };
    if (!on('forest.stones')) return { text: siteText('stones.obj', 'forest.stones'), icon: '👣' };
    return { text: 'Đi tiếp tới Mê Cung Kỳ Bí', icon: '🌀' };
  }

  protected override async buddyTalk(): Promise<void> {
    if (!on('forest.bridge')) return say(CAST.gau, 'Mình thấy cây cầu phía trước. Hãy hỏi Bác Cú nhé!');
    if (!on('forest.rock')) return say(CAST.gau, siteText('rock.buddy', 'forest.rock'));
    if (!on('forest.bearBridge')) return say(CAST.gau, siteText('bearBridge.buddy', 'forest.bearBridge'));
    if (!on('forest.stones')) return say(CAST.gau, siteText('stones.buddy', 'forest.stones'));
    return say(CAST.gau, 'Tuyệt vời! Đường tới mê cung đã mở rồi.');
  }

  private buildTerrain(): void {
    const t = this.terrain;
    t.path([[0, 34], [0, 24], [0, 17], [0, 8], [0, 2], [0, -3], [0, -11], [0, -15], [0, -23], [0, -34]], 2.8);
    t.path([[-0.4, 16], [-5.5, 15.5], [-9.8, 12.8], [-12.4, 9.3]], 1.6, { kind: 'stone' });
    t.path([[0, -11.5], [-6.4, -12.2], [-10.8, -14.8]], 1.8, { kind: 'dirt' });
    t.path([[0.8, -12.5], [6.5, -12.6], [10.6, -13.6]], 1.8, { kind: 'dirt' });
    t.river([[-34, BRIDGE_Z + 0.3], [-11, BRIDGE_Z - 0.2], [0, BRIDGE_Z], [12, BRIDGE_Z + 0.1], [34, BRIDGE_Z - 0.4]], 4.4);
    t.river([[-34, LOCK_Z - 0.2], [-10, LOCK_Z + 0.1], [0, LOCK_Z], [12, LOCK_Z - 0.2], [34, LOCK_Z + 0.2]], 3.8);
    t.river([[-34, STONE_Z], [-10, STONE_Z - 0.3], [0, STONE_Z], [12, STONE_Z + 0.25], [34, STONE_Z - 0.1]], 4.6);
    t.pond(11.5, -14.2, 4.2, 2.9);
    t.patch(-10.5, -14.0, 4.2, '#7ec362', 0.65);
    t.meadow(-8, 6.5, 4.4, ['#ffffff', '#ffd6e7', '#d2f6a8'], 3);
    t.meadow(9, -23, 3.5, ['#fff3a6', '#ffcad4', '#bde0fe'], 3);

    if (on('forest.bridge')) this.openDrawBridgeTerrain();
    if (on('forest.bearBridge')) this.openLockBridgeTerrain();
    if (on('forest.stones')) this.openStoneTerrain();
    else this.openChoiceStoneTerrain();
    if (!on('forest.rock')) this.block((x, z) => Math.abs(x) < 5.2 && Math.abs(z - ROCK_Z) < 1.45);
  }

  private buildStoryBeats(): void {
    this.buildDrawBridge();
    this.buildRock();
    this.buildLockedBridge();
    this.buildStoneCrossing();

    this.owl = this.npc(CAST.cu.art, -3.7, BRIDGE_Z + 3.4, {
      name: CAST.cu.name,
      color: CAST.cu.color,
      rot: 120,
      r: 2.7,
      mark: () => (!on('forest.bridge') ? '!' : ''),
      talk: () => this.solveBridge(),
    });
    this.sign(2.8, BRIDGE_Z + 4.8, siteText('bridge.sign', 'forest.bridge'), { y: 2.3 });
    this.interact({
      id: 'forest:bridge',
      x: 0,
      z: BRIDGE_Z + 3.3,
      r: 3.3,
      label: siteText('bridge.label', 'forest.bridge'),
      icon: '🌉',
      obj: this.drawBridge,
      enabled: () => !on('forest.bridge'),
      run: () => this.solveBridge(),
    });

    this.interact({
      id: 'forest:rock',
      x: 0,
      z: ROCK_Z + 2.0,
      r: 3.4,
      label: siteText('rock.label', 'forest.rock'),
      icon: '⛏️',
      obj: this.rock ?? undefined,
      enabled: () => on('forest.bridge') && !on('forest.rock'),
      run: () => this.solveRock(),
    });
    this.sign(-2.9, ROCK_Z + 1.6, '🚧 Tảng đá chặn đường', { y: 2.1 });

    this.interact({
      id: 'forest:bearBridge',
      x: 0,
      z: LOCK_Z + 2.4,
      r: 3.4,
      label: 'Mở khóa cầu',
      icon: '🔒',
      obj: this.lockBridge.root,
      enabled: () => on('forest.rock') && !on('forest.bearBridge'),
      run: () => this.solveBearBridge(),
    });
    this.sign(2.9, LOCK_Z + 1.8, '🔒 Cây cầu bị khóa', { y: 2.2 });

    this.interact({
      id: 'forest:stones:start',
      x: 0,
      z: STONE_Z + 3.2,
      r: 2.2,
      label: siteText('stones.label', 'forest.stones'),
      icon: '👣',
      enabled: () => on('forest.bearBridge') && !on('forest.stones') && !this.stonesStarted,
      auto: true,
      run: () => this.startStonePick(),
    });
    this.sign(-3.2, STONE_Z + 3.1, siteText('stones.sign', 'forest.stones'), { y: 2.0 });

    this.place('gate_arch', 0, -28.2, { opts: { text: 'Mê Cung', color: '#b197fc', w: 4.4 }, rot: 180 });
  }

  private buildDrawBridge(): void {
    this.drawBridge = this.place('bridge_draw', 0, BRIDGE_Z, { opts: { raised: !on('forest.bridge') }, dynamic: true, reserve: 5.2, collide: false });
    this.drawDeck = this.drawBridge.getObjectByName('deck') ?? null;
  }

  private buildRock(): void {
    if (on('forest.rock')) {
      this.place('rock', -1.2, ROCK_Z, { collide: false, scale: 0.9 });
      this.place('rock', 1.15, ROCK_Z - 0.25, { collide: false, scale: 0.8 });
      return;
    }
    this.rock = this.place('boulder', 0, ROCK_Z, { dynamic: true, reserve: 2.2 });
  }

  private buildLockedBridge(): void {
    this.lockBridge = this.makeLockBridge(on('forest.bearBridge'));
    this.dynamics.add(this.lockBridge.root);
  }

  private buildStoneCrossing(): void {
    const xs = [-1.75, 0, 1.75];
    const choices = this.stoneQuestion.choices.slice(0, 3);
    choices.forEach((c, i) => {
      const stone = this.place('number_stone', xs[i], STONE_Z + 1.55, {
        opts: { n: c.label, color: i === 0 ? '#74c0fc' : i === 1 ? '#ffd166' : '#7bd389' },
        dynamic: true,
        reserve: 0.6,
        collide: false,
      });
      this.choiceStones.push(stone);
    });
    const rest: [number, number, string][] = [
      [-1.05, STONE_Z + 0.25, '#b197fc'],
      [1.0, STONE_Z - 1.05, '#4ecdc4'],
      [-0.65, STONE_Z - 2.2, '#ffd166'],
      [0.95, STONE_Z - 3.2, '#74c0fc'],
    ];
    rest.forEach(([x, z, color], i) => {
      const st = this.place('number_stone', x, z, { opts: { n: '✓', color }, dynamic: true, reserve: 0.45, collide: false, scale: 0.75 });
      if (!on('forest.stones')) st.position.y = -0.85 - i * 0.08;
      this.riseStones.push(st);
    });
  }

  private buildSideContent(): void {
    this.squirrel = this.npc(CAST.soc.art, -10.2, -13.3, {
      name: CAST.soc.name,
      color: CAST.soc.color,
      rot: 65,
      wander: 1.6,
      mark: () => '?',
      talk: async (npc) => {
        await say(CAST.soc, 'Mình có một câu đố hạt dẻ. Bạn thử nhé!');
        await this.quiz(mixedQ(), { src: 'forest:squirrel', speaker: CAST.soc, title: 'Câu đố của Cô Sóc', icon: '🌰' }, npc.actor.root, 10);
        npc.actor.celebrate(1.2);
      },
    });
    this.npc(CAST.nai.art, 7.6, 4.8, {
      name: CAST.nai.name,
      color: CAST.nai.color,
      rot: -70,
      wander: 2.2,
      talk: async () => say(CAST.nai, deerTip()),
    });
    this.npc(CAST.rua.art, 10.8, -10.3, {
      name: CAST.rua.name,
      color: CAST.rua.color,
      rot: 190,
      // Mai rùa sâu ≈1.4 m, đầu to: đẩy bé ra xa hơn vật cản 0.52 của mô hình để mặt và mai không lẹm vào bé.
      radius: 0.7,
      talk: async (npc) => {
        await say(CAST.rua, 'Chậm mà chắc! Ông có một câu hỏi rừng xanh cho cháu.');
        await this.quiz(mixedQ(), { src: 'forest:turtle', speaker: CAST.rua, title: 'Câu hỏi bên hồ', icon: '🐢' }, npc.actor.root, 10);
      },
    });
    this.miniSpot('fishing', 13.5, -14.0, { model: 'fish_bucket', rot: -20, r: 2.8 });
    this.miniSpot('runner', -12.5, -16.1, { model: 'signpost', rot: 35, opts: { labels: ['Chạy', 'Rừng'] }, r: 2.8 });
    this.place('tent_camp', -9.0, -4.6, { rot: 28 });
    this.place('bench', -6.4, -2.2, { rot: 110 });
    this.place('log', -8.5, -1.4, { rot: 70 });
    this.place('stump', -11.4, -3.0, { rot: 20 });
    this.place('signpost', 2.7, 24.0, { rot: -15, opts: { labels: ['Cầu', 'Đá', 'Mê cung'] } });
    this.place('signpost', -2.5, -23.7, { rot: 20, opts: { labels: ['Mê cung', 'Làng'] } });
    this.pickup('star', -14.2, 7.2, { id: 'forest.star.1', onPick: () => this.hiddenStar('1') });
    this.pickup('star', 13.7, -23.3, { id: 'forest.star.2', onPick: () => this.hiddenStar('2') });
  }

  private buildForestLife(): void {
    for (const [x, z, k, r, s] of [
      [-6, 20, 'tree_round', 20, 1.15],
      [6, 18.5, 'tree_blossom', -15, 1.05],
      [-12.5, 10, 'tree_tall', 35, 1.2],
      [13.5, 8.3, 'tree_apple', -20, 1.1],
      [-14.5, -8.5, 'tree_autumn', 10, 1.08],
      [15.2, -3, 'tree_round', -40, 1.12],
      [-8.5, -24, 'tree_blossom', 20, 1.08],
      [8.2, -25, 'tree_pine', -20, 1.2],
    ] as [number, number, string, number, number][]) this.place(k, x, z, { rot: r, scale: s });
    this.buildTreeWalls();
    this.scatter(['tree_round', 'tree_pine', 'tree_tall', 'tree_blossom', 'tree_autumn', 'bush'], 78, { gap: 2.45, pathGap: 1.75, scale: [0.85, 1.28], collide: false });
    this.scatter(['bush', 'bush', 'rock', 'rock_big', 'stump', 'log'], 46, { gap: 1.8, pathGap: 1.15, scale: [0.72, 1.12], collide: false });
    this.scatter(['flower', 'tulip', 'grass', 'grass', 'mushroom', 'mushroom'], 190, { gap: 0.58, collide: false, pathGap: 0.45, scale: [0.75, 1.25] });
    this.border(['tree_pine', 'tree_round', 'tree_tall', 'tree_autumn', 'tree_blossom', 'bush'], { step: 2.25, scale: [1.08, 1.5] });
    this.buildUndergrowthPatches();
    this.buildStreamBanks();
    this.buildMagicDetails();
    for (const [x, z] of [[10.1, -12.4], [12.8, -15.6], [8.2, -14.0]] as [number, number][]) this.place('lilypad', x, z, { collide: false, y: 0.05, rot: x * 50 });
    this.place('reeds', 7.4, -12.2, { collide: false });
    this.place('reeds', 15.2, -15.3, { collide: false });

    this.place('critter_frog', 8.5, -11.7, { collide: false });
    this.place('critter_bird', -4.5, 20.4, { collide: false, y: 1.6 });
    this.place('critter_butterfly', -11.5, 6.2, { collide: false, y: 1.2, rot: -20 });
    this.place('critter_fish', 9.8, -14.1, { collide: false, y: 0.08, rot: 35 });
  }

  private buildTreeWalls(): void {
    const treeKeys = ['tree_tall', 'tree_round', 'tree_pine', 'tree_blossom', 'tree_autumn'];
    for (let z = 25.5; z >= -27.5; z -= 2.7) {
      for (const side of [-1, 1]) {
        for (let layer = 0; layer < 3; layer++) {
          const x = side * (5.6 + layer * 3.0 + ((Math.sin(z * 1.7 + layer) + 1) * 0.45));
          const zz = z + Math.sin((z + layer * 3.1) * 0.9) * 0.55 + layer * 0.28;
          if (!this.canDecorate(x, zz, 1.6, 2.2)) continue;
          const key = treeKeys[(Math.abs(Math.round(z * 3 + layer * 5 + side * 2)) % treeKeys.length)];
          const scale = 0.94 + layer * 0.13 + (Math.sin(z + layer) + 1) * 0.055;
          this.place(key, x, zz, { rot: z * 17 + layer * 73, scale, collide: false, reserve: false, opts: { v: Math.abs(Math.round(z * 10 + layer * 7)) % 4 + 1 } });
        }
      }
    }

    for (const [cx, cz, rx, rz] of [
      [-14.6, 18.8, 4.0, 4.8],
      [13.8, 21.4, 4.6, 3.6],
      [-16.2, -22.2, 4.2, 4.2],
      [15.6, -26.0, 3.7, 3.2],
      [17.2, 2.2, 3.4, 4.8],
      [-18.0, 0.8, 3.2, 4.5],
    ] as [number, number, number, number][]) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.35;
        const x = cx + Math.cos(a) * rx * (0.42 + (i % 3) * 0.16);
        const z = cz + Math.sin(a) * rz * (0.42 + ((i + 1) % 3) * 0.13);
        if (!this.canDecorate(x, z, 1.5, 1.6)) continue;
        const key = treeKeys[(i + Math.floor(Math.abs(cx))) % treeKeys.length];
        this.place(key, x, z, { rot: a * 57.3 + i * 22, scale: 0.9 + (i % 4) * 0.1, collide: false, reserve: false, opts: { v: (i % 4) + 1 } });
      }
    }
  }

  private buildUndergrowthPatches(): void {
    const patches: [number, number, number, number][] = [
      [-7.2, 21.5, 5.0, 10],
      [7.4, 22.3, 4.8, 10],
      [-7.6, 7.4, 4.2, 9],
      [8.6, 6.6, 4.2, 9],
      [-7.8, -9.0, 4.6, 10],
      [7.4, -9.8, 4.4, 10],
      [-7.2, -23.0, 4.8, 10],
      [7.2, -24.2, 4.8, 10],
      [-14.0, 9.0, 3.5, 8],
      [15.4, -1.5, 3.4, 8],
    ];
    const small = ['bush', 'grass', 'grass', 'flower', 'tulip', 'mushroom', 'stump', 'rock'];
    for (const [cx, cz, r, n] of patches) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.sin(i * 1.7) * 0.45;
        const d = r * (0.35 + ((i * 37) % 61) / 100);
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d * 0.72;
        if (!this.canDecorate(x, z, 0.45, 0.65)) continue;
        const key = small[Math.abs(i + Math.round(cx + cz)) % small.length];
        this.place(key, x, z, { rot: i * 47, scale: 0.78 + (i % 5) * 0.09, collide: false, reserve: false, opts: key === 'bush' ? { flowers: i % 3 === 0, v: i + 1 } : { v: i + 1 } });
      }
    }
  }

  private buildStreamBanks(): void {
    const rivers = [
      { z: BRIDGE_Z, w: 2.75, xs: [-17, -12.5, -8, -4.5, 4.5, 8.5, 13.5, 18] },
      { z: LOCK_Z, w: 2.45, xs: [-18, -13, -8, -4.2, 4.2, 8.5, 13, 18] },
      { z: STONE_Z, w: 2.85, xs: [-18, -13.5, -8, -4.4, 4.4, 8.5, 13, 18] },
    ];
    for (const river of rivers) {
      for (const x of river.xs) {
        for (const side of [-1, 1]) {
          const z = river.z + side * river.w + Math.sin(x * 0.8 + side) * 0.22;
          if (!this.canDecorate(x, z, 0.35, 0.45)) continue;
          this.place((Math.round(Math.abs(x) + river.z) % 3 === 0) ? 'reeds' : 'rock', x, z, { rot: x * 13, scale: 0.8 + (Math.abs(x) % 4) * 0.08, collide: false, reserve: false });
          if (Math.round(Math.abs(x)) % 2 === 0) this.place('flower', x + 0.5, z + side * 0.35, { rot: x * 29, scale: 0.9, collide: false, reserve: false });
        }
      }
      for (const x of [-9.5, -5.6, 5.8, 10.6]) {
        this.place('lilypad', x, river.z + Math.sin(x) * 0.7, { collide: false, reserve: false, y: 0.05, rot: x * 21, scale: 0.85 });
      }
      for (const x of [-14.5, 14.5]) {
        this.place('critter_fish', x, river.z + Math.sin(x) * 0.65, { collide: false, reserve: false, y: 0.08, rot: x > 0 ? -35 : 35, scale: 0.85 });
      }
    }
  }

  private buildMagicDetails(): void {
    this.addMagicSpot(-2.7, BRIDGE_Z + 6.0, '#74c0fc');
    this.addMagicSpot(3.2, ROCK_Z - 2.2, '#ffd166');
    this.addMagicSpot(-2.8, LOCK_Z - 3.4, '#b197fc');
    this.addMagicSpot(3.2, STONE_Z + 4.2, '#7bd389');

    for (const [x, z, color] of [
      [-12.2, 5.8, '#b197fc'],
      [-10.5, 6.8, '#74c0fc'],
      [12.8, -20.6, '#ffd166'],
      [14.2, -21.8, '#ff9ec7'],
      [-8.6, -6.9, '#ffd166'],
      [-10.0, -6.2, '#b197fc'],
    ] as [number, number, string][]) this.addGlowMushrooms(x, z, color);

    this.place('lamp_post', -10.8, -5.8, { rot: 35, scale: 0.85, collide: false, reserve: false });
    this.place('lamp_post', -6.8, -5.8, { rot: -35, scale: 0.85, collide: false, reserve: false });
    this.addFairyLights(-10.6, -5.75, -6.8, -5.75);
    this.addFireflies();
  }

  private canDecorate(x: number, z: number, footprint: number, pathGap: number): boolean {
    if (this.terrain.onPath(x, z, pathGap)) return false;
    if (this.terrain.waterDist(x, z) < 0.75) return false;
    if (this.terrain.isReserved(x, z, footprint)) return false;
    const clear: [number, number, number][] = [
      [0, BRIDGE_Z + 2.5, 4.3],
      [0, ROCK_Z, 4.0],
      [0, LOCK_Z, 4.0],
      [0, STONE_Z + 1.2, 4.4],
      [11.5, -14.2, 5.2],
      [-9.0, -4.6, 4.0],
      [-10.2, -13.3, 3.2],
      [-14.2, 7.2, 2.6],
      [13.7, -23.3, 2.6],
      [0, 28.5, 3.0],
      [0, -28.5, 3.0],
    ];
    return clear.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r);
  }

  private addMagicSpot(x: number, z: number, color: string): void {
    const g = new THREE.Group();
    g.position.set(x, 0.02, z);
    g.add(cone(0.85, 2.4, color, { p: [0, 1.2, 0], seg: 18, opacity: 0.14, unlit: true, cast: false, receive: false }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.add(ball(0.07, i % 2 ? '#ffffff' : color, { p: [Math.cos(a) * 0.9, 0.08, Math.sin(a) * 0.9], seg: 6, emissive: color, glow: 0.55, cast: false }));
    }
    this.statics.add(g);
  }

  private addGlowMushrooms(x: number, z: number, color: string): void {
    this.place('mushroom', x, z, { opts: { color }, scale: 1.15, collide: false, reserve: false });
    this.place('mushroom', x + 0.35, z + 0.25, { opts: { color: '#ffd166' }, scale: 0.8, collide: false, reserve: false });
    const glow = ball(0.16, color, { p: [x, 0.52, z], seg: 8, emissive: color, glow: 1.5, opacity: 0.72, cast: false });
    this.statics.add(glow);
  }

  private addFairyLights(x1: number, z1: number, x2: number, z2: number): void {
    const g = new THREE.Group();
    g.add(tube([[x1, 1.65, z1], [(x1 + x2) / 2, 1.82, (z1 + z2) / 2], [x2, 1.65, z2]], 0.018, '#8b5a3c', { radial: 4, seg: 10, cast: false }));
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      const x = x1 + (x2 - x1) * k;
      const z = z1 + (z2 - z1) * k;
      const y = 1.58 + Math.sin(k * Math.PI) * 0.18;
      const color = i % 2 ? '#ffd166' : '#b197fc';
      g.add(ball(0.075, color, { p: [x, y, z], seg: 8, emissive: color, glow: 1.4, cast: false }));
    }
    this.statics.add(g);
  }

  private addFireflies(): void {
    const count = 22;
    const geom = new THREE.SphereGeometry(0.055, 8, 6);
    const mesh = new THREE.InstancedMesh(geom, mat('#fff3a6', { emissive: '#ffd166', glow: 1.8, unlit: true }), count);
    mesh.name = 'forest_fireflies';
    const dummy = new THREE.Object3D();
    const anchors = Array.from({ length: count }, (_, i) => {
      const side = i % 2 ? -1 : 1;
      const z = 21 - i * 2.05;
      const x = side * (5.0 + (i % 5) * 1.15);
      return { x, z, phase: i * 0.73, amp: 0.28 + (i % 4) * 0.04 };
    });
    this.dynamics.add(mesh);
    this.addTick((_dt, t) => {
      anchors.forEach((a, i) => {
        dummy.position.set(a.x + Math.sin(t * 0.75 + a.phase) * a.amp, 0.95 + Math.sin(t * 1.2 + a.phase) * 0.22, a.z + Math.cos(t * 0.55 + a.phase) * a.amp);
        const s = 0.75 + Math.sin(t * 2.8 + a.phase) * 0.22;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  private async solveBridge(): Promise<void> {
    if (on('forest.bridge')) return say(CAST.cu, 'Cầu đã mở rồi. Con đi tiếp nhé!');
    this.player.face(0, BRIDGE_Z);
    await say(CAST.cu, siteText('bridge.owl', 'forest.bridge'));
    await this.quiz(storyQ('forestBridge', { site: 'forest.bridge' }), { src: 'forest:bridge', speaker: CAST.cu, title: siteText('bridge.title', 'forest.bridge'), icon: '🌉', rewards: false, quiet: true }, this.drawBridge, 12);
    setFlag('forest.bridge');
    await this.lowerDrawBridge();
    this.openDrawBridgeTerrain();
    reward({ stars: 1, xp: 15 });
    this.owl.actor.celebrate(1.4);
    this.bubble(this.owl.actor.root, 'Chính xác! Cầu đã mở!', this.owl.actor.height + 0.8, 3000);
    toast('Chính xác! Cầu đã mở!', { icon: '🌉', tone: 'good', ms: 2600 });
  }

  private async solveRock(): Promise<void> {
    if (!this.rock || on('forest.rock')) return;
    await this.quiz(storyQ('forestRock', { site: 'forest.rock' }), { src: 'forest:rock', speaker: CAST.gau, title: 'Tảng đá chặn đường', icon: '⛏️', rewards: false, quiet: true }, this.rock, 11);
    setFlag('forest.rock');
    await this.shatterRock();
    this.unblockRockTerrain();
    reward({ stars: 1, xp: 15 });
    this.buddy?.celebrate(1.4);
    this.buddy && this.bubble(this.buddy.root, 'Đường thông rồi!', this.buddy.height + 0.6, 2200);
  }

  private async solveBearBridge(): Promise<void> {
    if (on('forest.bearBridge')) return;
    await say(CAST.gau, siteText('bearBridge.ask', 'forest.bearBridge'));
    await this.quiz(storyQ('bearBridge', { site: 'forest.bearBridge' }), { src: 'forest:bearBridge', speaker: CAST.gau, title: 'Cây cầu bị khóa', icon: '🔒', rewards: false, quiet: true }, this.lockBridge.root, 11);
    setFlag('forest.bearBridge');
    await this.unlockBearBridge();
    this.openLockBridgeTerrain();
    reward({ stars: 1, xp: 15 });
    this.buddy?.celebrate(1.6);
    if (this.buddy) this.bubble(this.buddy.root, 'Cầu vững chắc rồi!', this.buddy.height + 0.6, 2600);
  }

  private startStonePick(): void {
    if (this.stonesStarted || on('forest.stones')) return;
    this.stonesStarted = true;
    {
      const spots: PickSpot[] = this.stoneQuestion.choices.slice(0, 3).map((c, i) => ({
        value: c.value,
        label: `Chọn ${c.label}`,
        icon: '👣',
        x: this.choiceStones[i].position.x,
        z: this.choiceStones[i].position.z,
        r: 0.95,
        obj: this.choiceStones[i],
        auto: true,
      }));
      void this.pick(this.stoneQuestion, spots, {
        src: 'forest:stones',
        speaker: CAST.gau,
        title: 'Đá qua suối',
        icon: '👣',
        area: { x: 0, z: STONE_Z, r: 7 },
        showVisual: true,
        rewards: false,
        onWrong: (spot) => this.wrongStone(spot),
        onRight: (spot) => this.rightStone(spot),
      }).finally(() => (this.stonesStarted = false));
    }
  }

  private async lowerDrawBridge(): Promise<void> {
    if (!this.drawDeck) return;
    sfx('unlock');
    const deck = this.drawDeck;
    const start = deck.rotation.x;
    await this.tween(1.2, (k) => {
      deck.rotation.x = start * (1 - k);
      deck.rotation.z = Math.sin(k * Math.PI * 6) * 0.02 * (1 - k);
    }, { ease: 'outCubic' });
    deck.rotation.x = 0;
    this.fx.burst('sparkle', [0, 1.1, BRIDGE_Z], { count: 36 });
  }

  private async shatterRock(): Promise<void> {
    const rock = this.rock;
    if (!rock) return;
    sfx('unlock');
    const chunks = Array.from({ length: 9 }, (_, i) => this.place(i % 3 === 0 ? 'rock_big' : 'rock', 0, ROCK_Z, { dynamic: true, collide: false, scale: i % 3 === 0 ? 0.45 : 0.75, reserve: false }));
    await this.tween(0.72, (k) => {
      rock.rotation.y += 0.08;
      rock.position.x = Math.sin(k * Math.PI * 18) * 0.13 * (1 - k);
      rock.scale.setScalar(1 - k * 0.55);
      chunks.forEach((c, i) => {
        const a = (i / chunks.length) * Math.PI * 2;
        c.position.x = Math.cos(a) * k * (1.6 + (i % 3) * 0.4);
        c.position.z = ROCK_Z + Math.sin(a) * k * (1.2 + (i % 2) * 0.35);
        c.position.y = Math.sin(k * Math.PI) * (0.8 + (i % 4) * 0.15) - k * 0.05;
        c.rotation.y += 0.12 + i * 0.01;
        c.scale.setScalar((1 - k * 0.65) * (i % 3 === 0 ? 0.45 : 0.75));
      });
    }, { ease: 'outCubic' });
    this.setSolid(rock, false);
    this.removeObj(rock);
    chunks.forEach((c) => this.removeObj(c));
    this.rock = null;
    this.fx.burst('star', [0, 1.2, ROCK_Z], { count: 26 });
  }

  private async unlockBearBridge(): Promise<void> {
    sfx('unlock');
    const { lock, chain, planks, deck } = this.lockBridge;
    await this.tween(0.45, (k) => {
      lock.position.y = 1.2 + Math.sin(k * Math.PI) * 0.8;
      lock.rotation.z = k * Math.PI * 1.6;
      lock.scale.setScalar(1 - k * 0.75);
      chain.scale.y = 1 - k;
    }, { ease: 'outCubic' });
    lock.visible = false;
    chain.visible = false;
    for (let i = 0; i < planks.length; i++) {
      const plank = planks[i];
      await this.tween(0.11, (k) => {
        plank.position.x = -3.2 * (1 - k);
        plank.position.y = -0.9 * (1 - k) + 0.12;
        plank.rotation.z = (1 - k) * -0.8;
      }, { ease: 'outBack' });
    }
    planks.forEach((p) => (p.visible = false));
    deck.visible = true;
    this.fx.burst('sparkle', [0, 0.8, LOCK_Z], { count: 28 });
  }

  private async wrongStone(spot: PickSpot): Promise<void> {
    const obj = spot.obj;
    if (obj) {
      const y0 = obj.position.y;
      await this.tween(0.35, (k) => {
        obj.rotation.z = Math.sin(k * Math.PI * 6) * 0.14 * (1 - k);
        obj.position.y = y0 - Math.sin(k * Math.PI) * 0.18;
      });
      obj.rotation.z = 0;
      obj.position.y = y0;
    }
    await this.pushPlayerBack(0, STONE_Z + 3.7);
  }

  private async rightStone(_spot: PickSpot): Promise<void> {
    setFlag('forest.stones');
    sfx('correct');
    for (let i = 0; i < this.riseStones.length; i++) {
      const st = this.riseStones[i];
      await this.tween(0.16, (k) => {
        st.position.y = -0.85 * (1 - k);
        st.scale.setScalar(0.75 + Math.sin(k * Math.PI) * 0.12);
      }, { ease: 'outBack' });
      st.scale.setScalar(0.75);
    }
    this.openStoneTerrain();
    reward({ stars: 1, xp: 15 });
    this.buddy?.celebrate(2);
    this.fx.burst('confetti', [0, 1.4, STONE_Z], { count: 50, spread: 2.2 });
    toast('Cổng Mê Cung đã mở!', { icon: '🌀', tone: 'good', ms: 3200 });
    this.refreshMarks();
  }

  private async pushPlayerBack(x: number, z: number): Promise<void> {
    const p = this.player.pos.clone();
    this.player.scripted = true;
    this.player.stop(false);
    await this.tween(0.45, (k) => {
      this.player.setPos(p.x + (x - p.x) * k, p.z + (z - p.z) * k, Math.sin(k * Math.PI) * 0.08);
    }, { ease: 'inOutCubic' });
    this.player.scripted = false;
  }

  private makeLockBridge(open: boolean): LockBridge {
    const root = new THREE.Group();
    root.name = 'locked_bear_bridge';
    root.position.set(0, 0, LOCK_Z);
    for (const z of [-2.35, 2.35]) {
      root.add(box(3.8, 0.28, 0.7, '#d8d0c2', { p: [0, 0.14, z] }));
      for (const x of [-1.45, 1.45]) root.add(cyl(0.14, 0.16, 1.15, WOOD_DARK, { p: [x, 0.58, z], seg: 8 }));
    }
    const planks: THREE.Object3D[] = [];
    for (let i = 0; i < 12; i++) {
      const z = -1.85 + i * (3.7 / 11);
      const p = box(2.8, 0.16, 0.24, i < 7 ? '#c9965d' : '#d8ad70', { p: [open ? 0 : -3.2, open ? 0.12 : -0.9, z], r: [0, 0, open ? 0 : -45] });
      p.visible = !open;
      root.add(p);
      planks.push(p);
    }
    const deck = box(2.8, 0.16, 4.1, '#c9965d', { p: [0, 0.12, 0] });
    deck.visible = open;
    root.add(deck);
    for (const x of [-1.35, 1.35]) {
      root.add(box(0.12, 0.28, 4.2, WOOD_DARK, { p: [x, 0.45, 0] }));
      root.add(tube([[x, 1.0, 1.9], [x, 1.0, -1.9]], 0.025, '#686a70', { radial: 5, seg: 6, cast: false }));
    }
    const chain = group([
      tube([[-1.3, 1.2, 0.05], [-0.45, 1.2, 0.05], [0.45, 1.2, 0.05], [1.3, 1.2, 0.05]], 0.035, '#55585f', { radial: 5, seg: 8 }),
    ]);
    const lock = group([
      rbox(0.46, 0.5, 0.16, 0.05, '#ffd166', { p: [0, 0, 0] }),
      tube([[-0.17, 0.18, 0], [-0.17, 0.48, 0], [0.17, 0.48, 0], [0.17, 0.18, 0]], 0.035, '#d8d0c2', { radial: 5, seg: 6 }),
      ball(0.04, '#8a5a3b', { p: [0, -0.04, 0.09], seg: 8 }),
    ], { p: [0, 1.2, 0.12] });
    chain.visible = !open;
    lock.visible = !open;
    root.add(chain, lock);
    return { root, planks, deck, lock, chain };
  }

  private openDrawBridgeTerrain(): void {
    this.unblock((x, z) => Math.abs(x) < 1.45 && Math.abs(z - BRIDGE_Z) < 3.5);
  }

  private unblockRockTerrain(): void {
    this.unblock((x, z) => Math.abs(x) < 5.3 && Math.abs(z - ROCK_Z) < 1.6);
  }

  private openLockBridgeTerrain(): void {
    this.unblock((x, z) => Math.abs(x) < 1.55 && Math.abs(z - LOCK_Z) < 2.75);
  }

  private openChoiceStoneTerrain(): void {
    const pts = [-1.75, 0, 1.75].map((x) => [x, STONE_Z + 1.55] as const);
    this.unblock((x, z) => pts.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.85) || (Math.abs(x) < 1.2 && z > STONE_Z + 2.0 && z < STONE_Z + 3.6));
  }

  private openStoneTerrain(): void {
    this.unblock((x, z) => Math.abs(x) < 1.8 && Math.abs(z - STONE_Z) < 4.25);
  }

  private hiddenStar(n: string): void {
    const found = ['forest.star.1', 'forest.star.2'].filter((id) => isCollected(id)).length;
    toast(`Sao rừng bí mật ${found}/2`, { icon: '⭐', tone: 'gold', ms: 1800 });
    this.fx.burst('star', [n === '1' ? -14.2 : 13.7, 1.2, n === '1' ? 7.2 : -23.3], { count: 18 });
  }
}
