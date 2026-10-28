/* 울림 — 간편 기능: 빠른 실행(Ctrl+K), 즐겨찾기·최근 쓴 소리, 되돌리기 기록, 녹음 카운트인 */
(function (U) {
'use strict';
const { h, ui, icon } = U;
const A = U.act;
const pr = () => U.project;

/* ================= 즐겨찾기 · 최근 쓴 소리 =================
   내장 사운드는 이름, 내 사운드는 id로 기억한다 (내 사운드 이름을 바꿔도 그대로) */
const FAV_G = '★ 즐겨찾기', RECENT_G = '최근 쓴 소리', RECENT_MAX = 8;
const skey = s => (s.user ? 'u:' + s.id : s.name);
let favs = U.pref('favSounds', []).slice();
let recent = U.pref('recentSounds', []).slice();
function resolve(keys) {
  const all = U.allSounds();
  return keys.map(k => all.find(s => skey(s) === k)).filter(Boolean);
}
const isFav = s => favs.includes(skey(s));
function toggleFav(s) {
  const k = skey(s), on = !favs.includes(k);
  favs = on ? favs.concat(k) : favs.filter(x => x !== k);
  U.setPref('favSounds', favs.slice());
  U.toast(on ? '★ 즐겨찾기에 넣었어요: ' + s.name : '즐겨찾기에서 뺐어요: ' + s.name);
  U.emit('favs', { fav: true });
}
/* 트랙에 넣은 소리 (미리 들어 보기만 한 것은 빼고) */
function noteRecent(s) {
  if (!s) return;
  const k = skey(s);
  if (recent[0] === k) return;
  recent = [k].concat(recent.filter(x => x !== k)).slice(0, RECENT_MAX);
  U.setPref('recentSounds', recent.slice());
  U.emit('favs', { recent: true });
}
/* 사운드 목록 맨 위에 붙이는 두 묶음 (비어 있으면 뺀다) */
function topGroups() {
  const out = [], f = resolve(favs), r = resolve(recent);
  if (f.length) out.push([FAV_G, f]);
  if (r.length) out.push([RECENT_G, r]);
  return out;
}
const favItem = s => ({ label: isFav(s) ? '즐겨찾기에서 빼기' : '★ 즐겨찾기에 넣기', action: () => toggleFav(s) });
U.favs = { FAV_G, RECENT_G, key: skey, isFav, toggle: toggleFav, noteRecent, topGroups, menuItem: favItem };

/* ================= 되돌리기 기록 ================= */
const HIST_MAX = 40;
function historyMenu(at) {
  const { labels, i } = U.history();
  const lo = Math.max(0, labels.length - HIST_MAX);
  const items = [{ header: '되돌리기 기록 · 누르면 그때로 돌아가요' }];
  for (let k = labels.length - 1; k >= lo; k--) {
    items.push({
      label: k === 0 && labels[0] === '열기' ? '처음 연 상태' : labels[k], checked: k === i, cls: k > i ? 'undone' : null,
      key: k === i ? '지금' : k > i ? '되돌린 것' : (i - k) + '번 전',
      action: () => A.goHistory(k)
    });
  }
  if (lo > 0) items.push({ label: '… 앞의 기록 ' + lo + '개', disabled: true });
  if (labels.length <= 1) items.push({ label: '아직 바꾼 것이 없어요', disabled: true });
  const el = U.menu(items, at || { x: window.innerWidth / 2 - 120, y: 80 });
  const cur = el.querySelector('.m-item.checked');
  if (cur) { cur.focus({ preventScroll: true }); cur.scrollIntoView({ block: 'nearest' }); }
  return el;
}
/* 되돌리기·다시 실행 단추를 길게 누르거나 오른쪽 클릭하면 기록이 열린다 */
function bindHistory(b) {
  b.addEventListener('contextmenu', e => { e.preventDefault(); historyMenu(b); });
  return b;
}

/* ================= 카운트인 =================
   멈춘 상태에서 녹음을 누르면 정한 마디만큼 딸깍으로 먼저 센다 */
const COUNT_OPTS = [[0, '끄기'], [1, '1마디'], [2, '2마디'], [4, '4마디']];
const countIn = () => U.pref('countIn', 0);
function setCountIn(n) {
  U.setPref('countIn', n);
  U.inval('transport');
  U.toast(n ? '녹음을 누르면 ' + n + '마디를 먼저 세요.' : '카운트인을 껐어요. 녹음을 누르면 바로 시작해요.');
}
function metroMenu(at) {
  const p = pr(), cur = countIn();
  return U.menu([
    { label: '메트로놈', checked: p.metro, action: () => { p.metro = !p.metro; U.commit('메트로놈'); } },
    { sep: true },
    { header: '카운트인 · 멈춘 상태에서 녹음할 때 먼저 세기' },
    ...COUNT_OPTS.map(([n, l]) => ({ label: l, checked: cur === n, action: () => setCountIn(n) }))
  ], at);
}
/* 세는 동안 가운데에 박 숫자를 크게 띄운다. 누르면 그만 */
let ciEl = null, ciLast = '';
U.frame(() => {
  const st = U.engine && U.engine.countState();
  if (!st) { if (ciEl) { ciEl.remove(); ciEl = null; ciLast = ''; } return; }
  if (!ciEl) {
    ciEl = h('button', { type: 'button', class: 'countin', 'aria-live': 'assertive' }, h('span', { class: 'ci-n' }), h('span', { class: 'ci-t' }), h('span', { class: 'ci-x', text: '눌러서 그만' }));
    ciEl.addEventListener('click', () => A.cancelCountIn());
    document.body.append(ciEl);
  }
  const key = st.bar + ':' + st.beat;
  if (key === ciLast) return;
  ciLast = key;
  ciEl.querySelector('.ci-n').textContent = st.beat;
  ciEl.querySelector('.ci-t').textContent = (st.mode === 'sess' ? '세션 녹음' : '녹음') + '까지 ' + (st.bars > 1 ? st.bar + ' / ' + st.bars + '마디' : '1마디');
  ciEl.classList.toggle('down', st.beat === 1);
  ciEl.classList.remove('pulse');
  void ciEl.offsetWidth;
  ciEl.classList.add('pulse');
});

/* ================= 빠른 실행 =================
   Ctrl+K(⌘K)나 🔍 단추로 연다. 이름 일부나 초성(ㄱㄹㄷ → 그랜드 피아노)으로
   동작·소리·드럼·장르·키·트랙을 찾아 Enter로 바로 한다 */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const norm = s => String(s || '').toLowerCase().replace(/[\s·()\-/,.…:★]+/g, '');
function initials(s) {
  let o = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00;
    o += c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
  }
  return o;
}
function inOrder(text, q) {
  let j = 0;
  for (const ch of text) if (ch === q[j] && ++j === q.length) return true;
  return false;
}
const midiTarget = () => { const t = U.selTrack(); return t && t.type === 'midi' ? t.id : null; };
const app = name => (...a) => U.appCmds[name](...a);

/* 지금 상태에 맞춘 명령 목록. kind는 오른쪽에 회색으로 보인다 */
function commands() {
  const e = U.engine, p = pr(), t = U.selTrack(), M = U.MOD;
  const out = [];
  const add = (id, label, run, o) => out.push(Object.assign({ id, label, run, kind: '동작' }, o));
  const view = (id, label, run, o) => add(id, label, run, Object.assign({ kind: '화면' }, o));
  // 재생 · 녹음
  // pri: 같은 말로 여럿이 찾히면 먼저 보일 것 (녹음 → 녹음 시작)
  add('play', e.playing ? '정지' : '재생', () => A.togglePlay(), { key: 'Space', pri: 5, keys: 'play stop 재생 정지 플레이 멈추기' });
  add('play0', '처음부터 재생', () => { p.pos = 0; A.play(); U.inval('arrange', 'transport'); }, { keys: 'restart 처음 시작 맨앞' });
  add('rec', e.recording ? '녹음 멈추기' : '녹음 시작 (어레인지먼트)', () => A.setRecord(!e.recording), { key: 'F9', pri: 5, keys: 'record rec 녹음' });
  add('srec', e.sessionRec ? '세션 녹음 멈추기' : '세션 녹음 시작', () => A.setSessionRec(!e.sessionRec), { keys: 'record session 녹음 세션' });
  add('capture', 'MIDI 캡처 · 방금 친 연주 건지기', () => A.capture(), { keys: 'capture 캡처 건지기 연주' });
  add('metro', '메트로놈', () => { p.metro = !p.metro; U.commit('메트로놈'); }, { on: p.metro, pri: 3, keys: 'metronome click 딸깍 박자' });
  for (const [n, l] of COUNT_OPTS) add('ci' + n, '카운트인 ' + l, () => setCountIn(n), { on: countIn() === n || null, keys: 'countin count 카운트인 세기 미리 녹음' });
  add('loop', '루프', () => { p.loop.on = !p.loop.on; U.commit('루프'); }, { on: p.loop.on, keys: 'loop 반복' });
  add('tempo', '템포 바꾸기…', () => U.ask('템포 (BPM)', 'BPM', String(p.bpm)).then(v => { const n = parseFloat(v); if (n >= 20 && n <= 999) A.setTempo(n, true); }), { hint: p.bpm + ' BPM', keys: 'tempo bpm 빠르기 속도' });
  for (const [a, b] of [[4, 4], [3, 4], [6, 8], [5, 4], [7, 8], [12, 8]]) add('sig' + a + b, '박자표 ' + a + '/' + b, () => { p.sig = [a, b]; U.commit('박자표'); }, { on: (p.sig[0] === a && p.sig[1] === b) || null, keys: 'time signature 박자' });
  add('stopall', '모든 클립 멈추기', () => U.engine.stopAll(), { keys: 'stop clips 클립 멈춤' });
  add('backarr', '어레인지먼트로 돌아가기', () => U.engine.backToArrangement(), { keys: 'back arrangement 되돌아가기' });
  // 편집
  add('undo', '되돌리기', () => A.undo(), { key: M + '+Z', keys: 'undo 취소 실행취소' });
  add('redo', '다시 실행', () => A.redo(), { key: M + '+Shift+Z', keys: 'redo' });
  add('hist', '되돌리기 기록…', () => historyMenu(), { keys: 'history undo 기록 내역 히스토리' });
  // 트랙 · 씬
  add('addmidi', 'MIDI 트랙 넣기', () => A.addTrack('midi'), { keys: 'add track new 트랙 추가 만들기' });
  add('addaudio', '오디오 트랙 넣기', () => A.addTrack('audio'), { keys: 'add audio track 트랙 추가 녹음' });
  add('addret', '리턴 트랙 넣기', () => A.addReturn(), { keys: 'return send 리턴 센드' });
  add('addscene', '씬 넣기', () => A.insertScene(ui.scene + 1), { keys: 'scene 씬 추가' });
  add('song', '씬으로 곡 만들기…', () => U.songDialog(), { keys: 'song arrange 곡 구성 어레인지' });
  if (t && U.isPlayable(t)) {
    const name = U.trackLabel(p, t);
    add('arm', '녹음 준비 · ' + name, () => { t.arm = !t.arm; U.commit('녹음 준비'); }, { on: !!t.arm, keys: 'arm 녹음준비 암' });
    add('duptrack', '트랙 복제 · ' + name, () => A.duplicateTrack(t.id), { keys: 'duplicate track 복사 트랙' });
    add('deltrack', '트랙 지우기 · ' + name, () => A.deleteTrack(t.id), { keys: 'delete remove track 삭제 트랙' });
    if (t.type === 'midi') add('pick', '소리 고르기 · ' + name, () => U.soundPanel(t), { keys: 'sound instrument preset 악기 소리 바꾸기' });
  }
  for (const x of p.tracks) add('trk:' + x.id, '트랙 고르기 · ' + U.trackLabel(p, x), () => { U.selectTrack(x.id); U.inval('session', 'arrange', 'mixer', 'insp', 'shell'); }, { kind: '트랙', on: x.id === (t && t.id) || null, keys: 'track select 트랙 선택' });
  // 화면
  view('vsess', '세션 화면', () => U.setView('session'), { key: 'Tab', keys: 'session view 세션' });
  view('varr', '곡 화면 (어레인지먼트)', () => U.setView('arrange'), { key: 'Tab', keys: 'arrangement view 곡 타임라인' });
  view('vpads', '패드 화면', () => U.setView('pads'), { key: 'P', keys: 'pads view 패드 드럼 연주' });
  view('brw', '브라우저 보이기', () => U.toggleBrowser(), { on: !!ui.browserOpen, key: M + '+Alt+B', keys: 'browser 브라우저 목록' });
  view('kbd', '컴퓨터 건반', () => U.setKeyboard(!ui.keyboard), { on: !!ui.keyboard, key: 'M', keys: 'keyboard piano 건반 키보드' });
  view('draw', '그리기 모드', () => U.setDraw(!ui.draw), { on: !!ui.draw, key: 'B', keys: 'draw pencil 그리기 연필' });
  view('auto', '자동화 모드', () => U.setAutoMode(!ui.auto), { on: !!ui.auto, key: 'A', keys: 'automation 자동화' });
  view('follow', '따라가기', () => { ui.follow = !ui.follow; U.setPref('follow', ui.follow); U.inval('transport'); }, { on: !!ui.follow, keys: 'follow 스크롤' });
  for (const d of U.designs) view('dz:' + d.id, '디자인 ' + d.letter + ' · ' + d.name, () => U.shell.setDesign(d.id), { on: U.design === d.id || null, keys: 'design layout 디자인 화면 ' + d.tag });
  for (const [m, l] of [['auto', '자동'], ['desktop', '컴퓨터 버전'], ['touch', '아이패드 버전']]) view('mode:' + m, '화면 버전 · ' + l, () => U.setUIMode(m), { on: U.uiMode === m || null, keys: 'mode ipad touch desktop 화면 버전' });
  // 파일
  add('save', '바로 저장', () => U.saveNow(), { key: M + '+S', keys: 'save 저장' });
  add('saveas', '다른 이름으로 저장…', app('saveAs'), { keys: 'save as copy 저장 사본' });
  add('new', '새 프로젝트…', () => U.newProjectDialog(), { keys: 'new project 새 프로젝트 시작' });
  add('demo', '데모 곡 열기', () => U.openDemo(), { keys: 'demo 데모' });
  add('wav', '오디오 내보내기 (WAV)…', app('exportDialog'), { keys: 'export wav audio 내보내기 저장 bounce' });
  add('mid', 'MIDI 파일 내보내기', app('exportMidi'), { keys: 'export midi 내보내기' });
  add('pfile', '프로젝트 파일 내보내기', app('exportProjectFile'), { keys: 'export project json 내보내기 백업' });
  add('pimp', '프로젝트 파일 가져오기…', () => U.appCmds.importProjectFile(), { keys: 'import project open 가져오기 열기' });
  add('aimp', '오디오 파일 가져오기…', () => U.browserView.importFiles(), { keys: 'import audio wav mp3 가져오기 샘플' });
  add('prefs', '환경설정…', app('prefsDialog'), { keys: 'settings preferences 설정 옵션' });
  add('help', '도움말 · 단축키', app('helpDialog'), { key: '?', keys: 'help shortcuts 도움 단축키' });
  // 키 (근음 × 메이저·마이너)
  for (const sc of ['major', 'minor']) {
    U.ROOT_NAMES.forEach((n, r) => add('key:' + r + sc, '키 · ' + U.scaleLabel(r, sc), () => { p.key = { root: r, scale: sc }; U.commit('키'); }, { kind: '키', on: (p.key.root === r && p.key.scale === sc) || null, keys: 'key scale 키 스케일 조' }));
  }
  // 소리 · 드럼 · 루프 패드 · 이펙트 · 새 곡
  for (const s of U.allSounds()) {
    if (s.name === '빈 샘플러') continue;
    add('snd:' + skey(s), s.name, () => A.loadSound(midiTarget(), s), { kind: (isFav(s) ? '★ ' : '') + '소리 · ' + s.tags[0], keys: s.tags.join(' ') + ' ' + U.DEV[s.kind].name + ' sound 소리 악기' });
  }
  for (const k of U.KITS) add('kit:' + k.name, k.name, () => A.loadKit(midiTarget(), k), { kind: '드럼 킷', keys: k.tags.join(' ') + ' drum kit 드럼' });
  for (const k of U.LOOPKITS) add('lp:' + k.name, k.name, () => { const tr = A.loadLoopKit(midiTarget(), k); if (tr) ui.padTrack = tr.id; }, { kind: '루프 패드', keys: k.tags.join(' ') + ' loop pad 패드 찹' });
  for (const kind of Object.keys(U.DEV).filter(k => U.DEV[k].type === 'audio')) {
    add('fx:' + kind, '이펙트 넣기 · ' + U.DEV[kind].name, () => { const tr = U.selTrack(); if (tr) A.addDevice(tr.id, kind); }, { kind: '이펙트', keys: 'effect fx 이펙트 효과 ' + kind });
  }
  for (const g of U.GENRES) add('genre:' + g.id, '새 곡 시작 · ' + g.name, () => U.newProjectFlow(g.id), { kind: '장르', hint: g.bpm + ' BPM', keys: (g.desc || '') + ' genre template 장르 템플릿 새곡' });
  return out;
}

const QK = { el: null, input: null, list: null, items: [], sel: 0, all: [] };
let qkRecent = U.pref('qkRecent', []).slice();
function prep(c) {
  c.n = norm(c.label);
  c.c = initials(c.n);
  c.k = norm(c.keys) + norm(c.kind);
  return c;
}
function score(c, q, cho) {
  let s;
  if (c.n === q) s = 120;
  else if (c.n.startsWith(q)) s = 100;
  else if (c.n.includes(q)) s = 80;
  else if (cho && c.c.includes(q)) s = c.c.startsWith(q) ? 75 : 60;
  else if (c.k.includes(q)) s = 50;
  else if (q.length >= 2 && inOrder(c.n, q)) s = 25;
  else return 0;
  return s + (c.pri || 0) + (c.kind === '동작' || c.kind === '화면' ? 4 : 0) + (qkRecent.includes(c.id) ? 6 : 0) - c.n.length * 0.05;
}
/* 숫자를 치면 그 템포로 바꾸는 명령을 맨 위에 */
function tempoCmd(raw) {
  const m = /^(?:템포|tempo|bpm)?\s*(\d{2,3}(?:\.\d+)?)\s*(?:bpm)?$/i.exec(raw.trim());
  const n = m && parseFloat(m[1]);
  if (!(n >= 20 && n <= 999)) return null;
  return prep({ id: 'tempo=', label: '템포를 ' + n + ' BPM으로', kind: '동작', hint: '지금 ' + pr().bpm, run: () => A.setTempo(n, true) });
}
function filter() {
  const raw = QK.input.value, q = norm(raw);
  if (!q) {
    // 아무것도 안 쳤을 때: 최근에 쓴 것, 그다음 동작과 화면
    const rec = qkRecent.map(id => QK.all.find(c => c.id === id)).filter(Boolean);
    QK.items = rec.map(c => Object.assign(Object.create(c), { recent: true })).concat(QK.all.filter(c => c.kind === '동작' || c.kind === '화면'));
  } else {
    const cho = /^[ㄱ-ㅎ]+$/.test(q);
    QK.items = QK.all.map(c => [c, score(c, q, cho)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 60).map(x => x[0]);
    const tc = tempoCmd(raw);
    if (tc) QK.items.unshift(tc);
  }
  QK.sel = 0;
  render();
}
function render() {
  U.clear(QK.list);
  if (!QK.items.length) {
    QK.list.append(h('p', { class: 'qk-empty', text: '찾는 것이 없어요. 다른 말이나 초성(예: ㄱㄹㄷ)으로 찾아보세요.' }));
    return;
  }
  QK.items.forEach((c, i) => {
    const row = h('button', { type: 'button', class: 'qk-item' + (i === QK.sel ? ' sel' : ''), role: 'option', 'aria-selected': i === QK.sel ? 'true' : 'false', dataset: { i } },
      h('span', { class: 'qk-on', text: c.on === true ? '✓' : c.recent ? '↺' : '' }),
      h('span', { class: 'qk-l', text: c.label }),
      c.on === false ? h('span', { class: 'qk-off', text: '꺼짐' }) : null,
      c.hint ? h('span', { class: 'qk-h', text: c.hint }) : null,
      c.key ? h('kbd', { class: 'qk-k', text: c.key }) : h('span', { class: 'qk-kind', text: c.recent ? '최근' : c.kind }));
    row.addEventListener('pointermove', () => { if (QK.sel !== i) select(i, false); });
    row.addEventListener('click', () => run(i));
    QK.list.append(row);
  });
  if (!norm(QK.input.value)) QK.list.append(h('p', { class: 'qk-tip', text: '소리·드럼 킷·장르·키·트랙·이펙트 이름도 찾아요. 초성(ㄱㄹㄷ)이나 템포 숫자(90)를 쳐도 돼요.' }));
}
function select(i, scroll) {
  QK.sel = Math.max(0, Math.min(QK.items.length - 1, i));
  for (const r of QK.list.querySelectorAll('.qk-item')) {
    const on = +r.dataset.i === QK.sel;
    r.classList.toggle('sel', on);
    r.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on && scroll !== false) r.scrollIntoView({ block: 'nearest' });
  }
}
function run(i) {
  const c = QK.items[i];
  if (!c) return;
  close();
  if (c.id !== 'tempo=') {
    qkRecent = [c.id].concat(qkRecent.filter(x => x !== c.id)).slice(0, 6);
    U.setPref('qkRecent', qkRecent.slice());
  }
  U.ensureAudio();
  try { c.run(); } catch (err) { console.error(err); U.toast('하지 못했어요: ' + c.label, 'error'); }
}
function close() {
  if (!QK.el) return;
  QK.el.remove();
  QK.el = null;
  if (QK.back && QK.back.isConnected) QK.back.focus({ preventScroll: true });
}
function open(q) {
  if (QK.el) { close(); return; }
  U.closeMenu();
  QK.back = document.activeElement;
  QK.all = commands().map(prep);
  QK.input = h('input', { class: 'qk-q', type: 'search', placeholder: '무엇을 할까요? 녹음, 피아노, 템포 90, ㄱㄹㄷ …', 'aria-label': '빠른 실행 찾기', autocomplete: 'off', spellcheck: 'false', value: q || '' });
  QK.list = h('div', { class: 'qk-list', role: 'listbox', 'aria-label': '빠른 실행 목록' });
  const box = h('div', { class: 'qk', role: 'dialog', 'aria-modal': 'true', 'aria-label': '빠른 실행' },
    h('div', { class: 'qk-in' }, icon('search'), QK.input, h('kbd', { class: 'qk-esc', text: 'Esc' })),
    QK.list,
    h('div', { class: 'qk-foot', text: U.isTouch ? '눌러서 바로 해요 · 바깥을 누르면 닫혀요' : '↑↓ 고르기 · Enter 하기 · Esc 닫기 · ' + U.MOD + '+K 열고 닫기' }));
  QK.el = h('div', { class: 'qk-back' }, box);
  QK.el.addEventListener('pointerdown', e => { if (e.target === QK.el) close(); });
  QK.input.addEventListener('input', filter);
  QK.input.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); select(QK.sel + (k === 'ArrowDown' ? 1 : -1)); }
    else if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); select(QK.sel + (k === 'PageDown' ? 8 : -8)); }
    else if (k === 'Enter') { e.preventDefault(); if (!e.isComposing) run(QK.sel); }
    else if (k === 'Escape') { e.preventDefault(); if (QK.input.value) { QK.input.value = ''; filter(); } else close(); }
    else if (k === 'Tab') e.preventDefault();
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') { e.preventDefault(); close(); }
    else return;
    e.stopPropagation();
  });
  document.body.append(QK.el);
  filter();
  QK.input.focus();
}
/* 화면 위쪽 단추 */
function button(cls) {
  return U.btn({ icon: 'search', cls: 'ghost qk-open' + (cls ? ' ' + cls : ''), title: '빠른 실행 (' + U.MOD + '+K)', info: ['빠른 실행 (' + U.MOD + '+K)', '하고 싶은 것을 글로 찾아 바로 해요. "녹음", "피아노", "템포 90", 초성 "ㄱㄹㄷ"처럼 쳐 보세요.'], onclick: () => open() });
}

U.quick = { open, close, isOpen: () => !!QK.el, button, historyMenu, bindHistory, metroMenu, setCountIn, countIn, COUNT_OPTS, commands };
})(window.U = window.U || {});
