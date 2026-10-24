/* 울림 — 화면 디자인: A 컨트롤 룸 · B 스텝 가이드 · C 작업대.
   세션·어레인지먼트·패드·장치·클립·브라우저·믹서는 그대로 두고, 디자인마다 놓는 자리와 모양만 바꾼다.
   휴대폰처럼 좁은 화면은 디자인과 상관없이 한 칸씩 보이는 화면을 쓴다 */
(function (U) {
'use strict';
const { h, ui, icon, btn, info } = U;
const A = U.act;
const pr = () => U.project;
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+v) || lo));

const DESIGNS = [
  { id: 'a', letter: 'A', name: '컨트롤 룸', tag: '한 화면에 다',
    desc: '세션·곡·패드를 위쪽 버튼으로 바꾸고, 오른쪽에는 고른 트랙의 소리, 아래에는 클립 편집이 늘 함께 보여요. 컴퓨터로 빠르게 작업할 때 좋아요.' },
  { id: 'b', letter: 'B', name: '스텝 가이드', tag: '단계별로',
    desc: '만들기 → 소리 → 곡 짜기 → 믹스 → 내보내기 순서로, 한 번에 한 가지 일만 크게 보여요. 처음 쓰거나 손가락으로 쓸 때 좋아요.' },
  { id: 'c', letter: 'C', name: '작업대', tag: '곡 지도 + 단계 탭',
    desc: '위에는 곡 전체(타임라인이나 클립 런처)가 늘 보이고, 아래 작업대는 연주·소리·편집·믹스·내보내기 탭으로 바뀌어요.' }
];
const IDS = DESIGNS.map(d => d.id);
const STEPS = [
  { label: '만들기', icon: 'pads', title: '두드리며 만들기', guide: '패드나 건반을 쳐 보세요. 트랙의 녹음 준비를 켜고 녹음하면 친 그대로 클립이 돼요. 클립 편집으로 바꾸면 스텝·피아노 롤로 고쳐요.' },
  { label: '소리', icon: 'sound', title: '소리 고르고 다듬기', guide: '왼쪽에서 사운드를 두 번 누르면 고른 트랙의 소리가 바뀌어요. 오른쪽 손잡이로 다듬고, 마음에 들면 내 사운드로 남겨요.' },
  { label: '곡 짜기', icon: 'arrange', title: '부분을 만들고 이어 붙이기', guide: '씬(가로 한 줄)을 띄워 들어 보고, 타임라인에 순서대로 늘어놓아 곡을 만들어요. 클립을 누르면 아래에서 고쳐요.' },
  { label: '믹스', icon: 'mixer', title: '크기와 울림 맞추기', guide: '페이더로 트랙끼리 크기를 맞추고, 센드로 리턴 트랙의 리버브·딜레이를 더해요.' },
  { label: '내보내기', icon: 'download', title: '파일로 받기', guide: '다 만든 곡을 WAV나 MIDI 파일로 받거나, 프로젝트 파일로 다른 기기에 옮겨요.' }
];
const TABS = [
  { label: '연주', icon: 'pads', hint: '패드와 건반으로 쳐요. 녹음 준비를 켜고 녹음하면 친 그대로 클립이 돼요.' },
  { label: '소리', icon: 'sound', hint: '왼쪽에서 사운드를 고르고, 장치의 손잡이로 다듬어요.' },
  { label: '편집', icon: 'clip', hint: '고른 클립의 음표·스텝·파형을 고쳐요. 곡 지도에서 클립을 누르면 여기로 와요.' },
  { label: '믹스', icon: 'mixer', hint: '트랙끼리 크기와 울림을 맞춰요.' },
  { label: '내보내기', icon: 'download', hint: '곡을 파일로 받아요.' }
];

