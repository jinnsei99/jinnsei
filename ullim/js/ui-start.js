/* 울림 — 시작 도우미: 처음 온 사람 안내, 장르로 새 프로젝트, 씬으로 곡 구조 만들기 */
(function (U) {
'use strict';
const { h, btn } = U;
const pr = () => U.project;

/* ================= 새 프로젝트: 장르 고르기 ================= */
function newProjectDialog(first) {
  const body = h('div', { class: 'np' });
  if (first) {
    body.append(h('p', { class: 'np-lead', text: '브라우저에서 바로 쓰는 음악 작업실이에요. 장르를 고르면 템포·키·드럼·베이스·코드·사이드체인과 인트로부터 드롭까지 곡 뼈대를 만들어 드려요.' }));
  }
  const grid = h('div', { class: 'np-grid' });
  let dlg = null;
  const card = (title, sub, desc, onPick, cls) => {
    const b = h('button', { type: 'button', class: 'np-card' + (cls ? ' ' + cls : '') },
      h('span', { class: 'np-t', text: title }), h('span', { class: 'np-s', text: sub }), h('span', { class: 'np-d', text: desc }));
    b.addEventListener('click', () => { if (dlg) dlg.close(); onPick(); });
    return b;
  };
  if (first) grid.append(card('데모 곡 듣기', '122 BPM · A 마이너', '이미 만들어 둔 곡 "새벽 네 시"를 들어 보며 둘러봐요.', () => { U.ensureAudio(); U.engine.launchScene(1); }, 'demo'));
  for (const g of U.GENRES) grid.append(card(g.name, g.bpm + ' BPM · ' + U.scaleLabel(g.key.root, g.key.scale), g.desc, () => U.newProjectFlow(g.id)));
  grid.append(card('빈 프로젝트', '120 BPM', '빈 트랙 네 개로 처음부터 시작해요.', () => U.newProjectFlow(), 'blank'));
  body.append(grid);
  body.append(h('p', { class: 'hint', text: '장르 프로젝트는 세션 뷰의 씬(인트로·빌드업·드롭…)과 어레인지먼트의 곡 구조가 함께 들어 있어요. 고친 내용은 자동으로 저장돼요.' }));
  if (first) body.append(h('p', { class: 'hint', text: U.isTouch
    ? '아래(또는 위)의 패드 화면에서 드럼은 패드로, 신스는 건반으로 손가락으로 쳐요. 길게 누르면 메뉴, 두 번 탭하면 만들기·지우기, 두 손가락으로 밀고 벌리면 스크롤·확대예요.'
    : 'P는 패드 화면(글자 키로 두드리기), M은 컴퓨터 건반, Space는 재생이에요. 메뉴 › 도움말에서 단축키를 볼 수 있어요.' }));
  dlg = U.dialog({ title: first ? '울림 스튜디오에 오신 걸 환영해요' : '새 프로젝트', body, width: '680px', actions: [{ label: first ? '둘러보기' : '닫기' }] });
}

/* ================= 씬으로 곡 만들기 ================= */
const PRESETS = [
  ['edm', '전자음악 기본 · 인트로 8 / 빌드업 8 / 드롭 16 / 브레이크 8 / 빌드업 8 / 드롭 16 / 아웃트로 8'],
  ['short', '짧게 · 쓴 씬을 순서대로 4마디씩'],
  ['order', '씬 순서대로 8마디씩']
];
function presetSections(id) {
  const p = pr();
  const used = p.scenes.map((s, i) => i).filter(i => p.tracks.some(t => t.slots[i]));
  if (id === 'short') return used.map(i => ({ scene: i, bars: 4 }));
  if (id === 'order') return used.map(i => ({ scene: i, bars: 8 }));
  // 이름으로 역할을 찾고, 없으면 쓴 씬을 차례로 돌려 쓴다
  const find = (names, k) => {
    const i = p.scenes.findIndex(s => names.some(n => (s.name || '').includes(n)));
    return i >= 0 ? i : used[Math.min(k, used.length - 1)];
  };
  const intro = find(['인트로', 'intro', 'Intro'], 0), build = find(['빌드', 'build', 'Build'], 1), drop = find(['드롭', 'drop', 'Drop', '메인', '코러스'], 2);
  const brk = find(['브레이크', 'break', 'Break'], 3), outro = find(['아웃트로', 'outro', 'Outro'], used.length - 1);
  return [[intro, 8], [build, 8], [drop, 16], [brk, 8], [build, 8], [drop, 16], [outro, 8]].map(([scene, bars]) => ({ scene, bars }));
}
function songDialog() {
  const p = pr();
  if (!p.tracks.some(t => t.slots.some(Boolean))) { U.toast('클립이 든 씬이 없어요. 세션 뷰에서 씬에 클립을 먼저 넣어 주세요.'); return; }
  let secs = U.guessSections(p);
  const st = { clear: true };
  const bar = U.barLen(p.sig);
  const body = h('div', { class: 'sg' });
  const list = h('div', { class: 'sg-list' });
  const total = h('p', { class: 'hint' });
  const sceneOpts = p.scenes.map((s, i) => [String(i), (i + 1) + ' · ' + (s.name || '이름 없음') + (p.tracks.some(t => t.slots[i]) ? '' : ' (빈 씬)')]);
  const draw = () => {
    U.clear(list);
    let pos = 0;
    secs.forEach((sec, k) => {
      const barsBox = U.numBox({ cls: 'sm', label: '마디 수', get: () => sec.bars, set: (v, f) => { sec.bars = v; if (f) draw(); }, fmt: v => v + '마디', parse: s => parseInt(s, 10), min: 1, max: 128, step: 1, def: 8, range: 400 });
      const up = btn({ text: '↑', cls: 'ghost sm', title: '위로', onclick: () => { if (k > 0) { [secs[k - 1], secs[k]] = [secs[k], secs[k - 1]]; draw(); } } });
      const dup = btn({ text: '복제', cls: 'ghost sm', title: '이 구간 복제', onclick: () => { secs.splice(k + 1, 0, Object.assign({}, sec)); draw(); } });
      const del = btn({ icon: 'close', cls: 'ghost sm', title: '이 구간 빼기', onclick: () => { secs.splice(k, 1); draw(); } });
      list.append(h('div', { class: 'sg-row' },
        h('span', { class: 'sg-pos', text: (pos / bar + 1) + '마디' }),
        U.select(sceneOpts, String(sec.scene), v => { sec.scene = +v; }, { cls: 'sm sg-scene', label: '씬' }),
        barsBox, up, dup, del));
      pos += sec.bars * bar;
    });
    total.textContent = '모두 ' + Math.round(pos / bar) + '마디 · 약 ' + U.fmtTime(pos * 60 / p.bpm);
  };
  const preset = U.select([['', '곡 구조 고르기…']].concat(PRESETS), '', v => { if (v) { secs = presetSections(v); draw(); } }, { cls: 'sm', label: '곡 구조' });
  const add = btn({ icon: 'plus', text: '구간 넣기', cls: 'sm', onclick: () => { secs.push({ scene: secs.length ? secs[secs.length - 1].scene : 0, bars: 8 }); draw(); } });
  const clear = h('input', { type: 'checkbox', id: 'sg-clear' });
  clear.checked = st.clear;
  clear.addEventListener('change', () => { st.clear = clear.checked; });
  body.append(h('p', { class: 'dlg-text', text: '세션 뷰의 씬을 이 순서대로 어레인지먼트에 늘어놓아 곡을 만들어요. 루프 클립은 구간을 채우고, 라이저처럼 한 번 도는 클립은 구간 끝에 맞춰요.' }),
    h('div', { class: 'sg-top' }, preset, add), list, total,
    h('label', { class: 'chk', for: 'sg-clear' }, clear, h('span', { text: '지금 어레인지먼트를 비우고 새로 놓기 (끄면 맨 뒤에 이어 붙여요)' })));
  draw();
  U.dialog({
    title: '씬으로 곡 만들기', body, width: '560px',
    actions: [{ label: '취소' }, { label: '어레인지먼트에 놓기', primary: true, action: () => {
      if (!secs.length) { U.toast('구간을 하나 이상 넣어 주세요.'); return false; }
      const at = st.clear ? 0 : Math.ceil(U.arrangementEnd(p) / bar) * bar;
      const end = U.layoutSong(p, secs, { clear: st.clear, at });
      p.pos = at;
      U.commit('씬으로 곡 만들기');
      U.setView('arrange');
      U.toast(Math.round((end - at) / bar) + '마디짜리 곡을 어레인지먼트에 놓았어요. ' + (U.isTouch ? '▶ 재생으로' : 'Space로') + ' 처음부터 들어 보세요.');
    } }]
  });
}

U.newProjectDialog = newProjectDialog;
U.songDialog = songDialog;
})(window.U = window.U || {});
