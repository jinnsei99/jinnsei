/* 울림 — 시작: 화면 틀, 오디오, 프로젝트 불러오기·자동 저장, 메뉴, 대화상자 */
(function (U) {
'use strict';
const { h, ui, icon, btn, info } = U;
const A = U.act;
const pr = () => U.project;
let els = {};

/* ================= 오디오 ================= */
function createAudio() {
  const C = window.AudioContext || window.webkitAudioContext;
  let ctx;
  try { ctx = new C({ latencyHint: 'interactive' }); } catch (e) { ctx = new C(); }
  U.engine = new U.Engine(ctx);
}
U.ensureAudio = function () {
  const ctx = U.engine.ctx;
  if (ctx.state !== 'running') ctx.resume().then(() => U.inval('status')).catch(() => {});
  U.engine.start();
};

/* ================= 화면 틀 ================= */
function buildLayout() {
  const app = h('div', { class: 'app', id: 'app' });
  els.ctrl = h('header', { class: 'ctrl', role: 'toolbar', 'aria-label': '컨트롤 바' });
  els.browser = h('aside', { class: 'browser', 'aria-label': '브라우저' });
  els.session = h('section', { class: 'view v-session', 'aria-label': '세션 뷰' });
  els.arrange = h('section', { class: 'view v-arrange', 'aria-label': '어레인지먼트 뷰' });
  els.pads = h('section', { class: 'view v-pads', 'aria-label': '패드 화면' });
  els.views = h('div', { class: 'views' }, els.session, els.arrange, els.pads);
  els.main = h('div', { class: 'main' }, els.browser, els.views);
  els.split = h('div', { class: 'split-h', role: 'separator', 'aria-label': '아래 칸 높이 조절' });
  info(els.split, '높이 조절', '끌어서 아래 클립·장치 칸의 높이를 바꿔요.');
  els.info = h('div', { class: 'infoview', 'aria-live': 'polite' }, h('div', { class: 'iv-t' }), h('div', { class: 'iv-d' }));
  els.dtHead = h('div', { class: 'dt-head' });
  els.dtBody = h('div', { class: 'dt-body' });
  els.detail = h('section', { class: 'detail', 'aria-label': '클립·장치 칸' }, els.info, h('div', { class: 'dt' }, els.dtHead, els.dtBody));
  els.status = h('footer', { class: 'status' });
  els.panes = h('nav', { class: 'panes', 'aria-label': '화면 고르기' });
  app.append(els.ctrl, els.main, els.split, els.detail, els.status, els.panes);
  document.body.append(app);
  document.body.classList.toggle('no-detail', !ui.detailOpen);
  document.body.classList.toggle('no-browser', !ui.browserOpen);
  const dh = U.pref('detailH', 320);
  document.documentElement.style.setProperty('--detail-h', dh + 'px');
  bindSplit();
  buildPanes();
}
function bindSplit() {
  els.split.addEventListener('pointerdown', e => {
    e.preventDefault();
    els.split.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const h0 = els.detail.getBoundingClientRect().height;
    const move = ev => {
      const hh = U.clamp(h0 + (y0 - ev.clientY), 140, window.innerHeight - 220);
      document.documentElement.style.setProperty('--detail-h', hh + 'px');
    };
    const up = () => {
      els.split.removeEventListener('pointermove', move);
      els.split.removeEventListener('pointerup', up);
      U.setPref('detailH', Math.round(els.detail.getBoundingClientRect().height));
      U.inval('arrange-draw', 'detail');
    };
    els.split.addEventListener('pointermove', move);
    els.split.addEventListener('pointerup', up);
  });
  els.split.addEventListener('dblclick', () => U.toggleDetail());
}
/* 좁은 화면: 한 번에 한 칸 */
function buildPanes() {
  U.clear(els.panes);
  const items = [['session', '세션', 'session'], ['arrange', '어레인지', 'arrange'], ['pads', '패드', 'pads'], ['detail', '편집', 'detail'], ['browser', '브라우저', 'browser']];
  for (const [id, label, ic] of items) {
    const b = h('button', { type: 'button', class: 'pane-b', 'aria-pressed': paneOn(id) ? 'true' : 'false' }, icon(ic), h('span', { text: label }));
    b.addEventListener('click', () => setPane(id));
    els.panes.append(b);
  }
}
function paneOn(id) {
  if (ui.pane === 'main') return id === ui.view;
  return ui.pane === id;
}
function setPane(id) {
  if (id === 'session' || id === 'arrange' || id === 'pads') { ui.pane = 'main'; U.setView(id); }
  else ui.pane = id;
  document.body.dataset.pane = ui.pane;
  buildPanes();
  U.inval('arrange-draw', 'detail');
}
U.setView = function (v) {
  if (ui.view === 'pads' && v !== 'pads') U.padsView.releaseAll();
  if (v === 'pads' && ui.view !== 'pads') ui.prevView = ui.view;
  ui.view = v;
  U.setPref('view', v);
  document.body.dataset.view = v;
  if (ui.pane !== 'main' && ui.narrow) { ui.pane = 'main'; document.body.dataset.pane = 'main'; }
  if (ui.narrow) buildPanes();
  U.inval('status', 'arrange', 'session', 'pads', 'transport');
};

/* ================= 아래 칸 (클립 / 장치) ================= */
function renderDetail() {
  U.clear(els.dtHead);
  const t = U.selTrack();
  const r = U.clipRef();
  const tabs = U.seg([['clip', '클립', '고른 클립의 음표나 오디오를 편집해요. Shift+Tab으로 바꿔요.'], ['device', '장치', '고른 트랙의 악기와 이펙트예요. Shift+Tab으로 바꿔요.']], ui.detail, v => { U.setDetail(v); }, 'dt-tabs');
  const title = h('span', { class: 'dt-title', text: ui.detail === 'clip' ? (r ? (r.clip.name || (r.clip.type === 'audio' ? '오디오 클립' : 'MIDI 클립')) + ' — ' + U.trackLabel(pr(), r.track) : '클립 없음') : (t ? U.trackLabel(pr(), t) : '') });
  const fold = btn({ icon: 'detail', cls: 'ghost sm', title: '아래 칸 접기', info: ['아래 칸 접기', '클립·장치 칸을 접거나 펼쳐요. 경계선을 두 번 눌러도 돼요.'], onclick: () => U.toggleDetail() });
  // 건반 악기 트랙이면 악기 소리를 여기서 바로 바꾼다 (클립을 고치다가도). 드럼·루프 패드는 장치의 키트 메뉴로 바꾼다
  const st = ui.detail === 'clip' ? r && r.track : t, sti = st && U.instrumentOf(st);
  const pick = st && st.type === 'midi' && !(sti && (sti.kind === 'drums' || sti.kind === 'looppad')) ? h('span', { class: 'snd-pickers' }, h('span', { class: 'snd-l', text: '소리' }), ...U.soundPicker(st)) : null;
  els.dtHead.append(...[tabs, title, pick, h('span', { class: 'cb-flex' }), fold].filter(Boolean));
  if (!ui.detailOpen && !ui.narrow) return;
  if (ui.detail === 'clip') U.clipView.render(els.dtBody);
  else U.deviceView.render(els.dtBody);
}

/* ================= 상태 표시줄 ================= */
function renderStatus() {
  U.clear(els.status);
  const st = U.store.status, mode = U.store.mode;
  const saveText = st === 'saving' ? '저장 중…' : st === 'error' ? (U.store.error || '저장하지 못했어요') : st === 'saved' ? (mode === 'cloud' ? 'Claude 계정에 저장됨' : mode === 'local' ? '이 브라우저에 저장됨' : '저장 안 됨 (이 창을 닫으면 사라져요)') : (mode === 'cloud' ? 'Claude 계정에 자동 저장' : '이 브라우저에 자동 저장');
  const save = h('span', { class: 'st-save' + (st === 'error' ? ' err' : ''), text: saveText });
  info(save, '저장', mode === 'cloud' ? '프로젝트는 바꿀 때마다 내 Claude 계정의 비공개 공간에 저장돼요. 가져온 오디오 파일은 이 브라우저에만 있어요.' : '프로젝트는 바꿀 때마다 이 브라우저에 저장돼요. 다른 기기로 옮기려면 메뉴에서 프로젝트 파일로 내보내세요.');
  const name = h('button', { class: 'st-proj', type: 'button', text: pr().name || '이름 없는 프로젝트' });
  info(name, '프로젝트 이름', '눌러서 이름을 바꿔요.');
  name.addEventListener('click', () => U.ask('프로젝트 이름', '이름', pr().name).then(v => { if (v) { pr().name = v; U.commit('프로젝트 이름'); } }));
  const left = h('div', { class: 'st-l' }, name, save);
  const right = h('div', { class: 'st-r' });
  const ctx = U.engine.ctx;
  if (ctx.state !== 'running') {
    const on = h('button', { class: 'st-audio', type: 'button', text: '소리 켜기' });
    info(on, '소리 켜기', '브라우저는 화면을 한 번 눌러야 소리를 낼 수 있어요.');
    on.addEventListener('click', () => U.ensureAudio());
    right.append(on);
  }
  if (ui.keyboard) right.append(h('span', { class: 'st-kb', text: '⌨ C' + ui.octave + ' · ' + ui.velocity }));
  if (U.isTouch) {
    // 키보드가 없을 때를 위해 되돌리기·다시 실행을 눈에 보이게
    const un = btn({ icon: 'undo', cls: 'ghost sm st-undo', title: '되돌리기', onclick: () => A.undo() });
    const re = btn({ icon: 'undo', cls: 'ghost sm st-redo', title: '다시 실행', onclick: () => A.redo() });
    un.disabled = !U.canUndo();
    re.disabled = !U.canRedo();
    right.append(un, re);
  }
  const md = h('button', { class: 'st-mode', type: 'button', text: U.uiModeName() });
  info(md, '화면 버전', '컴퓨터 버전(마우스·키보드)과 아이패드 버전(손가락) 중에서 골라요. 자동이면 이 기기에 맞춰요.');
  md.addEventListener('click', () => modeMenu(md));
  right.append(md);
  const mc = U.input.midiCount();
  const midi = h('button', { class: 'st-midi', type: 'button', text: mc ? 'MIDI ' + mc : 'MIDI 연결' });
  info(midi, 'MIDI 장치', mc ? 'MIDI 건반 ' + mc + '개가 연결돼 있어요. 연주는 녹음 준비(●)한 트랙이나 고른 트랙으로 가요.' : 'USB MIDI 건반을 꽂고 눌러서 연결해요.');
  midi.addEventListener('click', () => U.input.connectMidi(true));
  right.append(midi);
  right.append(h('span', { class: 'st-sr', text: Math.round(ctx.sampleRate / 100) / 10 + ' kHz' }));
  const vs = btn({ icon: 'session', cls: 'ghost sm' + (ui.view === 'session' ? ' on' : ''), title: '세션 뷰 (Tab)', info: ['세션 뷰', '클립을 칸에 담아 자유롭게 띄우는 화면이에요. Tab으로 바꿔요.'], onclick: () => U.setView('session') });
  const va = btn({ icon: 'arrange', cls: 'ghost sm' + (ui.view === 'arrange' ? ' on' : ''), title: '어레인지먼트 뷰 (Tab)', info: ['어레인지먼트 뷰', '시간 순서대로 곡을 배치하는 화면이에요. Tab으로 바꿔요.'], onclick: () => U.setView('arrange') });
  const vp = btn({ icon: 'pads', cls: 'ghost sm' + (ui.view === 'pads' ? ' on' : ''), title: '패드 화면 (P)', info: ['패드 화면', '루프 패드·드럼 머신의 패드 16개를 크게 띄우고 글자 키로 쳐요.'], onclick: () => U.setView('pads') });
  const vb = btn({ icon: 'browser', cls: 'ghost sm' + (ui.browserOpen ? ' on' : ''), title: '브라우저 보이기 (' + U.MOD + '+Alt+B)', onclick: () => U.toggleBrowser() });
  const vd = btn({ icon: 'detail', cls: 'ghost sm' + (ui.detailOpen ? ' on' : ''), title: '아래 칸 보이기', onclick: () => U.toggleDetail() });
  right.append(h('span', { class: 'st-views' }, vb, vs, va, vp, vd));
  els.status.append(left, right);
}

/* ================= 정보 창 기본 글 ================= */
function infoDefault() {
  if (ui.view === 'pads') return ['패드 화면', '패드를 누르거나 패드에 적힌 글자 키로 쳐요. 키 지정을 켜면 패드마다 글자를 바꿀 수 있어요. Shift를 누른 채 치면 노트 리피트, Tab은 세션 뷰로 돌아가요.'];
  if (ui.keyboard) return ['컴퓨터 건반 켜짐', 'A·S·D·F·G·H·J·K가 흰 건반, W·E·T·Y·U가 검은 건반이에요. Z/X로 옥타브, C/V로 세기를 바꿔요.'];
  return ui.view === 'session'
    ? ['세션 뷰', '클립의 ▶를 누르면 다음 마디에 맞춰 재생돼요. 오른쪽 열의 ▶는 씬(가로 한 줄)을 한꺼번에 띄워요. 마우스를 올리면 여기에 설명이 나와요.']
    : ['어레인지먼트 뷰', '클립을 시간 순서로 배치해 곡을 완성해요. 눈금자를 눌러 시작 위치를 정하고 Space로 재생해요. A를 누르면 자동화를 그려요.'];
}

/* ================= 프로젝트 ================= */
const autosave = U.debounce(() => { U.store.saveProject(pr()); }, 1500);
U.saveNow = function () { autosave.flush(); U.toast('저장했어요'); };
U.openProject = async function (id) {
  if (id === pr().id) { U.toast('지금 열려 있는 프로젝트예요.'); return; }
  autosave.flush();
  try {
    const p = await U.store.loadProject(id);
    if (!p) { U.toast('프로젝트를 찾지 못했어요.', 'error'); return; }
    loadProject(p);
    U.toast('"' + p.name + '"을(를) 열었어요.');
  } catch (e) { console.error(e); U.toast('프로젝트를 열지 못했어요.', 'error'); }
};
function loadProject(p) {
  if (U.engine.playing) U.engine.stop();
  U.engine.allLiveOff();
  U.setProject(p);
  U.setPref('last', pr().id);
}
U.openDemo = function () {
  autosave.flush();
  loadProject(U.demoProject());
  U.toast('데모 곡을 열었어요. 고치면 새 프로젝트로 저장돼요.');
};
/* genre를 주면 그 장르의 곡 뼈대로 시작한다 */
U.newProjectFlow = function (genre) {
  autosave.flush();
  let p;
  if (genre) p = U.genreProject(genre);
  else {
    p = U.newProject('새 프로젝트');
    p.key = Object.assign({}, pr().key);
  }
  loadProject(p);
  U.commit('새 프로젝트');
  if (genre) {
    U.setView('session');
    U.toast(p.name + '를 만들었어요. 씬의 ▶로 부분을 띄우거나, ' + (U.isTouch ? '위의 ▶ 재생으로' : 'Tab → Space로') + ' 곡 전체를 들어 보세요.');
  } else U.toast('새 프로젝트를 만들었어요.');
};
async function saveAs() {
  const name = await U.ask('다른 이름으로 저장', '새 이름', (pr().name || '프로젝트') + ' 사본');
  if (!name) return;
  autosave.flush();
  const p = JSON.parse(JSON.stringify(pr()));
  p.id = U.uid('p');
  p.name = name;
  p.created = Date.now();
  loadProject(p);
  U.commit('다른 이름으로 저장');
  U.toast('"' + name + '"(으)로 저장했어요.');
}
/* 프로젝트 파일 (.json) — 가져온 오디오도 함께 담는다 */
async function exportProjectFile() {
  const p = JSON.parse(JSON.stringify(pr()));
  const refs = new Set();
  for (const t of p.tracks) {
    for (const c of t.slots) if (c && c.type === 'audio' && c.ref.startsWith('user:')) refs.add(c.ref);
    for (const a of t.arr) if (a.clip.type === 'audio' && a.clip.ref.startsWith('user:')) refs.add(a.clip.ref);
    for (const d of t.devices) {
      if (d.data && d.data.sample && d.data.sample.startsWith('user:')) refs.add(d.data.sample);
      if (d.data && d.data.src && d.data.src.startsWith('user:')) refs.add(d.data.src);
      if (d.data && d.data.pads) for (const pd of d.data.pads) if (pd.sample && pd.sample.startsWith('user:')) refs.add(pd.sample);
    }
  }
  const media = {};
  for (const ref of refs) {
    const rec = await U.store.getAudio(ref.slice(5));
    if (rec) media[ref] = { name: rec.name, bpm: rec.bpm, loop: rec.loop, duration: rec.duration, type: rec.type, b64: b64(rec.bytes) };
  }
  const out = { app: 'ullim', v: 1, project: p, media };
  const r = await U.store.offer(U.safeName(p.name) + '.ullim.json', new Blob([JSON.stringify(out)], { type: 'application/json' }));
  if (r === 'saved') U.toast('프로젝트 파일을 내보냈어요.');
}
function b64(buf) {
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}
async function importProjectFile(file) {
  if (!file) {
    const files = await U.store.pickFile('.json,application/json', false);
    if (!files.length) return;
    file = files[0];
  }
  try {
    const data = JSON.parse(await file.text());
    const p = data.project || data;
    for (const [ref, m] of Object.entries(data.media || {})) {
      const bytes = unb64(m.b64);
      await U.store.putAudio({ hash: ref.slice(5), name: m.name, bytes, duration: m.duration, bpm: m.bpm, loop: m.loop, size: bytes.byteLength, type: m.type, created: Date.now() });
      U.media.setInfo(ref, { name: m.name, bpm: m.bpm, loop: m.loop, duration: m.duration });
    }
    U.normalize(p);
    p.id = U.uid('p');
    autosave.flush();
    loadProject(p);
    U.commit('프로젝트 가져오기');
    U.toast('"' + p.name + '"을(를) 가져왔어요.');
  } catch (e) {
    console.error(e);
    U.toast('울림 프로젝트 파일이 아니에요.', 'error');
  }
}

/* ================= 내보내기 대화상자 ================= */
function exportDialog() {
  const p = pr();
  const end = U.arrangementEnd(p);
  const bar = U.barLen(p.sig);
  const st = { src: end > 0 ? 'arr' : 'scene', scene: Math.max(0, ui.scene), bars: 8, rate: 44100, bits: 16, stems: false, norm: false, tail: 2 };
  const body = h('div', { class: 'xp' });
  const draw = () => {
    U.clear(body);
    const range = U.select([['arr', '어레인지먼트 전체 (' + Math.ceil(end / bar) + '마디)'], ['loop', '루프 구간 (' + U.fmtLen(p.loop.end - p.loop.start, p.sig) + ')'], ['scene', '세션 씬 하나']], st.src, v => { st.src = v; draw(); }, { label: '내보낼 범위' });
    body.append(h('label', { class: 'fld' }, h('span', { text: '범위' }), range));
    if (st.src === 'scene') {
      body.append(h('label', { class: 'fld' }, h('span', { text: '씬' }), U.select(p.scenes.map((s, i) => [String(i), (i + 1) + (s.name ? ' · ' + s.name : '')]), String(st.scene), v => { st.scene = +v; })));
      const bars = h('input', { class: 'inp', type: 'number', min: '1', max: '256', value: String(st.bars) });
      bars.addEventListener('change', () => { st.bars = U.clamp(parseInt(bars.value, 10) || 8, 1, 256); });
      body.append(h('label', { class: 'fld' }, h('span', { text: '길이 (마디)' }), bars));
    }
    body.append(h('div', { class: 'fld-2' },
      h('label', { class: 'fld' }, h('span', { text: '샘플레이트' }), U.select([['44100', '44.1 kHz'], ['48000', '48 kHz']], String(st.rate), v => { st.rate = +v; })),
      h('label', { class: 'fld' }, h('span', { text: '비트' }), U.select([['16', '16비트'], ['24', '24비트'], ['32', '32비트 float']], String(st.bits), v => { st.bits = +v; }))));
    const stems = h('input', { type: 'checkbox', id: 'xp-stems' }); stems.checked = st.stems; stems.addEventListener('change', () => { st.stems = stems.checked; });
    const norm = h('input', { type: 'checkbox', id: 'xp-norm' }); norm.checked = st.norm; norm.addEventListener('change', () => { st.norm = norm.checked; });
    body.append(h('label', { class: 'chk', for: 'xp-stems' }, stems, h('span', { text: '트랙별 파일(스템)도 함께 — ZIP으로 묶어요' })));
    body.append(h('label', { class: 'chk', for: 'xp-norm' }, norm, h('span', { text: '가장 큰 소리를 -0.3 dB에 맞추기 (노멀라이즈)' })));
    if (window.claude) body.append(h('p', { class: 'hint', text: 'Claude 안에서는 WAV를 ZIP으로 묶어서 내려받아요.' }));
    body.append(h('div', { class: 'xp-prog', hidden: true }, h('div', { class: 'xp-bar' }), h('span', { class: 'xp-t', text: '' })));
  };
  draw();
  U.dialog({
    title: '오디오 내보내기', body, width: '420px',
    actions: [{ label: '취소' }, { label: '내보내기', primary: true, action: async b => {
      b.disabled = true;
      const prog = body.querySelector('.xp-prog');
      prog.hidden = false;
      const barEl = body.querySelector('.xp-bar'), txt = body.querySelector('.xp-t');
      try {
        let from = 0, to = end, scene = null;
        if (st.src === 'loop') { from = p.loop.start; to = p.loop.end; }
        if (st.src === 'scene') { from = 0; to = st.bars * bar; scene = st.scene; }
        if (to - from <= 0) { U.toast('내보낼 내용이 없어요. 어레인지먼트에 클립을 놓거나 세션 씬을 골라 주세요.', 'error'); b.disabled = false; return false; }
        txt.textContent = '소리를 만드는 중…';
        const res = await U.renderOffline(p, { from, to, scene, stems: st.stems, sampleRate: st.rate, tail: st.tail }, f => { barEl.style.transform = 'scaleX(' + f.toFixed(3) + ')'; });
        if (st.norm) U.normalizeAudio(res.files.flatMap(f => f.ch), Math.pow(10, -0.3 / 20));
        const base = U.safeName(p.name) + (st.src === 'scene' ? ' - 씬 ' + (st.scene + 1) : st.src === 'loop' ? ' - 루프' : '');
        txt.textContent = '파일로 묶는 중…';
        let blob, name;
        if (st.stems) {
          const files = res.files.map((f, i) => ({ name: (i === 0 ? '00 ' + base + ' (믹스)' : U.safeName(f.name)) + '.wav', data: U.encodeWav(f.ch, res.sr, st.bits) }));
          blob = await U.zip(files);
          name = base + ' 스템.zip';
        } else {
          blob = U.encodeWav(res.files[0].ch, res.sr, st.bits);
          name = base + '.wav';
        }
        const r = await U.store.offer(name, blob);
        if (r === 'saved') U.toast('내보냈어요: ' + name);
      } catch (e) {
        console.error(e);
        U.toast('내보내지 못했어요: ' + (e.message || e), 'error');
        b.disabled = false;
        return false;
      }
    } }]
  });
}
async function exportMidi() {
  const tracks = U.arrangementNotes(pr());
  let data, name;
  if (!tracks.length) {
    const r = U.clipRef();
    if (!r || r.clip.type !== 'midi') { U.toast('어레인지먼트에 MIDI 클립이 없어요. 클립 하나만 내보내려면 클립을 고른 뒤 다시 눌러 주세요.'); return; }
    data = U.midiFile([{ name: r.clip.name || U.trackLabel(pr(), r.track), notes: r.clip.notes.filter(n => !n.m), drums: U.instrumentOf(r.track) && U.instrumentOf(r.track).kind === 'drums' }], pr().bpm, pr().sig);
    name = U.safeName(r.clip.name || '클립') + '.mid';
  } else {
    data = U.midiFile(tracks, pr().bpm, pr().sig);
    name = U.safeName(pr().name) + '.mid';
  }
  const res = await U.store.offer(name, new Blob([data], { type: 'audio/midi' }));
  if (res === 'saved') U.toast('MIDI 파일을 내보냈어요.');
}
U.importAudioTo = async function (trackId, slot, pos) {
  const refs = await U.browserView.importFiles();
  if (!refs.length) return;
  const t = U.trackById(pr(), trackId);
  if (pos != null) {
    U.ensureAudio();
    await U.media.get(refs[0], U.engine.ctx.sampleRate);
    A.addArrClip(trackId, pos, U.newAudioClip(refs[0], U.media.info(refs[0]), { color: t.color }), null, '오디오 클립');
  } else A.insertAudio(trackId, slot, refs[0]);
};

/* ================= 환경설정 · 도움말 ================= */
/* ================= 화면 버전 (컴퓨터 · 아이패드) ================= */
function modeItems() {
  return [
    { label: '자동 (이 기기는 ' + (U.autoTouch ? '아이패드' : '컴퓨터') + ' 버전)', checked: U.uiMode === 'auto', action: () => U.setUIMode('auto') },
    { label: '컴퓨터 버전 (마우스·키보드)', checked: U.uiMode === 'desktop', action: () => U.setUIMode('desktop') },
    { label: '아이패드 버전 (손가락)', checked: U.uiMode === 'touch', action: () => U.setUIMode('touch') }
  ];
}
function modeMenu(anchor) { U.menu([{ header: '화면 버전' }, ...modeItems()], anchor); }

function prefsDialog() {
  const skin = U.pref('skin', 'auto');
  const body = h('div', { class: 'xp' });
  body.append(h('label', { class: 'fld' }, h('span', { text: '화면 버전' }),
    U.select([['auto', '자동 (이 기기는 ' + (U.autoTouch ? '아이패드' : '컴퓨터') + ' 버전)'], ['desktop', '컴퓨터 버전 (마우스·키보드)'], ['touch', '아이패드 버전 (손가락)']], U.uiMode, v => U.setUIMode(v), { label: '화면 버전' })));
  body.append(h('label', { class: 'fld' }, h('span', { text: '화면 밝기' }), U.select([['auto', '시스템 설정 따르기'], ['dark', '어둡게'], ['light', '밝게']], skin, v => { U.setPref('skin', v); applySkin(); })));
  body.append(h('label', { class: 'fld' }, h('span', { text: '녹음 퀀타이즈' }), U.select([['0', '끄기'], ['0.25', '1/16'], ['0.5', '1/8'], ['1', '1/4']], String(U.pref('recQuant', 0)), v => U.setPref('recQuant', +v))));
  const ctx = U.engine.ctx;
  const lat = Math.round(((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000);
  body.append(h('p', { class: 'hint', text: '오디오: ' + ctx.sampleRate + ' Hz · 지연 약 ' + lat + ' ms' + (ctx.state !== 'running' ? ' · 아직 소리가 꺼져 있어요' : '') }));
  body.append(btn({ text: 'MIDI 장치 연결', cls: 'sm', onclick: () => U.input.connectMidi(true) }));
  U.dialog({ title: '환경설정', body, width: '400px', actions: [{ label: '닫기', primary: true }] });
}
function applySkin() {
  const s = U.pref('skin', 'auto');
  if (s === 'auto') delete document.documentElement.dataset.skin;
  else document.documentElement.dataset.skin = s;
}
function helpDialog() {
  const M = U.MOD;
  const rows = [
    ['Space', '재생 / 정지'], ['Shift+Space', '멈춘 곳에서 이어서 재생'], ['Tab', '세션 ↔ 어레인지먼트'], ['Shift+Tab', '클립 ↔ 장치 칸'],
    ['F9', '어레인지먼트 녹음'], ['P', '패드 화면'], ['패드에 적힌 글자', '패드 치기 (패드 화면, 또는 건반을 켠 루프 패드 트랙)'], ['Shift+패드 글자', '누르는 동안 노트 리피트'], ['M', '컴퓨터 건반 켜기/끄기'], ['A ~ K, W E T Y U', '건반 (켜졌을 때)'], ['Z / X', '옥타브 내리기 / 올리기'], ['C / V', '세기 내리기 / 올리기'],
    ['B', '그리기 모드'], ['A', '자동화 모드 (건반이 꺼졌을 때)'], [M + '+Z', '되돌리기'], [M + '+Shift+Z', '다시 실행'], [M + '+D', '복제'], [M + '+E', '클립 나누기'],
    [M + '+L', '선택 구간을 루프로'], [M + '+U', '퀀타이즈'], [M + '+A', '모두 고르기'], [M + '+C / X / V', '음표 복사 / 잘라내기 / 붙여넣기'], ['Delete', '지우기'],
    ['↑ ↓ ← →', '음표 옮기기 (Shift: 옥타브) · 세션에서 칸 이동'], ['Enter', '고른 클립 띄우기'], ['0', '음표 켜기/끄기'], [M + '+1 / 2', '격자 좁히기 / 넓히기'],
    [M + '+3', '셋잇단 격자'], [M + '+4', '스냅 켜기/끄기'], ['+ / −', '어레인지먼트 확대 / 축소'], [M + '+F', '브라우저 검색'], [M + '+S', '바로 저장'], ['F2', '이름 바꾸기']
  ];
  const tbl = h('table', { class: 'keys-tbl' }, h('tbody', null, rows.map(([k, d]) => h('tr', null, h('td', null, h('kbd', { text: k })), h('td', { text: d })))));
  const guide = h('div', { class: 'guide' },
    h('h3', { text: '처음 쓸 때' }),
    h('ol', null,
      h('li', { text: '메뉴 › 새 프로젝트에서 장르(하우스·테크노·트랩·드럼 앤 베이스·로파이·퓨처 베이스)를 고르면 드럼·베이스·코드와 곡 구조까지 만들어져요.' }),
      h('li', { text: '세션 뷰에서 클립의 ▶를 눌러 부분들을 하나씩 띄워 보세요. 오른쪽 열의 ▶는 한 줄(씬)을 통째로 띄워요.' }),
      h('li', { text: '드럼 클립을 누르면 아래에 스텝 시퀀서가 열려요. 칸을 눌러 찍고, 다시 누르면 지워요.' }),
      h('li', { text: '씬을 다 만들었으면 "곡 만들기"(세션 뷰 오른쪽 아래)로 인트로부터 아웃트로까지 어레인지먼트에 한 번에 늘어놓아요.' }),
      h('li', { text: '클립을 누르면 아래에 피아노 롤이 열려요. 빈 곳을 두 번 눌러 음을 넣고, 끌어서 옮겨요.' }),
      h('li', { text: '트랙 이름을 누르고 아래 칸을 "장치"로 바꾸면 악기와 이펙트의 노브를 돌릴 수 있어요.' }),
      h('li', { text: '악기 소리를 바꾸려면 아래 칸 위쪽의 "소리" 버튼을 눌러요. 피아노·기타·현악·관악·말렛·오르간·콰이어·가야금과 신스까지 60가지 중에서 누를 때마다 바뀌고 한 음 들려줘요. ◀ ▶로 하나씩 넘겨도 돼요. Acoustic·Ensemble 장치 안에서는 악기 버튼으로 종류만 바꿀 수 있어요.' }),
      h('li', { text: '왼쪽 브라우저에서 사운드·드럼·샘플을 트랙이나 빈 칸에 끌어다 놓아요.' }),
      h('li', { text: 'P를 누르면 패드 화면이에요. 로봇 보컬 찹 패드를 Z·X·C·V, A·S·D·F … 글자 키로 두드려 보세요. "키 지정"을 켜면 패드마다 원하는 글자를 줄 수 있어요.' }),
      h('li', { text: 'Tab으로 어레인지먼트 뷰로 가서 클립을 시간 순서로 배치하고, 메뉴의 "오디오 내보내기"로 WAV를 받아요.' })));
  const touch = h('div', { class: 'guide' },
    h('h3', { text: '손가락으로 쓸 때 (아이패드·휴대폰)' }),
    h('ul', null,
      h('li', { text: '길게 누르기는 오른쪽 클릭이에요. 클립·씬·트랙·음표·어레인지먼트 클립의 메뉴가 열려요.' }),
      h('li', { text: '두 번 탭은 더블클릭이에요. 빈 칸에 클립 만들기, 피아노 롤에 음 넣기·지우기, 노브를 기본값으로, 브라우저 항목 넣기.' }),
      h('li', { text: '두 손가락으로 밀면 피아노 롤·어레인지먼트·스텝 시퀀서가 넘어가고, 벌리거나 오므리면 확대·축소돼요.' }),
      h('li', { text: '패드 화면에서 드럼·루프 패드 트랙은 패드로, 신스 트랙은 건반으로 쳐요. 스케일을 고르면 키에 맞는 음만 칸으로 나오고, 코드를 켜면 한 손가락으로 코드를 쳐요.' }),
      h('li', { text: '클립은 길게 눌러 "복사"한 뒤 빈 칸을 길게 눌러 "붙여넣기"로 옮겨요. 스텝 시퀀서의 찍힌 칸을 길게 누르면 세기가 바뀌어요.' }),
      h('li', { text: '메뉴 › 앱으로 설치하기로 홈 화면에 두면 전체 화면으로 열리고, 인터넷이 없어도 돼요.' }),
      h('li', { text: '컴퓨터 버전(작은 조절기, 마우스·키보드)과 아이패드 버전(큰 버튼, 손가락)은 아래 상태 줄의 버튼이나 메뉴 › 화면 버전에서 직접 골라요. 어느 버전이든 손가락 조작은 돼요.' })));
  U.dialog({ title: '도움말', body: h('div', { class: 'help' }, U.isTouch ? touch : null, guide, U.isTouch ? null : touch, h('h3', { text: '단축키' }), tbl), width: '560px', actions: [{ label: '닫기', primary: true }] });
}
function aboutDialog() {
  U.dialog({
    title: '울림 스튜디오', width: '420px',
    body: h('div', { class: 'xp' },
      h('p', { text: '브라우저에서 돌아가는 음악 작업 앱이에요. 장르 템플릿, 세션 뷰의 클립 런치, 어레인지먼트, 스텝 시퀀서와 피아노 롤, 루프 패드, 신스·드럼 머신·샘플러, 이펙트, 자동화, MIDI 도구, 오디오 내보내기를 담았어요.' }),
      h('p', { class: 'hint', text: '소리는 모두 Web Audio로 합성해요. 녹음된 샘플을 내려받지 않아서 인터넷이 느려도 바로 열려요.' })),
    actions: [{ label: '닫기', primary: true }]
  });
}
U.appMenu = function (anchor) {
  U.menu([
    { label: '새 프로젝트…', action: () => U.newProjectDialog() },
    { label: '프로젝트 열기…', action: () => { U.toggleBrowser(true); U.setPref('brCat', 'projects'); U.browserView.build(els.browser); if (ui.narrow) setPane('browser'); } },
    { label: '다른 이름으로 저장…', action: saveAs },
    { label: '데모 곡 열기', action: () => U.openDemo() },
    { sep: true },
    { label: '오디오 내보내기 (WAV)…', disabled: !U.store.canDownload(), action: exportDialog },
    { label: 'MIDI 파일 내보내기', disabled: !U.store.canDownload(), action: exportMidi },
    { label: '프로젝트 파일 내보내기', disabled: !U.store.canDownload(), action: exportProjectFile },
    { label: '프로젝트 파일 가져오기…', action: () => importProjectFile() },
    { label: '오디오 파일 가져오기…', action: () => U.browserView.importFiles() },
    { sep: true },
    { label: '되돌리기', key: U.MOD + '+Z', disabled: !U.canUndo(), action: A.undo },
    { label: '다시 실행', key: U.MOD + '+Shift+Z', disabled: !U.canRedo(), action: A.redo },
    { sep: true },
    { label: 'MIDI 트랙 넣기', action: () => A.addTrack('midi') },
    { label: '오디오 트랙 넣기', action: () => A.addTrack('audio') },
    { label: '리턴 트랙 넣기', action: () => A.addReturn() },
    { label: '씬 넣기', action: () => A.insertScene(ui.scene + 1) },
    { label: '씬으로 곡 만들기…', action: () => U.songDialog() },
    { sep: true },
    { label: '화면 버전: ' + U.uiModeName() + (U.uiMode === 'auto' ? ' (자동)' : ''), sub: modeItems() },
    { label: '환경설정…', action: prefsDialog },
    { label: '도움말 · 단축키', key: '?', action: helpDialog },
    window.claude ? null : { label: '앱으로 설치하기…', action: installApp },
    { label: '울림 스튜디오 정보', action: aboutDialog }
  ], anchor);
};

/* ================= 파일 끌어다 놓기 ================= */
function bindFileDrop() {
  window.addEventListener('dragover', e => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; document.body.classList.add('file-over'); }
  });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('file-over'); });
  window.addEventListener('drop', async e => {
    document.body.classList.remove('file-over');
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    const proj = files.find(f => /\.json$/i.test(f.name));
    if (proj) { importProjectFile(proj); return; }
    const audio = files.filter(f => /^audio\//.test(f.type) || /\.(wav|mp3|ogg|flac|m4a|aiff?|webm)$/i.test(f.name));
    if (!audio.length) { U.toast('오디오 파일(WAV, MP3, OGG …)이나 울림 프로젝트 파일을 놓아 주세요.'); return; }
    const x = e.clientX, y = e.clientY;
    const refs = await U.browserView.importFiles(audio);
    if (refs.length) U.dropAt(x, y, { type: 'sample', ref: refs[0] });
  });
}

/* ================= 웹 앱 (설치·오프라인) ================= */
/* 사이트로 열었을 때만: 서비스 워커로 인터넷 없이도 열리게 하고, 설치를 권할 수 있으면 메뉴에 띄운다 */
let installPrompt = null;
function setupWebApp() {
  if (window.claude) return;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
  window.addEventListener('appinstalled', () => { installPrompt = null; U.toast('울림 스튜디오를 앱으로 설치했어요.'); });
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure || !('serviceWorker' in navigator)) return;
  const register = () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('서비스 워커', err));
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice.finally(() => { installPrompt = null; });
    return;
  }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  U.dialog({
    title: '앱으로 설치하기', width: '420px',
    body: h('div', { class: 'xp' },
      h('p', { text: ios ? '사파리 아래쪽의 공유 버튼을 누른 뒤 "홈 화면에 추가"를 고르세요. 홈 화면에서 열면 주소창 없이 앱처럼 열려요.' : '크롬·엣지 주소창 오른쪽의 설치 아이콘(모니터 모양)을 누르거나, 브라우저 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 고르세요.' }),
      h('p', { class: 'hint', text: '한 번 연 뒤에는 인터넷이 없어도 열려요. 프로젝트는 이 기기의 브라우저에 저장돼요.' })),
    actions: [{ label: '닫기', primary: true }]
  });
}

