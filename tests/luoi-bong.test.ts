import { Document, NodeIO, type Mesh, type Node, type Primitive } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { PHIEN_BAN, SAI_SO, boLuoiBong, coLuoiBong, laLuoiBong, lamLuoiBong, saiLech } from '../tools/luoi-bong.mjs';

/**
 * Lưới bóng (tools/luoi-bong.mjs): lưới thưa dùng chung đỉnh với lưới thật của bé, công cụ xử lý mô hình làm sẵn để
 * trò chơi vẽ bóng đổ và hình bóng khi bị che đỡ tốn. Thử trên hình cầu chia nhiều mảnh ảnh: đỉnh trùng vị trí ở
 * mọi đường nối giữa các mảnh, như mô hình AI thật (bộ giảm lưới phải hàn qua được đường nối).
 */

/**
 * Hình cầu bán kính r, mỗi mảnh ảnh `manh`×`manh` ô có đỉnh riêng (đỉnh trùng ở đường nối, hai cực, kinh tuyến gốc).
 * `han`: hình cầu liền – mỗi điểm lưới đúng một đỉnh (không có đỉnh trùng) để so sánh.
 */
function hinhCau(r = 0.5, kinh = 64, vi = 48, manh = 8, han = false): { pos: number[]; nrm: number[]; idx: number[] } {
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const so = new Map<string, number>();
  const cuc = (i: number) => i === 0 || i === vi;
  // Đỉnh trùng của mô hình thật giống nhau từng bit: mỗi điểm lưới tính vị trí một lần (cực, kinh tuyến gốc dùng chung).
  const huong = (i: number, j: number): number[] => {
    if (cuc(i)) return [0, i === 0 ? 1 : -1, 0];
    const th = (i / vi) * Math.PI;
    const ph = ((j % kinh) / kinh) * Math.PI * 2;
    return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  };
  const dinh = (i: number, j: number, m: string): number => {
    const key = han ? (cuc(i) ? `cuc${i}` : `${i}:${j % kinh}`) : `${m}:${i}:${j}`;
    let v = so.get(key);
    if (v !== undefined) return v;
    v = pos.length / 3;
    const n = huong(i, j);
    pos.push(r * n[0], r * n[1], r * n[2]);
    nrm.push(...n);
    so.set(key, v);
    return v;
  };
  for (let i = 0; i < vi; i++) {
    for (let j = 0; j < kinh; j++) {
      const m = `${Math.floor(i / manh)}_${Math.floor(j / manh)}`;
      const a = dinh(i, j, m);
      const b = dinh(i + 1, j, m);
      const c = dinh(i + 1, j + 1, m);
      const d = dinh(i, j + 1, m);
      if (i > 0) idx.push(a, b, d);
      if (i < vi - 1) idx.push(b, c, d);
    }
  }
  return { pos, nrm, idx };
}

/** Hộp vuông 12 tam giác: góc nhọn, không giảm được. */
function hinhHop(x = 0, y = 0, z = 0, s = 0.3): { pos: number[]; idx: number[] } {
  const pos: number[] = [];
  for (let i = 0; i < 8; i++) pos.push(x + (i & 1 ? s : -s), y + (i & 2 ? s : -s), z + (i & 4 ? s : -s));
  const idx = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
  return { pos, idx };
}

function themPhan(doc: Document, mesh: Mesh, hinh: { pos: number[]; idx: number[]; nrm?: number[] }): Primitive {
  const buf = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const acc = (type: 'VEC3' | 'SCALAR', a: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>) => doc.createAccessor().setType(type).setArray(a).setBuffer(buf);
  const p = doc
    .createPrimitive()
    .setAttribute('POSITION', acc('VEC3', new Float32Array(hinh.pos)))
    .setIndices(acc('SCALAR', new Uint16Array(hinh.idx)))
    .setMaterial(doc.getRoot().listMaterials()[0] ?? doc.createMaterial('Material.001'));
  if (hinh.nrm) p.setAttribute('NORMAL', acc('VEC3', new Float32Array(hinh.nrm)));
  mesh.addPrimitive(p);
  return p;
}

