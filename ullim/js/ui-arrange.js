/* 울림 — 어레인지먼트 뷰: 눈금자, 루프 막대, 트랙 레인, 클립 옮기기·자르기·늘이기, 자동화 */
(function (U) {
'use strict';
const { h, ui, icon, info, clamp } = U;
const A = U.act;
const pr = () => U.project;
const HEAD_W = 196;
const EDGE = 6;

const view = ui.arr = { ppb: U.pref('arrPpb', 14), x0: 0, gridMul: 1, snap: true };
ui.arrSel = [];          // [{t, a}]
ui.timeSel = null;       // {b0, b1, tracks:[ids]}
ui.autoSel = {};         // trackId → 자동화 키

let root, rulerCv, bodyEl, lanesEl, playheadEl, scrollEl, scrollThumb, lanes = [];
let W = 600;

function build(el) {
  root = el;
  U.clear(root);
  rulerCv = h('canvas', { class: 'arr-ruler' });
  const zoomIn = U.btn({ icon: 'plus', cls: 'ghost sm', title: '확대 (+)', onclick: () => zoomAt(1.4, W / 2) });
  const zoomOut = U.btn({ text: '−', cls: 'ghost sm', title: '축소 (-)', onclick: () => zoomAt(1 / 1.4, W / 2) });
  const fit = U.btn({ icon: 'zoomfit', cls: 'ghost sm', title: '전체 보기', onclick: zoomFit });
  const snapB = U.btn({ text: '스냅', cls: 'tg sm', toggle: true, on: view.snap, info: ['격자에 맞추기', '클립을 옮기거나 늘일 때 격자에 붙여요. ' + U.MOD + '+4로도 바꿔요. 끄는 동안 Alt를 누르면 잠깐 반대로 동작해요.'], onclick: () => { view.snap = !view.snap; U.setPressed(snapB, view.snap); } });
  const top = h('div', { class: 'arr-top' }, h('div', { class: 'arr-ruler-wrap' }, rulerCv), h('div', { class: 'arr-tools' }, zoomOut, zoomIn, fit, snapB));
  info(rulerCv, '눈금자', '눌러서 재생 시작 위치를 정해요. 위쪽 띠의 루프 막대를 끌어 루프 구간을 옮기거나 양 끝을 늘여요. 휠로 앞뒤로, ' + U.MOD + '+휠로 확대해요.');
  bodyEl = h('div', { class: 'arr-body' });
  lanesEl = h('div', { class: 'arr-lanes' });
  playheadEl = h('div', { class: 'arr-playhead' });
  bodyEl.append(lanesEl, playheadEl);
  scrollThumb = h('div', { class: 'arr-thumb' });
  scrollEl = h('div', { class: 'arr-scroll' }, scrollThumb);
  root.append(top, bodyEl, scrollEl);
  bindRuler();
  bindScroll();
  root.addEventListener('pointerdown', () => { ui.focus = 'arrange'; });
  bodyEl.addEventListener('wheel', onWheel, { passive: false });
  rulerCv.addEventListener('wheel', onWheel, { passive: false });
  new ResizeObserver(() => { measure(); draw(); }).observe(bodyEl);
  render();
}

/* ================= 좌표 ================= */
const xOf = b => (b - view.x0) * view.ppb;
const bOf = x => view.x0 + x / view.ppb;
function gridStep() {
  const sig = pr().sig, bar = U.barLen(sig);
  const cands = [0.125, 0.25, 0.5, 1, 2, bar, bar * 2, bar * 4, bar * 8, bar * 16, bar * 32];
  const min = 13 / view.gridMul;
  for (const c of cands) if (c * view.ppb >= min) return c;
  return cands[cands.length - 1];
}
function snap(b, e, mode) {
  const on = view.snap !== !!(e && e.altKey);
  if (!on) return b;
  const g = gridStep();
  return mode === 'floor' ? Math.floor(b / g + 1e-6) * g : Math.round(b / g) * g;
}
function measure() {
  W = Math.max(100, bodyEl.clientWidth - HEAD_W);
}
function zoomAt(f, x) {
  const b = bOf(x);
  view.ppb = clamp(view.ppb * f, 1.5, 480);
  view.x0 = Math.max(0, b - x / view.ppb);
  U.setPref('arrPpb', view.ppb);
  draw();
}
function zoomFit() {
  const end = Math.max(U.arrangementEnd(pr()), U.barLen(pr().sig) * 8);
  view.ppb = clamp((W - 20) / end, 1.5, 480);
  view.x0 = 0;
  draw();
}
function onWheel(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const r = rulerCv.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left);
    return;
  }
  const dx = e.shiftKey ? e.deltaY : e.deltaX;
  if (Math.abs(dx) > 0 && (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) {
    e.preventDefault();
    view.x0 = Math.max(0, view.x0 + dx / view.ppb);
    draw();
  } else if (e.currentTarget === rulerCv) {
    e.preventDefault();
    view.x0 = Math.max(0, view.x0 + e.deltaY / view.ppb);
    draw();
  }
}

/* ================= 레인 만들기 ================= */
function render() {
  if (!lanesEl) return;
  const p = pr();
  const sy = bodyEl.scrollTop;
  U.clear(lanesEl);
  lanes = [];
  for (const t of p.tracks) lanesEl.append(lane(t, 58));
  const dz = h('div', { class: 'lane-drop' }, icon('plus'), h('span', { text: '여기에 놓으면 새 트랙' }));
  U.dropTarget(dz, {
    accept: d => ['sound', 'kit', 'loopkit', 'device', 'sample', 'tpl', 'clip'].includes(d.type),
    drop: (d, e) => dropOnNew(d, e)
  });
  dz.addEventListener('dblclick', () => A.addTrack('midi'));
  info(dz, '새 트랙', '악기·샘플·클립을 끌어다 놓으면 새 트랙이 생겨요. 두 번 누르면 MIDI 트랙이 생겨요.');
  lanesEl.append(dz);
  for (const t of p.returns) lanesEl.append(lane(t, 40));
  lanesEl.append(lane(p.master, 40));
  bodyEl.scrollTop = sy;
  measure();
  draw();
}
function lane(t, hgt) {
  const cv = h('canvas', { class: 'lane-cv' });
  const head = laneHead(t);
  const el = h('div', { class: 'lane' + (t.type === 'return' || t.type === 'master' ? ' small' : ''), style: { height: hgt + 'px', '--c': U.colorOf(t.color) }, dataset: { t: t.id } }, cv, head);
  const L = { t, el, cv, head, h: hgt };
  lanes.push(L);
  bindLane(L);
  U.dropTarget(cv, {
    accept: d => ['clip', 'tpl', 'sample', 'sound', 'kit', 'loopkit', 'device'].includes(d.type),
    over: (d, e) => { L.dropB = snap(bOf(e.clientX - cv.getBoundingClientRect().left), e, 'floor'); drawLane(L); },
    leave: () => { L.dropB = null; drawLane(L); },
    drop: (d, e) => {
      const b = snap(bOf(e.clientX - cv.getBoundingClientRect().left), e, 'floor');
      L.dropB = null;
      dropOnLane(t, d, b);
    }
  });
  return el;
}
function laneHead(t) {
  const p = pr();
  const el = h('div', { class: 'lane-head' + (ui.track === t.id ? ' sel' : '') });
  const name = h('div', { class: 'lh-name', text: U.trackLabel(p, t) });
  el.addEventListener('pointerdown', e => { if (e.target.closest('button, select, .num, input')) return; U.selectTrack(t.id, { device: true }); });
  name.addEventListener('dblclick', () => U.editInline(name, t.name || U.trackLabel(p, t), v => A.renameTrack(t.id, v)));
  el.addEventListener('contextmenu', e => { e.preventDefault(); U.sessionView.trackMenu(t, { x: e.clientX, y: e.clientY }); });
  const row1 = h('div', { class: 'lh-row' }, h('span', { class: 'lh-sw' }), name);
  const btns = h('div', { class: 'lh-btns' });
  if (t.type !== 'master') {
    const num = t.type === 'return' ? U.returnLetter(p, t) : String(p.tracks.indexOf(t) + 1);
    const act = h('button', { class: 'act sm', type: 'button', text: num, 'aria-pressed': t.on ? 'true' : 'false' });
    info(act, '트랙 켜기/끄기', '끄면 이 트랙 소리가 나지 않아요.');
    act.addEventListener('click', () => A.toggleTrackFlag(t.id, 'on'));
    const solo = h('button', { class: 'solo sm', type: 'button', text: 'S', 'aria-pressed': t.solo ? 'true' : 'false' });
    info(solo, '솔로', '이 트랙만 들어요.');
    solo.addEventListener('click', e => A.toggleTrackFlag(t.id, 'solo', !(e.ctrlKey || e.metaKey)));
    btns.append(act, solo);
    if (U.isPlayable(t)) {
      const arm = h('button', { class: 'arm sm', type: 'button', 'aria-pressed': t.arm ? 'true' : 'false', 'aria-label': '녹음 준비' }, icon('rec'));
      info(arm, '녹음 준비', '녹음 버튼을 누르면 이 트랙에 연주가 녹음돼요.');
      arm.addEventListener('click', e => A.toggleTrackFlag(t.id, 'arm', !(e.ctrlKey || e.metaKey)));
      btns.append(arm);
    }
  }
  row1.append(btns);
  el.append(row1);
  if (ui.auto) {
    el.append(autoChooser(t));
  } else {
    const vol = U.numBox({ cls: 'mini', label: '볼륨', get: () => t.vol, set: (v, f) => A.setMixer(t.id, 'vol', v, f), fmt: v => (v <= U.OFF_DB + 0.1 ? '-∞' : v.toFixed(1)) + ' dB', min: U.OFF_DB, max: 6, step: 0.1, def: 0, toN: v => U.dbToPos(v), fromN: n => U.round(U.posToDb(n), 1), range: 200 });
    info(vol, '볼륨', '끌어서 트랙 음량을 바꿔요.');
    const pan = U.numBox({ cls: 'mini', label: '팬', get: () => t.pan, set: (v, f) => A.setMixer(t.id, 'pan', v, f), fmt: v => U.fmtParam({ unit: 'pan' }, v), min: -1, max: 1, step: 0.01, def: 0, range: 200 });
    info(pan, '팬', '끌어서 좌우 위치를 바꿔요.');
    el.append(h('div', { class: 'lh-row' }, vol, pan));
  }
  return el;
}
/* 자동화할 값 고르기 */
function autoTargets(t) {
  const p = pr();
  const groups = [{ group: '믹서', items: [['vol', '볼륨'], ['pan', '팬']].concat(t.type === 'master' ? [] : p.returns.filter(r => r.id !== t.id).map(r => ['send:' + r.id, '센드 ' + U.returnLetter(p, r)])) }];
  for (const d of t.devices) {
    const spec = U.DEV[d.kind];
    if (!spec || !spec.params.length) continue;
    groups.push({ group: U.devName(d), items: spec.params.filter(s => s.type !== 'enum').map(s => ['dev:' + d.id + ':' + s.id, s.label + (s.type === 'bool' ? ' (켜기)' : '')]) });
  }
  return groups;
}
function autoKey(t) {
  if (ui.autoSel[t.id]) return ui.autoSel[t.id];
  const keys = Object.keys(t.auto);
  return keys[0] || 'vol';
}
function autoChooser(t) {
  const key = autoKey(t);
  const groups = autoTargets(t).map(g => ({ group: g.group, items: g.items.map(([k, l]) => [k, (t.auto[k] ? '● ' : '') + l]) }));
  const sel = U.select(groups, key, v => { ui.autoSel[t.id] = v; drawLanes(); }, { cls: 'auto-sel', label: '자동화할 값', info: ['자동화할 값', '이 레인에 그릴 값을 골라요. ●이 붙은 것은 이미 자동화가 있어요.'] });
  const clear = U.btn({ icon: 'close', cls: 'ghost sm', title: '이 자동화 지우기', onclick: () => A.setAuto(t.id, autoKey(t), null, true) });
  return h('div', { class: 'lh-row' }, sel, clear);
}
function autoSpec(t, key) {
  if (key === 'vol') return { label: '볼륨', fmt: v => U.fmtParam({ unit: 'dB' }, U.posToDb(v)), cur: () => U.dbToPos(t.vol) };
  if (key === 'pan') return { label: '팬', fmt: v => U.fmtParam({ unit: 'pan' }, v * 2 - 1), cur: () => (t.pan + 1) / 2 };
  if (key.startsWith('send:')) {
    const i = pr().returns.findIndex(r => 'send:' + r.id === key);
    return { label: '센드', fmt: v => U.fmtParam({ unit: 'dB' }, U.posToDb(v)), cur: () => U.dbToPos(t.sends[i] != null ? t.sends[i] : U.OFF_DB) };
  }
  const [, id, pid] = key.split(':');
  const d = t.devices.find(x => x.id === id);
  if (!d) return null;
  const s = U.DEV[d.kind].byId[pid];
  if (!s) return null;
  return { label: s.label, fmt: v => U.fmtParam(s, U.fromNorm(s, v)), cur: () => U.toNorm(s, d.p[pid]), step: s.type === 'bool' || s.step >= 1 };
}

/* ================= 그리기 ================= */
let drawPending = false;
function draw() {
  if (drawPending) return;
  drawPending = true;
  requestAnimationFrame(() => { drawPending = false; drawRuler(); drawLanes(); drawScroll(); });
}
function drawLanes() { for (const L of lanes) drawLane(L); }
function drawGrid(g, H, c) {
  const p = pr();
  const bar = U.barLen(p.sig);
  const step = gridStep();
  const b0 = Math.floor(view.x0 / step) * step, b1 = bOf(W);
  for (let b = b0; b <= b1; b += step) {
    const x = Math.round(xOf(b)) + 0.5;
    const isBar = Math.abs(b / bar - Math.round(b / bar)) < 1e-6;
    g.fillStyle = isBar ? c.grid2 : c.grid;
    g.fillRect(x, 0, 1, H);
  }
}
function drawRuler() {
  if (!rulerCv) return;
  const c = U.colors(), p = pr();
  const Hh = 34;
  const g = U.fitCanvas(rulerCv, W, Hh);
  g.fillStyle = c.panel2;
  g.fillRect(0, 0, W, Hh);
  // 루프 막대
  const L = p.loop;
  const lx0 = xOf(L.start), lx1 = xOf(L.end);
  g.fillStyle = L.on ? c.accent : c.fg3;
  g.globalAlpha = L.on ? 0.9 : 0.5;
  g.fillRect(lx0, 2, Math.max(2, lx1 - lx0), 9);
  g.globalAlpha = 1;
  // 시간 선택
  if (ui.timeSel) { g.fillStyle = c.sel; g.fillRect(xOf(ui.timeSel.b0), 12, xOf(ui.timeSel.b1) - xOf(ui.timeSel.b0), Hh - 12); }
  // 눈금
  const bar = U.barLen(p.sig);
  let every = 1;
  while (bar * every * view.ppb < 34) every *= 2;
  g.font = '11px ' + c.mono;
  g.textBaseline = 'top';
  const firstBar = Math.max(0, Math.floor(view.x0 / bar));
  for (let k = firstBar; k * bar <= bOf(W); k++) {
    const x = Math.round(xOf(k * bar)) + 0.5;
    const major = k % every === 0;
    g.fillStyle = major ? c.fg2 : c.fg3;
    g.fillRect(x, major ? 14 : 24, 1, major ? Hh - 14 : Hh - 24);
    if (major) { g.fillStyle = c.fg2; g.fillText(String(k + 1), x + 3, 15); }
    if (bar * view.ppb > 60) {
      for (let q = 1; q < p.sig[0]; q++) {
        const xq = Math.round(xOf(k * bar + q * U.beatUnit(p.sig))) + 0.5;
        g.fillStyle = c.fg3;
        g.fillRect(xq, 28, 1, Hh - 28);
      }
    }
  }
  // 시작 표시
  const sx = xOf(p.pos);
  g.fillStyle = c.fg;
  g.beginPath(); g.moveTo(sx - 5, Hh - 8); g.lineTo(sx + 5, Hh - 8); g.lineTo(sx, Hh - 1); g.closePath(); g.fill();
  g.fillStyle = c.line;
  g.fillRect(0, Hh - 1, W, 1);
}
function drawScroll() {
  if (!scrollEl) return;
  const end = Math.max(U.arrangementEnd(pr()) + U.barLen(pr().sig) * 8, bOf(W));
  const tw = scrollEl.clientWidth - HEAD_W;
  const vis = W / view.ppb;
  scrollThumb.style.width = Math.max(24, tw * vis / end) + 'px';
  scrollThumb.style.left = (tw * view.x0 / end) + 'px';
}
function drawLane(L) {
  const { t, cv } = L;
  const H = L.h;
  const c = U.colors(), p = pr();
  const g = U.fitCanvas(cv, W, H);
  g.fillStyle = c.sunk;
  g.fillRect(0, 0, W, H);
  // 루프 구간
  if (p.loop.on) { g.fillStyle = c.sel; g.globalAlpha = 0.35; g.fillRect(xOf(p.loop.start), 0, xOf(p.loop.end) - xOf(p.loop.start), H); g.globalAlpha = 1; }
  drawGrid(g, H, c);
  if (ui.timeSel && ui.timeSel.tracks.includes(t.id)) { g.fillStyle = c.sel; g.fillRect(xOf(ui.timeSel.b0), 0, xOf(ui.timeSel.b1) - xOf(ui.timeSel.b0), H); }
  const node = U.engine && U.engine.nodes.get(t.id);
  const dim = !!(node && node.override);
  for (const a of t.arr) {
    const x0 = xOf(a.pos), x1 = xOf(a.pos + a.dur);
    if (x1 < 0 || x0 > W) continue;
    const sel = ui.arrSel.some(s => s.a === a.id);
    drawClip(g, t, a, x0, x1, H, sel, dim, c);
  }
  if (L.dropB != null) { g.fillStyle = c.accent; g.fillRect(Math.round(xOf(L.dropB)), 0, 2, H); }
  if (ui.auto) drawAuto(g, L, c);
  g.fillStyle = c.line;
  g.fillRect(0, H - 1, W, 1);
}
function drawClip(g, t, a, x0, x1, H, sel, dim, c) {
  const col = U.colorOf(a.clip.color);
  const w = Math.max(2, x1 - x0);
  const top = 1, hh = H - 2, bar = Math.min(13, hh * 0.32);
  g.save();
  g.beginPath(); g.rect(x0, top, w, hh); g.clip();
  g.globalAlpha = dim ? 0.35 : 1;
  g.fillStyle = U.alpha(col, 0.42);
  g.fillRect(x0, top, w, hh);
  g.fillStyle = col;
  g.fillRect(x0, top, w, bar);
  g.fillStyle = 'rgba(0,0,0,0.78)';
  g.font = '600 10px ' + c.font;
  g.textBaseline = 'middle';
  if (w > 18) g.fillText(a.clip.name || (a.clip.type === 'audio' ? '오디오' : 'MIDI'), x0 + 4, top + bar / 2 + 0.5);
  const by = top + bar + 2, bh = hh - bar - 4;
  const scale = U.clipScale(a.clip, pr().bpm);
  const passes = U.clipPasses(a.clip, a.off, a.off + a.dur / scale);
  if (a.clip.type === 'midi') {
    const notes = a.clip.notes;
    if (notes.length && bh > 3) {
      let lo = 127, hi = 0;
      for (const n of notes) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }
      const range = Math.max(6, hi - lo + 1);
      const nh = Math.max(1.5, Math.min(4, bh / range));
      g.fillStyle = 'rgba(0,0,0,0.62)';
      for (const ps of passes) {
        const passX = xOf(a.pos + (ps.e0 - a.off) * scale);
        if (passX > W) break;
        for (const n of notes) {
          if (n.s < ps.p0 || n.s >= ps.p1) continue;
          const nx = passX + (n.s - ps.p0) * scale * view.ppb;
          const nw = Math.max(1.5, Math.min(n.d, ps.p1 - n.s) * scale * view.ppb - 1);
          const ny = by + (hi - n.p) / range * (bh - nh);
          g.fillRect(nx, ny, nw, nh);
        }
      }
    }
  } else drawWave(g, a, passes, x0, x1, by, bh, scale);
  // 루프 경계 표시
  if (passes.length > 1) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (const ps of passes.slice(1)) { const px = xOf(a.pos + (ps.e0 - a.off) * scale); g.fillRect(px, top, 1, hh); }
  }
  g.restore();
  g.strokeStyle = sel ? c.accent : U.shade(col, -0.35);
  g.lineWidth = sel ? 2 : 1;
  g.strokeRect(x0 + 0.5, top + 0.5, w - 1, hh - 1);
}
function drawWave(g, a, passes, x0, x1, by, bh, scale) {
  const sr = U.engine.ctx.sampleRate;
  const buf = U.media.cached(a.clip.ref, sr);
  if (!buf) {
    U.media.get(a.clip.ref, sr).catch(() => {});
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.font = '10px ' + U.colors().font;
    g.fillText('불러오는 중…', x0 + 4, by + bh / 2);
    return;
  }
  const N = 4096;
  const pk = U.media.peaks(a.clip.ref, buf, N);
  const spb = 60 / a.clip.bpm;
  const mid = by + bh / 2, amp = bh / 2;
  g.fillStyle = 'rgba(0,0,0,0.6)';
  const xs = Math.max(0, Math.floor(x0)), xe = Math.min(W, Math.ceil(x1));
  for (let x = xs; x < xe; x++) {
    const b = bOf(x);
    const el = (b - a.pos) / scale + a.off;
    const ps = passes.find(q => el >= q.e0 && el < q.e1);
    if (!ps) continue;
    let pos = ps.p0 + (el - ps.e0);
    let sec = pos * spb;
    if (a.clip.rev) sec = buf.duration - sec;
    const i = Math.floor(sec / buf.duration * N);
    if (i < 0 || i >= N) continue;
    const per = Math.max(1, Math.round(N / buf.duration * spb / view.ppb / scale));
    let lo = 0, hi = 0;
    for (let k = i; k < Math.min(N, i + per); k++) { lo = Math.min(lo, pk[k * 2]); hi = Math.max(hi, pk[k * 2 + 1]); }
    const gain = U.dbToGain(a.clip.gain || 0);
    g.fillRect(x, mid - hi * amp * gain, 1, Math.max(1, (hi - lo) * amp * gain));
  }
}
function drawAuto(g, L, c) {
  const t = L.t, key = autoKey(t);
  const spec = autoSpec(t, key);
  if (!spec) return;
  const H = L.h, pad = 4;
  const yOf = v => pad + (1 - v) * (H - pad * 2 - 1);
  const pts = t.auto[key];
  g.strokeStyle = c.auto;
  g.fillStyle = c.auto;
  g.lineWidth = 1.5;
  if (!pts || !pts.length) {
    g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(0, yOf(spec.cur())); g.lineTo(W, yOf(spec.cur())); g.stroke();
    g.setLineDash([]);
    return;
  }
  g.beginPath();
  g.moveTo(0, yOf(pts[0].v));
  for (const q of pts) g.lineTo(xOf(q.t), yOf(q.v));
  g.lineTo(W, yOf(pts[pts.length - 1].v));
  g.stroke();
  for (const q of pts) {
    const x = xOf(q.t);
    if (x < -4 || x > W + 4) continue;
    g.beginPath(); g.arc(x, yOf(q.v), q === L.hot ? 4.5 : 3, 0, Math.PI * 2); g.fill();
  }
  if (L.hot && L.hotLabel) {
    g.font = '10px ' + c.mono;
    g.fillStyle = c.fg;
    g.fillText(L.hotLabel, Math.min(W - 70, xOf(L.hot.t) + 6), Math.max(10, yOf(L.hot.v) - 6));
  }
}

