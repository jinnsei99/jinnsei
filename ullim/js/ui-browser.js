/* 울림 — 브라우저: 사운드·드럼·루프 패드·악기·이펙트·클립·샘플·내 오디오·프로젝트 */
(function (U) {
'use strict';
const { h, ui, info, icon, btn } = U;
const A = U.act;
const pr = () => U.project;

const CATS = [
  { id: 'sounds', name: '사운드', icon: 'sound', info: '바로 쓸 수 있게 다듬은 악기 소리예요. 두 번 누르면 고른 트랙에 넣어요.' },
  { id: 'drums', name: '드럼', icon: 'drum', info: '드럼 키트예요. 패드 16개에 소리가 담겨 있어요.' },
  { id: 'pads', name: '루프 패드', icon: 'pads', info: '보컬 찹·드럼 찹·루프를 패드 16개에 나눠 담은 키트예요. 두 번 누르면 고른 트랙에 넣고, 패드 화면(P)에서 글자 키로 두드려요.' },
  { id: 'inst', name: '악기', icon: 'synth', info: '기본값 그대로의 악기예요.' },
  { id: 'afx', name: '오디오 이펙트', icon: 'fx', info: '소리를 바꾸는 이펙트예요. 트랙이나 장치 사이에 끌어다 놓으세요.' },
  { id: 'mfx', name: 'MIDI 이펙트', icon: 'midi', info: '악기 앞에서 음표를 바꾸는 장치예요.' },
  { id: 'clips', name: '클립', icon: 'clip', info: '드럼 패턴, 베이스 라인, 코드 진행이에요. 프로젝트 키에 맞춰 들어가요.' },
  { id: 'samples', name: '샘플', icon: 'wave', info: '루프와 원샷 오디오예요. 루프는 템포에 맞춰 늘어나요.' },
  { id: 'user', name: '내 오디오', icon: 'folder', info: '가져온 오디오 파일이에요. 이 브라우저에 저장돼요.' },
  { id: 'projects', name: '프로젝트', icon: 'file', info: '저장된 프로젝트예요. 두 번 누르면 열어요.' }
];
const st = { cat: U.pref('brCat', 'sounds'), q: '', preview: U.pref('preview', true), sel: null, items: [] };
let root, listEl, searchEl, catEl;

function build(el) {
  root = el;
  U.clear(root);
  searchEl = h('input', { class: 'inp br-q', type: 'search', placeholder: '검색', 'aria-label': '브라우저 검색', value: st.q });
  searchEl.addEventListener('input', () => { st.q = searchEl.value.trim(); renderList(); });
  searchEl.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); listEl.focus(); }
    if (e.key === 'Escape') { searchEl.value = ''; st.q = ''; renderList(); searchEl.blur(); }
  });
  catEl = h('div', { class: 'br-cats', role: 'tablist' });
  for (const c of CATS) {
    const b = h('button', { class: 'br-cat', type: 'button', role: 'tab', 'aria-selected': c.id === st.cat ? 'true' : 'false' }, icon(c.icon), h('span', { text: c.name }));
    info(b, c.name, c.info);
    b.addEventListener('click', () => { st.cat = c.id; U.setPref('brCat', c.id); st.sel = null; for (const x of catEl.children) x.setAttribute('aria-selected', 'false'); b.setAttribute('aria-selected', 'true'); renderList(); });
    catEl.append(b);
  }
  listEl = h('div', { class: 'br-list', tabindex: '0', role: 'listbox', 'aria-label': '브라우저 목록' });
  listEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const it = st.items[st.sel]; if (it && it.load) it.load(); }
  });
  const imp = btn({ icon: 'upload', text: '오디오 가져오기', cls: 'sm', info: ['오디오 가져오기', 'WAV·MP3·OGG 같은 파일을 이 브라우저에 넣어요. 화면 어디에든 파일을 끌어다 놓아도 돼요.'], onclick: () => importFiles() });
  const pv = btn({ icon: 'speaker', cls: 'tg sm', toggle: true, on: st.preview, title: '미리듣기', info: ['미리듣기', '켜면 목록에서 고를 때마다 소리를 들려줘요.'], onclick: () => { st.preview = !st.preview; U.setPref('preview', st.preview); U.setPressed(pv, st.preview); if (!st.preview) U.engine.stopPreview(); } });
  root.append(h('div', { class: 'br-search' }, icon('search'), searchEl), catEl, listEl, h('div', { class: 'br-foot' }, imp, pv));
  root.addEventListener('pointerdown', () => { ui.focus = 'browser'; });
  renderList();
}
async function importFiles(files) {
  if (!files) files = await U.store.pickFile('audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff', true);
  if (!files.length) return [];
  U.ensureAudio();
  const refs = [];
  for (const f of files) {
    try { refs.push(await U.media.importFile(f, U.engine.ctx.sampleRate)); }
    catch (e) { U.toast(f.name + ': 읽을 수 없는 오디오 파일이에요.', 'error'); }
  }
  if (refs.length) {
    U.toast('오디오 ' + refs.length + '개를 가져왔어요.');
    st.cat = 'user';
    if (root) build(root);
  }
  return refs;
}