/* ================= 상태 ================= */
U.designs = DESIGNS;
U.design = IDS.includes(U.pref('design', 'a')) ? U.pref('design', 'a') : 'a';
ui.step = clampInt(U.pref('stepB', 1), 1, 5);
ui.bMode = U.pref('bMode', 'play') === 'edit' ? 'edit' : 'play';
ui.tab = clampInt(U.pref('tabC', 1), 1, 5);
// A의 오른쪽 칸: 직접 열고 닫기 전에는 넓은 컴퓨터 화면에서만 연다 (아이패드에서는 세션 칸이 너무 좁아진다)
ui.inspOpen = U.pref('inspOpen', null);
const inspOn = () => (ui.inspOpen != null ? ui.inspOpen : !U.isTouch && window.innerWidth >= 1360);
ui.mapH = clampInt(U.pref('mapH', 300), 140, 2000);

/* 지금 화면에 쓰는 디자인 (좁은 화면은 늘 A의 한 칸씩 화면) */
U.layout = () => (ui.narrow ? 'a' : U.design);
/* 패드 화면이 보이는지: 글자 키가 패드로 가고, 패드가 반짝인다 */
U.padsShown = function () {
  const L = U.layout();
  if (L === 'b') return ui.step === 1 && ui.bMode === 'play';
  if (L === 'c') return ui.tab === 1;
  return ui.view === 'pads';
};
/* 클립·장치 칸이 보이는지 (안 보이면 그리지 않는다) */
U.detailShown = function () {
  const L = U.layout();
  if (L === 'b') return (ui.step === 1 && ui.bMode === 'edit') || ui.step === 2 || ui.step === 3;
  if (L === 'c') return ui.tab === 2 || ui.tab === 3;
  return ui.detailOpen || ui.narrow;
};
U.inspShown = () => U.layout() === 'a' && !ui.narrow && inspOn();

let els = {};
function mount(e) {
  els = e;
  apply();
}
/* 몸통에 지금 디자인·단계를 적는다. CSS가 이걸 보고 칸을 늘어놓는다 */
function apply() {
  const b = document.body, L = U.layout();
  // C에서는 패드가 탭으로 보이니 ui.view는 세션·어레인지먼트만 (곡 지도에 보일 것)
  if (L === 'c' && ui.view === 'pads') ui.view = ui.prevView && ui.prevView !== 'pads' ? ui.prevView : 'session';
  if (L === 'b') {
    if (ui.step === 1 && ui.bMode === 'play') { if (ui.view !== 'pads') { ui.prevView = ui.view; ui.view = 'pads'; } }
    else if (ui.view === 'pads') ui.view = ui.prevView && ui.prevView !== 'pads' ? ui.prevView : 'session';
  }
  b.dataset.design = L;
  b.dataset.step = String(ui.step);
  b.dataset.bmode = ui.bMode;
  b.dataset.tab = String(ui.tab);
  b.dataset.view = ui.view;
  b.classList.toggle('no-insp', !inspOn());
  document.documentElement.style.setProperty('--map-h', ui.mapH + 'px');
}
function refreshAll() {
  apply();
  if (U.layout() !== 'a') syncPadTrack();
  U.inval('shell', 'insp', 'detail', 'pads', 'session', 'arrange', 'arrange-draw', 'mixer', 'xport', 'transport', 'status', 'browser');
}

