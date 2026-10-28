/* 울림 — 화음: 지금 키의 주요 화음(Ⅰ~Ⅶ)과 그 화음으로 끌어가는 세컨더리 도미넌트, 코드 이름, 자리 잡기(보이싱).
   연주 화면의 코드 패드와 클립 칸의 '코드 넣기'가 함께 쓴다 */
(function (U) {
'use strict';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NAT = [0, 2, 4, 5, 7, 9, 11];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const TYPES = [
  ['triad', '3화음', '도·미·솔처럼 세 음이에요. 가장 기본이에요.'],
  ['seventh', '7화음', '세 음에 7도를 더해 부드럽고 세련돼요. 재즈·알앤비·로파이에 잘 어울려요.'],
  ['ninth', '9화음', '7화음에 9도까지 쌓아 풍성해요. 근음은 아래에 두고 나머지를 붙여 짚어요.']
];
const PRIMARY = [0, 3, 4];   // 주요 3화음: Ⅰ · Ⅳ · Ⅴ (단조는 i · iv · v)

/* 7음 스케일이 아니면(펜타토닉·블루스 등) 3도를 보고 가까운 메이저·마이너로 화음을 만든다 */
function parentScale(scaleId) {
  const st = U.scaleOf(scaleId).steps;
  if (st.length === 7) return scaleId;
  return st.includes(3) && !st.includes(4) ? 'minor' : 'major';
}
/* 음 이름: 키의 글자에서 도수만큼 나아간 글자에 ♯·♭을 붙인다 (E♭ 마이너면 G♭, C♭처럼 제 글자로) */
function spell(keyRoot, deg, pc) {
  const L = (LETTERS.indexOf(U.ROOT_NAMES[keyRoot][0]) + deg) % 7;
  const diff = ((pc - NAT[L]) % 12 + 12) % 12;
  return LETTERS[L] + ({ 0: '', 1: '♯', 2: '♯♯', 11: '♭', 10: '♭♭' }[diff] || '');
}
/* 근음 위 반음 수 목록 → 코드 꼬리표 (m7, maj9, m7♭5 …) */
const CORE = {
  '4-7-': '', '3-7-': 'm', '3-6-': '°', '4-8-': '+',
  '4-7-11': 'maj7', '4-7-10': '7', '3-7-10': 'm7', '3-7-11': 'm(maj7)', '3-6-10': 'm7♭5', '3-6-9': '°7', '4-8-11': '+maj7', '4-8-10': '+7'
};
const NINE = { maj7: 'maj9', 7: '9', m7: 'm9', 'm(maj7)': 'm(maj9)', 'm7♭5': 'm9♭5', '+7': '+9' };
function quality(iv) {
  const has = x => iv.includes(x);
  const third = has(4) ? 4 : 3, fifth = has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : 7;
  const sev = has(11) ? 11 : has(10) ? 10 : third === 3 && fifth === 6 && has(9) ? 9 : '';
  let q = CORE[third + '-' + fifth + '-' + sev];
  if (q == null) q = '';
  if (has(14)) q = sev === '' ? q + 'add9' : NINE[q] || q + '(9)';
  return q;
}
function same(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }

/* 키 안의 화음 일곱 개. type: triad · seventh · ninth */
function diatonic(key, type) {
  const st = U.scaleOf(parentScale(key.scale)).steps;
  const out = [];
  for (let d = 0; d < 7; d++) {
    const tone = j => { const k = d + j; return st[k % 7] + 12 * Math.floor(k / 7) - st[d]; };   // 근음에서 몇 반음 위
    const iv = [0, tone(2), tone(4)];
    if (type === 'seventh' || type === 'ninth') iv.push(tone(6));
    // 9화음: 키 안의 9도가 단9도(♭9)면 거칠게 부딪쳐서 빼고 7화음으로 둔다
    if (type === 'ninth' && tone(8) === 14) iv.push(14);
    const pc = (key.root + st[d]) % 12;
    const minor = iv[1] === 3, dim = minor && iv[2] === 6, aug = !minor && iv[2] === 8;
    const acc = { '-1': '♭', 1: '♯' }[st[d] - NAT[d]] || '';
    const roman = acc + (minor ? ROMAN[d].toLowerCase() : ROMAN[d]) + (dim ? '°' : aug ? '+' : '');
    out.push({ id: 'd' + d, deg: d, pc, iv, roman, dim, primary: PRIMARY.includes(d), name: spell(key.root, d, pc) + quality(iv) });
  }
  return out;
}
/* 세컨더리 도미넌트: 키 안의 화음(감화음 빼고)마다 그 화음의 5도 위에서 끌어 주는 도미넌트.
   이미 키 안에 같은 화음이 있으면(메이저의 V7 등) 뺀다 */
function secondary(key, type) {
  const dia = diatonic(key, type), triads = diatonic(key, 'triad');
  const iv = type === 'triad' ? [0, 4, 7] : type === 'ninth' ? [0, 4, 7, 10, 14] : [0, 4, 7, 10];
  const out = [];
  for (const t of triads) {
    if (t.dim) continue;
    const pc = (t.pc + 7) % 12;
    if (dia.some(c => c.pc === pc && same(c.iv, iv))) continue;
    const deg = (t.deg + 4) % 7;
    out.push({ id: 's' + t.deg, deg, pc, iv, sec: true, target: t.name, roman: (type === 'triad' ? 'V/' : 'V7/') + t.roman, name: spell(key.root, deg, pc) + quality(iv) });
  }
  return out;
}

/* 화음을 실제 음으로. center 근처에 붙여 짚고, prev(앞 화음의 음)가 있으면 덜 움직이는 자리바꿈을 고른다.
   9화음은 근음을 아래로 내리고 나머지 네 음을 붙여 짚는다. bass면 근음을 한 옥타브 아래에 더한다 */
function voice(ch, center, prev, o) {
  o = o || {};
  const rootless = ch.iv.length >= 5;
  const pcs = (rootless ? ch.iv.slice(1) : ch.iv).map(x => (ch.pc + x) % 12);
  const n = pcs.length;
  const build = (k, first) => {
    const out = [first];
    for (let j = 1; j < n; j++) { let p = out[j - 1] + 1; while ((p % 12 + 12) % 12 !== pcs[(k + j) % n]) p++; out.push(p); }
    return out;
  };
  const cands = [];
  for (let k = 0; k < n; k++) {
    for (let p = center - 10; p <= center + 6; p++) if ((p % 12 + 12) % 12 === pcs[k]) cands.push({ k, ps: build(k, p) });
  }
  const mid = ps => ps.reduce((a, b) => a + b, 0) / ps.length;
  let best;
  if (o.smooth !== false && prev && prev.length) {
    const pv = prev.slice().sort((a, b) => a - b);
    const cost = ps => (ps.length === pv.length ? ps.reduce((s, p, i) => s + Math.abs(p - pv[i]), 0) : Math.abs(mid(ps) - mid(pv)) * ps.length) + 0.35 * Math.abs(mid(ps) - center);
    best = cands.reduce((a, b) => (cost(b.ps) < cost(a.ps) ? b : a));
  } else {
    // 기본 자리: 기본형(근음부터, 9화음은 3음부터)으로 가운데에 가장 가깝게
    best = cands.filter(c => c.k === 0).reduce((a, b) => (Math.abs(mid(b.ps) - center) < Math.abs(mid(a.ps) - center) ? b : a));
  }
  const top = best.ps;
  const extra = [];
  if (rootless) {
    let r = top[0] - (((top[0] - ch.pc) % 12) + 12) % 12;
    if (top[0] - r < 3) r -= 12;
    extra.push(r);
  } else if (o.bass) {
    let r = top[0] - (((top[0] - ch.pc) % 12) + 12) % 12;
    if (r === top[0]) r -= 12;
    extra.push(r);
  }
  return { top, all: extra.concat(top).filter(p => p >= 12 && p <= 115) };
}

U.chords = { TYPES, diatonic, secondary, voice, quality, parentScale, spell };
})(window.U = window.U || {});
