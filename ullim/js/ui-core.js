/* 울림 — 화면 공통: 상태, 다시 그리기, 아이콘, 노브·페이더·숫자칸, 메뉴, 대화상자, 알림, 끌어다 놓기, 정보 창 */
(function (U) {
'use strict';
const { h, clamp } = U;

/* ================= 화면 상태 ================= */
const ui = U.ui = {
  view: U.pref('view', 'session'),   // 'session' | 'arrange'
  detail: 'clip',                    // 'clip' | 'device'
  detailOpen: U.pref('detailOpen', true),
  browserOpen: U.pref('browserOpen', true),
  track: null,          // 선택한 트랙 id
  slot: null,           // 선택한 세션 슬롯 {t, s}
  clip: null,           // 클립 뷰에 띄운 클립 {t, s} 또는 {t, a}
  scene: 0,
  draw: false,          // 그리기 모드
  auto: false,          // 자동화 모드
  follow: U.pref('follow', true),
  keyboard: U.pref('keyboard', false), // 컴퓨터 건반
  octave: 3, velocity: 100,
  narrow: false,
  pane: 'main'          // 좁은 화면에서 보이는 칸
};

/* 다시 그리기 묶음: 같은 프레임에 한 번만 */
const renderers = {};
const dirty = new Set();
let pending = false;
function renderer(name, fn) { renderers[name] = fn; }
function inval(...names) {
  for (const n of names) {
    if (n === 'all') for (const k in renderers) dirty.add(k);
    else dirty.add(n);
  }
  if (!pending) { pending = true; requestAnimationFrame(flush); }
}
function flush() {
  pending = false;
  const list = [...dirty];
  dirty.clear();
  for (const n of list) {
    const fn = renderers[n];
    if (fn) { try { fn(); } catch (e) { console.error('render ' + n, e); } }
  }
}
/* 매 프레임: 미터, 재생 위치, 클립 진행 */
const frames = new Set();
function frame(fn) { frames.add(fn); return () => frames.delete(fn); }
function loop() {
  for (const fn of frames) { try { fn(); } catch (e) { console.error(e); } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ================= 선택 도우미 ================= */
function pr() { return U.project; }
function selTrack() { return (ui.track && U.trackById(pr(), ui.track)) || pr().tracks[0] || pr().master; }
function selectTrack(id, opts) {
  ui.track = id;
  if (opts && opts.device) setDetail('device');
  U.emit('select', { track: id });
  inval('detail', 'status');
}
function clipRef(ref) {
  ref = ref || ui.clip;
  if (!ref) return null;
  const t = U.trackById(pr(), ref.t);
  if (!t) return null;
  if (ref.a) { const a = t.arr.find(x => x.id === ref.a); return a ? { track: t, clip: a.clip, arr: a } : null; }
  const c = t.slots[ref.s];
  return c ? { track: t, clip: c, slot: ref.s } : null;
}
function showClip(ref, open) {
  ui.clip = ref;
  if (ref) ui.track = ref.t;
  if (open !== false) { setDetail('clip'); if (!ui.detailOpen) toggleDetail(true); }
  U.emit('select', { clip: ref });
  inval('detail', 'status');
}
function setDetail(which) {
  ui.detail = which;
  inval('detail');
}
function toggleDetail(force) {
  ui.detailOpen = force != null ? force : !ui.detailOpen;
  U.setPref('detailOpen', ui.detailOpen);
  document.body.classList.toggle('no-detail', !ui.detailOpen);
  inval('detail', 'arrange');
}
function toggleBrowser(force) {
  ui.browserOpen = force != null ? force : !ui.browserOpen;
  U.setPref('browserOpen', ui.browserOpen);
  document.body.classList.toggle('no-browser', !ui.browserOpen);
  inval('arrange', 'browser');
}

/* ================= 아이콘 ================= */
const ICONS = {
  play: '<path d="M5 3.5v9l8-4.5z"/>',
  stop: '<rect x="4" y="4" width="8" height="8" rx="1"/>',
  rec: '<circle cx="8" cy="8" r="4.5"/>',
  sessrec: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="2.6"/>',
  loop: '<path d="M4 6.5a3 3 0 0 1 3-3h4.5M12 9.5a3 3 0 0 1-3 3H4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10.5 1.6l2.4 1.9-2.4 1.9zM5.5 14.4l-2.4-1.9 2.4-1.9z"/>',
  metro: '<path d="M6.2 2h3.6l2.7 12h-9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 11L11.8 4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  draw: '<path d="M3 13l1-3.5 6.6-6.6a1.7 1.7 0 0 1 2.5 2.5L6.5 12z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  keys: '<rect x="1.5" y="3.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 3.5v5M7 3.5v5M9.5 3.5v5M12 3.5v5" stroke="currentColor" stroke-width="1.4"/>',
  menu: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  back: '<path d="M6.5 3.5L3 7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 7H10a3 3 0 0 1 0 6H7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  follow: '<path d="M2 8h9M8 4.5L11.5 8 8 11.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 3v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  auto: '<path d="M1.5 12.5l3.5-6 3.5 3 5-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="6.5" r="1.4"/><circle cx="8.5" cy="9.5" r="1.4"/>',
  session: '<rect x="2" y="2" width="5" height="3.5" rx=".6"/><rect x="9" y="2" width="5" height="3.5" rx=".6"/><rect x="2" y="7" width="5" height="3.5" rx=".6"/><rect x="9" y="7" width="5" height="3.5" rx=".6" opacity=".45"/><rect x="2" y="12" width="5" height="2.5" rx=".6" opacity=".45"/><rect x="9" y="12" width="5" height="2.5" rx=".6"/>',
  arrange: '<rect x="1.5" y="2.5" width="7" height="3" rx=".6"/><rect x="6" y="6.5" width="8.5" height="3" rx=".6"/><rect x="3" y="10.5" width="5" height="3" rx=".6"/>',
  browser: '<rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6 2.5v11" stroke="currentColor" stroke-width="1.4"/>',
  detail: '<rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 9h12" stroke="currentColor" stroke-width="1.4"/>',
  search: '<circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.2 10.2L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  speaker: '<path d="M2.5 6h2.5L8.5 3v10L5 10H2.5z"/><path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.3 3.6a6 6 0 0 1 0 8.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  plus: '<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  chevron: '<path d="M4.5 6.5L8 10l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  fold: '<path d="M3 5h10M3 8h10M3 11h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M1 3.5v9" stroke="currentColor" stroke-width="1.4"/>',
  zoomfit: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  file: '<path d="M4 1.8h5l3 3V14H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 1.8v3h3" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  wave: '<path d="M1.5 8h1.5l1.2-4 1.6 8 1.6-10 1.6 12 1.6-9 1.4 5 1.1-2h2.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>',
  midi: '<rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="4" y="9.5" width="3" height="1.6" rx=".5"/><rect x="7.5" y="7" width="3.5" height="1.6" rx=".5"/><rect x="5" y="5" width="2.5" height="1.6" rx=".5"/>',
  synth: '<path d="M1.5 9c1.5 0 1.5-5 3-5s1.5 8 3 8 1.5-8 3-8 1.5 5 3.5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  drum: '<ellipse cx="8" cy="5.5" rx="5.5" ry="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 5.5v5c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2v-5" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  fx: '<circle cx="5" cy="5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="11" cy="11" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 13L13 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  clip: '<rect x="2" y="4" width="12" height="8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 8h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  folder: '<path d="M1.8 4.2c0-.6.4-1 1-1h3.3l1.4 1.5h5.7c.6 0 1 .4 1 1v6.9c0 .6-.4 1-1 1H2.8c-.6 0-1-.4-1-1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  sound: '<path d="M8 2v9.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="6" cy="11.8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2c1.8.6 3.6 1.6 3.6 3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  power: '<path d="M8 2v5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4.6 4.4a5 5 0 1 0 6.8 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  upload: '<path d="M8 11V3M4.8 6L8 2.8 11.2 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 10.5v2.5h11v-2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  download: '<path d="M8 2.5v8M4.8 7.3L8 10.5l3.2-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 10.5v2.5h11v-2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  scale: '<path d="M2 12.5h3v-3h3v-3h3v-3h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>',
  undo: '<path d="M5.5 3L2.5 6l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 6h6.5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
};
function icon(name, cls) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  s.setAttribute('fill', 'currentColor');
  s.innerHTML = ICONS[name] || '';
  return s;
}

/* ================= 테마 색 (캔버스용) ================= */
let colorCache = null;
function colors() {
  if (colorCache) return colorCache;
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim();
  colorCache = {
    bg: g('--bg'), panel: g('--panel'), panel2: g('--panel-2'), panel3: g('--panel-3'), sunk: g('--sunk'),
    line: g('--line'), line2: g('--line-2'), fg: g('--fg'), fg2: g('--fg-2'), fg3: g('--fg-3'),
    accent: g('--accent'), play: g('--play'), rec: g('--rec'), cue: g('--cue'),
    grid: g('--grid'), grid2: g('--grid-strong'), sel: g('--sel'), key: g('--key-white'), keyBlack: g('--key-black'),
    scale: g('--scale-row'), m1: g('--meter-1'), m2: g('--meter-2'), m3: g('--meter-3'), auto: g('--auto'),
    mono: g('--font-mono'), font: g('--font-ui')
  };
  return colorCache;
}
function themeChanged() { colorCache = null; inval('all'); U.emit('theme'); }
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged);
  new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-skin'] });
} catch (e) { /* 오래된 브라우저 */ }

/* ================= 정보 창 ================= */
let infoEl = null, infoDefault = null;
function setInfo(title, text) {
  if (!infoEl) return;
  infoEl.querySelector('.iv-t').textContent = title || '';
  infoEl.querySelector('.iv-d').textContent = text || '';
}
function bindInfo(el, def) {
  infoEl = el;
  infoDefault = def;
  setInfo(...def());
  document.addEventListener('pointerover', e => {
    const t = e.target.closest && e.target.closest('[data-info]');
    if (t) {
      const [a, b] = t.dataset.info.split('|');
      setInfo(a, b || '');
    } else setInfo(...infoDefault());
  });
}
function info(el, title, text) { el.dataset.info = title + '|' + (text || ''); return el; }

/* ================= 끌어서 값 바꾸기 ================= */
/* 세로로 끌면 값이 바뀐다. Shift는 미세 조정 */
function dragValue(el, o) {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
    const start = o.get();
    let n0 = o.toN(start), last = start, moved = false;
    const y0 = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const move = ev => {
      const dy = y0 - ev.clientY;
      if (!moved && Math.abs(dy) < 2) return;
      moved = true;
      const n = clamp(n0 + dy / (ev.shiftKey ? 1600 : o.range || 160), 0, 1);
      const v = o.fromN(n);
      if (v !== last) { last = v; o.set(v, false); }
    };
    const up = ev => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      if (moved && last !== start) o.set(last, true);
      else if (!moved && o.click) o.click(ev);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  el.addEventListener('dblclick', e => { e.preventDefault(); if (o.reset) o.reset(); });
  el.addEventListener('keydown', e => {
    let d = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -1;
    else if ((e.key === 'Delete' || e.key === 'Backspace') && o.reset) { e.preventDefault(); e.stopPropagation(); o.reset(); return; }
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const n = clamp(o.toN(o.get()) + d * (e.shiftKey ? 0.002 : o.keyStep || 0.01), 0, 1);
    o.set(o.fromN(n), true);
  });
}

/* ================= 노브 ================= */
const ARC0 = Math.PI * 0.75, ARC = Math.PI * 1.5;
function arcPath(cx, cy, r, a0, a1) {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
/* o: {spec, get, set(v, final), label, info, auto(): 자동화 있음?, size} */
function knob(o) {
  const spec = o.spec;
  const el = h('div', { class: 'knob' + (o.size ? ' ' + o.size : ''), tabindex: '0', role: 'slider', 'aria-label': o.label || spec.label });
  const sv = U.svg('svg', { viewBox: '0 0 32 32', class: 'k-dial' });
  const track = U.svg('path', { class: 'k-track', d: arcPath(16, 16, 12, ARC0, ARC0 + ARC) });
  const val = U.svg('path', { class: 'k-arc' });
  const ptr = U.svg('line', { class: 'k-ptr', x1: 16, y1: 16 });
  sv.append(track, val, ptr);
  const vt = h('div', { class: 'k-val' });
  const lb = h('div', { class: 'k-lbl', text: o.label || spec.label });
  el.append(sv, vt, lb);
  const bip = spec.min < 0 && spec.max > 0 && spec.type !== 'enum';
  function draw() {
    const v = o.get();
    const n = U.toNorm(spec, v);
    const a = ARC0 + ARC * n;
    const a0 = bip ? ARC0 + ARC * U.toNorm(spec, 0) : ARC0;
    const lo = Math.min(a0, a), hi = Math.max(a0, a);
    val.setAttribute('d', hi - lo < 0.01 ? '' : arcPath(16, 16, 12, lo, hi));
    ptr.setAttribute('x2', (16 + 9 * Math.cos(a)).toFixed(2));
    ptr.setAttribute('y2', (16 + 9 * Math.sin(a)).toFixed(2));
    vt.textContent = U.fmtParam(spec, v);
    el.setAttribute('aria-valuetext', vt.textContent);
    el.classList.toggle('has-auto', !!(o.auto && o.auto()));
    // 정보 창에 지금 값을 함께 보여 준다
    const title = (o.title || spec.label) + (o.prefix ? ' · ' + o.prefix : '') + ' — ' + vt.textContent;
    el.dataset.info = title + '|' + (spec.info || '');
    if (el.classList.contains('dragging') || el.matches(':hover')) setInfo(title, spec.info || '');
  }
  dragValue(el, {
    get: o.get, toN: v => U.toNorm(spec, v), fromN: n => U.fromNorm(spec, n),
    set: (v, final) => { o.set(v, final); draw(); },
    reset: () => { o.set(spec.def, true); draw(); },
    range: o.range
  });
  el.update = draw;
  draw();
  return el;
}
/* 파라미터 종류에 맞는 조절기 */
function control(o) {
  const spec = o.spec;
  if (spec.type === 'enum') {
    const sel = h('select', { class: 'dd', 'aria-label': spec.label });
    for (const [v, l] of spec.options) sel.append(h('option', { value: v, text: l }));
    sel.value = o.get();
    sel.addEventListener('change', () => o.set(sel.value, true));
    const wrap = h('div', { class: 'ctl ctl-enum' }, sel, h('div', { class: 'k-lbl', text: o.label || spec.label }));
    info(wrap, spec.label, spec.info || '');
    wrap.update = () => { sel.value = o.get(); wrap.classList.toggle('has-auto', !!(o.auto && o.auto())); };
    return wrap;
  }
  if (spec.type === 'bool') {
    const b = h('button', { class: 'btn tg sm', type: 'button', text: o.label || spec.label });
    const set = () => { b.setAttribute('aria-pressed', o.get() ? 'true' : 'false'); };
    b.addEventListener('click', () => { o.set(!o.get(), true); set(); });
    const wrap = h('div', { class: 'ctl ctl-bool' }, b);
    info(wrap, spec.label, spec.info || '');
    wrap.update = set;
    set();
    return wrap;
  }
  return knob(o);
}

/* ================= 숫자칸 (끌거나 두 번 눌러 입력) ================= */
/* o: {get, set(v, final), fmt, parse, step, min, max, toN?, fromN?, w} */
function numBox(o) {
  const el = h('div', { class: 'num' + (o.cls ? ' ' + o.cls : ''), tabindex: '0', role: 'spinbutton' });
  if (o.label) el.setAttribute('aria-label', o.label);
  const draw = () => { el.textContent = o.fmt(o.get()); };
  const toN = o.toN || (v => (v - o.min) / (o.max - o.min));
  const fromN = o.fromN || (n => { let v = o.min + n * (o.max - o.min); if (o.step) v = Math.round(v / o.step) * o.step; return clamp(v, o.min, o.max); });
  dragValue(el, {
    get: o.get, toN, fromN,
    set: (v, final) => { o.set(v, final); draw(); },
    reset: o.def != null ? () => { o.set(o.def, true); draw(); } : null,
    range: o.range || 300, keyStep: o.keyStep
  });
  el.addEventListener('dblclick', e => { e.stopPropagation(); edit(); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); edit(); } });
  function edit() {
    const inp = h('input', { class: 'num-edit', value: o.fmt(o.get()), spellcheck: 'false' });
    el.textContent = '';
    el.append(inp);
    inp.focus();
    inp.select();
    let done = false;
    const finish = ok => {
      if (done) return;
      done = true;
      if (ok) {
        const v = o.parse ? o.parse(inp.value) : parseFloat(inp.value);
        if (v != null && isFinite(v)) o.set(o.min != null ? clamp(v, o.min, o.max) : v, true);
      }
      draw();
    };
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); el.focus(); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); el.focus(); }
    });
    inp.addEventListener('blur', () => finish(true));
  }
  el.update = draw;
  draw();
  return el;
}

