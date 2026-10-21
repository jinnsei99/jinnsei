/* 울림 — 패드 화면: 루프 패드·드럼 머신의 패드 16개를 크게 띄워 손가락과 키보드 글자로 친다.
   패드마다 글자 키를 정하고(키 지정), 샘플 구간·치는 방식·초크·템포 맞춤을 고치고, 원본 샘플을 자동으로 자른다 */
(function (U) {
'use strict';
const { h, ui, info, btn, clamp } = U;
const A = U.act;
const pr = () => U.project;

ui.padTrack = null;   // 패드 화면에 띄운 트랙
ui.padKeys = false;   // 키 지정 모드
ui.padWait = null;    // 글자 키를 기다리는 패드 번호
ui.padWaitT = null;   // 그 패드가 있는 트랙
ui.padVel = U.pref('padVel', 110);
const REPEAT_DIVS = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32'];
const MODE_SHORT = { oneshot: '원샷', hold: '누름', loop: '반복', toggle: '토글' };
const AUDIO_TYPES = 'audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff';

/* ================= 찾기 도우미 ================= */
const isPadInst = d => !!d && (d.kind === 'looppad' || d.kind === 'drums');
function padTracks() { return pr().tracks.filter(t => isPadInst(U.instrumentOf(t))); }
/* 손가락으로 칠 수 있는 트랙: 패드 트랙과 신스·샘플러 트랙(건반) */
function playTracks() { return pr().tracks.filter(t => t.type === 'midi' && U.instrumentOf(t)); }
const isKeysTrack = t => !!t && !isPadInst(U.instrumentOf(t));
/* 패드 화면의 트랙: 고른 트랙이 루프 패드면 그것, 아니면 첫 루프 패드, 그다음 드럼 머신.
   패드 트랙이 없거나 신스 트랙을 골라 두었으면 건반으로 친다 */
function curTrack() {
  const all = playTracks();
  let t = ui.padTrack ? all.find(x => x.id === ui.padTrack) : null;
  if (!t) {
    const list = padTracks();
    const s = U.selTrack(), lp = x => U.instrumentOf(x).kind === 'looppad';
    t = list.includes(s) && lp(s) ? s : list.find(lp) || (list.includes(s) ? s : list[0]) || (all.includes(s) ? s : all[0]) || null;
  }
  ui.padTrack = t ? t.id : null;
  return t;
}
function pads(d) { return (d.data && d.data.pads) || []; }
function selIdx(d) { return clamp(d.data && d.data.sel != null ? d.data.sel : 0, 0, 15); }
/* 패드의 글자 키. 드럼 머신 패드는 키를 정한 적이 없으면 기본 배치를 쓴다 */
function keyOf(d, i) {
  const pd = pads(d)[i];
  if (!pd) return null;
  if (pd.key !== undefined) return pd.key;
  return d.kind === 'drums' ? U.PAD_LAYOUTS[0].keys[i] : null;
}
function padName(d, i) { const pd = pads(d)[i]; return (pd && pd.name) || '패드 ' + (i + 1); }
function padEmpty(d, i) {
  const pd = pads(d)[i];
  if (!pd) return true;
  if (d.kind === 'drums') return pd.src === 'sample' && !pd.sample;
  return !(pd.sample || d.data.src) || Math.abs(pd.end - pd.start) < 0.001;
}
function srcOf(d, i) { const pd = pads(d)[i]; return pd ? pd.sample || d.data.src || null : null; }
function sampleName(ref) { return ref ? U.media.info(ref).name || ref : '없음'; }
function fmtBeats(b) { return U.round(b, 2) + '박'; }
/* 고른 뒤 포커스를 놓아 주는 드롭다운: 그래야 바로 글자 키로 패드를 칠 수 있다 */
function pick(options, cur, onPick, o) {
  const el = U.select(options, cur, onPick, o);
  el.addEventListener('change', () => el.blur());
  return el;
}

/* ================= 치기 ================= */
const held = new Map(); // 키 code 또는 포인터 → {tid, p}
function press(id, t, i, repeat) {
  if (held.has(id)) return;
  U.ensureAudio();
  U.engine.liveOn(t.id, 36 + i, clamp(Math.round(ui.padVel), 1, 127), false, repeat ? true : undefined);
  held.set(id, { tid: t.id, p: 36 + i });
}
function release(id) {
  const x = held.get(id);
  if (!x) return false;
  held.delete(id);
  U.engine.liveOff(x.tid, x.p);
  return true;
}
function releaseAll() { for (const id of [...held.keys()]) release(id); if (U.touchKeys) U.touchKeys.releaseAll(); }
/* 누르는 동안 패드를 치고, 손을 떼면 놓는다 (여러 손가락으로 동시에 눌러도 따로따로) */
function pointerPress(e, t, i) {
  const id = 'p' + e.pointerId;
  press(id, t, i, e.shiftKey);
  const up = ev => {
    if (ev.pointerId !== e.pointerId) return;
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    release(id);
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
/* 구간을 고친 뒤 한 번 들려준다 (방식과 상관없이 한 번, 녹음에는 남기지 않는다) */
function audition(t, i) {
  U.ensureAudio();
  const n = U.engine.nodes.get(t.id), inst = n && n.inst;
  if (!inst) return;
  const at = U.engine.ctx.currentTime + 0.02;
  if (inst.preview) inst.preview(i, ui.padVel, at);
  else inst.playNote(36 + i, ui.padVel, at, 0.4);
}
function stopAll(t) {
  const e = U.engine, n = e.nodes.get(t.id);
  for (const [k, rp] of e.repeats) if (rp.n === n) e.repeats.delete(k);
  if (n && n.inst) n.inst.stopAll(e.ctx.currentTime);
}

/* ================= 키보드 ================= */
function viewActive() { return ui.view === 'pads' && !(ui.narrow && ui.pane !== 'main'); }
/* 글자 키가 칠 패드 트랙: 패드 화면이면 그 트랙, 컴퓨터 건반이 켜져 있으면 건반이 가는 루프 패드 트랙 */
function kbTarget() {
  if (viewActive()) { const t = curTrack(); return t && !isKeysTrack(t) ? { t, d: U.instrumentOf(t) } : null; }
  if (!ui.keyboard) return null;
  for (const id of U.input.liveTargets()) {
    const t = U.trackById(pr(), id), d = t && U.instrumentOf(t);
    if (d && d.kind === 'looppad') return { t, d };
  }
  return null;
}
function keyDown(e) {
  if (ui.padWait != null) {
    const t = U.trackById(pr(), ui.padWaitT), d = t && U.instrumentOf(t);
    if (!isPadInst(d)) { stopWaiting(); return false; }
    if (e.key === 'Escape') { setAssign(false); return true; }
    if (e.key === 'Delete' || e.key === 'Backspace') { assignKey(d, ui.padWait, null, true); return true; }
    if (U.padKeyOk(e.code)) { if (!e.repeat) assignKey(d, ui.padWait, e.code, true); return true; }
    return false;
  }
  // 패드 화면이 건반이면 글자 키는 건반 (A~K 흰 건반, Z/X 옥타브)
  if (viewActive() && isKeysTrack(curTrack())) return U.touchKeys.keyDown(e) || (U.padKeyOk(e.code) && e.code !== 'KeyP');
  const tg = kbTarget();
  if (!tg) return false;
  let i = -1;
  for (let j = 0; j < 16; j++) if (keyOf(tg.d, j) === e.code) { i = j; break; }
  // 패드 화면에서는 주인 없는 글자 키가 다른 단축키로 새지 않게 막는다 (P는 화면 바꾸기로 남긴다)
  if (i < 0) return viewActive() && U.padKeyOk(e.code) && e.code !== 'KeyP';
  if (!e.repeat) press(e.code, tg.t, i, e.shiftKey);
  return true;
}
function keyUp(e) { return release(e.code) || (U.touchKeys ? U.touchKeys.keyUp(e) : false); }

/* ================= 키 지정 ================= */
function waitFor(t, i) {
  ui.padKeys = true;
  ui.padWait = i;
  ui.padWaitT = t.id;
  const d = U.instrumentOf(t);
  if (d && d.data) d.data.sel = i;
  if (ui.view === 'pads') render();
  U.inval('detail');
  U.setInfo('키 지정', '키보드에서 패드 ' + (i + 1) + '에 줄 글자를 누르세요. 누를 때마다 다음 패드로 넘어가요. Delete는 키 지우기, Esc는 끝내기예요.');
}
function stopWaiting() {
  if (!ui.padKeys && ui.padWait == null) return;
  ui.padKeys = false;
  ui.padWait = null;
  ui.padWaitT = null;
  if (ui.view === 'pads') render();
  U.inval('detail');
}
function setAssign(on) {
  const t = on ? curTrack() : null, d = t && U.instrumentOf(t);
  if (on && d) waitFor(t, selIdx(d));
  else stopWaiting();
}
/* 키를 기다리는 동안 패드·키 칸 밖을 누르면 그만 기다린다 */
document.addEventListener('pointerdown', e => {
  if (ui.padWait == null || !e.target.closest) return;
  if (!e.target.closest('.lp, .pe2-key, .pv-bar, .lpc .pad, .menu')) stopWaiting();
}, true);
/* 패드 i에 키를 준다. 다른 패드가 쓰던 키면 서로 바꾼다 */
function assignKey(d, i, code, advance) {
  const old = keyOf(d, i);
  let swapped = -1;
  A.setDeviceData(d.id, data => {
    if (d.kind === 'drums') data.pads.forEach((p, j) => { if (p && p.key === undefined) p.key = U.PAD_LAYOUTS[0].keys[j]; });
    if (code) data.pads.forEach((p, j) => { if (p && j !== i && p.key === code) { p.key = old || null; swapped = j; } });
    data.pads[i].key = code;
    if (advance && ui.padKeys) {
      ui.padWait = i < 15 ? i + 1 : null;
      if (ui.padWait == null) { ui.padKeys = false; ui.padWaitT = null; }
      data.sel = ui.padWait != null ? ui.padWait : i;
    }
  }, code ? '패드 키' : '패드 키 지우기');
  const what = '패드 ' + (i + 1) + (code ? '에 ' + U.keyLabel(code) + ' 키를 줬어요.' : '의 키를 지웠어요.');
  if (swapped >= 0) U.toast(what + ' 패드 ' + (swapped + 1) + '가 쓰던 키라서 ' + (old ? U.keyLabel(old) + ' 키와 ' : '') + '서로 바꿨어요.');
  U.setInfo('키 지정', what + (ui.padWait != null ? ' 이제 패드 ' + (ui.padWait + 1) + '에 줄 키를 누르세요.' : ''));
}

/* ================= 샘플 넣기 · 자르기 ================= */
async function pickAudio() {
  const files = await U.store.pickFile(AUDIO_TYPES, false);
  if (!files.length) return null;
  U.ensureAudio();
  try {
    const ref = await U.media.importFile(files[0], U.engine.ctx.sampleRate);
    U.inval('browser');
    return ref;
  } catch (e) {
    U.toast('이 파일을 읽지 못했어요. WAV, MP3, OGG 같은 오디오 파일을 골라 주세요.', 'error');
    return null;
  }
}
/* 패드 하나에 샘플을 넣는다: 루프는 켜고 끄는 템포 맞춤 패드로, 나머지는 원샷으로 */
async function dropOnPad(t, d, i, ref) {
  d.data.sel = i;
  if (d.kind === 'drums') {
    A.setDeviceData(d.id, data => { const p = data.pads[i]; p.src = 'sample'; p.sample = ref; p.name = (U.media.info(ref).name || '샘플').slice(0, 14); p.tune = 0; p.decay = 1; }, '패드 샘플');
    return;
  }
  U.ensureAudio();
  let buf;
  try { buf = await U.media.get(ref, U.engine.ctx.sampleRate); } catch (e) { U.toast('오디오를 불러오지 못했어요.', 'error'); return; }
  const inf = U.media.info(ref);
  const beats = inf.loop ? Math.max(0.25, Math.round(buf.duration * inf.bpm / 60 * 4) / 4) : 4;
  A.setDeviceData(d.id, data => {
    Object.assign(data.pads[i], { sample: ref, start: 0, end: 1, name: (inf.name || '샘플').slice(0, 14), mode: inf.loop ? 'toggle' : 'oneshot', sync: !!inf.loop, beats, rev: false, tune: 0 });
  }, '패드 샘플');
}
function equalCuts(n) { return Array.from({ length: n }, (_, k) => [k / n, (k + 1) / n]); }
function beatCuts(buf, bpm) {
  const beats = Math.round(buf.duration * (bpm || 120) / 60);
  if (beats < 1) return equalCuts(8);
  return equalCuts(Math.min(16, beats < 4 ? beats * 2 : beats));
}
/* 소리가 갑자기 커지는 곳(어택)을 찾아 자른다. 센 것부터 max개 */
function transientCuts(buf, max) {
  const d = buf.getChannelData(0), hop = 512, n = Math.floor(d.length / hop);
  if (n < 8) return equalCuts(1);
  const env = new Float32Array(n);
  let peak = 0;
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let j = k * hop, e = j + hop; j < e; j++) s += d[j] * d[j];
    env[k] = Math.sqrt(s / hop);
    if (env[k] > peak) peak = env[k];
  }
  if (peak < 1e-4) return equalCuts(8);
  // 앞 70ms 동안 가장 조용했던 때보다 크게 커진 곳이 후보
  const cand = [];
  for (let k = 0; k < n; k++) {
    if (env[k] < peak * 0.02) continue;
    let floor = k ? Infinity : 0;
    for (let j = Math.max(0, k - 6); j < k; j++) floor = Math.min(floor, env[j]);
    const rise = Math.log10((env[k] + 1e-5) / (floor + 1e-5));
    if (rise > 0.2) cand.push({ k, v: Math.min(rise, 3) * Math.sqrt(env[k] / peak) });
  }
  // 120ms 안에 붙은 후보는 한 덩어리 (자음 + 모음, 어택의 여러 프레임). 덩어리마다 충분히 센 것 중 가장 이른 곳에서 자른다
  const gap = Math.max(2, Math.round(0.12 * buf.sampleRate / hop));
  const groups = [];
  for (const c of cand) {
    const g = groups[groups.length - 1];
    if (g && c.k - g.last <= gap) { g.items.push(c); g.last = c.k; g.v = Math.max(g.v, c.v); }
    else groups.push({ items: [c], last: c.k, v: c.v });
  }
  groups.sort((a, b) => b.v - a.v);
  const picks = groups.slice(0, max).map(g => g.items.find(c => c.v >= g.v * 0.3).k).sort((a, b) => a - b);
  if (picks.length < 2) return equalCuts(8);
  // 샘플 단위로: 그 언저리에서 가장 큰 소리의 30%를 처음 넘는 곳, 그보다 2ms 앞에서 자른다
  const pre = Math.round(0.002 * buf.sampleRate);
  const starts = picks.map(k => {
    const a = Math.max(0, (k - 1) * hop), b = Math.min(d.length, (k + 1) * hop);
    let top = 0;
    for (let j = a; j < b; j++) top = Math.max(top, Math.abs(d[j]));
    let j = a;
    while (j < b && Math.abs(d[j]) < top * 0.3) j++;
    return Math.max(0, j - pre) / d.length;
  });
  return starts.map((s, j) => [s, j + 1 < starts.length ? starts[j + 1] : 1]);
}
async function chop(t, d, how, ref) {
  ref = ref || d.data.src;
  if (!ref) return;
  U.ensureAudio();
  let buf;
  try { buf = await U.media.get(ref, U.engine.ctx.sampleRate); } catch (e) { U.toast('오디오를 불러오지 못했어요.', 'error'); return; }
  const cuts = how === 'transient' ? transientCuts(buf, 16) : how === 'beats' ? beatCuts(buf, U.media.info(ref).bpm) : equalCuts(how);
  A.setDeviceData(d.id, data => {
    data.src = ref;
    data.pads.forEach((p, j) => {
      if (j < cuts.length) Object.assign(p, { name: '찹 ' + (j + 1), sample: null, start: U.round(cuts[j][0], 5), end: U.round(cuts[j][1], 5), mode: 'oneshot', sync: false, rev: false, tune: 0, choke: 1 });
      else if (!p.sample) Object.assign(p, { name: '', start: 0, end: 0 });
    });
    data.sel = 0;
  }, '자르기');
  U.toast('"' + sampleName(ref) + '"을(를) ' + cuts.length + '조각으로 잘라 패드 1~' + cuts.length + '에 넣었어요.');
}
/* 원본 샘플을 바꾸면 바로 자른다: 루프는 박자마다, 아니면 소리 시작점마다 */
function setSource(t, d, ref) {
  const inf = U.media.info(ref);
  return chop(t, d, inf.loop ? 'beats' : 'transient', ref);
}

/* ================= 메뉴 ================= */
function kitMenu(anchor, t) {
  const into = (tr, label) => { if (tr) { ui.padTrack = tr.id; U.toast(label + '을(를) 불러왔어요.'); } };
  U.menu([
    { header: t ? '이 트랙의 키트 바꾸기 · 루프 패드' : '루프 패드 키트' },
    ...U.LOOPKITS.map(k => ({ label: k.name, action: () => into(A.loadLoopKit(t ? t.id : null, k), k.name) })),
    { header: '드럼 머신 키트' },
    ...U.KITS.map(k => ({ label: k.name, action: () => into(A.loadKit(t ? t.id : null, k), k.name) })),
    { sep: true },
    { label: '새 루프 패드 트랙 만들기', action: () => into(A.loadLoopKit(null, U.DEFAULT_LOOPKIT), U.DEFAULT_LOOPKIT.name) }
  ], anchor);
}
function layoutMenu(anchor, t) {
  const d = U.instrumentOf(t);
  U.menu([
    { header: '패드 16개의 글자 키를 한꺼번에' },
    ...U.PAD_LAYOUTS.map(L => ({ label: L.name, checked: L.keys.every((k, j) => keyOf(d, j) === k), action: () => A.setDeviceData(d.id, data => { data.pads.forEach((p, j) => { if (p) p.key = L.keys[j]; }); }, '키 배치') })),
    { sep: true },
    { label: '모든 키 지우기', action: () => A.setDeviceData(d.id, data => { data.pads.forEach(p => { if (p) p.key = null; }); }, '키 지우기') }
  ], anchor);
}
let copied = null;
function padMenu(at, t, d, i) {
  const pd = pads(d)[i];
  const lp = d.kind === 'looppad';
  const k = keyOf(d, i);
  U.menu([
    { header: '패드 ' + (i + 1) + ' · ' + padName(d, i) },
    { label: '키 바꾸기', key: k ? U.keyLabel(k) : '', action: () => waitFor(t, i) },
    { label: '키 지우기', disabled: !k, action: () => assignKey(d, i, null) },
    lp ? { label: '치는 방식', sub: U.PAD_MODES.map(([v, l]) => ({ label: l, checked: pd.mode === v, action: () => A.setDeviceData(d.id, data => { data.pads[i].mode = v; }, '패드 방식') })) } : null,
    lp ? { sep: true } : null,
    lp ? { label: '복사', action: () => { copied = U.clone(pd); } } : null,
    lp ? { label: '붙여넣기', disabled: !copied, action: () => A.setDeviceData(d.id, data => { data.pads[i] = Object.assign(U.clone(copied), { key: data.pads[i].key }); }, '패드 붙여넣기') } : null,
    lp ? { label: '비우기', danger: true, action: () => A.setDeviceData(d.id, data => { Object.assign(data.pads[i], { name: '', sample: null, start: 0, end: 0 }); }, '패드 비우기') } : null
  ], at);
}
function sampleMenu(anchor, t, d, i) {
  const pd = pads(d)[i];
  U.menu([
    { label: '원본 샘플 바꾸기 (파일)…', action: async () => { const ref = await pickAudio(); if (ref) setSource(t, d, ref); } },
    { label: '이 패드에만 샘플 넣기 (파일)…', action: async () => { const ref = await pickAudio(); if (ref) dropOnPad(t, d, i, ref); } },
    { label: '이 패드를 원본으로 되돌리기', disabled: !pd.sample || !d.data.src, action: () => A.setDeviceData(d.id, data => { Object.assign(data.pads[i], { sample: null, start: i / 16, end: (i + 1) / 16, sync: false }); }, '원본 쓰기') },
    { sep: true },
    { label: '브라우저의 샘플을 파형이나 패드에 끌어다 놓아도 돼요', disabled: true }
  ], anchor);
}
function chopMenu(anchor, t, d) {
  const inf = U.media.info(d.data.src);
  U.menu([
    { header: '"' + sampleName(d.data.src) + '" 잘라서 패드 1부터 넣기' },
    { label: '소리 시작점마다 (자동)', action: () => chop(t, d, 'transient') },
    { label: '박자마다', disabled: !inf.loop, action: () => chop(t, d, 'beats') },
    { label: '같은 길이 16조각', action: () => chop(t, d, 16) },
    { label: '같은 길이 8조각', action: () => chop(t, d, 8) },
    { label: '같은 길이 4조각', action: () => chop(t, d, 4) }
  ], anchor);
}

/* ================= 패드 편집기 (패드 화면 오른쪽, 장치 칸에서도 쓴다) ================= */
const PSPEC = {
  tune: { id: 'tune', label: 'Tune', min: -24, max: 24, def: 0, step: 1, unit: 'st', curve: 'lin', info: '음높이 (반음). 재생 속도가 바뀌어서 길이도 달라져요.' },
  gain: { id: 'gain', label: 'Gain', min: -36, max: 12, def: 0, unit: 'dB', curve: 'lin', info: '패드 음량' },
  pan: { id: 'pan', label: 'Pan', min: -1, max: 1, def: 0, unit: 'pan', curve: 'lin', info: '패드 좌우 위치' }
};
function editor(t, d, o) {
  o = o || {};
  const i = selIdx(d);
  const pd = pads(d)[i];
  const box = h('div', { class: 'pe2' + (o.compact ? ' compact' : '') });
  let wave = null;
  if (!pd) return { el: box, draw() {} };
  const name = h('input', { class: 'inp sm', value: pd.name || '', placeholder: '패드 ' + (i + 1), 'aria-label': '패드 이름', spellcheck: 'false' });
  name.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') name.blur(); });
  name.addEventListener('change', () => A.setDeviceData(d.id, data => { data.pads[i].name = name.value.trim(); }, '패드 이름'));
  const big = o.compact ? btn({ icon: 'pads', cls: 'ghost sm', title: '패드 화면에서 크게', info: ['패드 화면', '패드를 크게 띄우고 글자 키로 치는 화면이에요. P를 눌러도 가요.'], onclick: () => { ui.padTrack = t.id; U.setView('pads'); } }) : null;
  // 손가락으로는 패드를 길게 눌러도 메뉴가 뜨지 않으니(누르는 동안이 연주라서) 여기서 연다
  const more = U.isTouch && !o.compact ? btn({ text: '⋯', cls: 'ghost sm pe2-more', title: '패드 메뉴', onclick: () => padMenu(more, t, d, i) }) : null;
  box.append(h('div', { class: 'pe2-head' }, h('span', { class: 'pe2-n', text: String(i + 1) }), name, h('span', { class: 'pe2-note', text: U.noteName(36 + i) }), big, more));
  box.append(keyRow(t, d, i));
  if (d.kind === 'drums') {
    box.append(h('p', { class: 'hint', text: '드럼 소리(종류·튜닝·디케이)는 장치 칸의 드럼 머신에서 바꿔요.' }),
      btn({ text: '장치 칸 열기', cls: 'sm', onclick: () => { U.selectTrack(t.id, { device: true }); if (!ui.detailOpen) U.toggleDetail(true); } }));
    return { el: box, draw() {} };
  }
  wave = waveBox(t, d, i, o);
  box.append(wave.el);
  const modes = U.PAD_MODES.map(([v, l, inf]) => [v, l, inf]);
  const setMode = v => A.setDeviceData(d.id, data => { data.pads[i].mode = v; }, '패드 방식');
  const modeSel = o.compact ? pick(modes.map(m => [m[0], m[1]]), pd.mode, setMode, { cls: 'sm', label: '치는 방식', info: ['치는 방식', U.PAD_MODES.map(m => m[1] + ': ' + m[2]).join(' ')] }) : null;
  if (!o.compact) box.append(U.seg(modes, pd.mode, setMode, 'pe2-mode'));
  const sync = btn({ text: '템포 맞춤', cls: 'tg sm', toggle: true, on: !!pd.sync, info: ['템포 맞춤', '켜면 구간을 정한 박 수에 맞춰 늘이거나 줄여요. 음높이는 그대로예요. 드럼 루프를 템포에 맞출 때 좋아요.'], onclick: () => A.setDeviceData(d.id, data => { data.pads[i].sync = !data.pads[i].sync; }, '템포 맞춤') });
  const beats = U.numBox({ cls: 'sm pe2-beats' + (pd.sync ? '' : ' off'), label: '박 수', get: () => pd.beats, set: (v, f) => A.setDeviceData(d.id, data => { data.pads[i].beats = v; }, '박 수', !f), fmt: fmtBeats, parse: s => parseFloat(s), min: 0.25, max: 64, step: 0.25, def: 4, range: 600 });
  info(beats, '박 수', '템포 맞춤을 켰을 때 이 구간을 몇 박 길이로 칠지예요. 끌거나 두 번 눌러 입력해요.');
  const rev = btn({ text: '거꾸로', cls: 'tg sm', toggle: true, on: !!pd.rev, info: ['거꾸로', '구간을 뒤에서부터 재생해요.'], onclick: () => A.setDeviceData(d.id, data => { data.pads[i].rev = !data.pads[i].rev; }, '거꾸로') });
  box.append(h('div', { class: 'pe2-row' }, modeSel, sync, beats, rev));
  const knobs = h('div', { class: 'pe2-knobs' });
  for (const k of ['tune', 'gain', 'pan']) {
    knobs.append(U.knob({ spec: PSPEC[k], size: o.compact ? 'xs' : 'sm', get: () => pads(d)[i][k], set: (v, f) => A.setDeviceData(d.id, data => { data.pads[i][k] = v; }, '패드 ' + PSPEC[k].label, !f) }));
  }
  knobs.append(h('div', { class: 'ctl ctl-enum' }, pick([['0', '없음'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], String(pd.choke || 0), v => A.setDeviceData(d.id, data => { data.pads[i].choke = +v; }, '초크'), { cls: 'sm', label: '초크 그룹', info: ['초크 그룹', '같은 번호의 패드는 서로를 끊어요. 보컬 찹을 한 목소리로 치거나, 루프 여러 개 중 하나만 울리게 할 때 써요.'] }), h('div', { class: 'k-lbl', text: 'Choke' })));
  box.append(knobs);
  return { el: box, draw: () => wave && wave.draw() };
}
function keyRow(t, d, i) {
  const k = keyOf(d, i);
  const wait = ui.padWait === i && ui.padWaitT === t.id;
  const cap = h('span', { class: 'keycap' + (k ? '' : ' none') + (wait ? ' wait' : ''), text: wait ? '?' : k ? U.keyLabel(k) : '없음' });
  const set = btn({ text: wait ? '키를 누르세요…' : '키 바꾸기', cls: 'sm' + (wait ? ' primary' : ''), info: ['키 바꾸기', '누른 뒤 키보드에서 이 패드에 줄 글자를 누르세요. 다른 패드가 쓰던 글자면 서로 바꿔요. 한글 입력 상태여도 자판 위치로 알아들어요.'], onclick: () => { if (wait) stopWaiting(); else waitFor(t, i); } });
  const clr = btn({ text: '지우기', cls: 'ghost sm', onclick: () => assignKey(d, i, null) });
  clr.disabled = !k;
  info(cap, '패드 키', k ? '이 패드는 ' + U.keyLabel(k) + ' 키로 쳐요. 패드 화면에서, 또는 컴퓨터 건반(M)을 켰을 때 써요.' : '이 패드에는 아직 글자 키가 없어요.');
  return h('div', { class: 'pe2-row pe2-key' }, h('span', { class: 'pe2-l', text: '키' }), cap, set, clr);
}
/* 샘플 파형과 패드 구간. 손잡이를 끌거나 빈 곳을 끌어 구간을 고른다 */
function waveBox(t, d, i, o) {
  const H = o.compact ? 40 : 96;
  const pd = pads(d)[i];
  const ref = srcOf(d, i);
  const sr = U.engine.ctx.sampleRate;
  const holder = h('div', { class: 'pe2-wavewrap' });
  const cv = h('canvas', { class: 'pe2-wave' });
  holder.append(cv);
  const col = U.colorOf(t.color);
  const draw = () => {
    const W = Math.max(80, Math.floor(holder.clientWidth || (o.compact ? 230 : 330)));
    const c = U.colors();
    const g = U.fitCanvas(cv, W, H);
    g.fillStyle = c.sunk;
    g.fillRect(0, 0, W, H);
    g.font = '11px ' + c.font;
    g.textBaseline = 'middle';
    if (!ref) { g.fillStyle = c.fg3; g.fillText('샘플을 여기에 끌어다 놓으세요', 10, H / 2); return; }
    const buf = U.media.cached(ref, sr);
    if (!buf) { g.fillStyle = c.fg3; g.fillText('불러오는 중…', 10, H / 2); U.media.get(ref, sr).then(draw, () => {}); return; }
    const pk = U.media.peaks(ref, buf, W);
    const s = Math.min(pd.start, pd.end), e = Math.max(pd.start, pd.end);
    const x0 = s * W, x1 = e * W, mid = H / 2, amp = H / 2 - 3;
    g.fillStyle = U.alpha(col, 0.16);
    g.fillRect(x0, 0, Math.max(1, x1 - x0), H);
    for (let x = 0; x < W; x++) {
      const inside = x >= x0 - 0.5 && x <= x1 + 0.5;
      g.fillStyle = inside ? col : c.fg3;
      g.globalAlpha = inside ? 1 : 0.5;
      const lo = pk[x * 2], hi = pk[x * 2 + 1];
      g.fillRect(x, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
    }
    g.globalAlpha = 1;
    // 같은 원본을 쓰는 다른 패드가 시작하는 곳
    if (!pd.sample) {
      g.font = '600 8px ' + c.mono;
      g.textBaseline = 'top';
      pads(d).forEach((p, j) => {
        if (j === i || !p || p.sample || Math.abs(p.end - p.start) < 0.001) return;
        const x = Math.round(Math.min(p.start, p.end) * W);
        g.fillStyle = c.fg3;
        g.fillRect(x, 0, 1, 9);
        if (!o.compact) g.fillText(String(j + 1), x + 2, 1);
      });
    }
    g.textBaseline = 'alphabetic';
    g.font = '600 8px ' + c.mono;
    for (const [f, l] of [[s, 'S'], [e, 'E']]) {
      const x = Math.round(f * W), bx = l === 'E' ? Math.max(0, x - 9) : Math.min(W - 9, x);
      g.fillStyle = c.accent;
      g.fillRect(l === 'E' ? x - 1.5 : x, 0, 1.5, H);
      g.fillRect(bx, H - 10, 9, 10);
      g.fillStyle = '#16171a';
      g.fillText(l, bx + 2, H - 2);
    }
  };
  info(cv, '샘플 구간', '노란 손잡이(S·E)를 끌어 이 패드가 울릴 구간을 바꿔요. 빈 곳을 끌면 새 구간을 그려요. 위쪽 눈금은 같은 원본을 쓰는 다른 패드가 시작하는 곳이에요. 샘플을 끌어다 놓으면 원본을 바꾸고 자동으로 잘라요.');
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !ref || !U.media.cached(ref, sr)) return;
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const fx = ev => clamp((ev.clientX - r.left) / r.width, 0, 1);
    const f0 = fx(e);
    let a = Math.min(pd.start, pd.end), b = Math.max(pd.start, pd.end);
    const near = v => Math.abs(v - f0) * r.width < 7;
    const what = near(a) ? 'start' : near(b) ? 'end' : 'new';
    let moved = false;
    cv.setPointerCapture(e.pointerId);
    const move = ev => {
      const x = fx(ev);
      if (what === 'start') a = Math.min(x, b - 0.002);
      else if (what === 'end') b = Math.max(x, a + 0.002);
      else { a = Math.min(f0, x); b = Math.max(f0, x); if (b - a < 0.002) return; }
      moved = true;
      A.setDeviceData(d.id, data => { data.pads[i].start = U.round(a, 5); data.pads[i].end = U.round(b, 5); }, '', true);
      draw();
    };
    const up = () => {
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      if (moved) { U.commit('패드 구간'); audition(t, i); }
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  });
  U.dropTarget(holder, { accept: x => x.type === 'sample', drop: x => (pd.sample ? dropOnPad(t, d, i, x.ref) : setSource(t, d, x.ref)) });
  const label = h('span', { class: 'pe2-src', text: pd.sample ? '이 패드 샘플: ' + sampleName(pd.sample) : '원본: ' + sampleName(d.data.src) });
  const smpB = btn({ text: '샘플 ▾', cls: 'sm', title: '샘플 바꾸기', onclick: () => sampleMenu(smpB, t, d, i) });
  const chopB = !pd.sample && d.data.src ? btn({ text: '자르기 ▾', cls: 'sm', title: '원본을 잘라 패드에 나누기', info: ['자르기', '원본 샘플을 소리 시작점이나 박자, 같은 길이로 잘라 패드 1부터 차례로 넣어요.'], onclick: () => chopMenu(chopB, t, d) }) : null;
  const el = h('div', { class: 'pe2-wavebox' }, holder, h('div', { class: 'pe2-row' }, label, smpB, chopB));
  return { el, draw };
}

/* ================= 패드 화면 ================= */
let root = null, ro = null;
let R = { pads: [], track: null, dev: null, ed: null, side: null };
function build(el) {
  root = el;
  U.engine.repeat.div = U.pref('repeatDiv', '1/16');
  render();
}
function render() {
  if (!root) return;
  U.clear(root);
  R = { pads: [], track: null, dev: null, ed: null, side: null };
  const t = curTrack();
  if (U.touchKeys) U.touchKeys.releaseAll();
  root.append(toolbar(t));
  if (!t) { root.append(emptyState()); return; }
  if (isKeysTrack(t)) { R.track = t; root.append(h('div', { class: 'pv-body pv-keys' }, U.touchKeys.view(t))); return; }
  const d = U.instrumentOf(t);
  R.track = t;
  R.dev = d;
  const grid = h('div', { class: 'pv-grid', role: 'group', 'aria-label': '패드 16개', style: { '--pc': U.colorOf(t.color) } });
  for (let row = 3; row >= 0; row--) for (let col = 0; col < 4; col++) grid.append(padEl(t, d, row * 4 + col));
  const wrap = h('div', { class: 'pv-gridwrap' }, grid);
  R.side = h('div', { class: 'pv-side' });
  root.append(h('div', { class: 'pv-body' }, wrap, R.side));
  fitGrid(wrap, grid);
  drawSide();
}
function fitGrid(wrap, grid) {
  if (ro) ro.disconnect();
  const fit = () => {
    const s = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight, 620));
    if (s <= 60) return;
    grid.style.width = s + 'px';
    grid.style.height = s + 'px';
    // 패드가 작으면 글자 키와 이름만 남긴다
    grid.classList.toggle('small', s < 440);
    grid.classList.toggle('tiny', s < 300);
  };
  if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(wrap); }
  requestAnimationFrame(fit);
}
function drawSide() {
  if (!R.side || !R.dev) return;
  U.clear(R.side);
  R.ed = editor(R.track, R.dev, {});
  R.side.append(R.ed.el);
  requestAnimationFrame(() => R.ed && R.ed.draw());
}
function toolbar(t) {
  const bar = h('div', { class: 'pv-bar' });
  const d = t && U.instrumentOf(t);
  const list = playTracks();
  if (list.length && t) {
    bar.append(pick(list.map(x => [x.id, U.trackLabel(pr(), x) + (isKeysTrack(x) ? ' · 건반' : ' · 패드')]), t.id, v => { ui.padTrack = v; U.selectTrack(v); render(); },
      { cls: 'sm pv-track', label: '칠 트랙', info: ['칠 트랙', '손가락으로 칠 트랙이에요. 드럼 머신·루프 패드는 패드 16개로, 신스·샘플러는 건반으로 쳐요.'] }));
  }
  if (isKeysTrack(t)) return keysBar(bar, t);
  const kitB = btn({ icon: 'pads', text: d ? d.preset || U.devName(d) : '키트', cls: 'sm pv-kit', title: '키트', info: ['키트', '이 트랙의 패드를 다른 키트로 바꾸거나 새 루프 패드 트랙을 만들어요.'], onclick: () => kitMenu(kitB, t) });
  bar.append(kitB);
  if (!t) return bar;
  const sep = () => h('span', { class: 'pv-sep' });
  const arm = btn({ icon: 'rec', cls: 'tg sm pv-arm', toggle: true, on: !!t.arm, title: '녹음 준비', info: ['녹음 준비', '켜 두고 ● 녹음(F9)이나 세션 녹음을 누르면 패드로 친 것이 클립으로 남아요.'], onclick: () => A.toggleTrackFlag(t.id, 'arm') });
  const keys = btn({ icon: 'keys', text: '키 지정', cls: 'tg sm', toggle: true, on: ui.padKeys, info: ['키 지정', '켜고 패드를 누른 뒤 키보드에서 글자를 누르면 그 패드의 키가 돼요. 누를 때마다 다음 패드로 넘어가요.'], onclick: () => setAssign(!ui.padKeys) });
  const lay = btn({ text: '키 배치 ▾', cls: 'sm', info: ['키 배치', '패드 16개의 글자 키를 정해 둔 배치로 한꺼번에 바꿔요. 왼손 4×4는 키보드 왼쪽 네 줄이 패드 네 줄과 같은 모양이에요.'], onclick: () => layoutMenu(lay, t) });
  const rep = btn({ text: '노트 리피트', cls: 'tg sm', toggle: true, on: U.engine.repeat.on, info: ['노트 리피트', '켜면 패드를 누르고 있는 동안 정한 박자마다 다시 쳐요. 재생 중이면 박자에 맞춰요. 꺼져 있어도 Shift를 누른 채 치면 그동안만 되풀이해요.'], onclick: () => { U.engine.repeat.on = !U.engine.repeat.on; U.setPressed(rep, U.engine.repeat.on); } });
  const rate = pick(REPEAT_DIVS.map(x => [x, x]), U.engine.repeat.div, v => { U.engine.repeat.div = v; U.setPref('repeatDiv', v); },
    { cls: 'sm', label: '노트 리피트 간격', info: ['리피트 간격', '노트 리피트로 다시 치는 간격이에요. T는 셋잇단이에요.'] });
  const vel = U.numBox({ cls: 'sm pv-vel', label: '세기', get: () => ui.padVel, set: (v, f) => { ui.padVel = v; if (f) U.setPref('padVel', v); }, fmt: v => '세기 ' + Math.round(v), parse: s => parseInt(String(s).replace(/[^\d]/g, ''), 10), min: 1, max: 127, step: 1, def: 110, range: 300 });
  info(vel, '세기', '마우스·터치·키보드로 칠 때의 세기(벨로시티)예요. 끌거나 두 번 눌러 입력해요.');
  const stop = btn({ icon: 'stop', text: '모두 멈춤', cls: 'sm', info: ['모두 멈춤', '이 트랙에서 울리거나 되풀이하는 패드를 모두 멈춰요. 재생을 멈춰도 반복 패드는 멈춰요.'], onclick: () => stopAll(t) });
  bar.append(...[arm, sep(), keys, lay, sep(), rep, rate, vel, h('span', { class: 'cb-flex' }), bigBtn(), stop].filter(Boolean));
  return bar;
}
/* 아래 클립·장치 칸을 접어 패드·건반을 크게 (손가락으로 칠 때) */
function bigBtn() {
  if (ui.narrow) return null;
  return btn({ icon: 'detail', cls: 'tg sm', toggle: true, on: !ui.detailOpen, title: '연주 칸 크게', info: ['연주 칸 크게', '아래 클립·장치 칸을 접어서 패드와 건반을 크게 써요. 다시 누르면 펼쳐요.'], onclick: () => { U.toggleDetail(); U.inval('pads'); } });
}
/* 건반일 때의 도구 막대: 녹음 준비, 건반·스케일, 코드, 옥타브, 세기 */
function keysBar(bar, t) {
  const sep = () => h('span', { class: 'pv-sep' });
  const arm = btn({ icon: 'rec', cls: 'tg sm pv-arm', toggle: true, on: !!t.arm, title: '녹음 준비', info: ['녹음 준비', '켜 두고 ● 녹음(F9)이나 세션 녹음을 누르면 건반으로 친 것이 클립으로 남아요.'], onclick: () => A.toggleTrackFlag(t.id, 'arm') });
  const vel = U.numBox({ cls: 'sm pv-vel', label: '세기', get: () => ui.padVel, set: (v, f) => { ui.padVel = v; if (f) U.setPref('padVel', v); }, fmt: v => '세기 ' + Math.round(v), parse: s => parseInt(String(s).replace(/[^\d]/g, ''), 10), min: 1, max: 127, step: 1, def: 110, range: 300 });
  info(vel, '세기', '건반을 칠 때의 세기(벨로시티)예요. 끌거나 두 번 눌러 입력해요.');
  const stop = btn({ icon: 'stop', text: '모두 멈춤', cls: 'sm', info: ['모두 멈춤', '이 트랙에서 울리는 음을 모두 멈춰요.'], onclick: () => { U.touchKeys.releaseAll(); stopAll(t); } });
  bar.append(...[arm, sep(), ...U.soundPicker(t), sep(), ...U.touchKeys.controls(t, render), sep(), vel, h('span', { class: 'cb-flex' }), bigBtn(), stop].filter(Boolean));
  return bar;
}
function emptyState() {
  return h('div', { class: 'pv-empty' },
    h('h2', { text: '패드로 칠 트랙이 없어요' }),
    h('p', { text: '루프 패드 트랙을 만들면 패드 16개에 보컬 찹·드럼 찹·루프가 담겨요. 패드마다 키보드 글자가 붙어 있어서 바로 칠 수 있어요.' }),
    h('div', { class: 'pv-kits' }, ...U.LOOPKITS.map(k => btn({ icon: 'pads', text: k.name, info: [k.name, k.info], onclick: () => { const tr = A.loadLoopKit(null, k); if (tr) ui.padTrack = tr.id; } }))));
}
function padEl(t, d, i) {
  const k = keyOf(d, i);
  const pd = pads(d)[i];
  const wait = ui.padWait === i && ui.padWaitT === t.id;
  const meta = d.kind === 'looppad' && pd ? MODE_SHORT[pd.mode] + (pd.sync ? ' · ' + fmtBeats(pd.beats) : '') : U.noteName(36 + i);
  const el = h('button', { type: 'button', 'data-nolongpress': '', class: 'lp' + (padEmpty(d, i) ? ' empty' : '') + (selIdx(d) === i ? ' sel' : '') + (wait ? ' assign' : ''), 'aria-label': '패드 ' + (i + 1) + ' ' + padName(d, i) + (k ? ', ' + U.keyLabel(k) + ' 키' : '') },
    h('span', { class: 'lp-top' }, h('span', { class: 'lp-num', text: String(i + 1) }), h('span', { class: 'lp-key' + (k || wait ? '' : ' none'), text: wait ? '?' : k ? U.keyLabel(k) : '—' })),
    h('span', { class: 'lp-name', text: padName(d, i) }),
    h('span', { class: 'lp-meta', text: meta }));
  info(el, '패드 ' + (i + 1) + ' · ' + padName(d, i) + (k ? ' · ' + U.keyLabel(k) + ' 키' : ''),
    ui.padKeys ? '누르면 이 패드에 줄 키를 기다려요.' : (k ? U.keyLabel(k) + ' 키나 마우스·손가락으로 쳐요.' : '눌러서 치고, 키 지정으로 글자 키를 줄 수 있어요.') + ' Shift를 누른 채 치면 노트 리피트. 오른쪽 클릭은 메뉴, 샘플을 끌어다 놓으면 이 패드 소리가 돼요.');
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (ui.padKeys) { waitFor(t, i); return; }
    if (selIdx(d) !== i) { d.data.sel = i; markSel(); drawSide(); }
    pointerPress(e, t, i);
  });
  el.addEventListener('contextmenu', e => { e.preventDefault(); padMenu({ x: e.clientX, y: e.clientY }, t, d, i); });
  U.dropTarget(el, { accept: x => x.type === 'sample', drop: x => dropOnPad(t, d, i, x.ref) });
  R.pads[i] = el;
  return el;
}
function markSel() { if (R.dev) R.pads.forEach((el, j) => el.classList.toggle('sel', j === selIdx(R.dev))); }