/* ================= 반응형 ================= */
function checkNarrow() {
  // 컴퓨터 버전을 직접 고르면 세로 아이패드에서도 컴퓨터와 같은 화면 (휴대폰처럼 아주 좁을 때만 아래 탭)
  const n = window.innerWidth < (U.uiMode === 'desktop' ? 600 : 860);
  if (n !== ui.narrow) {
    ui.narrow = n;
    document.body.classList.toggle('narrow', n);
    if (!n) { ui.pane = 'main'; document.body.dataset.pane = 'main'; }
    buildPanes();
    U.inval('all');
  }
}

/* ================= 시작 ================= */
function wire() {
  U.on('change', inf => {
    U.engine.sync(pr());
    if (inf.live) {
      if (inf.clip && U.clipView.open) U.clipView.drawAll();
      U.inval('arrange-draw');
      if (inf.tempo || inf.loop || inf.mixer) U.inval('transport');
      if (inf.rec) U.inval('session');
      return;
    }
    U.inval('transport', 'session', 'arrange', 'detail', 'status', 'pads');
    if (!inf.load) autosave();
  });
  // 화면 버전을 바꾸면 크기·배치가 바뀌니 모두 다시 그린다
  U.on('uimode', m => {
    U.closeMenu && U.closeMenu();
    checkNarrow();
    U.inval('all');
    U.toast(m.mode === 'auto' ? '자동으로 바꿨어요. 이 기기에서는 ' + U.uiModeName() + '이에요.' : U.uiModeName() + '으로 바꿨어요.');
  });
  U.on('project', inf => {
    ui.roll.sel = new Set();
    ui.arrSel = [];
    if (!inf || !inf.undo) {
      // 다른 프로젝트를 열었을 때만 선택을 처음으로
      ui.clip = null; ui.slot = null; ui.timeSel = null; ui.scene = 0;
      ui.track = (pr().tracks[0] || pr().master).id;
    } else if (!U.trackById(pr(), ui.track)) ui.track = (pr().tracks[0] || pr().master).id;
    U.engine.sync(pr());
    U.inval('all');
  });
  U.on('engine:transport', () => {
    if (!U.engine.playing && U.audioRec.active()) U.audioRec.stop();
    U.inval('transport', 'status');
  });
  U.on('engine:override', () => U.inval('transport'));
  U.on('tempo', () => U.inval('transport'));
  U.on('store', () => U.inval('status'));
  U.renderer('detail', renderDetail);
  U.renderer('status', renderStatus);
  U.renderer('views', () => { document.body.dataset.view = ui.view; });
  window.addEventListener('resize', checkNarrow);
  window.addEventListener('pagehide', () => autosave.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) autosave.flush(); });
  window.addEventListener('pointerdown', () => U.ensureAudio(), { capture: true, once: true });
  window.addEventListener('keydown', () => U.ensureAudio(), { capture: true, once: true });
  U.engine.ctx.addEventListener && U.engine.ctx.addEventListener('statechange', () => U.inval('status'));
}
async function pickStartProject() {
  await U.store.ready;
  if (U.canUndo()) return; // 이미 고치기 시작했다면 그대로
  let id = U.pref('last', null);
  let list = [];
  try { list = await U.store.listProjects(); } catch (e) { /* 무시 */ }
  if (!id || !list.some(p => p.id === id)) id = list[0] && list[0].id;
  if (!id) {
    U.inval('status');
    // 처음 온 사람에게는 무엇부터 할지 고르게 한다
    if (!U.pref('welcomed', false) && !document.querySelector('.dlg-back')) { U.setPref('welcomed', true); U.newProjectDialog(true); }
    return;
  }
  try {
    const p = await U.store.loadProject(id);
    if (p && !U.canUndo()) loadProject(p);
  } catch (e) { console.warn(e); }
  U.inval('status');
}
function boot() {
  applySkin();
  createAudio();
  buildLayout();
  wire();
  U.project = U.normalize(U.demoProject());
  U.resetHistory();
  ui.track = pr().tracks[0].id;
  document.body.dataset.view = ui.view;
  document.body.dataset.pane = 'main';
  U.engine.sync(pr());
  U.transportBar.build(els.ctrl);
  U.browserView.build(els.browser);
  U.sessionView.build(els.session);
  U.arrangeView.build(els.arrange);
  U.padsView.build(els.pads);
  U.bindInfo(els.info, infoDefault);
  U.input.init();
  bindFileDrop();
  checkNarrow();
  U.inval('detail', 'status');
  U.engine.start();
  setupWebApp();
  pickStartProject();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})(window.U = window.U || {});
