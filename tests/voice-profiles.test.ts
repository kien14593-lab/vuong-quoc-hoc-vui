import { describe, expect, it } from 'vitest';
import { detectMobileOs } from '../src/core/device';
import { DEFAULT_SETTINGS, mergeSettings } from '../src/core/state';
import { NARRATOR, VOICE_PROFILES, voiceProfile } from '../src/core/voice-profiles';
import {
  findChosen,
  isMaleVi,
  malePitchFallback,
  pickVoices,
  planSpeech,
  rankVoices,
  resolveVoice,
  voiceLabels,
  voiceQuality,
  type VoiceLike,
  type VoicePick,
} from '../src/core/voices';
import { CAST, ME, VILLAGERS, villager } from '../src/game/cast';

/**
 * Mỗi nhân vật một giọng: hồ sơ giọng đủ cho mọi người nói, chọn giọng đúng trên Edge, Windows, Android, iPhone/iPad
 * (danh sách giọng giả lập giống máy thật), nhãn ô "Chọn giọng đọc" và cài đặt cũ vẫn đọc được.
 */
const V = (name: string, lang: string, localService = true, voiceURI?: string): VoiceLike => ({ name, lang, localService, ...(voiceURI ? { voiceURI } : {}) });

/** Edge (Windows 10/11) có mạng: giọng tự nhiên trực tuyến, đúng tên thật (có dấu cách và dấu tiếng Việt). */
const EDGE = [
  V('Microsoft David - English (United States)', 'en-US'),
  V('Microsoft Zira - English (United States)', 'en-US'),
  V('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false),
  V('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB', false),
  V('Microsoft Nam Minh Online (Natural) - Vietnamese (Vietnam)', 'vi-VN', false),
  V('Microsoft Hoài My Online (Natural) - Vietnamese (Vietnam)', 'vi-VN', false),
];
/** Chrome trên Windows có cài gói giọng tiếng Việt: chỉ có Microsoft An (giọng nam, cục bộ). */
const WIN_LOCAL = [
  V('Microsoft An - Vietnamese (Vietnam)', 'vi-VN'),
  V('Microsoft David - English (United States)', 'en-US'),
  V('Google US English', 'en-US', false),
];
/** Chrome trên Android: một giọng tiếng Việt, tên là tên ngôn ngữ (có chữ "Nam" nhưng không phải giọng nam). */
const ANDROID = [V('Tiếng Việt Việt Nam', 'vi-VN'), V('English United States', 'en-US')];
/** Android (trình duyệt khác): mã giọng Google, bản cục bộ và bản qua mạng. */
const ANDROID_IDS = [
  V('vi-vn-x-gft-local', 'vi-VN'),
  V('vi-vn-x-gft-network', 'vi-VN', false),
  V('vi-vn-x-vic-network', 'vi-VN', false),
  V('en-us-x-sfg-local', 'en-US'),
];
/** iPhone / iPad (Safari): mọi giọng "Linh" trùng tên, chỉ voiceURI cho biết chất lượng. Bản thường đứng trước. */
const IOS = [
  V('Linh', 'vi-VN', true, 'com.apple.voice.compact.vi-VN.Linh'),
  V('Linh', 'vi-VN', true, 'com.apple.voice.super-compact.vi-VN.Linh'),
  V('Linh', 'vi-VN', true, 'com.apple.voice.enhanced.vi-VN.Linh'),
  V('Linh', 'vi-VN', true, 'com.apple.voice.premium.vi-VN.Linh'),
  V('Fred', 'en-US', true, 'com.apple.speech.synthesis.voice.Fred'),
  V('Grandpa', 'en-US', true, 'com.apple.eloquence.en-US.Grandpa'),
  V('Samantha', 'en-US', true, 'com.apple.voice.compact.en-US.Samantha'),
  V('Daniel', 'en-GB', true, 'com.apple.voice.compact.en-GB.Daniel'),
  V('Samantha', 'en-US', true, 'com.apple.voice.enhanced.en-US.Samantha'),
];
/** Biến thể: tên giọng có ghi chất lượng. */
const IOS_NAMED = [
  V('Linh (Compact)', 'vi-VN', true, 'com.apple.voice.compact.vi-VN.Linh'),
  V('Linh (Enhanced)', 'vi-VN', true, 'com.apple.voice.enhanced.vi-VN.Linh'),
];
/** iOS cũ: com.apple.ttsbundle.*-premium là bản "Nâng cao". */
const IOS_OLD = [
  V('Linh', 'vi-VN', true, 'com.apple.ttsbundle.Linh-compact'),
  V('Linh', 'vi-VN', true, 'com.apple.ttsbundle.Linh-premium'),
];
/** Máy không có giọng tiếng Việt (Chrome trên Windows chưa cài gói giọng, cửa sổ xem trước của ứng dụng). */
const NO_VI = [V('Microsoft David - English (United States)', 'en-US'), V('Google US English', 'en-US', false)];

const uri = (v: VoiceLike | null) => v?.voiceURI ?? v?.name ?? null;
const OPTS = { voiceRate: 1, charVoices: true, enRate: 0.9 };
const MALE = Object.entries(VOICE_PROFILES).filter(([, p]) => p.base === 'nam').map(([id]) => id);
const FEMALE = Object.entries(VOICE_PROFILES).filter(([, p]) => p.base === 'nu').map(([id]) => id);

function local(list: VoiceLike[], online = true, chosen: Parameters<typeof pickVoices>[2] = null): VoicePick {
  return pickVoices(list.filter((v) => v.localService), online, chosen);
}

describe('voice-profiles.ts – hồ sơ giọng', () => {
  it('Mọi nhân vật trong CAST, 6 dân làng và người chơi đều có giọng riêng', () => {
    for (const [id, m] of Object.entries(CAST)) {
      expect((m as { voice?: string }).voice).toBe(id);
      expect(VOICE_PROFILES[id], id).toBeTruthy();
    }
    expect(VILLAGERS.length).toBe(6);
    for (let i = 0; i < VILLAGERS.length; i++) {
      const sp = villager(i);
      expect(sp.voice).toBe(`v${VILLAGERS[i].v}`);
      expect(VOICE_PROFILES[sp.voice!], sp.name).toBeTruthy();
    }
    expect(ME.voice).toBe('kid');
    expect(VOICE_PROFILES.kid.base).toBe('nu');
    expect(Object.keys(VOICE_PROFILES).sort()).toEqual([...Object.keys(CAST), 'v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'kid'].sort());
  });

  it('Đúng bảng giọng: nữ / nam, tốc độ và cao độ', () => {
    expect(FEMALE.sort()).toEqual(['kid', 'meo', 'nai', 'soc', 'tho', 'v0', 'v2', 'v3', 'v4']);
    expect(MALE.sort()).toEqual(['cu', 'gau', 'he', 'hiepsi', 'robot', 'rua', 'v1', 'v5', 'voi', 'vua']);
    expect(VOICE_PROFILES.vua).toEqual({ base: 'nam', rate: 0.85, pitch: 0.88 });
    expect(VOICE_PROFILES.v4).toEqual({ base: 'nu', rate: 0.8, pitch: 0.92 });
    for (const p of Object.values(VOICE_PROFILES)) {
      expect(p.rate).toBeGreaterThanOrEqual(0.8);
      expect(p.rate).toBeLessThanOrEqual(1.12);
      expect(p.pitch).toBeGreaterThanOrEqual(0.88);
      expect(p.pitch).toBeLessThanOrEqual(1.15);
    }
  });

  it('Giọng dẫn chuyện: giọng nữ, cao độ 1, tốc độ 0.95; mã lạ hoặc tắt giọng nhân vật → giọng dẫn chuyện', () => {
    expect(NARRATOR).toEqual({ base: 'nu', rate: 0.95, pitch: 1 });
    for (const who of [undefined, null, '', 'xyz', 'constructor', 'hasOwnProperty', '__proto__']) expect(voiceProfile(who)).toEqual({ id: 'narrator', profile: NARRATOR });
    expect(voiceProfile('gau')).toEqual({ id: 'gau', profile: VOICE_PROFILES.gau });
    expect(voiceProfile('gau', false)).toEqual({ id: 'narrator', profile: NARRATOR });
  });
});

describe('voices.ts – giọng nam, giọng Apple', () => {
  it('Nhận ra giọng nam; chữ "Nam" trong tên nước không phải giọng nam', () => {
    for (const n of ['Microsoft Nam Minh Online (Natural) - Vietnamese (Vietnam)', 'Microsoft NamMinh Online (Natural) - Vietnamese (Vietnam)', 'Microsoft An - Vietnamese (Vietnam)', 'Vietnamese Male']) {
      expect(isMaleVi(V(n, 'vi-VN')), n).toBe(true);
    }
    for (const n of ['Tiếng Việt Việt Nam', 'Vietnamese (Vietnam)', 'Microsoft Hoài My Online (Natural) - Vietnamese (Vietnam)', 'Linh', 'Google Tiếng Việt', 'vi-vn-x-gft-local', 'Female Nam']) {
      expect(isMaleVi(V(n, 'vi-VN')), n).toBe(false);
    }
  });

  it('Chất lượng giọng Apple đọc từ voiceURI (Cao cấp > Nâng cao > Cơ bản)', () => {
    expect(IOS.slice(0, 4).map(voiceQuality)).toEqual(['Cơ bản', 'Cơ bản', 'Nâng cao', 'Cao cấp']);
    expect(IOS_NAMED.map(voiceQuality)).toEqual(['Cơ bản', 'Nâng cao']);
    expect(IOS_OLD.map(voiceQuality)).toEqual(['Cơ bản', 'Nâng cao']);
    expect(voiceQuality(EDGE[5])).toBe(null);
    expect(voiceQuality(ANDROID[0])).toBe(null);
  });

  it('Cao độ nhân vật nam khi máy chỉ có giọng nữ: ×0.85, giới hạn 0.6–1.5', () => {
    expect(malePitchFallback(1)).toBeCloseTo(0.85);
    expect(malePitchFallback(0.88)).toBeCloseTo(0.748);
    expect(malePitchFallback(0.5)).toBe(0.6);
    expect(malePitchFallback(3)).toBe(1.5);
  });
});

describe('voices.ts – chọn giọng trên từng loại máy', () => {
  it('Edge có mạng: dẫn chuyện Hoài My, nhân vật nam Nam Minh, tiếng Anh Aria', () => {
    const p = pickVoices(EDGE, true);
    expect(p.nu?.name).toMatch(/^Microsoft Hoài My Online/);
    expect(p.nam?.name).toMatch(/^Microsoft Nam Minh Online/);
    expect(p.en?.name).toMatch(/^Microsoft Aria Online/);
    expect(resolveVoice(VOICE_PROFILES.tho, p)).toEqual({ voice: p.nu, pitch: 1.08 });
    for (const id of MALE) expect(resolveVoice(VOICE_PROFILES[id], p)).toEqual({ voice: p.nam, pitch: VOICE_PROFILES[id].pitch });
  });

  it('Edge mất mạng (không có giọng Việt cục bộ): không có giọng dự phòng, tiếng Anh dùng giọng cục bộ', () => {
    const p = pickVoices(EDGE, false);
    expect(p.en?.name).toMatch(/^Microsoft (David|Zira)/);
    expect(local(EDGE, false).nu).toBe(null);
    expect(local(EDGE, false).nam).toBe(null);
  });

  it('Chrome trên Windows chỉ có Microsoft An: mọi vai dùng An, nhân vật nam không bị hạ giọng thêm', () => {
    const p = pickVoices(WIN_LOCAL, true);
    expect(p.nu?.name).toBe('Microsoft An - Vietnamese (Vietnam)');
    expect(p.nam).toBe(p.nu);
    expect(resolveVoice(VOICE_PROFILES.gau, p)?.pitch).toBe(0.97);
    expect(resolveVoice(VOICE_PROFILES.tho, p)?.pitch).toBe(1.08);
  });

  it('Android một giọng "Tiếng Việt Việt Nam": không có giọng nam → nhân vật nam đọc trầm hơn', () => {
    const p = pickVoices(ANDROID, true);
    expect(p.nu?.name).toBe('Tiếng Việt Việt Nam');
    expect(p.nam).toBe(null);
    for (const id of MALE) {
      const r = resolveVoice(VOICE_PROFILES[id], p);
      expect(r?.voice).toBe(p.nu);
      expect(r?.pitch).toBeCloseTo(VOICE_PROFILES[id].pitch * 0.85);
    }
    expect(resolveVoice(VOICE_PROFILES.soc, p)).toEqual({ voice: p.nu, pitch: 1.1 });
  });

  it('Android mã giọng Google: có mạng dùng giọng qua mạng, mất mạng dùng giọng cục bộ', () => {
    expect(pickVoices(ANDROID_IDS, true).nu?.name).toBe('vi-vn-x-gft-network');
    expect(pickVoices(ANDROID_IDS, false).nu?.name).toBe('vi-vn-x-gft-local');
    expect(local(ANDROID_IDS).nu?.name).toBe('vi-vn-x-gft-local');
  });

  it('iPhone/iPad: Linh Cao cấp > Nâng cao > Cơ bản > rút gọn; nhân vật nam dùng Linh đọc trầm hơn', () => {
    expect(rankVoices(IOS, 'vi').map(uri)).toEqual([
      'com.apple.voice.premium.vi-VN.Linh',
      'com.apple.voice.enhanced.vi-VN.Linh',
      'com.apple.voice.compact.vi-VN.Linh',
      'com.apple.voice.super-compact.vi-VN.Linh',
    ]);
    const p = pickVoices(IOS, true);
    expect(uri(p.nu)).toBe('com.apple.voice.premium.vi-VN.Linh');
    expect(p.nam).toBe(null);
    for (const id of MALE) expect(resolveVoice(VOICE_PROFILES[id], p)?.pitch).toBeCloseTo(VOICE_PROFILES[id].pitch * 0.85);
    // Chỉ có bản Nâng cao và bản thường (thường gặp nhất).
    expect(uri(pickVoices([IOS[0], IOS[2]], true).nu)).toBe('com.apple.voice.enhanced.vi-VN.Linh');
    expect(uri(pickVoices(IOS_OLD, true).nu)).toBe('com.apple.ttsbundle.Linh-premium');
    expect(uri(pickVoices(IOS_NAMED, true).nu)).toBe('com.apple.voice.enhanced.vi-VN.Linh');
  });

  it('iPhone/iPad tiếng Anh: Samantha Nâng cao trước, giọng vui (Fred, Grandpa) sau cùng', () => {
    expect(rankVoices(IOS, 'en').map(uri)).toEqual([
      'com.apple.voice.enhanced.en-US.Samantha',
      'com.apple.voice.compact.en-US.Samantha',
      'com.apple.voice.compact.en-GB.Daniel',
      'com.apple.speech.synthesis.voice.Fred',
      'com.apple.eloquence.en-US.Grandpa',
    ]);
  });

  it('Máy không có giọng tiếng Việt: không đọc lời Việt, vẫn đọc tiếng Anh', () => {
    const p = pickVoices(NO_VI, true);
    expect(p.nu).toBe(null);
    expect(p.nam).toBe(null);
    expect(resolveVoice(VOICE_PROFILES.gau, p)).toBe(null);
    const steps = planSpeech([{ text: 'Nghe nhé:', lang: 'vi', who: 'gau' }, { text: 'cat', lang: 'en' }], p, local(NO_VI), OPTS);
    expect(steps.map((s) => [s.lang, s.text, s.profile])).toEqual([['en', 'cat', 'en']]);
  });
});

describe('voices.ts – giọng chọn trong Cài đặt', () => {
  const ENH = { uri: 'com.apple.voice.enhanced.vi-VN.Linh', name: 'Linh' };

  it('Tìm theo voiceURI; mã không còn thì giọng tốt nhất cùng tên; không có thì tự động', () => {
    const ranked = rankVoices(IOS, 'vi');
    expect(uri(findChosen(ranked, ENH))).toBe(ENH.uri);
    expect(uri(findChosen(ranked, { uri: 'com.apple.voice.compact.vi-VN.Linh', name: 'Linh' }))).toBe('com.apple.voice.compact.vi-VN.Linh');
    expect(uri(findChosen(rankVoices(IOS.filter((v) => v.voiceURI !== ENH.uri), 'vi'), ENH))).toBe('com.apple.voice.premium.vi-VN.Linh');
    expect(findChosen(ranked, { uri: 'x', name: 'Không còn' })).toBe(null);
    expect(findChosen(ranked, null)).toBe(null);
    expect(uri(pickVoices(IOS, true, { uri: 'x', name: 'Không còn' }).nu)).toBe('com.apple.voice.premium.vi-VN.Linh');
  });

  it('Giọng chọn thay giọng dẫn chuyện và nhân vật nữ; nhân vật nam vẫn dùng giọng nam', () => {
    const an = { uri: 'Microsoft An - Vietnamese (Vietnam)', name: 'Microsoft An - Vietnamese (Vietnam)' };
    const list = [...EDGE, V(an.name, 'vi-VN')];
    const p = pickVoices(list, true, { uri: 'com.apple.voice.compact.vi-VN.Linh', name: 'Microsoft Hoài My Online (Natural) - Vietnamese (Vietnam)' });
    expect(p.nu?.name).toMatch(/Hoài My/);
    const q = pickVoices(list, true, an);
    expect(q.nu?.name).toBe(an.name);
    expect(resolveVoice(VOICE_PROFILES.tho, q)?.voice).toBe(q.nu);
    expect(q.nam?.name).toMatch(/Nam Minh/);
  });

  it('Mất mạng: bỏ qua giọng đã chọn nếu nó cần mạng', () => {
    const list = [...EDGE, V('Microsoft An - Vietnamese (Vietnam)', 'vi-VN')];
    const nm = { uri: EDGE[4].name, name: EDGE[4].name };
    expect(pickVoices(list, true, nm).nu?.name).toMatch(/Nam Minh/);
    expect(pickVoices(list, false, nm).nu?.name).toBe('Microsoft An - Vietnamese (Vietnam)');
  });
});

describe('voices.ts – kế hoạch đọc', () => {
  it('Giọng trực tuyến có giọng cục bộ dự phòng; nhân vật nam dự phòng bằng giọng nữ đọc trầm', () => {
    const list = [...EDGE, V('Linh', 'vi-VN')];
    const steps = planSpeech([{ text: 'Chào bạn!', lang: 'vi', who: 'gau' }, { text: 'Hello!', lang: 'en', who: 'gau' }], pickVoices(list), local(list), { ...OPTS, voiceRate: 1.2 });
    expect(steps.map((s) => [s.lang, s.profile, s.voice.name.split(' ')[1], s.pitch])).toEqual([
      ['vi', 'gau', 'Nam', 0.97],
      ['en', 'en', 'Aria', 1],
    ]);
    expect(steps[0].rate).toBeCloseTo(0.9 * 1.2);
    expect(steps[1].rate).toBeCloseTo(0.9 * 1.2);
    expect(steps[0].retry?.voice.name).toBe('Linh');
    expect(steps[0].retry?.pitch).toBeCloseTo(0.97 * 0.85);
    expect(steps[1].retry?.voice.name).toMatch(/^Microsoft (David|Zira)/);
  });

  it('Giọng cục bộ không cần dự phòng; đoạn rỗng bị bỏ', () => {
    const steps = planSpeech([{ text: '🐻', lang: 'vi', who: 'gau' }, { text: 'Chào!', lang: 'vi', who: 'tho' }], pickVoices(IOS), local(IOS), OPTS);
    expect(steps.length).toBe(1);
    expect(steps[0].retry).toBe(null);
    expect(steps[0].profile).toBe('tho');
  });

  it('Tắt giọng nhân vật: mọi lời Việt theo giọng dẫn chuyện', () => {
    const steps = planSpeech([{ text: 'Chào!', lang: 'vi', who: 'vua' }], pickVoices(EDGE), local(EDGE), { ...OPTS, charVoices: false });
    expect(steps[0].profile).toBe('narrator');
    expect(steps[0].voice.name).toMatch(/Hoài My/);
    expect(steps[0].pitch).toBe(1);
    expect(steps[0].rate).toBeCloseTo(0.95);
  });
});

describe('voices.ts – nhãn ô "Chọn giọng đọc"', () => {
  it('iPhone/iPad: tên + chất lượng, không trùng nhãn', () => {
    expect(voiceLabels(rankVoices(IOS, 'vi'))).toEqual(['Linh (Cao cấp)', 'Linh (Nâng cao)', 'Linh (Cơ bản)', 'Linh (Cơ bản) 2']);
    expect(voiceLabels(rankVoices(IOS_NAMED, 'vi'))).toEqual(['Linh (Nâng cao)', 'Linh (Cơ bản)']);
    expect(voiceLabels(rankVoices(IOS_OLD, 'vi'))).toEqual(['Linh (Nâng cao)', 'Linh (Cơ bản)']);
  });

  it('Edge: tên người đọc, ghi "(cần mạng)" cho giọng trực tuyến', () => {
    expect(voiceLabels(rankVoices([...EDGE, V('Microsoft An - Vietnamese (Vietnam)', 'vi-VN')], 'vi'))).toEqual(['Hoài My (cần mạng)', 'Nam Minh (cần mạng)', 'An']);
  });

  it('Android: tên chỉ có chữ giữ nguyên; mã giọng khó đọc → "Giọng 1, 2…"', () => {
    expect(voiceLabels(rankVoices(ANDROID_IDS, 'vi'))).toEqual(['Giọng 1 (cần mạng)', 'Giọng 2 (cần mạng)', 'Giọng 3']);
    expect(voiceLabels(rankVoices(ANDROID, 'vi'))).toEqual(['Tiếng Việt Việt Nam']);
    expect(voiceLabels([V('Tiếng Việt Việt Nam', 'vi-VN'), V('Tiếng Việt Việt Nam', 'vi-VN', false), V('vi-VN-SMTl01', 'vi-VN')])).toEqual([
      'Tiếng Việt Việt Nam',
      'Tiếng Việt Việt Nam 2 (cần mạng)',
      'Giọng 1',
    ]);
  });
});

describe('device.ts – điện thoại, máy tính bảng', () => {
  it('Nhận ra Android, iPhone, iPad (cả iPad báo là Mac); máy tính thì không', () => {
    expect(detectMobileOs('Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36')).toBe('android');
    expect(detectMobileOs('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1')).toBe('ios');
    expect(detectMobileOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15', 'MacIntel', 5)).toBe('ios');
    expect(detectMobileOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15', 'MacIntel', 0)).toBe(null);
    expect(detectMobileOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36 Edg/154.0', 'Win32', 10)).toBe(null);
  });
});

describe('state.ts – cài đặt giọng đọc', () => {
  it('Cài đặt cũ (chưa có giọng nhân vật) vẫn đọc được: bật giọng nhân vật, chọn giọng tự động', () => {
    const old = { music: 0.3, sfx: 0.6, voice: false, voiceRate: 1.2, fullscreenHint: false, quality: 'low' };
    expect(mergeSettings(old)).toEqual({ ...old, charVoices: true, voiceVi: null });
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.charVoices).toBe(true);
    expect(DEFAULT_SETTINGS.voiceVi).toBe(null);
  });

  it('Giá trị sai kiểu lấy mặc định', () => {
    const s = mergeSettings({ music: 'to', voice: 'yes', voiceRate: Number.NaN, quality: 'ultra', charVoices: 0, voiceVi: { uri: 5, name: 'Linh' }, extra: 1 });
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({ charVoices: false, voiceVi: { uri: 'com.apple.voice.enhanced.vi-VN.Linh', name: 'Linh', x: 1 } })).toEqual({
      ...DEFAULT_SETTINGS,
      charVoices: false,
      voiceVi: { uri: 'com.apple.voice.enhanced.vi-VN.Linh', name: 'Linh' },
    });
  });
});