function setDesign(id, quiet) {
  if (!IDS.includes(id)) return;
  const wasPads = U.padsShown();
  if (wasPads) U.padsView.releaseAll();
  U.design = id;
  U.setPref('design', id);
  // 패드를 치고 있었다면 새 디자인에서도 패드가 보이게
  if (wasPads && !ui.narrow) {
    if (id === 'b') { ui.step = 1; ui.bMode = 'play'; }
    else if (id === 'c') ui.tab = 1;
    else { if (ui.view !== 'pads') ui.prevView = ui.view; ui.view = 'pads'; }
    saveSteps();
  } else if (id === 'a' && ui.view === 'pads' && !wasPads) ui.view = ui.prevView || 'session';
  U.closeMenu && U.closeMenu();
  refreshAll();
  U.inval('all');
  if (!quiet) {
    const d = DESIGNS.find(x => x.id === id);
    U.toast('화면 디자인을 ' + d.letter + ' · ' + d.name + '(으)로 바꿨어요.' + (ui.narrow ? ' 화면이 넓어지면 보여요.' : ''));
  }
}
function saveSteps() {
  U.setPref('stepB', ui.step);
  U.setPref('bMode', ui.bMode);
  U.setPref('tabC', ui.tab);
}
/* B: 단계 바꾸기 */
function setStep(n, o) {
  const wasPads = U.padsShown();
  ui.step = clampInt(n, 1, 5);
  if (o && o.mode) ui.bMode = o.mode;
  if (ui.step === 1 && ui.bMode === 'edit') ui.detail = 'clip';
  if (ui.step === 2) ui.detail = 'device';
  saveSteps();
  if (wasPads && !U.padsShown()) U.padsView.releaseAll();
  refreshAll();
}
/* C: 작업대 탭 바꾸기 */
function setTab(n) {
  const wasPads = U.padsShown();
  ui.tab = clampInt(n, 1, 5);
  if (ui.tab === 2) ui.detail = 'device';
  if (ui.tab === 3) ui.detail = 'clip';
  saveSteps();
  if (wasPads && !U.padsShown()) U.padsView.releaseAll();
  refreshAll();
}
/* 곡 지도(C)·곡 짜기(B)에 세션이나 어레인지먼트 */
function setSongView(v) {
  ui.view = v;
  U.setPref('view', v);
  refreshAll();
}

/* ================= 단축키가 부르는 것 (디자인마다 알맞게) ================= */
U.togglePads = function () {
  const L = U.layout();
  if (L === 'b') {
    if (U.padsShown()) setStep(ui.prevStep && ui.prevStep !== 1 ? ui.prevStep : 3);
    else { ui.prevStep = ui.step; setStep(1, { mode: 'play' }); }
    return;
  }
  if (L === 'c') {
    if (ui.tab === 1) setTab(ui.prevTab && ui.prevTab !== 1 ? ui.prevTab : 3);
    else { ui.prevTab = ui.tab; setTab(1); }
    return;
  }
  U.setView(ui.view === 'pads' ? ui.prevView || 'session' : 'pads');
};
U.toggleSongView = function () {
  if (U.layout() === 'b' && ui.step !== 3) { setStep(3); return; }
  U.setView(ui.view === 'session' ? 'arrange' : 'session');
};
U.toggleDetailKind = function () {
  const L = U.layout();
  if (L === 'c') { setTab(ui.tab === 3 ? 2 : 3); return; }
  if (L === 'b') {
    if (ui.step === 1) setStep(1, { mode: ui.bMode === 'play' ? 'edit' : 'play' });
    else if (ui.step === 3) U.setDetail(ui.detail === 'clip' ? 'device' : 'clip');
    else setStep(ui.step === 2 ? 3 : 2);
    return;
  }
  U.setDetail(ui.detail === 'clip' ? 'device' : 'clip');
  if (!ui.detailOpen) U.toggleDetail(true);
};
// C: 소리 탭을 보다가 클립을 고르면 편집 탭으로 (Live의 아래 칸처럼)
U.on('detail', which => {
  if (U.layout() === 'c' && which === 'clip' && ui.tab === 2) setTab(3);
});
U.on('select', s => {
  U.inval('insp', 'shell');
  // B·C의 패드(연주) 화면은 늘 고른 트랙을 친다
  if (s && s.track && U.layout() !== 'a') syncPadTrack();
});
function syncPadTrack() {
  const t = U.selTrack();
  if (t && t.type === 'midi' && U.instrumentOf(t) && ui.padTrack !== t.id) { ui.padTrack = t.id; U.inval('pads'); }
}

