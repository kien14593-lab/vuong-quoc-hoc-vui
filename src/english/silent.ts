/**
 * Chữ câm (và chữ đọc khác hẳn mặt chữ) trong từ tiếng Anh: write – w, knife – k, climb – b, white – h,
 * kitchen – t, bridge – d, scissors – c, island – s, autumn – n, builder – u, busy – u…
 * Câu hỏi điền chữ không bao giờ khoét chỗ trống vào những chữ này, vì bé nghe từ mà không nghe ra chữ đó.
 *
 * Mỗi quy tắc có hai nhóm: (phần đứng trước)(chữ câm). Không dùng regex nhìn ngược – Safari cũ không hỗ trợ.
 * Được phép khoét (không phải chữ câm): ck, sh, ch, th, ph, ng, chữ đôi (rabbit), nhóm nguyên âm (boat, rain),
 * «b» trong «number», «l» trong «island», «u» trong «penguin», «language» (đọc /w/).
 */

interface Rule {
  re: RegExp;
  /** Chỉ áp dụng khi cả từ khớp mẫu này. */
  only?: RegExp;
  /** Bỏ qua khi cả từ khớp mẫu này (từ ngoại lệ). */
  not?: RegExp;
  /** Chữ câm đi cặp với chữ ngay trước (wh, rh, gh đầu từ, ch đọc /k/): khoét cả cặp thì vẫn nghe được. */
  pair?: boolean;
}

const rule = (re: RegExp, extra: Omit<Rule, 're'> = {}): Rule => ({ re: new RegExp(re.source, 'g'), ...extra });

/** who, whom, whose, whole, whoever – «w» câm, «h» đọc được. */
const WHO = /^who(?:$|m|se|le|lly|ever)/;
/** Từ có «ch» đọc là /k/ (school, Christmas, headache…). */
const CH_K =
  /school|scholar|schem|schedul|^christ|^chemi|^chemo|^chord|^chorus|^choir|^chaos|^chamel|^character|^chrom|^chlor|orchestr|orchid|mechani|techn|anchor|archit|archiv|psych|^echo|stomach|monarch|^(?:head|tooth|ear|back|stomach|heart|belly)?ach(?:e[sd]?|ing)$/;