/* 매 프레임: 친 패드는 번쩍, 울리는 패드는 테두리, 박자를 기다리는 반복 패드는 깜빡 */
function padStates(inst, now) {
  const hit = new Set(inst.hits ? inst.hits(now) : []);
  const on = new Set(inst.sounding ? inst.sounding(now) : []);
  const wait = new Set();
  for (const v of inst.voices) if (v.live && v.t0 > now + 0.02 && v.end > now && (v.mode === 'loop' || v.mode === 'toggle')) wait.add(v.pad);
  return { hit, on, wait };
}
U.frame(() => {
  if (!R.dev || ui.view !== 'pads' || !root || root.offsetParent === null) return;
  const n = U.engine.nodes.get(R.track.id), inst = n && n.inst;
  if (!inst) return;
  const st = padStates(inst, U.engine.ctx.currentTime);
  R.pads.forEach((el, i) => {
    el.classList.toggle('hit', st.hit.has(i));
    el.classList.toggle('on', st.on.has(i));
    el.classList.toggle('wait', st.wait.has(i));
  });
});

/* ================= 장치 칸의 루프 패드 (작게) ================= */
function compact(t, d) {
  const wrap = h('div', { class: 'lpc' });
  const grid = h('div', { class: 'pads' });
  const side = h('div', { class: 'lpc-side' });
  wrap.append(grid, side);
  const els = [];
  let ed = null;
  const drawSide = () => {
    U.clear(side);
    ed = editor(t, d, { compact: true });
    side.append(ed.el);
    requestAnimationFrame(() => ed && ed.draw());
  };
  for (let row = 3; row >= 0; row--) {
    for (let col = 0; col < 4; col++) {
      const i = row * 4 + col;
      const k = keyOf(d, i), pd = pads(d)[i];
      const b = h('button', { type: 'button', class: 'pad' + (selIdx(d) === i ? ' sel' : '') + (padEmpty(d, i) ? ' muted' : '') },
        h('span', { class: 'pad-n', text: padName(d, i) }), h('span', { class: 'pad-k', text: (k ? U.keyLabel(k) + ' · ' : '') + (pd ? MODE_SHORT[pd.mode] : '') }));
      info(b, '패드 ' + (i + 1) + ' · ' + padName(d, i) + (k ? ' · ' + U.keyLabel(k) + ' 키' : ''), '누르면 소리를 들어 보고 옆에서 설정을 바꿔요. 샘플을 끌어다 놓으면 이 패드 소리가 돼요.');
      b.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (selIdx(d) !== i) { d.data.sel = i; els.forEach((x, j) => x.classList.toggle('sel', j === i)); drawSide(); }
        pointerPress(e, t, i);
      });
      U.dropTarget(b, { accept: x => x.type === 'sample', drop: x => dropOnPad(t, d, i, x.ref) });
      els[i] = b;
      grid.append(b);
    }
  }
  drawSide();
  const frame = () => {
    const n = U.engine.nodes.get(t.id), inst = n && n.inst;
    if (!inst || inst.dev !== d) return;
    const st = padStates(inst, U.engine.ctx.currentTime);
    els.forEach((b, i) => { b.classList.toggle('hit', st.hit.has(i)); b.classList.toggle('on', st.on.has(i)); });
  };
  return { el: wrap, frame, draw: () => ed && ed.draw() };
}

/* ================= 다시 그리기 ================= */
U.renderer('pads', () => { if (ui.view === 'pads') render(); });
U.on('select', s => {
  if (!s || !s.track || s.track === ui.padTrack) return;
  const t = U.trackById(pr(), s.track);
  if (!t || t.type !== 'midi' || !U.instrumentOf(t)) return;
  // 패드 트랙을 고르면 언제나 따라가고, 신스 트랙은 지금 건반으로 치고 있을 때만 따라간다
  const now = ui.padTrack && U.trackById(pr(), ui.padTrack);
  if (!isKeysTrack(t) || !now || isKeysTrack(now)) { ui.padTrack = t.id; if (ui.view === 'pads') U.inval('pads'); }
});
window.addEventListener('resize', () => { if (R.ed && ui.view === 'pads') R.ed.draw(); });

U.padsView = { build, render, keyDown, keyUp, releaseAll, curTrack };
U.padsUI = { compact, keyOf };
})(window.U = window.U || {});