/* ================= 눈금자 조작 ================= */
function bindRuler() {
  rulerCv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const r = rulerCv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const p = pr(), L = p.loop;
    const lx0 = xOf(L.start), lx1 = xOf(L.end);
    rulerCv.setPointerCapture(e.pointerId);
    let mode = null;
    if (y < 13 && x >= lx0 - 5 && x <= lx1 + 5) {
      mode = Math.abs(x - lx0) < 6 ? 'ls' : Math.abs(x - lx1) < 6 ? 'le' : 'lmove';
    } else if (y < 13) mode = 'lnew';
    else mode = 'pos';
    const b0 = bOf(x), s0 = L.start, e0 = L.end;
    const apply = ev => {
      const b = bOf(ev.clientX - r.left);
      if (mode === 'pos') { U.transportBar.setPos(snap(b, ev)); draw(); return; }
      if (mode === 'lmove') { const d = snap(s0 + (b - b0), ev) - s0; L.start = Math.max(0, s0 + d); L.end = L.start + (e0 - s0); }
      else if (mode === 'ls') L.start = clamp(snap(b, ev), 0, L.end - 0.25);
      else if (mode === 'le') L.end = Math.max(L.start + 0.25, snap(b, ev));
      else if (mode === 'lnew') { const a = snap(b0, ev, 'floor'), c2 = snap(b, ev); L.start = Math.max(0, Math.min(a, c2)); L.end = Math.max(L.start + gridStep(), Math.max(a, c2)); }
      U.touch({ loop: true });
      draw();
      U.inval('transport');
    };
    apply(e);
    const move = ev => apply(ev);
    const up = () => {
      rulerCv.removeEventListener('pointermove', move);
      rulerCv.removeEventListener('pointerup', up);
      if (mode !== 'pos') { if (mode === 'lnew') L.on = true; U.commit('루프 구간'); }
    };
    rulerCv.addEventListener('pointermove', move);
    rulerCv.addEventListener('pointerup', up);
  });
  rulerCv.addEventListener('pointermove', e => {
    const r = rulerCv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top, L = pr().loop;
    const near = y < 13 && (Math.abs(x - xOf(L.start)) < 6 || Math.abs(x - xOf(L.end)) < 6);
    rulerCv.style.cursor = near ? 'ew-resize' : y < 13 ? 'grab' : 'text';
  });
}
function bindScroll() {
  scrollThumb.addEventListener('pointerdown', e => {
    e.preventDefault();
    scrollThumb.setPointerCapture(e.pointerId);
    const x0 = e.clientX, v0 = view.x0;
    const end = Math.max(U.arrangementEnd(pr()) + U.barLen(pr().sig) * 8, bOf(W));
    const tw = scrollEl.clientWidth - HEAD_W;
    const move = ev => { view.x0 = Math.max(0, v0 + (ev.clientX - x0) / tw * end); draw(); };
    const up = () => { scrollThumb.removeEventListener('pointermove', move); scrollThumb.removeEventListener('pointerup', up); };
    scrollThumb.addEventListener('pointermove', move);
    scrollThumb.addEventListener('pointerup', up);
  });
}

