const KINDS = ['Texture', 'Buffer', 'Framebuffer', 'Renderbuffer', 'Program', 'Shader', 'VertexArray', 'Query', 'Sampler', 'TransformFeedback'];

/**
 * Mất ngữ cảnh WebGL (iPhone/iPad thiếu bộ nhớ): mọi đồ trên GPU (ảnh, bộ đệm, chương trình vẽ...) mất theo. Có lại ngữ cảnh
 * rồi, mỗi lần three.js giải phóng một món cũ (lúc đổi khu vực...) trình duyệt lại báo lỗi "object does not belong to this
 * context" – vô hại nhưng làm đầy bảng lỗi. Ghi lại mỗi món được tạo ở "đời" ngữ cảnh nào, bỏ qua lệnh xoá món của đời trước.
 * Món không rõ đời vẫn xoá như thường, nên không bao giờ sót đồ của ngữ cảnh đang dùng. Trả về hàm "sang đời mới" (gọi khi mất ngữ cảnh).
 */
export function trackGlGenerations(gl: object): () => void {
  const born = new WeakMap<object, number>();
  let gen = 0;
  const g = gl as Record<string, unknown>;
  for (const k of KINDS) {
    const create = g[`create${k}`];
    const del = g[`delete${k}`];
    if (typeof create !== 'function' || typeof del !== 'function') continue;
    g[`create${k}`] = (...a: unknown[]) => {
      const o: unknown = create.apply(gl, a);
      if (o && typeof o === 'object') born.set(o, gen);
      return o;
    };
    g[`delete${k}`] = (o: unknown, ...a: unknown[]) => {
      if (o && typeof o === 'object') {
        const b = born.get(o);
        if (b !== undefined && b !== gen) return;
      }
      return del.call(gl, o, ...a);
    };
  }
  return () => {
    gen++;
  };
}
