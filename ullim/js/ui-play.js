/* 울림 — 악기별 연주 화면: 트랙의 악기에 맞는 모양으로 친다 (개러지밴드의 터치 악기처럼).
   기타·베이스는 코드 줄과 지판, 현악은 활로 켜는 지판과 코드 줄, 하프·가야금은 줄, 마림바·비브라폰·종·칼림바·스틸 드럼은 그 악기 모양.
   손가락마다 따로 울리고, 줄 위를 쓸면 지나가는 줄을 차례로 뜯는다 (스트럼 · 글리산도). 드럼 킷은 ui-kit.js */
(function (U) {
'use strict';
const { h, ui, btn, clamp, info } = U;
const pr = () => U.project;
const PS = ui.play = {
  pos: {},                                  // 트랙 id → 지판의 첫 프렛
  oct: {},                                  // 트랙 id → 옥타브 옮김 (하프·말렛·지판의 컴퓨터 건반)
  names: !!U.pref('fretNames', false),      // 지판에 음 이름
  bow: U.pref('bowNeck', 'viola')           // 현악 합주 지판: cello · viola · violin
};
const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];
const KEYMAP = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, Semicolon: 16, Quote: 17 };
const ROW_A = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
const ROW_Q = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];
const letter = p => U.NOTE_NAMES[((p % 12) + 12) % 12];
const SVG_NS = 'http://www.w3.org/2000/svg';
function S(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  for (const c of kids) if (c) el.append(c);
  return el;
}

/* ================= 악기 묶음과 화면 =================
   묶음마다 고를 수 있는 화면. 처음 것이 그 악기 모양 화면이고, 건반은 언제든 고를 수 있다 */
const KEY_LAYS = [
  ['piano', '건반', '피아노처럼 생긴 건반이에요.'],
  ['grid', '스케일', '키에 맞는 음만 칸으로 늘어놓아요. 오른쪽으로 한 음씩, 위 줄은 4도 위라서 아무 칸이나 쳐도 어울려요.'],
  ['chords', '코드 패드', '지금 키의 주요 화음을 큰 버튼으로 늘어놓아요. 누르면 화음이 통째로 울리고, 1~7 키(아래 줄은 Q~Y)로도 쳐요.']
];
const PIANO = ['piano', '건반', '피아노 건반으로 쳐요.'];
const FAMS = {
  drums: { name: '드럼', lays: [['kit', '드럼', '드럼 세트 모양으로 쳐요. 스네어 테두리는 사이드 스틱, 하이햇 가장자리는 열린 햇, 라이드 가운데는 벨이에요.'], ['pads', '패드', '패드 16개를 4×4로 늘어놓아요. 글자 키와 노트 리피트로 MPC처럼 쳐요.']] },
  looppad: { name: '패드', lays: [['pads', '패드', '패드 16개를 4×4로 늘어놓아요.']] },
  guitar: { name: '기타', lays: [['strum', '코드', '키에 맞는 코드가 세로 줄로 늘어서요. 코드 이름을 누르면 한 번에 긁고, 줄 위를 위아래로 쓸면 지나가는 줄이 차례로 울려요. 한 줄만 눌러 아르페지오도 돼요.'],
    ['fret', '지판', '진짜 기타 지판이에요. 줄과 프렛을 눌러 한 음씩 치고, 줄을 가로질러 쓸면 긁어요. 점은 키에 맞는 음, 색 점은 으뜸음이에요.'], PIANO] },
  bass: { name: '베이스', lays: [['strum', '코드', '코드마다 줄 네 개에 근음 · 5도 · 옥타브 · 3도를 놓았어요. 코드 이름을 누르면 근음이 울려요.'],
    ['fret', '지판', '베이스 지판이에요. 줄과 프렛을 눌러 쳐요. 점은 키에 맞는 음이에요.'], PIANO] },
  strings: { name: '현악', lays: [['strum', '코드', '코드 이름을 누르고 있는 동안 현악 합주가 화음을 켜요. 줄마다 첼로 · 비올라 · 제2 바이올린 · 제1 바이올린이에요.'],
    ['fret', '지판', '프렛 없는 현악기 지판이에요. 누르고 있는 동안 활로 켜고, 미끄러뜨리면 음이 따라가요.'], PIANO] },
  solo: { name: '현악', lays: [['fret', '지판', '프렛 없는 지판이에요. 누르고 있는 동안 활로 켜고, 미끄러뜨리면 음이 따라가요.'], PIANO] },
  harp: { name: '하프', lays: [['harp', '하프', '키에 맞춘 하프 줄이에요. 줄을 뜯거나 가로로 쓸어 글리산도로 울려요. 빨간 줄이 으뜸음이에요.'], PIANO] },
  gayageum: { name: '가야금', lays: [['harp', '가야금', '열두 줄을 키의 5음 음계로 맞춰 두었어요. 줄을 뜯거나 위아래로 쓸어 보세요.'], PIANO] },
  mallet: { name: '말렛', lays: [['mallet', '악기', '그 악기 모양으로 늘어선 음판을 채로 치듯 눌러요. 쓸면 차례로 울려요.'], PIANO] },
  keys: { name: '건반', lays: KEY_LAYS }
};
const AC_GROUP = id => ((U.DEV.acoustic.types.find(x => x[0] === id) || [])[2]) || '';
function family(t) {
  const d = t && U.instrumentOf(t);
  if (!d) return null;
  if (d.kind === 'drums' || d.kind === 'looppad') return d.kind;
  const id = d.p.inst;
  if (d.kind === 'acoustic') {
    const g = AC_GROUP(id);
    if (g === '기타' || g === '일렉 기타') return 'guitar';
    if (g === '베이스') return 'bass';
    if (id === 'harp' || id === 'gayageum') return id;
    if (id === 'pizz') return 'strings';
    if (g === '말렛·벨') return 'mallet';
  }
  if (d.kind === 'ensemble') {
    if (id === 'strings') return 'strings';
    if (id === 'violin' || id === 'cello') return 'solo';
  }
  return 'keys';
}
const famName = t => (FAMS[family(t)] || FAMS.keys).name;
const layouts = t => (FAMS[family(t)] || FAMS.keys).lays;
const isKeyLay = v => KEY_LAYS.some(x => x[0] === v);
function layoutOf(t) {
  const fam = family(t);
  if (!fam) return null;
  const ids = FAMS[fam].lays.map(x => x[0]);
  const v = fam === 'keys' ? ui.keys.layout : U.pref('playLay:' + fam, ids[0]);
  return ids.includes(v) ? v : ids[0];
}
function setLayout(t, v) {
  const fam = family(t);
  if (fam === 'keys') { ui.keys.layout = v; U.setPref('keysLayout', v); }
  else if (fam) U.setPref('playLay:' + fam, v);
}

