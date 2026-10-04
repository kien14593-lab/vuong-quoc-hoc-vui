import type * as THREE from 'three';

/**
 * Lớp riêng của "lưới bóng": bản rút gọn của bé AI (công cụ tạo sẵn trong tệp GLB) chỉ dùng để đổ bóng.
 * Camera chính không bật lớp này nên lưới bóng không hiện lên màn hình; khi vẽ bản đồ bóng thì lớp được bật tạm.
 */
export const SHADOW_LAYER = 5;

const hooked = new WeakSet<object>();
const watched = new WeakSet<object>();

/** Bọc lượt vẽ bóng của bản đồ bóng `sm` (mỗi bản đồ bóng chỉ bọc một lần). */
function hook(sm: THREE.WebGLShadowMap): void {
  if (hooked.has(sm)) return;
  hooked.add(sm);
  const render = sm.render;
  sm.render = function (lights, scene, camera) {
    const had = camera.layers.isEnabled(SHADOW_LAYER);
    if (!had) camera.layers.enable(SHADOW_LAYER);
    try {
      render.call(this, lights, scene, camera);
    } finally {
      if (!had) camera.layers.disable(SHADOW_LAYER);
    }
  };
}

/**
 * Cho bộ vẽ `r` vẽ cả lưới bóng vào bản đồ bóng. three.js chỉ đổ bóng những vật thuộc lớp mà camera đang vẽ bật,
 * nên trong lúc vẽ bóng, lớp SHADOW_LAYER được bật tạm cho camera rồi trả lại như cũ. Gọi nhiều lần cũng chỉ bọc một lần.
 * Nếu sau này dựng bộ vẽ mới (thay cho bộ vẽ cũ) thì phải gọi lại cho bộ vẽ mới – không thì bé AI mất bóng.
 */
export function useShadowProxies(r: THREE.WebGLRenderer): void {
  hook(r.shadowMap);
  if (watched.has(r)) return;
  watched.add(r);
  // Mất ngữ cảnh WebGL rồi có lại (hay gặp trên iPhone/iPad): three.js dựng bản đồ bóng mới thay cho cái cũ.
  // Trình nghe của three.js gắn lúc dựng bộ vẽ nên chạy trước trình nghe này – bọc luôn bản đồ bóng mới.
  r.domElement?.addEventListener('webglcontextrestored', () => hook(r.shadowMap));
}