/* ================= 페이더 + 미터 ================= */
/* o: {get(): dB, set(dB, final), meter(): [l, r], h} */
function fader(o) {
  const el = h('div', { class: 'fader', tabindex: '0', role: 'slider', 'aria-label': o.label || '볼륨' });
  const cv = h('canvas', { class: 'meter' });
  const rail = h('div', { class: 'f-rail' });
  const cap = h('div', { class: 'f-cap' });
  rail.append(cap);
  el.append(cv, rail);
  const draw = () => {
    const pos = U.dbToPos(o.get());
    cap.style.bottom = 'calc(' + (pos * 100).toFixed(2) + '% - 4px)';
    el.setAttribute('aria-valuetext', U.fmtParam({ unit: 'dB' }, o.get()));
  };
  dragValue(el, {
    get: o.get, toN: db => U.dbToPos(db), fromN: n => U.round(U.posToDb(n), 1),
    set: (v, final) => { o.set(v, final); draw(); },
    reset: () => { o.set(0, true); draw(); },
    range: 140
  });
  let peakHold = [0, 0], holdT = [0, 0];
  el.update = draw;
  el.meter = (lv) => {
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const g = U.fitCanvas(cv, W, H);
    const c = colors();
    g.clearRect(0, 0, W, H);
    const bw = (W - 1) / 2;
    const now = performance.now();
    for (let i = 0; i < 2; i++) {
      const v = lv[i];
      const db = U.gainToDb(v);
      const p = db === -Infinity ? 0 : clamp(U.dbToPos(db), 0, 1);
      if (p > peakHold[i] || now - holdT[i] > 1200) { peakHold[i] = p; holdT[i] = now; }
      const x = i * (bw + 1);
      g.fillStyle = c.sunk;
      g.fillRect(x, 0, bw, H);
      const y = H * (1 - p);
      const grad = g.createLinearGradient(0, H, 0, 0);
      grad.addColorStop(0, c.m1); grad.addColorStop(0.72, c.m1); grad.addColorStop(0.86, c.m2); grad.addColorStop(1, c.m3);
      g.fillStyle = grad;
      g.fillRect(x, y, bw, H - y);
      if (peakHold[i] > 0.01) { g.fillStyle = peakHold[i] >= U.dbToPos(0) ? c.m3 : c.fg2; g.fillRect(x, H * (1 - peakHold[i]), bw, 1.5); }
    }
  };
  info(el, '볼륨', '끌어서 트랙 음량을 바꿔요. 더블클릭하면 0 dB로 돌아가요. 옆의 막대는 지금 나가는 소리 크기예요.');
  draw();
  return el;
}