/* ================= 공통: 단계 단추 줄 ================= */
function stepNav(list, cur, pick, cls, label) {
  const nav = h('nav', { class: 'sh-steps ' + cls, 'aria-label': label });
  list.forEach((s, i) => {
    const n = i + 1, on = n === cur;
    if (i && cls === 'b') nav.append(h('span', { class: 'sh-dash', 'aria-hidden': 'true' }));
    const b = h('button', { type: 'button', class: 'sh-step' + (on ? ' on' : ''), 'aria-current': on ? 'step' : 'false' },
      h('span', { class: 'sh-n', text: String(n) }), icon(s.icon), h('span', { class: 'sh-l', text: s.label }));
    info(b, n + ' · ' + s.label, s.guide || s.hint || '');
    b.addEventListener('click', () => pick(n));
    nav.append(b);
  });
  return nav;
}
function trackSub(t) {
  if (t.type === 'audio') return '오디오 트랙';
  if (t.type === 'return') return '리턴 트랙';
  if (t.type === 'master') return '최종 출력';
  const d = U.instrumentOf(t);
  return d ? (d.preset ? d.preset + ' · ' : '') + U.devName(d) : '악기 없음';
}

/* ================= B: 위쪽 머리 ================= */
function renderTop() {
  if (!els.top || U.layout() !== 'b') return;
  U.clear(els.top);
  const p = pr();
  const logo = h('div', { class: 'logo', 'aria-label': '울림' }, h('span', { class: 'logo-mark' }), h('span', { class: 'logo-t', text: '울림' }));
  const name = h('button', { type: 'button', class: 'sh-proj', text: p.name || '이름 없는 프로젝트' });
  info(name, '프로젝트 이름', '눌러서 이름을 바꿔요.');
  name.addEventListener('click', () => U.ask('프로젝트 이름', '이름', p.name).then(v => { if (v) { pr().name = v; U.commit('프로젝트 이름'); } }));
  const un = btn({ icon: 'undo', cls: 'ghost sh-round', title: '되돌리기 (' + U.MOD + '+Z)', onclick: () => A.undo() });
  const re = btn({ icon: 'undo', cls: 'ghost sh-round st-redo', title: '다시 실행 (' + U.MOD + '+Shift+Z)', onclick: () => A.redo() });
  un.disabled = !U.canUndo();
  re.disabled = !U.canRedo();
  const menu = btn({ icon: 'menu', cls: 'ghost sh-round', title: '메뉴', onclick: () => U.appMenu(menu) });
  els.top.append(h('div', { class: 'sh-brand' }, logo, name),
    stepNav(STEPS, ui.step, n => setStep(n), 'b', '작업 단계'),
    h('div', { class: 'sh-acts' }, un, re, menu));
}
/* B: 단계 제목과 안내, 단계 안의 고르기 */
function renderWorkHead() {
  if (!els.whead || U.layout() !== 'b') return;
  U.clear(els.whead);
  const s = STEPS[ui.step - 1];
  const txt = h('div', { class: 'wh-txt' },
    h('div', { class: 'wh-k', text: ui.step + '단계 · ' + s.label }),
    h('h2', { class: 'wh-t', text: s.title }),
    h('p', { class: 'wh-g', text: s.guide }));
  const right = h('div', { class: 'wh-r' });
  if (ui.step === 1) right.append(U.seg([['play', '패드·건반으로 치기', '패드나 건반을 크게 띄워요. P로도 바꿔요.'], ['edit', '클립 편집', '고른 클립을 스텝 시퀀서나 피아노 롤로 고쳐요. Shift+Tab으로도 바꿔요.']], ui.bMode, v => setStep(1, { mode: v }), 'wh-seg'));
  if (ui.step === 3) {
    right.append(U.seg([['session', '씬 (세션)', '클립 칸을 띄우며 부분을 만들어요.'], ['arrange', '타임라인', '시간 순서로 곡을 늘어놓아요.']], ui.view === 'arrange' ? 'arrange' : 'session', v => setSongView(v), 'wh-seg'));
    right.append(btn({ icon: 'arrange', text: '씬으로 곡 만들기…', cls: 'sm', info: ['씬으로 곡 만들기', '씬들을 인트로·빌드업·드롭… 순서로 타임라인에 한 번에 늘어놓아요.'], onclick: () => U.songDialog() }));
  }
  if (ui.step === 1 || ui.step === 2) {
    const t = U.selTrack();
    if (t) right.append(h('span', { class: 'wh-track', style: { '--c': U.colorOf(t.color) } }, h('span', { class: 'wh-sw' }), h('b', { text: U.trackLabel(pr(), t) }), h('span', { text: trackSub(t) })));
  }
  els.whead.append(txt, right);
}
/* B: 아래 '이전 · 다음' */
function renderNav() {
  if (!els.bnav || U.layout() !== 'b') return;
  U.clear(els.bnav);
  if (ui.step > 1) {
    const prev = STEPS[ui.step - 2];
    els.bnav.append(btn({ text: '‹ ' + prev.label, cls: 'sh-prev', title: '앞 단계: ' + prev.label, onclick: () => setStep(ui.step - 1) }));
  }
  if (ui.step < 5) {
    const next = STEPS[ui.step];
    els.bnav.append(btn({ text: '다음 · ' + next.label + ' ›', cls: 'sh-next', title: '다음 단계: ' + next.label, onclick: () => setStep(ui.step + 1) }));
  }
}

