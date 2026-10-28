/* 울림 — 소리 다듬기: 악기마다 다른 손잡이들을 쉬운 손잡이 몇 개(밝기·길이·두께·공간·세기 반응·음량)로 묶어 움직이고,
   다듬은 소리를 '내 사운드'로 저장한다. 장치 칸 맨 앞에 붙는다 */
(function (U) {
'use strict';
const { h, btn, info, clamp } = U;
const A = U.act;

/* ================= 쉬운 손잡이 =================
   m(0~1)을 파라미터의 정규 범위 [lo, hi]에 펼친다. get은 지금 값을 손잡이 자리로 되돌린다 (첫 항목 기준) */
const spec = (kind, id) => U.DEV[kind].byId[id];
const span = (id, lo, hi) => ({
  id,
  set: (kind, m) => U.fromNorm(spec(kind, id), lo + (hi - lo) * m),
  get: (kind, v) => (U.toNorm(spec(kind, id), v) - lo) / (hi - lo)
});
const SYNTHS = ['polysynth', 'fm', 'sampler', 'acoustic', 'ensemble', 'looppad'];
const forAll = (kinds, make) => Object.fromEntries(kinds.map(k => [k, make(k)]));
const MACROS = [
  { id: 'bright', name: '밝기', info: '올리면 밝고 또렷하게, 내리면 어둡고 부드럽게 해요.', map: {
    polysynth: [span('cut', 0.3, 1)],
    fm: [span('cut', 0.3, 1)],
    // 샘플러는 필터를 켜야 어두워진다. 끝까지 올리면 필터를 끈다
    sampler: [Object.assign(span('cut', 0.3, 1), { get: (kind, v, p) => (p.fon ? (U.toNorm(spec(kind, 'cut'), v) - 0.3) / 0.7 : 1) }), { id: 'fon', set: (kind, m) => m < 0.98 }],
    acoustic: [span('tone', 0, 1)],
    ensemble: [span('bright', 0, 1)]
  } },
  { id: 'len', name: '길이', info: '소리가 남는 길이예요. 올리면 길게 울리고 천천히 사라져요.', map: {
    polysynth: [span('r', 0.05, 0.85), span('d', 0.15, 0.85)],
    fm: [span('r', 0.05, 0.85), span('d', 0.15, 0.9)],
    sampler: [span('r', 0.05, 0.85)],
    acoustic: [span('decay', 0, 1), span('rel', 0, 1)],
    ensemble: [span('rel', 0, 1)],
    looppad: [span('rel', 0, 1)]
  } },
  { id: 'width', name: '두께', info: '여러 소리가 겹친 듯 두껍고 넓게 해요.', map: {
    polysynth: [{ id: 'd1', set: (kind, m) => -Math.round(m * 30), get: (kind, v, p) => ((p.d2 || 0) - v) / 60 }, { id: 'd2', set: (kind, m) => Math.round(m * 30) }],
    ensemble: [span('width', 0, 1)],
    acoustic: [span('body', 0, 1)]
  } },
  { id: 'drive', name: '드라이브', info: '앰프(Amp)를 얼마나 세게 밀지예요. 올리면 거칠고 길게 끌리고, 내리면 깨끗해져요. 앰프가 있는 소리에만 나와요.', amp: true },
  { id: 'space', name: '공간', info: '울리는 공간(리버브)의 양이에요. 트랙에 리버브가 없으면 하나 넣어요.', space: true },
  { id: 'vel', name: '세기 반응', info: '세게 칠수록 크게 나는 정도예요. 내리면 늘 같은 크기로 나요.', map: forAll(SYNTHS, () => [span('vel', 0, 1)]) },
  { id: 'vol', name: '음량', info: '악기 자체의 음량이에요. 트랙 페이더와 따로 움직여요.', map: forAll(SYNTHS.concat(['drums']), () => [span('vol', 0, 1)]) }
];
const SPACE_MAX = 0.6;   // 공간 손잡이 끝 = 리버브 Dry/Wet 60%

function reverbOf(t, inst) {
  const i = t.devices.indexOf(inst);
  const list = t.devices.slice(i + 1).filter(d => d.kind === 'reverb');
  return list[list.length - 1] || null;
}
/* 악기 뒤의 첫 앰프 */
function ampOf(t, inst) {
  const i = t.devices.indexOf(inst);
  return t.devices.slice(i + 1).find(d => d.kind === 'amp') || null;
}
function valueOf(t, d, mac) {
  if (mac.space) { const rv = reverbOf(t, d); return rv && rv.on !== false ? clamp(rv.p.mix / SPACE_MAX, 0, 1) : 0; }
  if (mac.amp) { const am = ampOf(t, d); return am ? clamp((am.p.gain != null ? am.p.gain : 5) / 10, 0, 1) : 0; }
  const m = mac.map[d.kind][0];
  return clamp(m.get(d.kind, d.p[m.id], d.p), 0, 1);
}
/* 손잡이를 움직인다: 끄는 동안은 소리만 따라오게(live), 놓으면 되돌리기 한 칸으로 */
function apply(t, d, mac, m, final) {
  if (mac.space) {
    let rv = reverbOf(t, d);
    if (!rv) {
      if (m < 0.005) { if (final) U.inval('detail'); return; }
      rv = U.makeDevice('reverb', { p: { mix: 0, decay: 2.4 } });
      rv.grp = d.grp;   // 이 소리의 이펙트로 묶는다 (소리를 바꾸면 함께 빠진다)
      t.devices.push(rv);
    }
    rv.on = true;
    rv.p.mix = U.round(SPACE_MAX * m, 3);
  } else if (mac.amp) {
    const am = ampOf(t, d);
    if (!am) return;
    am.p.gain = U.round(m * 10, 1);
  } else {
    for (const mp of mac.map[d.kind]) d.p[mp.id] = mp.set(d.kind, m);
  }
  if (final) U.commit('소리 다듬기 · ' + mac.name);
  else {
    U.touch({});
    // 장치 칸의 노브도 함께 움직인다
    for (const p of U.deviceView.panels) if (p.d === d || (mac.space && p.d.kind === 'reverb') || (mac.amp && p.d.kind === 'amp')) p.el.update();
  }
}

/* 가로 손잡이: 손가락이나 마우스로 끌고, 화살표 키로도 움직인다 */
function slider(t, d, mac) {
  const fill = h('div', { class: 'shp-fill' }), knob = h('div', { class: 'shp-thumb' });
  const bar = h('div', { class: 'shp-bar', role: 'slider', tabindex: '0', 'aria-label': mac.name, 'aria-valuemin': '0', 'aria-valuemax': '100', 'data-nolongpress': '' }, fill, knob);
  const val = h('span', { class: 'shp-val' });
  const show = m => {
    const pc = Math.round(m * 100);
    fill.style.width = pc + '%';
    knob.style.left = pc + '%';
    val.textContent = pc + '%';
    bar.setAttribute('aria-valuenow', String(pc));
  };
  show(valueOf(t, d, mac));
  const at = e => { const r = bar.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); };
  let drag = false, lastM = 0;
  bar.addEventListener('pointerdown', e => {
    if (e.button) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    drag = true;
    U.ensureAudio();
    lastM = at(e); show(lastM); apply(t, d, mac, lastM, false);
  });
  bar.addEventListener('pointermove', e => { if (!drag) return; lastM = at(e); show(lastM); apply(t, d, mac, lastM, false); });
  const end = () => { if (!drag) return; drag = false; apply(t, d, mac, lastM, true); };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
  bar.addEventListener('keydown', e => {
    const k = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0;
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    const m = clamp(valueOf(t, d, mac) + k, 0, 1);
    show(m); apply(t, d, mac, m, true);
  });
  const row = h('div', { class: 'shp-row' }, h('span', { class: 'shp-name', text: mac.name }), bar, val);
  info(row, mac.name, mac.info);
  return row;
}

/* ================= 소리 다듬기 칸 ================= */
function panel(t) {
  const d = U.instrumentOf(t);
  const el = h('div', { class: 'dev shape t-instrument' });
  const title = h('div', { class: 'dev-name' }, h('span', { class: 'dn', text: '소리 다듬기' }), d.preset ? h('span', { class: 'dp', text: d.preset }) : null);
  info(title, '소리 다듬기', '쉬운 손잡이로 악기 소리를 다듬어요. 오른쪽 장치의 노브와 함께 움직여요. 마음에 들면 내 사운드로 저장해 두세요.');
  const body = h('div', { class: 'shp-body' });
  for (const mac of MACROS) if (mac.space || (mac.amp ? ampOf(t, d) : mac.map[d.kind] && mac.map[d.kind].every(mp => spec(d.kind, mp.id)))) body.append(slider(t, d, mac));
  const save = btn({ text: '내 사운드로 저장', cls: 'sm primary', info: ['내 사운드로 저장', '지금 소리(악기와 이펙트)를 이름 붙여 저장해요. 다른 곡에서도 소리 고르기의 \'내 사운드\'에서 불러와요.'], onclick: () => saveMySound(t) });
  const orig = U.allSounds().find(s => s.kind === d.kind && s.name === d.preset);
  const reset = btn({ text: '처음 값으로', cls: 'sm', info: ['처음 값으로', orig ? '"' + orig.name + '"을(를) 불러왔을 때의 악기 값으로 되돌려요.' : '악기를 기본값으로 되돌려요.'], onclick: () => orig ? A.applyPreset(d.id, orig.name, orig.p) : A.applyPreset(d.id, null, {}) });
  body.append(h('div', { class: 'shp-btns' }, save, reset));
  el.append(h('div', { class: 'dev-head' }, title), body);
  return el;
}

/* ================= 내 사운드로 저장 ================= */
async function saveMySound(t) {
  const inst = U.instrumentOf(t);
  if (!inst) { U.toast('악기가 있는 트랙에서 저장할 수 있어요.'); return; }
  const mine = inst.preset && U.mySounds.byName(inst.preset);
  const name = await U.ask('내 사운드로 저장', '이름', mine ? mine.name : U.mySounds.uniqueName(inst.preset ? inst.preset + ' 내 소리' : '내 사운드'));
  if (!name) return;
  const got = U.mySounds.capture(t, name.trim().slice(0, 40));
  const s = got.sound;
  const same = U.mySounds.byName(s.name);
  if (same) {
    if (!(await U.confirm('같은 이름이 있어요', '"' + s.name + '"을(를) 지금 소리로 바꿀까요?', '바꾸기'))) return;
    s.id = same.id;
    s.created = same.created;
  } else s.name = U.mySounds.uniqueName(s.name);
  U.mySounds.put(s);
  // 트랙의 악기와 담은 이펙트를 이 사운드 한 묶음으로 (다른 소리를 고르면 함께 빠진다)
  const grp = inst.grp || U.uid('g');
  for (const x of got.devices) x.grp = grp;
  inst.preset = s.name;
  U.commit('내 사운드로 저장');
  U.toast('"' + s.name + '"(으)로 저장했어요. 소리 고르기의 \'내 사운드\'에 있어요.');
  return s;
}
/* 내 사운드 하나의 메뉴: 이름 바꾸기 · 지우기 */
function mySoundItems(s) {
  return [
    { label: '이름 바꾸기…', action: async () => { const v = await U.ask('내 사운드 이름', '이름', s.name); if (v && v.trim() && v.trim() !== s.name) U.mySounds.rename(s.id, v.trim()); } },
    { label: '지우기', danger: true, action: async () => { if (await U.confirm('내 사운드 지우기', '"' + s.name + '"을(를) 지울까요? 이미 이 소리를 쓰는 트랙은 그대로 남아요.', '지우기', true)) U.mySounds.remove(s.id); } }
  ];
}
function mySoundMenu(s, at) { U.menu([{ header: s.name }].concat(mySoundItems(s)), at); }

U.shapePanel = panel;
U.saveMySound = saveMySound;
U.mySoundMenu = mySoundMenu;
U.mySoundItems = mySoundItems;
U.shapeMacros = MACROS;
U.on('sounds', () => U.inval('browser', 'detail', 'pads'));
})(window.U = window.U || {});