/* ================= 목록 ================= */
function items() {
  const out = [];
  const head = name => out.push({ head: name });
  switch (st.cat) {
    case 'sounds': {
      const tags = [...new Set(U.SOUNDS.map(s => s.tags[0]))];
      for (const tag of tags) {
        head(tag);
        for (const s of U.SOUNDS.filter(x => x.tags[0] === tag)) out.push({
          label: s.name, sub: U.DEV[s.kind].name, icon: 'sound',
          drag: { type: 'sound', item: s }, load: () => A.loadSound(loadTarget('midi'), s),
          preview: () => previewDev(U.makeDevice(s.kind, { p: s.p, data: s.data }), s.tags[0])
        });
      }
      break;
    }
    case 'drums':
      for (const k of U.KITS) out.push({
        label: k.name, sub: k.tags.join(' · '), icon: 'drum', drag: { type: 'kit', item: k }, load: () => A.loadKit(loadTarget('midi'), k),
        preview: () => previewDev(U.kitDevice(k), 'drums')
      });
      break;
    case 'pads':
      for (const k of U.LOOPKITS) out.push({
        label: k.name, sub: k.tags.join(' · '), icon: 'pads', drag: { type: 'loopkit', item: k }, infoText: k.info,
        load: () => { const t = A.loadLoopKit(loadTarget('midi'), k); if (t) U.ui.padTrack = t.id; },
        preview: () => previewDev(U.loopKitDevice(k), 'loopkit')
      });
      break;
    case 'inst':
      for (const kind of ['polysynth', 'fm', 'drums', 'looppad', 'sampler']) out.push({
        label: U.DEV[kind].name, sub: U.DEV[kind].info, icon: kind === 'drums' ? 'drum' : kind === 'looppad' ? 'pads' : 'synth', drag: { type: 'device', kind },
        load: () => A.addDevice(loadTarget('midi'), kind), preview: kind === 'sampler' ? null : () => previewDev(U.makeDevice(kind), kind === 'drums' ? 'drums' : kind === 'looppad' ? 'loopkit' : '패드')
      });
      break;
    case 'afx':
    case 'mfx': {
      const type = st.cat === 'afx' ? 'audio' : 'midi';
      for (const kind of Object.keys(U.DEV).filter(k => U.DEV[k].type === type)) {
        head(U.DEV[kind].name);
        out.push({ label: U.DEV[kind].name, sub: '기본값', icon: type === 'audio' ? 'fx' : 'midi', drag: { type: 'device', kind }, load: () => A.addDevice(loadTarget(type === 'midi' ? 'midi' : null), kind), infoText: U.DEV[kind].info });
        for (const [name, p] of (U.FX_PRESETS[kind] || []).slice(1)) out.push({
          label: name, sub: U.DEV[kind].name, icon: type === 'audio' ? 'fx' : 'midi', indent: true,
          drag: { type: 'device', kind, preset: p, presetName: name }, load: () => A.addDevice(loadTarget(type === 'midi' ? 'midi' : null), kind, { preset: p, presetName: name })
        });
      }
      break;
    }
    case 'clips': {
      const cats = [...new Set(U.CLIPS.map(c => c.cat))];
      for (const c of cats) {
        head(c);
        for (const tpl of U.CLIPS.filter(x => x.cat === c)) out.push({
          label: tpl.name, sub: c === '드럼' ? '드럼 패턴' : '키에 맞춰 들어가요', icon: 'clip', drag: { type: 'tpl', item: tpl },
          load: () => loadTemplate(tpl), preview: () => previewTpl(tpl)
        });
      }
      break;
    }
    case 'samples': {
      const groups = [['loop', '루프'], ['vox', '보컬'], ['fx', '효과음'], ['oneshot', '원샷']];
      for (const [cat, name] of groups) {
        head(name);
        for (const [id, g] of Object.entries(U.GEN).filter(([, g]) => g.cat === cat)) {
          const ref = 'gen:' + id;
          out.push({ label: g.name, sub: g.bpm ? g.bpm + ' BPM · ' + (g.beats / 4) + '마디' : '', icon: 'wave', drag: { type: 'sample', ref }, load: () => loadSample(ref), preview: () => previewSample(ref) });
        }
      }
      break;
    }
    case 'user': {
      const list = st.userList || [];
      if (!list.length) out.push({ empty: '가져온 오디오가 없어요. 아래 버튼을 누르거나 파일을 화면에 끌어다 놓으세요.' });
      for (const r of list) {
        const ref = 'user:' + r.hash;
        out.push({ label: r.name, sub: U.fmtTime(r.duration) + (r.loop ? ' · ' + U.round(r.bpm, 1) + ' BPM' : ''), icon: 'wave', drag: { type: 'sample', ref }, load: () => loadSample(ref), preview: () => previewSample(ref),
          menu: [{ label: '이 브라우저에서 지우기', danger: true, action: async () => { if (await U.confirm('오디오 지우기', '"' + r.name + '"을(를) 이 브라우저에서 지울까요? 이 파일을 쓰는 클립은 소리가 나지 않아요.', '지우기', true)) { await U.store.deleteAudio(r.hash); refreshUser(); } } }] });
      }
      break;
    }
    case 'projects': {
      const list = st.projList || [];
      out.push({ label: '새 프로젝트', sub: '빈 프로젝트로 시작', icon: 'plus', load: () => U.newProjectFlow() });
      out.push({ label: '데모 곡: 새벽 네 시', sub: '122 BPM · A 마이너', icon: 'file', load: () => U.openDemo() });
      head('장르로 시작');
      for (const g of U.GENRES) out.push({ label: g.name, sub: g.bpm + ' BPM · ' + U.scaleLabel(g.key.root, g.key.scale), infoText: g.desc + '.', icon: 'plus', load: () => U.newProjectFlow(g.id) });
      if (list.length) head(U.store.mode === 'cloud' ? 'Claude 계정에 저장됨' : '이 브라우저에 저장됨');
      for (const p of list) out.push({
        label: p.name || '이름 없음', sub: new Date(p.updated).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) + (p.id === pr().id ? ' · 지금 열림' : ''), icon: 'file',
        load: () => U.openProject(p.id),
        menu: [{ label: '열기', action: () => U.openProject(p.id) }, { label: '지우기', danger: true, disabled: p.id === pr().id, action: async () => { if (await U.confirm('프로젝트 지우기', '"' + p.name + '"을(를) 지울까요? 되돌릴 수 없어요.', '지우기', true)) { await U.store.deleteProject(p.id); refreshProjects(); } } }]
      });
      break;
    }
  }
  return out;
}
function renderList() {
  if (!listEl) return;
  if (st.cat === 'user' && !st.userList) refreshUser();
  if (st.cat === 'projects' && !st.projList) refreshProjects();
  U.clear(listEl);
  const q = st.q.toLowerCase();
  let all = items();
  if (q) all = all.filter(it => it.label && (it.label.toLowerCase().includes(q) || (it.sub || '').toLowerCase().includes(q)));
  st.items = all;
  all.forEach((it, i) => {
    if (it.head) { listEl.append(h('div', { class: 'br-head', text: it.head })); return; }
    if (it.empty) { listEl.append(h('p', { class: 'br-empty', text: it.empty })); return; }
    const row = h('div', { class: 'br-item' + (it.indent ? ' indent' : '') + (st.sel === i ? ' sel' : ''), role: 'option', dataset: { i } }, icon(it.icon || 'file'), h('span', { class: 'bi-l', text: it.label }), it.sub ? h('span', { class: 'bi-s', text: it.sub }) : null);
    info(row, it.label, (it.infoText || it.sub || '') + (it.load ? ' 두 번 누르거나 Enter로 넣고, 끌어서 원하는 곳에 놓아요.' : ''));
    row.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      // 손가락은 목록을 밀어 넘기려고 대는 일이 많아서, 떼었을 때(click) 고르고 들려준다
      if (e.pointerType === 'touch') return;
      select(i);
      if (it.drag) U.dragStart(e, it.drag, it.label);
    });
    row.addEventListener('click', () => { if (U.isTouch && st.sel !== i) select(i); });
    row.addEventListener('dblclick', () => { if (it.load) it.load(); });
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      U.menu([{ label: '넣기', action: it.load, disabled: !it.load }, it.preview ? { label: '미리듣기', action: it.preview } : null].concat(it.menu ? [{ sep: true }, ...it.menu] : []), { x: e.clientX, y: e.clientY });
    });
    listEl.append(row);
  });
}
function select(i) {
  st.sel = i;
  for (const r of listEl.querySelectorAll('.br-item')) r.classList.toggle('sel', +r.dataset.i === i);
  const it = st.items[i];
  if (it && st.preview && it.preview) { U.ensureAudio(); it.preview(); }
}
function move(d) {
  let i = st.sel == null ? -1 : st.sel;
  for (let k = 0; k < st.items.length; k++) {
    i += d;
    if (i < 0 || i >= st.items.length) return;
    if (!st.items[i].head && !st.items[i].empty) break;
  }
  select(i);
  const row = listEl.querySelector('.br-item[data-i="' + i + '"]');
  if (row) row.scrollIntoView({ block: 'nearest' });
}
async function refreshUser() {
  st.userList = (await U.store.listAudio()).sort((a, b) => b.created - a.created);
  if (st.cat === 'user') renderList();
}
async function refreshProjects() {
  st.projList = await U.store.listProjects();
  if (st.cat === 'projects') renderList();
}

