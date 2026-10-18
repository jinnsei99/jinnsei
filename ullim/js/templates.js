/* 울림 — 장르 템플릿과 곡 구조: 장르를 고르면 템포·키·악기·패턴·사이드체인·씬·어레인지먼트까지 한 번에 만든다 */
(function (U) {
'use strict';
const OFF = -70;
const DR = (rows, len) => U.drumPattern(rows, 0.25, len);
const nt = (p, s, d, v) => ({ p, s, d, v: v || 100 });

/* ================= 패턴 도우미 ================= */
/* 한 마디(16칸)짜리 줄을 bars번 되풀이 */
function bars16(rows, bars) {
  const out = {};
  for (const k in rows) out[k] = rows[k].repeat(rows[k].length > 16 ? 1 : bars);
  return DR(out, bars * 4);
}
/* 클립 첫 박에 크래시 한 번 */
function crash(c, v) { c.notes.push(nt(49, 0, 0.5, v || 96)); return c; }
/* 빌드업: 네 토막에 걸쳐 4분 → 8분 → 16분 → 32분으로 빨라지는 롤. 킥은 마지막 두 마디에서 빠진다 */
function buildUp(bars, o) {
  o = o || {};
  const len = bars * 4, part = len / 4, notes = [];
  [1, 0.5, 0.25, 0.125].forEach((st, q) => {
    for (let s = q * part; s < (q + 1) * part - 1e-9; s += st) notes.push(nt(o.snare || 38, s, st * 0.9, Math.round(55 + 70 * s / len)));
  });
  const stop = Math.max(0, len - 8);
  if (o.kick !== false) for (let s = 0; s < stop; s++) notes.push(nt(36, s, 0.25, 110));
  if (o.hat) for (let s = 0.5; s < stop; s++) notes.push(nt(o.hat, s, 0.2, 76));
  return { len, notes };
}
/* 트랩 하이햇: 8분 바탕에 16분·셋잇단 롤 */
function trapHats(bars, rollAt) {
  const notes = [];
  for (let i = 0; i < bars * 8; i++) {
    const s = i * 0.5;
    if ((rollAt || [7, 15]).includes(i % 16)) { for (let j = 0; j < 3; j++) notes.push(nt(42, s + j / 6, 0.15, 70 + j * 12)); continue; }
    if (i % 16 === 11) { notes.push(nt(42, s, 0.2, 90), nt(42, s + 0.25, 0.2, 70)); continue; }
    notes.push(nt(42, s, 0.2, i % 2 ? 72 : 100));
  }
  return notes;
}
/* 리듬 문자열: x 치기(X는 세게), - 이어 누르기, . 쉼. 16칸이 한 마디 */
function hits(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '.' || c === '-') continue;
    let j = i + 1;
    while (j < str.length && str[j] === '-') j++;
    out.push({ s: i * 0.25, d: (j - i) * 0.25, c });
  }
  return out;
}
/* 코드: prog는 스케일 도수, 화음마다 bars마디. size 3이면 3화음, 4면 7화음 */
function chords(key, prog, o) {
  const bars = o.bars || 1, notes = [];
  prog.forEach((deg, ci) => {
    const ps = [];
    for (let j = 0; j < (o.size || 3); j++) ps.push(U.degreeToPitch(deg + j * 2, key.root, key.scale, o.base || 60));
    for (let b = 0; b < bars; b++) {
      const at = (ci * bars + b) * 4;
      for (const hh of hits(o.rhythm || 'x---------------')) {
        ps.forEach((p, k) => notes.push(nt(p, at + hh.s + (o.strum || 0) * k, hh.d * (o.gate || 0.96) - (o.strum || 0) * k, hh.c === 'X' ? 112 : o.vel || 92)));
      }
    }
  });
  return { len: prog.length * bars * 4, notes };
}
/* 베이스: 줄 문자 x/X 근음, o 옥타브 위, 5 5도, - 이어 누르기. pattern이 배열이면 마디마다 돌려 쓴다 */
function bassline(key, prog, o) {
  const bars = o.bars || 1, pats = [].concat(o.pattern), notes = [];
  let bi = 0;
  prog.forEach((deg, ci) => {
    const root = U.degreeToPitch(deg, key.root, key.scale, o.base || 36);
    const fifth = U.degreeToPitch(deg + 4, key.root, key.scale, o.base || 36);
    for (let b = 0; b < bars; b++, bi++) {
      for (const hh of hits(pats[bi % pats.length])) {
        const p = hh.c === 'o' ? root + 12 : hh.c === '5' ? fifth : root;
        notes.push(nt(p, (ci * bars + b) * 4 + hh.s, hh.d * (o.gate || 0.9), hh.c === 'X' ? 120 : o.vel || 104));
      }
    }
  });
  return { len: prog.length * bars * 4, notes };
}
/* 멜로디: [도수, 시작 박, 길이] */
function melody(key, list, len, base) {
  return { len, notes: list.map(([d, s, l, v]) => nt(U.degreeToPitch(d, key.root, key.scale, base || 72), s, l, v || 98)) };
}
const riser = { audio: 'gen:fx-riser', name: '라이저', align: 'end' };
const impact = { audio: 'gen:fx-impact', name: '임팩트' };
const duck = depth => ['duck', { div: '1/4', depth, rel: 0.18 }];
const glue = ['comp', { thr: -16, ratio: 3, att: 0.02, rel: 0.15, makeup: 2 }];

