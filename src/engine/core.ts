import * as THREE from 'three';
import { DrsPolicy, touchLadder } from './drs';
import { trackGlGenerations } from './glgen';
import { useShadowProxies } from './layers';

/** Một "sân khấu" 3D: khu vực trong thế giới, màn hình tiêu đề hoặc mini-game. */
export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dt: number, t: number): void;
  onResize?(w: number, h: number): void;
  onQuality?(q: Quality): void;
  dispose?(): void;
}

/**
 * Chất lượng đồ họa. 'medium' (bản đồ bóng nhỏ hơn) chỉ do máy cảm ứng tự chuyển khi vẽ không kịp;
 * trong Cài đặt chỉ có Tự động / Đẹp ('high') / Nhẹ ('low').
 */
export type Quality = 'high' | 'medium' | 'low';
type Hook = (dt: number, t: number) => void;

/** Số đo hiển thị (bảng ?fps=1). */
export interface EngineStats {
  fps: number;
  /** 90% số khung hình vẽ xong trong chừng này mili-giây. */
  p90: number;
  width: number;
  height: number;
  ratio: number;
  quality: Quality;
  auto: boolean;
  touch: boolean;
  calls: number;
  tris: number;
}

export interface WarmOpts {
  /** Camera dùng để xét đèn (mặc định: camera của sân khấu đang hiện). */
  camera?: THREE.Camera;
  /** Cảnh chứa đèn (mặc định: chính đối tượng nếu là cảnh, không thì cảnh đang hiện). */
  scene?: THREE.Scene;
  /** Chờ tối đa (ms); quá hạn thì thôi, phần còn lại biên dịch lúc vẽ lần đầu như trước. */
  capMs?: number;
}

/**
 * Bộ máy hiển thị 3D dùng chung cho toàn game:
 * một WebGLRenderer phủ toàn cửa sổ, vòng lặp khung hình, chất lượng đồ họa.
 * Máy tính: như cũ (đo FPS, máy yếu thì chuyển hẳn sang đồ họa nhẹ).
 * Máy cảm ứng: giới hạn số điểm ảnh, rồi tự hạ / nâng độ nét theo tốc độ khung hình (không kẹt mãi ở mức thấp).
 */
class Engine {
  renderer!: THREE.WebGLRenderer;
  canvas!: HTMLCanvasElement;
  stage: Stage | null = null;
  w = 1;
  h = 1;
  /** Thời gian trò chơi (giây) – dừng khi tab bị ẩn. */
  t = 0;
  quality: Quality = 'high';
  fps = 60;
  /** Điện thoại / máy tính bảng. */
  touch = false;
  /** Mất ngữ cảnh WebGL (máy thiếu bộ nhớ): tạm dừng vẽ và cập nhật. */
  lost = false;
  /** Lý do đang tạm dừng (xem hold()). */
  private holds = new Set<string>();
  private last = 0;
  private pre = new Set<Hook>();
  private post = new Set<Hook>();
  private fpsAcc = 0;
  private fpsN = 0;
  private lowStreak = 0;
  private autoQuality = true;
  private qualityListeners = new Set<(q: Quality) => void>();
  private contextListeners = new Set<(lost: boolean) => void>();
  /** Thời gian từng khung hình (ms) trong cửa sổ đo 2 giây. */
  private frameMs: number[] = [];
  private p90 = 0;
  private calls = 0;
  private tris = 0;
  /** Máy cảm ứng, chế độ Tự động: các nấc tỉ lệ điểm ảnh và bộ quyết định hạ / nâng độ nét. */
  private ladder = [1];
  private drs = new DrsPolicy();
  /** Mất ngữ cảnh WebGL: đồ cũ trên GPU sang "đời trước" (glgen.ts). */
  private glNewEra = () => {};

