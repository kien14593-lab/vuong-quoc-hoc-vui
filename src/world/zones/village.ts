import { sfx } from '../../core/audio';
import { isCollected, profile, questState, setFlag, setQuestState } from '../../core/state';
import { CAST, villager } from '../../game/cast';
import { mixedQuestion, storyQuestion } from '../../game/challenge';
import { bearStage, on, reward, starsQuestDone, villageStars, VILLAGE_STARS, zoneLock } from '../../game/story';
import { choose, say } from '../../ui/dialog';
import { openQuestBoard } from '../../ui/screens/quests';
import { openShop } from '../../ui/screens/shop';
import { toast } from '../../ui/toast';
import type * as THREE from 'three';
import type { Label } from '../labels';
import type { Npc } from '../zone';
import { Zone, type Spawn } from '../zone';

/** Vị trí các ngôi sao trốn quanh làng (sao thứ 5 bay ra từ những chiếc hộp). */
const STAR_SPOTS: [number, number][] = [
  [-16.5, 11],
  [12.2, 9.2],
  [-12.8, -9.6],
  [21, -9.5],
];
const BOX_C: [number, number] = [5.2, 5.6];
const BEAR_AT: [number, number] = [3.2, -17.6];

const TIPS = [
  'Chào bạn! Hôm nay trời đẹp quá!',
  'Bạn đã ghé Cửa hàng của Cô Mèo chưa? Ở đó có nhiều đồ đẹp lắm!',
  'Nghe nói trong Rừng Thông Thái có cây cầu chỉ hạ xuống khi giải đúng phép cộng đấy!',
  'Mình thích đếm hoa lắm: 1, 2, 3, 4, 5…',
  'Khu Vui Chơi ở phía đông chỉ mở khi bạn có 10 ngôi sao!',
  'Ngôi nhà mái xanh kia là nhà của bạn đó. Vào trang trí đi!',
  'Muốn lên cấp nhanh thì hãy chơi mini-game và giải thật nhiều bài toán nhé!',
];

/** 🏡 NGÔI LÀNG KHỞI ĐẦU – khu hướng dẫn: di chuyển, nói chuyện, trả lời, nhặt vật phẩm. */
export class VillageZone extends Zone {
  private tho!: Npc;
  private bear!: Npc;
  private boxes: THREE.Object3D[] = [];
  private boxSign: Label | null = null;

  constructor(spawn: Spawn) {
    super(
      {
        id: 'village',
        title: 'Ngôi Làng Khởi Đầu',
        icon: '🏡',
        sub: 'Nơi mọi chuyến phiêu lưu bắt đầu',
        music: 'village',
        area: { hw: 28, hd: 24, r: 10 },
        margin: 16,
        seed: 3,
        cam: { yaw: 0, pitch: 50, dist: 17 },
        spawns: {
          start: { x: 0, z: 11, rot: 180 },
          from_forest: { x: 0, z: -19.4, rot: 0 },
          from_park: { x: 23.8, z: -0.6, rot: -90 },
          from_castle: { x: -23.8, z: -10.4, rot: 90 },
          from_house: { x: -13.55, z: 2.0, rot: 0 },
        },
      },
      spawn,
    );
  }