/* ================= 소리: slot마다 한 음 =================
   slot(줄 · 음판 · 손가락)마다 한 음만 울린다. 같은 slot을 다시 치면 앞 음을 멈추고 새로 친다.
   ring초 뒤에 저절로 멈춘다 (뜯는 악기는 손을 떼도 울리니까). ring이 0이면 손을 뗄 때 멈춘다 (활로 켜는 악기) */
const V = { tid: null, refs: new Map(), slots: new Map() };
const vel = f => clamp(Math.round(ui.padVel * (f == null ? 1 : f)), 1, 127);
const now = () => U.engine.ctx.currentTime;
const wait = at => (at ? Math.max(0, at - now()) : 0);   // 화면 효과를 소리에 맞춰 늦출 시간
const instNow = () => { const n = U.engine.nodes.get(V.tid); return n && n.inst; };
/* 곧 칠 음을 먼저 계산해 둔다 (진짜 악기는 음마다 소리를 계산해서, 계산하느라 스트럼 간격이 벌어지지 않게) */
function prepare(list) {
  const inst = instNow();
  if (inst && inst.prepare) inst.prepare(list.filter(x => x[0] != null).map(([p, f]) => ({ p, v: vel(f) })));
}
/* 쉬는 틈에 미리 (코드 줄을 열면 그 코드들의 음) */
function warm(list) {
  const inst = instNow();
  if (inst && inst.warm) inst.warm(list.filter(x => x[0] != null).map(([p, f]) => ({ p, v: vel(f) })));
}
function noteOn(p, v, at) {
  const n = V.refs.get(p) || 0;
  if (n) U.engine.liveOff(V.tid, p, at);   // 다른 줄에서 같은 음이 울리면 끊고 다시 친다 (녹음에 앞 음이 남게)
  U.engine.liveOn(V.tid, p, v, false, false, at);
  V.refs.set(p, n + 1);
  U.emit('livenote', { p, on: true });
}
function noteOff(p, at) {
  const n = V.refs.get(p) || 0;
  if (!n) return;
  if (n > 1) { V.refs.set(p, n - 1); return; }
  V.refs.delete(p);
  U.engine.liveOff(V.tid, p, at);
  U.emit('livenote', { p, on: false });
}
function play(slot, p, f, at, ring) {
  if (p < 0 || p > 127) return;
  stop(slot, at);
  noteOn(p, vel(f), at);
  const s = { p, timer: 0 };
  if (ring) s.timer = setTimeout(() => { if (V.slots.get(slot) === s) stop(slot); }, (ring + Math.max(0, (at || 0) - U.engine.ctx.currentTime)) * 1000);
  V.slots.set(slot, s);
}
function stop(slot, at) {
  const s = V.slots.get(slot);
  if (!s) return;
  V.slots.delete(slot);
  clearTimeout(s.timer);
  noteOff(s.p, at);
}
function stopWhere(test) { for (const k of [...V.slots.keys()]) if (test(k)) stop(k); }
function useTrack(t) {
  if (V.tid === t.id) return;
  stopWhere(() => true);
  V.refs.clear();
  V.tid = t.id;
}
/* 손가락(p…)이나 글자 키(k…)로 누르고 있는 음 */
const ownedBy = id => k => k === id || k.startsWith(id + ':');
const isHeld = k => k[0] === 'p' || k[0] === 'k';
const ringOf = d => (d.kind === 'ensemble' ? 0 : clamp((U.instMeta(d.kind, d.p.inst) || {}).t60 || 3, 0.4, 6));
const keyOf = () => pr().key;
const scaleSteps = () => U.scaleOf(keyOf().scale).steps;
const minorish = () => U.chords.parentScale(keyOf().scale) === 'minor' || (scaleSteps().includes(3) && !scaleSteps().includes(4));
/* 스케일 음을 from부터 n개 */
function scaleRun(steps, from, n) {
  const root = keyOf().root, out = [];
  for (let p = from; out.length < n && p < 128; p++) if (steps.includes(((p - root) % 12 + 12) % 12)) out.push(p);
  return out;
}
const inKey = p => U.inScale(p, keyOf().root, keyOf().scale);
/* lo에 가장 가까운 으뜸음 (하프 · 가야금 · 칼림바는 으뜸음 줄부터) */
function tonicNear(lo) {
  const s = lo - (((lo - keyOf().root) % 12) + 12) % 12;
  return lo - s > 6 ? s + 12 : s;
}
const isRoot = p => ((p - keyOf().root) % 12 + 12) % 12 === 0;

/* 손가락 하나하나를 따라가는 도우미: 줄(띠)을 넘을 때마다 부른다.
   o.at(e) → {i, c, head} · o.down(P, id) · o.cross([[i, c, f] …], gap, id) 넘은 줄을 차례로 · o.slide(P, id) · o.up(P, id) */
function sweep(el, o) {
  const ptrs = new Map();
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    U.ensureAudio();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    const P = Object.assign({ x: e.clientX, y: e.clientY, t: e.timeStamp }, o.at(e));
    ptrs.set(e.pointerId, P);
    o.down(P, 'p' + e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    const P = ptrs.get(e.pointerId);
    if (!P || P.head) return;
    const q = o.at(e);
    if (q.i !== P.i) {
      // 줄을 넘었다: 지나간 줄을 차례로, 빠르게 쓸수록 세게
      const dt = Math.max(1, e.timeStamp - P.t), n = Math.abs(q.i - P.i), dir = q.i > P.i ? 1 : -1;
      const f = clamp(0.62 + 0.3 * Math.hypot(e.clientX - P.x, e.clientY - P.y) / dt, 0.62, 1.05);
      const list = [];
      for (let k = 1; k <= n; k++) list.push([P.i + dir * k, q.c, f]);
      o.cross(list, Math.min(0.016, dt / 1000 / n), 'p' + e.pointerId);
    } else if (q.c !== P.c && o.slide) o.slide(Object.assign({}, P, q), 'p' + e.pointerId);
    Object.assign(P, q, { x: e.clientX, y: e.clientY, t: e.timeStamp });
  });
  const up = e => {
    const P = ptrs.get(e.pointerId);
    if (!P) return;
    ptrs.delete(e.pointerId);
    if (o.up) o.up(P, 'p' + e.pointerId);
  };
  for (const ty of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ty, up);
  el.addEventListener('contextmenu', e => e.preventDefault());
  return ptrs;
}
/* 줄이 떨린다 (뜯으면 잠깐, 활로 켜는 동안은 계속) */
function shake(el, delay) {
  if (!el) return;
  const go = () => { el.classList.remove('vib'); void el.offsetWidth; el.classList.add('vib'); };
  if (delay > 0.004) setTimeout(go, delay * 1000); else go();
}
/* 친 자리에 번지는 점 */
function spark(parent, x, y, delay) {
  const go = () => {
    const s = h('div', { class: 'pl-spark', style: { left: x, top: y } });
    s.addEventListener('animationend', () => s.remove());
    parent.append(s);
  };
  if (delay > 0.004) setTimeout(go, delay * 1000); else go();
}