/* ================= 레인 조작 ================= */
function hitClip(t, x) {
  const b = bOf(x);
  for (let i = t.arr.length - 1; i >= 0; i--) {
    const a = t.arr[i];
    const x0 = xOf(a.pos), x1 = xOf(a.pos + a.dur);
    if (x >= x0 - 1 && x <= x1 + 1) {
      const zone = x - x0 < EDGE && x1 - x0 > EDGE * 3 ? 'l' : x1 - x < EDGE && x1 - x0 > EDGE * 2 ? 'r' : 'body';
      return { a, zone, b };
    }
  }
  return null;
}
function laneAt(clientY) {
  for (const L of lanes) {
    const r = L.el.getBoundingClientRect();
    if (clientY >= r.top && clientY < r.bottom) return L;
  }
  return null;
}
function bindLane(L) {
  const { cv, t } = L;
  cv.addEventListener('pointermove', e => {
    if (e.buttons) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (ui.auto) { cv.style.cursor = 'crosshair'; return; }
    const hit = hitClip(t, x);
    cv.style.cursor = hit ? (hit.zone === 'body' ? 'grab' : 'ew-resize') : 'text';
  });
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    ui.focus = 'arrange';
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (ui.auto) { autoDown(L, e, x, y); return; }
    const hit = hitClip(t, x);
    if (U.ui.track !== t.id) { ui.track = t.id; U.emit('select', { track: t.id }); U.inval('detail', 'status'); }
    if (hit) clipDown(L, e, hit, r);
    else emptyDown(L, e, x, r);
  });
  cv.addEventListener('dblclick', e => {
    if (ui.auto) return;
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const hit = hitClip(t, x);
    if (hit) { U.showClip({ t: t.id, a: hit.a.id }); return; }
    if (t.type === 'midi') {
      const bar = U.barLen(pr().sig);
      const b = Math.floor(bOf(x) / bar) * bar;
      const c = U.newMidiClip(bar, { color: t.color });
      const a = A.addArrClip(t.id, b, c, bar, '새 MIDI 클립');
      if (a) { ui.arrSel = [{ t: t.id, a: a.id }]; U.showClip({ t: t.id, a: a.id }); }
    }
  });
  cv.addEventListener('contextmenu', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (ui.auto) return;
    const hit = hitClip(t, x);
    if (hit) {
      if (!ui.arrSel.some(s => s.a === hit.a.id)) { ui.arrSel = [{ t: t.id, a: hit.a.id }]; U.showClip({ t: t.id, a: hit.a.id }, false); drawLanes(); }
      clipMenu(t, hit.a, bOf(x), { x: e.clientX, y: e.clientY });
    } else {
      const b = snap(bOf(x), e, 'floor');
      U.menu([
        t.type === 'midi' ? { label: '빈 MIDI 클립 넣기', action: () => { const bar = U.barLen(pr().sig); A.addArrClip(t.id, b, U.newMidiClip(bar, { color: t.color }), bar, '새 MIDI 클립'); } } : null,
        t.type === 'audio' ? { label: '오디오 파일 가져와 넣기…', action: () => U.importAudioTo(t.id, null, b) } : null,
        { label: '여기서 재생 시작', action: () => U.transportBar.setPos(b) }
      ], { x: e.clientX, y: e.clientY });
    }
  });
}
function selected() {
  const out = [];
  for (const s of ui.arrSel) {
    const t = U.trackById(pr(), s.t);
    const a = t && t.arr.find(x => x.id === s.a);
    if (a) out.push({ t, a });
  }
  return out;
}
function clipDown(L, e, hit, r) {
  const { t } = L;
  const id = hit.a.id;
  const already = ui.arrSel.some(s => s.a === id);
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    if (already) ui.arrSel = ui.arrSel.filter(s => s.a !== id);
    else ui.arrSel.push({ t: t.id, a: id });
  } else if (!already) ui.arrSel = [{ t: t.id, a: id }];
  U.showClip({ t: t.id, a: id }, false);
  ui.timeSel = null;
  drawLanes(); drawRuler();
  const sel = selected();
  const orig = sel.map(s => ({ s, pos: s.a.pos, dur: s.a.dur, off: s.a.off, track: s.t }));
  const b0 = bOf(e.clientX - r.left);
  const zone = hit.zone;
  const copy = e.altKey;
  let moved = false, copies = null;
  cv(L).setPointerCapture(e.pointerId);
  const scaleOf = a => U.clipScale(a.clip, pr().bpm);
  const move = ev => {
    const b = bOf(ev.clientX - r.left);
    let d = b - b0;
    if (!moved && Math.abs(d * view.ppb) < 3) return;
    moved = true;
    if (zone === 'body') {
      if (copy && !copies) {
        copies = orig.map(o => { const n = { id: U.uid('a'), pos: o.pos, dur: o.dur, off: o.off, clip: U.cloneClip(o.s.a.clip) }; o.track.arr.push(n); return n; });
      }
      const lead = orig.find(o => o.s.a.id === id) || orig[0];
      const np = snap(lead.pos + d, ev);
      d = np - lead.pos;
      d = Math.max(d, -Math.min(...orig.map(o => o.pos)));
      // 다른 레인으로 옮기기 (한 개만 고른 경우)
      const target = laneAt(ev.clientY);
      orig.forEach(o => { o.s.a.pos = o.pos + d; });
      if (orig.length === 1 && target && target.t !== orig[0].track && target.t.type === orig[0].track.type) {
        const o = orig[0];
        o.track.arr = o.track.arr.filter(x => x !== o.s.a);
        target.t.arr.push(o.s.a);
        o.track = target.t;
        ui.arrSel = [{ t: target.t.id, a: o.s.a.id }];
        if (ui.clip && ui.clip.a === o.s.a.id) ui.clip.t = target.t.id;
      }
    } else if (zone === 'r') {
      for (const o of orig) {
        const end = Math.max(o.pos + gridStep() * 0.25, snap(o.pos + o.dur + d, ev));
        let dur = end - o.pos;
        if (!o.s.a.clip.loop.on) dur = Math.min(dur, (U.clipSpan(o.s.a.clip) - o.off) * scaleOf(o.s.a));
        o.s.a.dur = Math.max(0.0625, dur);
      }
    } else if (zone === 'l') {
      for (const o of orig) {
        const sc = scaleOf(o.s.a);
        let np = snap(o.pos + d, ev);
        np = Math.min(np, o.pos + o.dur - 0.0625);
        let off = o.off + (np - o.pos) / sc;
        if (off < 0) { np = o.pos - o.off * sc; off = 0; }
        o.s.a.pos = Math.max(0, np);
        o.s.a.off = off;
        o.s.a.dur = o.pos + o.dur - o.s.a.pos;
      }
    }
    U.touch({ arr: true });
    drawLanes();
  };
  const up = () => {
    cv(L).removeEventListener('pointermove', move);
    cv(L).removeEventListener('pointerup', up);
    if (moved) {
      if (copies) ui.arrSel = orig.map(o => ({ t: o.track.id, a: o.s.a.id }));
      U.commit(zone === 'body' ? (copies ? '클립 복사' : '클립 옮기기') : '클립 길이');
    } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      ui.arrSel = [{ t: t.id, a: id }];
      drawLanes();
    }
  };
  cv(L).addEventListener('pointermove', move);
  cv(L).addEventListener('pointerup', up);
}
const cv = L => L.cv;
function emptyDown(L, e, x, r) {
  ui.arrSel = [];
  const b0 = snap(bOf(x), e, 'floor');
  U.transportBar.setPos(b0);
  ui.timeSel = null;
  const startLane = L;
  let moved = false;
  L.cv.setPointerCapture(e.pointerId);
  const move = ev => {
    const b = snap(bOf(ev.clientX - r.left), ev);
    if (!moved && Math.abs(b - b0) * view.ppb < 4) return;
    moved = true;
    const other = laneAt(ev.clientY) || startLane;
    const i0 = lanes.indexOf(startLane), i1 = lanes.indexOf(other);
    const tracks = lanes.slice(Math.min(i0, i1), Math.max(i0, i1) + 1).map(l => l.t.id);
    ui.timeSel = { b0: Math.min(b0, b), b1: Math.max(b0, b), tracks };
    drawLanes(); drawRuler();
  };
  const up = () => {
    L.cv.removeEventListener('pointermove', move);
    L.cv.removeEventListener('pointerup', up);
    if (!moved) { ui.timeSel = null; }
    drawLanes(); drawRuler();
    U.inval('transport');
  };
  L.cv.addEventListener('pointermove', move);
  L.cv.addEventListener('pointerup', up);
}
/* ---------- 자동화 편집 ---------- */
function autoDown(L, e, x, y) {
  const t = L.t, key = autoKey(t), spec = autoSpec(t, key);
  if (!spec) return;
  const H = L.h, pad = 4;
  const vOf = yy => clamp(1 - (yy - pad) / (H - pad * 2 - 1), 0, 1);
  const yOf = v => pad + (1 - v) * (H - pad * 2 - 1);
  let pts = (t.auto[key] || []).map(q => ({ t: q.t, v: q.v }));
  const near = pts.find(q => Math.abs(xOf(q.t) - x) < 6 && Math.abs(yOf(q.v) - y) < 8);
  const r = L.cv.getBoundingClientRect();
  if (e.detail === 2 && near) {
    pts = pts.filter(q => q !== near);
    A.setAuto(t.id, key, pts, true);
    return;
  }
  let hot = near;
  if (!hot) {
    if (!pts.length) pts.push({ t: 0, v: spec.cur() });
    hot = { t: Math.max(0, snap(bOf(x), e)), v: vOf(y) };
    if (spec.step) hot.v = Math.round(hot.v);
    pts.push(hot);
    pts.sort((a, b) => a.t - b.t);
  }
  L.cv.setPointerCapture(e.pointerId);
  const drawing = ui.draw;
  const move = ev => {
    const bx = Math.max(0, snap(bOf(ev.clientX - r.left), ev));
    let v = vOf(ev.clientY - r.top);
    if (spec.step) v = Math.round(v);
    if (drawing) {
      // 그리기 모드: 지나가는 격자마다 점을 찍는다
      const g = gridStep();
      const gb = Math.round(bx / g) * g;
      pts = pts.filter(q => Math.abs(q.t - gb) > g * 0.49 || q === hot);
      if (Math.abs(hot.t - gb) > 1e-6) { hot = { t: gb, v }; pts.push(hot); }
      hot.v = v;
    } else {
      const i = pts.indexOf(hot);
      const lo = i > 0 ? pts[i - 1].t : 0, hi = i < pts.length - 1 ? pts[i + 1].t : Infinity;
      hot.t = clamp(bx, lo, hi);
      hot.v = v;
    }
    pts.sort((a, b) => a.t - b.t);
    L.hot = hot;
    L.hotLabel = spec.fmt(hot.v);
    A.setAuto(t.id, key, pts.map(q => ({ t: U.round(q.t, 4), v: U.round(q.v, 4) })), false);
    drawLane(L);
  };
  const up = () => {
    L.cv.removeEventListener('pointermove', move);
    L.cv.removeEventListener('pointerup', up);
    L.hot = null;
    A.setAuto(t.id, key, pts.map(q => ({ t: U.round(q.t, 4), v: U.round(q.v, 4) })), true);
  };
  L.hot = hot;
  L.hotLabel = spec.fmt(hot.v);
  A.setAuto(t.id, key, pts.map(q => ({ t: U.round(q.t, 4), v: U.round(q.v, 4) })), false);
  drawLane(L);
  L.cv.addEventListener('pointermove', move);
  L.cv.addEventListener('pointerup', up);
}