/** Cảnh như tệp bé: nút cha co giãn không đều, nút con dời và thu nhỏ, giữ một lưới. */
function canh(...hinh: { pos: number[]; idx: number[]; nrm?: number[] }[]): { doc: Document; mesh: Mesh; node: Node; prims: Primitive[] } {
  const doc = new Document();
  const mesh = doc.createMesh('be');
  const prims = hinh.map((h) => themPhan(doc, mesh, h));
  const node = doc.createNode('node_0').setMesh(mesh).setTranslation([0.1, 0.5, 0]).setScale([0.5, 0.5, 0.5]);
  const cha = doc.createNode('goc').setScale([1.3, 1, 1]).addChild(node);
  doc.getRoot().setDefaultScene(doc.createScene().addChild(cha));
  return { doc, mesh, node, prims };
}

/** Đỉnh trong không gian thật (ma trận thế giới), co về chiều cao `chieuCao` – cách đo của công cụ. */
function theGioi(node: Node, prims: Primitive[], chieuCao: number): Float32Array[] {
  const m = node.getWorldMatrix();
  const e = [0, 0, 0];
  let lo = Infinity;
  let hi = -Infinity;
  const out = prims.map((p) => {
    const a = p.getAttribute('POSITION')!;
    const w = new Float32Array(a.getCount() * 3);
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, e);
      for (let c = 0; c < 3; c++) w[3 * i + c] = m[c] * e[0] + m[4 + c] * e[1] + m[8 + c] * e[2] + m[12 + c];
      lo = Math.min(lo, w[3 * i + 1]);
      hi = Math.max(hi, w[3 * i + 1]);
    }
    return w;
  });
  for (const w of out) for (let i = 0; i < w.length; i++) w[i] *= chieuCao / (hi - lo);
  return out;
}

const bongCua = (mesh: Mesh, p: Primitive) => mesh.listPrimitives().filter((b) => laLuoiBong(b) && b.getAttribute('POSITION') === p.getAttribute('POSITION'));
const chiSo = (p: Primitive) => Array.from(p.getIndices()!.getArray()!);

