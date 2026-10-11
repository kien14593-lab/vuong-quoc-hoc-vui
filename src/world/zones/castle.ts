import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { canListen } from '../../core/speech';
import { profile, setFlag } from '../../core/state';
import { CAST, villager } from '../../game/cast';
import { currentRooms, ROOM_IDS, roomList, type RoomCfg, type RoomId } from '../../game/castle-rooms';
import { checkBadges, on, reward } from '../../game/story';
import { englishQ, kingPlan, labelQ, mathQ, mixedQ, pickEnTopic } from '../../game/subject';
import { GRADE_TOPICS } from '../../math/curriculum';
import type { MathTopic, Question, WordTheme } from '../../math/types';
import { say, type Speaker } from '../../ui/dialog';
import { toast } from '../../ui/toast';
import { Zone, type Npc, type PickSpot, type Spawn } from '../zone';

const ROOM_THEME: WordTheme = { who: 'Hiệp Sĩ Thỏ', item: 'viên ngọc', unit: 'viên', emoji: '💎' };
const KING_THEME: WordTheme = { who: 'Nhà Vua', item: 'viên sao', unit: 'viên', emoji: '⭐' };
const CHOICE_COLORS = ['#8fd3ff', '#ffd166', '#ff9ec7', '#9be09b', '#c7b3ff'];
const CASTLE_STYLE = { stone: '#fff2dc', trim: '#e8c5ff', roof: '#b197fc', flag: '#ff7aa8', accent: '#ffd166' };
const HALL_STYLE = { stone: '#fff2dc', trim: '#e8c5ff', floor: '#fff8ee', carpet: '#d6b5ff' };
/**
 * Nhà Vua đứng trên bục, ngay trước ngai (mặt bục cao 0.7 m, mép trước ở z −13.45), để bé thấy cả người:
 * áo choàng, cổ áo, đôi ủng. Đứng đây vua quay hẳn về phía bé được mà không lẹm vào lưng ngai.
 */
const KING_SPOT = { x: 0, y: 0.7, z: -13.9 };

/** 🏰 LÂU ĐÀI TRÍ TUỆ – ba phòng thử thách và thử thách cuối của Nhà Vua. */
export class CastleZone extends Zone {
  private readonly gates: Partial<Record<RoomId, THREE.Object3D>> = {};
  private readonly knights: Partial<Record<RoomId, Npc>> = {};
  private hall: THREE.Object3D | null = null;
  private throneDoors: THREE.Object3D[] = [];
  private king!: Npc;
  private roomRunning: RoomId | null = null;
  private kingRunning = false;
  /** Ba phòng theo môn của hồ sơ (dựng lại khu vực khi đổi môn). */
  private rooms!: Record<RoomId, RoomCfg>;

  constructor(spawn: Spawn) {
    super(
      {
        id: 'castle',
        title: 'Lâu Đài Trí Tuệ',
        icon: '🏰',
        sub: 'Thử thách nâng cao',
        music: 'castle',
        area: { hw: 34, hd: 32, r: 12 },
        margin: 18,
        seed: 51,
        ground: '#b5e486',
        sky: ['#9ed9ff', '#fff0c8'],
        fog: [70, 150],
        mood: { sky: '#d2ebff', ground: '#a3d679', hemi: 1.3, sun: '#fff0c8', sunI: 1.95, ambient: 0.18 },
        cam: { yaw: 0, pitch: 52, dist: 22, minDist: 12, maxDist: 36 },
        spawns: {
          start: { x: 30, z: 13.5, rot: -90 },
          from_village: { x: 30, z: 13.5, rot: -90 },
        },
      },
      spawn,
    );
  }

  protected build(): void {
    this.rooms = currentRooms();
    this.buildTerrain();
    this.buildApproach();
    this.buildCourtyard();
    this.buildRooms();
    this.buildThroneHall();
    this.buildPeople();
    this.buildSideContent();
    this.buildDecor();
  }

