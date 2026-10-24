/* 울림 — 오디오 편집: 파형에서 구간을 골라 자르기·복사·붙여넣기·지우기·무음·선택만 남기기,
   페이드 인/아웃·볼륨·노멀라이즈·거꾸로를 하고 새 오디오로 저장한다.
   원래 오디오는 그대로 남아서, 저장한 뒤에도 되돌리기(Ctrl+Z)로 돌아갈 수 있다 */
(function (U) {
'use strict';
const { h, btn, info, clamp } = U;

const BLOCK = 256;            // 멀리서 볼 때 쓰는 봉우리 요약 한 칸의 샘플 수
const UNDO_BYTES = 160e6;     // 되돌리기에 쓰는 메모리 상한
let clipboard = null;         // 창을 닫아도 남는다 (다른 오디오에 붙여넣기)

/* 열기: o = { ref, title, name, bpm, region:[0~1, 0~1] (패드 조각처럼 일부만), save: async (newRef, info) => {} } */
function open(o) {
  const sr = U.engine.ctx.sampleRate;
  U.ensureAudio();
  return U.media.get(o.ref, sr).then(buf => build(o, buf), err => U.toast(err && err.missing ? '이 브라우저에 오디오 파일이 없어요. 같은 파일을 다시 가져와 주세요.' : '오디오를 불러오지 못했어요.', 'error'));
}

function build(o, buf) {
  const sr = buf.sampleRate;
  let a0 = 0, a1 = buf.length;
  if (o.region) {
    a0 = Math.floor(clamp(Math.min(o.region[0], o.region[1]), 0, 1) * buf.length);
    a1 = Math.ceil(clamp(Math.max(o.region[0], o.region[1]), 0, 1) * buf.length);
    if (a1 - a0 < 64) { a0 = 0; a1 = buf.length; }
  }
  const E = {
    chs: Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, c) => buf.getChannelData(c).slice(a0, a1)),
    sel: null, cur: 0, s0: 0, spp: 1, undo: [], redo: [], dirty: false, pyr: null,
    play: null
  };
  const len = () => E.chs[0].length;

  /* ---------- 화면 ---------- */
  const cv = h('canvas', { class: 'ae-cv', 'data-nolongpress': '' });
  const wrap = h('div', { class: 'ae-wave' }, cv);
  const time = h('span', { class: 'ae-time' });
  const playB = btn({ icon: 'play', text: '재생', cls: 'sm', title: '재생 / 정지 (Space)', onclick: () => togglePlay() });
  const tb = (text, tip, fn, cls) => btn({ text, cls: 'sm' + (cls ? ' ' + cls : ''), info: [text, tip], onclick: fn });
  const needSel = [];
  const ed = (text, tip, fn, sel) => { const b = tb(text, tip, fn); if (sel) needSel.push(b); return b; };
  const undoB = tb('↶ 되돌리기', '방금 한 편집을 되돌려요. ' + U.MOD + '+Z', () => undo());
  const redoB = tb('↷ 다시 실행', '되돌린 편집을 다시 해요. ' + U.MOD + '+Shift+Z', () => redo());
  const pasteB = ed('붙여넣기', '복사하거나 잘라낸 소리를 커서 자리(구간을 골랐으면 그 자리)에 넣어요. ' + U.MOD + '+V', () => paste());
  const top = h('div', { class: 'ae-top' }, playB,
    tb('전체 선택', '오디오 전체를 골라요. ' + U.MOD + '+A', () => { E.sel = [0, len()]; draw(); }),
    h('span', { class: 'pv-sep' }),
    btn({ icon: 'plus', cls: 'sm', title: '확대', onclick: () => zoomAt(2, wrap.clientWidth / 2) }),
    btn({ text: '−', cls: 'sm', title: '축소', onclick: () => zoomAt(0.5, wrap.clientWidth / 2) }),
    btn({ icon: 'zoomfit', cls: 'sm', title: '전체 보기', onclick: () => { fit(); draw(); } }),
    h('span', { class: 'cb-flex' }), time);
  const edits = h('div', { class: 'ae-tools' }, h('span', { class: 'ae-tl', text: '편집' }),
    ed('잘라내기', '고른 구간을 오려 내요. 뒤의 소리가 앞으로 당겨져요. ' + U.MOD + '+X', () => cut(), true),
    ed('복사', '고른 구간을 복사해요. ' + U.MOD + '+C', () => copy(), true),
    pasteB,
    ed('지우기', '고른 구간을 지우고 뒤의 소리를 앞으로 당겨요. Delete', () => del(), true),
    ed('무음', '고른 구간을 조용하게 만들어요. 길이는 그대로예요.', () => silence(), true),
    ed('선택만 남기기', '고른 구간만 남기고 나머지를 버려요.', () => crop(), true));
  const shapes = h('div', { class: 'ae-tools' }, h('span', { class: 'ae-tl', text: '다듬기' }),
    ed('페이드 인', '고른 구간에서 소리가 0부터 서서히 커져요.', () => fade(true), true),
    ed('페이드 아웃', '고른 구간에서 소리가 서서히 0으로 줄어요.', () => fade(false), true),
    ed('소리 작게', '고른 구간(없으면 전체)을 3 dB 줄여요.', () => gain(-3)),
    ed('소리 크게', '고른 구간(없으면 전체)을 3 dB 키워요.', () => gain(3)),
    ed('노멀라이즈', '가장 큰 소리가 -0.3 dB가 되게 맞춰요. 구간을 골랐으면 그 구간만.', () => normalize()),
    ed('거꾸로', '고른 구간(없으면 전체)을 뒤에서부터 재생되게 뒤집어요.', () => reverse()));
  const hist = h('div', { class: 'ae-tools' }, undoB, redoB, h('span', { class: 'hint ae-hint', text: U.isTouch ? '끌어서 구간을 고르고, 탭하면 커서를 놓아요. 두 손가락으로 밀고 벌려요.' : '끌어서 구간을 고르고, 누르면 커서를 놓아요. ' + U.MOD + '+휠로 확대해요.' }));
  const body = h('div', { class: 'ae' }, top, wrap, edits, shapes, hist);

  let dlg = null;
  const save = async b => {
    stopPlay();
    if (!E.dirty) return;
    b.disabled = true;
    b.textContent = '저장하는 중…';
    try {
      const out = new AudioBuffer({ length: len(), numberOfChannels: E.chs.length, sampleRate: sr });
      E.chs.forEach((c, i) => out.copyToChannel(c, i));
      const base = String(o.name || '오디오').replace(/ \(편집\)$/, '');
      const ref = await U.media.addBuffer(out, base + ' (편집)', o.bpm || 120);
      await o.save(ref, { duration: out.duration, buffer: out, name: base + ' (편집)' });
      E.dirty = false;
      U.toast('편집한 오디오를 저장했어요. 되돌리기로 원래 소리로 돌아갈 수 있어요.');
    } catch (e) {
      console.error(e);
      U.toast('저장하지 못했어요: ' + (e.message || e), 'error');
      b.disabled = false;
      b.textContent = '저장';
      return false;
    }
  };
  dlg = U.dialog({
    title: '오디오 편집 · ' + (o.title || o.name || '오디오'), body, width: '900px',
    actions: [{ label: '취소' }, { label: '저장', primary: true, action: save }],
    canClose: () => {
      if (!E.dirty) return true;
      U.confirm('편집 버리기', '저장하지 않은 편집이 있어요. 버리고 닫을까요?', '버리고 닫기', true).then(ok => { if (ok) { E.dirty = false; dlg.close(true); } });
      return false;
    },
    onclose: () => { stopPlay(); document.removeEventListener('keydown', onKey, true); ro.disconnect(); }
  });

  /* ---------- 위치 계산 ---------- */
  const W = () => Math.max(50, wrap.clientWidth);
  const xOf = s => (s - E.s0) / E.spp;
  const sOf = x => clamp(Math.round(E.s0 + x * E.spp), 0, len());
  function fit() { E.spp = Math.max(len() / W(), 0.02); E.s0 = 0; }
  function clampView() {
    E.spp = clamp(E.spp, 0.02, Math.max(1, len() / W()));
    E.s0 = clamp(E.s0, 0, Math.max(0, len() - W() * E.spp));
  }
  function zoomAt(f, x) {
    const s = E.s0 + x * E.spp;
    E.spp /= f;
    clampView();
    E.s0 = s - x * E.spp;
    clampView();
    draw();
  }
  const fmt = s => { const t = s / sr, m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(3).padStart(6, '0'); };

  /* ---------- 봉우리 요약 (멀리서 볼 때 빠르게 그리기) ---------- */
  function summarize() {
    const n = Math.ceil(len() / BLOCK), p = new Float32Array(n * 2);
    for (let b = 0; b < n; b++) {
      let lo = 0, hi = 0;
      const e = Math.min(len(), (b + 1) * BLOCK);
      for (const c of E.chs) for (let i = b * BLOCK; i < e; i++) { const v = c[i]; if (v < lo) lo = v; else if (v > hi) hi = v; }
      p[b * 2] = lo; p[b * 2 + 1] = hi;
    }
    E.pyr = p;
  }
  function range(s, e) {
    let lo = 0, hi = 0;
    if (e - s >= BLOCK * 2) {
      const p = E.pyr;
      for (let b = Math.floor(s / BLOCK), z = Math.min(p.length / 2, Math.ceil(e / BLOCK)); b < z; b++) { if (p[b * 2] < lo) lo = p[b * 2]; if (p[b * 2 + 1] > hi) hi = p[b * 2 + 1]; }
    } else {
      for (const c of E.chs) for (let i = Math.max(0, s), z = Math.min(len(), Math.max(e, s + 1)); i < z; i++) { const v = c[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    return [lo, hi];
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    if (!cv.isConnected) return;
    const w = W(), hh = Math.max(80, wrap.clientHeight);
    const g = U.fitCanvas(cv, w, hh);
    const col = U.colors();
    g.fillStyle = col.sunk;
    g.fillRect(0, 0, w, hh);
    const rt = 18, mid = rt + (hh - rt) / 2, amp = (hh - rt) / 2 - 4;
    // 시간 눈금
    const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
    const step = steps.find(st => st * sr / E.spp >= 70) || 300;
    g.font = '10px ' + col.mono;
    const first = Math.ceil(E.s0 / sr / step) * step;
    for (let t = first; t * sr <= E.s0 + w * E.spp; t += step) {
      const x = Math.round(xOf(t * sr)) + 0.5;
      g.fillStyle = col.grid2;
      g.fillRect(x, rt, 1, hh - rt);
      g.fillStyle = col.fg3;
      g.fillText(step < 1 ? t.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 1) + 's' : fmt(t * sr).replace(/\.\d+$/, ''), x + 3, 12);
    }
    // 고른 구간
    const sel = E.sel;
    if (sel) {
      g.fillStyle = col.sel || 'rgba(255,181,71,0.25)';
      g.globalAlpha = 0.55;
      g.fillRect(xOf(sel[0]), rt, Math.max(1, xOf(sel[1]) - xOf(sel[0])), hh - rt);
      g.globalAlpha = 1;
    }
    // 파형
    g.fillStyle = col.line2;
    g.fillRect(0, Math.round(mid), w, 1);
    for (let x = 0; x < w; x++) {
      const s = Math.floor(E.s0 + x * E.spp), e = Math.floor(E.s0 + (x + 1) * E.spp);
      if (s >= len()) break;
      const [lo, hi] = range(s, e);
      g.fillStyle = sel && s >= sel[0] && s < sel[1] ? col.accent : col.fg2;
      g.fillRect(x, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
    }
    // 끝 너머는 어둡게
    const endX = xOf(len());
    if (endX < w) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(endX, rt, w - endX, hh - rt); }
    // 구간 손잡이와 커서, 재생 위치
    if (sel) {
      g.fillStyle = col.accent;
      for (const s of sel) { const x = Math.round(xOf(s)); g.fillRect(x - 1, rt, 2, hh - rt); g.fillRect(x - 5, rt, 10, 6); }
    } else {
      g.fillStyle = col.fg;
      g.fillRect(Math.round(xOf(E.cur)), rt, 1, hh - rt);
    }
    if (E.play) {
      const at = E.play.from + (U.engine.ctx.currentTime - E.play.t0) * sr;
      g.fillStyle = col.play;
      g.fillRect(Math.round(xOf(at)), 0, 2, hh);
    }
    // 글자: 전체 길이와 고른 구간
    time.textContent = (sel ? '구간 ' + fmt(sel[0]) + ' – ' + fmt(sel[1]) + ' (' + ((sel[1] - sel[0]) / sr).toFixed(3) + '초) · ' : '커서 ' + fmt(E.cur) + ' · ') + '전체 ' + fmt(len());
    for (const b of needSel) b.disabled = !sel;
    pasteB.disabled = !clipboard;
    undoB.disabled = !E.undo.length;
    redoB.disabled = !E.redo.length;
  }

  /* ---------- 고르기 (마우스·손가락) ---------- */
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    if (e.button) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    const grab = U.isTouch || e.pointerType === 'touch' ? 16 : 7;
    let mode = 'new';
    if (E.sel && Math.abs(x - xOf(E.sel[0])) < grab) mode = 'a';
    else if (E.sel && Math.abs(x - xOf(E.sel[1])) < grab) mode = 'b';
    drag = { mode, x0: x, anchor: sOf(x), moved: false };
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(), x = clamp(e.clientX - r.left, 0, W()), s = sOf(x);
    if (Math.abs(x - drag.x0) > 3) drag.moved = true;
    if (!drag.moved) return;
    if (drag.mode === 'a') E.sel = [Math.min(s, E.sel[1] - 1), E.sel[1]];
    else if (drag.mode === 'b') E.sel = [E.sel[0], Math.max(s, E.sel[0] + 1)];
    else E.sel = [Math.min(drag.anchor, s), Math.max(drag.anchor, s)];
    draw();
  });
  const up = () => {
    if (!drag) return;
    if (!drag.moved && drag.mode === 'new') { E.cur = drag.anchor; E.sel = null; }
    if (E.sel && E.sel[1] - E.sel[0] < 1) E.sel = null;
    drag = null;
    draw();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('dblclick', () => { E.sel = [0, len()]; draw(); });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left);
    else { E.s0 += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * E.spp; clampView(); draw(); }
  }, { passive: false });
  // 두 손가락: 밀어서 넘기고 벌려서 확대
  U.gestures.pan(cv, {
    pan: dx => { E.s0 -= dx * E.spp; clampView(); draw(); },
    zoom: z => zoomAt(z.fx !== 1 ? z.fx : z.f, z.x)
  });

  /* ---------- 편집 ---------- */
  const bytes = chs => chs.reduce((n, c) => n + c.length * 4, 0);
  function commit(chs, sel, cur) {
    E.undo.push({ chs: E.chs, sel: E.sel, cur: E.cur });
    let total = E.undo.reduce((n, u) => n + bytes(u.chs), 0);
    while (E.undo.length > 1 && total > UNDO_BYTES) total -= bytes(E.undo.shift().chs);
    E.redo = [];
    E.chs = chs;
    E.sel = sel;
    E.cur = clamp(cur != null ? cur : E.cur, 0, len());
    E.dirty = true;
    after();
  }
  function after() { summarize(); clampView(); draw(); }
  function undo() { const u = E.undo.pop(); if (!u) return; E.redo.push({ chs: E.chs, sel: E.sel, cur: E.cur }); Object.assign(E, u); E.dirty = true; after(); }
  function redo() { const u = E.redo.pop(); if (!u) return; E.undo.push({ chs: E.chs, sel: E.sel, cur: E.cur }); Object.assign(E, u); E.dirty = true; after(); }
  const span = () => E.sel ? E.sel : [0, len()];
  const join = (...parts) => {
    const n = parts.reduce((k, p) => k + p.length, 0), out = new Float32Array(n);
    let o2 = 0;
    for (const p of parts) { out.set(p, o2); o2 += p.length; }
    return out;
  };
  // 클립보드 채널 수를 이 오디오에 맞춘다 (모노 ↔ 스테레오)
  const fitCh = (src, c) => src[Math.min(c, src.length - 1)] || src[0];
  function copy() { if (!E.sel) return; const [a, b] = E.sel; clipboard = E.chs.map(c => c.slice(a, b)); draw(); }
  function cut() {
    if (!E.sel) return;
    const [a, b] = E.sel;
    if (b - a >= len()) { U.toast('오디오 전체를 잘라낼 수는 없어요. 복사해 두고 다른 곳을 지워 주세요.'); return; }
    clipboard = E.chs.map(c => c.slice(a, b));
    commit(E.chs.map(c => join(c.subarray(0, a), c.subarray(b))), null, a);
  }
  function paste() {
    if (!clipboard) return;
    const [a, b] = E.sel || [E.cur, E.cur];
    const n = clipboard[0].length;
    commit(E.chs.map((c, i) => join(c.subarray(0, a), fitCh(clipboard, i), c.subarray(b))), [a, a + n], a + n);
  }
  function del() {
    if (!E.sel) return;
    const [a, b] = E.sel;
    if (b - a >= len()) { U.toast('오디오 전체를 지울 수는 없어요.'); return; }
    commit(E.chs.map(c => join(c.subarray(0, a), c.subarray(b))), null, a);
  }
  function crop() {
    if (!E.sel) return;
    const [a, b] = E.sel;
    commit(E.chs.map(c => c.slice(a, b)), null, 0);
    fit(); draw();
  }
  // 구간 [a, b)에 함수를 걸어 새 배열을 만든다 (원래 배열은 되돌리기용으로 남는다)
  function process([a, b], fn, sel) {
    commit(E.chs.map(c => { const o2 = c.slice(); fn(o2, a, b); return o2; }), sel === undefined ? E.sel : sel);
  }
  function silence() { if (E.sel) process(E.sel, (c, a, b) => c.fill(0, a, b)); }
  function fade(inn) {
    if (!E.sel) return;
    process(E.sel, (c, a, b) => {
      const n = Math.max(1, b - a);
      for (let i = a; i < b; i++) { const x = (i - a) / n; c[i] *= inn ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2); }
    });
  }
  function gain(db) {
    const g = Math.pow(10, db / 20);
    process(span(), (c, a, b) => { for (let i = a; i < b; i++) c[i] = clamp(c[i] * g, -1, 1); });
  }
  function normalize() {
    const [a, b] = span();
    let pk = 0;
    for (const c of E.chs) for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(c[i]));
    if (pk < 1e-6) { U.toast('소리가 없는 구간이에요.'); return; }
    const g = Math.pow(10, -0.3 / 20) / pk;
    process([a, b], (c, x, y) => { for (let i = x; i < y; i++) c[i] *= g; });
  }
  function reverse() { process(span(), (c, a, b) => c.subarray(a, b).reverse()); }

  /* ---------- 듣기 ---------- */
  function stopPlay() {
    if (!E.play) return;
    if (U.engine.pv && U.engine.pv.src === E.play.src) U.engine.stopPreview();
    E.play = null;
    playB.lastChild.textContent = '재생';
    draw();
  }
  function togglePlay() {
    if (E.play) { stopPlay(); return; }
    let [a, b] = E.sel || [E.cur, len()];
    if (b - a < 16) [a, b] = [0, len()];
    const tmp = new AudioBuffer({ length: b - a, numberOfChannels: E.chs.length, sampleRate: sr });
    E.chs.forEach((c, i) => tmp.copyToChannel(c.subarray(a, b), i));
    U.ensureAudio();
    const src = U.engine.previewBuffer(tmp);
    E.play = { src, from: a, to: b, t0: U.engine.ctx.currentTime };
    playB.lastChild.textContent = '정지';
    const tick = () => {
      if (!E.play || E.play.src !== src) return;
      const at = E.play.from + (U.engine.ctx.currentTime - E.play.t0) * sr;
      if (at >= E.play.to || !U.engine.pv || U.engine.pv.src !== src) { stopPlay(); return; }
      draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- 단축키 (이 창이 열려 있는 동안) ---------- */
  function onKey(e) {
    if (document.querySelectorAll('.dlg').length > 1 || U.isTyping(e)) return;   // 확인 창이 위에 떠 있으면 건드리지 않는다
    const mod = U.modKey(e);
    let done = true;
    if (e.key === ' ') togglePlay();
    else if (mod && e.code === 'KeyZ') e.shiftKey ? redo() : undo();
    else if (mod && e.code === 'KeyY') redo();
    else if (mod && e.code === 'KeyX') cut();
    else if (mod && e.code === 'KeyC') copy();
    else if (mod && e.code === 'KeyV') paste();
    else if (mod && e.code === 'KeyA') { E.sel = [0, len()]; draw(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') del();
    else done = false;
    if (done) { e.preventDefault(); e.stopPropagation(); }
  }
  document.addEventListener('keydown', onKey, true);
  const ro = new ResizeObserver(() => { clampView(); draw(); });
  ro.observe(wrap);
  summarize();
  requestAnimationFrame(() => { fit(); draw(); });
  return { dlg, E };
}

/* ================= 쓰는 곳마다 저장하는 방법 ================= */
/* 오디오 클립: 클립이 이 오디오 전체를 덮고 있었으면 새 길이에 맞춰 늘이거나 줄인다 */
function refitClip(c, oldFull, newFull) {
  const near = (x, y) => Math.abs(x - y) < 0.13;
  const full = near(c.end, oldFull);
  c.start = Math.min(c.start, Math.max(0, newFull - 0.25));
  c.end = full ? newFull : Math.min(c.end, newFull);
  if (c.end <= c.start + 0.01) { c.start = 0; c.end = newFull; }
  if (c.loop) {
    const lf = near(c.loop.end, oldFull);
    c.loop.start = Math.min(c.loop.start, Math.max(0, newFull - 0.25));
    c.loop.end = lf ? newFull : Math.min(c.loop.end, newFull);
    if (c.loop.end <= c.loop.start + 0.01) { c.loop.start = 0; c.loop.end = newFull; }
  }
}
function editClip(ref) {
  const r = U.clipRef(ref);
  if (!r || r.clip.type !== 'audio') return;
  const c = r.clip, sr = U.engine.ctx.sampleRate;
  const inf = U.media.info(c.ref);
  return open({ ref: c.ref, title: c.name || inf.name, name: inf.name, bpm: c.bpm, save: (newRef, res) => {
    const old = U.media.cached(c.ref, sr);
    const oldFull = (old ? old.duration : res.duration) * c.bpm / 60, newFull = res.duration * c.bpm / 60;
    U.act.clipProp(ref, (clip, rr) => {
      const scale = U.clipScale(clip, U.project.bpm), span0 = U.clipSpan(clip);
      clip.ref = newRef;
      refitClip(clip, oldFull, newFull);
      // 어레인지먼트 클립이 클립 전체 길이였으면 함께 맞춘다
      const a = rr && rr.arr;
      if (a && Math.abs(a.dur - span0 * scale) < 0.05) a.dur = U.clipSpan(clip) * scale;
    }, '오디오 편집');
  } });
}

U.audioEditor = { open, editClip, refitClip };
})(window.U = window.U || {});