  protected build(): void {
    const t = this.terrain;
    /* ---------- Mặt đất: quảng trường, đường đi, ao ---------- */
    t.plaza(0, -2, 6.6);
    t.path([[0, 23], [0, 15], [0, 4.5]], 2.6);
    t.path([[0, -8.5], [0, -14], [0.4, -19], [0, -25]], 2.6);
    t.path([[6.4, -1], [13, -0.2], [20, -0.6], [29, -0.6]], 2.4);
    t.path([[-6.3, -3.2], [-12, -6.5], [-18, -9.5], [-29, -11]], 2.4);
    t.path([[-13.55, -0.2], [-10, 0.6], [-6.3, 0.4]], 1.6, { kind: 'stone' });
    t.path([[10.45, -1.4], [10.4, 0.2]], 1.4, { kind: 'stone' });
    t.pond(15.2, 12, 4.6, 3.2);
    t.meadow(-16, 10, 4.2, ['#ffffff', '#ffd6e7', '#fff3a6'], 4);
    t.meadow(9, 15, 3.5);
    t.meadow(-6, -16, 3.5);
    t.patch(-15, 10.5, 3.2, '#b8de7f', 0.6);

    /* ---------- Quảng trường ---------- */
    this.place('fountain', 0, -2);
    for (const [x, z, r] of [[-4.6, -6.8, 35], [4.6, -6.8, -35], [-5.9, 1.6, 120]] as [number, number, number][]) this.place('bench', x, z, { rot: r });
    this.place('flower_bed', -3.6, 2.9, { rot: 10 });
    this.place('flower_bed', 3.8, -7.6, { rot: -20 });
    for (const [x, z] of [[2, 9.5], [-2, 15.5], [-2, -10.5], [2, -15.5], [7.2, 1.6], [16.5, 1.8], [-8.2, -5.9], [-16.5, -7], [-6.6, 2.3]] as [number, number][]) this.place('lamp_post', x, z);
    this.place('notice_board', -4.2, 5.2, { rot: 25, dynamic: true, name: 'board' });
    this.sign(-4.2, 5.2, '📋 Bảng nhiệm vụ', { y: 3.1 });
    this.interact({
      id: 'board',
      x: -4.2,
      z: 5.6,
      r: 2,
      label: 'Xem bảng nhiệm vụ',
      icon: '📋',
      run: () => openQuestBoard(),
    });

    /* ---------- Nhà của bạn (phía tây) ---------- */
    this.place('house_player', -13, -2, { rot: 0 });
    this.place('mailbox', -10.9, 0.9, { rot: -20 });
    this.place('flower_pot', -15.4, 0.4);
    this.place('flower_pot', -11.7, 0.3);
    this.sign(-13, -2, '🏠 Nhà của bạn', { y: 5.2, maxDist: 40 });
    this.door(-13.55, 0.35, 'house', 'from_village', { label: 'Vào nhà', icon: '🏠' });
    // Vườn nhỏ có hàng rào
    this.place('fence', -16, 13.4, { opts: { len: 7, style: 'picket' }, rot: 0 });
    this.place('fence', -19.6, 10.4, { opts: { len: 6, style: 'picket' }, rot: 90 });
    this.place('tree_apple', -18.3, 7.6);
    this.place('wheelbarrow', -12.6, 12.6, { rot: 30 });

    /* ---------- Cửa hàng Cô Mèo (phía đông) ---------- */
    this.place('shop_math', 12, -3, { rot: 0 });
    this.sign(12, -3, '🛍️ Cửa hàng Cô Mèo', { y: 5, maxDist: 40 });
    const stand = this.place('crate_fruit', 13.9, 0.9, { rot: -10, opts: { fruit: 'apple' }, dynamic: true });
    this.place('crate_fruit', 14.9, 0.5, { rot: 12, opts: { fruit: 'banana' } });
    this.npc(CAST.meo.art, 11.6, 0.4, {
      name: CAST.meo.name,
      color: CAST.meo.color,
      rot: 0,
      action: 'Mua sắm',
      icon: '🛍️',
      mark: () => (on('intro.done') && !on('shop.fruit') ? '!' : ''),
      talk: async () => {
        if (!on('shop.fruit')) {
          await say(CAST.meo, ['Chào bạn! Mình là Cô Mèo, chủ cửa hàng này.', 'Ở đây bạn có thể dùng xu để mua áo, mũ, balo, thú cưng và đồ trang trí nhà.', 'Nhưng trước tiên, bạn giải giúp cô bài toán mua trái cây này nhé!']);
          await this.quiz(storyQuestion('shopFruit'), { src: 'village:shop', speaker: CAST.meo, title: 'Mua trái cây', icon: '🍎' }, stand, 10);
          setFlag('shop.fruit');
          reward({ items: { apple: 1, banana: 1 } });
          toast('Cô Mèo tặng bạn 1 quả táo và 1 quả chuối!', { icon: '🍎', tone: 'good' });
          await say(CAST.meo, ['Giỏi quá! Bạn tính tiền rất nhanh.', 'Mời bạn xem hàng nhé!']);
        } else await say(CAST.meo, 'Mời bạn vào xem hàng nhé! Hôm nay có nhiều đồ mới lắm.');
        await openShop();
      },
    });
    this.miniSpot('market', 17.4, 2.6, { model: 'fruit_stand', rot: -35 });

    /* ---------- Cổng rừng (phía bắc) ---------- */
    this.place('gate_arch', 0, -19.8, { opts: { text: 'Rừng Thông Thái', color: '#6fbf73', w: 4.6 } });
    this.place('signpost', -3.4, -16.6, { rot: 20, opts: { labels: ['Rừng', 'Làng'] } });
    this.portal(0, -22.4, 'forest', 'from_village', { label: 'Rừng Thông Thái', lock: () => zoneLock('forest') });

    /* ---------- Đường tới Khu Vui Chơi (đông) & Lâu Đài (tây) ---------- */
    this.place('signpost', 21.2, 2.8, { rot: -30, opts: { labels: ['Vui chơi', 'Làng'] } });
    this.portal(26.6, -0.6, 'park', 'from_village', { label: 'Khu Vui Chơi', lock: () => zoneLock('park') });
    this.place('signpost', -21, -7, { rot: 30, opts: { labels: ['Lâu đài', 'Làng'] } });
    this.portal(-26.4, -11, 'castle', 'from_village', { label: 'Lâu Đài Trí Tuệ', lock: () => zoneLock('castle') });

    /* ---------- Nhà dân, cối xay gió, giếng ---------- */
    this.place('house_cottage', -8.4, -12.4, { rot: 12, opts: { v: 1 } });
    this.place('house_cottage', 8.6, -12.6, { rot: -12, opts: { v: 2 } });
    this.place('house_cottage', -21.5, 2.5, { rot: 90, opts: { v: 3 } });
    this.place('house_cottage', 21.5, 9, { rot: -100, opts: { v: 4 } });
    this.place('windmill', 18.5, -14.5, { rot: -25 });
    this.place('well', -6.4, 8.4);
    this.place('hay_bale', 15.5, -11.2, { rot: 20 });
    this.place('hay_bale', 16.6, -10.4, { rot: -15 });
    this.place('barrel', -10.3, -10.2);
    this.place('crate', 6.2, -10.4, { rot: 15 });
    this.place('picnic', 9.4, 15.5, { rot: -10, collide: false });
    this.place('umbrella_table', -9, 15.6);

    /* ---------- Ao vịt ---------- */
    for (const [x, z] of [[13.4, 11.2], [16.8, 13.1], [15.6, 10.6]] as [number, number][]) this.place('lilypad', x, z, { y: 0.02, collide: false, reserve: false, rot: x * 40 });
    this.place('reeds', 19.6, 11.8, { collide: false });
    this.place('reeds', 11, 13.2, { collide: false });
    const ducks = [this.place('critter_duck', 14.5, 12.2, { dynamic: true, collide: false }), this.place('critter_duck', 16, 12.8, { dynamic: true, collide: false, scale: 0.8 })];
    this.addTick((_dt, tt) => {
      ducks.forEach((d, i) => {
        const a = tt * 0.35 + i * 2.6;
        d.position.set(15.2 + Math.cos(a) * (2.4 - i * 0.6), 0.04, 12 + Math.sin(a) * (1.5 - i * 0.4));
        d.rotation.y = -a;
      });
    });

    /* ---------- Hộp đếm (nhiệm vụ đầu tiên) ---------- */
    const boxSpots: [number, number, string][] = [
      [BOX_C[0] - 0.85, BOX_C[1] + 0.35, '#ff9ec7'],
      [BOX_C[0] + 0.25, BOX_C[1] - 0.45, '#6cb8ff'],
      [BOX_C[0] + 0.7, BOX_C[1] + 0.7, '#7bd389'],
    ];
    this.boxes = boxSpots.map(([x, z, color], i) => this.place('count_box', x, z, { rot: i * 25 - 20, opts: { color }, dynamic: true }));
    this.interact({
      id: 'boxes',
      x: BOX_C[0],
      z: BOX_C[1],
      r: 2.7,
      label: 'Đếm hộp',
      icon: '📦',
      obj: this.boxes[1],
      enabled: () => on('intro.done') && !on('village.boxes'),
      run: () => this.countBoxes(),
    });
    if (on('village.boxes')) this.pickup('star', BOX_C[0], BOX_C[1] + 1.9, { id: 'village.star.box', onPick: () => this.onStar() });
    this.boxSign = this.sign(BOX_C[0], BOX_C[1], '📦 ?', { y: 1.6, cls: 'sign small', maxDist: 22 });
    this.boxSign.show(!on('village.boxes'));

    /* ---------- Sao ---------- */
    STAR_SPOTS.forEach(([x, z], i) => this.pickup('star', x, z, { id: VILLAGE_STARS[i + 1], onPick: () => this.onStar() }));

    /* ---------- Nhân vật ---------- */
    this.tho = this.npc(CAST.tho.art, 2.4, 5.2, {
      name: CAST.tho.name,
      color: CAST.tho.color,
      rot: 0,
      mark: () => {
        if (!on('intro.done')) return '!';
        if (questState('stars') === 'done') return '';
        return villageStars() >= 5 ? '!' : '?';
      },
      talk: () => this.talkTho(),
    });
    this.bear = this.npc(CAST.gau.art, BEAR_AT[0], BEAR_AT[1], {
      name: CAST.gau.name,
      color: CAST.gau.color,
      rot: 200,
      visible: () => starsQuestDone() && bearStage() === 'none',
      mark: () => '!',
      talk: () => this.talkBear(),
    });
    const vs: [number, number, number, number][] = [
      [0, -4.5, -10.5, 3],
      [2, 8.5, 7.5, 3],
      [4, -15, 5.5, 2.5],
      [1, 12, -7.5, 2.5],
    ];
    vs.forEach(([v, x, z, w], i) => {
      const sp = villager(v);
      this.npc('npc_villager', x, z, {
        name: sp.name,
        color: sp.color,
        opts: { v },
        wander: w,
        rot: this.rnd() * 360,
        talk: async (npc) => {
          if (v === 4) {
            await say(sp, 'Bà có một câu đố nhỏ cho cháu đây!');
            await this.quiz(mixedQuestion(), { src: 'village:riddle', speaker: sp, title: 'Câu đố của Bà Ba', icon: '🧩' }, npc.actor, 10);
            await say(sp, 'Cháu giỏi quá! Lúc nào rảnh lại ghé chơi với bà nhé.');
            return;
          }
          await say(sp, TIPS[(i * 2 + Math.floor(this.rnd() * TIPS.length)) % TIPS.length]);
        },
      });
    });
    this.miniSpot('number_match', -8.2, 13, { model: 'question_board', rot: 20 });

    /* ---------- Cây cối & trang trí ---------- */
    for (const [x, z, k] of [[-6, -18.5, 'tree_blossom'], [6.5, -18.3, 'tree_round'], [-24, -2, 'tree_tall'], [24.5, -6.5, 'tree_round'], [-24, 14, 'tree_blossom'], [24, 16, 'tree_apple'], [5.2, 17.8, 'tree_round'], [-4.6, 19.8, 'tree_blossom']] as [number, number, string][]) this.place(k, x, z, { rot: x * 17 });
    this.scatter(['tree_round', 'tree_blossom', 'tree_apple', 'tree_tall'], 14, { gap: 4.2, scale: [0.9, 1.2] });
    this.scatter(['bush', 'bush', 'flower_bed', 'rock'], 14, { gap: 2.2, scale: [0.8, 1.15] });
    this.scatter(['flower', 'tulip', 'grass', 'grass', 'mushroom'], 70, { gap: 0.9, collide: false, pathGap: 0.5 });
    this.border(['tree_round', 'tree_pine', 'tree_tall', 'tree_blossom', 'tree_round', 'bush']);
    const flies = [this.place('critter_butterfly', -15, 9.5, { dynamic: true, collide: false }), this.place('critter_butterfly', 8.6, 14.6, { dynamic: true, collide: false })];
    this.addTick((_dt, tt) => {
      flies.forEach((b, i) => {
        const a = tt * (0.6 + i * 0.15) + i * 3;
        const [cx, cz] = i === 0 ? [-15.5, 10] : [9, 15];
        b.position.set(cx + Math.cos(a) * 2.2, 1.1 + Math.sin(tt * 2.3 + i) * 0.35, cz + Math.sin(a * 1.3) * 1.6);
        b.rotation.y = -a + Math.PI / 2;
      });
    });
    for (const [x, z] of [[-5, 10], [-7.5, 9.8]] as [number, number][]) this.place('critter_chick', x, z, { dynamic: true, collide: false, rot: x * 50 });
  }