  objective(): { text: string; icon?: string } | null {
    const left = ROOM_IDS.filter((id) => !on(`castle.${id}`));
    if (left.length) return { text: `Vượt qua 3 phòng thử thách (${3 - left.length}/3)`, icon: '🛡️' };
    if (!on('castle.king')) return { text: 'Vào đại sảnh gặp Nhà Vua', icon: '👑' };
    return { text: 'Chơi mini-game hoặc trò chuyện trong lâu đài', icon: '🏰' };
  }

  protected onEnter(first: boolean): void {
    if (first && !on('castle.intro')) {
      void this.runInteract({ id: 'castle:intro', x: 0, z: 0, r: 0, label: '', icon: '', run: () => this.intro() });
    }
  }

  protected tick(_dt: number, _t: number): void {
    this.fadeHallWalls();
  }

  private buildTerrain(): void {
    const t = this.terrain;
    t.path([[38, 13.5], [27, 13.5], [17, 12.5], [7.5, 8.6], [0, 5.2], [0, -6.4]], 3.2, { kind: 'stone' });
    t.path([[0, 4.8], [0, -9.4]], 4.4, { kind: 'stone' });
    t.plaza(0, 1.8, 8.2);
    t.plaza(0, -5.5, 5.4);
    t.plaza(0, 18.2, 6.6);
    for (const r of ROOM_IDS) {
      const cfg = this.rooms[r];
      t.path([[0, cfg.z + 8.2], [cfg.x * 0.62, cfg.z + 8.2], [cfg.x, cfg.z + 6.5]], 2.55, { kind: 'stone' });
      t.plaza(cfg.x, cfg.z + 3.1, 4.6);
      t.patch(cfg.x, cfg.z + 2.8, 4.6, cfg.color, 0.28);
    }
    t.meadow(-24, 20, 5.5, ['#ffffff', '#ffd6e7', '#e9d5ff'], 6);
    t.meadow(24, 19, 5.5, ['#ffffff', '#caffbf', '#ffd166'], 6);
    t.meadow(0, 18.4, 6.4, ['#ffffff', '#ffd6e7', '#fff3a6', '#caffbf'], 7);
    t.pond(23.5, 21.5, 4.8, 2.4);
    t.patch(0, -4.6, 3.6, '#d6b5ff', 0.45);
  }

  private buildApproach(): void {
    this.portal(33.2, 13.5, 'village', 'from_castle', { label: 'Ngôi Làng', r: 1.6, rot: -90 });
    this.place('gate_arch', 25.4, 13.3, { rot: -90, opts: { text: 'Lâu Đài', color: '#d0c4f7', w: 4.8 } });
    this.sign(25.4, 13.3, '🏰 Lâu Đài Trí Tuệ', { y: 4.4, maxDist: 44 });
    // Cờ dọc đường vào mang ký hiệu của ba phòng (Toán: × ½ △ ×).
    const syms = [...ROOM_IDS, 'mul' as const].map((id) => this.rooms[id].bannerSym);
    for (const [x, z, rot, sym, color] of [
      [28.7, 10.9, -90, syms[0], '#c7b3ff'],
      [22.5, 14.8, -90, syms[1], '#8fd3ff'],
      [15.2, 10.2, -65, syms[2], '#9be09b'],
      [8.2, 6.0, -45, syms[3], '#ffd166'],
    ] as [number, number, number, string, string][]) {
      this.place('banner', x, z, { rot, opts: { sym, color }, collide: false });
      this.place('torch', x, z + 1.0, { opts: { standing: true }, collide: false });
    }
    this.place('bridge_draw', 24.4, 16.8, { rot: -35, opts: { raised: false }, collide: false, reserve: 2.2 });
  }