const RULES: Rule[] = [
  // Phụ âm câm đầu từ.
  rule(/()(w)r/),
  rule(/^()(k)n/),
  rule(/^(un|door|pen|pocket)(k)n/),
  rule(/^()(g)n/),
  rule(/()(g)n(?=(?:e|s|es|ed|ing|er|ers|ments?)?$)/),
  rule(/^()(p)[snt]/),
  rule(/^()(h)(?=our|onest|onou?r|eir)/),
  rule(/^()(w)/, { only: WHO }),
  rule(/(w)(h)/, { not: WHO, pair: true }),
  rule(/^(r)(h)/, { pair: true }),
  rule(/^(g)(h)/, { pair: true }),
  rule(/(c)(h)/, { only: CH_K, pair: true }),
  rule(/^(t)(h)(?=ai|ames|omas|yme)/),
  // gh trong night, eight, doughnut, cough, laugh: không nghe ra «g» hay «h» (dog|house, spag|hetti thì có).
  rule(/([a-z])(gh)/, { not: /spaghett|yoghurt|(?:dog|fog|pig|big|egg|log|leg|bug|frog|flag|bag|jug|mug|hog)h/ }),
  rule(/^(spag|yog)(h)/),
  // b câm: climb, lamb, thumb, plumber, doubt, debt, subtle.
  rule(/(m)(b)(?=(?:s|ed|ing)?$)/),
  rule(/^(clim|plum|bom|com|dum)(b)ers?$/),
  rule(/^(dou|de)(b)t/),
  rule(/^(su)(b)tl/),
  // t câm: watch, kitchen, castle, whistle, listen, often, Christmas, ballet.
  rule(/()(t)ch/),
  rule(/(s)(t)l(?=e|ing|er)/),
  rule(/([sf])(t)en(?=(?:s|ed|ing|er|ers)?$)/),
  rule(/^(chris)(t)m/),
  rule(/^(balle|buffe|bouque|bere|chale|gourme|croque|debu|depo)(t)s?$/),
  // d câm: bridge, hedgehog, sandwich, handsome, Wednesday, grandma.
  rule(/()(d)g(?=[eiy])/),
  rule(/^(san|han)(d)(?=wich|some|kerchief)/),
  rule(/^(we)(d)nes/),
  rule(/^(gran)(d)(?=[^aeiouy])/),
  // c câm: scissors, science, scene, muscle.
  rule(/(s)(c)(?=[eiy])/, { not: /^scep/ }),
  rule(/^(mus)(c)le/),
  // n câm: autumn, column, hymn.
  rule(/(m)(n)(?=s?$)/),
  // s câm: island, aisle, isle.
  rule(/^(i|ai)(s)l(?=and|e)/),
  // l câm: walk, talk, folk, half, calf, calm, palm, salmon, could, would, should.
  rule(/([ao])(l)k/),
  rule(/^((?:be)?[hc]a)(l)(?=f|ve)/),
  rule(/(^a|[^e]a)(l)m/, { not: /^alm(?:ost|ight|anac)/ }),
  rule(/^((?:c|w|sh)ou)(l)d(?=$|n)/),
  // r câm: iron.
  rule(/^(i)(r)on(?:s|ed|ing)?$/),
  // w câm: two, answer, sword.
  rule(/^(t)(w)os?$/),
  rule(/^(ans)(w)er/),
  rule(/^(s)(w)ord/),
  // h câm: exhaust, vehicle, shepherd, oh.
  rule(/^(ex)(h)(?=aust|ibit|ilar)/),
  rule(/^(ve)(h)icle/),
  rule(/^(shep)(h)erd/),
  rule(/^([aou])(h)$/),
  // u câm: guitar, guess, guide, build, buy, biscuit, unique, tongue.
  rule(/(^g|[^n]g)(u)(?=[aeiouy])/, { not: /jaguar|guava|iguana|guacamol|^argu|ambigu|segue/ }),
  rule(/^(b)(u)(?=i|y)/),
  rule(/(c)(u)its?$/),
  rule(/(q)(u)es?$/),
  rule(/^(tong)(u)e/),
  // p câm: cupboard, raspberry, receipt; ch câm: yacht.
  rule(/^(cu)(p)board/),
  rule(/^(ras)(p)berr/),
  rule(/^(recei)(p)t/),
  rule(/^(ya)(ch)t/),
  // Nguyên âm câm hoặc đọc khác hẳn mặt chữ: eye, bye, one, people, leopard, friend, heart, busy, women, many, pretty.
  rule(/^()(eye)(?=s?$)/),
  rule(/^([^aeiouy]+y[^aeiouy]*)(e)[sd]?$/),
  rule(/(by)(e)s?$/),
  rule(/^()(o)n(?:e|ce)$/),
  rule(/^(pe)(o)ple/),
  rule(/^(le|je)(o)pard/),
  rule(/^(fr)(i)end/),
  rule(/^(h)(e)art/),
  rule(/^(b)(u)s(?=y|i)/),
  rule(/^(bus)(i)ness/),
  rule(/^(w)(o)men$/),
  rule(/^(m?)(a)ny(?:$|thing|one|body|where|more|way)/),
  rule(/^(pr)(e)tt/),
];

type Mark = { pair: boolean };
const cache = new Map<string, ReadonlyMap<number, Mark>>();

function marks(word: string): ReadonlyMap<number, Mark> {
  const hit = cache.get(word);
  if (hit) return hit;
  const out = new Map<number, Mark>();
  const lower = word.toLowerCase();
  const words = /[a-z]+/g;
  for (let w = words.exec(lower); w; w = words.exec(lower)) {
    const part = w[0];
    for (const r of RULES) {
      if ((r.only && !r.only.test(part)) || r.not?.test(part)) continue;
      r.re.lastIndex = 0;
      for (let m = r.re.exec(part); m; m = r.re.exec(part)) {
        const at = w.index + m.index + m[1].length;
        for (let i = 0; i < m[2].length; i++) {
          const prev = out.get(at + i);
          out.set(at + i, { pair: !!r.pair && (prev?.pair ?? true) });
        }
      }
    }
  }
  cache.set(word, out);
  return out;
}

/** Vị trí các chữ câm trong từ (hoặc cụm từ), tăng dần. */
export function silentLetters(word: string): number[] {
  return [...marks(word).keys()].sort((a, b) => a - b);
}

/**
 * Chỗ trống `len` chữ từ vị trí `at` có che chữ câm không. Che trọn một cặp (wh trong white, ch trong school)
 * thì vẫn nghe được cả cặp; che riêng chữ câm (w_ite, sc_ool) thì không.
 */
export function hidesSilent(word: string, at: number, len = 1): boolean {
  const s = marks(word);
  for (let i = at; i < at + len; i++) {
    const m = s.get(i);
    if (!m) continue;
    if (m.pair && i > at && !s.has(i - 1)) continue;
    return true;
  }
  return false;
}