/* ================= 버튼 ================= */
function btn(o) {
  const b = h('button', { class: 'btn' + (o.cls ? ' ' + o.cls : ''), type: 'button', title: o.title || null, 'aria-label': o.aria || o.title || null });
  if (o.icon) b.append(icon(o.icon));
  if (o.text) b.append(h('span', { text: o.text }));
  if (o.toggle) b.setAttribute('aria-pressed', o.on ? 'true' : 'false');
  if (o.onclick) b.addEventListener('click', o.onclick);
  if (o.info) info(b, o.info[0], o.info[1]);
  return b;
}
function setPressed(b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); }

/* ================= 메뉴 ================= */
let openMenu = null;
function closeMenu() {
  if (openMenu) { openMenu.remove(); openMenu = null; }
}
/* items: [{label, key, action, disabled, checked, danger, sub:[...], sep, header}] */
function menu(items, at) {
  closeMenu();
  const el = h('div', { class: 'menu', role: 'menu' });
  const build = (list, root) => {
    for (const it of list) {
      if (!it) continue;
      if (it.sep) { root.append(h('div', { class: 'm-sep' })); continue; }
      if (it.header) { root.append(h('div', { class: 'm-head', text: it.header })); continue; }
      const row = h('button', { class: 'm-item' + (it.danger ? ' danger' : '') + (it.checked ? ' checked' : ''), type: 'button', role: 'menuitem', disabled: it.disabled || null });
      row.append(h('span', { class: 'm-check', text: it.checked ? '✓' : '' }));
      if (it.swatch) row.append(h('span', { class: 'm-sw', style: { background: it.swatch } }));
      row.append(h('span', { class: 'm-label', text: it.label }));
      if (it.key) row.append(h('span', { class: 'm-key', text: it.key }));
      if (it.sub) {
        row.append(h('span', { class: 'm-key', text: '›' }));
        const sub = h('div', { class: 'menu sub', role: 'menu' });
        build(it.sub, sub);
        row.append(sub);
        row.addEventListener('click', e => { e.stopPropagation(); row.classList.toggle('open'); });
      } else row.addEventListener('click', e => { e.stopPropagation(); closeMenu(); if (it.action) it.action(); });
      root.append(row);
    }
  };
  build(items, el);
  document.body.append(el);
  openMenu = el;
  let x, y;
  if (at instanceof Element) { const r = at.getBoundingClientRect(); x = r.left; y = r.bottom + 2; }
  else { x = at.x; y = at.y; }
  const r = el.getBoundingClientRect();
  x = clamp(x, 4, window.innerWidth - r.width - 4);
  if (y + r.height > window.innerHeight - 4) y = Math.max(4, (at instanceof Element ? at.getBoundingClientRect().top - r.height - 2 : y - r.height));
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  const first = el.querySelector('.m-item:not([disabled])');
  if (first) first.focus({ preventScroll: true });
  el.addEventListener('keydown', e => {
    const all = [...el.querySelectorAll(':scope > .m-item:not([disabled])')];
    const i = all.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (all[i + 1] || all[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (all[i - 1] || all[all.length - 1]).focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    e.stopPropagation();
  });
  return el;
}
document.addEventListener('pointerdown', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);
window.addEventListener('blur', closeMenu);
window.addEventListener('resize', closeMenu);
function colorMenu(cur, onPick) {
  return U.COLORS.map((c, i) => ({ label: '색 ' + (i + 1), swatch: c, checked: i === cur, action: () => onPick(i) }));
}

/* ================= 대화상자 ================= */
function dialog(o) {
  const back = h('div', { class: 'dlg-back' });
  const box = h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title, style: o.width ? { width: o.width } : null });
  const close = () => { back.remove(); document.removeEventListener('keydown', key, true); if (o.onclose) o.onclose(); };
  const head = h('div', { class: 'dlg-head' }, h('h2', { text: o.title }), btn({ icon: 'close', cls: 'ghost', title: '닫기', onclick: close }));
  const body = h('div', { class: 'dlg-body' }, o.body);
  box.append(head, body);
  if (o.actions && o.actions.length) {
    const foot = h('div', { class: 'dlg-foot' });
    for (const a of o.actions) {
      const b = h('button', { class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), type: 'button', text: a.label });
      b.addEventListener('click', async () => { if (a.action) { const r = await a.action(b); if (r === false) return; } close(); });
      foot.append(b);
    }
    box.append(foot);
  }
  back.append(box);
  back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  const key = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
      const prim = box.querySelector('.dlg-foot .primary');
      if (prim) { e.preventDefault(); prim.click(); }
    } else e.stopPropagation();
  };
  document.addEventListener('keydown', key, true);
  document.body.append(back);
  const f = box.querySelector('input, select, textarea, .dlg-foot .primary');
  if (f && !matchMedia('(pointer: coarse)').matches) setTimeout(() => f.focus(), 30);
  return { close, box, body };
}
function confirm(title, text, ok, danger) {
  return new Promise(res => {
    let answered = false;
    dialog({
      title, body: h('p', { class: 'dlg-text', text }),
      actions: [{ label: '취소', action: () => { answered = true; res(false); } }, { label: ok || '확인', primary: true, danger, action: () => { answered = true; res(true); } }],
      onclose: () => { if (!answered) res(false); }
    });
  });
}
function ask(title, label, value) {
  return new Promise(res => {
    const inp = h('input', { class: 'inp', value: value || '', 'aria-label': label });
    let answered = false;
    dialog({
      title, body: h('label', { class: 'fld' }, h('span', { text: label }), inp),
      actions: [{ label: '취소', action: () => { answered = true; res(null); } }, { label: '확인', primary: true, action: () => { answered = true; res(inp.value.trim()); } }],
      onclose: () => { if (!answered) res(null); }
    });
  });
}

