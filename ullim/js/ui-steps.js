/* 울림 — 스텝 시퀀서: 드럼 머신·루프 패드 클립을 칸을 눌러 찍는다 (패드 16줄 × 박자 칸).
   누르면 찍히고 찍힌 칸을 누르면 지워지며, 끌면 이어서 찍거나 지운다. 오른쪽 클릭은 세기 바꾸기 */
(function (U) {
'use strict';
const { h, ui, info, clamp, btn } = U;
const LABEL_W = 104, HEAD_H = 18;
let hold = null;   // 손가락으로 누르고 있는 찍힌 칸 (길게 누르면 세기 바꾸기)
const ST = ui.steps = { res: +U.pref('stepRes', 0.25), vel: 100, row: 0 };
let cur = null, cvGrid = null, cvLabels = null, main = null;
let geo = null, index = new Map(), lastCol = null;

function region(c) { return c.loop.on ? [c.loop.start, c.loop.end] : [c.start, c.end]; }
function inst() { return cur && U.instrumentOf(cur.track); }
function padName(i) {
  const d = inst(), pd = d && d.data && d.data.pads && d.data.pads[i];
  return (pd && pd.name) || '패드 ' + (i + 1);
}
/* 패드 소리를 한 번 들려준다 (녹음·노트 리피트와 상관없이) */
function audition(i, vel) {
  U.ensureAudio();
  const n = U.engine.nodes.get(cur.track.id), it = n && n.inst;
  if (!it) return;
  const at = U.engine.ctx.currentTime + 0.01;
  if (it.preview) it.preview(i, vel, at);
  else it.playNote(36 + i, vel, at, 0.2);
}
/* 칸마다 그 안에서 시작하는 음 */
function reindex() {
  index = new Map();
  const c = cur.clip, [a] = region(c);
  for (const n of c.notes) {
    if (n.p < 36 || n.p > 51) continue;
    const j = Math.floor((n.s - a) / ST.res + 1e-6);
    if (j < 0 || j >= geo.n) continue;
    const k = (n.p - 36) + ':' + j;
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(n);
  }
}
function cellNotes(i, j) { return index.get(i + ':' + j) || []; }

/* ================= 화면 ================= */
function build(editor, ref) {
  cur = ref;
  const c = cur.clip;
  const [a, b] = region(c);
  const bar = U.barLen(U.project.sig);
  const res = U.select([['0.5', '1/8'], ['0.25', '1/16'], ['0.125', '1/32'], [String(1 / 6), '1/16T']], String(ST.res), v => { ST.res = +v; U.setPref('stepRes', ST.res); layout(); draw(); },
    { cls: 'sm', label: '칸 길이', info: ['칸 길이', '한 칸이 몇 분음표인지예요. 1/16이면 한 마디가 16칸이에요.'] });
  const vel = U.select([['100', '세기 보통'], ['127', '세기 강하게'], ['64', '세기 약하게']], String(ST.vel), v => { ST.vel = +v; },
    { cls: 'sm', label: '찍을 세기', info: ['찍을 세기', '새로 찍는 칸의 세기예요. 찍힌 칸은 오른쪽 클릭으로 보통 → 강하게 → 약하게를 돌아요.'] });
  const lens = [[4, '1마디'], [8, '2마디'], [16, '4마디'], [32, '8마디']].map(([x, l]) => [String(x * bar / 4), l]);
  const cur0 = String(U.round(b - a, 4));
  if (!lens.some(x => x[0] === cur0)) lens.push([cur0, U.fmtLen(b - a, U.project.sig)]);
  const len = U.select(lens, cur0, v => setLen(+v),
    { cls: 'sm', label: '패턴 길이', info: ['패턴 길이', '늘리면 지금 패턴을 그대로 이어 붙여요. 줄여도 지운 음은 남아 있다가 다시 늘리면 돌아와요.'] });
  const fill = btn({ text: '줄 채우기 ▾', cls: 'sm', info: ['줄 채우기', '고른 줄(왼쪽 이름을 눌러 골라요)을 4분·8분·오프비트·16분으로 한 번에 채워요.'], onclick: () => fillMenu(fill) });
  const clr = btn({ text: '모두 지우기', cls: 'ghost sm', info: ['모두 지우기', '이 패턴의 음을 다 지워요. ' + U.MOD + '+Z로 되돌릴 수 있어요.'], onclick: clearAll });
  for (const s of [res, vel, len]) s.addEventListener('change', () => s.blur());
  const title = h('span', { class: 'pr-title', text: (c.name || '드럼 패턴') + ' · ' + U.trackLabel(U.project, cur.track) });
  editor.append(h('div', { class: 'pr-bar st-bar' }, U.clipView.viewSeg(), res, vel, len, fill, clr, h('span', { class: 'cb-flex' }), title));
  cvLabels = h('canvas', { class: 'st-labels' });
  cvGrid = h('canvas', { class: 'st-grid', tabindex: '0' });
  main = h('div', { class: 'st-main' }, h('div', { class: 'st-inner' }, cvLabels, cvGrid));
  editor.append(main);
  // 두 손가락으로 밀면 칸이 많은 패턴을 옆으로·아래로 넘겨 봐요
  U.gestures.pan(main, { pan: (dx, dy) => { main.scrollLeft -= dx; main.scrollTop -= dy; } });
  info(cvGrid, '스텝 시퀀서', '칸을 누르면 찍히고, 찍힌 칸을 누르면 지워져요. 누른 채 끌면 이어서 찍거나 지워요. 오른쪽 클릭으로 세기를 바꿔요. 밝을수록 세게 쳐요.');
  info(cvLabels, '패드 줄', '이름을 누르면 소리를 들어 보고 그 줄을 골라요. 위의 "줄 채우기"는 고른 줄에 적용돼요. 글자는 패드에 정한 키예요.');
  bind();
  new ResizeObserver(() => { layout(); draw(); }).observe(main);
  layout();
  draw();
}
function layout() {
  if (!main) return;
  const c = cur.clip, [a, b] = region(c);
  const n = Math.max(1, Math.round((b - a) / ST.res));
  const availW = Math.max(120, main.clientWidth - LABEL_W - 2);
  // 손가락으로 누를 수 있게 터치 화면에서는 칸을 더 크게 (넘치면 두 손가락으로 밀어 봐요)
  const cellW = Math.max(U.isTouch ? 26 : 16, Math.floor(availW / n));
  const rowH = clamp(Math.floor((main.clientHeight - HEAD_H - 2) / 16), U.isTouch ? 20 : 13, U.isTouch ? 40 : 30);
  geo = { a, b, n, cellW, rowH, W: n * cellW, H: HEAD_H + rowH * 16 };
  reindex();
}
function draw() {
  if (!cur || !cvGrid || !cvGrid.isConnected || !geo) return;
  const col = U.colors(), tc = U.colorOf(cur.track.color);
  const { a, n, cellW, rowH, W, H } = geo;
  const g = U.fitCanvas(cvGrid, W, H);
  const perBeat = Math.max(1, Math.round(1 / ST.res));
  const beatsPerBar = U.barLen(U.project.sig);
  g.fillStyle = col.panel;
  g.fillRect(0, 0, W, H);
  // 박마다 바탕을 번갈아
  for (let j = 0; j < n; j++) {
    const beat = Math.floor(j / perBeat);
    if (beat % 2) { g.fillStyle = col.panel2; g.fillRect(j * cellW, HEAD_H, cellW, H - HEAD_H); }
  }
  // 위 머리: 마디.박
  g.font = '10px ' + col.mono;
  g.textBaseline = 'middle';
  for (let j = 0; j < n; j += perBeat) {
    const beat = Math.round(j * ST.res + a);
    const barN = Math.floor(beat / beatsPerBar) + 1, bt = beat % beatsPerBar + 1;
    g.fillStyle = bt === 1 ? col.fg : col.fg3;
    g.fillText(bt === 1 ? String(barN) : barN + '.' + bt, j * cellW + 3, HEAD_H / 2);
    g.fillStyle = bt === 1 ? col.grid2 : col.grid;
    g.fillRect(j * cellW, 0, 1, H);
  }
  // 지금 칸
  if (lastCol != null && lastCol >= 0 && lastCol < n) {
    g.fillStyle = U.alpha('#ffb547', 0.2);
    g.fillRect(lastCol * cellW, HEAD_H, cellW, H - HEAD_H);
  }
  // 고른 줄
  g.fillStyle = col.sel;
  g.fillRect(0, HEAD_H + ST.row * rowH, W, rowH);
  for (let i = 0; i < 16; i++) {
    const y = HEAD_H + i * rowH;
    for (let j = 0; j < n; j++) {
      const x = j * cellW, list = cellNotes(i, j);
      const pad = 2;
      if (!list.length) {
        g.fillStyle = col.sunk;
        g.fillRect(x + pad, y + pad, cellW - pad * 2, rowH - pad * 2);
        continue;
      }
      const v = Math.max(...list.map(nn => nn.v));
      const muted = list.every(nn => nn.m);
      g.globalAlpha = muted ? 0.3 : 0.35 + 0.65 * v / 127;
      g.fillStyle = tc;
      g.fillRect(x + pad, y + pad, cellW - pad * 2, rowH - pad * 2);
      g.globalAlpha = 1;
      if (v >= 120) { g.fillStyle = '#16171a'; g.fillRect(x + pad, y + pad, cellW - pad * 2, 2); }
    }
  }
  drawLabels();
}
function drawLabels() {
  const col = U.colors();
  const { rowH, H } = geo;
  const g = U.fitCanvas(cvLabels, LABEL_W, H);
  g.fillStyle = col.panel;
  g.fillRect(0, 0, LABEL_W, H);
  g.textBaseline = 'middle';
  const d = inst();
  for (let i = 0; i < 16; i++) {
    const y = HEAD_H + i * rowH;
    g.fillStyle = i === ST.row ? col.sel : i % 2 ? col.panel2 : col.panel;
    g.fillRect(0, y, LABEL_W, rowH);
    g.fillStyle = col.fg3;
    g.font = '9px ' + col.mono;
    g.fillText(String(i + 1), 4, y + rowH / 2);
    g.fillStyle = col.fg;
    g.font = (rowH >= 16 ? '11px ' : '10px ') + col.font;
    let name = padName(i);
    while (name.length > 1 && g.measureText(name).width > LABEL_W - 40) name = name.slice(0, -1);
    g.fillText(name, 20, y + rowH / 2);
    const k = d && U.padsUI.keyOf(d, i);
    if (k) {
      g.fillStyle = col.fg3;
      g.font = '600 10px ' + col.mono;
      g.textAlign = 'right';
      g.fillText(U.keyLabel(k), LABEL_W - 6, y + rowH / 2);
      g.textAlign = 'left';
    }
  }
}

/* ================= 조작 ================= */
function cellAt(e) {
  const r = cvGrid.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top - HEAD_H;
  if (y < 0) return null;
  const i = Math.floor(y / geo.rowH), j = Math.floor(x / geo.cellW);
  if (i < 0 || i > 15 || j < 0 || j >= geo.n) return null;
  return { i, j };
}
function bind() {
  cvGrid.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const hit = cellAt(e);
    if (!hit) return;
    e.preventDefault();
    ui.focus = 'roll';
    cvGrid.setPointerCapture(e.pointerId);
    const c = cur.clip;
    const mode = cellNotes(hit.i, hit.j).length ? 'erase' : 'paint';
    const done = new Set();
    let changed = false;
    // 손가락으로 찍힌 칸을 누르면 바로 지우지 않고 기다린다: 길게 누르면 지우는 대신 세기를 바꾼다
    hold = e.pointerType !== 'mouse' && mode === 'erase' ? { hit, skip: false } : null;
    const apply = at => {
      const k = at.i + ':' + at.j;
      if (done.has(k)) return;
      done.add(k);
      const list = cellNotes(at.i, at.j);
      if (mode === 'erase') {
        if (!list.length) return;
        c.notes = c.notes.filter(nn => !list.includes(nn));
      } else {
        if (list.length) return;
        c.notes.push({ p: 36 + at.i, s: U.round(geo.a + at.j * ST.res, 5), d: U.round(ST.res * 0.95, 5), v: ST.vel });
        audition(at.i, ST.vel);
      }
      changed = true;
      reindex();
      draw();
      U.touch({ clip: c.id });
    };
    if (!hold) apply(hit);
    const move = ev => {
      const at = cellAt(ev);
      if (!at) return;
      if (hold && hold.hit) {
        if (at.i === hold.hit.i && at.j === hold.hit.j) return;
        if (!hold.skip) apply(hold.hit);
        hold.hit = null;
      }
      apply(at);
    };
    const up = ev => {
      cvGrid.removeEventListener('pointermove', move);
      cvGrid.removeEventListener('pointerup', up);
      cvGrid.removeEventListener('pointercancel', up);
      if (hold && hold.hit && !hold.skip && ev.type === 'pointerup') apply(hold.hit);
      hold = null;
      if (changed) U.commit(mode === 'paint' ? '스텝 찍기' : '스텝 지우기');
    };
    cvGrid.addEventListener('pointermove', move);
    cvGrid.addEventListener('pointerup', up);
    cvGrid.addEventListener('pointercancel', up);
  });
  cvGrid.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (hold) hold.skip = true;
    const hit = cellAt(e);
    if (!hit) return;
    const list = cellNotes(hit.i, hit.j);
    if (!list.length) return;
    const v = list[0].v;
    const nv = v >= 120 ? 64 : v < 80 ? 100 : 127;
    for (const nn of list) nn.v = nv;
    audition(hit.i, nv);
    draw();
    U.commit('스텝 세기');
  });
  cvLabels.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const r = cvLabels.getBoundingClientRect();
    const i = Math.floor((e.clientY - r.top - HEAD_H) / geo.rowH);
    if (i < 0 || i > 15) return;
    ST.row = i;
    audition(i, ST.vel);
    draw();
  });
}
/* 패턴 길이: 늘리면 지금 패턴을 이어 붙인다 */
function setLen(nl) {
  const c = cur.clip, [a, b] = region(c), old = b - a;
  if (Math.abs(nl - old) < 1e-6) return;
  const times = nl / old;
  if (nl > old && Math.abs(times - Math.round(times)) < 1e-6) {
    const src = c.notes.filter(n => n.s >= a - 1e-9 && n.s < b - 1e-9);
    c.notes = c.notes.filter(n => n.s < b - 1e-9 || n.s >= a + nl - 1e-9);
    for (let k = 1; k < Math.round(times); k++) for (const n of src) c.notes.push(Object.assign({}, n, { s: U.round(n.s + k * old, 5) }));
  }
  if (c.loop.on) c.loop.end = c.loop.start + nl;
  else c.start = a;
  c.end = a + nl;
  if (c.follow) c.follow.time = nl;
  U.commit('패턴 길이');
}
function fillMenu(anchor) {
  const fill = (every, off, label) => {
    const c = cur.clip, [a, b] = region(c), p = 36 + ST.row;
    c.notes = c.notes.filter(n => n.p !== p || n.s < a - 1e-9 || n.s >= b - 1e-9);
    if (every) for (let s = a + off; s < b - 1e-9; s += every) c.notes.push({ p, s: U.round(s, 5), d: U.round(Math.min(every, ST.res) * 0.95, 5), v: ST.vel });
    U.commit(label);
  };
  U.menu([
    { header: (ST.row + 1) + '번 줄 · ' + padName(ST.row) },
    { label: '4분음표마다 (네 박 킥)', action: () => fill(1, 0, '줄 채우기') },
    { label: '2·4박 (스네어·클랩)', action: () => fill(2, 1, '줄 채우기') },
    { label: '오프비트 (하우스 햇)', action: () => fill(1, 0.5, '줄 채우기') },
    { label: '8분음표마다', action: () => fill(0.5, 0, '줄 채우기') },
    { label: '16분음표마다', action: () => fill(0.25, 0, '줄 채우기') },
    { sep: true },
    { label: '이 줄 지우기', danger: true, action: () => fill(0, 0, '줄 지우기') }
  ], anchor);
}
function clearAll() {
  const c = cur.clip, [a, b] = region(c);
  c.notes = c.notes.filter(n => n.p < 36 || n.p > 51 || n.s < a - 1e-9 || n.s >= b - 1e-9);
  U.commit('스텝 모두 지우기');
}

/* 매 프레임: 재생 중인 칸 */
U.frame(() => {
  if (!cur || !cvGrid || !cvGrid.isConnected || cvGrid.offsetParent === null || !geo) return;
  const ph = U.clipView.playhead();
  const colNow = ph == null ? null : Math.floor((ph - geo.a) / ST.res + 1e-6);
  if (colNow !== lastCol) { lastCol = colNow; draw(); }
});

U.stepView = { build };
})(window.U = window.U || {});
