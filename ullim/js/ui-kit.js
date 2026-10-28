/* 울림 — 드럼 킷 화면: 드럼 머신의 패드를 진짜 드럼 세트 모양으로 친다 (개러지밴드처럼).
   패드 종류를 보고 킥·스네어·하이햇·탐·심벌 자리에 앉히고, 자리를 못 찾은 패드는 옆의 퍼커션 패드로 둔다.
   북은 가운데를 칠수록 세게, 스네어 테두리는 사이드 스틱, 하이햇 가장자리는 열린 햇, 라이드 가운데(벨)는 라이드 벨 */
(function (U) {
'use strict';
const { h, ui, info, clamp } = U;
const NS = 'http://www.w3.org/2000/svg';
function S(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  for (const c of kids) if (c) el.append(c);
  return el;
}

/* ================= 패드 → 드럼 자리 ================= */
const TYPES = {
  kick: ['akick', 'kick'], snare: ['asnare', 'snare'], side: ['astick', 'rim', 'arim'],
  hat: ['ahat', 'chh'], ohat: ['aohat', 'ohh'], pedal: ['apedal'],
  tom: ['atom', 'tom'], crash: ['acrash', 'crash'], ride: ['aride', 'ride'], bell: ['abell']
};
function mapKit(d, empty) {
  const pads = (d.data && d.data.pads) || [];
  const used = new Set();
  const ok = i => !!pads[i] && !used.has(i) && !empty(i);
  const find = types => {
    for (const ty of types) for (let i = 0; i < pads.length; i++) if (ok(i) && pads[i].type === ty) { used.add(i); return i; }
    return -1;
  };
  const m = { kick: find(TYPES.kick), snare: find(TYPES.snare), side: find(TYPES.side), hat: find(TYPES.hat), ohat: find(TYPES.ohat), pedal: find(TYPES.pedal) };
  // 탐은 높은 것부터: 탐 1 · 탐 2 · 플로어 탐 (둘이면 탐 1과 플로어)
  const toms = [];
  for (let i = 0; i < pads.length; i++) if (ok(i) && TYPES.tom.includes(pads[i].type)) toms.push(i);
  toms.sort((a, b) => (pads[b].tune || 0) - (pads[a].tune || 0));
  const take = toms.slice(0, 3);
  take.forEach(i => used.add(i));
  m.tom1 = take.length ? take[0] : -1;
  m.tom2 = take.length === 3 ? take[1] : -1;
  m.floor = take.length >= 2 ? take[take.length - 1] : -1;
  m.crash = find(TYPES.crash);
  m.crash2 = find(TYPES.crash);
  m.ride = find(TYPES.ride);
  m.bell = find(TYPES.bell);
  m.extra = pads.map((p, i) => i).filter(ok);
  return m;
}

/* ================= 모양 =================
   자리: [가운데 x, y, 가로 반지름, 세로 반지름] (킥은 앞에서 본 원 [x, y, r], 페달은 [x, y, 너비, 높이]) */
const LAYOUTS = {
  // 아주 납작한 칸 (아이패드 가로 · 아래 칸을 펼쳤을 때): 심벌 한 줄, 북 한 줄
  flat: { w: 1500, h: 480, at: {
    crash: [300, 100, 135, 74], crash2: [760, 62, 92, 50], ride: [1200, 105, 150, 80],
    hat: [110, 270, 105, 62], tom1: [560, 200, 98, 60], tom2: [960, 200, 104, 64], snare: [370, 345, 125, 80], floor: [1180, 345, 135, 86],
    kick: [760, 380, 118], pedal: [40, 400, 125, 60] } },
  wide: { w: 1000, h: 640, at: {
    crash: [215, 128, 128, 78], crash2: [522, 74, 92, 54], ride: [805, 140, 142, 86],
    hat: [100, 330, 100, 60], snare: [295, 440, 118, 78], tom1: [412, 252, 92, 60], tom2: [612, 252, 98, 64], floor: [804, 440, 126, 84],
    kick: [548, 548, 118], pedal: [36, 552, 124, 60] } },
  tall: { w: 640, h: 880, at: {
    crash: [150, 120, 120, 72], crash2: [330, 62, 82, 48], ride: [500, 140, 125, 76],
    tom1: [225, 300, 86, 56], tom2: [415, 300, 92, 60], hat: [92, 480, 92, 56], snare: [250, 590, 112, 72], floor: [500, 560, 115, 76],
    kick: [330, 800, 120], pedal: [24, 760, 120, 58] } }
};
const PIECES = [
  { id: 'kick', name: '킥', kind: 'kick', zones: '가운데를 칠수록 세게 울려요.' },
  { id: 'floor', name: '플로어 탐', kind: 'drum', zones: '가운데를 칠수록 세게 울려요.' },
  { id: 'tom1', name: '탐 1', kind: 'drum', zones: '가운데를 칠수록 세게 울려요.' },
  { id: 'tom2', name: '탐 2', kind: 'drum', zones: '가운데를 칠수록 세게 울려요.' },
  { id: 'snare', name: '스네어', kind: 'drum', snare: true, zones: '가운데는 스네어, 테두리(쇠 테)는 사이드 스틱이에요.' },
  { id: 'pedal', name: '페달 햇', kind: 'pedal', zones: '발로 하이햇을 닫는 소리예요.' },
  { id: 'hat', name: '하이햇', kind: 'cym', zones: '안쪽은 닫힌 햇, 점선 바깥 가장자리는 열린 햇이에요. 닫힌 햇을 치면 열린 햇이 멎어요.' },
  { id: 'crash2', name: '크래시 2', kind: 'cym', zones: '두 번째 크래시예요.' },
  { id: 'crash', name: '크래시', kind: 'cym', zones: '세게 터지는 심벌이에요. 마디 첫 박에 많이 쳐요.' },
  { id: 'ride', name: '라이드', kind: 'cym', zones: '넓은 면은 라이드, 가운데 볼록한 벨은 라이드 벨이에요.' }
];
/* 자리마다 칠 수 있는 패드 (말풍선과 글자 키 표시에 쓴다) */
const padsOf = (pc, m) => (pc.id === 'snare' ? [m.snare, m.side] : pc.id === 'hat' ? [m.hat, m.ohat] : pc.id === 'ride' ? [m.ride, m.bell] : [m[pc.id]]).filter(i => i >= 0);

function drumShape(g, x, y, rx, ry, snare) {
  const dep = ry * 0.62;
  g.append(
    S('path', { class: 'k-shell', d: 'M' + (x - rx) + ',' + y + ' L' + (x - rx) + ',' + (y + dep) + ' A' + rx + ',' + ry + ' 0 0 0 ' + (x + rx) + ',' + (y + dep) + ' L' + (x + rx) + ',' + y + ' Z' }),
    S('ellipse', { class: 'k-rim', cx: x, cy: y, rx, ry }),
    S('ellipse', { class: 'k-head', cx: x, cy: y, rx: rx * 0.88, ry: ry * 0.88 }));
  if (snare) g.append(S('ellipse', { class: 'k-zone', cx: x, cy: y, rx: rx * 0.86, ry: ry * 0.86 }));
}
function cymShape(g, x, y, rx, ry, id) {
  g.append(S('ellipse', { class: 'k-cym', cx: x, cy: y, rx, ry }));
  for (const k of [0.84, 0.66, 0.48]) g.append(S('ellipse', { class: 'k-groove', cx: x, cy: y, rx: rx * k, ry: ry * k }));
  const bell = id === 'ride' ? 0.3 : 0.2;
  g.append(S('ellipse', { class: 'k-bell', cx: x, cy: y, rx: rx * bell, ry: ry * bell }));
  if (id === 'hat') g.append(S('ellipse', { class: 'k-zone', cx: x, cy: y, rx: rx * 0.7, ry: ry * 0.7 }));
}
/* 색: 와인색 반짝이 셸, 크롬 테, 흰 코팅 가죽, 금빛 심벌 */
function grad(tag, id, attrs, stops) {
  return S(tag, Object.assign({ id }, attrs), ...stops.map(([o, c]) => S('stop', { offset: o, 'stop-color': c })));
}
const defs = () => S('defs', null,
  grad('linearGradient', 'kg-shell', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#4a0e16'], [0.5, '#a12d3b'], [1, '#4a0e16']]),
  grad('linearGradient', 'kg-rim', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#979da3'], [0.5, '#f2f4f6'], [1, '#979da3']]),
  grad('radialGradient', 'kg-head', { cx: 0.45, cy: 0.4, r: 0.7 }, [[0, '#fdfcf8'], [1, '#d8d2c2']]),
  grad('radialGradient', 'kg-cym', { cx: 0.45, cy: 0.4, r: 0.75 }, [[0, '#f8db8d'], [0.55, '#d6a53d'], [1, '#a37820']]),
  grad('radialGradient', 'kg-khead', { cx: 0.5, cy: 0.45, r: 0.7 }, [[0, '#303036'], [1, '#121214']]));
function kickShape(g, x, y, r) {
  g.append(
    S('circle', { class: 'k-kshell', cx: x, cy: y, r }),
    S('circle', { class: 'k-krim', cx: x, cy: y, r: r * 0.93 }),
    S('circle', { class: 'k-khead', cx: x, cy: y, r: r * 0.86 }),
    S('circle', { class: 'k-port', cx: x + r * 0.42, cy: y + r * 0.3, r: r * 0.12 }),
    S('text', { class: 'k-logo', x, y: y - r * 0.18, 'text-anchor': 'middle' }, document.createTextNode('ULLIM')));
}

/* ================= 화면 ================= */
let cur = null, ro = null;
function view(t, d, api) {
  const m = mapKit(d, api.empty);
  const el = h('div', { class: 'kit', 'data-nolongpress': '', style: { '--pc': U.colorOf(t.color) } });
  const stage = h('div', { class: 'kit-stage' });
  const extra = h('div', { class: 'kit-extra', role: 'group', 'aria-label': '퍼커션' });
  el.append(stage, extra);
  const K = cur = { t, d, m, el, pieces: [], xps: [], svg: null, shape: '' };
  const label = i => api.name(i);

  function build() {
    // 세로로 길면 퍼커션을 아래로 내리고 세로 배치, 아주 납작하면 두 줄로
    const W = el.clientWidth || 800, H = Math.max(1, el.clientHeight || 500);
    const side = extra.classList.contains('none') ? 0 : 148;
    const shape = W / H < 1.15 ? 'tall' : (W - side) / H >= 2.2 ? 'flat' : 'wide';
    if (shape === K.shape && K.svg) return;
    K.shape = shape;
    el.classList.toggle('tall', shape === 'tall');
    U.clear(stage);
    const L = LAYOUTS[shape];
    const svg = K.svg = S('svg', { class: 'kit-svg', viewBox: '0 0 ' + L.w + ' ' + L.h, preserveAspectRatio: 'xMidYMid meet', role: 'group', 'aria-label': '드럼 세트' }, defs());
    // 심벌 스탠드 (뒤에)
    const stands = S('g', { class: 'k-stands' });
    for (const id of ['crash', 'ride', 'crash2', 'hat']) {
      const a = L.at[id];
      if (m[id] < 0 && !(id === 'hat' && m.ohat >= 0)) continue;
      stands.append(S('line', { x1: a[0], y1: a[1], x2: a[0] + (id === 'ride' ? 30 : id === 'hat' ? 0 : -20), y2: L.h }));
    }
    svg.append(stands);
    K.pieces = [];
    for (const pc of PIECES) {
      const a = L.at[pc.id];
      const pads = padsOf(pc, m);
      if (pc.id === 'crash2' && !pads.length) continue;   // 두 번째 크래시는 있을 때만
      if (pc.id === 'pedal' && !pads.length) continue;    // 페달 햇이 없는 키트 (전자 드럼)
      const g = S('g', { class: 'k-p kp-' + pc.kind + (pads.length ? '' : ' k-none'), 'data-k': pc.id, tabindex: '-1' });
      if (pc.kind === 'drum') drumShape(g, a[0], a[1], a[2], a[3], pc.snare);
      else if (pc.kind === 'cym') cymShape(g, a[0], a[1], a[2], a[3], pc.id);
      else if (pc.kind === 'kick') kickShape(g, a[0], a[1], a[2]);
      else g.append(S('rect', { class: 'k-pedal', x: a[0], y: a[1], width: a[2], height: a[3], rx: 12 }));
      // 이름과 글자 키
      const lx = pc.kind === 'pedal' ? a[0] + a[2] / 2 : a[0];
      const ly = pc.kind === 'pedal' ? a[1] + a[3] / 2 + 6 : pc.kind === 'kick' ? a[1] + a[2] * 0.24 : a[1] + a[3] * (pc.kind === 'cym' ? 0.6 : 0.5);
      g.append(S('text', { class: 'k-name', x: lx, y: ly, 'text-anchor': 'middle' }, document.createTextNode(pc.id === 'crash2' && pads.length ? label(pads[0]) === 'Crash 2' ? '크래시 2' : label(pads[0]) : pc.name)));
      // 글자 키 (스네어 · 하이햇 · 라이드는 두 자리 모두: 가운데 · 가장자리)
      const keys = pads.map(i => api.key(i)).filter(Boolean).map(U.keyLabel);
      const key = keys[0] || null;
      if (keys.length) {
        const txt = keys.join(' · '), w = 12 + txt.length * 9.5;
        const kx = pc.kind === 'pedal' ? a[0] : pc.kind === 'kick' ? a[0] - a[2] * 0.66 : a[0] - a[2] * 0.84;
        const ky = pc.kind === 'pedal' ? a[1] - 12 : pc.kind === 'kick' ? a[1] - a[2] * 0.6 : a[1] - a[3] * 0.8;
        g.append(S('g', { class: 'k-key' }, S('rect', { x: kx - 2, y: ky - 15, width: w, height: 22, rx: 5 }), S('text', { x: kx - 2 + w / 2, y: ky + 1, 'text-anchor': 'middle' }, document.createTextNode(txt))));
      }
      svg.append(g);
      const tip = pads.length ? pads.map(i => label(i)).join(' · ') : '이 키트에는 없어요';
      info(g, pc.name + (pads.length ? ' · ' + tip : ''), pads.length ? pc.zones + (key ? ' ' + U.keyLabel(key) + ' 키로도 쳐요.' : '') : '이 키트에는 이 자리에 맞는 패드가 없어요. 드럼 머신에서 패드 종류를 바꾸면 생겨요.');
      K.pieces.push({ pc, g, a, pads });
    }
    stage.append(svg);
  }
  function buildExtra() {
    U.clear(extra);
    K.xps = [];
    extra.classList.toggle('none', !m.extra.length);
    if (!m.extra.length) return;
    extra.append(h('div', { class: 'kit-xl', text: '퍼커션' }));
    for (const i of m.extra) {
      const key = api.key(i);
      const b = h('button', { type: 'button', 'data-nolongpress': '', class: 'kit-xp', dataset: { pad: i } }, h('span', { class: 'kit-xn', text: label(i) }), key ? h('span', { class: 'kit-xk', text: U.keyLabel(key) }) : null);
      info(b, label(i), '눌러서 쳐요.' + (key ? ' ' + U.keyLabel(key) + ' 키로도 쳐요.' : ''));
      extra.append(b);
      K.xps.push({ i, b });
    }
  }

  /* ---------- 치기 ---------- */
  function local(e) {
    const p = K.svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(K.svg.getScreenCTM().inverse());
  }
  /* 누른 자리 → 패드와 세기 */
  function zone(P, e) {
    const q = local(e), a = P.a, id = P.pc.id;
    if (P.pc.kind === 'pedal') return { pad: m.pedal, f: 0.9 };
    const r = P.pc.kind === 'kick' ? Math.hypot(q.x - a[0], q.y - a[1]) / a[2] : Math.hypot((q.x - a[0]) / a[2], (q.y - a[1]) / a[3]);
    const soft = 1 - 0.2 * Math.min(1, r);   // 가장자리는 조금 여리게
    if (id === 'snare') return r > 0.86 && m.side >= 0 ? { pad: m.side, f: 0.95 } : { pad: m.snare >= 0 ? m.snare : m.side, f: soft };
    if (id === 'hat') return (r > 0.7 && m.ohat >= 0) || m.hat < 0 ? { pad: m.ohat, f: 0.95 } : { pad: m.hat, f: 0.85 + 0.15 * (1 - r) };
    if (id === 'ride') return (r < 0.3 && m.bell >= 0) || m.ride < 0 ? { pad: m.bell, f: 1 } : { pad: m.ride, f: 0.88 + 0.12 * (1 - r) };
    return { pad: m[id], f: soft };
  }
  function flash(el) { el.classList.remove('hit'); void el.getBoundingClientRect(); el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 140); }
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const xb = e.target.closest && e.target.closest('.kit-xp');
    const g = e.target.closest && e.target.closest('.k-p');
    if (!xb && (!g || g.classList.contains('k-none'))) return;
    e.preventDefault();
    let pad, f = 1;
    if (xb) pad = +xb.dataset.pad;
    else ({ pad, f } = zone(K.pieces.find(P => P.g === g), e));
    if (pad == null || pad < 0) return;
    if (ui.padKeys) { api.assign(pad); return; }
    api.hit(e, pad, f);
    flash(xb || g);
  });
  el.addEventListener('contextmenu', e => e.preventDefault());

  K.build = () => { build(); };
  if (ro) ro.disconnect();
  if (window.ResizeObserver) { ro = new ResizeObserver(() => { if (el.isConnected) build(); }); ro.observe(el); }
  requestAnimationFrame(() => { if (el.isConnected) { build(); } });
  buildExtra();
  return el;
}
/* 매 프레임: 막 친 패드의 자리를 번쩍 (글자 키 · 재생 · 녹음한 클립도) */
function frame(hit) {
  if (!cur || !cur.el.isConnected) return;
  for (const P of cur.pieces) P.g.classList.toggle('lit', P.pads.some(i => hit.has(i)));
  for (const x of cur.xps) x.b.classList.toggle('lit', hit.has(x.i));
}
U.kitView = { view, frame, mapKit };
})(window.U = window.U || {});