/* ================= 놓기 ================= */
function dropOnLane(t, d, b) {
  if (d.type === 'clip') { A.sessionToArr(d.from, t.id, b); return; }
  if (d.type === 'tpl') {
    if (t.type !== 'midi') { U.toast('MIDI 클립은 MIDI 트랙에 놓아요.'); return; }
    const made = d.item.make(pr().key);
    A.addArrClip(t.id, b, U.newMidiClip(made.len, { name: d.item.name, color: t.color, notes: made.notes }), null, d.item.name);
    return;
  }
  if (d.type === 'sample') {
    if (t.type !== 'audio') { U.toast('오디오는 오디오 트랙에 놓아요.'); return; }
    insertAudioArr(t.id, d.ref, b);
    return;
  }
  if (d.type === 'sound') A.loadSound(t.id, d.item);
  else if (d.type === 'kit') A.loadKit(t.id, d.item);
  else if (d.type === 'loopkit') A.loadLoopKit(t.id, d.item);
  else if (d.type === 'device') A.addDevice(t.id, d.kind, { preset: d.preset, presetName: d.presetName });
}
async function insertAudioArr(trackId, ref, b) {
  try { await U.media.get(ref, U.engine.ctx.sampleRate); } catch (e) { U.toast('오디오를 불러오지 못했어요.', 'error'); return; }
  const t = U.trackById(pr(), trackId);
  const c = U.newAudioClip(ref, U.media.info(ref), { color: t.color });
  A.addArrClip(trackId, b, c, null, '오디오 클립');
}
function dropOnNew(d) {
  const end = pr().tracks.length;
  if (d.type === 'sample') { const t = A.addTrack('audio', end); insertAudioArr(t.id, d.ref, pr().pos); return; }
  if (d.type === 'tpl') { const t = A.addTrack('midi', end); dropOnLane(t, d, pr().pos); return; }
  if (d.type === 'clip') {
    const c = U.clipRef(d.from);
    if (!c) return;
    const t = A.addTrack(c.clip.type === 'audio' ? 'audio' : 'midi', end);
    A.sessionToArr(d.from, t.id, pr().pos);
    return;
  }
  if (d.type === 'sound') A.loadSound(A.addTrack('midi', end).id, d.item);
  else if (d.type === 'kit') A.loadKit(A.addTrack('midi', end).id, d.item);
  else if (d.type === 'loopkit') A.loadLoopKit(A.addTrack('midi', end).id, d.item);
  else if (d.type === 'device') { const ty = U.DEV[d.kind].type; const t = A.addTrack(ty === 'audio' ? 'audio' : 'midi', end); A.addDevice(t.id, d.kind, { preset: d.preset, presetName: d.presetName }); }
}