/* ================= 넣기 ================= */
function loadTarget(type) {
  const t = U.selTrack();
  if (!type) return t && t.id;
  if (t && t.type === type) return t.id;
  return null;
}
function loadTemplate(tpl) {
  const t = U.selTrack();
  if (ui.view === 'arrange') {
    const tr = t && t.type === 'midi' ? t : A.addTrack('midi');
    const made = tpl.make(pr().key);
    A.addArrClip(tr.id, pr().pos, U.newMidiClip(made.len, { name: tpl.name, color: tr.color, notes: made.notes }), null, tpl.name);
    return;
  }
  let slot = ui.slot && ui.slot.t === (t && t.id) ? ui.slot.s : null;
  let tr = t && t.type === 'midi' ? t : A.addTrack('midi');
  if (slot == null || tr.slots[slot]) slot = tr.slots.findIndex(c => !c);
  if (slot < 0) slot = tr.slots.length;
  A.insertTemplate(tr.id, slot, tpl);
}
async function loadSample(ref) {
  U.ensureAudio();
  const t = U.selTrack();
  if (ui.view === 'arrange') {
    const tr = t && t.type === 'audio' ? t : A.addTrack('audio');
    try { await U.media.get(ref, U.engine.ctx.sampleRate); } catch (e) { U.toast('오디오를 불러오지 못했어요.', 'error'); return; }
    A.addArrClip(tr.id, pr().pos, U.newAudioClip(ref, U.media.info(ref), { color: tr.color }), null, '오디오 클립');
    return;
  }
  const tr = t && t.type === 'audio' ? t : A.addTrack('audio');
  let slot = ui.slot && ui.slot.t === tr.id ? ui.slot.s : null;
  if (slot == null || tr.slots[slot]) slot = tr.slots.findIndex(c => !c);
  if (slot < 0) slot = tr.slots.length;
  A.insertAudio(tr.id, slot, ref);
}