  private buildCourtyard(): void {
    this.place('castle', 0, -26.8, { scale: 0.96, opts: CASTLE_STYLE, collide: false, reserve: 8 });
    this.sign(0, -22.2, 'Lâu Đài Trí Tuệ', { y: 8.2, maxDist: 58 });
    for (const [x, z] of [[-10.8, 2.2], [10.8, 2.2]] as [number, number][]) this.place('torch', x, z, { collide: false });
    this.place('fountain', 0, 1.8, { scale: 0.85, collide: false });
    this.place('bunting', 0, -1.6, { opts: { len: 11, colors: ['#d0c4f7', '#ffd6e7', '#fff3a6', '#b9fbc0'] }, collide: false });
    for (const [x, z, rot] of [[-5.6, 3.4, 20], [5.6, 3.4, -20], [-5.8, -2.5, 145], [5.8, -2.5, -145]] as [number, number, number][]) {
      this.place('bench', x, z, { rot, collide: false });
      this.place('flower_bed', x * 0.92, z + 0.9, { rot: -rot * 0.4, collide: false });
    }
    this.place('castle_statue', -7.2, -4.2, { collide: false, scale: 0.9 });
    this.place('castle_statue', 7.2, -4.2, { collide: false, scale: 0.9, opts: { color: '#ff9ec7' } });
    this.place('castle_pavilion', -12.0, 18.5, { rot: 12, opts: { text: 'XÂY', color: '#c7b3ff' }, collide: false });
    this.place('castle_pavilion', 0, 20.0, { rot: 0, opts: { text: 'GIỜ', color: '#8fd3ff' }, collide: false });
    this.place('castle_pavilion', 12.0, 18.5, { rot: -12, opts: { text: 'PIZZA', color: '#ff9ec7' }, collide: false });
    this.miniSpot('builder', -12.0, 18.5, { r: 3.0, y: 3.4 });
    this.miniSpot('clock', 0, 20.0, { r: 3.0, y: 3.4 });
    this.miniSpot('pizza', 12.0, 18.5, { r: 3.0, y: 3.4 });
    for (const [x, z, rot] of [[-16, 17.3, 0], [-6, 21.8, 90], [6, 21.8, 90], [16, 17.3, 0]] as [number, number, number][]) this.place('hedge', x, z, { rot, opts: { len: 5, h: 0.85 }, collide: false });
    for (const [x, z] of [[-18, 20.6], [18, 20.6], [-5.6, 17.4], [5.6, 17.4]] as [number, number][]) this.place('tree_blossom', x, z, { scale: 0.85, collide: false });
  }

  private buildRooms(): void {
    for (const id of ROOM_IDS) {
      const r = this.rooms[id];
      const solved = on(r.flag);
      const wallOpts = { ...CASTLE_STYLE, len: 9.0, trim: solved ? '#ffd166' : CASTLE_STYLE.trim };
      this.place('castle_tower', r.x - 5.2, r.z - 1.6, { scale: 0.62, opts: { ...CASTLE_STYLE, roof: r.color, flag: solved ? '#ffd166' : r.color }, collide: true });
      this.place('castle_tower', r.x + 5.2, r.z - 1.6, { scale: 0.62, opts: { ...CASTLE_STYLE, roof: r.color, flag: solved ? '#ffd166' : r.color }, collide: true });
      this.place('castle_wall', r.x, r.z - 1.7, { opts: wallOpts, rot: 0 });
      this.place('castle_wall', r.x - 5.3, r.z + 2.5, { opts: { ...CASTLE_STYLE, len: 8.2 }, rot: 90 });
      this.place('castle_wall', r.x + 5.3, r.z + 2.5, { opts: { ...CASTLE_STYLE, len: 8.2 }, rot: 90 });
      this.place('banner', r.x, r.z - 1.25, { opts: { sym: r.bannerSym, color: solved ? '#ffd166' : r.color }, collide: false });
      this.place('castle_emblem', r.x, r.z - 1.26, { opts: { text: r.symbol, color: solved ? '#ffd166' : r.color }, collide: false, reserve: false });
      this.place('castle_floor_emblem', r.x, r.z + 2.7, { opts: { text: r.symbol, color: r.color }, collide: false, reserve: false });
      this.sign(r.x, r.z - 0.15, `${r.symbol} ${r.short}`, { y: 4.35, maxDist: 42 });
      const gate = this.place('castle_wall', r.x, r.z + 6.55, { opts: { ...CASTLE_STYLE, len: 3.1, trim: solved ? '#ffd166' : CASTLE_STYLE.trim }, rot: 0, dynamic: true, name: `gate_${id}` });
      this.gates[id] = gate;
      if (solved) this.setGateOpen(id, true);
      for (const [dx, dz, rot] of [[-3.5, 6.1, 25], [3.5, 6.1, -25], [-4.2, 1.0, 90], [4.2, 1.0, 90]] as [number, number, number][]) {
        this.place('flower_bed', r.x + dx, r.z + dz, { rot, collide: false });
      }
      for (const [dx, dz] of [[-4.2, 5.8], [4.2, 5.8]] as [number, number][]) this.place('torch', r.x + dx, r.z + dz, { collide: false });
      if (solved) this.fx.burst('sparkle', [r.x, 2.2, r.z - 0.9], { count: 20 });
      this.interact({
        id: `castle:room:${id}`,
        x: r.x,
        z: r.z + 8.55,
        r: 3.4,
        label: solved ? `Xem ${r.short}` : `Vào ${r.short}`,
        icon: r.icon,
        obj: gate,
        run: () => {
          void this.runRoom(id);
        },
      });
    }
  }