/* ================= 줄 악기: 코드 줄과 지판 (기타 · 베이스 · 현악) =================
   줄은 위가 가장 낮은 줄이에요 (무릎에 놓은 기타를 내려다본 모양, 개러지밴드와 같아요) */
const NECKS = {
  guitar: { tune: [40, 45, 50, 55, 59, 64], gauge: [3.4, 2.8, 2.3, 1.8, 1.3, 1], wound: 3, frets: 22 },
  bass: { tune: [28, 33, 38, 43], gauge: [5, 4.2, 3.4, 2.7], wound: 4, frets: 20 },
  cello: { tune: [36, 43, 50, 57], gauge: [3.4, 2.8, 2.3, 1.8], wound: 4, frets: 0, name: '첼로' },
  viola: { tune: [48, 55, 62, 69], gauge: [3, 2.5, 2, 1.5], wound: 3, frets: 0, name: '비올라' },
  violin: { tune: [55, 62, 69, 76], gauge: [2.6, 2.1, 1.7, 1.2], wound: 3, frets: 0, name: '바이올린' }
};
const FRETLESS = 19;   // 프렛 없는 지판에서 짚을 수 있는 반음 수
const INLAY = [3, 5, 7, 9, 15, 17, 19, 21];
const ROWS = { bass: [['R', '근음'], ['5', '5도'], ['8', '옥타브'], ['3', '3도 (옥타브 위)']], strings: [['Vc', '첼로'], ['Va', '비올라'], ['V2', '제2 바이올린'], ['V1', '제1 바이올린']] };
function neckOf(t, fam) {
  const d = U.instrumentOf(t);
  if (fam === 'guitar' || fam === 'bass') return NECKS[fam];
  if (d.p.inst === 'violin' || d.p.inst === 'cello') return NECKS[d.p.inst];
  return NECKS[PS.bow] || NECKS.viola;
}
/* 줄 재질: 통기타는 브론즈, 나일론은 투명한 고음 줄, 일렉·베이스는 니켈, 현악기는 은색 */
function stringStuff(d) {
  if (d.kind === 'ensemble' || d.p.inst === 'pizz') return 'silver';
  if (d.p.inst === 'nylon') return 'nylon';
  if (d.p.inst === 'steel' || d.p.inst === 'mute') return 'bronze';
  return 'nickel';
}
/* 코드 줄의 화음: 키 안의 일곱 개 + 하나 (장조는 ♭VII, 단조는 V). 좁으면 덜 쓰는 것부터 뺀다 */
function quality(c) { return c.iv[1] === 4 ? (c.iv[2] === 8 ? 'aug' : 'maj') : (c.iv[2] === 6 ? 'dim' : 'min'); }
function extraChord(k, dia) {
  for (const [st, deg, roman] of [[10, 6, '♭VII'], [7, 4, 'V'], [5, 3, 'IV'], [2, 1, 'II']]) {
    const pc = (k.root + st) % 12;
    if (dia.some(c => c.pc === pc && quality(c) === 'maj')) continue;
    return { id: 'x', pc, iv: [0, 4, 7], roman, extra: true, name: U.chords.spell(k.root, deg, pc) };
  }
  return null;
}
/* 좁아서 다 못 놓으면 자주 쓰는 화음부터 남긴다 (장조: I V IV vi ii iii ♭VII vii° · 단조: i VI iv VII III V v ii°) */
const KEEP = { major: ['d0', 'd4', 'd3', 'd5', 'd1', 'd2', 'x', 'd6'], minor: ['d0', 'd5', 'd3', 'd6', 'd2', 'x', 'd4', 'd1'] };
function stripChords(n) {
  const k = keyOf(), dia = U.chords.diatonic(k, 'triad');
  const list = dia.concat(extraChord(k, dia) || []);
  const keep = new Set(KEEP[minorish() ? 'minor' : 'major'].slice(0, n));
  return list.filter(c => keep.has(c.id));
}
/* 기타 코드 모양: 열린 코드가 있으면 그것, 없으면 E 모양(6번 줄 근음)과 A 모양(5번 줄 근음) 바레 중 낮은 자리 */
const OPEN = { '0maj': [null, 3, 2, 0, 1, 0], '2maj': [null, null, 0, 2, 3, 2], '2min': [null, null, 0, 2, 3, 1], '4maj': [0, 2, 2, 1, 0, 0], '4min': [0, 2, 2, 0, 0, 0], '7maj': [3, 2, 0, 0, 0, 3], '9maj': [null, 0, 2, 2, 2, 0], '9min': [null, 0, 2, 2, 1, 0] };
const SHAPES = {
  maj: { E: [0, 2, 2, 1, 0, 0], A: [null, 0, 2, 2, 2, 0] },
  min: { E: [0, 2, 2, 0, 0, 0], A: [null, 0, 2, 2, 1, 0] },
  dim: { E: [0, 1, 2, 0, null, null], A: [null, 0, 1, 2, 1, null] },
  aug: { E: [0, 3, 2, 1, 1, 0], A: [null, 0, 3, 2, 2, 1] }
};
function guitarFrets(c) {
  const q = quality(c);
  if (OPEN[c.pc + q]) return OPEN[c.pc + q];
  const rE = ((c.pc - 4) % 12 + 12) % 12, rA = ((c.pc - 9) % 12 + 12) % 12;
  const useA = rA < rE;   // 둘 중 하나는 늘 7프렛 아래
  return SHAPES[q][useA ? 'A' : 'E'].map(f => (f == null ? null : f + (useA ? rA : rE)));
}
/* 코드 줄 하나의 줄별 음 (null = 짚지 않고 막는 줄) */
function stripNotes(fam, c, neck, lo) {
  if (fam === 'guitar') return guitarFrets(c).map((f, s) => (f == null ? null : neck.tune[s] + f));
  const third = c.iv[1], fifth = c.iv[2];
  if (fam === 'bass') {
    const rE = ((c.pc - 4) % 12 + 12) % 12;
    const r = rE <= 4 ? 28 + rE : 33 + ((c.pc - 9) % 12 + 12) % 12;
    return [r, r + fifth, r + 12, r + 12 + third];
  }
  // 현악 합주: 아래에 첼로 근음, 위 세 음은 G4 근처에 붙여 짚는다
  const r = lo + ((c.pc - lo) % 12 + 12) % 12;
  return [r].concat(U.chords.voice(c, 67).top);
}