  protected afterBuild(): void {
    if (!on('intro.done')) {
      const p = this.player.pos;
      this.tho.actor.setPos(p.x + 2.4, p.z - 4.6);
      this.tho.actor.face(p.x, p.z, true);
    }
  }

  protected onEnter(first: boolean): void {
    if (first && !on('intro.done')) void this.runInteract({ id: 'intro', x: 0, z: 0, r: 0, label: '', icon: '', run: () => this.intro() });
  }

  /* ================= Kịch bản ================= */
  private async intro(): Promise<void> {
    const tho = this.tho.actor;
    await this.wait(0.5);
    tho.waving = true;
    this.bubble(tho.root, 'Xin chào! 👋', tho.height + 0.9, 1800);
    await this.wait(1.1);
    tho.waving = false;
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    await say(CAST.tho, [`Chào mừng ${profile().name} đến Vương Quốc Học Vui!`, 'Mình là Thỏ Bông. Hãy giúp mình tìm 5 ngôi sao nhé!']);
    await say(
      CAST.tho,
      touch
        ? ['Kéo cần điều khiển ở góc trái để đi. Chạm vào mặt đất để đi tới đó.', 'Khi đứng gần ai hoặc đồ vật, hãy chạm nút tròn to ở giữa để nói chuyện.']
        : ['Dùng phím mũi tên hoặc W A S D để đi, phím Space để nhảy. Bạn cũng có thể bấm chuột xuống đất để đi tới đó.', 'Khi đứng gần ai hoặc đồ vật, hãy bấm phím E (hoặc nút tròn to) để nói chuyện.'],
    );
    await this.showPoint(BOX_C[0], 0.6, BOX_C[1], 1.2, 10);
    await say(CAST.tho, 'Trước tiên, bạn hãy lại gần những chiếc hộp kia và đếm xem có bao nhiêu chiếc nhé!');
    setFlag('intro.done');
    setQuestState('stars', 'active');
    sfx('star');
  }