  /** `touch`: điện thoại / máy tính bảng (core/device.ts isTouchDevice) – dùng cách vẽ riêng cho máy cảm ứng. */
  init(container: HTMLElement, quality: Quality | 'auto' = 'auto', o: { touch?: boolean } = {}): void {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: true });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    useShadowProxies(r);
    this.renderer = r;
    this.glNewEra = trackGlGenerations(r.getContext());
    this.canvas = r.domElement;
    this.canvas.id = 'scene3d';
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('webglcontextlost', (e) => this.onLost(e), false);
    this.canvas.addEventListener('webglcontextrestored', () => this.onRestored(), false);
    container.appendChild(this.canvas);
    this.touch = !!o.touch;
    this.autoQuality = quality === 'auto';
    this.quality = quality === 'low' ? 'low' : 'high';
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.skipWindow());
    this.resize();
    r.setAnimationLoop((now) => this.frame(now));
  }

  /** Đổi sân khấu. `keepPrev`: không hủy sân khấu cũ (để quay lại sau, ví dụ khu vực khi chơi mini-game). */
  setStage(stage: Stage | null, o: { keepPrev?: boolean } = {}): void {
    if (this.stage && this.stage !== stage && !o.keepPrev) this.stage.dispose?.();
    this.stage = stage;
    if (stage) {
      stage.camera.aspect = this.w / this.h;
      stage.camera.updateProjectionMatrix();
      stage.onResize?.(this.w, this.h);
    }
    this.skipWindow();
  }

  /** Gọi mỗi khung hình trước (pre) hoặc sau (post) khi sân khấu cập nhật. Trả về hàm hủy. */
  onFrame(fn: Hook, phase: 'pre' | 'post' = 'pre'): () => void {
    const set = phase === 'pre' ? this.pre : this.post;
    set.add(fn);
    return () => set.delete(fn);
  }

  onQualityChange(fn: (q: Quality) => void): () => void {
    this.qualityListeners.add(fn);
    return () => this.qualityListeners.delete(fn);
  }

  /** Báo khi mất (true) / có lại (false) ngữ cảnh WebGL. Trả về hàm hủy. */
  onContextChange(fn: (lost: boolean) => void): () => void {
    this.contextListeners.add(fn);
    return () => this.contextListeners.delete(fn);
  }

  setQuality(q: Quality | 'auto'): void {
    this.autoQuality = q === 'auto';
    this.lowStreak = 0;
    this.drs.reset();
    this.applyQuality(q === 'low' ? 'low' : 'high');
  }

  private applyQuality(nq: Quality): void {
    if (nq === this.quality) {
      this.applyRatio();
      return;
    }
    this.quality = nq;
    this.resize();
    this.stage?.onQuality?.(nq);
    for (const fn of this.qualityListeners) fn(nq);
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h);
    if (this.stage) {
      this.stage.camera.aspect = w / h;
      this.stage.camera.updateProjectionMatrix();
      this.stage.onResize?.(w, h);
    }
    this.skipWindow();
  }

  /** Tỉ lệ điểm ảnh của khung vẽ 3D. Máy tính: y như cũ. */
  private pixelRatio(): number {
    const dpr = window.devicePixelRatio || 1;
    if (!this.touch) return Math.min(dpr, this.quality === 'high' ? 2 : 1);
    this.ladder = touchLadder(dpr, this.w, this.h);
    this.drs.setSteps(this.ladder.length);
    const last = this.ladder.length - 1;
    if (this.quality === 'low') return this.ladder[last];
    return this.autoQuality ? this.ladder[Math.min(this.drs.level, last)] : this.ladder[0];
  }

  /** Đổi tỉ lệ điểm ảnh nếu cần (đổi kích thước khung vẽ thì phải cấp phát lại – không làm khi không đổi). */
  private applyRatio(): void {
    if (Math.abs(this.pixelRatio() - this.renderer.getPixelRatio()) > 1e-3) this.resize();
  }

  private frame(now: number): void {
    const raw = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    if (document.hidden || this.lost || this.holds.size) return;
    const dt = Math.min(0.05, raw);
    this.t += dt;
    for (const fn of [...this.pre]) fn(dt, this.t);
    const st = this.stage;
    if (st) {
      st.update(dt, this.t);
      for (const fn of [...this.post]) fn(dt, this.t);
      this.renderer.render(st.scene, st.camera);
      const info = this.renderer.info.render;
      this.calls = info.calls;
      this.tris = info.triangles;
    } else {
      for (const fn of [...this.post]) fn(dt, this.t);
    }
    this.measure(raw);
  }

  /** Đo FPS mỗi 2 giây. Máy tính yếu: tự chuyển sang đồ họa nhẹ (một lần). Máy cảm ứng: xem engine/drs.ts. */
  private measure(raw: number): void {
    // Khung quá dài (chuyển tab, hộp thoại...): bỏ qua. Máy cảm ứng vẽ rất chậm (khung tới 1,5 giây) vẫn tính, để còn tự hạ độ nét.
    if (raw > (this.touch ? 1.5 : 0.5)) return;
    this.fpsAcc += raw;
    this.fpsN++;
    this.frameMs.push(raw * 1000);
    if (this.fpsAcc < 2) return;
    this.fps = this.fpsN / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsN = 0;
    const ms = this.frameMs.sort((a, b) => a - b);
    this.frameMs = [];
    this.p90 = ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.9))];
    if (this.touch) {
      // Máy cảm ứng, chế độ Tự động: hạ / nâng độ nét theo số khung hình vẽ không kịp (engine/drs.ts).
      if (this.autoQuality && this.stage && this.drs.window(ms)) this.applyQuality(this.drs.level >= this.drs.max ? 'medium' : 'high');
      return;
    }
    if (this.autoQuality && this.quality === 'high' && this.stage) {
      this.lowStreak = this.fps < 34 ? this.lowStreak + 1 : 0;
      if (this.lowStreak >= 3) {
        this.lowStreak = 0;
        this.autoQuality = false;
        this.applyQuality('low');
      }
    }
  }

  /** Bỏ qua cửa sổ đo kế tiếp (vừa đổi cảnh / kích thước / độ nét: vài khung đầu thường chậm). */
  private skipWindow(): void {
    this.drs.skipNext();
  }

  /** Đang tải sau màn che: khung hình chậm do tải chứ không do vẽ – không tính khi tự chỉnh độ nét. */
  setLoading(on: boolean): void {
    this.drs.loading = on;
    if (!on) this.skipWindow();
  }

  /**
   * Tạm dừng thời gian trò chơi và việc vẽ khi có lý do (vd. 'rotate': lời nhắc xoay ngang điện thoại đang phủ kín màn hình).
   * Trò chơi nhỏ, tween, camera… đều chạy theo khung hình nên đứng yên đúng chỗ; bỏ hết lý do là chạy tiếp, không nhảy cóc.
   */
  hold(reason: string, on: boolean): void {
    const was = this.holds.size > 0;
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    if (was && !this.holds.size) this.skipWindow();
  }

  get held(): boolean {
    return this.holds.size > 0;
  }

  stats(): EngineStats {
    return {
      fps: this.fps,
      p90: this.p90,
      width: this.canvas.width,
      height: this.canvas.height,
      ratio: this.renderer.getPixelRatio(),
      quality: this.quality,
      auto: this.autoQuality,
      touch: this.touch,
      calls: this.calls,
      tris: this.tris,
    };
  }

  /**
   * Chuẩn bị trước cho đối tượng sắp hiện (khu vực mới, mô hình AI tải xong muộn, bộ đồ mới): đưa ảnh lên GPU
   * và biên dịch shader – kể cả phần chưa lọt vào khung hình – để lúc bé bắt đầu đi, camera quay sang hay mô hình
   * vừa thay vào không bị khựng. Trình duyệt hỗ trợ thì biên dịch song song (không chặn màn hình chờ).
   * Gọi khi đối tượng chưa hiện hoặc sau màn chờ; nên chờ xong (await) rồi mới thay / mở màn.
   */
  async warmUp(obj: THREE.Object3D, o: WarmOpts = {}): Promise<void> {
    if (!this.renderer || this.lost) return;
    const camera = o.camera ?? this.stage?.camera;
    const scene = o.scene ?? ((obj as THREE.Scene).isScene ? (obj as THREE.Scene) : this.stage?.scene);
    let timer = 0;
    try {
      uploadTextures(this.renderer, obj);
      // Có biên dịch song song: chờ tối đa capMs. Không có: biên dịch ngay (compileAsync cũng chỉ làm vậy, kèm một cảnh báo).
      if (camera && scene && this.renderer.extensions.has('KHR_parallel_shader_compile'))
        await Promise.race([
          this.renderer.compileAsync(obj, camera, scene),
          new Promise<void>((r) => (timer = window.setTimeout(r, o.capMs ?? 2500))),
        ]);
      else if (camera && scene) this.renderer.compile(obj, camera, scene);
    } catch (e) {
      console.warn('[engine] warmUp', e);
    } finally {
      clearTimeout(timer);
    }
    this.skipWindow();
  }

  private onLost(e: Event): void {
    e.preventDefault();
    this.lost = true;
    this.glNewEra();
    for (const fn of [...this.contextListeners]) fn(true);
  }

  private onRestored(): void {
    this.lost = false;
    // Vừa thiếu bộ nhớ: máy cảm ứng ở chế độ Tự động về mức nhẹ nhất (khung vẽ nhỏ, bản đồ bóng nhỏ), rất lâu sau mới nâng lại.
    if (this.touch && this.autoQuality) {
      this.drs.safeMode();
      this.applyQuality('medium');
    }
    this.resize();
    for (const fn of [...this.contextListeners]) fn(false);
  }
}

