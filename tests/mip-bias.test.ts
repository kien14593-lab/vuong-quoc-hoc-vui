import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { biasMipmap } from '../src/models/glb';

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {} }));
vi.mock('three/examples/jsm/libs/meshopt_decoder.module.js', () => ({ MeshoptDecoder: {} }));

type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];

describe('lệch mipmap ảnh màu (bé AI: tóc không có vệt nứt màu khi nhìn từ xa)', () => {
  it('lấy màu từ ảnh với độ lệch, giữ nguyên phần còn lại của đoạn shader', () => {
    const m = new THREE.MeshLambertMaterial();
    biasMipmap(m, -1);
    const sh = { fragmentShader: 'void main() {\n#include <map_fragment>\n}' } as Shader;
    m.onBeforeCompile(sh, {} as THREE.WebGLRenderer);
    // three.js đổi đoạn map_fragment thì lệnh thay không còn tác dụng → báo ngay ở đây
    expect(sh.fragmentShader).toContain('texture2D( map, vMapUv, -1.00 )');
    expect(sh.fragmentShader).not.toContain('#include <map_fragment>');
    expect(sh.fragmentShader).toContain('diffuseColor *= sampledDiffuseColor;');
  });

  it('mỗi độ lệch một chương trình shader riêng (không dùng nhầm của vật liệu thường)', () => {
    const a = new THREE.MeshLambertMaterial();
    const b = new THREE.MeshLambertMaterial();
    biasMipmap(a, -1);
    biasMipmap(b, -0.5);
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
    expect(a.customProgramCacheKey()).not.toBe(new THREE.MeshLambertMaterial().customProgramCacheKey());
  });
});