/* ================= 알림 ================= */
let toastWrap = null;
function toast(msg, kind) {
  if (!toastWrap) { toastWrap = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.append(toastWrap); }
  const t = h('div', { class: 'toast' + (kind ? ' ' + kind : ''), text: msg });
  toastWrap.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, kind === 'error' ? 4200 : 2400);
}

/* ================= 이름 바로 고치기 ================= */
function editInline(el, value, done) {
  const inp = h('input', { class: 'inline-edit', value: value || '' });
  const old = [...el.childNodes];
  el.textContent = '';
  el.append(inp);
  inp.focus();
  inp.select();
  let fin = false;
  const finish = ok => {
    if (fin) return;
    fin = true;
    inp.remove();
    for (const n of old) el.append(n);
    if (ok) done(inp.value.trim());
  };
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
  inp.addEventListener('pointerdown', e => e.stopPropagation());
  inp.addEventListener('dblclick', e => e.stopPropagation());
}

/* ================= 끌어다 놓기 ================= */
const targets = new WeakMap();
const dnd = { active: null };
function dropTarget(el, handlers) { el.dataset.drop = '1'; targets.set(el, handlers); return el; }
function findTarget(x, y, payload) {
  let el = document.elementFromPoint(x, y);
  while (el) {
    const t = el.dataset && el.dataset.drop && targets.get(el);
    if (t && (!t.accept || t.accept(payload))) return { el, t };
    el = el.parentElement;
  }
  return null;
}
/* 바깥(파일 끌어다 놓기 등)에서 온 것을 그 자리의 대상에 놓는다 */
function dropAt(x, y, payload) {
  const hit = findTarget(x, y, payload);
  if (!hit) return false;
  hit.t.drop(payload, { clientX: x, clientY: y, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false });
  return true;
}
/* 눌렀다 움직이면 끌기 시작. payload: {type, ...} */
function dragStart(e, payload, label, opts) {
  opts = opts || {};
  const x0 = e.clientX, y0 = e.clientY;
  let ghost = null, cur = null, started = false;
  const move = ev => {
    if (!started) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      started = true;
      dnd.active = payload;
      ghost = h('div', { class: 'drag-ghost', text: label });
      document.body.append(ghost);
      document.body.classList.add('dragging');
      if (opts.onstart) opts.onstart();
    }
    ghost.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 10}px)`;
    const hit = findTarget(ev.clientX, ev.clientY, payload);
    if (cur && (!hit || hit.el !== cur.el)) { cur.el.classList.remove('drop-over'); if (cur.t.leave) cur.t.leave(payload); }
    if (hit) {
      hit.el.classList.add('drop-over');
      if (hit.t.over) hit.t.over(payload, ev);
    }
    cur = hit;
  };
  const up = ev => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (!started) { if (opts.onclick) opts.onclick(ev); return; }
    finish();
    const hit = findTarget(ev.clientX, ev.clientY, payload);
    if (hit) { hit.t.drop(payload, ev); }
    else if (opts.ondropnowhere) opts.ondropnowhere(ev);
  };
  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (started) finish();
  };
  const finish = () => {
    dnd.active = null;
    if (ghost) ghost.remove();
    document.body.classList.remove('dragging');
    if (cur) { cur.el.classList.remove('drop-over'); if (cur.t.leave) cur.t.leave(payload); }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}

/* ================= 기타 ================= */
function seg(options, cur, onPick, cls) {
  const el = h('div', { class: 'seg' + (cls ? ' ' + cls : ''), role: 'group' });
  for (const [v, l, inf] of options) {
    const b = h('button', { type: 'button', class: 'seg-b', text: l, 'aria-pressed': v === cur ? 'true' : 'false' });
    if (inf) info(b, l, inf);
    b.addEventListener('click', () => onPick(v));
    el.append(b);
  }
  return el;
}
function select(options, cur, onPick, o) {
  o = o || {};
  const sel = h('select', { class: 'dd' + (o.cls ? ' ' + o.cls : ''), 'aria-label': o.label || null });
  for (const it of options) {
    if (it.group) {
      const g = h('optgroup', { label: it.group });
      for (const [v, l] of it.items) g.append(h('option', { value: v, text: l }));
      sel.append(g);
    } else sel.append(h('option', { value: it[0], text: it[1] }));
  }
  sel.value = cur;
  sel.addEventListener('change', () => onPick(sel.value));
  if (o.info) info(sel, o.info[0], o.info[1]);
  return sel;
}
function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

Object.assign(U, {
  renderer, inval, frame, selTrack, selectTrack, clipRef, showClip, setDetail, toggleDetail, toggleBrowser,
  icon, colors, setInfo, bindInfo, info, dragValue, knob, control, numBox, fader, btn, setPressed,
  menu, closeMenu, colorMenu, dialog, confirm, ask, toast, editInline, dropTarget, dropAt, dragStart, dnd, seg, select, isTyping
});
})(window.U = window.U || {});
