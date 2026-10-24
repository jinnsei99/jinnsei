/* 울림 — 클립 뷰: 클립 설정, 피아노 롤(음표·벨로시티), 드럼은 스텝 시퀀서도, 오디오 파형, MIDI 도구 */
(function (U) {
'use strict';
const { h, ui, info, clamp, icon, btn } = U;
const A = U.act;
const pr = () => U.project;
const KEYS_W = 58, RULER_H = 22, VEL_H = 54;

const R = ui.roll = {
  ppb: 60, x0: 0, rowH: 13, scrollY: 0, grid: 'auto', tri: false, snap: true, fold: 'none',
  sel: new Set(), clipId: null, tab: U.pref('clipTab', 'notes'), tool: 'rhythm', toolParams: {},
  chord: { clipId: null, pos: 0, prev: null },   // 코드 넣기: 다음에 넣을 자리, 앞 화음 (부드럽게 잇기)
  view: U.pref('drumView', 'steps') // 드럼·패드 클립: 'steps' 스텝 시퀀서 | 'roll' 피아노 롤
};
let root = null, props = null, editor = null, cvGrid, cvKeys, cvRuler, cvVel, gridWrap, W = 400, H = 200;
let cur = null; // {track, clip, slot|arr}
let rows = [], rowOf = new Map();
let rubber = null, audition = null;

/* ================= 진입점 ================= */
function render(el) {
  root = el;
  U.clear(root);
  cur = U.clipRef();
  if (!cur) {
    root.append(h('div', { class: 'empty-detail' },
      h('p', { class: 'ed-t', text: '클립을 고르면 여기에서 편집해요' }),
      h('p', { class: 'ed-d', text: '세션의 클립 칸을 누르거나 어레인지먼트의 클립을 두 번 누르세요. 빈 칸을 두 번 누르면 새 MIDI 클립이 생겨요.' })));
    return;
  }
  if (R.clipId !== cur.clip.id) openClip();
  props = h('div', { class: 'cv-props' });
  editor = h('div', { class: 'cv-editor' });
  root.append(h('div', { class: 'clipview' }, props, editor));
  renderProps();
  if (cur.clip.type !== 'midi') buildWave();
  else if (isDrums() && R.view === 'steps') { cvGrid = null; U.stepView.build(editor, cur); }
  else buildRoll();
}
/* 드럼·패드 클립에서 피아노 롤과 스텝 시퀀서를 오간다 */
function viewSeg() {
  if (!isDrums()) return null;
  return U.seg([['steps', '스텝', '칸을 눌러 찍는 스텝 시퀀서예요. 드럼 패턴 만들기에 편해요.'], ['roll', '피아노 롤', '음 길이와 위치를 자유롭게 고치는 피아노 롤이에요.']], R.view, v => {
    R.view = v;
    U.setPref('drumView', v);
    if (root) render(root);
  }, 'view-seg');
}
function openClip() {
  R.clipId = cur.clip.id;
  R.sel = new Set();
  const drums = isDrums();
  R.fold = drums ? 'notes' : 'none';
  if (cur.clip.type === 'midi' && (R.tab === 'audio' || (R.tab === 'chords' && drums))) R.tab = 'notes';
  if (cur.clip.type === 'audio' && (R.tab === 'notes' || R.tab === 'tools')) R.tab = 'audio';
  R.needFit = true;
}
/* 패드 악기(드럼 머신·루프 패드)면 건반 대신 패드 이름을 보여 준다 */
function isDrums() {
  const inst = cur && U.instrumentOf(cur.track);
  return !!(inst && (inst.kind === 'drums' || inst.kind === 'looppad'));
}
function clip() { return cur && cur.clip; }
function changed(label, live) {
  if (live) U.touch({ clip: clip().id });
  else U.commit(label || '클립 편집');
}

/* ================= 클립 설정 칸 ================= */
function renderProps() {
  U.clear(props);
  const c = clip();
  const tabs = c.type !== 'midi' ? [['clip', '클립'], ['audio', '오디오']]
    : [['clip', '클립'], ['notes', '노트']].concat(isDrums() ? [] : [['chords', '코드']], [['tools', 'MIDI 도구']]);
  if (R.tab === 'chords' && isDrums()) R.tab = 'notes';
  props.append(U.seg(tabs, R.tab, v => { R.tab = v; U.setPref('clipTab', v); renderProps(); }, 'tabs'));
  const body = h('div', { class: 'cvp-body' });
  props.append(body);
  if (R.tab === 'clip') clipTab(body, c);
  else if (R.tab === 'notes') notesTab(body, c);
  else if (R.tab === 'audio') audioTab(body, c);
  else if (R.tab === 'chords') chordsTab(body, c);
  else toolsTab(body, c);
}
const row = (label, ...kids) => h('div', { class: 'fld-row' }, h('span', { class: 'fl', text: label }), h('div', { class: 'fv' }, ...kids));
function clipTab(body, c) {
  const name = h('input', { class: 'inp sm', value: c.name || '', placeholder: c.type === 'audio' ? '오디오' : '이름 없음', 'aria-label': '클립 이름' });
  name.addEventListener('change', () => { c.name = name.value.trim(); changed('클립 이름'); });
  name.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') name.blur(); });
  body.append(row('이름', name));
  const sw = h('div', { class: 'swatches' });
  U.COLORS.forEach((col, i) => {
    const b = h('button', { class: 'sw' + (c.color === i ? ' on' : ''), type: 'button', style: { background: col }, 'aria-label': '색 ' + (i + 1) });
    b.addEventListener('click', () => { c.color = i; changed('클립 색'); });
    sw.append(b);
  });
  body.append(row('색', sw));
  body.append(h('div', { class: 'fld-sec', text: '띄우기' }));
  body.append(row('방식', U.select([['trigger', 'Trigger'], ['gate', 'Gate'], ['toggle', 'Toggle']], c.launch, v => { c.launch = v; changed('런치 방식'); },
    { cls: 'sm', info: ['런치 방식', 'Trigger: 누르면 시작 · Gate: 누르는 동안만 재생 · Toggle: 한 번 더 누르면 멈춤'] })));
  body.append(row('퀀타이즈', U.select([['global', '전체 설정 따름']].concat(U.QUANTS.map(q => [q.id, q.name])), c.quant || 'global', v => { c.quant = v; changed('클립 퀀타이즈'); },
    { cls: 'sm', info: ['클립 퀀타이즈', '이 클립만 다른 박자 경계에서 시작하게 해요.'] })));
  const leg = btn({ text: 'Legato', cls: 'tg sm', toggle: true, on: c.legato, info: ['레가토', '켜면 이 클립을 띄울 때 앞 클립이 재생하던 위치에서 이어서 시작해요.'], onclick: () => { c.legato = !c.legato; changed('레가토'); } });
  body.append(row('', leg));
  // 팔로우 액션
  body.append(h('div', { class: 'fld-sec', text: '팔로우 액션' }));
  const f = c.follow;
  const fon = btn({ text: f.on ? '켜짐' : '꺼짐', cls: 'tg sm', toggle: true, on: f.on, info: ['팔로우 액션', '정해 둔 시간이 지나면 다음 클립이나 무작위 클립을 저절로 띄워요. 끝없이 변하는 루프를 만들 때 써요.'], onclick: () => { f.on = !f.on; changed('팔로우 액션'); } });
  body.append(row('사용', fon));
  const ftime = U.numBox({ cls: 'sm', label: '팔로우 시간', get: () => f.time, set: (v, fin) => { f.time = Math.max(0.25, v); changed('팔로우 시간', !fin); }, fmt: v => U.fmtLen(v, pr().sig), parse: s => U.parsePos(s, pr().sig, false), min: 0.25, max: 256, step: 0.25, range: 600 });
  info(ftime, '시간', '클립을 띄운 뒤 이만큼 지나면 동작해요. 마디. 박. 16분');
  body.append(row('시간', ftime));
  const ACTS = [['none', '없음'], ['stop', '정지'], ['again', '다시'], ['next', '다음'], ['prev', '이전'], ['first', '처음'], ['last', '마지막'], ['any', '아무거나'], ['other', '다른 것']];
  body.append(row('동작 A', U.select(ACTS, f.a, v => { f.a = v; changed('팔로우 동작'); }, { cls: 'sm' })));
  const ch = U.numBox({ cls: 'sm', label: 'A 확률', get: () => f.chance, set: (v, fin) => { f.chance = v; changed('팔로우 확률', !fin); }, fmt: v => Math.round(v * 100) + '% / ' + Math.round((1 - v) * 100) + '%', min: 0, max: 1, step: 0.01, range: 200 });
  info(ch, '확률', '동작 A와 B 중 A가 일어날 확률이에요.');
  body.append(row('확률 A/B', ch));
  body.append(row('동작 B', U.select(ACTS, f.b, v => { f.b = v; changed('팔로우 동작'); }, { cls: 'sm' })));
}
function lenBoxes(body, c) {
  const sig = pr().sig;
  const loop = btn({ text: 'Loop', cls: 'tg sm', toggle: true, on: c.loop.on, info: ['루프', '켜면 루프 구간을 끝없이 반복해요. 끄면 시작부터 끝까지 한 번만 재생해요.'], onclick: () => {
    c.loop.on = !c.loop.on;
    if (c.loop.on) { c.loop.start = Math.min(c.loop.start, c.end - 0.25); c.loop.end = Math.max(c.loop.start + 0.25, c.end); }
    else { c.end = c.loop.end; }
    changed('클립 루프');
  } });
  body.append(row('', loop));
  const startBox = U.numBox({ cls: 'sm', label: '시작', get: () => (c.loop.on ? c.loop.start : c.start), set: (v, f) => {
    v = Math.max(0, v);
    if (c.loop.on) { const len = c.loop.end - c.loop.start; c.loop.start = v; c.loop.end = v + len; c.start = Math.min(c.start, c.loop.end - 0.25); }
    else { c.start = Math.min(v, c.end - 0.25); }
    changed('클립 위치', !f); drawAll();
  }, fmt: v => U.fmtPos(v, sig), parse: s => U.parsePos(s, sig, true), min: 0, max: 1024, step: 0.25, range: 600 });
  info(startBox, c.loop.on ? '루프 위치' : '시작', '마디. 박. 16분 (1부터)');
  const lenBox = U.numBox({ cls: 'sm', label: '길이', get: () => (c.loop.on ? c.loop.end - c.loop.start : c.end - c.start), set: (v, f) => {
    v = Math.max(0.25, v);
    if (c.loop.on) { c.loop.end = c.loop.start + v; c.end = Math.max(c.end, c.loop.end); if (c.end > c.loop.end) c.end = c.loop.end; }
    else c.end = c.start + v;
    changed('클립 길이', !f); drawAll();
  }, fmt: v => U.fmtLen(v, sig), parse: s => U.parsePos(s, sig, false), min: 0.25, max: 1024, step: 0.25, range: 600 });
  info(lenBox, '길이', '마디. 박. 16분');
  body.append(row(c.loop.on ? '루프 위치' : '시작', startBox), row('길이', lenBox));
}
function notesTab(body, c) {
  lenBoxes(body, c);
  body.append(h('div', { class: 'fld-sec', text: '스케일' }));
  const sc = c.scale && c.scale.on;
  const k = U.clipKey(c);
  const scb = btn({ text: sc ? '클립 키' : '프로젝트 키', cls: 'tg sm', toggle: true, on: sc, info: ['스케일', '피아노 롤에서 스케일 음을 밝게 보여 주고, MIDI 도구가 이 스케일을 따라요. 켜면 이 클립만의 키를 정할 수 있어요.'], onclick: () => {
    c.scale = sc ? null : { on: true, root: pr().key.root, scale: pr().key.scale };
    changed('클립 스케일');
  } });
  body.append(row('', scb));
  if (sc) {
    body.append(row('근음', U.select(U.ROOT_NAMES.map((n, i) => [String(i), n]), String(k.root), v => { c.scale.root = +v; changed('클립 스케일'); }, { cls: 'sm' })));
    body.append(row('스케일', U.select(U.SCALES.map(s => [s.id, s.name]), k.scale, v => { c.scale.scale = v; changed('클립 스케일'); }, { cls: 'sm' })));
  } else body.append(h('p', { class: 'hint', text: U.scaleLabel(k.root, k.scale) + ' (상단 바에서 바꿔요)' }));
  const gr = btn({ text: '스윙 적용', cls: 'tg sm', toggle: true, on: c.groove !== false, info: ['스윙 적용', '상단 바의 스윙(그루브)을 이 클립에 적용할지 정해요.'], onclick: () => { c.groove = c.groove === false; changed('스윙 적용'); } });
  body.append(row('그루브', gr));
  body.append(h('div', { class: 'fld-sec', text: '편집' }));
  const ops = h('div', { class: 'ops' });
  const op = (label, inf, fn) => ops.append(btn({ text: label, cls: 'sm', info: [label, inf], onclick: fn }));
  op('×2', '음표 길이와 간격을 두 배로 늘려요 (반 빠르기).', () => scaleTime(2));
  op('÷2', '음표 길이와 간격을 반으로 줄여요 (두 배 빠르기).', () => scaleTime(0.5));
  op('루프 복제', '루프 구간을 두 배로 늘리고 내용을 한 번 더 복사해요.', dupLoop);
  op('거꾸로', '음표 순서를 시간상 거꾸로 뒤집어요.', reverseNotes);
  op('위아래', '음높이를 위아래로 뒤집어요.', invertNotes);
  op('레가토', '음을 다음 음까지 이어 붙여요.', () => runQuick('span', { mode: 'legato' }));
  op('퀀타이즈', '고른 음(없으면 전부)을 지금 격자에 맞춰요. ' + U.MOD + '+U', () => quantizeSel());
  op('스케일에 맞추기', '스케일 밖의 음을 가장 가까운 스케일 음으로 옮겨요.', fitScale);
  op('+1 옥타브', '고른 음(없으면 전부)을 한 옥타브 올려요.', () => transposeSel(12));
  op('−1 옥타브', '한 옥타브 내려요.', () => transposeSel(-12));
  body.append(ops);
}
function audioTab(body, c) {
  const sr = U.engine.ctx.sampleRate;
  const buf = U.media.cached(c.ref, sr);
  const inf = U.media.info(c.ref);
  body.append(h('p', { class: 'hint', text: (inf.name || c.ref) + (buf ? ' · ' + U.fmtTime(buf.duration) + ' · ' + buf.sampleRate + ' Hz' : '') }));
  const warp = btn({ text: 'Warp', cls: 'tg sm', toggle: true, on: c.warp, info: ['워프', '켜면 오디오를 프로젝트 템포에 맞춰 늘이거나 줄여요. 끄면 원래 속도로 재생해요.'], onclick: () => { c.warp = !c.warp; changed('워프'); } });
  body.append(row('', warp));
  body.append(row('모드', U.select([['beats', 'Beats'], ['tones', 'Tones'], ['texture', 'Texture'], ['repitch', 'Re-Pitch']], c.mode, v => { c.mode = v; changed('워프 모드'); },
    { cls: 'sm', info: ['워프 모드', 'Beats: 드럼처럼 타격이 뚜렷한 소리 · Tones: 노래나 악기 한 줄 · Texture: 패드·잡음 · Re-Pitch: 테이프처럼 빠르기와 함께 음높이도 바뀜'] })));
  const bpm = U.numBox({ cls: 'sm', label: '원래 BPM', get: () => c.bpm, set: (v, f) => { const ratio = v / c.bpm; c.bpm = v; c.end *= ratio; c.start *= ratio; c.loop.start *= ratio; c.loop.end *= ratio; changed('원래 BPM', !f); drawAll(); }, fmt: v => v.toFixed(2), min: 20, max: 999, step: 0.01, range: 2400, toN: v => (v - 20) / 979, fromN: n => U.round(20 + n * 979, 2) });
  info(bpm, 'Seg. BPM', '이 오디오가 원래 녹음된 템포예요. 맞게 넣어야 박자에 딱 붙어요.');
  const half = btn({ text: '÷2', cls: 'sm', onclick: () => { c.bpm /= 2; for (const k of ['start', 'end']) c[k] /= 2; c.loop.start /= 2; c.loop.end /= 2; changed('원래 BPM'); } });
  const dbl = btn({ text: '×2', cls: 'sm', onclick: () => { c.bpm *= 2; for (const k of ['start', 'end']) c[k] *= 2; c.loop.start *= 2; c.loop.end *= 2; changed('원래 BPM'); } });
  body.append(row('원래 BPM', bpm, half, dbl));
  const tr = U.numBox({ cls: 'sm', label: '음높이', get: () => c.trans || 0, set: (v, f) => { c.trans = v; changed('음높이', !f); }, fmt: v => (v > 0 ? '+' : '') + v + ' st', min: -24, max: 24, step: 1, def: 0, range: 300 });
  info(tr, '음높이', '빠르기는 그대로 두고 음높이만 반음 단위로 옮겨요 (Re-Pitch에서는 쓰지 않아요).');
  body.append(row('음높이', tr));
  const gain = U.numBox({ cls: 'sm', label: '게인', get: () => c.gain || 0, set: (v, f) => { c.gain = v; changed('클립 게인', !f); drawAll(); }, fmt: v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB', min: -36, max: 24, step: 0.1, def: 0, range: 300 });
  body.append(row('게인', gain));
  const rev = btn({ text: '거꾸로', cls: 'tg sm', toggle: true, on: !!c.rev, info: ['거꾸로 재생', '오디오를 뒤에서부터 재생해요.'], onclick: () => { c.rev = !c.rev; changed('거꾸로'); } });
  body.append(row('', rev));
  body.append(row('', btn({ text: '파형 편집…', cls: 'sm', info: ['파형 편집', '자르기·복사·붙여넣기·지우기, 페이드·볼륨·노멀라이즈·거꾸로를 해요.'], onclick: () => U.audioEditor.editClip(Object.assign({}, ui.clip)) })));
  lenBoxes(body, c);
}
/* ---------- 코드 넣기: 누를 때마다 넣을 자리에 화음을 넣고 다음 자리로 넘어간다 ---------- */
const CHORD_LENS = [['1', '1박'], ['2', '2박'], ['bar', '1마디'], ['2bar', '2마디']];
function chordLen() {
  const v = U.pref('chordLen', 'bar'), bar = U.barLen(pr().sig);
  return v === 'bar' ? bar : v === '2bar' ? bar * 2 : +v || bar;
}
/* 처음 넣을 자리: 빈 클립이면 루프 처음, 음이 있으면 마지막 음 뒤의 마디 첫 박 */
function chordStart(c) {
  const [a, z] = U.clipRegion(c);
  if (!c.notes.length) return a;
  const bar = U.barLen(pr().sig), end = Math.max(...c.notes.map(n => n.s + n.d));
  return Math.min(z, a + Math.max(0, Math.ceil((end - a) / bar - 1e-6)) * bar);
}
function chordsTab(body, c) {
  const CH = R.chord, KS = ui.keys, k = U.clipKey(c), sig = pr().sig;
  if (CH.clipId !== c.id) { CH.clipId = c.id; CH.pos = chordStart(c); CH.prev = null; }
  // 화음 버튼을 맨 위에: 누를 때마다 넣을 자리에 넣고 다음 자리로
  const [type, smooth, bass] = U.touchKeys.chordControls(() => { CH.prev = null; renderProps(); });
  body.append(type);
  const grid = list => h('div', { class: 'chd-grid' }, ...list.map(ch => chordBtn(c, ch)));
  body.append(h('div', { class: 'chd-l', text: U.scaleLabel(k.root, k.scale) + '의 화음' }), grid(U.chords.diatonic(k, KS.ctype)));
  const sec = U.chords.secondary(k, KS.ctype);
  if (sec.length) body.append(h('div', { class: 'chd-l', text: '끌어가는 화음 · 세컨더리 도미넌트' }), grid(sec));
  body.append(h('div', { class: 'fld-sec', text: '넣는 방법' }));
  const pos = h('span', { class: 'chd-pos', text: U.fmtPos(CH.pos, sig) });
  info(pos, '넣을 자리', '다음 화음이 들어갈 자리예요 (마디. 박. 16분). 피아노 롤에 주황 세로 줄로 보여요.');
  const back = btn({ text: '처음으로', cls: 'sm', info: ['처음으로', '넣을 자리를 루프 처음으로 되돌려요. 덮어쓰기가 켜져 있으면 다시 누르는 화음이 앞 화음을 바꿔요.'], onclick: () => { CH.pos = U.clipRegion(c)[0]; CH.prev = null; pos.textContent = U.fmtPos(CH.pos, sig); drawAll(); } });
  const over = btn({ text: '덮어쓰기', cls: 'tg sm', toggle: true, on: U.pref('chordOver', true), info: ['덮어쓰기', '켜면 넣는 자리에 이미 있던 음을 지우고 새 화음으로 바꿔요. 끄면 위에 겹쳐 넣어요.'],
    onclick: () => { const v = !U.pref('chordOver', true); U.setPref('chordOver', v); U.setPressed(over, v); } });
  body.append(row('넣을 자리', pos, back));
  body.append(row('길이', U.select(CHORD_LENS, U.pref('chordLen', 'bar'), v => U.setPref('chordLen', v), { cls: 'sm', label: '한 화음 길이', info: ['한 화음 길이', '화음 하나를 넣는 길이예요. 넣고 나면 이만큼 뒤로 넘어가요.'] }), over));
  body.append(row('짚기', smooth, bass));
  body.append(h('p', { class: 'hint', text: '차례로 누르면 코드 진행이 돼요. 하나씩 지우려면 되돌리기(' + U.MOD + '+Z). 패드 화면의 코드 패드로 쳐서 녹음해도 돼요.' }));
}
function chordBtn(c, ch) {
  const b = h('button', { type: 'button', class: 'chd-b' + (ch.primary ? ' prim' : '') + (ch.sec ? ' sec' : '') },
    h('span', { class: 'chd-n', text: ch.name }), h('span', { class: 'chd-r', text: ch.sec ? '→ ' + ch.target : ch.roman }));
  info(b, ch.name + (ch.sec ? '' : ' · ' + ch.roman), (ch.sec ? ch.target + '(으)로 끌어가는 화음이에요. ' : ch.primary ? '주요 3화음이에요. ' : '') + '눌러서 넣을 자리에 넣어요.');
  b.addEventListener('click', () => insertChord(c, ch));
  return b;
}
function insertChord(c, ch) {
  const CH = R.chord, KS = ui.keys, len = chordLen(), at = CH.pos;
  const v = U.chords.voice(ch, 62, KS.smooth ? CH.prev : null, { smooth: KS.smooth, bass: KS.bass });
  if (U.pref('chordOver', true)) c.notes = c.notes.filter(n => n.s < at - 1e-6 || n.s >= at + len - 1e-6);
  for (const p of v.all) c.notes.push({ p, s: at, d: U.round(len * 0.97, 4), v: 96 });
  c.notes.sort((x, y) => x.s - y.s || x.p - y.p);
  CH.prev = v.top;
  CH.pos = at + len;
  // 클립보다 길어지면 클립(루프 구간)을 늘린다
  if (CH.pos > U.clipRegion(c)[1] + 1e-6) { if (c.loop.on) c.loop.end = CH.pos; c.end = CH.pos; R.needFit = true; }
  R.sel = new Set();
  // 넣은 화음을 한 번 들려준다
  U.ensureAudio();
  const tid = cur.track.id;
  for (const p of v.all) U.engine.liveOn(tid, p, 96, true);
  setTimeout(() => { for (const p of v.all) U.engine.liveOff(tid, p); }, 650);
  changed('코드 넣기 · ' + ch.name);
  drawAll();
}
function toolsTab(body, c) {
  const gens = U.TOOLS.filter(t => t.kind === 'gen'), tfs = U.TOOLS.filter(t => t.kind === 'tf');
  const tool = U.TOOLS.find(t => t.id === R.tool) || gens[0];
  body.append(U.select([{ group: '만들기 (Generate)', items: gens.map(t => [t.id, t.name]) }, { group: '바꾸기 (Transform)', items: tfs.map(t => [t.id, t.name]) }], tool.id, v => { R.tool = v; renderProps(); },
    { cls: 'sm wide', label: 'MIDI 도구' }));
  body.append(h('p', { class: 'hint', text: tool.info }));
  if (!R.toolParams[tool.id]) R.toolParams[tool.id] = U.toolDefaults(tool, c, cur.track);
  const P = R.toolParams[tool.id];
  const grid = h('div', { class: 'tool-grid' });
  for (const s of tool.params) grid.append(U.control({ spec: s, get: () => P[s.id], set: v => { P[s.id] = v; } }));
  body.append(grid);
  const target = tool.kind === 'gen' ? '루프 구간에 만들기' : (R.sel.size ? '고른 음 ' + R.sel.size + '개에 적용' : '모든 음에 적용');
  const apply = btn({ text: target, cls: 'primary sm wide', onclick: () => {
    const out = U.runTool(tool, c, R.sel, P, cur.track);
    c.notes = out;
    R.sel = new Set();
    changed(tool.name);
    drawAll();
  } });
  body.append(apply);
  body.append(h('p', { class: 'hint', text: '마음에 들지 않으면 ' + U.MOD + '+Z로 되돌려요.' }));
}
function runQuick(id, params) {
  const c = clip();
  const tool = U.TOOLS.find(t => t.id === id);
  c.notes = U.runTool(tool, c, R.sel, params, cur.track);
  R.sel = new Set();
  changed(tool.name);
  drawAll();
}

/* ---------- 노트 편집 함수 ---------- */
function targetNotes() { const c = clip(); return R.sel.size ? [...R.sel] : c.notes; }
function scaleTime(f) {
  const c = clip();
  for (const n of c.notes) { n.s = U.round(n.s * f, 5); n.d = U.round(n.d * f, 5); }
  c.start *= f; c.end *= f; c.loop.start *= f; c.loop.end *= f;
  if (c.follow) c.follow.time *= f;
  changed(f > 1 ? '×2' : '÷2');
  drawAll();
}
function dupLoop() {
  const c = clip();
  const [a, b] = U.clipRegion(c);
  const len = b - a;
  const add = c.notes.filter(n => n.s >= a && n.s < b).map(n => Object.assign({}, n, { s: n.s + len }));
  c.notes = c.notes.filter(n => n.s < b || n.s >= b + len).concat(add);
  if (c.loop.on) c.loop.end = b + len;
  c.end = Math.max(c.end, b + len);
  changed('루프 복제');
  R.needFit = true;
  drawAll();
}
function reverseNotes() {
  const c = clip();
  const [a, b] = U.clipRegion(c);
  for (const n of targetNotes()) n.s = U.round(a + b - n.s - n.d, 5);
  changed('거꾸로');
  drawAll();
}
function invertNotes() {
  const ns = targetNotes();
  if (!ns.length) return;
  const lo = Math.min(...ns.map(n => n.p)), hi = Math.max(...ns.map(n => n.p));
  for (const n of ns) n.p = lo + hi - n.p;
  changed('위아래 뒤집기');
  drawAll();
}
function fitScale() {
  const k = U.clipKey(clip());
  for (const n of targetNotes()) n.p = U.snapToScale(n.p, k.root, k.scale);
  changed('스케일에 맞추기');
  drawAll();
}
function transposeSel(d) {
  for (const n of targetNotes()) n.p = clamp(n.p + d, 0, 127);
  changed('음높이 옮기기');
  drawAll();
}
function quantizeSel() {
  const g = gridStep();
  for (const n of targetNotes()) { const end = n.s + n.d; n.s = U.round(Math.round(n.s / g) * g, 5); n.d = Math.max(1 / 64, end - n.s); }
  changed('퀀타이즈');
  drawAll();
}

/* ================= 피아노 롤 ================= */
function buildRoll() {
  const c = clip();
  const drawB = btn({ icon: 'draw', cls: 'tg sm', toggle: true, on: ui.draw, title: '그리기 모드 (B)', info: ['그리기 모드', '켜면 빈 곳을 눌러 바로 음을 그리고, 끌면 격자마다 이어서 그려요. 음을 누르면 지워요.'], onclick: () => U.setDraw(!ui.draw) });
  const foldB = U.select([['none', '전체 건반'], ['notes', '쓴 음만 (폴드)'], ['scale', '스케일 음만']], R.fold, v => { R.fold = v; R.needFitY = true; drawAll(); }, { cls: 'sm', label: '건반 접기', info: ['폴드', '쓴 음이나 스케일 음만 보이게 줄을 접어요.'] });
  const gridSel = U.select([['auto', '격자: 자동'], ['1/4', '1/4'], ['1/8', '1/8'], ['1/16', '1/16'], ['1/32', '1/32']], R.grid, v => { R.grid = v; drawAll(); }, { cls: 'sm', label: '격자', info: ['격자', '음이 붙을 칸의 크기예요. ' + U.MOD + '+1/2로 좁히고 넓혀요.'] });
  const triB = btn({ text: '3연', cls: 'tg sm', toggle: true, on: R.tri, info: ['셋잇단 격자', U.MOD + '+3'], onclick: () => { R.tri = !R.tri; U.setPressed(triB, R.tri); drawAll(); } });
  const snapB = btn({ text: '스냅', cls: 'tg sm', toggle: true, on: R.snap, info: ['격자에 맞추기', U.MOD + '+4. 끈 동안 Alt를 누르면 잠깐 켜져요.'], onclick: () => { R.snap = !R.snap; U.setPressed(snapB, R.snap); } });
  const fitB = btn({ icon: 'zoomfit', cls: 'ghost sm', title: '클립에 맞춰 보기', onclick: () => { R.needFit = true; drawAll(); } });
  const label = h('span', { class: 'pr-title', text: (c.name || 'MIDI 클립') + ' · ' + U.trackLabel(pr(), cur.track) });
  const bar = h('div', { class: 'pr-bar' }, viewSeg(), drawB, foldB, gridSel, triB, snapB, fitB, h('span', { class: 'cb-flex' }), label);
  cvRuler = h('canvas', { class: 'pr-ruler' });
  cvKeys = h('canvas', { class: 'pr-keys' });
  cvGrid = h('canvas', { class: 'pr-grid', tabindex: '0' });
  cvVel = h('canvas', { class: 'pr-vel' });
  info(cvGrid, '피아노 롤', '두 번 눌러 음을 넣고, 음을 두 번 누르면 지워요. 끌어서 옮기고 끝을 끌어 길이를 바꿔요. 빈 곳을 끌면 여러 음을 골라요. 화살표로 옮기고 ' + U.MOD + '+D로 복제해요.');
  info(cvVel, '벨로시티', '막대를 위아래로 끌어 음의 세기를 바꿔요. 여러 음을 골랐으면 함께 바뀌어요.');
  info(cvKeys, '건반', '눌러서 소리를 들어 봐요. 밝은 줄이 지금 스케일의 음이에요.');
  info(cvRuler, '루프 막대', '끌어서 루프 구간을 옮기거나 양 끝을 늘여요.');
  gridWrap = h('div', { class: 'pr-main' },
    h('div', { class: 'pr-corner' }), cvRuler,
    cvKeys, cvGrid,
    h('div', { class: 'pr-vlabel', text: 'Vel' }), cvVel);
  editor.append(bar, gridWrap);
  bindRoll();
  new ResizeObserver(() => { measure(); drawAll(); }).observe(gridWrap);
  measure();
  drawAll();
}
function measure() {
  if (!gridWrap) return;
  const w = gridWrap.clientWidth - KEYS_W, hh = gridWrap.clientHeight - RULER_H - VEL_H;
  // 숨겨져 있다가 처음 보일 때 다시 맞춘다
  if (W < 100 && w >= 100) R.needFit = true;
  if (H < 60 && hh >= 60) R.needFitY = true;
  W = Math.max(50, w);
  H = Math.max(40, hh);
}
function computeRows() {
  const c = clip();
  const drums = isDrums();
  let list;
  if (R.fold === 'notes') {
    const set = new Set(c.notes.map(n => n.p));
    if (drums) for (let i = 0; i < 16; i++) set.add(36 + i);
    list = set.size ? [...set] : [60];
  } else if (R.fold === 'scale') {
    const k = U.clipKey(c);
    list = [];
    for (let p = 12; p <= 115; p++) if (U.inScale(p, k.root, k.scale)) list.push(p);
    for (const n of c.notes) if (!list.includes(n.p)) list.push(n.p);
  } else { list = []; for (let p = 0; p < 128; p++) list.push(p); }
  rows = list.sort((a, b) => b - a);
  rowOf = new Map(rows.map((p, i) => [p, i]));
}
function gridStep() {
  let g;
  if (R.grid === 'auto') {
    const cands = [0.0625, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
    g = cands.find(x => x * R.ppb >= 14) || 16;
  } else g = U.divBeats(R.grid);
  return R.tri ? g * 2 / 3 : g;
}
function snapB(b, e, mode) {
  const on = R.snap !== !!(e && e.altKey);
  if (!on) return b;
  const g = gridStep();
  return mode === 'round' ? Math.round(b / g) * g : Math.floor(b / g + 1e-6) * g;
}
const xOf = b => (b - R.x0) * R.ppb;
const bOf = x => R.x0 + x / R.ppb;
const yOfRow = i => i * R.rowH - R.scrollY;
function rowAt(y) { return Math.floor((y + R.scrollY) / R.rowH); }
function fit() {
  const c = clip();
  const [a, b] = U.clipRegion(c);
  const len = Math.max(1, b - Math.min(a, c.start));
  R.ppb = clamp((W - 16) / len, 4, 600);
  R.x0 = Math.min(a, c.start);
  R.needFit = false;
  R.needFitY = true;
}
function fitY() {
  const c = clip();
  R.needFitY = false;
  if (R.fold !== 'none') { R.rowH = clamp(Math.floor(H / Math.max(1, rows.length)), 7, 24); R.scrollY = 0; return; }
  R.rowH = 13;
  let center = 60;
  if (c.notes.length) { const ps = c.notes.map(n => n.p); center = (Math.min(...ps) + Math.max(...ps)) / 2; }
  R.scrollY = clamp((rowOf.get(Math.round(center)) || 64) * R.rowH - H / 2, 0, Math.max(0, rows.length * R.rowH - H));
}
function drawAll() {
  if (!cur || !cvGrid || !cvGrid.isConnected) return;
  if (clip().type !== 'midi') { drawWaveEditor(); return; }
  computeRows();
  if (R.needFit) fit();
  if (R.needFitY) fitY();
  R.scrollY = clamp(R.scrollY, 0, Math.max(0, rows.length * R.rowH - H));
  drawGrid(); drawKeys(); drawRulerRoll(); drawVel();
}
function rowColor(p, c, k, drums) {
  const black = [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
  if (drums) return null;
  if (U.inScale(p, k.root, k.scale)) return c.scale;
  return black ? 'rgba(0,0,0,0.12)' : null;
}
function drawGrid() {
  const c = U.colors(), cl = clip();
  const g = U.fitCanvas(cvGrid, W, H);
  g.fillStyle = c.sunk;
  g.fillRect(0, 0, W, H);
  const k = U.clipKey(cl);
  const drums = isDrums();
  const first = Math.max(0, rowAt(0)), last = Math.min(rows.length - 1, rowAt(H));
  for (let i = first; i <= last; i++) {
    const p = rows[i];
    const y = yOfRow(i);
    const rc = rowColor(p, c, k, drums);
    if (rc) { g.fillStyle = rc; g.fillRect(0, y, W, R.rowH); }
    g.fillStyle = (p % 12 === 0 && R.fold === 'none') ? c.grid2 : c.grid;
    g.fillRect(0, y + R.rowH - 1, W, 1);
  }
  // 세로 격자
  const step = gridStep(), bar = U.barLen(pr().sig);
  for (let b = Math.floor(R.x0 / step) * step; b <= bOf(W); b += step) {
    const x = Math.round(xOf(b)) + 0.5;
    const isBar = Math.abs(b / bar - Math.round(b / bar)) < 1e-6, isBeat = Math.abs(b - Math.round(b)) < 1e-6;
    g.fillStyle = isBar ? c.fg3 : isBeat ? c.grid2 : c.grid;
    g.fillRect(x, 0, 1, H);
  }
  // 클립 밖 어둡게
  const [a, z] = U.clipRegion(cl);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  if (xOf(a) > 0) g.fillRect(0, 0, xOf(a), H);
  if (xOf(z) < W) g.fillRect(xOf(z), 0, W - xOf(z), H);
  // 음표
  const col = U.colorOf(cl.color);
  for (const n of cl.notes) {
    const i = rowOf.get(n.p);
    if (i == null) continue;
    const y = yOfRow(i);
    if (y + R.rowH < 0 || y > H) continue;
    const x = xOf(n.s), w = Math.max(3, n.d * R.ppb);
    if (x > W || x + w < 0) continue;
    const sel = R.sel.has(n);
    const out = n.s < a - 1e-6 || n.s >= z - 1e-6;
    g.globalAlpha = n.m ? 0.3 : out ? 0.4 : 0.45 + 0.55 * (n.v / 127);
    g.fillStyle = sel ? c.accent : col;
    g.fillRect(x + 0.5, y + 1, w - 1, R.rowH - 2);
    g.globalAlpha = 1;
    g.strokeStyle = sel ? U.shade(c.accent.startsWith('#') ? c.accent : '#ffb547', -0.45) : U.shade(col, -0.45);
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 1.5, w - 1, R.rowH - 3);
    if (R.rowH >= 13 && w > 26 && !drums) {
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.font = '9px ' + c.mono;
      g.textBaseline = 'middle';
      g.fillText(U.noteName(n.p), x + 3, y + R.rowH / 2 + 0.5);
    }
  }
  // 코드 넣기: 다음 화음이 들어갈 자리
  if (R.tab === 'chords' && R.chord.clipId === cl.id && !drums) {
    const x = Math.round(xOf(R.chord.pos)) + 0.5;
    if (x >= 0 && x <= W) {
      g.fillStyle = c.accent;
      g.fillRect(x - 1, 0, 2, H);
      g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x, 8); g.closePath(); g.fill();
    }
  }
  if (rubber) {
    g.fillStyle = c.sel;
    g.strokeStyle = c.accent;
    const rx = Math.min(rubber.x0, rubber.x1), ry = Math.min(rubber.y0, rubber.y1);
    g.fillRect(rx, ry, Math.abs(rubber.x1 - rubber.x0), Math.abs(rubber.y1 - rubber.y0));
    g.strokeRect(rx + 0.5, ry + 0.5, Math.abs(rubber.x1 - rubber.x0), Math.abs(rubber.y1 - rubber.y0));
  }
}
function drawKeys() {
  const c = U.colors(), cl = clip();
  const g = U.fitCanvas(cvKeys, KEYS_W, H);
  g.fillStyle = c.panel;
  g.fillRect(0, 0, KEYS_W, H);
  const k = U.clipKey(cl);
  const drums = isDrums();
  const inst = drums ? U.instrumentOf(cur.track) : null;
  const first = Math.max(0, rowAt(0)), last = Math.min(rows.length - 1, rowAt(H));
  g.textBaseline = 'middle';
  for (let i = first; i <= last; i++) {
    const p = rows[i];
    const y = yOfRow(i);
    const black = [1, 3, 6, 8, 10].includes(p % 12);
    const pressed = audition && audition.p === p;
    if (drums) {
      const pad = inst.data && inst.data.pads[p - 36];
      const key = pad && U.padsUI.keyOf(inst, p - 36);
      g.fillStyle = pressed ? c.accent : pad ? c.panel2 : c.panel;
      g.fillRect(0, y, KEYS_W, R.rowH - 1);
      g.fillStyle = pad ? c.fg : c.fg3;
      g.font = '10px ' + c.font;
      if (R.rowH >= 9) g.fillText(pad ? (pad.name || '패드 ' + (p - 35)) : U.noteName(p), 4, y + R.rowH / 2);
      if (key && R.rowH >= 9) {
        g.fillStyle = c.fg3;
        g.textAlign = 'right';
        g.fillText(U.keyLabel(key), KEYS_W - 4, y + R.rowH / 2);
        g.textAlign = 'left';
      }
      continue;
    }
    g.fillStyle = pressed ? c.accent : black ? c.keyBlack : c.key;
    g.fillRect(0, y, black ? KEYS_W * 0.62 : KEYS_W, R.rowH - (black ? 1 : 0));
    if (U.inScale(p, k.root, k.scale)) { g.fillStyle = c.accent; g.globalAlpha = 0.65; g.fillRect(KEYS_W - 4, y + 1, 3, R.rowH - 2); g.globalAlpha = 1; }
    g.fillStyle = c.line;
    g.fillRect(0, y + R.rowH - 1, KEYS_W, 1);
    if ((p % 12 === 0 || R.fold !== 'none') && R.rowH >= 9) {
      g.fillStyle = black ? c.fg2 : '#2a2c30';
      g.font = '10px ' + c.mono;
      g.fillText(U.noteName(p), KEYS_W * (black ? 0.66 : 0.5), y + R.rowH / 2);
    }
  }
}
function drawRulerRoll() {
  const c = U.colors(), cl = clip();
  const g = U.fitCanvas(cvRuler, W, RULER_H);
  g.fillStyle = c.panel2;
  g.fillRect(0, 0, W, RULER_H);
  const [a, z] = U.clipRegion(cl);
  g.fillStyle = cl.loop.on ? c.accent : c.fg3;
  g.globalAlpha = cl.loop.on ? 0.85 : 0.45;
  g.fillRect(xOf(a), 2, xOf(z) - xOf(a), 7);
  g.globalAlpha = 1;
  // 시작 표시
  g.fillStyle = c.fg;
  const sx = xOf(cl.start);
  g.beginPath(); g.moveTo(sx, 10); g.lineTo(sx + 6, 10); g.lineTo(sx, 17); g.closePath(); g.fill();
  const sig = pr().sig, bar = U.barLen(sig);
  g.font = '10px ' + c.mono;
  g.textBaseline = 'top';
  let step = 1;
  while (step * R.ppb < 32) step *= 2;
  for (let b = Math.floor(R.x0 / step) * step; b <= bOf(W); b += step) {
    if (b < 0) continue;
    const x = Math.round(xOf(b)) + 0.5;
    g.fillStyle = c.fg3;
    g.fillRect(x, 12, 1, RULER_H - 12);
    const barN = Math.floor(b / bar + 1e-6) + 1, beatN = Math.round((b - (barN - 1) * bar) / U.beatUnit(sig)) + 1;
    g.fillStyle = c.fg2;
    g.fillText(beatN === 1 ? String(barN) : barN + '.' + beatN, x + 3, 11);
  }
}
function drawVel() {
  const c = U.colors(), cl = clip();
  const g = U.fitCanvas(cvVel, W, VEL_H);
  g.fillStyle = c.panel;
  g.fillRect(0, 0, W, VEL_H);
  g.fillStyle = c.grid2;
  g.fillRect(0, 0, W, 1);
  const col = U.colorOf(cl.color);
  for (const n of cl.notes) {
    const x = xOf(n.s);
    if (x < -4 || x > W + 4) continue;
    const y = 4 + (1 - n.v / 127) * (VEL_H - 8);
    const sel = R.sel.has(n);
    g.fillStyle = sel ? c.accent : col;
    g.globalAlpha = n.m ? 0.35 : 1;
    g.fillRect(Math.round(x), y, 2, VEL_H - y - 2);
    g.beginPath(); g.arc(x + 1, y, 3, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
}
/* 재생 위치 (매 프레임) */
let lastPh = null;
function playheadBeat() {
  const e = U.engine;
  if (!cur || !e || !e.playing) return null;
  const c = clip();
  if (cur.slot != null) {
    const st = e.clipState(cur.track.id);
    if (!st || st.playing !== cur.slot || st.pos == null) return null;
    return st.pos;
  }
  if (cur.arr) {
    const a = e.arrPos(e.heardBeat());
    const node = e.nodes.get(cur.track.id);
    if (node && node.override) return null;
    if (a < cur.arr.pos || a >= cur.arr.pos + cur.arr.dur) return null;
    return e.clipPos(c, (a - cur.arr.pos) / U.clipScale(c, e.bpm) + cur.arr.off);
  }
  return null;
}
U.frame(() => {
  if (!cur || !root || root.offsetParent === null) return;
  const cv = clip().type === 'midi' ? cvGrid : cvWave;
  if (!cv || !cv.isConnected) return;
  const b = playheadBeat();
  const ph = root.querySelector('.cv-playhead');
  if (b == null) { if (ph) ph.style.display = 'none'; lastPh = null; return; }
  let el = ph;
  if (!el) { el = h('div', { class: 'cv-playhead' }); cv.parentElement.append(el); }
  const x = (clip().type === 'midi' ? xOf(b) : xOfW(b));
  el.style.display = x >= 0 && x <= (clip().type === 'midi' ? W : WW) ? 'block' : 'none';
  el.style.left = (cv.offsetLeft + x) + 'px';
  el.style.top = cv.offsetTop + 'px';
  el.style.height = cv.offsetHeight + 'px';
  lastPh = b;
});

/* ---------- 피아노 롤 조작 ---------- */
function hitNote(x, y) {
  const i = rowAt(y);
  const p = rows[i];
  if (p == null) return null;
  const cl = clip();
  for (let k = cl.notes.length - 1; k >= 0; k--) {
    const n = cl.notes[k];
    if (n.p !== p) continue;
    const x0 = xOf(n.s), x1 = x0 + Math.max(3, n.d * R.ppb);
    if (x >= x0 - 1 && x <= x1 + 1) {
      const edge = Math.min(U.isTouch ? 14 : 6, (x1 - x0) / 3);
      return { n, zone: x1 - x < edge ? 'r' : x - x0 < edge && x1 - x0 > 12 ? 'l' : 'body' };
    }
  }
  return null;
}
function previewPitch(p, v) {
  U.ensureAudio();
  const e = U.engine;
  if (audition) e.liveOff(cur.track.id, audition.p);
  audition = { p };
  e.liveOn(cur.track.id, p, v || 100, true);
  drawKeys();
}
function stopPreview() {
  if (!audition) return;
  U.engine.liveOff(cur.track.id, audition.p);
  audition = null;
  drawKeys();
}
function bindRoll() {
  cvGrid.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    ui.focus = 'roll';
    cvGrid.focus({ preventScroll: true });
    const r = cvGrid.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const cl = clip();
    const hit = hitNote(x, y);
    if (ui.draw && hit) {
      cl.notes = cl.notes.filter(n => n !== hit.n);
      R.sel.delete(hit.n);
      changed('음 지우기');
      drawAll();
      return;
    }
    if (hit) { noteDrag(e, hit, r); return; }
    if (ui.draw) { paint(e, r); return; }
    // 빈 곳: 고르기 상자
    if (!e.shiftKey) R.sel = new Set();
    rubber = { x0: x, y0: y, x1: x, y1: y };
    cvGrid.setPointerCapture(e.pointerId);
    const base = new Set(R.sel);
    const move = ev => {
      rubber.x1 = ev.clientX - r.left; rubber.y1 = ev.clientY - r.top;
      const b0 = bOf(Math.min(rubber.x0, rubber.x1)), b1 = bOf(Math.max(rubber.x0, rubber.x1));
      const i0 = rowAt(Math.min(rubber.y0, rubber.y1)), i1 = rowAt(Math.max(rubber.y0, rubber.y1));
      R.sel = new Set(base);
      for (const n of cl.notes) {
        const i = rowOf.get(n.p);
        if (i >= i0 && i <= i1 && n.s < b1 && n.s + n.d > b0) R.sel.add(n);
      }
      drawGrid(); drawVel();
    };
    const up = () => {
      cvGrid.removeEventListener('pointermove', move);
      cvGrid.removeEventListener('pointerup', up);
      rubber = null;
      drawGrid(); drawVel();
      if (R.tab === 'tools') renderProps();
    };
    cvGrid.addEventListener('pointermove', move);
    cvGrid.addEventListener('pointerup', up);
  });
  cvGrid.addEventListener('dblclick', e => {
    if (ui.draw) return;
    const r = cvGrid.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const cl = clip();
    const hit = hitNote(x, y);
    if (hit) { cl.notes = cl.notes.filter(n => n !== hit.n); R.sel.delete(hit.n); changed('음 지우기'); drawAll(); return; }
    const p = rows[rowAt(y)];
    if (p == null) return;
    const g = gridStep();
    const n = { p, s: U.round(snapB(bOf(x), e), 5), d: g, v: 100 };
    cl.notes.push(n);
    R.sel = new Set([n]);
    changed('음 넣기');
    drawAll();
  });
  cvGrid.addEventListener('pointermove', e => {
    if (e.buttons) return;
    const r = cvGrid.getBoundingClientRect();
    const hit = hitNote(e.clientX - r.left, e.clientY - r.top);
    cvGrid.style.cursor = ui.draw ? (hit ? 'not-allowed' : 'crosshair') : hit ? (hit.zone === 'body' ? 'move' : 'ew-resize') : 'default';
  });
  cvGrid.addEventListener('contextmenu', e => {
    e.preventDefault();
    const r = cvGrid.getBoundingClientRect();
    const hit = hitNote(e.clientX - r.left, e.clientY - r.top);
    if (hit && !R.sel.has(hit.n)) { R.sel = new Set([hit.n]); drawAll(); }
    U.menu([
      { label: '퀀타이즈', key: U.MOD + '+U', action: quantizeSel },
      { label: '복제', key: U.MOD + '+D', action: duplicateSel, disabled: !R.sel.size },
      { label: '켜기/끄기 (뮤트)', key: '0', action: muteSel, disabled: !R.sel.size },
      { label: '레가토', action: () => runQuick('span', { mode: 'legato' }) },
      { label: '스케일에 맞추기', action: fitScale },
      { sep: true },
      { label: '모두 고르기', key: U.MOD + '+A', action: selectAll },
      { label: '지우기', key: 'Del', danger: true, action: deleteSel, disabled: !R.sel.size }
    ], { x: e.clientX, y: e.clientY });
  });
  const wheel = e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const r = cvGrid.getBoundingClientRect();
      const x = clamp(e.clientX - r.left, 0, W);
      const b = bOf(x);
      R.ppb = clamp(R.ppb * Math.exp(-e.deltaY * 0.0025), 4, 900);
      R.x0 = b - x / R.ppb;
      drawAll();
      return;
    }
    e.preventDefault();
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) R.x0 += (e.shiftKey ? e.deltaY : e.deltaX) / R.ppb;
    else if (e.altKey) R.rowH = clamp(R.rowH * Math.exp(-e.deltaY * 0.003), 6, 30);
    else R.scrollY += e.deltaY;
    drawAll();
  };
  cvGrid.addEventListener('wheel', wheel, { passive: false });
  cvKeys.addEventListener('wheel', wheel, { passive: false });
  cvVel.addEventListener('wheel', wheel, { passive: false });
  cvRuler.addEventListener('wheel', wheel, { passive: false });
  // 두 손가락: 밀면 스크롤, 가로로 벌리면 시간 확대, 세로로 벌리면 줄 높이
  U.gestures.pan(gridWrap, {
    pan: (dx, dy) => { R.x0 = Math.max(-2, R.x0 - dx / R.ppb); R.scrollY -= dy; drawAll(); },
    zoom: z => {
      if (z.fx !== 1) {
        const x = clamp(z.x - KEYS_W, 0, W), b = bOf(x);
        R.ppb = clamp(R.ppb * z.fx, 4, 900);
        R.x0 = b - x / R.ppb;
      }
      if (z.fy !== 1 && R.fold === 'none') {
        const y = clamp(z.y - RULER_H, 0, H), row = (R.scrollY + y) / R.rowH;
        R.rowH = clamp(R.rowH * z.fy, 6, 30);
        R.scrollY = row * R.rowH - y;
      }
      drawAll();
    }
  });
  // 건반 미리 듣기
  cvKeys.addEventListener('pointerdown', e => {
    const r = cvKeys.getBoundingClientRect();
    const p = rows[rowAt(e.clientY - r.top)];
    if (p == null) return;
    cvKeys.setPointerCapture(e.pointerId);
    previewPitch(p, 100);
    const move = ev => { const q = rows[rowAt(ev.clientY - r.top)]; if (q != null && (!audition || audition.p !== q)) previewPitch(q, 100); };
    const up = () => { stopPreview(); cvKeys.removeEventListener('pointermove', move); cvKeys.removeEventListener('pointerup', up); };
    cvKeys.addEventListener('pointermove', move);
    cvKeys.addEventListener('pointerup', up);
  });
  // 벨로시티 줄
  cvVel.addEventListener('pointerdown', e => {
    const r = cvVel.getBoundingClientRect();
    const x = e.clientX - r.left;
    const cl = clip();
    let best = null, bd = 8;
    for (const n of cl.notes) { const d = Math.abs(xOf(n.s) - x); if (d < bd) { bd = d; best = n; } }
    if (!best) return;
    const group = R.sel.has(best) ? [...R.sel] : [best];
    const v0 = group.map(n => n.v);
    const y0 = e.clientY;
    cvVel.setPointerCapture(e.pointerId);
    const move = ev => {
      const dv = (y0 - ev.clientY) / (VEL_H - 8) * 127;
      group.forEach((n, i) => { n.v = clamp(Math.round(v0[i] + dv), 1, 127); });
      U.setInfo('벨로시티', group.length === 1 ? String(group[0].v) : group.length + '개 음 · ' + (dv > 0 ? '+' : '') + Math.round(dv));
      drawVel(); drawGrid();
    };
    const up = () => { cvVel.removeEventListener('pointermove', move); cvVel.removeEventListener('pointerup', up); changed('벨로시티'); };
    cvVel.addEventListener('pointermove', move);
    cvVel.addEventListener('pointerup', up);
  });
  // 루프 막대
  cvRuler.addEventListener('pointerdown', e => {
    const r = cvRuler.getBoundingClientRect();
    const x = e.clientX - r.left;
    const cl = clip();
    const [a, z] = U.clipRegion(cl);
    const xa = xOf(a), xz = xOf(z);
    let mode = Math.abs(x - xa) < 6 ? 'a' : Math.abs(x - xz) < 6 ? 'z' : x > xa && x < xz ? 'move' : null;
    if (!mode) return;
    cvRuler.setPointerCapture(e.pointerId);
    const b0 = bOf(x);
    const move = ev => {
      const b = bOf(ev.clientX - r.left);
      const g = gridStep();
      const sn = v => Math.round(v / g) * g;
      if (mode === 'move') { const d = sn(b - b0); setRegion(Math.max(0, a + d), Math.max(0, a + d) + (z - a)); }
      else if (mode === 'a') setRegion(clamp(sn(b), 0, z - g), z);
      else setRegion(a, Math.max(a + g, sn(b)));
      changed('루프 구간', true);
      drawAll();
    };
    const up = () => { cvRuler.removeEventListener('pointermove', move); cvRuler.removeEventListener('pointerup', up); changed('루프 구간'); };
    cvRuler.addEventListener('pointermove', move);
    cvRuler.addEventListener('pointerup', up);
  });
  cvRuler.addEventListener('pointermove', e => {
    const r = cvRuler.getBoundingClientRect();
    const x = e.clientX - r.left;
    const [a, z] = U.clipRegion(clip());
    cvRuler.style.cursor = Math.abs(x - xOf(a)) < 6 || Math.abs(x - xOf(z)) < 6 ? 'ew-resize' : x > xOf(a) && x < xOf(z) ? 'grab' : 'default';
  });
}
function setRegion(a, z) {
  const c = clip();
  if (c.loop.on) { c.loop.start = a; c.loop.end = z; if (c.start > z - 0.0625) c.start = a; }
  else { c.start = a; c.end = z; }
}
function noteDrag(e, hit, r) {
  const cl = clip();
  if (!R.sel.has(hit.n)) { if (!e.shiftKey) R.sel = new Set(); R.sel.add(hit.n); }
  else if (e.shiftKey) { R.sel.delete(hit.n); drawAll(); return; }
  let group = [...R.sel];
  if (e.altKey && hit.zone === 'body') {
    const copies = group.map(n => Object.assign({}, n));
    cl.notes.push(...copies);
    // 원본은 그 자리에 두고 복사본을 옮긴다
    const map = new Map(group.map((n, i) => [n, copies[i]]));
    R.sel = new Set(copies);
    hit = { n: map.get(hit.n), zone: 'body' };
    group = copies;
  }
  const orig = group.map(n => ({ n, s: n.s, d: n.d, p: n.p }));
  const b0 = bOf(e.clientX - r.left), i0 = rowAt(e.clientY - r.top);
  let moved = false;
  previewPitch(hit.n.p, hit.n.v);
  cvGrid.setPointerCapture(e.pointerId);
  const lead = orig.find(o => o.n === hit.n);
  const move = ev => {
    const b = bOf(ev.clientX - r.left), i = rowAt(ev.clientY - r.top);
    if (!moved && Math.abs((b - b0) * R.ppb) < 3 && i === i0) return;
    moved = true;
    if (hit.zone === 'body') {
      const ns = snapB(lead.s + (b - b0), ev, 'round');
      let db = ns - lead.s;
      db = Math.max(db, -Math.min(...orig.map(o => o.s)));
      const dRows = i - i0;
      for (const o of orig) {
        o.n.s = U.round(o.s + db, 5);
        const ri = clamp((rowOf.get(o.p) || 0) + dRows, 0, rows.length - 1);
        o.n.p = rows[ri];
      }
      if (audition && audition.p !== hit.n.p) previewPitch(hit.n.p, hit.n.v);
    } else if (hit.zone === 'r') {
      const end = snapB(lead.s + lead.d + (b - b0), ev, 'round');
      const dd = end - (lead.s + lead.d);
      for (const o of orig) o.n.d = Math.max(1 / 64, U.round(o.d + dd, 5));
    } else {
      const ns = snapB(lead.s + (b - b0), ev, 'round');
      const ds = ns - lead.s;
      for (const o of orig) { const end = o.s + o.d; o.n.s = U.round(Math.min(end - 1 / 64, Math.max(0, o.s + ds)), 5); o.n.d = U.round(end - o.n.s, 5); }
    }
    U.touch({ clip: cl.id });
    drawGrid(); drawVel();
    if (R.fold === 'notes') { /* 옮긴 줄이 사라지지 않게 */ }
  };
  const up = () => {
    cvGrid.removeEventListener('pointermove', move);
    cvGrid.removeEventListener('pointerup', up);
    stopPreview();
    if (moved || e.altKey) changed(hit.zone === 'body' ? (e.altKey ? '음 복사' : '음 옮기기') : '음 길이');
    else if (!e.shiftKey) { R.sel = new Set([hit.n]); }
    drawAll();
    if (R.tab === 'tools') renderProps();
  };
  cvGrid.addEventListener('pointermove', move);
  cvGrid.addEventListener('pointerup', up);
}
/* 그리기 모드: 끌면 격자마다 음을 찍는다 */
function paint(e, r) {
  const cl = clip();
  const i = rowAt(e.clientY - r.top);
  const p = rows[i];
  if (p == null) return;
  const g = gridStep();
  const made = new Map();
  const put = x => {
    const s = U.round(snapB(bOf(x), e), 5);
    if (made.has(s) || s < 0) return;
    if (cl.notes.some(n => n.p === p && Math.abs(n.s - s) < 1e-6)) return;
    const n = { p, s, d: g, v: 100 };
    cl.notes.push(n);
    made.set(s, n);
  };
  put(e.clientX - r.left);
  previewPitch(p, 100);
  drawAll();
  cvGrid.setPointerCapture(e.pointerId);
  const move = ev => { put(ev.clientX - r.left); drawGrid(); drawVel(); };
  const up = () => {
    cvGrid.removeEventListener('pointermove', move);
    cvGrid.removeEventListener('pointerup', up);
    stopPreview();
    R.sel = new Set(made.values());
    changed('음 그리기');
    drawAll();
  };
  cvGrid.addEventListener('pointermove', move);
  cvGrid.addEventListener('pointerup', up);
}

/* ---------- 단축키에서 부르는 편집 ---------- */
function selectAll() { R.sel = new Set(clip().notes); drawAll(); }
function deleteSel() {
  if (!R.sel.size) return false;
  const c = clip();
  c.notes = c.notes.filter(n => !R.sel.has(n));
  R.sel = new Set();
  changed('음 지우기');
  drawAll();
  return true;
}
function duplicateSel() {
  if (!R.sel.size) return false;
  const c = clip();
  const ns = [...R.sel];
  const lo = Math.min(...ns.map(n => n.s)), hi = Math.max(...ns.map(n => n.s + n.d));
  const span = Math.ceil((hi - lo) / gridStep() - 1e-6) * gridStep();
  const copies = ns.map(n => Object.assign({}, n, { s: U.round(n.s + span, 5) }));
  c.notes.push(...copies);
  R.sel = new Set(copies);
  const [, z] = U.clipRegion(c);
  if (hi + span > z && c.loop.on) { c.loop.end = Math.ceil((hi + span) / U.barLen(pr().sig)) * U.barLen(pr().sig); c.end = Math.max(c.end, c.loop.end); }
  changed('음 복제');
  drawAll();
  return true;
}
function muteSel() {
  if (!R.sel.size) return false;
  const all = [...R.sel].every(n => n.m);
  for (const n of R.sel) { if (all) delete n.m; else n.m = 1; }
  changed('음 켜기/끄기');
  drawAll();
  return true;
}
function nudge(dx, dp) {
  const ns = [...R.sel];
  if (!ns.length) return false;
  const g = gridStep();
  for (const n of ns) { n.s = Math.max(0, U.round(n.s + dx * g, 5)); n.p = clamp(n.p + dp, 0, 127); }
  if (dp && ns.length === 1) { previewPitch(ns[0].p, ns[0].v); setTimeout(stopPreview, 180); }
  changed(dp ? '음높이 옮기기' : '음 옮기기');
  drawAll();
  return true;
}
let clipboard = null;
function copySel(cut) {
  if (!R.sel.size) return false;
  const ns = [...R.sel];
  const lo = Math.min(...ns.map(n => n.s));
  clipboard = ns.map(n => Object.assign({}, n, { s: n.s - lo }));
  if (cut) deleteSel();
  return true;
}
function paste() {
  if (!clipboard || !clipboard.length) return false;
  const c = clip();
  const ph = playheadBeat();
  const at = ph != null ? snapB(ph) : R.sel.size ? Math.max(...[...R.sel].map(n => n.s + n.d)) : U.clipRegion(c)[0];
  const copies = clipboard.map(n => Object.assign({}, n, { s: U.round(n.s + at, 5) }));
  c.notes.push(...copies);
  R.sel = new Set(copies);
  changed('붙여넣기');
  drawAll();
  return true;
}
function gridNarrow(f) {
  const order = ['1/4', '1/8', '1/16', '1/32'];
  let i = order.indexOf(R.grid === 'auto' ? (gridStep() >= 1 ? '1/4' : gridStep() >= 0.5 ? '1/8' : gridStep() >= 0.25 ? '1/16' : '1/32') : R.grid);
  i = clamp(i + f, 0, order.length - 1);
  R.grid = order[i];
  U.toast('격자 ' + R.grid);
  render(root);
}

/* ================= 오디오 파형 편집 ================= */
let cvWave = null, WW = 400, wv = { ppb: 40, x0: 0 };
const xOfW = b => (b - wv.x0) * wv.ppb;
function buildWave() {
  const c = clip();
  const label = h('span', { class: 'pr-title', text: (c.name || '오디오') + ' · ' + U.trackLabel(pr(), cur.track) + ' · ' + (c.warp ? 'Warp ' + c.mode : '원래 속도') });
  const fitB = btn({ icon: 'zoomfit', cls: 'ghost sm', title: '전체 보기', onclick: () => { wv.fit = true; drawWaveEditor(); } });
  const editB = btn({ text: '파형 편집', cls: 'sm', info: ['파형 편집', '이 오디오를 자르고 붙이고, 페이드·볼륨·노멀라이즈·거꾸로를 해요. 저장하면 새 오디오가 되고 원래 소리는 되돌리기로 돌아와요.'], onclick: () => U.audioEditor.editClip(Object.assign({}, ui.clip)) });
  const bar = h('div', { class: 'pr-bar' }, fitB, editB, h('span', { class: 'cb-flex' }), label);
  cvWave = h('canvas', { class: 'wave-cv' });
  info(cvWave, '오디오 클립', '위쪽 띠를 끌어 루프 구간을 옮기고 늘여요. 세로선은 원래 템포 기준의 박이에요. 워프와 템포는 왼쪽에서 바꿔요.');
  const wrap = h('div', { class: 'wave-wrap' }, cvWave);
  editor.append(bar, wrap);
  wv.fit = true;
  new ResizeObserver(() => drawWaveEditor()).observe(wrap);
  bindWave();
  drawWaveEditor();
}
function drawWaveEditor() {
  if (!cvWave || !cvWave.isConnected) return;
  const c = clip();
  const wrap = cvWave.parentElement;
  WW = Math.max(50, wrap.clientWidth);
  const HH = Math.max(60, wrap.clientHeight);
  const col = U.colors();
  const g = U.fitCanvas(cvWave, WW, HH);
  g.fillStyle = col.sunk;
  g.fillRect(0, 0, WW, HH);
  const sr = U.engine.ctx.sampleRate;
  const buf = U.media.cached(c.ref, sr);
  if (!buf) {
    U.media.get(c.ref, sr).then(() => drawWaveEditor(), err => { g.fillStyle = col.rec; g.fillText(err.missing ? '이 브라우저에 오디오 파일이 없어요. 같은 파일을 다시 가져와 주세요.' : '오디오를 불러오지 못했어요.', 12, 30); });
    g.fillStyle = col.fg2; g.font = '12px ' + col.font; g.fillText('불러오는 중…', 12, 30);
    return;
  }
  const total = buf.duration * c.bpm / 60;
  if (wv.fit) { wv.ppb = (WW - 10) / total; wv.x0 = 0; wv.fit = false; }
  const top = 18;
  // 루프 띠
  const [a, z] = U.clipRegion(c);
  g.fillStyle = c.loop.on ? col.accent : col.fg3;
  g.globalAlpha = c.loop.on ? 0.85 : 0.45;
  g.fillRect(xOfW(a), 3, xOfW(z) - xOfW(a), 8);
  g.globalAlpha = 1;
  // 박 눈금
  const bar = U.barLen(pr().sig);
  g.font = '10px ' + col.mono;
  for (let b = Math.max(0, Math.floor(wv.x0)); b <= wv.x0 + WW / wv.ppb; b++) {
    const x = Math.round(xOfW(b)) + 0.5;
    const isBar = b % bar === 0;
    g.fillStyle = isBar ? col.fg3 : col.grid2;
    g.fillRect(x, top, 1, HH - top);
    if (isBar && wv.ppb * bar > 30) { g.fillStyle = col.fg2; g.fillText(String(b / bar + 1), x + 3, top + 10); }
  }
  // 파형
  const pk = U.media.peaks(c.ref, buf, 8192);
  const N = 8192;
  const mid = top + (HH - top) / 2, amp = (HH - top) / 2 - 4;
  const colr = U.colorOf(c.color);
  const gain = U.dbToGain(c.gain || 0);
  for (let x = 0; x < WW; x++) {
    const b = wv.x0 + x / wv.ppb;
    if (b < 0 || b > total) continue;
    let sec = b * 60 / c.bpm;
    if (c.rev) sec = buf.duration - sec;
    const i0 = Math.floor(sec / buf.duration * N);
    const i1 = Math.max(i0 + 1, Math.floor((sec + 60 / c.bpm / wv.ppb) / buf.duration * N));
    let lo = 0, hi = 0;
    for (let i = Math.max(0, i0); i < Math.min(N, i1); i++) { lo = Math.min(lo, pk[i * 2]); hi = Math.max(hi, pk[i * 2 + 1]); }
    const inside = b >= a && b < z;
    g.fillStyle = inside ? colr : col.fg3;
    g.fillRect(x, mid - hi * amp * gain, 1, Math.max(1, (hi - lo) * amp * gain));
  }
  // 바깥 어둡게, 시작 표시
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, top, Math.max(0, xOfW(a)), HH - top);
  g.fillRect(xOfW(z), top, WW - xOfW(z), HH - top);
  g.fillStyle = col.fg;
  const sx = xOfW(c.start);
  g.beginPath(); g.moveTo(sx, 12); g.lineTo(sx + 6, 12); g.lineTo(sx, 19); g.closePath(); g.fill();
}
function bindWave() {
  cvWave.addEventListener('pointerdown', e => {
    const r = cvWave.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (y > 16) return;
    const c = clip();
    const [a, z] = U.clipRegion(c);
    const grab = U.isTouch ? 14 : 6;
    const mode = Math.abs(x - xOfW(a)) < grab ? 'a' : Math.abs(x - xOfW(z)) < grab ? 'z' : x > xOfW(a) && x < xOfW(z) ? 'move' : null;
    if (!mode) return;
    cvWave.setPointerCapture(e.pointerId);
    const b0 = (x / wv.ppb) + wv.x0;
    const move = ev => {
      const b = (ev.clientX - r.left) / wv.ppb + wv.x0;
      const sn = v => Math.round(v * 4) / 4;
      if (mode === 'move') { const d = sn(b - b0); setRegion(Math.max(0, a + d), Math.max(0, a + d) + (z - a)); }
      else if (mode === 'a') setRegion(clamp(sn(b), 0, z - 0.25), z);
      else setRegion(a, Math.max(a + 0.25, sn(b)));
      changed('루프 구간', true);
      drawWaveEditor();
    };
    const up = () => { cvWave.removeEventListener('pointermove', move); cvWave.removeEventListener('pointerup', up); changed('루프 구간'); };
    cvWave.addEventListener('pointermove', move);
    cvWave.addEventListener('pointerup', up);
  });
  U.gestures.pan(cvWave, {
    pan: dx => { wv.x0 = Math.max(0, wv.x0 - dx / wv.ppb); drawWaveEditor(); },
    zoom: z => {
      if (z.fx === 1) return;
      const b = z.x / wv.ppb + wv.x0;
      wv.ppb = clamp(wv.ppb * z.fx, 2, 800);
      wv.x0 = Math.max(0, b - z.x / wv.ppb);
      drawWaveEditor();
    }
  });
  cvWave.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const r = cvWave.getBoundingClientRect();
      const x = e.clientX - r.left, b = x / wv.ppb + wv.x0;
      wv.ppb = clamp(wv.ppb * Math.exp(-e.deltaY * 0.0025), 2, 800);
      wv.x0 = Math.max(0, b - x / wv.ppb);
    } else wv.x0 = Math.max(0, wv.x0 + (e.deltaX || e.deltaY) / wv.ppb);
    drawWaveEditor();
  }, { passive: false });
}

U.on('media', () => { if (cur && clip() && clip().type === 'audio') drawWaveEditor(); });
U.clipView = {
  render, drawAll, selectAll, deleteSel, duplicateSel, muteSel, nudge, copySel, paste, quantizeSel, gridNarrow, viewSeg, playhead: playheadBeat,
  get open() { return !!(cur && clip()); }, get midi() { return !!(cur && clip() && clip().type === 'midi'); },
  toggleTri() { R.tri = !R.tri; drawAll(); }, toggleSnap() { R.snap = !R.snap; U.toast(R.snap ? '스냅 켬' : '스냅 끔'); }
};
})(window.U = window.U || {});