function neckView(t, lay, fam) {
  const d = U.instrumentOf(t), meta = U.instMeta(d.kind, d.p.inst) || {};
  const neck = neckOf(t, fam), S = neck.tune.length;
  const strum = lay === 'strum', bow = d.kind === 'ensemble';
  const ring = ringOf(d);
  const lo = d.kind === 'acoustic' && meta.range ? meta.range[0] : 36;
  const maxFret = neck.frets || FRETLESS;
  const el = h('div', { class: 'gv ' + (strum ? 'gv-strum' : 'gv-fret') + ' gv-' + fam + (neck.frets ? '' : ' gv-fl') + (bow ? ' gv-bow' : ''), 'data-nolongpress': '', style: { '--pc': U.colorOf(t.color), '--S': S } });
  const heads = strum ? h('div', { class: 'gv-heads', role: 'group', 'aria-label': '코드' }) : null;
  const gut = h('div', { class: 'gv-gut' });
  const neckEl = h('div', { class: 'gv-neck gv-' + stringStuff(d), role: 'group', 'aria-label': strum ? '코드 줄' : '지판' });
  const nums = strum ? null : h('div', { class: 'gv-nums' });
  el.append(...[heads, h('div', { class: 'gv-body' }, gut, neckEl), nums].filter(Boolean));
  const G = { fr: [], cum: [0], strs: [], heads: [], cols: [], chords: [], notes: [], pos: 0, n: 0, bowed: new Map() };
  const xOf = i => G.cum[i] * 100 + '%';
  const midX = i => (G.cum[i] + G.fr[i] / 2) * 100 + '%';
  const yOf = s => ((s + 0.5) / S) * 100 + '%';
  const pitch = (s, c) => (strum ? (G.notes[c] ? G.notes[c][s] : null) : neck.tune[s] + G.pos + c);

  function fill() {
    const W = neckEl.clientWidth || 600;
    U.clear(neckEl); U.clear(gut);
    if (heads) U.clear(heads);
    if (nums) U.clear(nums);
    G.strs = []; G.heads = []; G.cols = [];
    let ws;
    if (strum) {
      G.chords = stripChords(clamp(Math.floor(W / (U.isTouch ? 62 : 54)), 4, 8));
      G.notes = G.chords.map(c => stripNotes(fam, c, neck, lo));
      ws = G.chords.map(() => 1);
    } else {
      G.n = clamp(Math.floor(W / (U.isTouch ? 66 : 56)), 5, 16);
      G.pos = clamp(PS.pos[t.id] || 0, 0, Math.max(0, maxFret - G.n + 1));
      ws = Array.from({ length: G.n }, (_, i) => (G.pos + i === 0 ? 0.6 : 1));   // 개방현 칸은 좁게
    }
    const sum = ws.reduce((a, b) => a + b, 0);
    G.fr = ws.map(w => w / sum);
    G.cum = [0];
    for (const f of G.fr) G.cum.push(G.cum[G.cum.length - 1] + f);
    // 칸: 코드 줄은 세로 띠, 지판은 프렛 사이
    G.fr.forEach((f, i) => {
      const col = h('div', { class: 'gv-col' + (i % 2 ? ' alt' : '') + (!strum && G.pos + i === 0 ? ' open' : ''), style: { left: xOf(i), width: f * 100 + '%' } });
      G.cols.push(col);
      neckEl.append(col);
    });
    if (strum) {
      G.chords.forEach((c, k) => {
        const hd = h('div', { class: 'gv-head' + (c.primary ? ' prim' : '') + (c.extra ? ' extra' : ''), dataset: { c: k } },
          h('span', { class: 'gv-hk', text: String(k + 1) }), h('span', { class: 'gv-hn', text: c.name }), h('span', { class: 'gv-hr', text: c.roman }));
        G.heads.push(hd);
        heads.append(hd);
        // 막는 줄은 ×
        G.notes[k].forEach((p, s) => { if (p == null) neckEl.append(h('span', { class: 'gv-x', text: '×', style: { left: 'calc(' + xOf(k) + ' + 4px)', top: yOf(s) } })); });
      });
      heads.style.gridTemplateColumns = 'repeat(' + G.chords.length + ', minmax(0, 1fr))';
    } else {
      // 프렛(또는 프렛 없는 지판의 반음 눈금)과 너트, 자리 표시 점
      for (let i = 0; i < G.n; i++) {
        const f = G.pos + i;
        if (f === 0) neckEl.append(h('div', { class: 'gv-nut', style: { left: xOf(1) } }));
        else {
          neckEl.append(h('div', { class: neck.frets ? 'gv-fw' : 'gv-tick', style: { left: xOf(i + 1) } }));
          if (i === 0) neckEl.append(h('div', { class: neck.frets ? 'gv-fw' : 'gv-tick', style: { left: '0%' } }));
        }
        if (neck.frets && INLAY.includes(f)) neckEl.append(h('span', { class: 'gv-inlay', style: { left: midX(i), top: '50%' } }));
        // 12프렛 두 점은 줄 사이에 (6줄이면 2·3번째 줄 사이와 4·5번째 줄 사이)
        const dy = Math.floor(S / 3) / S;
        if (neck.frets && (f === 12 || f === 24)) for (const y of [dy, 1 - dy]) neckEl.append(h('span', { class: 'gv-inlay', style: { left: midX(i), top: y * 100 + '%' } }));
        if (f === 0 || f === G.pos || INLAY.includes(f) || f === 12) nums.append(h('span', { class: 'gv-num', text: f ? String(f) : '개방', style: { left: midX(i) } }));
      }
      // 키에 맞는 음은 점, 으뜸음은 색 점
      for (let s = 0; s < S; s++) for (let i = 0; i < G.n; i++) {
        const p = neck.tune[s] + G.pos + i;
        if (!inKey(p)) continue;
        neckEl.append(h('span', { class: 'gv-dot' + (isRoot(p) ? ' root' : ''), style: { left: midX(i), top: yOf(s) } }, PS.names || isRoot(p) ? h('i', { text: letter(p) }) : null));
      }
    }
    // 줄
    for (let s = 0; s < S; s++) {
      const str = h('div', { class: 'gv-str' + (s < neck.wound ? ' wound' : ''), style: { top: yOf(s), height: neck.gauge[s] + 'px', marginTop: -neck.gauge[s] / 2 + 'px' } });
      G.strs.push(str);
      neckEl.append(str);
      const lab = strum && ROWS[fam] ? ROWS[fam][s] : [letter(neck.tune[s]), U.noteName(neck.tune[s]) + ' 줄'];
      const gl = h('span', { class: 'gv-gl', text: lab[0], style: { top: yOf(s) } });
      info(gl, lab[1], strum && ROWS[fam] ? '코드 줄마다 이 줄은 ' + lab[1] + '을(를) 쳐요.' : '이 줄을 아무것도 짚지 않고 튕기면 ' + U.noteName(neck.tune[s]) + '이에요.');
      gut.append(gl);
    }
    showBowed();
    if (G.posLbl) G.posLbl.textContent = G.pos ? G.pos + '프렛' : '개방';
    // 코드 줄의 음은 쉬는 틈에 미리 계산해 둔다 (다운 · 업 스트럼과 한 줄 치기의 세기로)
    if (strum && !bow) warm(G.chords.flatMap((ch, c) => strumList(c, false).concat(strumList(c, true), [[0, c, 0.92]]).map(([s, , f]) => [pitch(s, c), f])));
  }

  /* ---------- 치기 ---------- */
  const markStrip = c => { if (!strum) return; G.heads.forEach((x, k) => x.classList.toggle('on', k === c)); G.cols.forEach((x, k) => x.classList.toggle('on', k === c)); };
  /* at: 울릴 시각 (0이면 바로) */
  function pluck(s, c, f, at) {
    const p = pitch(s, c);
    if (p == null) { stop('s' + s, at); return; }   // 짚지 않는 줄은 손으로 막는다
    play('s' + s, p, f, at, ring);
    shake(G.strs[s], wait(at));
    spark(neckEl, midX(c), yOf(s), wait(at));
    markStrip(c);
  }
  /* 여러 줄을 차례로 [[줄, 칸, 세기] …]: 소리를 먼저 계산하고 한 시각에서 gap초씩 */
  function run(list, gap) {
    prepare(list.map(([s, c, f]) => [pitch(s, c), f]));
    const t0 = now() + 0.004;
    list.forEach(([s, c, f], k) => pluck(s, c, f, t0 + k * gap));
  }
  /* 기타 업 스트럼은 높은 줄 네 개만, 뜯는 현악(피치카토)은 거의 한꺼번에 */
  function strumList(c, up) {
    const order = [...Array(S).keys()];
    if (up) order.reverse();
    return (up && fam === 'guitar' ? order.slice(0, 4) : order).map((s, k) => [s, c, (up ? 0.85 : 0.95) * (1 - k * 0.03)]);
  }
  function strumChord(c, up) {
    if (!G.notes[c]) return;
    run(strumList(c, up), fam === 'guitar' ? 0.011 : 0.005);
  }
  /* 활로 켜기: 누르고 있는 동안 */
  function bowNote(slot, s, c) {
    const p = pitch(s, c);
    if (p == null) { stop(slot); G.bowed.delete(slot); showBowed(); return; }
    play(slot, p, 0.88, 0, 0);
    G.bowed.set(slot, [s]);
    spark(neckEl, midX(c), yOf(s), 0);
    markStrip(c);
    showBowed();
  }
  function bowChord(id, c) {
    if (!G.notes[c]) return;
    const ss = [];
    G.notes[c].forEach((p, s) => { if (p != null) { play(id + ':' + s, p, 0.85, 0, 0); ss.push(s); } });
    G.bowed.set(id, ss);
    markStrip(c);
    showBowed();
  }
  function bowEnd(id) {
    stopWhere(ownedBy(id));
    G.bowed.delete(id);
    showBowed();
  }
  function showBowed() {
    const on = new Set([...G.bowed.values()].flat());
    G.strs.forEach((x, s) => x.classList.toggle('bowing', on.has(s)));
  }
  function head(c, id) {
    if (bow) bowChord(id, c);
    else if (fam === 'bass') pluck(0, c, 0.95, 0);   // 베이스는 근음
    else strumChord(c, false);
  }

  /* ---------- 손가락 ---------- */
  const R = () => neckEl.getBoundingClientRect();
  const colAt = (x, r) => { const f = (x - r.left) / r.width; for (let i = 0; i < G.fr.length; i++) if (f < G.cum[i + 1]) return i; return G.fr.length - 1; };
  sweep(el, {
    at: e => {
      const r = R();
      return { i: clamp(Math.floor((e.clientY - r.top) / r.height * S), 0, S - 1), c: colAt(e.clientX, r), head: !!heads && e.clientY < r.top };
    },
    down: (P, id) => {
      if (P.head) { head(P.c, id); return; }
      if (bow) bowNote(id, P.i, P.c);
      else pluck(P.i, P.c, 0.92, 0);
    },
    cross: (list, gap, id) => { if (bow) bowNote(id, list[list.length - 1][0], list[list.length - 1][1]); else run(list, gap); },
    // 지판에서 같은 줄로 프렛을 옮기면 (슬라이드) 다시 울린다. 활은 음이 따라간다
    slide: (P, id) => { if (bow) bowNote(id, P.i, P.c); else if (!strum) pluck(P.i, P.c, 0.72, 0); },
    up: (P, id) => { if (bow) bowEnd(id); }
  });

  /* ---------- 글자 키 ----------
     코드 줄: 1~8로 코드 (Shift는 업 스트럼). 지판: 컴퓨터 건반처럼 A~K, Z/X 옥타브 */
  const kbBase = () => 12 * Math.floor((neck.tune[0] + G.pos + 2) / 12) + 12 + 12 * (PS.oct[t.id] || 0);
  function findPos(p) {
    let best = null;
    for (let s = 0; s < S; s++) {
      const c = p - neck.tune[s] - G.pos;
      if (c < 0 || c >= G.n) continue;
      const score = Math.abs(c - G.n / 2) + s * 0.01;
      if (!best || score < best.score) best = { s, c, score };
    }
    return best;
  }
  function keyDown(e) {
    if (strum) {
      const i = DIGITS.indexOf(e.code);
      if (i < 0 || i >= G.chords.length) return false;
      if (e.repeat) return true;
      if (bow) bowChord('k' + e.code, i);
      else if (fam === 'bass') pluck(0, i, 0.95, 0);
      else strumChord(i, e.shiftKey);
      return true;
    }
    if (e.code === 'KeyZ' || e.code === 'KeyX') { if (!e.repeat) PS.oct[t.id] = clamp((PS.oct[t.id] || 0) + (e.code === 'KeyZ' ? -1 : 1), -2, 2); return true; }
    const o = KEYMAP[e.code];
    if (o == null) return false;
    if (e.repeat) return true;
    const p = kbBase() + o, at = findPos(p);
    if (bow) { if (at) bowNote('k' + e.code, at.s, at.c); else { play('k' + e.code, p, 0.88, 0, 0); } }
    else if (at) pluck(at.s, at.c, 0.9, 0);
    else play('k' + e.code, p, 0.9, 0, ring);
    return true;
  }
  function keyUp(e) {
    if (!bow) return DIGITS.includes(e.code) || KEYMAP[e.code] != null;
    if (![...V.slots.keys()].some(ownedBy('k' + e.code))) return false;
    bowEnd('k' + e.code);
    return true;
  }

  /* ---------- 도구 막대 ---------- */
  function controls(rerender) {
    const out = [];
    if (fam === 'strings' && !strum) {
      out.push(U.seg([['cello', '첼로', '첼로 지판 (C2 G2 D3 A3)'], ['viola', '비올라', '비올라 지판 (C3 G3 D4 A4)'], ['violin', '바이올린', '바이올린 지판 (G3 D4 A4 E5)']], PS.bow,
        v => { PS.bow = v; U.setPref('bowNeck', v); rerender(); }, 'pl-bow'));
    }
    if (!strum) {
      const lbl = G.posLbl = h('span', { class: 'pl-pos', text: (PS.pos[t.id] || 0) ? PS.pos[t.id] + '프렛' : '개방' });
      const move = k => { PS.pos[t.id] = clamp(G.pos + k, 0, Math.max(0, maxFret - G.n + 1)); fill(); };
      out.push(h('span', { class: 'pv-sep' }), btn({ text: '◀', cls: 'sm pl-step', title: '낮은 자리로', onclick: () => move(-1) }), lbl, btn({ text: '▶', cls: 'sm pl-step', title: '높은 자리로', onclick: () => move(1) }));
      info(lbl, '자리', '지판의 왼쪽 끝 프렛이에요. ◀ ▶로 넥을 따라 옮겨요.');
      const names = btn({ text: '음 이름', cls: 'tg sm', toggle: true, on: PS.names, info: ['음 이름', '켜면 키에 맞는 자리마다 음 이름을 써 줘요. 꺼도 으뜸음은 보여요.'], onclick: () => { PS.names = !PS.names; U.setPref('fretNames', PS.names); U.setPressed(names, PS.names); fill(); } });
      out.push(names);
    }
    return out;
  }
  return { el, fill, keyDown, keyUp, controls };
}

