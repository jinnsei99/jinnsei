/* 울림 — MIDI 도구: 만들기(리듬·씨앗·코드 쌓기·모양)와 바꾸기(아르페지오·스트럼·퀀타이즈·휴머나이즈 …) */
(function (U) {
'use strict';
const num = (id, label, min, max, def, o) => Object.assign({ id, label, min, max, def, curve: 'lin' }, o);
const en = (id, label, options, def, o) => Object.assign({ id, label, type: 'enum', options, def }, o);
const bool = (id, label, def, o) => Object.assign({ id, label, type: 'bool', def }, o);
const DIV = [['1/4', '1/4'], ['1/8', '1/8'], ['1/8T', '1/8T'], ['1/16', '1/16'], ['1/16T', '1/16T'], ['1/32', '1/32']];
const PROGS = [
  ['0,4,5,3', 'I–V–vi–IV'], ['5,3,0,4', 'vi–IV–I–V'], ['0,5,3,4', 'I–vi–IV–V'], ['1,4,0,0', 'ii–V–I'],
  ['0,3,4,3', 'I–IV–V–IV'], ['0,6,5,6', 'i–VII–VI–VII'], ['0,5,2,6', 'i–VI–III–VII'], ['0,3,0,4', 'i–iv–i–v']
];

/* 스케일·범위 도우미 */
function region(clip) {
  return clip.loop.on ? [clip.loop.start, clip.loop.end] : [clip.start, clip.end];
}
function scaleOfClip(clip) {
  return clip.scale && clip.scale.on ? clip.scale : U.project.key;
}
function chordsOf(notes) {
  const m = new Map();
  for (const n of notes) { const k = Math.round(n.s * 960); if (!m.has(k)) m.set(k, []); m.get(k).push(n); }
  return [...m.values()];
}
function clampNote(n) { n.p = U.clamp(Math.round(n.p), 0, 127); n.v = U.clamp(Math.round(n.v), 1, 127); n.d = Math.max(1 / 64, n.d); return n; }

const TOOLS = [
  /* ---------- 만들기 ---------- */
  {
    id: 'rhythm', kind: 'gen', name: '리듬',
    info: '정해 둔 칸 수 안에 음을 고르게 흩어 놓는 유클리드 리듬을 만들어요. 아프리카·라틴 리듬이 이런 모양이에요.',
    params: [
      num('steps', 'Steps', 2, 32, 16, { step: 1, info: '한 바퀴의 칸 수' }),
      num('pulses', 'Pulses', 1, 32, 5, { step: 1, info: '그중 음을 칠 칸 수' }),
      num('rot', 'Rotate', 0, 31, 0, { step: 1, info: '패턴을 몇 칸 밀지' }),
      en('div', 'Rate', DIV, '1/16', { info: '한 칸의 길이' }),
      num('pitch', 'Pitch', 0, 127, 60, { step: 1, unit: 'note', info: '칠 음 (드럼이면 패드)' }),
      num('vel', 'Velocity', 1, 127, 100, { step: 1, info: '세기' }),
      num('acc', 'Accent', 0, 1, 0.3, { unit: '%', info: '첫 칸을 얼마나 세게 할지' }),
      num('gate', 'Gate', 0.1, 1, 0.8, { unit: '%', info: '음 길이 (칸 대비)' })
    ],
    init(clip, track) {
      const inst = track && U.instrumentOf(track);
      if (inst && inst.kind === 'drums') return { pitch: 42 };
      const k = scaleOfClip(clip);
      return { pitch: 60 + ((k.root - 60) % 12 + 12) % 12 };
    },
    run(clip, sel, P) {
      const [a, b] = region(clip);
      const st = U.divBeats(P.div);
      const steps = Math.round(P.steps), pulses = Math.min(steps, Math.round(P.pulses));
      const pat = [];
      for (let i = 0; i < steps; i++) pat.push(Math.floor((i * pulses) / steps) !== Math.floor(((i - 1) * pulses) / steps) || (i === 0 && pulses > 0));
      const rot = Math.round(P.rot) % steps;
      const notes = clip.notes.filter(n => n.s < a || n.s >= b || n.p !== P.pitch);
      for (let k = 0, s = a; s < b - 1e-9; k++, s += st) {
        const i = (k + steps - rot) % steps;
        if (!pat[i]) continue;
        const first = k % steps === 0;
        notes.push(clampNote({ p: P.pitch, s: U.round(s, 5), d: st * P.gate, v: P.vel * (first ? 1 : 1 - P.acc * 0.4) }));
      }
      return notes;
    }
  },
  {
    id: 'seed', kind: 'gen', name: '씨앗',
    info: '스케일 안에서 무작위로 음을 흩뿌려 멜로디 씨앗을 만들어요. 씨앗 번호가 같으면 결과도 같아요.',
    params: [
      num('dens', 'Density', 1, 16, 6, { step: 1, info: '한 마디에 몇 음' }),
      num('lo', 'Low', 24, 108, 57, { step: 1, unit: 'note', info: '가장 낮은 음' }),
      num('hi', 'High', 24, 108, 76, { step: 1, unit: 'note', info: '가장 높은 음' }),
      en('div', 'Grid', DIV, '1/8', { info: '음이 놓일 수 있는 격자' }),
      num('len', 'Length', 0.25, 4, 1, { info: '음 길이 (격자 칸 수)' }),
      num('vlo', 'Vel Low', 1, 127, 70, { step: 1, info: '가장 약한 세기' }),
      num('vhi', 'Vel High', 1, 127, 115, { step: 1, info: '가장 센 세기' }),
      num('seed', 'Seed', 1, 999, 7, { step: 1, info: '씨앗 번호' })
    ],
    run(clip, sel, P) {
      const [a, b] = region(clip);
      const k = scaleOfClip(clip);
      const r = U.rng(Math.round(P.seed) * 7919 + 17);
      const g = U.divBeats(P.div);
      const bar = U.barLen(U.project.sig);
      const slots = [];
      for (let s = a; s < b - 1e-9; s += g) slots.push(s);
      const want = Math.max(1, Math.round((b - a) / bar * P.dens));
      const pick = new Set();
      while (pick.size < Math.min(want, slots.length)) pick.add(Math.floor(r() * slots.length));
      const lo = Math.min(P.lo, P.hi), hi = Math.max(P.lo, P.hi);
      const cand = [];
      for (let p = lo; p <= hi; p++) if (U.inScale(p, k.root, k.scale)) cand.push(p);
      if (!cand.length) cand.push(lo);
      const notes = clip.notes.filter(n => n.s < a || n.s >= b);
      let last = cand[Math.floor(cand.length / 2)];
      for (const i of [...pick].sort((x, y) => x - y)) {
        // 큰 도약보다 가까운 음을 조금 더 자주
        const near = cand.filter(p => Math.abs(p - last) <= 7);
        const pool = r() < 0.7 && near.length ? near : cand;
        const p = pool[Math.floor(r() * pool.length)];
        last = p;
        notes.push(clampNote({ p, s: U.round(slots[i], 5), d: Math.min(g * P.len, b - slots[i]), v: P.vlo + r() * (P.vhi - P.vlo) }));
      }
      return notes;
    }
  },
  {
    id: 'stacks', kind: 'gen', name: '코드 쌓기',
    info: '고른 진행대로 스케일 안의 화음을 쌓아요. 키를 바꾸면 같은 진행이 새 키로 나와요.',
    params: [
      en('prog', 'Progression', PROGS, '0,4,5,3', { info: '화음 진행 (로마 숫자는 스케일 도수)' }),
      num('size', 'Notes', 3, 5, 3, { step: 1, info: '화음 하나의 음 수' }),
      num('inv', 'Inversion', 0, 3, 0, { step: 1, info: '전위: 아래 음을 몇 개 옥타브 위로 올릴지' }),
      en('len', 'Chord Len', [['1', '1박'], ['2', '2박'], ['4', '1마디'], ['8', '2마디']], '4', { info: '화음 하나의 길이' }),
      num('oct', 'Octave', 1, 5, 3, { step: 1, info: '근음 옥타브 (3이면 C3 근처)' }),
      bool('open', 'Open', false, { info: '켜면 가운데 음을 한 옥타브 올려 넓게 펼쳐요.' }),
      num('vel', 'Velocity', 1, 127, 92, { step: 1, info: '세기' })
    ],
    run(clip, sel, P) {
      const [a, b] = region(clip);
      const k = scaleOfClip(clip);
      const roots = P.prog.split(',').map(Number);
      const len = +P.len;
      const base = (P.oct + 2) * 12;
      const notes = clip.notes.filter(n => n.s < a || n.s >= b);
      let i = 0;
      for (let s = a; s < b - 1e-9; s += len, i++) {
        const r = roots[i % roots.length];
        let ps = [];
        for (let j = 0; j < P.size; j++) ps.push(U.degreeToPitch(r + j * 2, k.root, k.scale, base));
        for (let j = 0; j < P.inv; j++) { ps.sort((x, y) => x - y); ps[0] += 12; }
        ps.sort((x, y) => x - y);
        if (P.open && ps.length >= 3) ps[1] += 12;
        for (const p of ps) notes.push(clampNote({ p, s: U.round(s, 5), d: Math.min(len, b - s) - 0.02, v: P.vel }));
      }
      return notes;
    }
  },
  {
    id: 'shape', kind: 'gen', name: '모양',
    info: '사인·오르막·내리막 같은 모양을 따라 스케일 음을 이어 놓아요. 베이스 라인이나 아르페지오 바탕으로 좋아요.',
    params: [
      en('shape', 'Shape', [['sine', 'Sine'], ['rise', 'Rise'], ['fall', 'Fall'], ['tri', 'Triangle'], ['walk', 'Random Walk']], 'sine', { info: '음높이가 움직이는 모양' }),
      en('div', 'Rate', DIV, '1/8', { info: '음 간격' }),
      num('lo', 'Low', 24, 108, 55, { step: 1, unit: 'note', info: '가장 낮은 음' }),
      num('hi', 'High', 24, 108, 72, { step: 1, unit: 'note', info: '가장 높은 음' }),
      num('cyc', 'Cycles', 0.5, 8, 1, { step: 0.5, info: '구간 안에서 모양이 몇 번 되풀이될지' }),
      num('gate', 'Gate', 0.1, 1, 0.85, { unit: '%', info: '음 길이' }),
      num('vel', 'Velocity', 1, 127, 100, { step: 1, info: '세기' })
    ],
    run(clip, sel, P) {
      const [a, b] = region(clip);
      const k = scaleOfClip(clip);
      const g = U.divBeats(P.div);
      const lo = Math.min(P.lo, P.hi), hi = Math.max(P.lo, P.hi);
      const d0 = U.pitchToDegree(lo, k.root, k.scale), d1 = U.pitchToDegree(hi, k.root, k.scale);
      const notes = clip.notes.filter(n => n.s < a || n.s >= b);
      const r = U.rng(42);
      let walk = 0.5;
      for (let s = a; s < b - 1e-9; s += g) {
        const ph = ((s - a) / (b - a) * P.cyc) % 1;
        let y;
        switch (P.shape) {
          case 'rise': y = ph; break;
          case 'fall': y = 1 - ph; break;
          case 'tri': y = ph < 0.5 ? ph * 2 : 2 - ph * 2; break;
          case 'walk': walk = U.clamp(walk + (r() - 0.5) * 0.35, 0, 1); y = walk; break;
          default: y = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
        }
        const deg = Math.round(d0 + y * (d1 - d0));
        notes.push(clampNote({ p: U.degreeToPitch(deg, k.root, k.scale), s: U.round(s, 5), d: g * P.gate, v: P.vel }));
      }
      return notes;
    }
  },
  /* ---------- 바꾸기 ---------- */
  {
    id: 'arpeggiate', kind: 'tf', name: '아르페지오',
    info: '같은 시각에 시작하는 화음을 한 음씩 차례로 쪼개요.',
    params: [
      en('style', 'Style', [['up', 'Up'], ['down', 'Down'], ['updown', 'Up-Down'], ['random', 'Random']], 'up', { info: '순서' }),
      en('div', 'Rate', DIV, '1/16', { info: '음 간격' }),
      num('gate', 'Gate', 0.1, 1, 0.8, { unit: '%', info: '음 길이' })
    ],
    run(clip, sel, P) {
      const g = U.divBeats(P.div);
      const keep = clip.notes.filter(n => !sel.has(n));
      const r = U.rng(3);
      for (const ch of chordsOf([...sel])) {
        if (ch.length < 2) { keep.push(...ch); continue; }
        let ps = ch.slice().sort((x, y) => x.p - y.p);
        if (P.style === 'down') ps.reverse();
        if (P.style === 'updown') ps = ps.concat(ps.slice(1, -1).reverse());
        const s0 = ch[0].s, end = Math.max(...ch.map(n => n.s + n.d));
        let i = 0;
        for (let s = s0; s < end - 1e-6; s += g, i++) {
          const n = P.style === 'random' ? ps[Math.floor(r() * ps.length)] : ps[i % ps.length];
          keep.push(clampNote({ p: n.p, s: U.round(s, 5), d: Math.min(g * P.gate, end - s), v: n.v }));
        }
      }
      return keep;
    }
  },
  {
    id: 'strum', kind: 'tf', name: '스트럼',
    info: '화음의 음들을 조금씩 늦게 시작해 기타를 긁듯 펼쳐요.',
    params: [
      num('amt', 'Amount', 0.01, 0.25, 0.05, { info: '음 사이 간격 (박)' }),
      en('dir', 'Direction', [['up', '아래→위'], ['down', '위→아래']], 'up', { info: '어느 음부터' })
    ],
    run(clip, sel, P) {
      for (const ch of chordsOf([...sel])) {
        const ps = ch.slice().sort((x, y) => (P.dir === 'down' ? y.p - x.p : x.p - y.p));
        ps.forEach((n, i) => { const end = n.s + n.d; n.s = U.round(n.s + i * P.amt, 5); n.d = Math.max(1 / 32, end - n.s); });
      }
      return clip.notes;
    }
  },
  {
    id: 'quantize', kind: 'tf', name: '퀀타이즈',
    info: '음의 시작을 격자에 맞춰요. 양을 줄이면 사람이 친 느낌을 조금 남겨요.',
    params: [
      en('div', 'Grid', DIV, '1/16', { info: '맞출 격자' }),
      num('amt', 'Amount', 0, 1, 1, { unit: '%', info: '얼마나 끌어당길지' }),
      bool('ends', 'Ends', false, { info: '끝도 격자에 맞춰요.' })
    ],
    run(clip, sel, P) {
      const g = U.divBeats(P.div);
      for (const n of sel) {
        const t = Math.round(n.s / g) * g;
        const end = n.s + n.d;
        n.s = U.round(n.s + (t - n.s) * P.amt, 5);
        if (P.ends) { const te = Math.max(t + g, Math.round(end / g) * g); n.d = Math.max(g / 2, te - n.s); }
        else n.d = Math.max(1 / 64, end - n.s);
      }
      return clip.notes;
    }
  },
  {
    id: 'humanize', kind: 'tf', name: '휴머나이즈',
    info: '시작 시각과 세기를 조금씩 흔들어 사람이 연주한 것처럼 만들어요.',
    params: [
      num('time', 'Timing', 0, 0.06, 0.012, { info: '시작 시각을 흔드는 폭 (박)' }),
      num('vel', 'Velocity', 0, 40, 12, { step: 1, info: '세기를 흔드는 폭' }),
      num('seed', 'Seed', 1, 999, 11, { step: 1, info: '씨앗 번호' })
    ],
    run(clip, sel, P) {
      const r = U.rng(Math.round(P.seed) * 31 + 5);
      for (const n of sel) {
        n.s = Math.max(0, U.round(n.s + (r() * 2 - 1) * P.time, 5));
        n.v = U.clamp(Math.round(n.v + (r() * 2 - 1) * P.vel), 1, 127);
      }
      return clip.notes;
    }
  },
  {
    id: 'velshape', kind: 'tf', name: '세기 모양',
    info: '고른 음들의 세기를 점점 크게, 점점 작게, 강박 강조처럼 한 번에 바꿔요.',
    params: [
      en('shape', 'Shape', [['up', '점점 크게'], ['down', '점점 작게'], ['accent', '강박 강조'], ['random', '무작위']], 'up', { info: '바꾸는 방식' }),
      num('lo', 'Low', 1, 127, 50, { step: 1, info: '가장 약한 세기' }),
      num('hi', 'High', 1, 127, 120, { step: 1, info: '가장 센 세기' })
    ],
    run(clip, sel, P) {
      const list = [...sel].sort((a, b) => a.s - b.s);
      const s0 = list.length ? list[0].s : 0, s1 = list.length ? list[list.length - 1].s : 1;
      const r = U.rng(9);
      for (const n of list) {
        const x = s1 > s0 ? (n.s - s0) / (s1 - s0) : 0;
        let y;
        if (P.shape === 'down') y = 1 - x;
        else if (P.shape === 'accent') y = Math.abs(n.s % 1) < 0.01 ? 1 : Math.abs(n.s % 0.5) < 0.01 ? 0.6 : 0.25;
        else if (P.shape === 'random') y = r();
        else y = x;
        n.v = Math.round(P.lo + (P.hi - P.lo) * y);
      }
      return clip.notes;
    }
  },
  {
    id: 'recombine', kind: 'tf', name: '재조합',
    info: '리듬은 그대로 두고 음높이 순서만 섞거나 뒤집거나 돌려요.',
    params: [
      en('mode', 'Mode', [['shuffle', '섞기'], ['rotate', '돌리기'], ['reverse', '뒤집기'], ['mirror', '거울 (위아래)']], 'shuffle', { info: '바꾸는 방식' }),
      num('seed', 'Seed', 1, 999, 5, { step: 1, info: '섞기용 씨앗 번호' })
    ],
    run(clip, sel, P) {
      const list = [...sel].sort((a, b) => a.s - b.s || a.p - b.p);
      let ps = list.map(n => n.p);
      if (P.mode === 'shuffle') { const r = U.rng(Math.round(P.seed)); for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; } }
      else if (P.mode === 'rotate') ps = ps.slice(1).concat(ps.slice(0, 1));
      else if (P.mode === 'reverse') ps.reverse();
      else { const lo = Math.min(...ps), hi = Math.max(...ps); const k = scaleOfClip(clip); ps = ps.map(p => U.snapToScale(lo + hi - p, k.root, k.scale)); }
      list.forEach((n, i) => { n.p = ps[i]; });
      return clip.notes;
    }
  },
  {
    id: 'span', kind: 'tf', name: '길이',
    info: '음 길이를 한꺼번에 바꿔요. 레가토는 다음 음까지 이어 붙여요.',
    params: [
      en('mode', 'Mode', [['legato', '레가토'], ['fixed', '고정 길이'], ['scale', '비율'], ['stacc', '스타카토']], 'legato', { info: '바꾸는 방식' }),
      en('div', 'Length', DIV, '1/8', { info: '고정 길이일 때 길이' }),
      num('amt', 'Scale', 0.1, 4, 1.5, { info: '비율일 때 곱할 값' })
    ],
    run(clip, sel, P) {
      const list = [...sel].sort((a, b) => a.s - b.s);
      const starts = [...new Set(clip.notes.map(n => n.s))].sort((a, b) => a - b);
      const [, end] = region(clip);
      for (const n of list) {
        if (P.mode === 'legato') { const nx = starts.find(s => s > n.s + 1e-6); n.d = (nx != null ? nx : end) - n.s; }
        else if (P.mode === 'fixed') n.d = U.divBeats(P.div);
        else if (P.mode === 'scale') n.d = Math.max(1 / 64, n.d * P.amt);
        else n.d = Math.min(n.d, 0.12);
      }
      return clip.notes;
    }
  },
  {
    id: 'connect', kind: 'tf', name: '잇기',
    info: '띄엄띄엄한 음 사이를 스케일 음으로 걸어가듯 채워요.',
    params: [
      en('div', 'Rate', DIV, '1/16', { info: '채울 음 간격' }),
      num('chance', 'Chance', 0.1, 1, 0.8, { unit: '%', info: '빈 곳을 채울 확률' }),
      num('vel', 'Velocity', 1, 127, 80, { step: 1, info: '채운 음 세기' })
    ],
    run(clip, sel, P) {
      const k = scaleOfClip(clip);
      const g = U.divBeats(P.div);
      const r = U.rng(23);
      const list = [...sel].sort((a, b) => a.s - b.s);
      const out = clip.notes.slice();
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i], b = list[i + 1];
        let s = a.s + Math.max(a.d, g);
        s = Math.ceil(s / g - 1e-6) * g;
        const steps = Math.floor((b.s - s) / g + 1e-6);
        if (steps <= 0) continue;
        const d0 = U.pitchToDegree(a.p, k.root, k.scale), d1 = U.pitchToDegree(b.p, k.root, k.scale);
        for (let j = 0; j < steps; j++) {
          if (r() > P.chance) continue;
          const deg = Math.round(d0 + (d1 - d0) * (j + 1) / (steps + 1));
          out.push(clampNote({ p: U.degreeToPitch(deg, k.root, k.scale), s: U.round(s + j * g, 5), d: g * 0.9, v: P.vel }));
        }
      }
      return out;
    }
  },
  {
    id: 'transpose', kind: 'tf', name: '스케일 이동',
    info: '고른 음을 스케일 도수 단위로 옮겨요. 3도 위로 올리면 화음이 저절로 맞아요.',
    params: [num('deg', 'Degrees', -14, 14, 2, { step: 1, info: '옮길 도수 (2 = 3도 위)' })],
    run(clip, sel, P) {
      const k = scaleOfClip(clip);
      for (const n of sel) n.p = U.degreeToPitch(U.pitchToDegree(n.p, k.root, k.scale) + Math.round(P.deg), k.root, k.scale);
      return clip.notes;
    }
  }
];

/* 도구 실행: 원본을 바꾸지 않고 새 음표 배열을 돌려준다 */
function runTool(tool, clip, selSet, params, track) {
  const copy = U.clone(clip);
  // 선택된 음을 복사본에서 찾는다
  const idx = new Set();
  clip.notes.forEach((n, i) => { if (!selSet || !selSet.size || selSet.has(n)) idx.add(i); });
  const sel = new Set(copy.notes.filter((n, i) => idx.has(i)));
  const P = Object.assign({}, U.toolDefaults(tool, clip, track), params);
  const out = tool.run(copy, sel, P);
  return out.map(clampNote).sort((a, b) => a.s - b.s || a.p - b.p);
}
function toolDefaults(tool, clip, track) {
  const p = {};
  for (const s of tool.params) p[s.id] = s.def;
  if (tool.init) Object.assign(p, tool.init(clip, track));
  return p;
}

U.TOOLS = TOOLS;
U.runTool = runTool;
U.toolDefaults = toolDefaults;
U.clipRegion = region;
U.clipKey = scaleOfClip;
})(window.U = window.U || {});