  private buildThroneHall(): void {
    this.hall = this.place('hall_throne', 0, -10.7, { opts: HALL_STYLE, dynamic: true, collide: true, reserve: 8.6 });
    this.sign(0, -6.6, '👑 Đại sảnh Nhà Vua', { y: 4.7, maxDist: 48 });
    const open = this.roomsDone();
    const left = this.place('castle_wall', -2.05, -3.95, { opts: { ...CASTLE_STYLE, len: 3.0 }, rot: 90, dynamic: true, name: 'throne_door_l' });
    const right = this.place('castle_wall', 2.05, -3.95, { opts: { ...CASTLE_STYLE, len: 3.0 }, rot: 90, dynamic: true, name: 'throne_door_r' });
    this.throneDoors = [left, right];
    if (open) this.setThroneDoors(true);
    this.interact({
      id: 'castle:king',
      x: 0,
      z: -3.2,
      r: 3.8,
      label: open ? 'Gặp Nhà Vua' : 'Cửa đại sảnh',
      icon: '👑',
      obj: this.hall,
      run: () => {
        void this.runKing();
      },
    });
  }

  private buildPeople(): void {
    for (const id of ROOM_IDS) {
      const r = this.rooms[id];
      this.knights[id] = this.npc(CAST.hiepsi.art, r.x - 3.7, r.z + 8.8, {
        name: CAST.hiepsi.name,
        color: CAST.hiepsi.color,
        rot: 170,
        mark: () => (on(r.flag) ? '★' : '?'),
        talk: async () => {
          if (on(r.flag)) {
            await say(CAST.hiepsi, `${r.title} đã sáng cờ vàng. Bạn thật dũng cảm!`);
            return;
          }
          await say(CAST.hiepsi, [`Ta canh ${r.title}.`, 'Hãy bước vào phòng và giải 3 thử thách liên tiếp nhé!']);
          void this.runRoom(id);
        },
      });
    }
    this.king = this.npc(CAST.vua.art, KING_SPOT.x, KING_SPOT.z, {
      name: CAST.vua.name,
      color: CAST.vua.color,
      rot: 0,
      r: 2.8,
      mark: () => (this.roomsDone() && !on('castle.king') ? '!' : on('castle.king') ? '★' : '?'),
      talk: () => this.runKing(),
    });
    // NPC không tự bám độ cao nền: nâng Nhà Vua lên mặt bục.
    this.king.actor.setPos(KING_SPOT.x, KING_SPOT.z, KING_SPOT.y);
  }