/* ================= 하프 · 가야금: 줄을 뜯거나 쓸어서 =================
   하프는 세로줄을 옆으로 (왼쪽이 낮은 줄), 가야금은 가로줄 열두 개를 위아래로 (위가 낮은 줄) */
function harpView(t, fam) {
  const d = U.instrumentOf(t), meta = U.instMeta(d.kind, d.p.inst) || {};
  const gay = fam === 'gayageum', ring = ringOf(d);
  const el = h('div', { class: 'hv ' + (gay ? 'hv-gay' : 'hv-harp'), 'data-nolongpress': '', style: { '--pc': U.colorOf(t.color) } });
  const field = h('div', { class: 'hv-field', role: 'group', 'aria-label': gay ? '가야금 줄' : '하프 줄' });
  el.append(field);
  const G = { ps: [], strs: [] };
  const axisPos = (i, n) => ((i + 0.5) / n) * 100 + '%';
  function fill() {
    U.clear(field);
    G.strs = [];
    const lo = ((meta.range && meta.range[0]) || (gay ? 50 : 43)) + 12 * (PS.oct[t.id] || 0);
    if (gay) {
      // 열두 줄: 장조 계열이면 1 2 3 5 6, 단조 계열이면 1 ♭3 4 5 ♭7 (5음 음계)
      G.ps = scaleRun(minorish() ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9], tonicNear(lo), 12);
      field.append(h('div', { class: 'hv-head' }), h('div', { class: 'hv-tail' }));
    } else {
      const n = clamp(Math.floor((field.clientWidth || 700) / (U.isTouch ? 30 : 24)), 8, 36);
      G.ps = scaleRun(scaleSteps(), tonicNear(lo), n);
    }
    const n = G.ps.length, st = scaleSteps();
    const tops = [], bots = [];
    G.ps.forEach((p, i) => {
      const deg = st.indexOf(((p - keyOf().root) % 12 + 12) % 12);
      const k = i / Math.max(1, n - 1);
      let str;
      if (gay) {
        str = h('div', { class: 'hv-str', style: { top: axisPos(i, n), height: (2.4 - k * 1.1) + 'px' } });
        // 안족(줄 받침): 비스듬히 늘어선다
        field.append(h('span', { class: 'hv-bridge', style: { top: axisPos(i, n), left: (62 - k * 26) + '%' } }));
        field.append(h('span', { class: 'hv-lbl', text: letter(p), style: { top: axisPos(i, n) } }));
      } else {
        // 위는 백조 목처럼 내려갔다 끝에서 살짝 올라가는 목(넥), 아래는 높은 줄 쪽으로 올라가는 울림판
        const top = 6 + 50 * k - 28 * k * k, bot = 96 - 50 * k;
        tops.push([((i + 0.5) / n) * 100, top - 1.2]);
        bots.push([((i + 0.5) / n) * 100, bot + 0.8]);
        str = h('div', { class: 'hv-str' + (deg === 0 ? ' r' : deg === 3 && st.length === 7 ? ' f' : ''), style: { left: axisPos(i, n), top: top + '%', height: (bot - top) + '%', width: (3.4 - k * 2) + 'px' } });
        if (deg === 0 || (field.clientWidth || 700) / n >= 28) field.append(h('span', { class: 'hv-lbl' + (deg === 0 ? ' r' : ''), text: letter(p), style: { left: axisPos(i, n), top: bot + 3.5 + '%' } }));
      }
      G.strs.push(str);
      field.append(str);
    });
    if (!gay && n) {
      // 하프 틀: 줄 위를 잇는 목(넥)과 줄 아래의 울림판
      const pts = a => a.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
      const x0 = tops[0][0] / 2, x1 = 100 - (100 - tops[n - 1][0]) / 2;
      const edge = (a, y0, y1) => [[x0, y0]].concat(a, [[x1, y1]]);
      field.prepend(S('svg', { class: 'hv-frame', viewBox: '0 0 100 100', preserveAspectRatio: 'none' },
        S('polyline', { class: 'cl', points: pts([[x0, tops[0][1] - 3], [x0, 99]]) }),
        S('polyline', { class: 'bd', points: pts(edge(bots, bots[0][1] + 0.6, bots[n - 1][1] - 2)) }),
        S('polyline', { class: 'nk', points: pts(edge(tops, tops[0][1] - 2, tops[n - 1][1] - 1)) })));
    }
  }
  function pluck(i, f, at) {
    const p = G.ps[i];
    if (p == null) return;
    play('s' + i, p, f, at, ring);
    shake(G.strs[i], wait(at));
  }
  const R = () => field.getBoundingClientRect();
  sweep(el, {
    at: e => {
      const r = R(), n = G.ps.length;
      const f = gay ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      return { i: clamp(Math.floor(f * n), 0, n - 1), c: 0 };
    },
    down: P => pluck(P.i, 0.92, 0),
    cross: (list, gap) => {
      prepare(list.map(([i, , f]) => [G.ps[i], f]));
      const t0 = now() + 0.004;
      list.forEach(([i, , f], k) => pluck(i, f, t0 + k * gap));
    }
  });
  function keyDown(e) {
    if (e.code === 'KeyZ' || e.code === 'KeyX') { if (!e.repeat) { PS.oct[t.id] = clamp((PS.oct[t.id] || 0) + (e.code === 'KeyZ' ? -1 : 1), -2, 2); fill(); } return true; }
    let i = ROW_A.indexOf(e.code);
    if (i < 0 && ROW_Q.includes(e.code)) i = 10 + ROW_Q.indexOf(e.code);
    if (i < 0) return false;
    if (!e.repeat) pluck(i, 0.9, 0);
    return true;
  }
  const keyUp = e => ROW_A.includes(e.code) || ROW_Q.includes(e.code);
  function controls() {
    const move = k => { PS.oct[t.id] = clamp((PS.oct[t.id] || 0) + k, -2, 2); fill(); };
    return [btn({ text: '−', cls: 'sm tk-oct', title: '한 옥타브 아래로 (Z)', onclick: () => move(-1) }), btn({ text: '+', cls: 'sm tk-oct', title: '한 옥타브 위로 (X)', onclick: () => move(1) })];
  }
  return { el, fill, keyDown, keyUp, controls };
}

