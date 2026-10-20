/* 울림 — 저장: 프로젝트(Claude 계정 또는 이 브라우저), 오디오 파일(이 브라우저), 파일 내려받기 */
(function (U) {
'use strict';

const S = {
  mode: 'local',      // 'local' | 'cloud' | 'memory'
  db: null,           // Claude db
  uid: null,
  downloads: null,
  status: 'idle',     // idle | saving | saved | error
  ready: null,
  idb: null
};
const CHUNK = 60000;

/* ================= IndexedDB ================= */
function openIdb() {
  if (S.idb) return S.idb;
  S.idb = new Promise((res, rej) => {
    let req;
    try { req = indexedDB.open('ullim', 1); } catch (e) { rej(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'hash' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    req.onblocked = () => rej(new Error('blocked'));
  });
  S.idb.catch(() => {});
  return S.idb;
}
function tx(store, mode, fn) {
  return openIdb().then(db => new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let out;
    const r = fn(os);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}
const mem = { projects: new Map(), audio: new Map() };

/* ================= 오디오 (언제나 이 브라우저) ================= */
function putAudio(rec) {
  mem.audio.set(rec.hash, rec);
  return tx('audio', 'readwrite', os => os.put(rec)).catch(e => { console.warn(e); });
}
function getAudio(hash) {
  if (mem.audio.has(hash)) return Promise.resolve(mem.audio.get(hash));
  return tx('audio', 'readonly', os => os.get(hash)).then(r => { if (r) mem.audio.set(hash, r); return r || null; }, () => null);
}
function listAudio() {
  return tx('audio', 'readonly', os => os.getAll()).then(list => {
    for (const r of list || []) mem.audio.set(r.hash, r);
    return [...mem.audio.values()];
  }, () => [...mem.audio.values()]);
}
function deleteAudio(hash) {
  mem.audio.delete(hash);
  return tx('audio', 'readwrite', os => os.delete(hash)).catch(() => {});
}

/* ================= Claude 계정 ================= */
const queues = {};
function queue(id, fn) {
  const p = (queues[id] || Promise.resolve()).then(fn, fn);
  queues[id] = p.catch(() => {});
  return p;
}
async function retry(fn) {
  try { return await fn(); } catch (e) {
    if (e && e.code === 'unavailable') { await U.sleep(400 + Math.random() * 800); return fn(); }
    throw e;
  }
}
function col() { return S.db.collection('data/users/' + S.uid); }
async function cloudIndex() {
  const snap = await retry(() => col().doc('index').get());
  const d = snap.exists ? snap.data() : null;
  return (d && d.projects) || {};
}
async function cloudSave(pr, json) {
  const parts = [];
  for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
  const pid = 'p_' + pr.id;
  await queue(pid, async () => {
    const ref = col().doc(pid);
    for (let i = 1; i < parts.length; i++) {
      await retry(() => ref.collection('parts').doc(String(i)).set({ b: parts[i] }));
    }
    await retry(() => ref.set({ n: parts.length, b: parts[0] || '', updated: pr.updated }));
  });
  await queue('index', async () => {
    const idx = await cloudIndex();
    idx[pr.id] = { name: pr.name, updated: pr.updated, bpm: pr.bpm };
    await retry(() => col().doc('index').set({ projects: idx }));
  });
}
async function cloudLoad(id) {
  const ref = col().doc('p_' + id);
  const snap = await retry(() => ref.get());
  if (!snap.exists) return null;
  const d = snap.data();
  let json = d.b || '';
  for (let i = 1; i < (d.n || 1); i++) {
    const ps = await retry(() => ref.collection('parts').doc(String(i)).get());
    json += ps.exists ? ps.data().b : '';
  }
  return JSON.parse(json);
}
async function cloudDelete(id) {
  const ref = col().doc('p_' + id);
  const snap = await retry(() => ref.get());
  if (snap.exists) {
    const n = snap.data().n || 1;
    for (let i = 1; i < n; i++) await retry(() => ref.collection('parts').doc(String(i)).delete());
    await retry(() => ref.delete());
  }
  await queue('index', async () => {
    const idx = await cloudIndex();
    delete idx[id];
    await retry(() => col().doc('index').set({ projects: idx }));
  });
}

/* ================= 공통 ================= */
function setStatus(s, err) {
  S.status = s;
  S.error = err || null;
  U.emit('store', s);
}
async function listProjects() {
  await S.ready;
  if (S.mode === 'cloud') {
    try {
      const idx = await cloudIndex();
      return Object.entries(idx).map(([id, m]) => ({ id, name: m.name, updated: m.updated, bpm: m.bpm })).sort((a, b) => b.updated - a.updated);
    } catch (e) { console.warn(e); return []; }
  }
  try {
    const list = await tx('projects', 'readonly', os => os.getAll());
    return (list || []).map(r => ({ id: r.id, name: r.name, updated: r.updated, bpm: r.bpm })).sort((a, b) => b.updated - a.updated);
  } catch (e) {
    return [...mem.projects.values()].map(r => ({ id: r.id, name: r.name, updated: r.updated })).sort((a, b) => b.updated - a.updated);
  }
}
async function saveProject(pr) {
  await S.ready;
  const json = JSON.stringify(pr);
  setStatus('saving');
  try {
    if (S.mode === 'cloud') await cloudSave(pr, json);
    else {
      const rec = { id: pr.id, name: pr.name, updated: pr.updated, bpm: pr.bpm, data: json };
      mem.projects.set(pr.id, rec);
      if (S.mode === 'local') await tx('projects', 'readwrite', os => os.put(rec));
    }
    U.setPref('last', pr.id);
    setStatus('saved');
    return true;
  } catch (e) {
    console.warn(e);
    const code = e && e.code;
    if (code === 'quota_exceeded') setStatus('error', '저장 공간이 가득 찼어요. 안 쓰는 프로젝트를 지워 주세요.');
    else if (code === 'invalid_argument' && S.mode === 'cloud') {
      // 이 링크에서는 계정에 쓸 수 없다 → 이 브라우저로
      S.mode = 'local';
      setStatus('error', '이 링크에서는 계정에 저장할 수 없어서 이 브라우저에 저장할게요.');
      return saveProject(pr);
    } else setStatus('error', '저장하지 못했어요. 프로젝트 파일로 내보내 두세요.');
    return false;
  }
}
async function loadProject(id) {
  await S.ready;
  if (S.mode === 'cloud') return cloudLoad(id);
  if (mem.projects.has(id)) return JSON.parse(mem.projects.get(id).data);
  try {
    const r = await tx('projects', 'readonly', os => os.get(id));
    return r ? JSON.parse(r.data) : null;
  } catch (e) { return null; }
}
async function deleteProject(id) {
  await S.ready;
  mem.projects.delete(id);
  if (S.mode === 'cloud') return cloudDelete(id);
  return tx('projects', 'readwrite', os => os.delete(id)).catch(() => {});
}

/* ================= 파일 건네기 ================= */
const ALLOWED = ['zip', 'json', 'txt', 'csv', 'md'];
async function offer(filename, blob) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (S.downloads) {
    let name = filename, data = blob;
    if (!ALLOWED.includes(ext)) {
      data = await U.zip([{ name: filename, data: blob }]);
      name = filename.replace(/\.[^.]+$/, '') + '.zip';
    }
    try {
      await S.downloads.save({ filename: name, data });
      return 'saved';
    } catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (e && e.code === 'rate_limited') { U.toast('잠시 뒤에 다시 눌러 주세요.'); return 'declined'; }
      U.toast('이 화면에서는 파일을 받을 수 없어요.', 'error');
      return 'failed';
    }
  }
  if (window.claude) { U.toast('이 화면에서는 파일을 받을 수 없어요.', 'error'); return 'failed'; }
  // 아이패드·아이폰: 공유 화면으로 '파일에 저장'·AirDrop·다른 앱으로 보낸다
  if (U.isIOS && navigator.canShare && window.File) {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    let ok = false;
    try { ok = navigator.canShare({ files: [file] }); } catch (e) { ok = false; }
    if (ok) return shareDialog(file, blob);
  }
  return saveLink(blob, filename);
}
/* 렌더가 끝난 뒤에는 '사용자가 누른 순간'이 지나서 공유 화면을 바로 못 띄우니, 버튼을 한 번 더 누르게 한다 */
function shareDialog(file, blob) {
  return new Promise(res => {
    let done = false, busy = false;
    const fin = v => { if (!done) { done = true; res(v); } };
    const kb = Math.max(1, Math.round(file.size / 1024));
    U.dialog({
      title: '파일이 준비됐어요', width: '400px',
      body: U.h('div', { class: 'xp' },
        U.h('p', { text: file.name + ' · ' + (kb >= 1024 ? U.round(kb / 1024, 1) + ' MB' : kb + ' KB') }),
        U.h('p', { class: 'hint', text: '공유 화면에서 "파일에 저장"을 고르면 파일 앱에 남아요. AirDrop이나 다른 음악 앱으로 바로 보낼 수도 있어요.' })),
      onclose: () => { if (!busy) fin('declined'); },
      actions: [
        { label: '그냥 받기', action: () => { busy = true; fin(saveLink(blob, file.name)); } },
        { label: '저장·공유', primary: true, action: () => {
          busy = true;
          navigator.share({ files: [file], title: file.name }).then(() => fin('saved'),
            err => fin(err && err.name === 'AbortError' ? 'declined' : saveLink(blob, file.name)));
        } }
      ]
    });
  });
}
function saveLink(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
function canDownload() { return !!S.downloads || !window.claude; }
function pickFile(accept, multiple) {
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept || '';
    inp.multiple = !!multiple;
    inp.style.display = 'none';
    inp.addEventListener('change', () => { res(Array.from(inp.files || [])); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}

/* ================= 연결 ================= */
async function connect() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return startLocal();
  c.use('downloads').then(d => { S.downloads = d; U.emit('store', S.status); }, () => {});
  let db = null, user = null;
  try { [db, user] = await Promise.all([c.use('db'), c.use('user')]); } catch (e) { /* 아래에서 */ }
  if (!db || !user) return startLocal();
  let uid = null;
  try { uid = await user.id(); } catch (e) { /* 무시 */ }
  if (!uid) return startLocal();
  S.db = db;
  S.uid = uid;
  S.mode = 'cloud';
}
async function startLocal() {
  try { await openIdb(); S.mode = 'local'; } catch (e) { S.mode = 'memory'; }
}
S.ready = connect().catch(() => startLocal());

U.store = {
  get mode() { return S.mode; },
  get status() { return S.status; },
  get error() { return S.error; },
  get ready() { return S.ready; },
  listProjects, saveProject, loadProject, deleteProject,
  putAudio, getAudio, listAudio, deleteAudio,
  offer, canDownload, pickFile
};
})(window.U = window.U || {});