/* ================= 메뉴 ================= */
function clipMenu(t, a, at, pos) {
  const sel = ui.arrSel.length ? ui.arrSel : [{ t: t.id, a: a.id }];
  U.menu([
    { label: '클립 뷰에서 열기', action: () => U.showClip({ t: t.id, a: a.id }) },
    { label: '이름 바꾸기', action: () => U.ask('클립 이름', '이름', a.clip.name).then(v => { if (v != null) A.clipProp({ t: t.id, a: a.id }, c => { c.name = v; }, '클립 이름'); }) },
    { label: '색', sub: U.colorMenu(a.clip.color, ci => { for (const s of sel) A.clipProp(s, c => { c.color = ci; }, '클립 색'); }) },
    { label: '루프', checked: a.clip.loop.on, action: () => A.clipProp({ t: t.id, a: a.id }, c => { c.loop.on = !c.loop.on; if (!c.loop.on) c.end = Math.max(c.end, c.loop.end); }, '클립 루프') },
    { sep: true },
    { label: '여기서 나누기', key: U.MOD + '+E', action: () => A.split(t.id, a.id, snap(at)) },
    { label: '복제', key: U.MOD + '+D', action: () => { ui.arrSel = A.duplicateArr(sel); drawLanes(); } },
    { label: '합치기', key: U.MOD + '+J', disabled: t.type !== 'midi', action: () => { ui.arrSel = A.consolidate(sel); drawLanes(); } },
    { label: '루프 구간으로', key: U.MOD + '+L', action: () => loopSelection() },
    { sep: true },
    { label: '지우기', key: 'Del', danger: true, action: () => { A.deleteArrClips(sel); ui.arrSel = []; } }
  ], pos);
}
function loopSelection() {
  const p = pr();
  if (ui.timeSel) { p.loop = { on: true, start: ui.timeSel.b0, end: ui.timeSel.b1 }; U.commit('루프 구간'); return; }
  const sel = selected();
  if (!sel.length) return;
  p.loop = { on: true, start: Math.min(...sel.map(s => s.a.pos)), end: Math.max(...sel.map(s => s.a.pos + s.a.dur)) };
  U.commit('루프 구간');
}

