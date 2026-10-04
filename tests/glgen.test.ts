import { describe, expect, it } from 'vitest';
import { trackGlGenerations } from '../src/engine/glgen';

/** Ngữ cảnh WebGL giả: chỉ ghi lại các lệnh xoá. */
function fakeGl() {
  const deleted: object[] = [];
  const gl = {
    createTexture: () => ({ kind: 'tex' }),
    deleteTexture: (o: object) => void deleted.push(o),
    createBuffer: () => ({ kind: 'buf' }),
    deleteBuffer: (o: object) => void deleted.push(o),
  };
  return { gl, deleted };
}

describe('trackGlGenerations – mất ngữ cảnh WebGL rồi có lại', () => {
  it('bình thường: xoá như cũ', () => {
    const { gl, deleted } = fakeGl();
    trackGlGenerations(gl);
    const t = gl.createTexture();
    gl.deleteTexture(t);
    expect(deleted).toEqual([t]);
  });

  it('đồ của ngữ cảnh đã mất: bỏ qua lệnh xoá; đồ tạo sau đó vẫn xoá được', () => {
    const { gl, deleted } = fakeGl();
    const newEra = trackGlGenerations(gl);
    const oldTex = gl.createTexture();
    const oldBuf = gl.createBuffer();
    newEra();
    const newTex = gl.createTexture();
    gl.deleteTexture(oldTex);
    gl.deleteBuffer(oldBuf);
    gl.deleteTexture(newTex);
    expect(deleted).toEqual([newTex]);
  });

  it('đồ không rõ đời (tạo trước khi gắn) hay null: vẫn chuyển lệnh xoá cho trình duyệt', () => {
    const { gl, deleted } = fakeGl();
    const before = gl.createTexture();
    const newEra = trackGlGenerations(gl);
    newEra();
    gl.deleteTexture(before);
    gl.deleteTexture(null as unknown as object);
    expect(deleted).toEqual([before, null]);
  });
});