/* ================= 말렛 · 벨: 그 악기 모양의 음판 =================
   마림바·비브라폰·글로켄슈필·오르골은 건반처럼 두 줄로 늘어선 음판, 종은 매달린 튜블러 벨,
   칼림바는 가운데가 가장 낮은 금속 건(tine), 스틸 드럼은 5도 간격으로 둥글게 늘어선 음 */
const MALLET_STYLE = { kalimba: 'tines', steeldrum: 'pan', bell: 'tubes' };
const NAT = [0, 2, 4, 5, 7, 9, 11];
function malletView(t) {
  const d = U.instrumentOf(t), meta = U.instMeta(d.kind, d.p.inst) || {};
  const style = MALLET_STYLE[d.p.inst] || 'bars';
  const ring = ringOf(d);
  const el = h('div', { class: 'mv mv-' + style + ' mv-' + d.p.inst, 'data-nolongpress': '', style: { '--pc': U.colorOf(t.color) } });
  const field = h('div', { class: 'mv-field', role: 'group', 'aria-label': '음판' });
  el.append(field);
  const range = () => { const r = meta.range || [48, 84], k = 12 * (PS.oct[t.id] || 0); return [r[0] + k, r[1] + k]; };
  const target = (p, cls, css, label) => {
    const b = h('div', { class: 'mv-t ' + cls + (inKey(p) ? ' ink' : '') + (isRoot(p) ? ' root' : ''), dataset: { p }, style: css }, label ? h('span', { class: 'mv-l', text: label }) : null, h('span', { class: 'mv-d' }));
    field.append(b);
    return b;
  };
  function bars(tubes) {
    const [lo, hi] = range();
    const W = field.clientWidth || 700;
    const nats = [];
    for (let p = lo; p <= hi; p++) if (NAT.includes(((p % 12) + 12) % 12)) nats.push(p);
    const fit = Math.max(5, Math.floor(W / (U.isTouch ? 44 : 36)));
    const list = nats.slice(0, fit), n = list.length;
    const w = 100 / n;
    list.forEach((p, i) => {
      const k = i / Math.max(1, n - 1);
      if (tubes) target(p, 'nat', { left: (i * w + w * 0.14) + '%', width: w * 0.72 + '%', top: '34%', height: (62 - 26 * k) + '%' }, letter(p) === 'C' ? U.noteName(p) : letter(p));
      else target(p, 'nat', { left: (i * w + w * 0.06) + '%', width: w * 0.88 + '%', top: (54 + 8 * k) + '%', height: (44 - 16 * k) + '%' }, letter(p) === 'C' ? U.noteName(p) : letter(p));
      // 올림음은 두 음판 사이 위 줄에
      const s = p + 1;
      if (i < n - 1 && !NAT.includes(s % 12) && s <= hi) {
        if (tubes) target(s, 'acc', { left: ((i + 1) * w - w * 0.3) + '%', width: w * 0.6 + '%', top: '6%', height: (50 - 20 * k) + '%' });
        else target(s, 'acc', { left: ((i + 1) * w - w * 0.42) + '%', width: w * 0.84 + '%', top: (6 + 6 * k) + '%', height: (40 - 14 * k) + '%' });
      }
    });
    if (!tubes) field.prepend(h('div', { class: 'mv-rail', style: { top: '64%' } }), h('div', { class: 'mv-rail', style: { top: '22%' } }));
    else field.prepend(h('div', { class: 'mv-frame' }));
  }
  function tines() {
    const [lo] = range();
    const W = field.clientWidth || 700;
    const n = W >= (U.isTouch ? 560 : 480) ? 17 : W >= 380 ? 13 : 9;
    const ps = scaleRun(scaleSteps(), tonicNear(lo), n);
    const m = Math.floor(n / 2), w = 100 / n;
    field.append(h('div', { class: 'mv-body' }), h('div', { class: 'mv-hole' }), h('div', { class: 'mv-bridge' }));
    // 가운데가 가장 낮은 음, 왼쪽 오른쪽으로 번갈아 올라간다
    ps.forEach((p, j) => {
      const pos = j === 0 ? m : j % 2 ? m - (j + 1) / 2 : m + j / 2;
      const len = 74 - 4.2 * Math.abs(pos - m);
      target(p, 'tine', { left: (pos * w + w * 0.16) + '%', width: w * 0.68 + '%', top: '8%', height: len + '%' }, letter(p));
    });
  }
  function pan() {
    const [lo, hi] = range();
    const W = field.clientWidth || 700, H = field.clientHeight || 400;
    const D = Math.min(W, H) * 0.96, R = D / 2;
    const disc = h('div', { class: 'mv-pan', style: { width: D + 'px', height: D + 'px' } });
    field.append(disc);
    // 같은 음 이름은 같은 방향 (바깥 · 가운데 ·안쪽 고리가 옥타브), 둘레는 5도 간격
    const rings = [[0.8, 0.27, 0.19], [0.52, 0.2, 0.15], [0.25, 0.14, 0.11]];
    for (let p = lo; p <= hi; p++) {
      const o = Math.floor((p - lo) / 12);
      if (o > 2) break;
      const [rr, rw, rh] = rings[o];
      const ang = (((p % 12) * 7) % 12) * 30 - 90;
      const a = ang * Math.PI / 180;
      const b = h('div', { class: 'mv-t note' + (inKey(p) ? ' ink' : '') + (isRoot(p) ? ' root' : ''), dataset: { p },
        style: { left: R + Math.cos(a) * R * rr - R * rw / 2 + 'px', top: R + Math.sin(a) * R * rr - R * rh / 2 + 'px', width: R * rw + 'px', height: R * rh + 'px', transform: 'rotate(' + (ang + 90) + 'deg)' } },
      h('span', { class: 'mv-l', text: letter(p), style: { transform: 'rotate(' + -(ang + 90) + 'deg)' } }));
      disc.append(b);
    }
  }
  function fill() {
    U.clear(field);
    if (style === 'tines') tines();
    else if (style === 'pan') pan();
    else bars(style === 'tubes');
  }
  /* 손가락: 누른 음판, 미끄러지면 지나가는 음판 (가운데를 칠수록 세게) */
  const ptrs = new Map();
  const at = (x, y) => { const e = document.elementFromPoint(x, y), b = e && e.closest && e.closest('.mv-t'); return b && el.contains(b) ? b : null; };
  function strike(b, x, y, f) {
    const r = b.getBoundingClientRect(), p = +b.dataset.p;
    const dist = Math.min(1, Math.hypot((x - r.left - r.width / 2) / (r.width / 2), (y - r.top - r.height / 2) / (r.height / 2)));
    play('m' + p, p, f * (0.8 + 0.2 * (1 - dist)), 0, ring);
    b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
  }
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    U.ensureAudio();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    const b = at(e.clientX, e.clientY);
    ptrs.set(e.pointerId, b);
    if (b) strike(b, e.clientX, e.clientY, 1);
  });
  el.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const b = at(e.clientX, e.clientY);
    if (b && b !== ptrs.get(e.pointerId)) strike(b, e.clientX, e.clientY, 0.85);
    ptrs.set(e.pointerId, b);
  });
  for (const ty of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ty, e => ptrs.delete(e.pointerId));
  el.addEventListener('contextmenu', e => e.preventDefault());
  function keyDown(e) {
    if (e.code === 'KeyZ' || e.code === 'KeyX') { if (!e.repeat) { PS.oct[t.id] = clamp((PS.oct[t.id] || 0) + (e.code === 'KeyZ' ? -1 : 1), -2, 2); fill(); } return true; }
    const o = KEYMAP[e.code];
    if (o == null) return false;
    if (e.repeat) return true;
    const lo = range()[0], p = lo + ((12 - lo % 12) % 12) + o;
    const b = field.querySelector('.mv-t[data-p="' + p + '"]');
    if (b) { const r = b.getBoundingClientRect(); strike(b, r.left + r.width / 2, r.top + r.height / 2, 0.95); }
    else play('m' + p, p, 0.95, 0, ring);
    return true;
  }
  const keyUp = e => KEYMAP[e.code] != null;
  function controls() {
    const move = k => { PS.oct[t.id] = clamp((PS.oct[t.id] || 0) + k, -2, 2); fill(); };
    return [btn({ text: '−', cls: 'sm tk-oct', title: '한 옥타브 아래로 (Z)', onclick: () => move(-1) }), btn({ text: '+', cls: 'sm tk-oct', title: '한 옥타브 위로 (X)', onclick: () => move(1) })];
  }
  return { el, fill, keyDown, keyUp, controls };
}