  private async countBoxes(): Promise<void> {
    this.player.face(BOX_C[0], BOX_C[1]);
    await say(CAST.tho, 'Bạn hãy đếm xem có tất cả bao nhiêu chiếc hộp nhé!');
    await this.quiz(storyQuestion('villageBoxes'), { src: 'village:boxes', speaker: CAST.tho, title: 'Đếm hộp', icon: '📦', noVisual: true }, [BOX_C[0], 0.4, BOX_C[1]], 9);
    setFlag('village.boxes');
    this.boxSign?.show(false);
    sfx('correct');
    this.boxes.forEach((b, i) => {
      const y0 = b.position.y;
      void this.tween(0.42, (k) => (b.position.y = y0 + Math.sin(k * Math.PI) * 0.7), { delay: i * 0.16, ease: 'linear' });
      void this.tween(0.42, (k) => (b.rotation.y += Math.sin(k * Math.PI) * 0.08), { delay: i * 0.16, ease: 'linear' });
    });
    this.fx.burst('sparkle', [BOX_C[0], 0.9, BOX_C[1]], { count: 26 });
    await this.wait(0.7);
    this.fx.burst('star', [BOX_C[0], 1.2, BOX_C[1] + 1.9], { count: 14 });
    this.pickup('star', BOX_C[0], BOX_C[1] + 1.9, { id: 'village.star.box', onPick: () => this.onStar() });
    await say(CAST.tho, ['🎉 Chính xác! Tuyệt vời! Có 3 chiếc hộp.', 'Ôi, một ngôi sao bay ra kìa! Bạn đi tới nhặt nhé.', 'Còn 4 ngôi sao nữa đang trốn quanh làng. Mình cùng tìm nhé!']);
  }

