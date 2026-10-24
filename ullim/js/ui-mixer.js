/* 울림 — 믹서 화면: 모든 트랙의 페이더·팬·센드를 한 화면에 크게 (스텝 가이드의 믹스 단계, 작업대의 믹스 탭) */
(function (U) {
'use strict';
const { h, ui, info } = U;
const pr = () => U.project;
let root = null, store = new Map(), stale = true;

function build(el) {
  root = el;
  stale = true;
}
function shown() { return !!root && root.offsetParent !== null; }
function render() {
  if (!root) return;
  if (!shown()) { stale = true; return; }
  stale = false;
  const sx = root.querySelector('.mxv-row') ? root.querySelector('.mxv-row').scrollLeft : 0;
  U.clear(root);
  store = new Map();
  const p = pr();
  const row = h('div', { class: 'mxv-row' });
  const ch = t => {
    const name = h('button', { type: 'button', class: 'mxv-name' + (ui.track === t.id ? ' sel' : ''), style: { '--c': U.colorOf(t.color) }, dataset: { t: t.id } },
      h('span', { class: 'mxv-sw' }), h('span', { class: 'mxv-t', text: t.type === 'master' ? '마스터' : U.trackLabel(p, t) }));
    info(name, t.type === 'master' ? '마스터' : U.trackLabel(p, t), '눌러서 이 트랙을 골라요.');
    name.addEventListener('click', () => U.selectTrack(t.id));
    if (t.type === 'midi' || t.type === 'audio') name.addEventListener('contextmenu', e => { e.preventDefault(); U.selectTrack(t.id); U.sessionView.trackMenu(t, { x: e.clientX, y: e.clientY }); });
    return h('div', { class: 'mxv-ch' + (t.type === 'master' ? ' master' : '') }, name, U.mixerStrip(t, store));
  };
  for (const t of p.tracks) row.append(ch(t));
  if (p.returns.length) {
    row.append(h('div', { class: 'mxv-gap', 'aria-hidden': 'true' }));
    for (const t of p.returns) row.append(ch(t));
  }
  row.append(ch(p.master));
  root.append(row);
  row.scrollLeft = sx;
}

U.frame(() => {
  if (!shown()) return;
  if (stale) { render(); return; }
  U.stripMeters(store);
});
U.renderer('mixer', render);
// 트랙을 고르면 표시만 바꾼다 (다시 그리면 끌고 있던 페이더를 놓친다)
U.on('select', () => {
  if (!root) return;
  for (const b of root.querySelectorAll('.mxv-name')) b.classList.toggle('sel', b.dataset.t === ui.track);
});
U.mixerView = { build, render };
})(window.U = window.U || {});