describe('lưới bóng của bé (tools/luoi-bong.mjs)', () => {
  it('làm lưới thưa hơn nhiều, dùng chung đỉnh với lưới thật, lệch không quá 1 cm ở chiều cao thật', async () => {
    const { doc, mesh, node, prims } = canh(hinhCau());
    const [vis] = prims;
    const truoc = chiSo(vis);
    const r = await lamLuoiBong(doc, 1.7);
    expect(r).not.toBeNull();
    expect(r).toMatchObject({ trisGoc: truoc.length / 3, parts: 1, made: 1 });
    expect(r!.tris).toBeLessThan(r!.trisGoc * 0.3);
    expect(r!.lech).toBeGreaterThan(0);
    expect(r!.lech).toBeLessThanOrEqual(SAI_SO);

    const [px, ...thua] = bongCua(mesh, vis);
    expect(thua).toHaveLength(0);
    expect(mesh.listPrimitives()).toHaveLength(2);
    expect(px.getAttribute('NORMAL')).toBe(vis.getAttribute('NORMAL'));
    expect(px.listSemantics().sort()).toEqual(['NORMAL', 'POSITION']);
    expect(px.getExtras()).toEqual({ proxy: PHIEN_BAN, lech: Number(r!.lech.toFixed(4)) });
    const mat = px.getMaterial()!;
    expect(mat.getName()).toBe('bong');
    expect(mat.getAlphaMode()).toBe('BLEND');
    expect(mat.getBaseColorFactor()[3]).toBe(0);
    expect(px.getIndices()!.getArray()).toBeInstanceOf(Uint16Array);
    expect(px.getIndices()!.getCount() / 3).toBe(r!.tris);
    // Lưới thật giữ nguyên từng chỉ số.
    expect(chiSo(vis)).toEqual(truoc);
    // Đo lại từ tệp: đỉnh thật (ma trận thế giới) với hai danh sách tam giác đã lưu.
    const [w] = theGioi(node, [vis], 1.7);
    const d = saiLech(w, truoc, chiSo(px));
    expect(d).toBeLessThanOrEqual(SAI_SO);
    expect(d).toBeCloseTo(r!.lech, 4);
    expect(coLuoiBong(doc)).toBe(true);
  });

  it('đường nối giữa các mảnh ảnh không cản bộ giảm lưới: hình cầu chia mảnh giảm như hình cầu liền', async () => {
    const chia = await lamLuoiBong(canh(hinhCau(0.5, 128, 96)).doc, 1.7);
    const lien = await lamLuoiBong(canh(hinhCau(0.5, 128, 96, 8, true)).doc, 1.7);
    expect(chia!.trisGoc).toBe(lien!.trisGoc);
    expect(Math.abs(chia!.tris - lien!.tris)).toBeLessThanOrEqual(lien!.tris * 0.05);
    // Đỉnh trùng còn sót trong mảng đỉnh khóa bộ giảm lưới ở đường nối: còn ~24 % thay vì ~6 %.
    expect(chia!.tris).toBeLessThan(chia!.trisGoc * 0.1);
    expect(chia!.lech).toBeLessThanOrEqual(SAI_SO);
  });

  it('chạy lại (xử lý lại tệp đã có lưới bóng): vẫn đúng một lưới bóng và một vật liệu "bong"', async () => {
    const { doc, mesh, prims } = canh(hinhCau());
    const r1 = await lamLuoiBong(doc, 1.7);
    const r2 = await lamLuoiBong(doc, 1.7);
    expect(r2).toEqual(r1);
    expect(bongCua(mesh, prims[0])).toHaveLength(1);
    expect(mesh.listPrimitives()).toHaveLength(2);
    expect(doc.getRoot().listMaterials().map((m) => m.getName())).toEqual(['Material.001', 'bong']);
    expect(doc.getRoot().listAccessors()).toHaveLength(4);
  });

  it('nhiều phần lưới: phần không giảm được dùng lại chỉ số gốc; bỏ lưới bóng không đụng tới chỉ số đó', async () => {
    const { doc, mesh, prims } = canh(hinhCau(), hinhHop(0, 0.2, 0));
    const [cau, hop] = prims;
    const accTruoc = doc.getRoot().listAccessors().length;
    const r = await lamLuoiBong(doc, 1.7);
    expect(r).toMatchObject({ parts: 2, made: 1 });
    const [pxHop] = bongCua(mesh, hop);
    expect(pxHop.getIndices()).toBe(hop.getIndices());
    expect(pxHop.getExtras()).toEqual({ proxy: PHIEN_BAN, lech: 0 });
    expect(bongCua(mesh, cau)).toHaveLength(1);
    expect(coLuoiBong(doc)).toBe(true);

    expect(boLuoiBong(doc)).toBe(2);
    const con = mesh.listPrimitives();
    expect(con).toHaveLength(2);
    expect(con[0]).toBe(cau);
    expect(con[1]).toBe(hop);
    expect(hop.getIndices()!.isDisposed()).toBe(false);
    expect(chiSo(hop)).toEqual(hinhHop(0, 0.2, 0).idx);
    expect(doc.getRoot().listAccessors()).toHaveLength(accTruoc);
    expect(doc.getRoot().listMaterials().map((m) => m.getName())).toEqual(['Material.001']);
    expect(coLuoiBong(doc)).toBe(false);
    expect(boLuoiBong(doc)).toBe(0);
  });

  it('coLuoiBong: không có, khác phiên bản, hay thiếu cho một phần lưới → làm lại', async () => {
    const { doc, mesh, prims } = canh(hinhCau());
    expect(coLuoiBong(doc)).toBe(false);
    await lamLuoiBong(doc, 1.7);
    expect(coLuoiBong(doc)).toBe(true);
    const [px] = bongCua(mesh, prims[0]);
    px.setExtras({ ...px.getExtras(), proxy: PHIEN_BAN + 1 });
    expect(coLuoiBong(doc)).toBe(false);
    px.setExtras({ ...px.getExtras(), proxy: PHIEN_BAN });
    // Bộ đồ có thêm phần lưới mới (chưa có lưới bóng).
    themPhan(doc, mesh, hinhHop(0, 0.2, 0));
    expect(coLuoiBong(doc)).toBe(false);
  });

  it('lưới không bỏ được một nửa số tam giác (hộp vuông): không làm, tệp giữ nguyên', async () => {
    const { doc, mesh } = canh(hinhHop());
    expect(await lamLuoiBong(doc, 1.7)).toBeNull();
    expect(mesh.listPrimitives()).toHaveLength(1);
    expect(doc.getRoot().listMaterials().map((m) => m.getName())).toEqual(['Material.001']);
    expect(doc.getRoot().listAccessors()).toHaveLength(2);
    expect(coLuoiBong(doc)).toBe(false);
  });

  it('ghi ra .glb rồi đọc lại: lưới bóng còn nguyên, vẫn dùng chung đỉnh, xử lý lại không làm thêm', async () => {
    const { doc, prims } = canh(hinhCau());
    const r = await lamLuoiBong(doc, 1.7);
    const io = new NodeIO();
    const doc2 = await io.readBinary(await io.writeBinary(doc));
    expect(coLuoiBong(doc2)).toBe(true);
    const [mesh2] = doc2.getRoot().listMeshes();
    const [vis2, px2] = mesh2.listPrimitives();
    expect(laLuoiBong(vis2)).toBe(false);
    expect(px2.getAttribute('POSITION')).toBe(vis2.getAttribute('POSITION'));
    expect(px2.getExtras()).toEqual({ proxy: PHIEN_BAN, lech: Number(r!.lech.toFixed(4)) });
    expect(px2.getMaterial()!.getName()).toBe('bong');
    expect(chiSo(vis2)).toEqual(chiSo(prims[0]));
    expect(await lamLuoiBong(doc2, 1.7)).toEqual(r);
    expect(mesh2.listPrimitives()).toHaveLength(2);
  });
});

