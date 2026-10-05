import * as THREE from 'three';
import { audio, sfx } from '../core/audio';
import { speak, speakParts, stopSpeech } from '../core/speech';
import { addCoins, addXp, playerLook, profile, recordMini, skill } from '../core/state';
import { engine, warmUp, type Quality, type Stage } from '../engine/core';
import { Fx } from '../engine/fx';
import { setupLights, setupSky, type LightRig } from '../engine/lighting';
import { disposeTree } from '../engine/merge';
import { cancelOwner, tween, type Handle, type TweenOpts } from '../engine/tween';
import type { EnOptions } from '../english/gen';
import { english, type EnglishModule } from '../english/load';
import { AttemptTracker, finishQuestion, type SubmitResult } from '../game/challenge';
import { apart, englishQ, enOpts, mathQ, mixedQ, pickEnTopic, playSubject } from '../game/subject';
import { pickTopic } from '../math/engine';
import { makeQ } from '../math/util';
import type { EnTopic, Grade, MathTopic, Question, Subject, Topic, WordTheme } from '../math/types';
import { buildModel, collectTicks } from '../models/registry';
import { animateRig, rigOf, type AnimState, type Rig } from '../models/rig';
import { uiInsets } from '../ui/root';
import { miniCard, type MiniCard, type MiniText } from './registry';
import { MiniUI } from './ui';

/**
 * Nền tảng chung cho 12 trò chơi nhỏ (mini-game) 3D.
 * Mỗi trò kế thừa `MiniGame`, dựng cảnh trong `build()`, chạy các vòng chơi trong `play()`
 * và cập nhật mỗi khung hình trong `tick()`. Lớp nền lo: ánh sáng, bầu trời, camera,
 * giao diện (tiêu đề, điểm, vòng, đề bài, phản hồi, nút đáp án), ghi nhận học tập và phần thưởng.
 */
export interface MiniInfo {
  id: string;
  name: string;
  icon: string;
  /** Kỹ năng luyện tập (hiển thị), ví dụ "Cộng / trừ". */
  skill: string;
  /** Các chủ đề toán được dùng (để sinh câu hỏi và cho bảng phụ huynh). */
  topics: MathTopic[];
  /** Cách chơi – 1–2 câu ngắn cho trẻ. */
  desc: string;
  /** Số vòng mỗi lượt chơi. */
  rounds: number;
  /** Màu chủ đạo. */
  color: string;
  /** Cấp nhân vật cần đạt để mở khóa (1 = mở sẵn). */
  unlock: number;
  /** Tên, kĩ năng và cách chơi khi học Tiếng Anh. */
  en: MiniText;
  /** Tên chung khi hồ sơ học cả hai môn (sảnh, biển trong thế giới). */
  both: string;
  /** Kĩ năng Tiếng Anh của câu hỏi chung (mặc định: các kĩ năng của lớp). */
  enTopics?: EnTopic[];
}

export interface MiniResult {
  id: string;
  score: number;
  max: number;
  stars: number;
  coins: number;
  xp: number;
  best: boolean;
  /** Môn của lượt chơi. */
  subject: Subject;
}

export interface MiniHost {
  /** Kết thúc trò chơi: `again` = chơi lại lượt mới. `result` = null nếu thoát giữa chừng. */
  exit(result: MiniResult | null, again: boolean): void;
}

/** Một câu hỏi đang diễn ra trong vòng chơi. */
export interface MiniRound {
  q: Question;
  tracker: AttemptTracker;
  /** Promise hoàn tất khi trẻ đã trả lời đúng. */
  done: Promise<void>;
  /** Ghi nhận một lựa chọn của trẻ; tự hiện phản hồi theo kịch bản (đúng / thử lại / gợi ý / từng bước). */
  submit(value: string): SubmitResult;
  readonly solved: boolean;
}

type Tick = (dt: number, t: number) => void;

