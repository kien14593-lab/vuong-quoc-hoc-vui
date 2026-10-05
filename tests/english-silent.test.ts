import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BANK } from '../src/english/bank';
import { forgetRecent, setStrict, type EnOptions } from '../src/english/gen';
import type { Ctx } from '../src/english/gen-core';
import { gapFills } from '../src/english/gen-letters';
import { trainRound } from '../src/english/mini';
import { hidesSilent, silentLetters } from '../src/english/silent';
import { unitCount } from '../src/english/units';
import type { Grade } from '../src/math/types';
import { setMathRng } from '../src/math/util';

/**
 * Chữ câm (write – w, knife – k, climb – b, kitchen – t…): bé nghe từ mà không nghe ra chữ đó, nên câu điền chữ
 * và tàu chữ không bao giờ khoét chỗ trống vào đây. Mỗi mẫu viết hoa chữ câm: "kiTchen" → vị trí 2.
 */
const upper = (m: string) => [...m].flatMap((ch, i) => (ch !== ch.toLowerCase() ? [i] : []));
const SEEDS = Number(process.env.EN_SEEDS) || 6;
const plainWords = [...new Set(BANK.map((w) => w.w).filter((w) => /^[a-z]+$/.test(w)))];

describe('chữ câm trong từ tiếng Anh', () => {
  it('các từ điều phối tìm thấy trong câu hỏi', () => {
    const found = [
      'Write', 'Writing', 'Writer', 'Knife', 'climB', 'rHino', 'wHite', 'wiTch', 'kiTchen', 'briDge', 'douGHnut',
      'couGH', 'bUilder', 'sCissors', 'sCientist', 'iSland', 'foreiGn', 'autumN',
    ];
    for (const m of found) expect(silentLetters(m.toLowerCase()), m).toEqual(upper(m));
  });

  it('các mẫu khác: wr-, kn-, -mb, gh, wh/rh, tch, -stle/-sten, dge, sc+e/i, gu+nguyên âm, -mn, -gn, isl…', () => {
    const more = [
      'Know', 'Wrong', 'lamB', 'thumB', 'plumBer', 'casTle', 'wHisTle', 'lisTen', 'ofTen', 'Hour', 'Honest', 'Who',
      'wHale', 'gHost', 'niGHt', 'eiGHt', 'dauGHter', 'neiGHbour', 'heDgehog', 'sCience', 'gUess', 'gUitar', 'bUy',
      'biscUit', 'tWo', 'ansWer', 'waLk', 'taLk', 'haLf', 'caLm', 'couLd', 'shouLd', 'weDnesday', 'sanDwich', 'granDma',
      'scHool', 'headacHe', 'columN', 'siGn', 'Gnome', 'PsycHology', 'iSle', 'EYE', 'EYEs', 'byE', 'goodbyE', 'frIend',
      'hEart', 'bUsy', 'peOple', 'leOpard', 'wOmen', 'mAny', 'Any', 'One', 'Once', 'prEtty', 'yaCHt', 'cuPboard',
    ];
    for (const m of more) expect(silentLetters(m.toLowerCase()), m).toEqual(upper(m));
    expect(silentLetters('Write')).toEqual([0]);
    expect(silentLetters('ice cream')).toEqual([]);
    expect(silentLetters('climb a tree')).toEqual([4]);
  });

  it('không phải chữ câm: ck, «number» b, «island» l, «penguin» u, «honey» h…', () => {
    const heard = [
      'numBer', 'isLand', 'duCK', 'Honey', 'pengUin', 'langUage', 'qUeen', 'siGnal', 'maGnet', 'reaLm', 'aLmost',
      'shouLder', 'teaCHing', 'beaCHes', 'yEs', 'kitTen', 'doGHouse', 'White', 'umBrella', 'Thin', 'cHair', 'woMan',
      'miLk', 'Swim', 'baskEt', 'Cake', 'raIn',
    ];
    for (const m of heard) for (const at of upper(m)) expect(hidesSilent(m.toLowerCase(), at), `${m} @${at}`).toBe(false);
  });

  it('chữ ghép đi cặp: khoét cả «wh», «rh», «ch» (/k/) thì nghe được; khoét riêng chữ câm thì không', () => {
    expect(hidesSilent('white', 0, 2)).toBe(false);
    expect(hidesSilent('white', 1)).toBe(true);
    expect(hidesSilent('rhino', 0, 2)).toBe(false);
    expect(hidesSilent('rhino', 1)).toBe(true);
    expect(hidesSilent('school', 1, 2)).toBe(false);
    expect(hidesSilent('school', 2)).toBe(true);
    expect(hidesSilent('who', 0, 2)).toBe(true);
    expect(hidesSilent('write', 0, 2)).toBe(true);
    expect(hidesSilent('knife', 0, 2)).toBe(true);
    expect(hidesSilent('night', 2, 2)).toBe(true);
    expect(hidesSilent('kitchen', 2, 3)).toBe(true);
    expect(hidesSilent('cat', 0, 3)).toBe(false);
  });

  it('mọi từ trong ngân hàng × mọi vị trí: gapFills không khoét chữ câm', () => {
    const c = { R: Rng.seeded('silent'), k: 3 } as unknown as Ctx;
    const bad: string[] = [];
    let blocked = 0;
    for (const w of plainWords) {
      for (let at = 0; at < w.length; at++) {
        if (!hidesSilent(w, at)) continue;
        blocked++;
        if (gapFills(c, w, at)) bad.push(`${w} @${at}`);
      }
    }
    expect(blocked).toBeGreaterThan(40);
    expect(bad).toEqual([]);
  });

  it('từ có mẫu chữ câm hay gặp thì đã được đánh dấu, hoặc đã xem và nghe được hết', () => {
    const SUSPECT =
      /wr|kn|gn|mb|gh|wh|rh|tch|stl|sten|ften|dg|sc[eiy]|mn$|isl|[ao]lk|alf|alm|ould|gu[aeiouy]|bu[iy]|^p[snt]|^h(?:our|on|eir)|cuit|cht|pb|ipt|^eye/;
    const HEARD = new Set(['number', 'umbrella', 'language', 'penguin', 'honey']);
    const unreviewed = plainWords.filter((w) => SUSPECT.test(w) && !silentLetters(w).length && !HEARD.has(w));
    expect(unreviewed).toEqual([]);
  });
});

describe('tàu chữ (en_spell): toa trống không phải chữ câm', () => {
  setStrict(true);
  it('mọi lớp 2–5 × Unit × mức', () => {
    const bad: string[] = [];
    let n = 0;
    for (const g of [2, 3, 4, 5] as Grade[]) {
      const units = [...new Set([null, 1, Math.max(1, Math.floor(unitCount(g) / 2)), unitCount(g)])];
      for (const u of units) {
        for (const L of [1, 2]) {
          for (let s = 0; s < SEEDS * 3; s++) {
            forgetRecent();
            setMathRng(Rng.seeded(`silent|${g}|${u}|${L}|${s}`));
            const o: EnOptions = { grade: g, units: u, listen: s % 2 === 0 };
            const r = trainRound(o, 'en_spell', L);
            if (!r?.q.en) continue;
            n++;
            if (hidesSilent(r.q.en, r.missing)) bad.push(`g${g} U${u} L${L}: ${r.cars.join('')} «${r.fill}»`);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });
});
