/* 울림 — 터치 건반: 신스·샘플러 트랙을 손가락으로 치는 건반 (패드 화면에서 그 트랙을 고르면 나와요).
   피아노 건반, 스케일 격자(푸시처럼 위 줄이 4도 위인, 키에 맞는 음만 있는 칸), 코드 패드(키 안의 주요 화음) 세 가지예요.
   손가락마다 따로 울리고, 미끄러뜨리면 지나가는 음을 차례로 쳐요. 코드를 켜면 한 손가락으로 스케일 3화음을 쳐요 */
(function (U) {
'use strict';
const { h, ui, btn, clamp, info } = U;
const pr = () => U.project;

const KS = ui.keys = {
  layout: U.pref('keysLayout', 'piano'),   // 'piano' | 'grid' | 'chords'
  chord: !!U.pref('keysChord', false),
  ctype: U.pref('chordType', 'triad'),     // 코드 패드: 'triad' | 'seventh' | 'ninth'
  smooth: U.pref('chordSmooth', true),     // 앞 화음에서 덜 움직이는 자리로
  bass: U.pref('chordBass', false),        // 근음을 한 옥타브 아래에 더하기
  lastTop: null,                           // 코드 패드로 마지막에 친 화음 (부드럽게 잇기용)
  oct: {}                                  // 트랙 id → 시작 옥타브 (C3 = 3)
};
// 코드 패드 키: 1~7은 키 안의 화음, Q~Y는 세컨더리 도미넌트
const CHORD_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'];
const SEC_CODES = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'];
const KEYMAP = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, Semicolon: 16, Quote: 17 };
const WHITE = [0, 2, 4, 5, 7, 9, 11];

let track = null;     // 지금 건반이 치는 트랙
let root = null;      // 건반 화면
let ro = null;        // 건반 화면 크기 감시 (다시 그릴 때마다 바꾼다)
const fingers = new Map();  // pointerId 또는 키 code → {id, pitches, el}
const count = new Map();    // 울리는 음 → 누르고 있는 손가락 수

/* ================= 음 내기 ================= */
const key = () => pr().key;
const scaleSteps = () => U.scaleOf(key().scale).steps;
function octOf(t) {
  if (KS.oct[t.id] == null) {
    const s = (t.name || '') + ' ' + ((U.instrumentOf(t) || {}).preset || '');
    KS.oct[t.id] = /베이스|bass|808|서브|sub/i.test(s) ? 1 : 3;
  }
  return KS.oct[t.id];
}
const baseOf = t => (octOf(t) + 2) * 12;
/* 스케일 3화음 (근음이 스케일 밖이면 메이저 3화음) */
function triad(p) {
  const k = key();
  if (!U.inScale(p, k.root, k.scale)) return [p, p + 4, p + 7];
  const d = U.pitchToDegree(p, k.root, k.scale, p);
  return [0, 2, 4].map(j => U.degreeToPitch(d + j, k.root, k.scale, p));
}
function chordName(ps) {
  const a = ps[1] - ps[0], b = ps[2] - ps[0];
  const q = a === 3 && b === 6 ? '°' : a === 4 && b === 8 ? '+' : a === 3 ? 'm' : '';
  return U.NOTE_NAMES[((ps[0] % 12) + 12) % 12] + q;
}
const pitchesOf = p => (KS.chord ? triad(p) : [p]).filter(x => x >= 0 && x <= 127);
/* 코드 패드: 지금 키와 화음 종류로 만든 화음 목록, 누를 때마다 자리를 잡아 음으로 */
function chordList() { return { dia: U.chords.diatonic(key(), KS.ctype), sec: U.chords.secondary(key(), KS.ctype) }; }
function chordPitches(id) {
  const { dia, sec } = chordList();
  const ch = dia.concat(sec).find(c => c.id === id);
  if (!ch) return [];
  const v = U.chords.voice(ch, baseOf(track) + 2, KS.smooth ? KS.lastTop : null, { smooth: KS.smooth, bass: KS.bass });
  KS.lastTop = v.top;
  return v.all;
}
function on(p) {
  const n = count.get(p) || 0;
  count.set(p, n + 1);
  if (n || !track) return;
  U.engine.liveOn(track.id, p, clamp(Math.round(ui.padVel), 1, 127));
  U.emit('livenote', { p, on: true });
}
function off(p) {
  const n = count.get(p) || 0;
  if (n > 1) { count.set(p, n - 1); return; }
  count.delete(p);
  if (!track) return;
  U.engine.liveOff(track.id, p);
  U.emit('livenote', { p, on: false });
}
function press(id, el, pitches) {
  const prev = fingers.get(id);
  if (prev) lift(id);
  for (const p of pitches) on(p);
  fingers.set(id, { pitches, el });
  if (el) el.classList.add('on');
}
function lift(id) {
  const f = fingers.get(id);
  if (!f) return;
  fingers.delete(id);
  for (const p of f.pitches) off(p);
  if (f.el && ![...fingers.values()].some(x => x.el === f.el)) f.el.classList.remove('on');
}
function releaseAll() { for (const id of [...fingers.keys()]) lift(id); count.clear(); }

/* ================= 화면 ================= */
const LAYOUTS = { piano: ['tk-piano', '건반'], grid: ['tk-grid', '스케일 격자'], chords: ['tk-chords', '코드 패드'] };
const drawFor = el => (KS.layout === 'grid' ? drawGrid : KS.layout === 'chords' ? drawChords : drawPiano)(el);
function view(t) {
  releaseAll();
  if (track !== t) KS.lastTop = null;
  track = t;
  root = h('div', { class: 'tk', 'data-nolongpress': '', style: { '--pc': U.colorOf(t.color) } });
  const lay = LAYOUTS[KS.layout] || LAYOUTS.piano;
  const surface = h('div', { class: 'tk-surface ' + lay[0], role: 'group', 'aria-label': lay[1] });
  root.append(surface);
  const fill = () => { if (surface.isConnected) drawFor(surface); };
  bind(surface);
  if (ro) ro.disconnect();
  if (window.ResizeObserver) {
    let last = '';
    ro = new ResizeObserver(() => {
      const sz = surface.clientWidth + 'x' + surface.clientHeight;
      if (sz !== last) { last = sz; releaseAll(); fill(); }
    });
    ro.observe(surface);
  }
  requestAnimationFrame(fill);
  return root;
}
/* 피아노: 폭에 맞춰 1~4옥타브, 키에 맞는 음은 점, 도(C)에는 이름.
   세로로 긴 화면이면 두 줄로 쌓아서 위 줄이 이어지는 높은 옥타브예요 */
function drawPiano(el) {
  U.clear(el);
  const w = el.clientWidth || 600, hh = el.clientHeight || 300;
  const octs = clamp(Math.round(w / (7 * (U.isTouch ? 54 : 46))), 1, 4);
  const rows = hh >= 560 ? 2 : 1;
  for (let r = rows - 1; r >= 0; r--) el.append(pianoRow(baseOf(track) + r * octs * 12, octs));
}
function pianoRow(base, octs) {
  const row = h('div', { class: 'tk-row' });
  const k = key();
  const nW = octs * 7 + 1;
  const whites = [];
  for (let o = 0; o <= octs; o++) for (const s of WHITE) { if (o === octs && s) break; whites.push(base + o * 12 + s); }
  whites.forEach(p => {
    const inK = U.inScale(p, k.root, k.scale), isRoot = ((p - k.root) % 12 + 12) % 12 === 0;
    row.append(h('div', { class: 'tk-w' + (inK ? ' ink' : '') + (isRoot ? ' root' : ''), dataset: { p } },
      p % 12 === 0 ? h('span', { class: 'tk-lbl', text: U.noteName(p) }) : null,
      h('span', { class: 'tk-dot' })));
  });
  const bw = 100 / nW;
  whites.forEach((p, i) => {
    const s = ((p % 12) + 12) % 12;
    if (i === whites.length - 1 || s === 4 || s === 11) return;
    const bp = p + 1;
    const inK = U.inScale(bp, k.root, k.scale), isRoot = ((bp - k.root) % 12 + 12) % 12 === 0;
    row.append(h('div', { class: 'tk-b' + (inK ? ' ink' : '') + (isRoot ? ' root' : ''), dataset: { p: bp }, style: { left: ((i + 1) * bw - bw * 0.31) + '%', width: (bw * 0.62) + '%' } }, h('span', { class: 'tk-dot' })));
  });
  return row;
}
/* 스케일 격자: 오른쪽으로 한 음씩, 위 줄은 4도 위. 근음 칸은 트랙 색 */
function drawGrid(el) {
  U.clear(el);
  const w = el.clientWidth || 600, hh = el.clientHeight || 300;
  const cols = clamp(Math.floor(w / (U.isTouch ? 82 : 70)), 4, 8);
  const rows = clamp(Math.floor(hh / (U.isTouch ? 70 : 58)), 2, 8);
  const st = scaleSteps(), n = st.length, k = key();
  const rowStep = Math.max(2, Math.round(n * 5 / 12));
  const base = baseOf(track);
  el.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
  el.style.gridTemplateRows = 'repeat(' + rows + ', minmax(0, 1fr))';
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const deg = c + r * rowStep;
      const p = U.degreeToPitch(deg, k.root, k.scale, base);
      if (p > 127) { el.append(h('div', { class: 'tk-c off' })); continue; }
      const isRoot = ((deg % n) + n) % n === 0;
      const ps = pitchesOf(p);
      el.append(h('div', { class: 'tk-c' + (isRoot ? ' root' : ''), dataset: { p } },
        h('span', { class: 'tk-n', text: KS.chord && ps.length === 3 ? chordName(ps) : U.noteName(p) })));
    }
  }
}
/* 코드 패드: 위 줄은 키 안의 화음 일곱 개(주요 3화음 표시), 아래 줄은 다음 화음으로 끌어가는 세컨더리 도미넌트 */
function drawChords(el) {
  U.clear(el);
  const { dia, sec } = chordList(), k = key();
  const pad = (c, code) => h('div', { class: 'tk-cp' + (c.primary ? ' prim' : '') + (c.sec ? ' sec' : ''), dataset: { chord: c.id } },
    h('span', { class: 'tk-cp-k', text: code ? code.replace(/^(Digit|Key)/, '') : '' }),
    c.primary ? h('span', { class: 'tk-cp-p', text: '주요' }) : null,
    h('span', { class: 'tk-cp-n', text: c.name }),
    h('span', { class: 'tk-cp-r', text: c.sec ? '→ ' + c.target : c.roman }));
  const parent = U.chords.parentScale(k.scale) !== k.scale ? ' (' + U.scaleOf(U.chords.parentScale(k.scale)).name + '로 쌓아요)' : '';
  el.append(
    h('div', { class: 'tk-ch-l', text: U.scaleLabel(k.root, k.scale) + '의 화음' + parent }),
    h('div', { class: 'tk-cr' }, ...dia.map((c, i) => pad(c, CHORD_CODES[i]))),
    h('div', { class: 'tk-ch-l', text: '다음 화음으로 끌어가는 화음 · 세컨더리 도미넌트' }),
    h('div', { class: 'tk-cr sec', style: { '--n': Math.max(sec.length, 4) } }, ...sec.map((c, i) => pad(c, SEC_CODES[i]))));
}
function keyAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const k = el && el.closest && el.closest('.tk-surface [data-p], .tk-surface [data-chord]');
  return k && root && root.contains(k) ? k : null;
}
function bind(el) {
  const down = new Set();   // 건반 위에 닿아 있는 손가락 (건반 사이 틈으로 빠졌다가 돌아와도 다시 친다)
  const hit = e => {
    const k = keyAt(e.clientX, e.clientY);
    const prev = fingers.get(e.pointerId);
    if (prev && prev.el === k) return;
    if (!k) { lift(e.pointerId); return; }
    press(e.pointerId, k, k.dataset.chord ? chordPitches(k.dataset.chord) : pitchesOf(+k.dataset.p));
  };
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    U.ensureAudio();
    el.setPointerCapture(e.pointerId);
    down.add(e.pointerId);
    hit(e);
  });
  el.addEventListener('pointermove', e => { if (down.has(e.pointerId)) hit(e); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, e => { down.delete(e.pointerId); lift(e.pointerId); });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function redraw() { if (root && track) { releaseAll(); const s = root.querySelector('.tk-surface'); if (s) drawFor(s); } }

/* ================= 도구 막대 ================= */
function setOct(t, d) {
  KS.oct[t.id] = clamp(octOf(t) + d, -1, 7);
  redraw();
  if (rangeLbl) rangeLbl.textContent = rangeText(t);
}
let rangeLbl = null;
/* 건반의 맨 아래 음 (스케일 격자는 그 옥타브의 근음부터) */
const rangeText = t => U.noteName(KS.layout === 'grid' ? U.degreeToPitch(0, key().root, key().scale, baseOf(t)) : baseOf(t));
function controls(t, rerender) {
  const lay = U.seg([['piano', '건반', '피아노처럼 생긴 건반이에요.'], ['grid', '스케일', '키에 맞는 음만 칸으로 늘어놓아요. 오른쪽으로 한 음씩, 위 줄은 4도 위라서 아무 칸이나 쳐도 어울려요.'],
    ['chords', '코드 패드', '지금 키의 주요 화음을 큰 버튼으로 늘어놓아요. 누르면 화음이 통째로 울리고, 1~7 키(아래 줄은 Q~Y)로도 쳐요.']], KS.layout,
    v => { KS.layout = v; U.setPref('keysLayout', v); rerender(); }, 'tk-lay');
  const down = btn({ text: '−', cls: 'sm tk-oct', title: '한 옥타브 아래로', onclick: () => setOct(t, -1) });
  const up = btn({ text: '+', cls: 'sm tk-oct', title: '한 옥타브 위로', onclick: () => setOct(t, 1) });
  rangeLbl = h('span', { class: 'tk-range', text: rangeText(t) });
  info(rangeLbl, '옥타브', '건반이 시작하는 음이에요. −, + 또는 키보드의 Z, X로 옮겨요.');
  const oct = [h('span', { class: 'pv-sep' }), down, rangeLbl, up];
  if (KS.layout === 'chords') return [lay, ...chordControls(() => { KS.lastTop = null; redraw(); })].concat(oct);
  const chord = btn({ text: '코드', cls: 'tg sm', toggle: true, on: KS.chord, info: ['코드', '켜면 한 손가락으로 지금 키의 3화음을 쳐요. 스케일 격자에서는 칸마다 코드 이름이 보여요.'], onclick: () => { KS.chord = !KS.chord; U.setPref('keysChord', KS.chord); U.setPressed(chord, KS.chord); redraw(); } });
  return [lay, chord].concat(oct);
}
/* 화음 종류 · 부드럽게 · 베이스 (코드 패드와 클립 칸의 코드 넣기가 함께 쓴다) */
function chordControls(onChange) {
  const type = U.seg(U.chords.TYPES, KS.ctype, v => { KS.ctype = v; U.setPref('chordType', v); onChange(); }, 'tk-ctype');
  const smooth = btn({ text: '부드럽게', cls: 'tg sm', toggle: true, on: KS.smooth, info: ['부드럽게 잇기', '켜면 앞 화음에서 손가락을 덜 움직이는 자리(자리바꿈)로 짚어서 화음이 매끄럽게 이어져요. 끄면 늘 근음부터 쌓아요.'],
    onclick: () => { KS.smooth = !KS.smooth; U.setPref('chordSmooth', KS.smooth); U.setPressed(smooth, KS.smooth); onChange(); } });
  const bass = btn({ text: '베이스', cls: 'tg sm', toggle: true, on: KS.bass, info: ['베이스 음 더하기', '켜면 화음 아래 한 옥타브에 근음을 더해 두껍게 울려요. 베이스 트랙이 따로 있으면 꺼 두는 게 깔끔해요. 9화음은 늘 근음이 아래에 있어요.'],
    onclick: () => { KS.bass = !KS.bass; U.setPref('chordBass', KS.bass); U.setPressed(bass, KS.bass); onChange(); } });
  return [type, smooth, bass];
}

/* ================= 키보드 (아이패드 매직 키보드 등) ================= */
function keyDown(e) {
  if (!track) return false;
  if (e.code === 'KeyZ' || e.code === 'KeyX') { if (!e.repeat) setOct(track, e.code === 'KeyZ' ? -1 : 1); return true; }
  if (KS.layout === 'chords') {
    const i = CHORD_CODES.indexOf(e.code), j = SEC_CODES.indexOf(e.code);
    if (i < 0 && j < 0) return false;
    if (e.repeat || fingers.has(e.code)) return true;
    const { dia, sec } = chordList(), ch = i >= 0 ? dia[i] : sec[j];
    if (!ch) return true;
    U.ensureAudio();
    press(e.code, root && root.querySelector('.tk-surface [data-chord="' + ch.id + '"]'), chordPitches(ch.id));
    return true;
  }
  const o = KEYMAP[e.code];
  if (o == null) return false;
  if (e.repeat || fingers.has(e.code)) return true;
  U.ensureAudio();
  const p = baseOf(track) + o;
  const el = root && root.querySelector('.tk-surface [data-p="' + p + '"]');
  press(e.code, el, pitchesOf(p));
  return true;
}
function keyUp(e) { if (!fingers.has(e.code)) return false; lift(e.code); return true; }

U.touchKeys = { view, controls, chordControls, releaseAll, keyDown, keyUp, redraw, get track() { return track; } };
})(window.U = window.U || {});