/* ================= 미리듣기 ================= */
const CHORD = [{ p: 57, s: 0, d: 1.6 }, { p: 60, s: 0, d: 1.6 }, { p: 64, s: 0, d: 1.6 }, { p: 69, s: 0.5, d: 1.1 }];
const BASS = [{ p: 33, s: 0, d: 0.4 }, { p: 33, s: 0.5, d: 0.4 }, { p: 45, s: 1, d: 0.4 }, { p: 36, s: 1.5, d: 0.8 }];
const LEAD = [{ p: 69, s: 0, d: 0.45 }, { p: 72, s: 0.5, d: 0.45 }, { p: 76, s: 1, d: 0.45 }, { p: 74, s: 1.5, d: 0.9 }];
const BEAT = [36, 42, 38, 42, 36, 36, 38, 46].map((p, i) => ({ p, s: i * 0.5, d: 0.25, v: 110 })).concat([{ p: 42, s: 0.25, d: 0.2, v: 70 }]);
const PADS8 = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ p: 36 + i, s: i * 0.5, d: 0.4, v: 110 })); // 패드 1~8을 8분음표로
function previewDev(dev, tag) {
  const notes = tag === 'drums' ? BEAT : tag === 'loopkit' ? PADS8 : tag === '베이스' ? BASS : tag === '리드' || tag === '플럭' ? LEAD : tag === '보컬' ? [{ p: 57, s: 0, d: 1.5 }] : CHORD;
  U.engine.previewDevice(dev, notes);
}
function previewTpl(tpl) {
  const made = tpl.make(pr().key);
  const drums = tpl.cat === '드럼';
  const dev = drums ? U.kitDevice(U.KITS[0]) : U.makeDevice('polysynth', { p: tpl.cat === '베이스' ? U.SOUNDS[3].p : U.SOUNDS[7].p });
  U.engine.previewDevice(dev, made.notes.filter(n => n.s < 8));
}
async function previewSample(ref) {
  try {
    const buf = await U.media.get(ref, U.engine.ctx.sampleRate);
    U.engine.previewBuffer(buf);
  } catch (e) { U.toast(e.missing ? '이 브라우저에 없는 파일이에요.' : '미리듣기를 하지 못했어요.', 'error'); }
}

U.renderer('browser', () => { if (root) { st.userList = null; st.projList = null; renderList(); } });
U.on('store', s => { if (s === 'saved' && st.cat === 'projects') refreshProjects(); });
U.browserView = { build, importFiles, focusSearch: () => { if (searchEl) { searchEl.focus(); searchEl.select(); } } };
})(window.U = window.U || {});