  private buildSideContent(): void {
    // Hộp thoại và thẻ câu đố dùng đúng người nói của NPC (mô hình + artOpts – chân dung đã vẽ sẵn, xem Zone.talkers),
    // thêm giọng của dân làng cùng biến thể.
    const guard = villager(1);
    this.npc('npc_villager', 13.2, -5.0, {
      name: 'Lính gác Piko',
      color: '#8fd3ff',
      opts: { v: guard.artOpts?.v ?? 1 },
      rot: -60,
      wander: 1.4,
      talk: async (npc) => {
        await say({ ...npc.speaker, voice: 'v1' }, ['Mẹo nhỏ nhé!', 'Nếu thấy đá đáp án, hãy đi tới và chọn bằng nút tròn. Sai cũng không sao, lâu đài sẽ gợi ý cho bạn.']);
      },
    });
    this.npc('npc_villager', -10.3, -5.0, {
      name: 'Thị vệ Mây',
      color: '#ffb38a',
      opts: { v: 3 },
      rot: 40,
      wander: 1.0,
      talk: async (npc) => {
        const may: Speaker = { ...npc.speaker, voice: 'v3' };
        await say(may, 'Mình có một câu đố trong sân lâu đài!');
        await this.quiz(mixedQ({ math: GRADE_TOPICS[profile().grade] }), { src: 'castle:riddle', speaker: may, title: 'Câu đố trong sân', icon: '🧩' }, npc.actor, 10);
        await say(may, 'Hay quá! Bạn suy luận như một hiệp sĩ thông thái.');
      },
    });
    this.npc('npc_villager', 6.8, 7.6, {
      name: 'Quan thư ký',
      color: '#c7b3ff',
      opts: { v: 4 },
      rot: 180,
      talk: async (npc) => {
        await say({ ...npc.speaker, voice: 'v4' }, ['Ba phòng có thể làm theo bất kỳ thứ tự nào.', 'Làm xong cả ba, cửa đại sảnh sẽ mở để gặp Nhà Vua.']);
      },
    });
  }

  private buildDecor(): void {
    for (const [x, z, rot, color] of [[-26, 15, 20, '#c7b3ff'], [25, 18, -25, '#8fd3ff'], [-28, -7, 80, '#9be09b'], [26, -7, -80, '#ff9ec7']] as [number, number, number, string][]) this.place('castle_tower', x, z, { scale: 0.55, rot, opts: { ...CASTLE_STYLE, roof: color, flag: color }, collide: false });
    for (const [x, z] of [[-6.5, 7.4], [6.5, 7.4], [-23, 7.5], [23, 7.5], [-12, 17.5], [12, 17.5], [-4.2, -6.6], [4.2, -6.6]] as [number, number][]) this.place('torch', x, z, { collide: false });
    for (const [x, z, rot, len] of [[-10.5, 10.8, 18, 5], [10.5, 10.8, -18, 5], [-10.2, -1.2, 90, 4], [10.2, -1.2, 90, 4], [-26.5, 3.8, 90, 6], [26.5, 3.8, 90, 6]] as [number, number, number, number][]) this.place('hedge', x, z, { rot, opts: { len, h: 0.8 }, collide: false });
    for (const [x, z, style] of [[-23, 21.5, 'bunny'], [23, 21.5, 'elephant'], [-28, 8.4, 'bunny'], [28, 8.4, 'elephant']] as [number, number, 'bunny' | 'elephant'][]) this.place('zoo_topiary', x, z, { opts: { style }, collide: false, scale: 1.05 });
    for (const [x, z] of [[-21, 18.5], [21, 18.5], [-11, 5.6], [11, 5.6], [-4.8, 9.8], [4.8, 9.8]] as [number, number][]) this.place('flower_bed', x, z, { collide: false, rot: x * 4 });
    this.scatter(['flower', 'tulip', 'grass', 'mushroom'], 110, { gap: 0.75, collide: false, pathGap: 0.55 });
    this.scatter(['bush', 'flower_bed', 'rock'], 22, { gap: 2.2, scale: [0.75, 1.15], collide: false });
    this.border(['tree_pine', 'tree_round', 'tree_blossom', 'bush'], { scale: [0.9, 1.35], step: 3.0 });
  }