/* ================= 재생 위치 (매 프레임) ================= */
U.frame(() => {
  if (!root || root.offsetParent === null || !U.engine) return;
  const e = U.engine;
  const b = e.playing ? e.arrPos(e.heardBeat()) : pr().pos;
  const x = xOf(b);
  if (e.playing && ui.follow && (x > W * 0.92 || x < 0)) { view.x0 = Math.max(0, b - (W * 0.08) / view.ppb); draw(); }
  const vis = x >= 0 && x <= W;
  playheadEl.style.display = vis ? 'block' : 'none';
  if (vis) playheadEl.style.transform = 'translateX(' + Math.round(x) + 'px)';
  playheadEl.classList.toggle('playing', e.playing);
  if (e.playing && ui.auto) { /* 자동화 점은 그대로 */ }
});

/* 편집 동작 (단축키에서 부른다) */
function del() {
  if (ui.timeSel && !ui.arrSel.length) return false;
  if (!ui.arrSel.length) return false;
  A.deleteArrClips(ui.arrSel);
  ui.arrSel = [];
  return true;
}
function dup() {
  if (!ui.arrSel.length) return false;
  ui.arrSel = A.duplicateArr(ui.arrSel);
  drawLanes();
  return true;
}
function splitAtCursor() {
  const sel = selected();
  const b = pr().pos;
  let did = false;
  for (const s of (sel.length ? sel : U.project.tracks.flatMap(t => t.arr.filter(a => a.pos < b && a.pos + a.dur > b).map(a => ({ t, a }))))) {
    if (b > s.a.pos && b < s.a.pos + s.a.dur) { A.split(s.t.id, s.a.id, b); did = true; }
  }
  return did;
}
function selectAll() {
  ui.arrSel = pr().tracks.flatMap(t => t.arr.map(a => ({ t: t.id, a: a.id })));
  drawLanes();
}

U.on('select', () => { if (lanesEl) { for (const L of lanes) L.head.classList.toggle('sel', L.t.id === ui.track); drawLanes(); } });
U.on('media', () => draw());
U.on('engine:override', () => drawLanes());
U.renderer('arrange', render);
U.renderer('arrange-draw', draw);
U.arrangeView = { build, render, draw, del, dup, splitAtCursor, selectAll, loopSelection, zoomAt, zoomFit, get width() { return W; } };
})(window.U = window.U || {});