/* ================= 화면 붙이기 ================= */
let cur = null, ro = null;
function view(t, lay) {
  releaseHeld();
  useTrack(t);
  const fam = family(t);
  cur = lay === 'strum' || lay === 'fret' ? neckView(t, lay, fam) : lay === 'harp' ? harpView(t, fam) : malletView(t);
  cur.t = t;
  cur.lay = lay;
  const v = cur;
  if (ro) ro.disconnect();
  if (window.ResizeObserver) {
    let last = '';
    ro = new ResizeObserver(() => {
      const sz = v.el.clientWidth + 'x' + v.el.clientHeight;
      if (sz !== last && v.el.isConnected) { last = sz; v.fill(); }
    });
    ro.observe(v.el);
  }
  requestAnimationFrame(() => { if (v.el.isConnected) v.fill(); });
  return v.el;
}
const active = () => (cur && cur.el.isConnected ? cur : null);
/* 도구 막대는 화면을 만든 바로 뒤에 (아직 붙기 전) 부른다 */
function controls(t, lay, rerender) { return cur && cur.t === t && cur.lay === lay ? cur.controls(rerender) : []; }
function keyDown(e) { const c = active(); return c ? c.keyDown(e) : false; }
function keyUp(e) { const c = active(); return c ? c.keyUp(e) : false; }
/* 누르고 있는 음(활 · 글자 키)만 멈춘다. 뜯어서 울리는 줄은 저절로 사라지게 둔다 */
function releaseHeld() { stopWhere(isHeld); }
function stopAll() { stopWhere(() => true); }

U.play = { family, famName, layouts, layoutOf, setLayout, isKeyLay, view, controls, keyDown, keyUp, releaseHeld, stopAll, guitarFrets, stripChords, stripNotes };
})(window.U = window.U || {});
