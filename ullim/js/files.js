/* 울림 — 파일로 저장: 프로젝트를 컴퓨터의 파일에 저장하고 다시 연다.
   크롬·엣지(컴퓨터)는 파일 시스템 접근 API로 고른 파일에 그대로 덮어 쓴다. 처음 저장할 때만 자리를 묻고, 그다음부터 Ctrl+S는 같은 파일에 저장한다.
   프로젝트마다 이어진 파일(핸들)은 따로 둔 IndexedDB(ullim-files)에 기억해서, 다시 열어도 같은 파일에 이어서 저장한다.
   파일 창을 띄울 수 없는 곳(사파리 · 파이어폭스 · 아이패드 · Claude 판처럼 iframe 안)에서는 파일을 내려받거나(공유) 골라서 연다.
   파일 형식은 예전 '프로젝트 파일 내보내기'와 같다: { app: 'ullim', v: 1, project, media: { 'user:해시': { name, bpm, loop, duration, type, b64 } } } */
(function (U) {
'use strict';
const { h } = U;
const pr = () => U.project;

const TYPES = [{ description: '울림 프로젝트', accept: { 'application/json': ['.json'] } }];
const PICKER_ID = 'ullim-project';
// 다른 출처의 iframe(Claude 판 등) 안에서는 파일 고르기 창을 띄울 수 없다
const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const supported = !inFrame && typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';

/* ================= 프로젝트 ↔ 파일 연결 (ullim-files DB) =================
   기존 ullim DB의 버전을 올리면 열려 있는 다른 탭이 막을 수 있어서, 연결은 따로 둔 작은 DB에 둔다.
   { id: 프로젝트 id, handle, name: 파일 이름, saved: 파일에 쓰거나 읽은 시각, updated: 그때 프로젝트의 updated } */
let ldb = null;
function linkDb() {
  if (ldb) return ldb;
  ldb = new Promise((res, rej) => {
    let req;
    try { req = indexedDB.open('ullim-files', 1); } catch (e) { rej(e); return; }
    req.onupgradeneeded = () => { req.result.createObjectStore('links', { keyPath: 'id' }); };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  ldb.catch(() => {});
  return ldb;
}
function ltx(mode, fn) {
  return linkDb().then(db => new Promise((res, rej) => {
    const t = db.transaction('links', mode);
    let out;
    const r = fn(t.objectStore('links'));
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}
const getLink = id => ltx('readonly', os => os.get(id)).then(r => r || null, () => null);
const putLink = rec => ltx('readwrite', os => os.put(rec)).catch(e => console.warn(e));
const delLink = id => ltx('readwrite', os => os.delete(id)).catch(() => {});
const allLinks = () => ltx('readonly', os => os.getAll()).then(r => r || [], () => []);
async function findLink(handle) {
  for (const l of await allLinks()) {
    try { if (l.handle && await l.handle.isSameEntry(handle)) return l; } catch (e) { /* 없어진 파일 */ }
  }
  return null;
}

/* 지금 프로젝트에 이어진 파일. seq는 늦게 끝난 찾기가 새로 정한 연결을 덮지 않게 한다 */
const F = { link: null, seq: 0, busy: false };
const names = new Map(); // 프로젝트 id → 파일 이름 (브라우저의 프로젝트 목록에 쓴다)
function curLink() { return F.link && F.link.id === pr().id ? F.link : null; }
function setLink(l) {
  F.seq++;
  F.link = l;
  if (l) names.set(l.id, l.name);
  U.inval('status', 'xport');
  U.emit('files');
}
/* 이어진 파일보다 바뀐 내용이 있는지. 되돌리기로 저장한 때와 같은 상태로 돌아오면 다시 '저장됨'이다 */
function dirty() {
  const l = curLink();
  return !!l && (pr().updated || 0) !== (l.updated || 0);
}
function relink() {
  if (!supported) return;
  const id = pr().id, s = ++F.seq;
  F.link = null;
  getLink(id).then(l => {
    if (s !== F.seq || pr().id !== id) return;
    F.link = l;
    U.inval('status', 'xport');
  });
}
U.on('project', inf => { if (!(inf && inf.undo)) relink(); });
if (supported) allLinks().then(list => { for (const l of list) names.set(l.id, l.name); if (list.length) U.emit('files'); });

/* ================= 파일 내용 ================= */
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
/* 프로젝트와, 프로젝트가 쓰는 가져온 오디오(user:…)를 한 파일로. 프로젝트는 부르는 순간의 상태로 복사한다 */
async function build(project) {
  const p = JSON.parse(JSON.stringify(project));
  const refs = new Set();
  const want = r => { if (typeof r === 'string' && r.startsWith('user:')) refs.add(r); };
  for (const t of p.tracks.concat(p.returns || [], p.master ? [p.master] : [])) {
    for (const c of t.slots || []) if (c && c.type === 'audio') want(c.ref);
    for (const a of t.arr || []) if (a.clip && a.clip.type === 'audio') want(a.clip.ref);
    for (const d of t.devices || []) {
      if (!d.data) continue;
      want(d.data.sample);
      want(d.data.src);
      if (d.data.pads) for (const pd of d.data.pads) want(pd && pd.sample);
    }
  }
  const media = {};
  for (const ref of refs) {
    const rec = await U.store.getAudio(ref.slice(5));
    if (rec) media[ref] = Object.assign({ name: rec.name, bpm: rec.bpm, loop: rec.loop, duration: rec.duration, type: rec.type, b64: b64(rec.bytes) }, rec.recipe ? { recipe: rec.recipe } : {});
  }
  return new Blob([JSON.stringify({ app: 'ullim', v: 1, project: p, media })], { type: 'application/json' });
}
async function readData(file) {
  let data = null;
  try { data = JSON.parse(await file.text()); } catch (e) { data = null; }
  const p = data && (data.project || data);
  if (!p || typeof p !== 'object' || !Array.isArray(p.tracks)) return null;
  return { p, media: (data && data.media) || {} };
}
async function putMedia(media) {
  for (const [ref, m] of Object.entries(media)) {
    if (!m || !m.b64 || !ref.startsWith('user:')) continue;
    const bytes = unb64(m.b64);
    await U.store.putAudio(Object.assign({ hash: ref.slice(5), name: m.name, bytes, duration: m.duration, bpm: m.bpm, loop: m.loop, size: bytes.byteLength, type: m.type, created: Date.now() }, m.recipe ? { recipe: m.recipe } : {}));
    U.media.setInfo(ref, { name: m.name, bpm: m.bpm, loop: m.loop, duration: m.duration, recipe: m.recipe || null });
  }
}
const fileName = name => U.safeName(name || '프로젝트') + '.ullim.json';
const baseName = fn => String(fn || '').replace(/\.json$/i, '').replace(/\.ullim$/i, '').trim();
function when(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

/* ================= 저장 ================= */
async function permit(handle, mode) {
  const o = { mode: mode || 'readwrite' };
  try {
    if ((await handle.queryPermission(o)) === 'granted') return true;
    return (await handle.requestPermission(o)) === 'granted';
  } catch (e) { return false; }
}
/* Ctrl+S: 이어진 파일에 저장하고, 아직 파일이 없으면 자리를 묻는다. 파일 창을 못 띄우는 곳에서는 이 브라우저(계정)에 바로 저장 */
async function save() {
  if (!supported) { U.saveNow(); return false; }
  if (F.busy) { U.toast('파일에 저장하고 있어요.'); return false; }
  const l = curLink();
  if (!l) return saveAs();
  if (!(await permit(l.handle))) { U.toast('파일에 저장할 권한을 받지 못했어요. 다른 파일로 저장해 주세요 (' + U.MOD + '+Shift+S).', 'error'); return false; }
  return write(l.handle);
}
/* 다른 파일로 저장: 고른 파일과 이 프로젝트를 잇는다. 원래 파일은 마지막으로 저장한 그대로 남는다 */
async function saveAs() {
  if (!supported) return download();
  if (F.busy) { U.toast('파일에 저장하고 있어요.'); return false; }
  let handle;
  try {
    handle = await window.showSaveFilePicker({ suggestedName: fileName(pr().name), types: TYPES, id: PICKER_ID });
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
    console.warn(e);
    U.toast('파일 창을 열지 못했어요. 메뉴의 "다른 파일로 저장…"을 눌러 주세요.', 'error');
    return false;
  }
  // 파일 이름을 바꿔 저장하면 프로젝트 이름도 그 이름으로
  const base = baseName(handle.name);
  if (base && base !== pr().name) { pr().name = base; U.commit('프로젝트 이름'); }
  return write(handle);
}
async function write(handle) {
  F.busy = true;
  U.flushSave();
  const id = pr().id, updated = pr().updated;
  try {
    const blob = await build(pr());
    const w = await handle.createWritable();
    try { await w.write(blob); await w.close(); } catch (e) { try { await w.abort(); } catch (e2) { /* 이미 닫힘 */ } throw e; }
  } catch (e) {
    F.busy = false;
    console.warn(e);
    const n = e && e.name;
    U.toast(n === 'NotFoundError' ? '파일을 찾지 못했어요. 옮기거나 지웠다면 다른 파일로 저장해 주세요 (' + U.MOD + '+Shift+S).'
      : n === 'NotAllowedError' ? '이 파일에 저장할 권한이 없어요.'
      : n === 'QuotaExceededError' ? '디스크 공간이 모자라서 저장하지 못했어요.'
      : '파일에 저장하지 못했어요.', 'error');
    return false;
  }
  F.busy = false;
  const l = { id, handle, name: handle.name, saved: Date.now(), updated };
  await putLink(l);
  if (pr().id === id) setLink(l); else { names.set(id, l.name); U.emit('files'); }
  U.toast('"' + handle.name + '"에 저장했어요.');
  return true;
}
/* 파일로 내려받기 (아이패드는 공유 화면). 파일 창을 못 띄우는 곳의 '파일로 저장' */
async function download() {
  if (!U.store.canDownload()) { U.toast('이 화면에서는 파일을 받을 수 없어요.', 'error'); return false; }
  U.flushSave();
  const blob = await build(pr());
  const r = await U.store.offer(fileName(pr().name), blob);
  if (r === 'saved') U.toast('프로젝트 파일을 받았어요. 가져온 오디오도 함께 담겼어요.');
  return r === 'saved';
}

/* ================= 열기 ================= */
async function open() {
  if (supported) {
    let hs;
    try { hs = await window.showOpenFilePicker({ types: TYPES, id: PICKER_ID, multiple: false }); } catch (e) {
      if (e && e.name === 'AbortError') return false;
      console.warn(e);
      return openPicked();
    }
    const handle = hs && hs[0];
    if (!handle) return false;
    let file;
    try { file = await handle.getFile(); } catch (e) { U.toast('파일을 읽지 못했어요.', 'error'); return false; }
    return openFile(file, handle);
  }
  return openPicked();
}
async function openPicked() {
  const files = await U.store.pickFile('.json,application/json', false);
  return files.length ? openFile(files[0], null) : false;
}
/* 이 브라우저에 그 파일에 저장하지 않은 내용이 있을 때 어느 쪽을 열지 고르게 한다 */
function choose(cur, name) {
  return new Promise(res => {
    let done = false;
    const fin = v => { if (!done) { done = true; res(v); } };
    U.dialog({
      title: '저장하지 않은 내용이 있어요', width: '440px',
      body: h('div', { class: 'xp' },
        h('p', { text: '"' + name + '"에 아직 저장하지 않은 내용이 이 브라우저에 있어요 (마지막으로 고친 때 ' + when(cur.updated) + ').' }),
        h('p', { class: 'hint', text: '파일 내용으로 열면 저장하지 않은 내용은 사라져요. 바뀐 내용으로 열고 ' + U.MOD + '+S를 누르면 파일에 저장돼요.' })),
      onclose: () => fin(null),
      actions: [{ label: '파일 내용으로 열기', action: () => fin('file') }, { label: '바뀐 내용으로 열기', primary: true, action: () => fin('browser') }]
    });
  });
}
/* 파일을 연다. handle이 있으면(크롬·엣지) 그 파일과 이어서, 다음 Ctrl+S가 같은 파일에 저장된다 */
async function openFile(file, handle) {
  const d = await readData(file);
  if (!d) { U.toast('울림 프로젝트 파일이 아니에요.', 'error'); return false; }
  const p = d.p;
  try {
    await putMedia(d.media);
    U.normalize(p);
  } catch (e) {
    console.error(e);
    U.toast('울림 프로젝트 파일이 아니에요.', 'error');
    return false;
  }
  U.flushSave();
  const fname = (handle && handle.name) || file.name;
  let id;
  const link = handle && supported ? await findLink(handle) : null;
  if (link) {
    // 이 파일과 이어진 프로젝트가 이미 있다: 그 프로젝트를 파일 내용으로 연다
    id = link.id;
    const cur = id === pr().id ? pr() : await U.store.loadProject(id);
    if (cur && (cur.updated || 0) !== (link.updated || 0)) {
      const pick = await choose(cur, fname);
      if (!pick) return false;
      if (pick === 'browser') {
        if (id !== pr().id) await U.openProject(id);
        else U.toast('바뀐 내용을 그대로 두었어요. ' + U.MOD + '+S로 파일에 저장해요.');
        return true;
      }
    }
  } else {
    // 같은 id의 다른 프로젝트를 덮지 않게: 이미 있으면 새 프로젝트로
    id = p.id;
    if (!id || id === pr().id || await U.store.loadProject(id)) id = U.uid('p');
  }
  p.id = id;
  U.loadProjectData(p);
  if (handle && supported) {
    const l = { id, handle, name: handle.name, saved: Date.now(), updated: pr().updated };
    await putLink(l);
    setLink(l);
  }
  U.toast('"' + fname + '"을(를) 열었어요.');
  return true;
}

/* ================= 연결 끊기 · 지우기 ================= */
async function unlink() {
  const l = curLink();
  if (!l) return;
  await delLink(l.id);
  names.delete(l.id);
  setLink(null);
  U.toast('파일과의 연결을 끊었어요. 프로젝트는 ' + (U.store.mode === 'cloud' ? 'Claude 계정' : '이 브라우저') + '에 계속 저장돼요.');
}
function forget(id) {
  if (!supported) return;
  delLink(id);
  names.delete(id);
  if (F.link && F.link.id === id) setLink(null); else U.emit('files');
}

/* ================= 상태 줄 ================= */
function chip() {
  if (!supported) return null;
  const l = curLink(), dt = dirty();
  const b = h('button', { class: 'st-file' + (l ? (dt ? ' dirty' : '') : ' none'), type: 'button' });
  b.append(U.icon('file'));
  if (l) {
    b.append(h('span', { class: 'st-fn', text: l.name }), h('span', { class: 'st-fs', text: dt ? '저장 안 함' : '저장됨' }));
    U.info(b, '파일: ' + l.name, (dt ? '파일에 아직 저장하지 않은 내용이 있어요. ' : '파일에 모두 저장했어요 (' + when(l.saved) + '). ') + U.MOD + '+S로 이 파일에 저장해요. 누르면 다른 파일로 저장하거나 연결을 끊는 메뉴가 열려요.');
    b.addEventListener('click', () => U.menu([
      { header: l.name },
      { label: '파일에 저장', key: U.MOD + '+S', action: save },
      { label: '다른 파일로 저장…', key: U.MOD + '+Shift+S', action: saveAs },
      { label: '파일 열기…', key: U.MOD + '+O', action: open },
      { sep: true },
      { label: '파일과 연결 끊기', action: unlink }
    ], b));
  } else {
    b.append(h('span', { class: 'st-fn', text: '파일로 저장' }));
    U.info(b, '파일로 저장', '지금은 ' + (U.store.mode === 'cloud' ? 'Claude 계정' : '이 브라우저') + '에만 저장돼요. 눌러서 컴퓨터에 파일로 저장하면, 그다음부터 ' + U.MOD + '+S로 같은 파일에 저장해요.');
    b.addEventListener('click', () => saveAs());
  }
  return b;
}

U.files = {
  supported,
  get link() { return curLink(); },
  dirty, save, saveAs, download, open, openFile, unlink, forget, chip, build,
  nameOf: id => names.get(id) || null
};
})(window.U = window.U || {});
