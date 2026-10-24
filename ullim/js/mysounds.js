/* 울림 — 내 사운드: 직접 다듬은 악기 소리(악기 + 앞뒤 이펙트)를 이름 붙여 저장하고, 어느 프로젝트에서나 불러온다.
   이 브라우저(localStorage)에 두고, Claude 계정으로 열었으면 계정에도 저장해서 다른 기기에서도 쓴다 */
(function (U) {
'use strict';

const KEY = 'ullim:sounds:v1';
const GROUP = '내 사운드';
let list = [];

function readLocal() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function writeLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 저장 공간이 없어도 이번에는 쓸 수 있다 */ }
}
/* 불러온 것을 사운드 목록에 맞는 모양으로: 묶음(첫 태그)은 언제나 '내 사운드' */
function fit(s) {
  if (!s || !s.name || !U.DEV[s.kind]) return null;
  s.user = true;
  s.tags = [GROUP].concat((s.tags || []).filter(x => x !== GROUP)).slice(0, 2);
  s.p = s.p || {};
  s.fx = (s.fx || []).filter(f => U.DEV[f.kind]);
  s.pre = (s.pre || []).filter(f => U.DEV[f.kind]);
  return s;
}
function setList(a) {
  list = a.map(fit).filter(Boolean);
  U.emit('sounds');
}
const pushCloud = U.debounce(() => U.store.saveSounds(list.map(strip)), 800);
const strip = s => { const o = Object.assign({}, s); delete o.user; return o; };
function persist() {
  writeLocal();
  pushCloud();
  U.emit('sounds');
}

/* 지금 트랙의 악기와 켜져 있는 이펙트를 사운드 하나로 */
function capture(t, name) {
  const inst = U.instrumentOf(t);
  if (!inst) return null;
  const i = t.devices.indexOf(inst);
  const type = d => U.DEV[d.kind] && U.DEV[d.kind].type;
  const take = d => ({ kind: d.kind, p: U.clone(d.p) });
  const pre = t.devices.slice(0, i).filter(d => d.on !== false && type(d) === 'midi');
  const fx = t.devices.slice(i + 1).filter(d => d.on !== false && type(d) === 'audio');
  const from = U.allSounds().find(s => s.kind === inst.kind && s.name === inst.preset);
  const tags = [GROUP];
  if (from) tags.push(from.user ? from.tags[1] : from.tags[0]);
  const s = { id: U.uid('us'), name, kind: inst.kind, p: U.clone(inst.p), pre: pre.map(take), fx: fx.map(take), tags: tags.filter(Boolean), created: Date.now(), updated: Date.now() };
  if (inst.data) s.data = U.clone(inst.data);
  return { sound: fit(s), devices: [inst].concat(pre, fx) };
}
/* 이름이 내장 사운드와 겹치면 뒤에 숫자를 붙인다 (내 사운드끼리는 덮어쓰기를 따로 묻는다) */
function uniqueName(name, exceptId) {
  name = String(name || '').trim().slice(0, 40) || '내 사운드';
  const taken = n => U.SOUNDS.some(s => s.name === n) || list.some(s => s.name === n && s.id !== exceptId);
  if (!taken(name)) return name;
  for (let k = 2; ; k++) if (!taken(name + ' ' + k)) return name + ' ' + k;
}
function put(s) {
  const i = list.findIndex(x => x.id === s.id);
  s.updated = Date.now();
  if (i >= 0) list[i] = fit(s); else list.unshift(fit(s));
  persist();
  return s;
}
function rename(id, name) {
  const s = list.find(x => x.id === id);
  if (!s) return null;
  const old = s.name;
  s.name = uniqueName(name, id);
  s.updated = Date.now();
  persist();
  // 지금 프로젝트에서 이 사운드를 쓰는 악기의 이름표도 바꾼다
  let n = 0;
  for (const t of U.project.tracks) for (const d of t.devices) if (d.kind === s.kind && d.preset === old) { d.preset = s.name; n++; }
  if (n) U.commit('내 사운드 이름');
  return s;
}
function remove(id) {
  list = list.filter(x => x.id !== id);
  persist();
}

U.allSounds = () => list.concat(U.SOUNDS);
U.mySounds = {
  GROUP,
  list: () => list.slice(),
  get: id => list.find(x => x.id === id) || null,
  byName: name => list.find(x => x.name === name) || null,
  capture, uniqueName, put, rename, remove
};

setList(readLocal());
// Claude 계정에 있으면 그것이 기준 (다른 기기에서 저장한 것도 보이게)
U.store.loadSounds().then(a => {
  if (!Array.isArray(a)) return;
  setList(a);
  writeLocal();
}, () => {});
})(window.U = window.U || {});