/* ================= B: 왼쪽 트랙 목록 ================= */
function renderRail() {
  if (!els.rail || U.layout() !== 'b') return;
  U.clear(els.rail);
  const p = pr();
  const add = btn({ icon: 'plus', text: '추가', cls: 'sm rl-add', title: '트랙 넣기', onclick: () => U.menu([
    { label: 'MIDI 트랙 (악기)', action: () => A.addTrack('midi') },
    { label: '오디오 트랙', action: () => A.addTrack('audio') },
    { label: '리턴 트랙', action: () => A.addReturn() }
  ], add) });
  const list = h('div', { class: 'rl-list', role: 'list' });
  for (const t of p.tracks) list.append(railItem(t, false));
  if (p.returns.length || p.master) list.append(h('div', { class: 'rl-sep', text: '리턴 · 마스터' }));
  for (const t of p.returns) list.append(railItem(t, true));
  list.append(railItem(p.master, true));
  els.rail.append(h('div', { class: 'rl-head' }, h('span', { class: 'rl-title', text: '트랙 ' + p.tracks.length + '개' }), add), list);
}
function railItem(t, small) {
  const p = pr();
  const el = h('button', { type: 'button', role: 'listitem', class: 'rl-item' + (small ? ' small' : '') + (ui.track === t.id ? ' sel' : '') + (t.on === false ? ' off' : ''), style: { '--c': U.colorOf(t.color) }, dataset: { t: t.id }, 'aria-pressed': ui.track === t.id ? 'true' : 'false' },
    h('span', { class: 'rl-sw' }),
    h('span', { class: 'rl-txt' }, h('span', { class: 'rl-name', text: t.type === 'master' ? '마스터' : U.trackLabel(p, t) }), small ? null : h('span', { class: 'rl-sub', text: trackSub(t) })),
    h('span', { class: 'rl-lv', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
  info(el, t.type === 'master' ? '마스터' : U.trackLabel(p, t), '눌러서 이 트랙을 골라요. 만들기·소리 단계가 이 트랙으로 바뀌어요. 오른쪽 클릭(길게 누르기)으로 메뉴를 열어요.');
  el.addEventListener('click', () => U.selectTrack(t.id));
  if (t.type !== 'master') el.addEventListener('contextmenu', e => { e.preventDefault(); U.selectTrack(t.id); U.sessionView.trackMenu(t, { x: e.clientX, y: e.clientY }); });
  return el;
}
// 트랙 목록의 작은 소리 막대
U.frame(() => {
  if (!els.rail || els.rail.offsetParent === null || !U.engine) return;
  for (const el of els.rail.querySelectorAll('.rl-item')) {
    const n = U.engine.nodes.get(el.dataset.t);
    const lv = n ? n.meter() : null;
    const v = lv ? Math.max(lv[0], lv[1]) : 0;
    const db = U.gainToDb(v);
    const pos = db === -Infinity ? 0 : Math.min(1, Math.max(0, (db + 48) / 48));
    el.style.setProperty('--lv', pos.toFixed(2));
    el.classList.toggle('live', pos > 0.05);
  }
});

/* ================= C: 작업대 탭 줄 ================= */
function renderTabs() {
  if (!els.ctabs || U.layout() !== 'c') return;
  U.clear(els.ctabs);
  const t = U.selTrack();
  const chip = t ? h('span', { class: 'tc-track', style: { '--c': U.colorOf(t.color) } }, h('span', { class: 'tc-sw' }), h('b', { text: t.type === 'master' ? '마스터' : U.trackLabel(pr(), t) }), h('span', { class: 'tc-sub', text: trackSub(t) })) : null;
  if (chip) info(chip, '고른 트랙', '작업대는 이 트랙을 보여 줘요. 곡 지도에서 트랙이나 클립을 누르면 바뀌어요.');
  const map = h('div', { class: 'tc-map' }, h('span', { class: 'tc-ml', text: '곡 지도' }),
    U.seg([['arrange', '타임라인', '곡을 시간 순서로 보여 줘요. Tab으로 바꿔요.'], ['session', '클립 런처', '씬과 클립 칸을 보여 줘요. Tab으로 바꿔요.']], ui.view === 'session' ? 'session' : 'arrange', v => setSongView(v)));
  els.ctabs.append(...[chip, stepNav(TABS, ui.tab, n => setTab(n), 'c', '작업대'), h('span', { class: 'tc-hint', text: TABS[ui.tab - 1].hint }), map].filter(Boolean));
}

/* ================= A: 오른쪽 '고른 트랙' 칸 ================= */
const P0 = () => U.dbToPos(0);
function renderInsp() {
  if (!els.insp || !U.inspShown()) return;
  const keepScroll = els.insp.querySelector('.in-body') ? els.insp.querySelector('.in-body').scrollTop : 0;
  U.clear(els.insp);
  const p = pr(), t = U.selTrack();
  if (!t) return;
  const d = U.instrumentOf(t);
  const label = t.type === 'master' ? '마스터' : U.trackLabel(p, t);
  const name = h('div', { class: 'in-name', text: label });
  if (t.type !== 'master') {
    info(name, '트랙 이름', '두 번 눌러 이름을 바꿔요.');
    name.addEventListener('dblclick', () => U.editInline(name, t.name || label, v => A.renameTrack(t.id, v)));
  }
  const head = h('div', { class: 'in-head', style: { '--c': U.colorOf(t.color) } },
    h('span', { class: 'in-sw' }),
    h('div', { class: 'in-ht' }, h('div', { class: 'in-k', text: '고른 트랙' + (t.type === 'midi' || t.type === 'audio' ? ' · ' + (p.tracks.indexOf(t) + 1) : '') }), name, h('div', { class: 'in-sub', text: trackSub(t) })),
    btn({ icon: 'close', cls: 'ghost sm in-x', title: '이 칸 닫기', info: ['고른 트랙 칸 닫기', '아래 상태 줄의 단추로 다시 열어요.'], onclick: () => toggleInsp(false) }));
  const body = h('div', { class: 'in-body' });
  // 소리 고르기
  if (t.type === 'midi' && d && d.kind !== 'drums' && d.kind !== 'looppad') {
    const [pick, prev, next] = U.soundPicker(t);
    body.append(h('div', { class: 'in-pick' }, prev, pick, next));
  }
  // 소리 다듬기
  if (t.type === 'midi' && d) body.append(U.shapePanel(t));
  // 오디오 트랙: 고른 오디오 클립
  if (t.type === 'audio') {
    const r = U.clipRef();
    const sec = h('section', { class: 'in-sec' }, h('h3', { class: 'in-h', text: '오디오 클립' }));
    if (r && r.track === t && r.clip.type === 'audio') {
      const inf = U.media.info(r.clip.ref) || {};
      sec.append(h('p', { class: 'in-p', text: (r.clip.name || inf.name || '오디오') + (inf.duration ? ' · ' + U.fmtTime(inf.duration) : '') }),
        btn({ icon: 'wave', text: '파형 편집', cls: 'sm', info: ['파형 편집', '이 클립의 오디오를 자르고 붙이고 페이드·노멀라이즈해요.'], onclick: () => U.audioEditor.editClip(Object.assign({}, ui.clip)) }));
    } else sec.append(h('p', { class: 'in-p muted', text: '오디오 클립을 고르면 여기서 파형을 편집할 수 있어요.' }));
    body.append(sec);
  }
  // 장치 순서
  const chain = h('section', { class: 'in-sec' }, h('h3', { class: 'in-h', text: '장치 순서' }));
  if (!t.devices.length) chain.append(h('p', { class: 'in-p muted', text: '장치가 없어요.' }));
  t.devices.forEach((dv, i) => {
    const kind = U.DEV[dv.kind] ? U.DEV[dv.kind].type : 'audio';
    const tag = kind === 'instrument' ? '악기' : kind === 'midi' ? 'MIDI' : '이펙트';
    const nm = h('button', { type: 'button', class: 'in-dn', text: dv.preset && kind === 'instrument' ? dv.preset : U.devName(dv) });
    info(nm, U.devName(dv), '눌러서 아래 장치 칸에서 이 장치의 노브를 보여 줘요.');
    nm.addEventListener('click', () => focusDevice(dv.id));
    const on = h('button', { type: 'button', class: 'in-on', 'aria-pressed': dv.on !== false ? 'true' : 'false', 'aria-label': U.devName(dv) + ' 켜기/끄기' }, icon('power'));
    info(on, '장치 켜기/끄기', '끄면 이 장치를 건너뛰어요.');
    on.addEventListener('click', () => A.toggleDevice(dv.id));
    chain.append(h('div', { class: 'in-dev t-' + kind + (dv.on === false ? ' off' : '') }, h('span', { class: 'in-di', text: String(i + 1) }), nm, h('span', { class: 'in-tag', text: tag }), on));
  });
  const add = btn({ icon: 'plus', text: '장치 넣기', cls: 'sm in-add', onclick: () => addDeviceMenu(t, add) });
  chain.append(add);
  body.append(chain, mixerSection(t));
  els.insp.append(head, body);
  body.scrollTop = keepScroll;
}
function focusDevice(id) {
  U.setDetail('device');
  if (!ui.detailOpen) U.toggleDetail(true);
  setTimeout(() => {
    const pnl = U.deviceView.panels.find(x => x.d.id === id);
    if (pnl && pnl.el.scrollIntoView) { pnl.el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); pnl.el.classList.add('flash'); setTimeout(() => pnl.el.classList.remove('flash'), 900); }
  }, 80);
}
function addDeviceMenu(t, at) {
  const kinds = type => Object.keys(U.DEV).filter(k => U.DEV[k].type === type);
  const items = [{ header: '오디오 이펙트' }].concat(kinds('audio').map(k => ({ label: U.DEV[k].name, action: () => A.addDevice(t.id, k) })));
  if (t.type === 'midi') items.push({ header: 'MIDI 이펙트' }, ...kinds('midi').map(k => ({ label: U.DEV[k].name, action: () => A.addDevice(t.id, k) })));
  U.menu(items, at);
}
function mixerSection(t) {
  const p = pr();
  const sec = h('section', { class: 'in-sec' }, h('h3', { class: 'in-h', text: '믹서' }));
  const row = h('div', { class: 'in-mix' });
  const vol = U.numBox({ cls: 'in-vol', label: '볼륨', get: () => t.vol, set: (v, f) => A.setMixer(t.id, 'vol', v, f), fmt: v => (v <= U.OFF_DB + 0.1 ? '-∞ dB' : v.toFixed(1) + ' dB'), min: U.OFF_DB, max: 6, step: 0.1, def: 0, toN: v => U.dbToPos(v), fromN: n => U.round(U.posToDb(n), 1), range: 200 });
  info(vol, '볼륨', '위아래로 끌거나 두 번 눌러 dB 값을 넣어요.');
  row.append(h('label', { class: 'in-vl' }, h('span', { text: '볼륨' }), vol));
  row.append(U.knob({ spec: { label: '팬', min: -1, max: 1, def: 0, unit: 'pan', info: '소리를 왼쪽이나 오른쪽으로 보내요.' }, size: 'sm', get: () => t.pan || 0, set: (v, f) => A.setMixer(t.id, 'pan', U.round(v, 3), f) }));
  if (t.type !== 'master') {
    p.returns.forEach((r, i) => {
      if (r.id === t.id) return;
      const letter = U.returnLetter(p, r);
      row.append(U.knob({
        spec: { label: '센드 ' + letter, min: 0, max: 1, def: 0, info: letter + ' 리턴 트랙(' + U.trackLabel(p, r) + ')으로 보내는 양이에요.', fmt: v => U.fmtParam({ unit: 'dB' }, U.posToDb(v * P0())) },
        size: 'sm', get: () => U.dbToPos(t.sends[i] != null ? t.sends[i] : U.OFF_DB) / P0(),
        set: (v, f) => A.setMixer(t.id, 'send', U.round(U.posToDb(v * P0()), 1), f, i)
      }));
    });
  }
  sec.append(row);
  return sec;
}
function toggleInsp(on) {
  ui.inspOpen = on != null ? on : !inspOn();
  U.setPref('inspOpen', ui.inspOpen);
  refreshAll();
}
// 정하지 않았으면 창 폭·화면 버전에 따라 열리고 닫힌다
let lastAuto = null;
function autoInsp() {
  if (ui.inspOpen != null) return;
  const on = inspOn();
  if (on === lastAuto) return;
  lastAuto = on;
  refreshAll();
}
window.addEventListener('resize', U.debounce(autoInsp, 200));
U.on('uimode', autoInsp);

/* ================= 디자인 고르기 ================= */
function mini(id) {
  const m = h('span', { class: 'dz-mini dz-' + id, 'aria-hidden': 'true' });
  const parts = { a: ['t', 'l', 'c', 'r', 'b'], b: ['t', 'l', 'c', 'b'], c: ['t', 'm', 's', 'w'] }[id];
  for (const p of parts) m.append(h('i', { class: 'p-' + p }));
  return m;
}
function designDialog() {
  const body = h('div', { class: 'dz' });
  let dlg = null;
  const grid = h('div', { class: 'dz-grid' });
  for (const d of DESIGNS) {
    const on = U.design === d.id;
    const card = h('button', { type: 'button', class: 'dz-card' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false' },
      mini(d.id),
      h('span', { class: 'dz-name' }, h('b', { text: d.letter + ' · ' + d.name }), h('span', { class: 'dz-tag', text: d.tag })),
      h('span', { class: 'dz-desc', text: d.desc }),
      h('span', { class: 'dz-now', text: on ? '지금 쓰는 디자인' : '이걸로 바꾸기' }));
    card.addEventListener('click', () => { setDesign(d.id); if (dlg) dlg.close(); });
    grid.append(card);
  }
  body.append(grid, h('p', { class: 'hint', text: '언제든 메뉴 › 화면 디자인이나 아래 상태 줄의 디자인 단추로 바꿀 수 있어요. 컴퓨터·아이패드 버전(크기)과는 따로 골라요. 휴대폰처럼 좁은 화면에서는 한 칸씩 보이는 화면을 써요.' }));
  dlg = U.dialog({ title: '화면 디자인 고르기', body, width: '780px', actions: [{ label: '닫기' }] });
}
function designItems() {
  return DESIGNS.map(d => ({ label: d.letter + ' · ' + d.name + ' — ' + d.tag, checked: U.design === d.id, action: () => setDesign(d.id) }))
    .concat([{ sep: true }, { label: '그림으로 보고 고르기…', action: designDialog }]);
}
function designMenu(anchor) { U.menu([{ header: '화면 디자인' }].concat(designItems()), anchor); }
function designName() { const d = DESIGNS.find(x => x.id === U.design); return d.letter + ' · ' + d.name; }

U.renderer('shell', () => { renderTop(); renderWorkHead(); renderNav(); renderRail(); renderTabs(); });
U.renderer('insp', renderInsp);
U.shell = { mount, apply, refreshAll, setDesign, setStep, setTab, setSongView, toggleInsp, designDialog, designMenu, designItems, designName, STEPS, TABS };
})(window.U = window.U || {});
