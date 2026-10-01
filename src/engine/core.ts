import * as THREE from 'three';

/** Một "sân khấu" 3D: khu vực trong thế giới, màn hình tiêu đề hoặc mini-game. */
export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dt: number, t: number): void;
  onResize?(w: number, h: number): void;
  onQuality?(q: Quality): void;
  dispose?(): void;
}

export type Quality = 'high' | 'low';
type Hook = (dt: number, t: number) => void;

/**
 * Bộ máy hiển thị 3D dùng chung cho toàn game:
 * một WebGLRenderer phủ toàn cửa sổ, vòng lặp khung hình, chất lượng đồ họa.
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
  private last = 0;
  private pre = new Set<Hook>();
  private post = new Set<Hook>();
  private fpsAcc = 0;
  private fpsN = 0;
  private lowStreak = 0;
  private autoQuality = true;
  private qualityListeners = new Set<(q: Quality) => void>();

  init(container: HTMLElement, quality: Quality | 'auto' = 'auto'): void {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: true });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    this.canvas = r.domElement;
    this.canvas.id = 'scene3d';
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    container.appendChild(this.canvas);
    this.autoQuality = quality === 'auto';
    this.quality = quality === 'low' ? 'low' : 'high';
    window.addEventListener('resize', () => this.resize());
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

  setQuality(q: Quality | 'auto'): void {
    this.autoQuality = q === 'auto';
    const nq: Quality = q === 'low' ? 'low' : 'high';
    if (nq === this.quality) return;
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
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, this.quality === 'high' ? 2 : 1));
    this.renderer.setSize(w, h);
    if (this.stage) {
      this.stage.camera.aspect = w / h;
      this.stage.camera.updateProjectionMatrix();
      this.stage.onResize?.(w, h);
    }
  }

  private frame(now: number): void {
    const raw = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    if (document.hidden) return;
    const dt = Math.min(0.05, raw);
    this.t += dt;
    for (const fn of [...this.pre]) fn(dt, this.t);
    const st = this.stage;
    if (st) {
      st.update(dt, this.t);
      for (const fn of [...this.post]) fn(dt, this.t);
      this.renderer.render(st.scene, st.camera);
    } else {
      for (const fn of [...this.post]) fn(dt, this.t);
    }
    this.measure(raw);
  }

  /** Đo FPS; nếu máy yếu thì tự chuyển sang đồ họa nhẹ (một lần). */
  private measure(raw: number): void {
    if (raw > 0.5) return;
    this.fpsAcc += raw;
    this.fpsN++;
    if (this.fpsAcc < 2) return;
    this.fps = this.fpsN / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsN = 0;
    if (this.autoQuality && this.quality === 'high' && this.stage) {
      this.lowStreak = this.fps < 34 ? this.lowStreak + 1 : 0;
      if (this.lowStreak >= 3) {
        this.lowStreak = 0;
        this.autoQuality = false;
        this.quality = 'low';
        this.resize();
        this.stage.onQuality?.('low');
        for (const fn of this.qualityListeners) fn('low');
      }
    }
  }
}

export const engine = new Engine();