  private async intro(): Promise<void> {
    await this.wait(0.4);
    await say(CAST.hiepsi, ['Chào mừng đến Lâu Đài Trí Tuệ!', 'Bạn đã đủ cấp để thử sức với các phòng nâng cao.']);
    await this.showPoint(0, 2.0, 4.6, 1.2, 18);
    await say(CAST.hiepsi, [`Có ba phòng thử thách: ${roomList(this.rooms)}.`, 'Hoàn thành cả ba, cửa đại sảnh sẽ mở để gặp Nhà Vua.']);
    setFlag('castle.intro');
  }

  private roomTopics(id: RoomId): MathTopic[] {
    const grade = profile().grade;
    const wanted: Record<RoomId, Partial<Record<typeof grade, MathTopic[]>>> = {
      mul: { 1: ['add'], 2: ['mul'], 3: ['mul', 'div'], 4: ['mul', 'div'], 5: ['mul', 'div'] },
      frac: { 1: ['compare'], 2: ['div'], 3: ['fraction'], 4: ['fraction', 'decimal'], 5: ['fraction', 'decimal'] },
      geo: { 1: ['geometry'], 2: ['geometry'], 3: ['perimeter', 'area', 'geometry'], 4: ['perimeter', 'area', 'geometry'], 5: ['perimeter', 'area', 'geometry'] },
    };
    const allowed = new Set(GRADE_TOPICS[grade]);
    return (wanted[id][grade] ?? ['geometry']).filter((t) => allowed.has(t));
  }

  private pickTopic(id: RoomId, step = 0): MathTopic {
    const topics = this.roomTopics(id);
    return topics[step % Math.max(1, topics.length)] ?? GRADE_TOPICS[profile().grade][0];
  }

  private async runRoom(id: RoomId): Promise<void> {
    const cfg = this.rooms[id];
    if (on(cfg.flag)) {
      await say(CAST.hiepsi, `${cfg.title} đã hoàn thành rồi. Cờ vàng đang bay rất đẹp!`);
      return;
    }
    if (this.roomRunning) return;
    this.roomRunning = id;
    try {
      await say(CAST.hiepsi, [`${cfg.title} bắt đầu!`, 'Bạn sẽ giải 3 thử thách. Hãy bình tĩnh nhé.']);
      await this.openGate(id);
      await this.showPoint(cfg.x, 1.4, cfg.z + 2.8, 0.8, 12);
      for (let i = 0; i < 3; i++) {
        const levelDelta = i === 2 ? 1 : 0;
        const math = () => mathQ(this.pickTopic(id, i), { levelDelta, theme: ROOM_THEME });
        const topic = cfg.en[0];
        if (i === 1) {
          // Đáp án hiện trên đá: Tiếng Anh dùng hình hoặc từ ngắn; phòng Lắng Nghe vẫn được hỏi câu nghe.
          const q = labelQ(cfg.subject, math, { topic, levelDelta, en: topic === 'en_listen' ? { listen: canListen() } : undefined });
          await this.pickChallenge(cfg, q, i);
        } else {
          const q = cfg.subject === 'math' ? math() : englishQ(topic, { levelDelta });
          await this.quiz(q, { src: `castle:${id}:${i}`, speaker: CAST.hiepsi, title: `${cfg.title} ${i + 1}/3`, icon: cfg.icon }, [cfg.x, 1.1, cfg.z + 2.2], 11);
        }
        this.fx.burst('sparkle', [cfg.x, 1.3, cfg.z + 2.2], { count: 16 + i * 4 });
        sfx('correct');
        await this.wait(0.35);
      }
      setFlag(cfg.flag);
      if (id === 'mul') reward({ stars: 1, xp: 20, coins: 10, badge: cfg.subject === 'math' ? 'bang-nhan' : 'nha-ngon-ngu-nhi' });
      else reward({ stars: 1, xp: 20, coins: 10 });
      checkBadges();
      this.knights[id]?.actor.celebrate(1.8);
      this.fx.burst('confetti', [cfg.x, 2.0, cfg.z + 4.5], { count: 48 });
      this.bubble(this.knights[id]?.actor.root ?? this.gates[id]!, 'Chào hiệp sĩ thông thái! 🛡️', 2.8, 2600);
      toast(`Hoàn thành ${cfg.title}!`, { icon: cfg.icon, tone: 'gold' });
      if (this.roomsDone()) {
        this.setThroneDoors(true);
        sfx('unlock');
        await say(CAST.vua, 'Ba lá cờ đã sáng! Cửa đại sảnh mở rồi, hãy đến gặp ta.');
        await this.showPoint(0, 2.3, -4.2, 1.2, 15);
      } else {
        await say(CAST.hiepsi, 'Tuyệt lắm! Bạn có thể chọn phòng tiếp theo theo thứ tự mình thích.');
      }
    } finally {
      this.roomRunning = null;
      this.refreshMarks();
    }
  }