/** Đưa trước mọi ảnh (texture) của vật liệu trong `obj` lên GPU. */
function uploadTextures(r: THREE.WebGLRenderer, obj: THREE.Object3D): void {
  const seen = new Set<THREE.Texture>();
  const add = (v: unknown) => {
    const t = v as THREE.Texture | null;
    if (!t || !t.isTexture || seen.has(t) || t.mapping !== THREE.UVMapping) return;
    if (t.isRenderTargetTexture || (t as THREE.DepthTexture).isDepthTexture) return;
    const img = t.image as { complete?: boolean } | null;
    if (t.version > 0 && img && img.complete !== false) seen.add(t);
  };
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mt of Array.isArray(m) ? m : [m]) {
      for (const v of Object.values(mt)) add(v);
      const u = (mt as THREE.ShaderMaterial).uniforms;
      if (u) for (const k in u) add(u[k]?.value);
    }
  });
  for (const t of seen) r.initTexture(t);
}

export const engine = new Engine();

/**
 * Chuẩn bị trước (ảnh + shader) cho `obj` – xem Engine.warmUp. Dùng khi thay mô hình tại chỗ:
 * dựng `next` → `await warmUp(next, { scene: zone.scene })` → kiểm tra lại còn cần không → `actor.swapModel(next)` → hủy mô hình cũ.
 */
export function warmUp(obj: THREE.Object3D, o?: WarmOpts): Promise<void> {
  return engine.warmUp(obj, o);
}
