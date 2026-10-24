/* 울림 — 상단 컨트롤 바: 템포, 박자, 메트로놈, 퀀타이즈, 재생·녹음, 위치, 루프, 키, 건반 */
(function (U) {
'use strict';
const { h, btn, numBox, setPressed, info, ui } = U;
const A = U.act;
const pr = () => U.project;
let el = null, refs = {};

function build(root) {
  el = root;
  U.clear(el);
  const p = pr();
  refs = {};

  const menuBtn = btn({ icon: 'menu', cls: 'ghost', title: '메뉴', info: ['메뉴', '새 프로젝트, 열기, 내보내기, 환경설정이 있어요.'], onclick: () => U.appMenu(menuBtn) });
  const logo = h('div', { class: 'logo', 'aria-label': '울림' }, h('span', { class: 'logo-mark' }), h('span', { class: 'logo-t', text: '울림' }));

  // 템포
  const tap = btn({ text: 'TAP', cls: 'tap', info: ['탭 템포', '박자에 맞춰 여러 번 누르면 그 빠르기로 템포를 맞춰요.'], onclick: () => A.tap() });
  refs.bpm = numBox({
    cls: 'bpm', label: '템포', get: () => pr().bpm, set: (v, f) => A.setTempo(v, f),
    fmt: v => v.toFixed(2), min: 20, max: 999, step: 0.01, def: 120, range: 2400, keyStep: 1 / 979,
    toN: v => (v - 20) / 979, fromN: n => U.round(20 + n * 979, 2)
  });
  info(refs.bpm, '템포 (BPM)', '1분에 몇 박인지예요. 위아래로 끌거나 두 번 눌러 숫자를 넣어요. Shift를 누르고 끌면 0.01씩 바뀌어요.');
  refs.sig = numBox({
    cls: 'sig', label: '박자표', get: () => pr().sig[0], set: (v, f) => { pr().sig = [v, pr().sig[1]]; f ? U.commit('박자표') : U.touch(); },
    fmt: v => v + ' / ' + pr().sig[1], parse: s => parseInt(s, 10), min: 1, max: 16, step: 1, def: 4, range: 200
  });
  info(refs.sig, '박자표', '한 마디에 몇 박이 들어가는지예요. 분모를 바꾸려면 오른쪽 클릭하세요.');
  refs.sig.addEventListener('contextmenu', e => {
    e.preventDefault();
    U.menu([2, 4, 8, 16].map(d => ({ label: '분모 ' + d, checked: pr().sig[1] === d, action: () => { pr().sig = [pr().sig[0], d]; U.commit('박자표'); } })), { x: e.clientX, y: e.clientY });
  });
  refs.metro = btn({ icon: 'metro', cls: 'tg', toggle: true, on: p.metro, title: '메트로놈', info: ['메트로놈', '재생하는 동안 박마다 딸깍 소리를 내요. 마디 첫 박은 더 높아요.'], onclick: () => { pr().metro = !pr().metro; U.commit('메트로놈'); } });
  refs.quant = U.select(U.QUANTS.map(q => [q.id, q.name]), p.quant, v => { pr().quant = v; U.commit('런치 퀀타이즈'); }, { cls: 'quant', label: '런치 퀀타이즈', info: ['런치 퀀타이즈', '클립과 씬이 언제 시작될지 정해요. 1마디면 다음 마디 첫 박에 맞춰 시작해요.'] });

  // 트랜스포트
  refs.play = btn({ icon: 'play', cls: 'tr play', title: '재생 (Space)', info: ['재생', '어레인지먼트를 시작 위치부터 재생해요. Space로도 돼요.'], onclick: () => A.play() });
  refs.stop = btn({ icon: 'stop', cls: 'tr', title: '정지 (Space)', info: ['정지', '재생을 멈춰요. 멈춘 상태에서 한 번 더 누르면 시작 위치를 처음으로 돌려요.'], onclick: () => A.stop() });
  refs.rec = btn({ icon: 'rec', cls: 'tr rec', toggle: true, title: '어레인지먼트 녹음 (F9)', info: ['어레인지먼트 녹음', '녹음 준비(●)한 MIDI 트랙에 연주를 어레인지먼트 클립으로 녹음해요.'], onclick: () => A.setRecord(!U.engine.recording) });
  refs.srec = btn({ icon: 'sessrec', cls: 'tr rec srec', toggle: true, title: '세션 녹음', info: ['세션 녹음', '녹음 준비한 트랙의 선택된 빈 슬롯에 새 클립을 녹음해요. 클립이 재생 중이면 그 위에 겹쳐 녹음해요. 다시 누르면 녹음을 마치고 루프로 돌려요.'], onclick: () => A.setSessionRec(!U.engine.sessionRec) });
  refs.cap = btn({ icon: 'capture', cls: 'tr cap', title: 'MIDI 캡처', info: ['MIDI 캡처', '녹음 버튼을 누르지 않고 방금 친 연주를 클립으로 건져요. 템포가 맞지 않아도 첫 음부터 마디에 맞춰요.'], onclick: () => U.act.capture() });
  refs.pos = numBox({
    cls: 'pos', label: '재생 위치', get: () => U.engine.heardBeat(), set: (v, f) => { if (f) setPos(v); },
    fmt: v => U.fmtPos(v, pr().sig), parse: s => U.parsePos(s, pr().sig, true), min: 0, max: 4096, step: 0.25, range: 1200
  });
  info(refs.pos, '재생 위치', '마디. 박. 16분음표. 두 번 눌러 "9.1.1"처럼 입력하면 그 위치로 가요.');
  refs.back = btn({ icon: 'back', cls: 'tr back', title: '어레인지먼트로 돌아가기', info: ['어레인지먼트로 돌아가기', '세션 클립을 띄운 트랙은 어레인지먼트를 잠시 쉬어요. 이 버튼을 누르면 다시 어레인지먼트를 따라가요.'], onclick: () => U.engine.backToArrangement() });

  // 루프
  refs.loop = btn({ icon: 'loop', cls: 'tg', toggle: true, on: p.loop.on, title: '루프 (Ctrl+L)', info: ['어레인지먼트 루프', '켜면 루프 구간을 계속 반복해요. 눈금자의 루프 막대를 끌어 구간을 바꿔요.'], onclick: () => { pr().loop.on = !pr().loop.on; U.commit('루프'); } });
  refs.lstart = numBox({ cls: 'pos sm lpos', label: '루프 시작', get: () => pr().loop.start, set: (v, f) => { const L = pr().loop, len = L.end - L.start; L.start = v; L.end = v + len; f ? U.commit('루프 위치') : U.touch(); }, fmt: v => U.fmtPos(v, pr().sig), parse: s => U.parsePos(s, pr().sig, true), min: 0, max: 4096, step: 1, range: 900 });
  info(refs.lstart, '루프 시작', '루프 구간이 시작하는 위치');
  refs.llen = numBox({ cls: 'pos sm lpos', label: '루프 길이', get: () => pr().loop.end - pr().loop.start, set: (v, f) => { const L = pr().loop; L.end = L.start + Math.max(0.25, v); f ? U.commit('루프 길이') : U.touch(); }, fmt: v => U.fmtLen(v, pr().sig), parse: s => U.parsePos(s, pr().sig, false), min: 0.25, max: 1024, step: 1, range: 900 });
  info(refs.llen, '루프 길이', '마디. 박. 16분음표');

  // 오른쪽
  refs.draw = btn({ icon: 'draw', cls: 'tg drawbtn', toggle: true, on: ui.draw, title: '그리기 모드 (B)', info: ['그리기 모드', '켜면 피아노 롤과 자동화에서 클릭으로 음표·점을 바로 그려요.'], onclick: () => U.setDraw(!ui.draw) });
  refs.auto = btn({ icon: 'auto', cls: 'tg autobtn', toggle: true, on: ui.auto, title: '자동화 모드 (A)', info: ['자동화 모드', '어레인지먼트에서 볼륨·팬·장치 값의 변화를 선으로 그려요.'], onclick: () => U.setAutoMode(!ui.auto) });
  refs.follow = btn({ icon: 'follow', cls: 'tg follow', toggle: true, on: ui.follow, title: '따라가기', info: ['따라가기', '재생 위치가 화면 밖으로 나가면 어레인지먼트가 따라서 넘어가요.'], onclick: () => { ui.follow = !ui.follow; U.setPref('follow', ui.follow); refresh(); } });
  refs.key = btn({ icon: 'scale', cls: 'keybtn', title: '키', info: ['프로젝트 키', '새 클립과 스케일 기능이 따르는 키예요. 피아노 롤에서 이 스케일의 음이 밝게 보여요.'], onclick: () => keyMenu(refs.key) });
  refs.swing = numBox({ cls: 'swing', label: '스윙', get: () => pr().swing || 0, set: (v, f) => { pr().swing = v; f ? U.commit('스윙') : U.touch(); }, fmt: v => 'Swing ' + Math.round(50 + v * 25) + '%', parse: s => (parseFloat(s) - 50) / 25, min: 0, max: 1, step: 0.01, def: 0, range: 300 });
  info(refs.swing, '스윙 (그루브)', '16분음표 엇박을 뒤로 밀어 출렁이는 느낌을 줘요. 50%는 똑바로, 66%는 셋잇단 느낌이에요. 클립마다 끌 수 있어요.');
  refs.pads = btn({ icon: 'pads', cls: 'tg padsbtn', toggle: true, on: U.padsShown(), title: '패드 화면 (P)', info: ['패드 화면', '루프 패드·드럼 머신의 패드 16개를 크게 띄워요. 패드마다 정한 글자 키로 MPC처럼 두드려요. 다시 누르면 앞 화면으로 돌아가요.'], onclick: () => U.togglePads() });
  refs.kbd = btn({ icon: 'keys', cls: 'tg', toggle: true, on: ui.keyboard, title: '컴퓨터 건반 (M)', info: ['컴퓨터 건반', '켜면 A~K 줄이 건반이 돼요. W, E, T, Y, U는 검은 건반, Z/X는 옥타브, C/V는 세기예요.'], onclick: () => U.setKeyboard(!ui.keyboard) });
  refs.map = btn({ text: 'MIDI', cls: 'tg map', toggle: true, on: !!ui.mapMode, title: 'MIDI 매핑 모드', info: ['MIDI 매핑 모드', '켜고 노브·페이더를 누른 뒤 MIDI 장치의 손잡이를 돌리면 둘이 이어져요. 다시 누르면 매핑 모드를 끝내요.'], onclick: () => U.setMapMode(!ui.mapMode) });

  // A(컨트롤 룸): 세션 · 곡 · 패드를 위에서 바로 바꾼다
  refs.views = h('div', { class: 'seg cb-vseg', role: 'group', 'aria-label': '화면 고르기' });
  for (const [v, label, key, ic, tip] of [['session', '세션', 'Tab', 'session', '클립을 칸에 담아 자유롭게 띄우는 화면이에요.'], ['arrange', '곡', 'Tab', 'arrange', '시간 순서대로 곡을 늘어놓는 어레인지먼트예요.'], ['pads', '패드', 'P', 'pads', '패드 16개를 크게 띄우고 글자 키로 쳐요.']]) {
    const b = h('button', { type: 'button', class: 'seg-b cb-v', dataset: { v } }, U.icon(ic), h('span', { text: label }), h('kbd', { text: key }));
    info(b, label + ' (' + key + ')', tip);
    b.addEventListener('click', () => U.setView(v));
    refs.views.append(b);
  }
  const g = (cls, ...kids) => h('div', { class: 'cb-group ' + cls }, ...kids);
  el.append(
    g('cb-menu', menuBtn, logo),
    g('cb-views', refs.views),
    g('cb-tempo', tap, refs.bpm, refs.sig, refs.metro, refs.quant),
    g('cb-trans', refs.play, refs.stop, refs.rec, refs.srec, refs.cap, refs.pos, refs.back),
    g('cb-loop', refs.loop, refs.lstart, refs.llen),
    h('div', { class: 'cb-flex' }),
    g('cb-right', refs.swing, refs.key, refs.draw, refs.auto, refs.follow, refs.pads, refs.kbd, refs.map)
  );
  refresh();
}
function setPos(b) {
  b = Math.max(0, b);
  pr().pos = b;
  if (U.engine.playing) U.engine.play(b);
  U.inval('arrange', 'transport');
}
function keyMenu(anchor) {
  const k = pr().key;
  U.menu([
    { header: '근음' },
    ...U.ROOT_NAMES.map((n, i) => ({ label: n, checked: k.root === i, action: () => { pr().key = { root: i, scale: k.scale }; U.commit('키'); } })),
    { sep: true },
    { header: '스케일' },
    ...U.SCALES.map(s => ({ label: s.name, checked: k.scale === s.id, action: () => { pr().key = { root: k.root, scale: s.id }; U.commit('스케일'); } }))
  ], anchor);
}
function refresh() {
  if (!el || !refs.bpm) return;
  const p = pr(), e = U.engine;
  refs.bpm.update();
  refs.sig.update();
  refs.quant.value = p.quant;
  setPressed(refs.metro, p.metro);
  setPressed(refs.loop, p.loop.on);
  refs.lstart.update(); refs.llen.update();
  refs.lstart.classList.toggle('off', !p.loop.on);
  refs.llen.classList.toggle('off', !p.loop.on);
  setPressed(refs.draw, ui.draw);
  setPressed(refs.auto, ui.auto);
  setPressed(refs.follow, ui.follow);
  setPressed(refs.kbd, ui.keyboard);
  setPressed(refs.pads, U.padsShown());
  for (const b of refs.views.children) b.setAttribute('aria-pressed', b.dataset.v === ui.view ? 'true' : 'false');
  setPressed(refs.map, !!ui.mapMode);
  refs.swing.update();
  refs.key.querySelector('span') ? (refs.key.querySelector('span').textContent = U.scaleLabel(p.key.root, p.key.scale)) : refs.key.append(h('span', { text: U.scaleLabel(p.key.root, p.key.scale) }));
  if (e) {
    refs.play.classList.toggle('on', e.playing);
    setPressed(refs.rec, e.recording);
    setPressed(refs.srec, e.sessionRec);
    refs.back.classList.toggle('lit', e.anyOverride());
  }
}
/* 매 프레임: 위치 */
let lastPos = '';
U.frame(() => {
  if (!refs.pos || !U.engine) return;
  const s = U.fmtPos(U.engine.heardBeat(), pr().sig);
  if (s !== lastPos && !refs.pos.querySelector('input')) { lastPos = s; refs.pos.textContent = s; }
});

U.renderer('transport', refresh);
U.transportBar = { build, refresh, setPos };
})(window.U = window.U || {});