  private async pickChallenge(cfg: RoomCfg, q: Question, step: number): Promise<void> {
    const objs: THREE.Object3D[] = [];
    const n = q.choices.length;
    const spots: PickSpot[] = q.choices.map((c, i) => {
      const x = cfg.x + (i - (n - 1) / 2) * 1.9;
      const z = cfg.z + 2.0 + step * 0.8;
      const obj = this.place('number_stone', x, z, { opts: { n: c.label, color: CHOICE_COLORS[i % CHOICE_COLORS.length] }, dynamic: true, collide: false, reserve: 0.8 });
      objs.push(obj);
      return { value: c.value, x, z, r: 1.25, obj, label: `Chọn ${c.label}`, icon: '🛡️', auto: false, tag: c.label };
    });
    try {
      await this.pick(q, spots, {
        src: `castle:${cfg.id}:pick`,
        speaker: CAST.hiepsi,
        title: `${cfg.title}: chọn ô đúng`,
        icon: cfg.icon,
        area: { x: cfg.x, z: cfg.z + 2.8, r: 7.2 },
        tags: 2.5,
        showVisual: true,
        onWrong: async (spot) => {
          spot.obj?.position && void this.tween(0.28, (k) => {
            if (spot.obj) spot.obj.position.y = Math.sin(k * Math.PI) * 0.25;
          });
          this.fx.burst('sparkle', [spot.x, 0.8, spot.z], { count: 6 });
          sfx('pop');
        },
        onRight: async (spot) => {
          this.fx.ring(new THREE.Vector3(spot.x, 0.05, spot.z), { color: '#ffd166' });
          spot.obj?.scale.multiplyScalar(1.12);
          await this.wait(0.25);
        },
      });
    } finally {
      for (const o of objs) this.removeObj(o);
    }
  }