  private onStar(): void {
    const n = villageStars();
    if (n >= 5 && questState('stars') !== 'done') {
      toast('Đủ 5 ngôi sao rồi! Quay lại gặp Thỏ Bông nhé!', { icon: '⭐', tone: 'gold', ms: 3800 });
      this.bubble(this.tho.actor.root, 'Bạn tìm đủ rồi! 🎉', this.tho.actor.height + 0.9, 3000);
    } else if (n < 5) toast(`Ngôi sao ${n}/5`, { icon: '⭐', tone: 'gold', ms: 1800 });
  }

  private nearestStar(): [number, number] | null {
    const p = this.player.pos;
    let best: [number, number] | null = null;
    let bd = Infinity;
    STAR_SPOTS.forEach((s, i) => {
      if (isCollected(VILLAGE_STARS[i + 1])) return;
      const d = Math.hypot(s[0] - p.x, s[1] - p.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    });
    return best;
  }

  private async talkTho(): Promise<void> {
    if (!on('intro.done')) return this.intro();
    if (questState('stars') === 'done') {
      await say(CAST.tho, starsQuestDone() && bearStage() === 'none' ? 'Chú Gấu đang đợi bạn ở cổng rừng phía bắc đấy!' : TIPS[Math.floor(Math.random() * TIPS.length)]);
      return;
    }
    if (!on('village.boxes')) {
      await say(CAST.tho, 'Bạn hãy lại gần những chiếc hộp và đếm xem có bao nhiêu chiếc nhé!');
      await this.showPoint(BOX_C[0], 0.6, BOX_C[1], 1, 10);
      return;
    }
    const n = villageStars();
    if (n < 5) {
      await say(CAST.tho, `Bạn đã tìm được ${n}/5 ngôi sao rồi. Giỏi lắm!`);
      const s = this.nearestStar();
      if (s) {
        await say(CAST.tho, 'Mình thấy một ngôi sao lấp lánh ở đằng kia!');
        await this.showPoint(s[0], 1, s[1], 1.3, 12);
      } else if (!isCollected('village.star.box')) await say(CAST.tho, 'Còn ngôi sao bay ra từ những chiếc hộp nữa đấy!');
      return;
    }
    await say(CAST.tho, ['Oa! Bạn đã tìm đủ 5 ngôi sao rồi!', 'Cảm ơn bạn nhiều lắm. Đây là quà của mình nhé!']);
    reward({ xp: 30, coins: 15, badge: 'ngoi-sao-lang' });
    setQuestState('stars', 'done');
    this.tho.actor.celebrate(2);
    this.fx.burst('confetti', [this.tho.actor.pos.x, 1.5, this.tho.actor.pos.z], { count: 50 });
    this.refreshMarks();
    await say(CAST.tho, ['Ở cổng rừng phía bắc, Chú Gấu đang cần người giúp đỡ đấy.', 'Bạn hãy tới nói chuyện với chú nhé!']);
    await this.showPoint(BEAR_AT[0], 1.4, BEAR_AT[1], 1.4, 12);
  }

  private async talkBear(): Promise<void> {
    await say(CAST.gau, ['Chào bạn nhỏ! Mình là Chú Gấu.', 'Mình muốn đến Sở Thú thăm bạn Hươu cao cổ, nhưng đường đi có nhiều thử thách toán học quá.']);
    const c = await choose(CAST.gau, 'Bạn đi cùng mình nhé?', ['Đi thôi! 🐻', 'Để lát nữa nhé']);
    if (c !== 0) {
      await say(CAST.gau, 'Không sao, mình sẽ đợi bạn ở đây!');
      return;
    }
    setFlag('bear.start');
    sfx('unlock');
    this.bear.actor.celebrate(1.5);
    await say(CAST.gau, ['Tuyệt quá! Mình cùng đi qua Rừng Thông Thái nhé.', 'Cổng rừng ở ngay đây. Đi thôi!']);
    this.buddyFrom = { x: this.bear.actor.pos.x, z: this.bear.actor.pos.z };
  }
}