describe('saiLech: độ lệch hai chiều giữa hai lưới', () => {
  // Tấm vuông 3×3 đỉnh, đỉnh giữa nhô lên h; lưới bóng là hai tam giác phẳng nối bốn góc.
  const h = 0.005;
  const pos = new Float32Array([0, 0, 0, 0.1, 0, 0, 0.2, 0, 0, 0, 0, 0.1, 0.1, h, 0.1, 0.2, 0, 0.1, 0, 0, 0.2, 0.1, 0, 0.2, 0.2, 0, 0.2]);
  const vong = [0, 1, 2, 5, 8, 7, 6, 3];
  const goc = vong.flatMap((v, i) => [4, v, vong[(i + 1) % vong.length]]);
  const bong = [0, 2, 8, 0, 8, 6];

  it('đỉnh nhô lên h so với lưới bóng phẳng → lệch đúng bằng h', () => {
    expect(saiLech(pos, goc, bong)).toBeCloseTo(h, 6);
  });

  it('cùng một lưới → không lệch', () => {
    expect(saiLech(pos, goc, goc)).toBeLessThan(1e-7);
  });

  it('lệch từ ngưỡng `tran` trở lên → trả về đúng `tran` (dừng sớm)', () => {
    expect(saiLech(pos, goc, bong, 0.002)).toBe(0.002);
  });
});