  private async runKing(): Promise<void> {
    if (!this.roomsDone()) {
      await say(CAST.vua, ['Cửa đại sảnh còn đóng.', 'Hãy hoàn thành đủ ba phòng thử thách, rồi ta sẽ trao thử thách cuối cùng.']);
      const next = ROOM_IDS.find((id) => !on(this.rooms[id].flag));
      if (next) await this.showPoint(this.rooms[next].x, 2, this.rooms[next].z + 6.2, 1.1, 16);
      return;
    }
    if (on('castle.king')) {
      await say(CAST.vua, ['Nhà Thông Thái nhỏ tuổi đã trở lại!', 'Hãy đội vương miện trong túi và đặt cúp ở nhà nhé.']);
      return;
    }
    if (this.kingRunning) return;
    this.kingRunning = true;
    try {
      this.setThroneDoors(true);
      await say(CAST.vua, ['Con đã vượt qua ba phòng thử thách.', 'Bây giờ là Thử thách của Nhà Vua: 5 câu hỏi tổng hợp!']);
      const topics = GRADE_TOPICS[profile().grade];
      const plan = kingPlan();
      for (let i = 0; i < 5; i++) {
        let q: Question;
        if (plan[i] === 'math') {
          const topic = topics[(Math.floor(this.rnd() * topics.length) + i) % topics.length];
          q = mathQ(topic, { levelDelta: 1, theme: KING_THEME });
        } else q = englishQ(pickEnTopic(), { levelDelta: 1 });
        // Ngắm ngang ngực vua để mặt, râu và cổ áo hiện trọn phía trên thẻ câu hỏi (cả màn hình điện thoại xoay ngang).
        await this.quiz(q, { src: `castle:king:${i}`, speaker: CAST.vua, title: `Thử thách Nhà Vua ${i + 1}/5`, icon: '👑' }, [KING_SPOT.x, KING_SPOT.y + 1.0, KING_SPOT.z], 13);
        this.king.actor.celebrate(0.8);
      }
      setFlag('castle.king');
      reward({ xp: 60, coins: 30, stars: 2, badge: 'nha-toan-hoc', items: { hat_crown: 1, decor_trophy: 1 } });
      this.fx.burst('confetti', [KING_SPOT.x, KING_SPOT.y + 2.5, KING_SPOT.z + 0.3], { count: 90 });
      this.fx.burst('star', [KING_SPOT.x, KING_SPOT.y + 3.4, KING_SPOT.z + 0.3], { count: 34 });
      this.king.actor.celebrate(3);
      sfx('star');
      toast('Bạn nhận vương miện và cúp vàng! Hãy mở túi để đội vương miện, rồi về nhà đặt cúp nhé.', { icon: '👑', tone: 'gold', ms: 5200 });
      await say(CAST.vua, ['Ta tuyên dương con là Nhà Thông Thái của Vương quốc!', 'Vương miện nằm trong túi. Chiếc cúp có thể đặt ở nhà của con.']);
    } finally {
      this.kingRunning = false;
      this.refreshMarks();
    }
  }

  private roomsDone(): boolean {
    return ROOM_IDS.every((id) => on(`castle.${id}`));
  }

  private setGateOpen(id: RoomId, open: boolean): void {
    const gate = this.gates[id];
    if (!gate) return;
    gate.position.y = open ? 3.7 : 0;
    this.setSolid(gate, !open);
  }

  private async openGate(id: RoomId): Promise<void> {
    const gate = this.gates[id];
    if (!gate || gate.position.y > 2) return;
    this.setSolid(gate, false);
    sfx('door');
    await this.tween(0.8, (k) => {
      gate.position.y = 3.7 * k;
    }, { ease: 'outBack' });
  }

  private setThroneDoors(open: boolean): void {
    this.throneDoors.forEach((d, i) => {
      d.position.x = (i === 0 ? -2.05 : 2.05) + (open ? (i === 0 ? -1.7 : 1.7) : 0);
      this.setSolid(d, !open);
    });
  }

  private fadeHallWalls(): void {
    if (!this.hall) return;
    const yaw = this.cam.yaw;
    const sideFade = Math.abs(Math.sin(yaw));
    this.setNamedOpacity(this.hall, /^wall[WE]$/, 1 - sideFade * 0.42);
    this.setNamedOpacity(this.hall, /^wallN$/, 0.96);
  }

  private setNamedOpacity(root: THREE.Object3D, name: RegExp, opacity: number): void {
    root.traverse((o) => {
      if (!name.test(o.name)) return;
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          mat.transparent = opacity < 0.999;
          mat.opacity = opacity;
          mat.depthWrite = opacity > 0.75;
        }
      });
    });
  }
}