/* ================= 장르 ================= */
const EDM = ['intro', 'build', 'drop', 'break', 'outro'];
const ROLE_NAMES = { intro: '인트로', build: '빌드업', drop: '드롭', break: '브레이크', outro: '아웃트로', main: '메인' };
const GENRES = [];

/* ---------- 하우스 ---------- */
(() => {
  const key = { root: 9, scale: 'minor' }; // A 마이너
  const prog = [0, 5, 2, 6];              // Am F C G
  GENRES.push({
    id: 'house', name: '하우스', bpm: 124, key, swing: 0.08,
    desc: '네 박 킥에 오프비트 하이햇, 펌핑하는 베이스와 건반 스탭',
    roles: EDM,
    structure: [['intro', 8], ['build', 8], ['drop', 16], ['break', 8], ['build', 8], ['drop', 16], ['outro', 8]],
    tracks: [
      { name: '드럼', color: 1, kit: 'k909', vol: -5, a: -28, post: [glue], clips: {
        intro: () => bars16({ k: 'x...x...x...x...', o: '..x...x...x...x.', z: 'o.o.o.o.o.o.o.o.' }, 1),
        build: () => buildUp(8, { hat: 46, snare: 39 }),
        drop: () => crash(bars16({ k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', h: 'oo.oo.ooo.oo.oo.', z: 'o.o.o.o.o.o.o.o.' }, 4)),
        break: () => bars16({ c: '....x.......x...', z: 'oooooooooooooooo', o: '..x...x...x...x.' }, 1),
        outro: () => bars16({ k: 'x...x...x...x...', o: '..x...x...x...x.' }, 1)
      } },
      { name: '베이스', color: 0, sound: 'FM 베이스', vol: 4, post: [duck(0.6)], clips: {
        drop: () => bassline(key, prog, { base: 45, pattern: '..x-..x-..x-..o-' }),
        break: null,
        build: () => bassline(key, [0, 0], { base: 45, pattern: '..x-..x-..x-..x-', bars: 4 })
      } },
      { name: '건반 스탭', color: 10, sound: '전자 피아노', vol: -7, a: -14, b: -18, post: [duck(0.35)], clips: {
        drop: () => chords(key, prog, { size: 4, base: 57, rhythm: '..x...x...x..x..', gate: 0.8 }),
        build: () => chords(key, prog, { size: 4, base: 57, rhythm: '..x...x...x...x.', gate: 0.8, vel: 80 }),
        break: () => chords(key, prog, { size: 4, base: 57, rhythm: 'x-------x-------', vel: 84 })
      } },
      { name: '패드', color: 8, sound: '따뜻한 패드', vol: -9, a: -12, post: [duck(0.45)], clips: {
        intro: () => chords(key, prog, { base: 57 }),
        break: () => chords(key, prog, { base: 57 }),
        outro: () => chords(key, prog, { base: 57 })
      } },
      { name: '플럭', color: 5, sound: '플럭', vol: -2, a: -18, b: -12, pre: [['arp', { style: 'updown', rate: '1/16', gate: 0.5, oct: 2 }]], clips: {
        drop: () => chords(key, prog, { base: 69 })
      } },
      { name: 'FX', type: 'audio', color: 3, vol: -10, a: -16, clips: { build: riser, drop: impact } }
    ]
  });
})();

/* ---------- 테크노 ---------- */
(() => {
  const key = { root: 5, scale: 'minor' }; // F 마이너
  const prog = [0, 0, 5, 6];              // Fm Fm Db Eb
  GENRES.push({
    id: 'techno', name: '테크노', bpm: 130, key, swing: 0,
    desc: '단단한 킥과 굴러가는 애시드 베이스, 짧은 신스 스탭',
    roles: EDM,
    structure: [['intro', 16], ['build', 8], ['drop', 16], ['break', 8], ['build', 8], ['drop', 16], ['outro', 16]],
    tracks: [
      { name: '드럼', color: 1, kit: 'ktechno', vol: -5, a: -30, post: [glue], clips: {
        intro: () => bars16({ k: 'x...x...x...x...', h: '..x...x...x...x.', y: 'o.o.o.o.o.o.o.o.' }, 1),
        build: () => buildUp(8, { snare: 39, hat: 42 }),
        drop: () => crash(bars16({ k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', h: 'oo.ooo.ooo.ooo.o', r: '...x..x....x..x.' }, 4)),
        break: () => bars16({ y: 'x.x.x.x.x.x.x.x.', c: '....x.......x...', r: '...x..x....x..x.' }, 1),
        outro: () => bars16({ k: 'x...x...x...x...', h: '..x...x...x...x.' }, 1)
      } },
      { name: '애시드 베이스', color: 0, sound: '애시드 베이스', vol: 2, post: [duck(0.5)], clips: {
        drop: () => bassline(key, prog, { base: 41, pattern: ['.xox.xxx.xox.x5x', '.xxx.xox.xxx.xo5'], gate: 0.7 }),
        build: () => bassline(key, [0, 0], { base: 41, pattern: '.xxx.xxx.xxx.xxx', bars: 4, gate: 0.6, vel: 90 }),
        intro: null
      } },
      { name: '스탭', color: 11, sound: '신스 스탭', vol: -1, a: -14, b: -14, post: [duck(0.3)], clips: {
        drop: () => chords(key, prog, { base: 53, rhythm: '...x......x.....' }),
        break: () => chords(key, prog, { base: 53, rhythm: 'x-------........', vel: 80 })
      } },
      { name: '패드', color: 8, sound: '글래스 패드', vol: -11, a: -10, clips: {
        break: () => chords(key, prog, { base: 60 }),
        intro: () => chords(key, [0, 0, 5, 6], { base: 60, vel: 70 })
      } },
      { name: 'FX', type: 'audio', color: 3, vol: -10, a: -16, clips: { build: riser, drop: impact } }
    ]
  });
})();

/* ---------- 트랩 ---------- */
(() => {
  const key = { root: 0, scale: 'minor' }; // C 마이너
  const prog = [0, 5, 3, 4];              // Cm Ab Fm G
  const kickBar = ['X.......x.x.....', 'X.........x.....'];
  GENRES.push({
    id: 'trap', name: '트랩', bpm: 140, key, swing: 0,
    desc: '셋잇단 하이햇 롤, 미끄러지는 808 베이스, 어두운 벨 멜로디',
    roles: EDM,
    structure: [['intro', 8], ['build', 4], ['drop', 16], ['break', 8], ['build', 4], ['drop', 16], ['outro', 8]],
    tracks: [
      { name: '드럼', color: 1, kit: 'ktrap', vol: -5, a: -32, clips: {
        intro: () => ({ len: 8, notes: trapHats(2).concat(DR({ c: '........x...............x.......' }, 8).notes) }),
        build: () => { const c = buildUp(4, { kick: false, snare: 39 }); c.notes.push(...trapHats(4).map(x => Object.assign(x, { v: x.v - 20 }))); return c; },
        drop: () => { const c = DR({ k: kickBar.join(''), c: '........x...............x.......', o: '..............................x.' }, 8); c.notes.push(...trapHats(2)); return crash(c); },
        break: () => ({ len: 8, notes: trapHats(2, [15]).filter((x, i) => i % 2 === 0) }),
        outro: () => ({ len: 8, notes: trapHats(2) })
      } },
      { name: '808', color: 0, sound: '808 베이스', vol: -1, clips: {
        drop: () => bassline(key, prog, { base: 36, pattern: ['X-------x-x-----', 'X---------x-----'], gate: 0.98 })
      } },
      { name: '벨', color: 6, sound: '벨', vol: -6, a: -12, b: -16, clips: {
        drop: () => melody(key, [[7, 0, 0.5], [9, 0.75, 0.5], [8, 1.5, 0.5], [7, 2.25, 1.5], [5, 4, 0.5], [4, 4.75, 0.5], [2, 5.5, 0.5], [4, 6.25, 1.5],
          [7, 8, 0.5], [9, 8.75, 0.5], [10, 9.5, 0.5], [9, 10.25, 1.5], [8, 12, 0.5], [7, 12.75, 0.5], [6, 13.5, 0.5], [7, 14.25, 1.5]], 16, 60),
        intro: () => melody(key, [[7, 0, 0.5], [9, 0.75, 0.5], [8, 1.5, 0.5], [7, 2.25, 1.5], [5, 4, 0.5], [4, 4.75, 0.5], [2, 5.5, 0.5], [4, 6.25, 1.5]], 8, 60),
        break: () => melody(key, [[7, 0, 1.5], [5, 2, 1.5], [4, 4, 1.5], [2, 6, 1.5]], 8, 60)
      } },
      { name: '패드', color: 8, sound: '글래스 패드', vol: -12, a: -10, clips: {
        intro: () => chords(key, prog, { base: 60 }),
        break: () => chords(key, prog, { base: 60 }),
        drop: () => chords(key, prog, { base: 60, vel: 70 })
      } },
      { name: 'FX', type: 'audio', color: 3, vol: -10, a: -16, clips: { build: riser, drop: impact } }
    ]
  });
})();

/* ---------- 드럼 앤 베이스 ---------- */
(() => {
  const key = { root: 2, scale: 'minor' }; // D 마이너
  const prog = [0, 5, 2, 6];              // Dm Bb F C
  GENRES.push({
    id: 'dnb', name: '드럼 앤 베이스', bpm: 174, key, swing: 0,
    desc: '빠른 투스텝 브레이크와 낮게 우는 리스 베이스, 넓은 스트링',
    roles: EDM,
    structure: [['intro', 16], ['build', 8], ['drop', 32], ['break', 16], ['build', 8], ['drop', 32], ['outro', 16]],
    tracks: [
      { name: '드럼', color: 1, kit: 'kdnb', vol: -5, a: -28, post: [glue], clips: {
        intro: () => bars16({ h: 'x.x.x.x.x.x.x.x.', y: '..o...o...o...o.' }, 1),
        build: () => buildUp(8, { kick: false, hat: 42 }),
        drop: () => crash(bars16({ k: 'x.........x.....', s: '....X..o.o..X..o', h: 'x.x.x.x.x.x.x.x.', y: '..o...o...o...o.' }, 4)),
        break: () => bars16({ y: 'x.x.x.x.x.x.x.x.' }, 1),
        outro: () => bars16({ h: 'x.x.x.x.x.x.x.x.', k: 'x...............' }, 1)
      } },
      { name: '리스 베이스', color: 0, sound: '리스 베이스', vol: -3, post: [duck(0.4)], clips: {
        drop: () => bassline(key, prog, { base: 38, pattern: ['X-----------x---', 'x-------x-------'], bars: 2, gate: 0.97 })
      } },
      { name: '스트링', color: 8, sound: '스트링 앙상블', vol: -9, a: -10, clips: {
        intro: () => chords(key, prog, { base: 62, bars: 2 }),
        break: () => chords(key, prog, { base: 62, bars: 2 }),
        drop: () => chords(key, prog, { base: 62, bars: 2, vel: 72 }),
        outro: () => chords(key, prog, { base: 62, bars: 2 })
      } },
      { name: 'FX', type: 'audio', color: 3, vol: -10, a: -16, clips: { build: riser, drop: impact } }
    ]
  });
})();

/* ---------- 로파이 힙합 ---------- */
(() => {
  const key = { root: 5, scale: 'major' }; // F 메이저
  const prog = [3, 2, 1, 0];              // Bbmaj7 Am7 Gm7 Fmaj7
  GENRES.push({
    id: 'lofi', name: '로파이 힙합', bpm: 82, key, swing: 0.32,
    desc: '느긋하게 밀리는 붐뱁 드럼과 낡은 소리의 7화음 건반',
    roles: ['intro', 'main', 'break', 'outro'],
    structure: [['intro', 4], ['main', 8], ['break', 4], ['main', 8], ['outro', 4]],
    tracks: [
      { name: '드럼', color: 1, kit: 'klofi', vol: -4, a: -26, clips: {
        intro: () => bars16({ h: 'x.x.x.x.x.x.x.x.', r: '....x.......x...' }, 1),
        main: () => DR({ k: 'x......x..x.....x.x.......x.....', s: '....x.......x.......x.......x...', h: 'x.xox.x.x.xox.x.x.xox.x.x.xox.xo' }, 8),
        break: () => bars16({ h: 'x.x.x.x.x.x.x.x.', z: '..o...o...o...o.' }, 1),
        outro: () => bars16({ h: 'x.x.x.x.x.x.x.x.' }, 1)
      } },
      { name: '베이스', color: 0, sound: '서브 베이스', vol: -4, clips: {
        main: () => bassline(key, prog, { base: 41, pattern: 'X-------5---x---' })
      } },
      { name: '건반', color: 10, sound: '로파이 건반', vol: -5, a: -12, clips: {
        intro: () => chords(key, prog, { size: 4, base: 57, strum: 0.03 }),
        main: () => chords(key, prog, { size: 4, base: 57, strum: 0.03, rhythm: 'x-------..x-----' }),
        break: () => chords(key, prog, { size: 4, base: 57, strum: 0.05, vel: 80 }),
        outro: () => chords(key, prog, { size: 4, base: 57, strum: 0.05, vel: 76 })
      } }
    ]
  });
})();

/* ---------- 퓨처 베이스 ---------- */
(() => {
  const key = { root: 5, scale: 'major' }; // F 메이저
  const prog = [0, 4, 5, 3];              // F C Dm Bb
  GENRES.push({
    id: 'future', name: '퓨처 베이스', bpm: 150, key, swing: 0,
    desc: '사이드체인으로 출렁이는 슈퍼쏘우 코드, 하프타임 드럼, 로봇 보컬 찹',
    roles: EDM,
    structure: [['intro', 8], ['build', 8], ['drop', 16], ['break', 8], ['build', 8], ['drop', 16], ['outro', 8]],
    tracks: [
      { name: '드럼', color: 1, kit: 'ktrap', vol: -2, a: -30, clips: {
        intro: () => bars16({ h: 'x.x.x.x.x.x.x.x.' }, 1),
        build: () => buildUp(8, { snare: 38, hat: 42 }),
        drop: () => crash(bars16({ k: 'x.........x.....', c: '........X.......', h: 'x.x.x.x.x.xxx.x.', o: '..............x.' }, 4)),
        break: () => bars16({ h: 'x...x...x...x...' }, 1),
        outro: () => bars16({ h: 'x.x.x.x.x.x.x.x.', c: '........x.......' }, 1)
      } },
      { name: '슈퍼쏘우 코드', color: 9, sound: '퓨처 베이스 코드', vol: 2, a: -18, clips: {
        drop: () => chords(key, prog, { size: 4, base: 65, rhythm: 'X--x--x---x--x--' }),
        build: () => chords(key, prog, { size: 4, base: 65, rhythm: 'x-x-x-x-x-x-x-x-', vel: 80 }),
        intro: () => chords(key, prog, { size: 4, base: 65, vel: 70 }),
        break: () => chords(key, prog, { size: 4, base: 65, vel: 76 })
      } },
      { name: '808', color: 0, sound: '808 베이스', vol: 1, post: [duck(0.5)], clips: {
        drop: () => bassline(key, prog, { base: 41, pattern: 'X---------x-----', gate: 0.98 })
      } },
      { name: '보컬 찹', color: 11, loopkit: 'lp-robot', vol: -8, a: -14, b: -14, clips: {
        drop: () => ({ len: 8, notes: [[0, 0], [1, 0.75], [2, 1.5], [4, 2.5], [5, 3], [8, 4], [9, 4.75], [10, 5.5], [12, 6.5], [15, 7]].map(([i, s]) => nt(36 + i, s, 0.4, 104)) }),
        break: () => ({ len: 8, notes: [[0, 0], [4, 2], [8, 4], [15, 6]].map(([i, s]) => nt(36 + i, s, 0.9, 90)) })
      } },
      { name: 'FX', type: 'audio', color: 3, vol: -10, a: -16, clips: { build: riser, drop: impact } }
    ]
  });
})();

/* ================= 만들기 ================= */
function devicesFor(spec) {
  let devs = [];
  if (spec.kit) devs = [U.kitDevice(U.kitById(spec.kit))];
  else if (spec.loopkit) devs = [U.loopKitDevice(U.LOOPKITS.find(k => k.id === spec.loopkit) || U.DEFAULT_LOOPKIT)];
  else if (spec.sound) {
    devs = U.soundDevices(U.sound(spec.sound));
    const grp = U.uid('g');
    for (const d of devs) d.grp = grp;
  }
  if (spec.pre) devs = spec.pre.map(([k, p]) => U.makeDevice(k, { p })).concat(devs);
  if (spec.post) devs = devs.concat(spec.post.map(([k, p]) => U.makeDevice(k, { p })));
  return devs;
}
function clipFrom(make, t, name) {
  const m = typeof make === 'function' ? make() : make;
  if (m.audio) {
    const c = U.newAudioClip(m.audio, U.media.info(m.audio), { name: m.name, color: t.color });
    if (m.align) c.align = m.align;
    return c;
  }
  return U.newMidiClip(m.len, { name, color: t.color, notes: m.notes });
}
/* 장르 하나로 새 프로젝트 */
function genreProject(id) {
  const g = GENRES.find(x => x.id === id) || GENRES[0];
  const pr = U.newProject(g.name + ' 스케치');
  pr.bpm = g.bpm;
  pr.key = Object.assign({}, g.key);
  pr.swing = g.swing || 0;
  pr.tracks = [];
  pr.scenes = g.roles.map(r => Object.assign(U.newScene(), { name: ROLE_NAMES[r] }));
  while (pr.scenes.length < 8) pr.scenes.push(U.newScene());
  for (const spec of g.tracks) {
    const t = U.addTrack(pr, spec.type || 'midi', null, { name: spec.name, color: spec.color, devices: devicesFor(spec) });
    t.vol = spec.vol || 0;
    t.sends = [spec.a != null ? spec.a : OFF, spec.b != null ? spec.b : OFF];
    t.slots = pr.scenes.map((sc, i) => {
      const role = g.roles[i], make = role && spec.clips[role];
      return make ? clipFrom(make, t, spec.name + ' · ' + ROLE_NAMES[role]) : null;
    });
  }
  pr.master.devices.push(U.makeDevice('limiter', { p: { gain: 3, ceil: -0.5 } }));
  layoutSong(pr, g.structure.map(([role, bars]) => ({ scene: g.roles.indexOf(role), bars })));
  pr.loop = { on: false, start: 0, end: 16 };
  pr.genre = g.id;
  return pr;
}

/* ================= 곡 구조 ================= */
/* 씬을 차례대로 어레인지먼트에 늘어놓는다. sections: [{scene, bars}].
   루프 클립은 구간을 채우고, 한 번만 도는 클립은 제 길이만큼 (align: 'end'면 구간 끝에 맞춰) 놓는다 */
function layoutSong(pr, sections, opts) {
  opts = opts || {};
  const bar = U.barLen(pr.sig);
  if (opts.clear !== false) for (const t of pr.tracks) t.arr = [];
  let pos = opts.at || 0;
  for (const sec of sections) {
    const len = sec.bars * bar;
    for (const t of pr.tracks) {
      const c = sec.scene >= 0 && t.slots[sec.scene];
      if (!c) continue;
      const clip = U.cloneClip(c);
      let p = pos, dur = len;
      if (!clip.loop.on) {
        dur = Math.min(len, U.clipSpan(clip) * U.clipScale(clip, pr.bpm));
        if (clip.align === 'end') p = pos + len - dur;
      }
      t.arr.push({ id: U.uid('a'), pos: U.round(p, 4), dur: U.round(dur, 4), off: 0, clip });
    }
    pos += len;
  }
  return pos;
}
/* 씬 이름으로 짐작한 기본 곡 구조: 이름이 없으면 씬 순서대로 8마디씩 */
function guessSections(pr) {
  const used = pr.scenes.map((s, i) => i).filter(i => pr.tracks.some(t => t.slots[i]));
  const g = GENRES.find(x => x.id === pr.genre);
  if (g) {
    const byRole = r => pr.scenes.findIndex(s => s.name === ROLE_NAMES[r]);
    const secs = g.structure.map(([r, bars]) => ({ scene: byRole(r), bars })).filter(x => x.scene >= 0);
    if (secs.length) return secs;
  }
  return used.map(i => ({ scene: i, bars: 8 }));
}

U.GENRES = GENRES;
U.ROLE_NAMES = ROLE_NAMES;
U.genreProject = genreProject;
U.layoutSong = layoutSong;
U.guessSections = guessSections;
})(window.U = window.U || {});