export abstract class MiniGame implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  readonly lights: LightRig;
  readonly fx: Fx;
  readonly ui: MiniUI;
  readonly grade: Grade;
  /** Môn của lượt chơi ('both': chọn một môn cho cả lượt, nghiêng về môn bé cần luyện hơn). */
  readonly subj: Subject;
  /** Tên, biểu tượng, kĩ năng, cách chơi của lượt này (theo môn). */
  readonly card: MiniCard;
  /** Điểm hiện tại (mỗi vòng: đúng ngay lần đầu 3 điểm, lần 2: 2 điểm, sau đó 1 điểm). */
  score = 0;
  /** Vòng hiện tại (bắt đầu từ 0). */
  round = 0;
  /** Đang tạm dừng gameplay (màn hướng dẫn / kết quả). */
  paused = true;
  ended = false;
  /** Câu hỏi đang chờ trả lời (null nếu không có). */
  current: MiniRound | null = null;
  private ticks = new Set<Tick>();
  private actors = new Map<THREE.Object3D, { rig: Rig; st: AnimState }>();
  private offs: (() => void)[] = [];
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private disposed = false;

  constructor(
    readonly info: MiniInfo,
    protected host: MiniHost,
  ) {
    this.grade = profile().grade;
    this.subj = playSubject();
    this.card = miniCard(info, this.subj);
    setupSky(this.scene, '#9fd8f7', '#eaf6e4', 60, 160);
    this.lights = setupLights(this.scene, engine.quality, 22);
    this.lights.follow(new THREE.Vector3(0, 0, 0));
    this.fx = new Fx(this.scene);
    this.ui = new MiniUI(info, this.card, { onQuit: () => this.quit() });
    this.camera.position.set(0, 9, 14);
    this.camera.lookAt(0, 0, 0);
  }

  /* ================================================================== */
  /* Vòng đời – các trò chơi cài đặt                                     */
  /* ================================================================== */
  /** Dựng cảnh 3D (gọi một lần trước màn hướng dẫn). */
  protected abstract build(): void;
  /**
   * Chạy toàn bộ các vòng chơi (async). Mỗi vòng thường: tạo câu hỏi → dựng đối tượng → chờ trẻ trả lời đúng
   * → `if (!(await this.nextRound())) break;`. Khi play() kết thúc, lớp nền tự hiện bảng kết quả.
   */
  protected abstract play(): Promise<void>;
  /** Cập nhật gameplay mỗi khung hình (chỉ chạy khi không tạm dừng). */
  protected tick(_dt: number, _t: number): void {}

  /** Bắt đầu: dựng cảnh, hướng dẫn, chơi, kết quả. Gọi sau `engine.setStage(game)`. */
  async begin(): Promise<void> {
    audio.music('mini');
    this.build();
    // Biên dịch trước shader + đưa ảnh lên GPU trong lúc màn hướng dẫn hiện (vào chơi không bị khựng).
    void warmUp(this.scene, { camera: this.camera, scene: this.scene });
    this.ui.setRound(0, this.info.rounds);
    this.ui.setScore(0);
    await this.ui.intro();
    if (this.disposed) return;
    this.paused = false;
    try {
      await this.play();
    } catch (e) {
      if (!this.disposed) console.error(e);
    }
    if (!this.disposed && !this.ended) await this.end();
  }

  update(dt: number, t: number): void {
    if (!this.paused) this.tick(dt, t);
    for (const fn of this.ticks) fn(dt, t);
    for (const [obj, a] of this.actors) {
      if (!obj.parent) continue;
      a.st.t = t;
      a.st.dt = dt;
      animateRig(a.rig, a.st);
    }
    this.fx.update(dt);
  }

  onQuality(q: Quality): void {
    this.lights.setQuality(q);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.paused = true;
    cancelOwner(this);
    stopSpeech();
    for (const off of this.offs) off();
    this.offs = [];
    this.ui.destroy();
    this.scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isLight) l.dispose();
    });
    disposeTree(this.scene);
    // Ảnh bầu trời không nằm trong cây cảnh; hủy nó mới giải phóng cả khối lập phương 256² three dựng từ nó.
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.current = null;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /* ================================================================== */
  /* Tiện ích 3D                                                          */
  /* ================================================================== */
  /** Bầu trời + sương mù. */
  sky(top: string, horizon: string, fogNear = 60, fogFar = 160): void {
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    setupSky(this.scene, top, horizon, fogNear, fogFar);
  }

  /** Đặt camera: vị trí và điểm nhìn. */
  view(pos: [number, number, number], look: [number, number, number], fov = 40): void {
    this.camera.fov = fov;
    this.camera.position.set(...pos);
    this.camera.lookAt(...look);
    this.camera.updateProjectionMatrix();
    this.lights.follow(new THREE.Vector3(look[0], 0, look[2]));
  }

  /** Mặt đất phẳng nhận bóng. */
  ground(color: string, w = 80, d = 80, y = 0): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color }));
    m.position.y = y;
    m.receiveShadow = true;
    m.name = 'ground';
    this.scene.add(m);
    return m;
  }

  /**
   * Dựng mô hình theo khóa (xem danh sách trong src/models) và thêm vào cảnh, bọc trong một Group
   * (đặt vị trí/góc/tỉ lệ trên Group này). Hàm `tick` trong mô hình tự chạy; mô hình có khung (rig)
   * tự hoạt cảnh (thở, chớp mắt) – dùng `anim(obj)` để cho đi/vẫy tay/vui mừng.
   * Khóa 'player' không kèm tùy chọn = bé của hồ sơ đang chơi (bé trai / bé gái, bộ đồ, mũ, balo, phụ kiện đang mặc).
   */
  model<O = Record<string, unknown>>(key: string, opts?: O, at: [number, number, number] = [0, 0, 0], rotY = 0, scale = 1, parent: THREE.Object3D = this.scene): THREE.Group {
    const obj = buildModel(key, opts ?? (key === 'player' ? (playerLook() as O) : undefined));
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.noShadow) o.castShadow = true;
    });
    const g = new THREE.Group();
    g.add(obj);
    g.position.set(...at);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    g.userData.key = key;
    parent.add(g);
    for (const fn of collectTicks(obj)) this.ticks.add(fn);
    const rig = rigOf(obj);
    if (rig) this.actors.set(g, { rig, st: { t: 0, dt: 0, move: 0 } });
    return g;
  }

  /** Trạng thái hoạt cảnh của một mô hình có khung: đặt move (0..1), talk, wave, happy (0..1), air, run. */
  anim(obj: THREE.Object3D): AnimState | null {
    return this.actors.get(obj)?.st ?? null;
  }

  /** Gỡ đối tượng khỏi cảnh và giải phóng. */
  remove(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      if (typeof o.userData.tick === 'function') this.ticks.delete(o.userData.tick);
    });
    this.actors.delete(obj);
    obj.parent?.remove(obj);
    disposeTree(obj);
  }

  /**
   * Mẫu ẩn của đồ vật chỉ xuất hiện khi đang chơi (vd. bảng đáp án hai mặt của mỗi vòng): gọi trong build() để begin()
   * biên dịch trước shader của nó lúc màn hướng dẫn hiện – vòng đầu không khựng. Mẫu ở lại (ẩn, không hoạt cảnh)
   * đến hết trò: hủy sớm thì three bỏ luôn shader vừa biên dịch.
   */
  protected prime(...objs: THREE.Object3D[]): void {
    for (const obj of objs) {
      obj.traverse((o) => {
        if (typeof o.userData.tick === 'function') this.ticks.delete(o.userData.tick);
        this.actors.delete(o);
      });
      obj.visible = false;
      if (!obj.parent) this.scene.add(obj);
    }
  }

  /** Thêm hàm chạy mỗi khung hình (kể cả khi tạm dừng). Trả về hàm hủy. */
  onTick(fn: Tick): () => void {
    this.ticks.add(fn);
    return () => this.ticks.delete(fn);
  }

  /** Chuyển động theo thời gian (tự hủy khi thoát trò chơi). */
  tween(dur: number, fn: (k: number) => void, o: Omit<TweenOpts, 'owner'> = {}): Handle {
    return tween(dur, fn, { ...o, owner: this });
  }

  /** Chờ (giây, theo thời gian trò chơi). */
  wait(sec: number): Handle {
    return tween(sec, () => {}, { owner: this, ease: 'linear' });
  }

  /** Tia từ camera qua điểm chạm trên màn hình. */
  ray(clientX: number, clientY: number): THREE.Raycaster {
    const r = engine.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster;
  }

  /** Đối tượng nào (trong danh sách) bị chạm vào. Trả về phần tử của `targets` chứa điểm chạm. */
  pick<T extends THREE.Object3D>(clientX: number, clientY: number, targets: T[]): T | null {
    const hits = this.ray(clientX, clientY).intersectObjects(targets, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        const idx = targets.indexOf(o as T);
        if (idx >= 0) return targets[idx];
        o = o.parent;
      }
    }
    return null;
  }

  /** Điểm trên mặt phẳng ngang y = `y` dưới điểm chạm. */
  groundPoint(clientX: number, clientY: number, y = 0): THREE.Vector3 | null {
    const p = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    return this.ray(clientX, clientY).ray.intersectPlane(plane, p);
  }

  /** Tọa độ giao diện (logic, gốc ở góc vùng an toàn như .mg-root) của một điểm 3D – để đặt nhãn HTML trên vật thể. */
  toScreen(p: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const v = p.clone().project(this.camera);
    const { w, h } = this.ui.size();
    // Hình 3D phủ cả lề an toàn (tai thỏ, vạch Home) còn giao diện thì không.
    const sa = uiInsets();
    const fw = w + sa.l + sa.r;
    const fh = h + sa.t + sa.b;
    return { x: ((v.x + 1) / 2) * fw - sa.l, y: ((1 - v.y) / 2) * fh - sa.t, visible: v.z < 1 };
  }

  /**
   * Bắt sự kiện chạm/chuột trên vùng 3D. `tap` = nhấn-thả không kéo; `down`/`move`/`up` = thô.
   * Tự gỡ khi thoát. Không gọi khi đang tạm dừng (trừ khi `always`).
   */
  onPointer(type: 'tap' | 'down' | 'move' | 'up', fn: (e: PointerEvent) => void, always = false): () => void {
    const c = engine.canvas;
    let sx = 0;
    let sy = 0;
    let st = 0;
    const ok = () => always || (!this.paused && !this.ended);
    const offs: (() => void)[] = [];
    const on = (name: string, h: (e: PointerEvent) => void) => {
      c.addEventListener(name, h as EventListener);
      offs.push(() => c.removeEventListener(name, h as EventListener));
    };
    if (type === 'tap') {
      on('pointerdown', (e) => {
        sx = e.clientX;
        sy = e.clientY;
        st = performance.now();
      });
      on('pointerup', (e) => {
        if (!ok()) return;
        if (Math.hypot(e.clientX - sx, e.clientY - sy) < 14 && performance.now() - st < 800) fn(e);
      });
    } else {
      const fire = (e: PointerEvent) => {
        if (ok()) fn(e);
      };
      on(`pointer${type}`, fire);
      // Ngón tay bị hủy giữa chừng (cử chỉ hệ thống, thông báo...) cũng tính là nhấc tay: không kẹt ở trạng thái đang kéo.
      if (type === 'up') on('pointercancel', fire);
    }
    const off = () => offs.forEach((f) => f());
    this.offs.push(off);
    return off;
  }

  /** Bắt phím (keydown) khi đang chơi. Tự gỡ khi thoát. */
  onKey(fn: (e: KeyboardEvent) => void): () => void {
    const h = (e: KeyboardEvent) => {
      if (this.paused || this.ended) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      fn(e);
    };
    window.addEventListener('keydown', h);
    const off = () => window.removeEventListener('keydown', h);
    this.offs.push(off);
    return off;
  }

  /* ================================================================== */
  /* Toán học                                                             */
  /* ================================================================== */
  /** Mức kỹ năng hiện tại của trẻ ở một chủ đề (1..maxLevel). */
  level(topic: Topic): number {
    return skill(topic).level;
  }

  /** Câu hỏi thích ứng theo năng lực, trong các chủ đề của trò chơi (hoặc chủ đề chỉ định). Lượt Tiếng Anh: câu Tiếng Anh. */
  question(topics: MathTopic | MathTopic[] = this.info.topics, theme?: WordTheme): Question {
    if (this.isEn) return this.enQ();
    const list = Array.isArray(topics) ? topics : [topics];
    return apart(() => (list.length === 1 ? mathQ(list[0], { theme }) : mixedQ({ math: list, theme, s: 'math' })));
  }

  /** Lượt chơi này học Tiếng Anh. */
  get isEn(): boolean {
    return this.subj === 'english';
  }

  /** Bộ câu hỏi Tiếng Anh (đã tải khi vào khu vực – chỉ dùng trong lượt Tiếng Anh). */
  get E(): EnglishModule {
    const m = english();
    if (!m) throw new Error('Chưa tải bộ câu hỏi Tiếng Anh');
    return m;
  }

  /** Tùy chọn Tiếng Anh theo hồ sơ (lớp, Unit N, giọng đọc, chế độ hỗ trợ của kĩ năng `topic`). */
  enOpts(topic?: EnTopic, extra: Partial<EnOptions> = {}): EnOptions {
    return enOpts(topic, extra);
  }

  /**
   * Câu hỏi Tiếng Anh theo năng lực, trong các kĩ năng của trò chơi (hoặc `topics`).
   * `en`: nhãn ngắn cho vật thể 3D, số phương án, chủ đề từ…
   */
  enQ(en: Partial<EnOptions> = {}, topics: readonly EnTopic[] | undefined = this.info.enTopics): Question {
    return apart(() => englishQ(pickEnTopic(topics, en), { en }));
  }

  /**
   * Câu hỏi Tiếng Anh riêng của trò chơi (bộ dựng trong english/mini.ts) ở mức kĩ năng `topic` của bé.
   * Trả về null nếu bộ dựng không tìm được từ phù hợp – trò chơi dùng câu dự phòng (enQ).
   */
  enMake<T>(topic: EnTopic, make: (E: EnglishModule, o: EnOptions, level: number) => T | null, extra: Partial<EnOptions> = {}): T | null {
    return make(this.E, enOpts(topic, extra), this.level(topic));
  }

  /** Câu hỏi Tiếng Anh ở kĩ năng `topic`, mức cố định `level` (vòng đơn giản xen giữa các vòng khó). */
  enAt(topic: EnTopic, level: number, extra: Partial<EnOptions> = {}): Question {
    return apart(() => englishQ(topic, { level, en: extra }));
  }

  /** Chọn một kĩ năng Tiếng Anh trong `list` theo lớp/Unit của bé (cho trò chơi có nhiều kiểu vòng). */
  enTopic(list: readonly EnTopic[], extra: Partial<EnOptions> = {}): EnTopic {
    return pickEnTopic(list, extra);
  }

  /** Chọn một chủ đề trong danh sách (ngẫu nhiên, ưu tiên đều). */
  pickTopic(topics: MathTopic[] = this.info.topics): MathTopic {
    return pickTopic(topics);
  }

  /** Tạo câu hỏi tự soạn (cho trò chơi tự sinh số). `answer` là giá trị đúng; `accept` = nhiều đáp án đúng. */
  makeQuestion(q: {
    topic: Topic;
    prompt: string;
    answer: string;
    choices?: string[];
    accept?: string[];
    hint: string;
    steps: string[];
    context?: string;
    speech?: string;
  }): Question {
    const choices = (q.choices ?? [q.answer]).map((c) => ({ label: c, value: c }));
    return makeQ({ topic: q.topic, level: this.level(q.topic), prompt: q.prompt, context: q.context, speech: q.speech, choices, answer: q.answer, accept: q.accept, hint: q.hint, steps: q.steps });
  }

  /**
   * Bắt đầu một vòng hỏi: hiện đề bài ở thẻ trên cùng.
   *  - `buttons: true` → hiện các nút đáp án (q.choices) ở cuối màn hình, tự xử lý chọn.
   *  - Trò chơi chạm vật 3D: gọi `round.submit(value)` khi trẻ chọn một vật.
   * `await round.done` để chờ đến khi trẻ trả lời đúng (điểm & ghi nhận đã được cộng).
   */
  ask(q: Question, o: { buttons?: boolean; visual?: boolean; prompt?: string } = {}): MiniRound {
    const tracker = new AttemptTracker(q);
    const visual = o.visual || q.visual?.kind === 'listen' ? q.visual : undefined;
    this.ui.prompt(o.prompt ?? q.prompt, q.context, q.speech, visual, q.en);
    let resolveDone!: () => void;
    const done = new Promise<void>((r) => (resolveDone = r));
    let recorded = false;
    const submit = (value: string): SubmitResult => {
      const r = tracker.submit(value);
      if (recorded) return r;
      this.feedbackFor(q, r);
      if (r.correct) {
        recorded = true;
        finishQuestion(q, Math.max(1, tracker.attempts), tracker.ms, { src: `mini:${this.info.id}`, rewards: false, quiet: true });
        this.addScore(tracker.wrong === 0 ? 3 : tracker.wrong === 1 ? 2 : 1);
        this.ui.lockChoices();
        if (this.current === round) this.current = null;
        resolveDone();
      }
      return r;
    };
    if (o.buttons) {
      this.ui.choices(
        q.choices.map((c) => c.label),
        (i) => submit(q.choices[i].value).correct,
        (i) => {
          const v = q.choices[i].value;
          return q.accept?.length ? q.accept.includes(v) : v === q.answer;
        },
      );
    }
    const round: MiniRound = {
      q,
      tracker,
      done,
      submit,
      get solved() {
        return recorded;
      },
    };
    this.current = round;
    return round;
  }

  /** Phản hồi chuẩn theo kịch bản. */
  private feedbackFor(q: Question, r: SubmitResult): void {
    if (r.correct) {
      sfx('correct');
      if (q.en) speakParts([{ text: 'Chính xác!', lang: 'vi' }, { text: q.en, lang: 'en' }]);
      else speak('Chính xác! Tuyệt vời!');
      this.ui.feedback(r.message, 'good');
      return;
    }
    sfx('wrong');
    if (r.stage === 'retry') {
      speak('Chưa đúng rồi. Hãy thử lại nhé!');
      this.ui.feedback(r.message, 'retry');
    } else if (r.stage === 'hint') {
      sfx('hint');
      speak('Gợi ý: ' + q.hint);
      this.ui.feedback(`💡 ${q.hint}`, 'hint');
    } else {
      sfx('hint');
      speak('Mình cùng làm từng bước nhé! ' + q.steps.join(' '));
      this.ui.feedback('🧩 Mình cùng làm từng bước nhé!', 'steps', q.steps);
      this.ui.guideChoices();
    }
  }

  addScore(n: number): void {
    this.score += n;
    this.ui.setScore(this.score);
  }

  /** Kết thúc vòng hiện tại: chờ, xóa đề bài, tăng số vòng. Trả về false nếu đã hết vòng (hoặc đã thoát). */
  async nextRound(delay = 1.1): Promise<boolean> {
    await this.wait(delay);
    this.ui.clearPrompt();
    this.round++;
    this.ui.setRound(this.round, this.info.rounds);
    return this.more;
  }

  /** Còn vòng để chơi không. */
  get more(): boolean {
    return this.round < this.info.rounds && !this.disposed && !this.ended;
  }

  /** Điểm tối đa. */
  get maxScore(): number {
    return this.info.rounds * 3;
  }

  /* ================================================================== */
  /* Kết thúc                                                             */
  /* ================================================================== */
  async end(): Promise<void> {
    if (this.ended || this.disposed) return;
    this.ended = true;
    this.paused = true;
    const max = this.maxScore;
    const ratio = max > 0 ? Math.min(1, this.score / max) : 1;
    const stars = ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : 1;
    const { best } = recordMini(this.info.id, Math.round(ratio * 100));
    const coins = stars * 4 + (best ? 2 : 0);
    const xp = 5 + stars * 5;
    addCoins(coins);
    addXp(xp);
    sfx('levelup');
    this.fx.burst('confetti', [this.camera.position.x * 0.2, 2, 0], { count: 60, spread: 2 });
    const result: MiniResult = { id: this.info.id, score: this.score, max, stars, coins, xp, best, subject: this.subj };
    const again = await this.ui.results(result);
    if (!this.disposed) this.host.exit(result, again);
  }

  /** Thoát giữa chừng (nút ✖). */
  quit(): void {
    if (this.disposed) return;
    this.paused = true;
    this.host.exit(null, false);
  }
}
