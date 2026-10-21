/* 울림 — 내장 콘텐츠: 드럼 키트, 사운드 프리셋, 이펙트 프리셋, 샘플, 루프 패드 키트, 클립 템플릿, 데모 곡 */
(function (U) {
'use strict';
const pad = U.pad;

/* ================= 드럼 키트 =================
   패드 순서는 GM 드럼 배치를 따른다: C1 킥, D1 스네어, F#1 닫힌 햇, A#1 열린 햇 … */
function kit(o) {
  o = o || {};
  const g = (k, d) => Object.assign({}, d, o[k]);
  return [
    pad('kick', g('kick')), pad('rim', g('rim')), pad('snare', g('snare')), pad('clap', g('clap')),
    pad('snap', g('snap')), pad('tom', g('tl', { name: 'Low Tom', tune: -5 })), pad('chh', g('chh', { choke: 1 })), pad('tom', g('tm', { name: 'Mid Tom', tune: 0 })),
    pad('shaker', g('shaker')), pad('tom', g('th', { name: 'Hi Tom', tune: 5 })), pad('ohh', g('ohh', { choke: 1 })), pad('cow', g('cow')),
    pad('conga', g('conga')), pad('crash', g('crash')), pad('sub', g('sub', { name: '808 Sub', level: -3 })), pad('ride', g('ride'))
  ];
}
const KITS = [
  { id: 'k909', name: '909 하우스', tags: ['하우스', '테크노'], pads: kit({
    kick: { tune: 2, decay: 0.32, tone: 0.75 }, snare: { tune: 3, decay: 0.3, tone: 0.75 }, clap: { decay: 0.4, tone: 0.55, level: -1 },
    chh: { decay: 0.22, tone: 0.75, level: -2, choke: 1 }, ohh: { decay: 0.45, tone: 0.75, level: -3, choke: 1 }, ride: { tone: 0.7, level: -4 },
    shaker: { decay: 0.35, level: -6 }, rim: { level: -3 }, crash: { level: -4 }
  }) },
  { id: 'k808', name: '808 클래식', tags: ['힙합', '일렉트로'], pads: kit({
    kick: { tune: 0, decay: 0.8, tone: 0.25 }, snare: { tune: 1, decay: 0.38, tone: 0.5 }, clap: { decay: 0.5, tone: 0.4 },
    chh: { decay: 0.3, tone: 0.25, level: -2, choke: 1 }, ohh: { decay: 0.55, tone: 0.25, level: -3, choke: 1 }, cow: { decay: 0.45 },
    conga: { tune: 3, tone: 0.2 }, sub: { name: '808 Sub', decay: 0.65, tone: 0.3, level: -2 }
  }) },
  { id: 'klofi', name: '로파이 붐뱁', tags: ['힙합', '로파이'], pads: kit({
    kick: { tune: -3, decay: 0.5, tone: 0.15 }, snare: { tune: -4, decay: 0.42, tone: 0.45 }, clap: { tune: -2, decay: 0.35, tone: 0.3, level: -3 },
    rim: { tune: -3, level: -2 }, chh: { tune: -4, decay: 0.28, tone: 0.2, level: -5, choke: 1 }, ohh: { tune: -4, decay: 0.45, tone: 0.2, level: -6, choke: 1 },
    shaker: { tone: 0.1, level: -8 }, ride: { tune: -5, tone: 0.2, level: -6 }
  }) },
  { id: 'ktrap', name: '트랩', tags: ['트랩', '힙합'], pads: kit({
    kick: { tune: 1, decay: 0.45, tone: 0.6 }, snare: { tune: 5, decay: 0.35, tone: 0.9 }, clap: { decay: 0.55, tone: 0.75 },
    chh: { decay: 0.12, tone: 0.85, level: -3, choke: 1 }, ohh: { decay: 0.4, tone: 0.85, level: -5, choke: 1 },
    sub: { name: '808 Sub', decay: 0.85, tone: 0.55, level: -1 }, snap: { level: -2 }, zap: {}
  }) }
];
/* 전자음악 키트 (뒤에 붙여서 앞 번호는 그대로) */
KITS.push(
  { id: 'ktechno', name: '테크노', tags: ['테크노'], pads: kit({
    kick: { tune: -1, decay: 0.45, tone: 0.9 }, snare: { tune: 2, decay: 0.28, tone: 0.8 }, clap: { decay: 0.5, tone: 0.65 },
    chh: { decay: 0.16, tone: 0.9, level: -4, choke: 1 }, ohh: { decay: 0.4, tone: 0.9, level: -5, choke: 1 }, ride: { tone: 0.85, level: -6 },
    rim: { level: -4 }, shaker: { decay: 0.3, level: -8 }, sub: { name: '럼블', decay: 0.7, tone: 0.2, level: -6 }
  }) },
  { id: 'kdnb', name: '드럼 앤 베이스', tags: ['DnB', '정글'], pads: kit({
    kick: { tune: 3, decay: 0.3, tone: 0.8 }, snare: { tune: 7, decay: 0.32, tone: 0.95 }, clap: { tune: 3, decay: 0.3, tone: 0.8, level: -3 },
    chh: { tune: 2, decay: 0.12, tone: 0.8, level: -4, choke: 1 }, ohh: { tune: 2, decay: 0.3, tone: 0.8, level: -6, choke: 1 }, ride: { tune: 2, tone: 0.8, level: -6 },
    rim: { tune: 4, level: -3 }, shaker: { level: -9 }
  }) }
);
U.KITS = KITS;
U.DEFAULT_KIT = KITS[0].pads;
U.kitById = id => KITS.find(k => k.id === id) || KITS[0];

/* ================= 사운드 (악기 프리셋) ================= */
const FX = (kind, p) => ({ kind, p });
const SOUNDS = [
  { name: '따뜻한 패드', kind: 'polysynth', tags: ['패드'], p: { w1: 'sawtooth', w2: 'sawtooth', d1: -8, d2: 8, l1: 0.7, l2: 0.7, ft: 'lp24', cut: 1100, res: 0.12, fenv: 0.18, fkey: 0.3, fa: 0.9, fd: 1.8, fs: 0.6, fr: 1.5, a: 0.9, d: 1.5, s: 0.85, r: 1.6, lrate: 0.25, lfilt: 0.12, vel: 0.3, vol: -11 }, fx: [FX('chorus', { mix: 0.35, rate: 0.4 }), FX('reverb', { mix: 0.3, decay: 3.8 })] },
  { name: '스트링 앙상블', kind: 'polysynth', tags: ['패드'], p: { w1: 'sawtooth', w2: 'sawtooth', d1: -11, d2: 11, ft: 'lp12', cut: 2400, res: 0.05, fenv: 0.08, a: 0.45, d: 1, s: 0.9, r: 0.9, lpitch: 0.05, lrate: 4.6, vol: -13 }, fx: [FX('chorus', { mix: 0.5 }), FX('reverb', { mix: 0.3, decay: 3 })] },
  { name: '글래스 패드', kind: 'fm', tags: ['패드'], p: { algo: 'stack', cr: 1, ar: 2, al: 0.25, aa: 0.6, ad: 2, as: 0.6, br: 3, bl: 0.15, ba: 1, bd: 2, bs: 0.5, a: 0.7, d: 2, s: 0.8, r: 1.8, vol: -12 }, fx: [FX('reverb', { mix: 0.4, decay: 5 })] },
  { name: '서브 베이스', kind: 'polysynth', tags: ['베이스'], p: { w1: 'sine', w2: 'triangle', l1: 1, l2: 0.25, d2: 0, ft: 'lp12', cut: 520, res: 0, fenv: 0, a: 0.004, d: 0.2, s: 0.9, r: 0.08, mono: true, glide: 0.03, vel: 0.3, vol: -6 } },
  { name: '애시드 베이스', kind: 'polysynth', tags: ['베이스'], p: { w1: 'sawtooth', l1: 0.9, l2: 0, ft: 'lp24', cut: 240, res: 0.78, fenv: 0.62, fkey: 0.2, fa: 0.002, fd: 0.22, fs: 0, fr: 0.1, a: 0.002, d: 0.3, s: 0.8, r: 0.05, mono: true, glide: 0.06, vel: 0.6, vol: -9 }, fx: [FX('sat', { type: 'soft', drive: 9, out: -6, mix: 0.8 })] },
  { name: '와블 베이스', kind: 'polysynth', tags: ['베이스'], p: { w1: 'sawtooth', w2: 'square', o2: -1, l2: 0.5, d2: 0, ft: 'lp12', cut: 8000, fenv: 0, a: 0.003, s: 1, r: 0.08, mono: true, vol: -10 }, fx: [FX('autofilter', { ft: 'lp24', cut: 260, res: 0.5, lamt: 0.85, lsync: true, ldiv: '1/8', drive: 8 })] },
  { name: 'FM 베이스', kind: 'fm', tags: ['베이스'], p: { algo: 'stack', cr: 1, ar: 1, al: 0.55, aa: 0.001, ad: 0.18, as: 0.25, br: 2, bl: 0.2, bd: 0.1, bs: 0, a: 0.002, d: 0.5, s: 0.75, r: 0.06, cut: 3500, vol: -8 } },
  { name: '플럭', kind: 'polysynth', tags: ['플럭'], p: { w1: 'sawtooth', w2: 'square', o2: 1, l1: 0.7, l2: 0.35, d2: 4, ft: 'lp24', cut: 520, res: 0.25, fenv: 0.65, fa: 0.001, fd: 0.22, fs: 0, fr: 0.2, a: 0.001, d: 0.4, s: 0, r: 0.25, vel: 0.6, vol: -10 }, fx: [FX('delay', { mix: 0.2 }), FX('reverb', { mix: 0.2 })] },
  { name: 'FM 마림바', kind: 'fm', tags: ['플럭', '키'], p: { algo: 'para', cr: 1, ar: 4, al: 0.35, ad: 0.07, as: 0, br: 10, bl: 0.05, bd: 0.03, bs: 0, a: 0.001, d: 0.6, s: 0, r: 0.3, vol: -8 } },
  { name: '전자 피아노', kind: 'fm', tags: ['키'], p: { algo: 'para', cw: 'sine', cr: 1, ar: 1, al: 0.32, aa: 0.002, ad: 1.1, as: 0.12, arl: 0.5, br: 14, bl: 0.1, ba: 0.001, bd: 0.1, bs: 0, brl: 0.08, a: 0.002, d: 2.2, s: 0.18, r: 0.45, cut: 9000, vel: 0.7, vol: -8 }, fx: [FX('chorus', { mix: 0.25, rate: 0.6 })] },
  { name: '벨', kind: 'fm', tags: ['키'], p: { algo: 'para', cr: 1, ar: 3.5, al: 0.45, ad: 2.2, as: 0.15, br: 7, bl: 0.12, bd: 0.8, bs: 0.1, a: 0.001, d: 3, s: 0, r: 2, vol: -11 }, fx: [FX('reverb', { mix: 0.3 })] },
  { name: '오르간', kind: 'polysynth', tags: ['키'], p: { w1: 'sine', w2: 'sine', o2: 1, d2: 0, l1: 0.8, l2: 0.5, ft: 'lp12', cut: 6000, fenv: 0, a: 0.005, d: 0.1, s: 1, r: 0.06, lamp: 0.15, lrate: 6.5, vol: -10 }, fx: [FX('chorus', { mode: 'vibrato', rate: 6, depth: 0.25 })] },
  { name: '슈퍼 쏘우 리드', kind: 'polysynth', tags: ['리드'], p: { w1: 'sawtooth', w2: 'sawtooth', d1: -18, d2: 18, l1: 0.8, l2: 0.8, ft: 'lp12', cut: 5200, res: 0.1, fenv: 0.15, a: 0.008, d: 0.5, s: 0.8, r: 0.35, lpitch: 0.04, lrate: 5, vol: -12 }, fx: [FX('chorus', { mix: 0.4 }), FX('reverb', { mix: 0.25 })] },
  { name: '부드러운 리드', kind: 'polysynth', tags: ['리드'], p: { w1: 'square', w2: 'triangle', o2: 1, d2: 0, l1: 0.6, l2: 0.4, ft: 'lp12', cut: 2600, res: 0.2, fenv: 0.1, a: 0.02, s: 0.85, r: 0.2, mono: true, glide: 0.08, lpitch: 0.18, lrate: 5.5, vol: -10 }, fx: [FX('delay', { mix: 0.18 })] },
  { name: '칩튠', kind: 'polysynth', tags: ['리드'], p: { w1: 'square', l1: 0.8, l2: 0, ft: 'lp12', cut: 14000, res: 0, fenv: 0, a: 0.001, d: 0.1, s: 0.7, r: 0.05, vol: -14 } },
  { name: '브라스', kind: 'polysynth', tags: ['리드'], p: { w1: 'sawtooth', w2: 'sawtooth', d2: 5, ft: 'lp12', cut: 700, res: 0.18, fenv: 0.45, fa: 0.07, fd: 0.5, fs: 0.45, fr: 0.3, a: 0.04, d: 0.4, s: 0.85, r: 0.25, vel: 0.6, vol: -10 } },
  { name: '노이즈 스윕', kind: 'polysynth', tags: ['FX'], p: { l1: 0, l2: 0, nz: 1, ft: 'bp', cut: 500, res: 0.45, fenv: 1, fa: 3, fd: 1, fs: 1, fr: 1, a: 1.2, s: 1, r: 1.5, vol: 0 }, fx: [FX('reverb', { mix: 0.4 })] },
  { name: '보컬 아', kind: 'sampler', tags: ['보컬'], data: { sample: 'gen:vox-a' }, p: { root: 57, loop: true, lstart: 0.4, end: 0.95, a: 0.05, s: 1, r: 0.35, vol: -6 }, fx: [FX('reverb', { mix: 0.3 })] },
  { name: '보컬 오', kind: 'sampler', tags: ['보컬'], data: { sample: 'gen:vox-o' }, p: { root: 57, loop: true, lstart: 0.4, end: 0.95, a: 0.05, s: 1, r: 0.35, vol: -6 }, fx: [FX('reverb', { mix: 0.3 })] },
  { name: '보컬 찹', kind: 'sampler', tags: ['보컬'], data: { sample: 'gen:vox-chops' }, p: { mode: 'slice', slices: 8, a: 0.003, s: 1, r: 0.05, vol: -6 }, fx: [FX('delay', { mix: 0.18 })] },
  { name: '빈 샘플러', kind: 'sampler', tags: ['샘플러'], p: {} }
];
/* 전자음악용 사운드 (뒤에 붙여서 앞 번호는 그대로) */
SOUNDS.push(
  { name: '리스 베이스', kind: 'polysynth', tags: ['베이스'], p: { w1: 'sawtooth', w2: 'sawtooth', o2: 0, d1: -18, d2: 18, l1: 0.8, l2: 0.8, ft: 'lp24', cut: 650, res: 0.18, fenv: 0.12, fa: 0.01, fd: 0.6, fs: 0.5, a: 0.008, d: 0.5, s: 1, r: 0.18, lfilt: 0.12, lrate: 0.35, mono: true, glide: 0.05, vel: 0.3, vol: -9 }, fx: [FX('chorus', { mix: 0.3, rate: 0.3, depth: 0.6 }), FX('sat', { type: 'soft', drive: 6, out: -5 })] },
  { name: '808 베이스', kind: 'polysynth', tags: ['베이스'], p: { w1: 'sine', w2: 'triangle', o2: 0, d2: 0, l1: 1, l2: 0.15, ft: 'lp12', cut: 1200, res: 0, fenv: 0, a: 0.003, d: 2.2, s: 0.25, r: 0.5, mono: true, glide: 0.08, vel: 0.3, vol: -4 }, fx: [FX('sat', { type: 'tube', drive: 9, out: -7, mix: 0.6 })] },
  { name: '후버', kind: 'polysynth', tags: ['리드'], p: { w1: 'sawtooth', w2: 'sawtooth', o2: -1, d1: -24, d2: 24, l1: 0.8, l2: 0.6, ft: 'lp24', cut: 3200, res: 0.12, fenv: 0.1, a: 0.01, d: 0.4, s: 0.9, r: 0.3, lpitch: 0.12, lrate: 5.5, mono: true, glide: 0.12, vol: -12 }, fx: [FX('chorus', { mix: 0.55, depth: 0.75, rate: 0.5 })] },
  { name: '퓨처 베이스 코드', kind: 'polysynth', tags: ['코드'], p: { w1: 'sawtooth', w2: 'sawtooth', d1: -14, d2: 14, l1: 0.75, l2: 0.75, ft: 'lp24', cut: 3800, res: 0.1, fenv: 0.28, fa: 0.002, fd: 0.35, fs: 0.45, fr: 0.2, a: 0.004, d: 0.4, s: 0.85, r: 0.22, vel: 0.4, vol: -14 }, fx: [FX('duck', { div: '1/4', depth: 0.85, rel: 0.2 }), FX('chorus', { mix: 0.35 }), FX('reverb', { mix: 0.22, decay: 2.4 })] },
  { name: '신스 스탭', kind: 'polysynth', tags: ['코드'], p: { w1: 'sawtooth', w2: 'square', o2: 1, d2: 3, l1: 0.8, l2: 0.35, ft: 'lp12', cut: 1500, res: 0.22, fenv: 0.5, fa: 0.001, fd: 0.16, fs: 0, fr: 0.12, a: 0.001, d: 0.28, s: 0, r: 0.18, vel: 0.5, vol: -11 }, fx: [FX('delay', { mix: 0.16, divl: '1/8D' }), FX('reverb', { mix: 0.18 })] },
  { name: '로파이 건반', kind: 'fm', tags: ['키'], p: { algo: 'para', cw: 'sine', cr: 1, ar: 1, al: 0.25, aa: 0.002, ad: 1.2, as: 0.1, arl: 0.4, br: 14, bl: 0.06, bd: 0.08, bs: 0, a: 0.004, d: 2, s: 0.2, r: 0.5, cut: 5200, vel: 0.6, vol: -9 }, fx: [FX('chorus', { mode: 'vibrato', rate: 0.9, depth: 0.18 }), FX('sat', { type: 'crush', bits: 10, drive: 2, out: -3, mix: 0.35 }), FX('eq', { b6on: true, b6f: 6500 })] }
);
/* 진짜 악기 소리 (Acoustic · Ensemble). 이름이 장치 칸의 악기 버튼 이름과 같으면 버튼과 함께 표시된다 */
const AC = (name, tags, p, fx) => ({ name, kind: 'acoustic', tags, p, fx });
const EN = (name, tags, p, fx) => ({ name, kind: 'ensemble', tags, p, fx });
const ROOM = (mix, decay) => FX('reverb', { mix, decay: decay || 1.8 });
SOUNDS.push(
  AC('그랜드 피아노', ['피아노'], { inst: 'grand' }, [ROOM(0.18, 2.2)]),
  AC('업라이트 피아노', ['피아노'], { inst: 'upright' }, [ROOM(0.12, 1.4)]),
  AC('하우스 피아노', ['피아노', '하우스'], { inst: 'grand', tone: 0.8, decay: 0.7, body: 0.3 }, [FX('eq', { b1on: true, b1f: 160 }), FX('comp', { thr: -22, ratio: 3, att: 0.005, rel: 0.12, makeup: -5 }), ROOM(0.2, 1.8)]),
  AC('로파이 피아노', ['피아노', '로파이'], { inst: 'upright', tone: 0.3, decay: 0.8 }, [FX('chorus', { mode: 'vibrato', rate: 0.8, depth: 0.15 }), FX('sat', { type: 'crush', bits: 10, drive: 2, out: -3, mix: 0.3 }), FX('eq', { b6on: true, b6f: 5000 })]),
  AC('나일론 기타', ['기타'], { inst: 'nylon' }, [ROOM(0.15)]),
  AC('통기타', ['기타'], { inst: 'steel' }, [ROOM(0.12)]),
  AC('일렉 기타', ['기타'], { inst: 'electric' }, [FX('chorus', { mix: 0.3, rate: 0.6 }), ROOM(0.15)]),
  AC('크런치 기타', ['기타'], { inst: 'electric', tone: 0.6 }, [FX('sat', { type: 'tube', drive: 16, out: -11 }), FX('eq', { b1on: true, b1f: 100, b6on: true, b6f: 6500 }), ROOM(0.12)]),
  AC('뮤트 기타', ['기타'], { inst: 'mute' }, [ROOM(0.1, 1.2)]),
  AC('베이스 기타', ['베이스'], { inst: 'bass' }),
  EN('현악 합주', ['현악'], { inst: 'strings' }, [ROOM(0.3, 3)]),
  EN('바이올린', ['현악'], { inst: 'violin' }, [ROOM(0.25, 2.5)]),
  EN('첼로', ['현악'], { inst: 'cello' }, [ROOM(0.25, 2.5)]),
  AC('피치카토 현', ['현악'], { inst: 'pizz' }, [ROOM(0.25, 2.5)]),
  AC('하프', ['현악'], { inst: 'harp' }, [ROOM(0.3, 3)]),
  EN('브라스 섹션', ['관악'], { inst: 'brass' }, [ROOM(0.18, 2)]),
  EN('트럼펫', ['관악'], { inst: 'trumpet' }, [ROOM(0.18, 2)]),
  EN('플루트', ['관악'], { inst: 'flute' }, [ROOM(0.25, 2.5)]),
  EN('클라리넷', ['관악'], { inst: 'clarinet' }, [ROOM(0.2, 2)]),
  AC('마림바', ['말렛·벨'], { inst: 'marimba' }, [ROOM(0.15)]),
  AC('비브라폰', ['말렛·벨'], { inst: 'vibes' }, [ROOM(0.2, 2.5)]),
  AC('글로켄슈필', ['말렛·벨'], { inst: 'glock' }, [ROOM(0.25, 2.5)]),
  AC('오르골', ['말렛·벨'], { inst: 'musicbox' }, [ROOM(0.3, 3)]),
  AC('종', ['말렛·벨'], { inst: 'bell' }, [ROOM(0.3, 4)]),
  EN('재즈 오르간', ['오르간'], { inst: 'organ_jazz' }, [ROOM(0.12)]),
  EN('록 오르간', ['오르간'], { inst: 'organ_rock' }, [ROOM(0.15)]),
  EN('교회 오르간', ['오르간'], { inst: 'organ_church' }, [ROOM(0.4, 5)]),
  EN('아코디언', ['오르간'], { inst: 'accordion' }, [ROOM(0.12)]),
  EN('하모니카', ['오르간'], { inst: 'harmonica' }, [ROOM(0.15)]),
  EN('콰이어 아', ['콰이어'], { inst: 'choir_a' }, [ROOM(0.35, 3.5)]),
  EN('콰이어 우', ['콰이어'], { inst: 'choir_u' }, [ROOM(0.35, 3.5)]),
  AC('가야금', ['월드'], { inst: 'gayageum' }, [ROOM(0.2, 2.2)]),
  AC('칼림바', ['월드'], { inst: 'kalimba' }, [ROOM(0.2)]),
  AC('스틸 드럼', ['월드'], { inst: 'steeldrum' }, [ROOM(0.15)])
);
U.SOUNDS = SOUNDS;
U.sound = name => SOUNDS.find(x => x.name === name) || SOUNDS[0];
/* 묶음(첫 태그) 순서. 브라우저와 소리 고르기 창이 이 순서로 보여 준다 */
const GROUP_ORDER = ['피아노', '키', '기타', '베이스', '현악', '관악', '말렛·벨', '오르간', '콰이어', '월드', '패드', '코드', '플럭', '리드', '보컬', 'FX', '샘플러'];
U.soundGroups = list => {
  const groups = new Map();
  for (const s of list || SOUNDS) {
    if (!groups.has(s.tags[0])) groups.set(s.tags[0], []);
    groups.get(s.tags[0]).push(s);
  }
  const rank = g => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? GROUP_ORDER.length : i; };
  return [...groups].sort((a, b) => rank(a[0]) - rank(b[0]));
};

/* ================= 이펙트 프리셋 ================= */
const FX_PRESETS = {
  eq: [['기본', {}], ['로우 컷', { b1on: true, b1f: 120 }], ['보컬 선명하게', { b1on: true, b1f: 100, b4g: 3, b4f: 3000, b5g: 2, b5f: 10000 }], ['어둡게', { b6on: true, b6f: 2800, b5g: -3 }], ['킥 단단하게', { b2g: 4, b2f: 70, b3g: -4, b3f: 350, b4g: 3, b4f: 3500 }]],
  comp: [['기본', {}], ['드럼 글루', { thr: -20, ratio: 2.5, att: 0.03, rel: 0.2, makeup: 3 }], ['보컬', { thr: -24, ratio: 4, att: 0.005, rel: 0.12, makeup: 6 }], ['병렬 압축', { thr: -35, ratio: 10, att: 0.002, rel: 0.1, makeup: 10, mix: 0.4 }]],
  reverb: [['기본', {}], ['작은 방', { decay: 0.8, size: 0.3, damp: 8000, mix: 0.25 }], ['홀', { decay: 3.5, size: 0.85, damp: 5500, pre: 0.03 }], ['플레이트', { decay: 2, pre: 0.01, damp: 9000, size: 0.5 }], ['끝없는 공간', { decay: 14, size: 1, damp: 3000, mix: 0.45 }]],
  delay: [['기본 (점8분 핑퐁)', {}], ['덥 딜레이', { mode: 'stereo', divl: '1/4D', divr: '1/4', fb: 0.68, lp: 2200, hp: 300, mix: 0.3 }], ['슬랩백', { mode: 'stereo', sync: false, tl: 0.09, tr: 0.11, fb: 0.1, mix: 0.25 }], ['1/16 리듬', { divl: '1/16', fb: 0.5, mix: 0.2 }]],
  autofilter: [['기본', {}], ['와블 1/8', { ft: 'lp24', cut: 300, res: 0.5, lamt: 0.8, ldiv: '1/8', drive: 6 }], ['느린 스윕', { cut: 600, lamt: 0.6, ldiv: '1/1', res: 0.4 }], ['하이패스 빌드', { ft: 'hp12', cut: 80, res: 0.35 }]],
  sat: [['따뜻하게', {}], ['테이프', { type: 'tube', drive: 9, out: -6 }], ['디스토션', { type: 'hard', drive: 24, out: -12 }], ['비트 크러시', { type: 'crush', bits: 5, drive: 3, out: -6 }], ['웨이브 폴드', { type: 'fold', drive: 12, out: -8, mix: 0.7 }]],
  chorus: [['기본', {}], ['넓은 코러스', { depth: 0.8, rate: 0.5, width: 1, mix: 0.6 }], ['플랜저', { mode: 'flanger', fb: 0.6, rate: 0.2, depth: 0.7 }], ['비브라토', { mode: 'vibrato', rate: 5.5, depth: 0.3 }]],
  phaser: [['기본', {}], ['느린 페이저', { rate: 0.12, depth: 0.85, fb: 0.6 }]],
  utility: [['기본', {}], ['모노', { mono: true }], ['넓게 150%', { width: 1.5 }], ['-6 dB', { gain: -6 }]],
  limiter: [['기본', {}], ['마스터 크게', { gain: 6, ceil: -0.3 }]],
  duck: [['1/4 펌핑', {}], ['1/8 빠른 펌핑', { div: '1/8', depth: 0.6, rel: 0.1 }], ['부드럽게', { depth: 0.45, rel: 0.35 }]],
  spectrum: [['기본', {}]],
  arp: [['기본 (업 1/16)', {}], ['업다운 2옥타브', { style: 'updown', oct: 2 }], ['랜덤 1/8', { style: 'random', rate: '1/8', gate: 0.8 }], ['컨버지 1/16T', { style: 'converge', rate: '1/16T' }]],
  chord: [['스케일 3화음', {}], ['스케일 7화음', { s3: 6 }], ['파워 코드', { sc: false, s1: 7, s2: 12 }], ['옥타브 겹치기', { sc: false, s1: 12, s2: 0 }]],
  scale: [['현재 키 따라가기', {}], ['C 메이저 펜타토닉', { cur: false, root: 0, scale: 'majpent' }]],
  velocity: [['휴머나이즈', { rnd: 14 }], ['부드럽게', { lo: 50, hi: 100 }], ['꽉 차게', { lo: 100, hi: 127 }]]
};
U.FX_PRESETS = FX_PRESETS;

/* ================= 내장 샘플 ================= */
const H = (type, b, v, o, pan) => [type, b, v, o, pan];
function seq(type, steps, every, vel, o, pan) {
  const out = [];
  steps.split('').forEach((c, i) => { if (c !== '.' && c !== ' ') out.push(H(type, i * every, c === 'x' ? vel : vel * 0.55, o, pan)); });
  return out;
}
const K909 = { tune: 2, decay: 0.32, tone: 0.75 };
/* 로봇 보컬 16음절 (A 마이너 펜타토닉). 패드 이름은 음절을 한글로 */
const ROBOT = [['ha', 57, '하'], ['me', 60, '메'], ['do', 62, '도'], ['ki', 64, '키'], ['ro', 57, '로'], ['bo', 55, '보'], ['tu', 60, '투'], ['ne', 57, '네'],
  ['sa', 64, '사'], ['yo', 67, '요'], ['mi', 62, '미'], ['da', 60, '다'], ['wa', 57, '와'], ['ke', 55, '케'], ['no', 52, '노'], ['ha', 57, '하~', 52]];
const GEN = {
  'loop-break': { name: '브레이크 루프 96', cat: 'loop', bpm: 96, beats: 8, render: sr => U.media.renderHits(sr, 96, 8, [
    ...seq('kick', 'x.......x.x.....x.......x..x....', 0.25, 1, { tune: -1, decay: 0.4, tone: 0.5 }),
    ...seq('snare', '....x..o.o..x.......x..o....x..o', 0.25, 0.9, { tune: 2, decay: 0.35, tone: 0.6 }),
    ...seq('chh', 'x.x.x.x.x.x.xox.x.x.x.x.x.x.x.xo', 0.25, 0.5, { decay: 0.25, tone: 0.5 }, 0.2),
    H('ohh', 7.5, 0.4, { decay: 0.35 }, 0.2), H('crash', 0, 0.35, { decay: 0.6 }, -0.3)
  ], { crunch: 1.6 }) },
  'loop-house': { name: '하우스 루프 124', cat: 'loop', bpm: 124, beats: 4, render: sr => U.media.renderHits(sr, 124, 4, [
    ...seq('kick', 'x...x...x...x...', 0.25, 1, K909),
    ...seq('clap', '....x.......x...', 0.25, 0.8, { decay: 0.4 }),
    ...seq('ohh', '..x...x...x...x.', 0.25, 0.55, { decay: 0.35, tone: 0.75 }, 0.15),
    ...seq('shaker', 'oxoxoxoxoxoxoxox', 0.25, 0.35, { decay: 0.3 }, -0.3)
  ]) },
  'loop-boombap': { name: '붐뱁 루프 90', cat: 'loop', bpm: 90, beats: 8, render: sr => U.media.renderHits(sr, 90, 8, [
    ...seq('kick', 'x......x..x.....x.x.......x.....', 0.25, 1, { tune: -3, decay: 0.5, tone: 0.15 }),
    ...seq('snare', '....x.......x.......x.......x...', 0.25, 0.85, { tune: -4, decay: 0.42, tone: 0.45 }),
    ...seq('chh', 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', 0.25, 0.4, { tune: -4, decay: 0.28, tone: 0.2 }, 0.25)
  ], { crunch: 2.2 }) },
  'loop-perc': { name: '퍼커션 루프 110', cat: 'loop', bpm: 110, beats: 4, render: sr => U.media.renderHits(sr, 110, 4, [
    ...seq('conga', 'x..o..x.o.x..o..', 0.25, 0.8, { tune: 0 }, -0.4),
    ...seq('conga', '...x.....x...x.o', 0.25, 0.7, { tune: 5 }, 0.4),
    ...seq('rim', '..x....x..x.....', 0.25, 0.5, {}, 0.1),
    ...seq('shaker', 'xoooxoooxoooxooo', 0.25, 0.4, {}, -0.1),
    ...seq('cow', '......x.......x.', 0.25, 0.35, {}, 0.3)
  ]) },
  'loop-bass': { name: '베이스 루프 120 (Am)', cat: 'loop', bpm: 120, beats: 8, render: sr => U.media.renderInstrument(sr, 120, 8, 'polysynth', SOUNDS[4].p,
    [45, 45, 57, 45, 48, 45, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47].map((p, i) => ({ p, s: i * 0.5, d: 0.3, v: i % 2 ? 90 : 120 })), 0.3) },
  'loop-chords': { name: '코드 루프 100 (C)', cat: 'loop', bpm: 100, beats: 16, render: sr => U.media.renderInstrument(sr, 100, 16, 'polysynth', SOUNDS[0].p,
    [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]].flatMap((ch, i) => ch.map(p => ({ p, s: i * 4, d: 3.9, v: 90 }))), 2) },
  'vox-a': { name: '보컬 아 (A2)', cat: 'vox', render: sr => U.media.renderVowels(sr, ['a'], 1.8, 57) },
  'vox-o': { name: '보컬 오 (A2)', cat: 'vox', render: sr => U.media.renderVowels(sr, ['o'], 1.8, 57) },
  'vox-chops': { name: '보컬 찹 8조각', cat: 'vox', render: sr => U.media.renderVowels(sr, ['a', 'o0', 'e3', 'a5', 'i7', 'o5', 'u3', 'a0'], 0.36, 57) },
  'vox-robot': { name: '로봇 보컬 16음절', cat: 'vox', render: sr => U.media.renderRobot(sr, ROBOT.map(([s, p, , end]) => [s, p, end]), 0.32) },
  'fx-riser': { name: '노이즈 라이저', cat: 'fx', dur: 4, render: sr => U.media.renderFx(sr, 'riser') },
  'fx-down': { name: '다운리프터', cat: 'fx', dur: 4, render: sr => U.media.renderFx(sr, 'down') },
  'fx-impact': { name: '임팩트', cat: 'fx', dur: 3, render: sr => U.media.renderFx(sr, 'impact') }
};
const ONESHOTS = [['kick', '킥 909', K909], ['kick', '킥 808', { decay: 0.8, tone: 0.25 }], ['snare', '스네어', { tune: 3, tone: 0.7 }], ['clap', '클랩', {}],
  ['chh', '닫힌 하이햇', { tone: 0.6 }], ['ohh', '열린 하이햇', { tone: 0.6 }], ['crash', '크래시', {}], ['sub', '808 서브', { decay: 0.7 }], ['rim', '림샷', {}], ['cow', '카우벨', {}], ['zap', '잽', {}], ['conga', '콩가', {}]];
for (const [type, name, o] of ONESHOTS) {
  GEN['os-' + name] = { name, cat: 'oneshot', render: sr => U.renderDrum(type, Object.assign({ tune: 0, decay: 0.5, tone: 0.5 }, o), sr) };
}
U.GEN = GEN;

/* ================= 루프 패드 키트 =================
   패드 0이 왼쪽 아래. 찹 키트는 원본 하나를 16조각으로 나누고, 루프 팩은 패드마다 다른 샘플을 쓴다 */
const LKEYS = U.PAD_LAYOUTS[0].keys;
const chops = (names, o) => names.map((name, i) => U.lpad(Object.assign({ name, key: LKEYS[i], start: i / 16, end: (i + 1) / 16 }, o)));
const own = (name, ref, o) => Object.assign({ name, sample: 'gen:' + ref, start: 0, end: 1 }, o);
const loopPad = (beats, o) => Object.assign({ mode: 'toggle', sync: true, beats }, o);
const LOOPKITS = [
  { id: 'lp-robot', name: '로봇 보컬 찹', tags: ['보컬 찹'], info: '기계 목소리 16음절을 한 음절씩 패드에 나눴어요. 같은 초크 그룹이라 새로 친 음절이 앞 음절을 끊어요.',
    src: 'gen:vox-robot', pads: chops(ROBOT.map(x => x[2]), { choke: 1 }) },
  { id: 'lp-break', name: '브레이크 찹', tags: ['드럼 찹'], info: '브레이크 루프 두 마디를 8분음표 16조각으로 잘랐어요. 순서를 바꿔 치면 새 비트가 돼요.',
    src: 'gen:loop-break', pads: chops(['킥 크래시', '햇', '스네어', '햇 고스트', '킥 고스트', '킥', '스네어', '햇', '킥', '햇', '스네어', '햇 고스트', '킥', '햇 킥', '스네어', '오픈햇'], { choke: 1 }) },
  { id: 'lp-loops', name: '루프 팩', tags: ['루프'], info: '아래 두 줄은 원샷, 위 두 줄은 켜고 끄는 루프예요. 루프는 템포에 맞춰 늘고 줄며 마디 첫 박에 맞춰 시작해요.',
    src: null, p: { q: '1bar' }, pads: [
      own('킥', 'os-킥 909'), own('스네어', 'os-스네어'), own('클랩', 'os-클랩'), own('하이햇', 'os-닫힌 하이햇'),
      own('808 서브', 'os-808 서브'), own('임팩트', 'fx-impact'), own('라이저', 'fx-riser', { mode: 'hold' }), own('다운리프터', 'fx-down'),
      own('브레이크', 'loop-break', loopPad(8, { choke: 1, gain: -2 })), own('하우스', 'loop-house', loopPad(4, { choke: 1, gain: -2 })),
      own('붐뱁', 'loop-boombap', loopPad(8, { choke: 1, gain: -2 })), own('퍼커션', 'loop-perc', loopPad(4, { gain: -4 })),
      own('베이스', 'loop-bass', loopPad(8, { gain: -3 })), own('코드', 'loop-chords', loopPad(16, { gain: -5 })),
      own('보컬 아', 'vox-a', { mode: 'loop', start: 0.25, end: 0.75, choke: 3 }), own('보컬 오', 'vox-o', { mode: 'loop', start: 0.25, end: 0.75, choke: 3 })
    ].map((o, i) => U.lpad(Object.assign({ key: LKEYS[i] }, o))) }
];
function loopKitData(k) { return { src: k.src || null, pads: U.clone(k.pads), sel: 0 }; }
function loopKitDevice(k) {
  const d = U.makeDevice('looppad', { p: k.p, data: loopKitData(k) });
  d.preset = k.name;
  return d;
}
U.LOOPKITS = LOOPKITS;
U.DEFAULT_LOOPKIT = LOOPKITS[0];
U.loopKitData = loopKitData;
U.loopKitDevice = loopKitDevice;

/* ================= 클립 템플릿 =================
   멜로디는 스케일 도수로 적어 두고, 넣을 때 프로젝트 키에 맞춘다 */
function drum(rows, every, len) {
  const MAP = { k: 36, r: 37, s: 38, c: 39, n: 40, h: 42, t: 43, z: 44, o: 46, b: 47, g: 48, x: 49, d: 41, i: 45, y: 51, u: 50 };
  const notes = [];
  for (const [k, str] of Object.entries(rows)) {
    str.replace(/\s/g, '').split('').forEach((c, i) => {
      if (c === '.') return;
      notes.push({ p: MAP[k], s: i * every, d: every * 0.9, v: c === 'X' ? 120 : c === 'x' ? 100 : 60 });
    });
  }
  return { len, notes };
}
const CLIPS = [
  { name: '하우스 4비트', cat: '드럼', make: () => drum({ k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.', z: 'oooooooooooooooo' }, 0.25, 4) },
  { name: '브레이크비트', cat: '드럼', make: () => drum({ k: 'x.........x.....x..x......x.....', s: '....x.......x.......x..o....x..o', h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.xox.' }, 0.25, 8) },
  { name: '붐뱁', cat: '드럼', make: () => drum({ k: 'x......x..x.....x.x.......x.....', s: '....x.......x.......x.......x...', h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' }, 0.25, 8) },
  { name: '트랩 하이햇', cat: '드럼', make: () => {
    const c = drum({ k: 'x.......x.x.....x.........x.....', c: '........x...............x.......', u: 'x.......x.......x.........x.....' }, 0.25, 8);
    for (let i = 0; i < 32; i++) {
      if (i === 14 || i === 30) { for (let j = 0; j < 3; j++) c.notes.push({ p: 42, s: i * 0.25 + j / 12, d: 1 / 14, v: 70 + j * 10 }); continue; }
      c.notes.push({ p: 42, s: i * 0.25, d: 0.2, v: i % 2 ? 70 : 100 });
    }
    return c;
  } },
  { name: '레게톤', cat: '드럼', make: () => drum({ k: 'x...x...x...x...', s: '...x..x....x..x.', h: 'x.x.x.x.x.x.x.x.' }, 0.25, 4) },
  { name: '드럼 필', cat: '드럼', make: () => drum({ k: 'x.......x.......', s: '....x...xxxxXXXX', g: '..........x.....', t: '............x.x.', d: '.............x.x', h: 'x.x.x.x.........' }, 0.25, 4) },
  { name: '루트 8분 베이스', cat: '베이스', make: k => degNotes(k, 36, [0, 0, 0, 0, 0, 0, 7, 0, -2, -2, -2, -2, 3, 3, 4, 4].map((d, i) => [d, i * 0.5, 0.42, i % 2 ? 90 : 115]), 8) },
  { name: '오프비트 베이스', cat: '베이스', make: k => degNotes(k, 36, [[0, 0.5], [0, 1.5], [0, 2.5], [0, 3.5], [5, 4.5], [5, 5.5], [3, 6.5], [4, 7.5]].map(([d, s]) => [d, s, 0.4, 110]), 8) },
  { name: '옥타브 바운스', cat: '베이스', make: k => degNotes(k, 36, Array.from({ length: 16 }, (_, i) => [i % 2 ? 7 : 0, i * 0.25, 0.2, i % 2 ? 80 : 120]), 4) },
  { name: 'I–V–vi–IV (팝)', cat: '코드', make: k => chords(k, [0, 4, 5, 3], 4) },
  { name: 'vi–IV–I–V', cat: '코드', make: k => chords(k, [5, 3, 0, 4], 4) },
  { name: 'ii–V–I (7화음)', cat: '코드', make: k => chords(k, [1, 4, 0, 0], 4, true) },
  { name: 'i–VI–III–VII (마이너)', cat: '코드', make: k => chords(k, [0, 5, 2, 6], 4) },
  { name: '아르페지오 업', cat: '멜로디', make: k => degNotes(k, 60, [0, 2, 4, 7, 9, 7, 4, 2].flatMap((d, i) => [[d, i * 0.5, 0.45, 100]]), 4) },
  { name: '펜타토닉 리프', cat: '멜로디', make: k => degNotes(k, 60, [[0, 0, 0.75], [2, 0.75, 0.25], [4, 1, 0.5], [3, 1.5, 0.5], [2, 2, 1], [0, 3, 0.5], [-1, 3.5, 0.5]].map(([d, s, l]) => [d, s, l, 100]), 4) },
  { name: '코드 스탭', cat: '멜로디', make: k => {
    const out = [];
    [[0, 0.5], [0, 1.25], [5, 2.5], [3, 3.25]].forEach(([d, s]) => [0, 2, 4].forEach(x => out.push([d + x, s, 0.25, 105])));
    return degNotes(k, 60, out, 4);
  } }
];
function degNotes(key, base, list, len) {
  return { len, notes: list.map(([d, s, dur, v]) => ({ p: U.degreeToPitch(d, key.root, key.scale, base), s, d: dur, v })) };
}
function chords(key, roots, each, seventh) {
  const notes = [];
  roots.forEach((r, i) => {
    const tones = seventh ? [0, 2, 4, 6] : [0, 2, 4];
    for (const t of tones) notes.push({ p: U.degreeToPitch(r + t, key.root, key.scale, 57), s: i * each, d: each - 0.05, v: 92 });
  });
  return { len: roots.length * each, notes };
}
U.CLIPS = CLIPS;
U.drumPattern = drum;

/* 사운드 프리셋을 장치 배열로 */
function soundDevices(s) {
  const devs = [U.makeDevice(s.kind, { p: s.p, data: s.data })];
  devs[0].preset = s.name;
  for (const f of s.fx || []) devs.push(U.makeDevice(f.kind, { p: f.p }));
  // 악기와 그 이펙트를 한 묶음으로: 나중에 소리를 바꾸면 이 이펙트도 함께 빠진다
  const grp = U.uid('g');
  for (const d of devs) d.grp = grp;
  return devs;
}
function kitDevice(k) {
  const d = U.makeDevice('drums', { data: { pads: U.clone(k.pads), sel: 0 } });
  d.preset = k.name;
  return d;
}
U.soundDevices = soundDevices;
U.kitDevice = kitDevice;

/* ================= 데모 곡 ================= */
function n(p, s, d, v) { return { p, s, d, v: v || 100 }; }
function rep(notes, len, times) {
  const out = [];
  for (let i = 0; i < times; i++) for (const x of notes) out.push(Object.assign({}, x, { s: x.s + i * len }));
  return out;
}
function demoProject() {
  const pr = U.newProject('새벽 네 시');
  pr.bpm = 122;
  pr.key = { root: 9, scale: 'minor' };
  pr.swing = 0.12;
  pr.tracks = [];
  pr.scenes = ['인트로', '벌스', '빌드업', '드롭', '브레이크', '아웃트로', '', ''].map(name => Object.assign(U.newScene(), { name }));
  pr.returns[0].devices[0].p.decay = 2.8;

  // 1 드럼
  const dr = U.addTrack(pr, 'midi', null, { name: '드럼', color: 1, devices: [U.kitDevice(KITS[0])] });
  dr.devices.push(U.makeDevice('comp', { p: { thr: -16, ratio: 3, att: 0.02, rel: 0.15, makeup: 2 } }));
  const intro = drum({ k: 'x...x...x...x...', h: '..x...x...x...x.', z: 'o.o.o.o.o.o.o.o.' }, 0.25, 4);
  const groove = drum({ k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.', z: 'oooooooooooooooo', r: '.......o......o.' }, 0.25, 4);
  const fill = drum({ k: 'x...x...x...x...x...x...x...x.x.', c: '....x.......x.......x...........', h: '..x...x...x...x...x...x.........', s: '........................xoxoxXxX', z: 'oooooooooooooooooooooooooooooooo' }, 0.25, 8);
  const drop = drum({ k: 'x...x...x...x...x...x...x...x...', c: '....x.......x.......x.......x...', o: '..x...x...x...x...x...x...x...x.', h: 'x.o.x.o.x.o.x.o.x.o.x.o.x.o.x.o.', g: '......x.......x.....x.......x.o.', x: 'x...............................' }, 0.25, 8);
  const brk = drum({ h: '..x...x...x...x.', c: '....x.......x...', z: 'oooooooooooooooo' }, 0.25, 4);
  const mk = (t, d, name) => U.newMidiClip(d.len, { name, color: t.color, notes: d.notes });
  dr.slots = [mk(dr, intro, '킥 & 햇'), mk(dr, groove, '그루브'), mk(dr, fill, '필인'), mk(dr, drop, '드롭'), mk(dr, brk, '브레이크'), mk(dr, intro, '킥 & 햇'), null, null];
  dr.sends = [-30, U.OFF_DB];
  dr.vol = -6;

  // 2 베이스: Am – F – C – G, 마디마다 근음
  const ba = U.addTrack(pr, 'midi', null, { name: '베이스', color: 0, devices: U.soundDevices(SOUNDS[3]) });
  ba.devices[0].p.vol = -2;
  ba.devices.push(U.makeDevice('duck', { p: { depth: 0.55, rel: 0.16 } }));
  const roots = [45, 41, 48, 43];
  const bassA = [], bassB = [];
  roots.forEach((r, i) => {
    for (let k = 0; k < 4; k++) bassA.push(n(r, i * 4 + k + 0.5, 0.42, 110));
    for (let k = 0; k < 8; k++) bassB.push(n(k % 4 === 3 ? r + 12 : r, i * 4 + k * 0.5, k % 2 ? 0.2 : 0.4, k % 2 ? 85 : 118));
  });
  ba.slots = [null, U.newMidiClip(16, { name: '베이스 A', color: ba.color, notes: bassA }), U.newMidiClip(16, { name: '베이스 A', color: ba.color, notes: bassA.slice() }),
    U.newMidiClip(16, { name: '베이스 B', color: ba.color, notes: bassB }), null, null, null, null];

  // 3 패드
  const pd = U.addTrack(pr, 'midi', null, { name: '패드', color: 8, devices: U.soundDevices(SOUNDS[0]) });
  const voic = [[57, 60, 64, 69], [57, 60, 65, 69], [55, 60, 64, 67], [55, 59, 62, 67]];
  const padNotes = voic.flatMap((ch, i) => ch.map(p => n(p, i * 4, 3.95, 86)));
  const padClip = () => U.newMidiClip(16, { name: 'Am–F–C–G', color: pd.color, notes: padNotes.map(x => Object.assign({}, x)) });
  pd.slots = [padClip(), padClip(), padClip(), padClip(), padClip(), padClip(), null, null];
  pd.sends = [-14, U.OFF_DB];
  pd.vol = -4;

  // 4 플럭 + 아르페지에이터
  const pl = U.addTrack(pr, 'midi', null, { name: '플럭 아르페', color: 5, devices: [U.makeDevice('arp', { p: { style: 'updown', rate: '1/16', gate: 0.55, oct: 2 } })].concat(U.soundDevices(SOUNDS[7])) });
  const arpNotes = [[69, 72, 76], [69, 72, 77], [67, 72, 76], [67, 71, 74]].flatMap((ch, i) => ch.map(p => n(p, i * 4, 3.9, 96)));
  pl.slots = [null, null, U.newMidiClip(16, { name: '아르페', color: pl.color, notes: arpNotes }), U.newMidiClip(16, { name: '아르페', color: pl.color, notes: arpNotes.map(x => Object.assign({}, x)) }), null, null, null, null];
  pl.sends = [-18, -10];
  pl.vol = 2;

  // 5 키 (전자 피아노 스탭)
  const ky = U.addTrack(pr, 'midi', null, { name: '키', color: 10, devices: U.soundDevices(SOUNDS[9]) });
  const stab = [];
  voic.forEach((ch, i) => { for (const s of [0.75, 2.5]) for (const p of ch.slice(1)) stab.push(n(p + 12, i * 4 + s, 0.35, 92)); });
  ky.slots = [null, U.newMidiClip(16, { name: '스탭', color: ky.color, notes: stab }), null, U.newMidiClip(16, { name: '스탭', color: ky.color, notes: stab.map(x => Object.assign({}, x)) }),
    U.newMidiClip(16, { name: '스탭', color: ky.color, notes: stab.map(x => Object.assign({}, x)) }), null, null, null];
  ky.sends = [-16, -20];
  ky.vol = -5;

  // 6 브레이크 루프 (오디오, 96 BPM → 122 BPM 워프)
  const br = U.addTrack(pr, 'audio', null, { name: '브레이크 루프', color: 3 });
  const brInfo = U.media.info('gen:loop-break');
  const brClip = () => U.newAudioClip('gen:loop-break', brInfo, { name: '브레이크 96', color: br.color });
  br.slots = [null, null, null, brClip(), null, null, null, null];
  br.vol = -9;
  br.devices.push(U.makeDevice('eq', { p: { b1on: true, b1f: 180 } }));

  // 7 로봇 보컬 (루프 패드: 음절 하나가 패드 하나, C1부터)
  const vx = U.addTrack(pr, 'midi', null, { name: '로봇 보컬', color: 11, devices: [loopKitDevice(LOOPKITS[0])] });
  const hit = (list, d) => list.map(([i, s]) => n(36 + i, s, d, 104));
  const robotA = hit([[0, 0], [1, 0.5], [2, 1], [3, 1.5], [4, 2.5], [5, 3], [8, 4], [9, 4.5], [10, 5], [11, 5.5], [12, 6.5], [15, 7]], 0.45);
  const robotB = hit([[0, 0], [0, 0.25], [0, 0.5], [1, 1], [2, 1.5], [3, 2], [3, 2.25], [4, 2.5], [5, 3.5], [8, 4], [8, 4.25], [8, 4.5], [9, 5], [10, 5.5], [11, 6], [11, 6.25], [12, 6.5], [15, 7]], 0.22);
  vx.slots = [null, null, U.newMidiClip(8, { name: '로봇 찹', color: vx.color, notes: robotA }), U.newMidiClip(8, { name: '로봇 스터터', color: vx.color, notes: robotB }), null, null, null, null];
  vx.sends = [-12, -14];
  vx.vol = -3;

  // 마스터
  pr.master.devices.push(U.makeDevice('limiter', { p: { gain: 3, ceil: -0.5 } }));

  // 어레인지먼트 (32마디)
  const put = (t, clip, bar, bars) => t.arr.push({ id: U.uid('a'), pos: bar * 4, dur: bars * 4, off: 0, clip: U.cloneClip(clip) });
  put(dr, dr.slots[0], 0, 8); put(dr, dr.slots[1], 8, 8); put(dr, dr.slots[2], 16, 4); put(dr, dr.slots[3], 20, 8); put(dr, dr.slots[0], 28, 4);
  put(ba, ba.slots[1], 8, 12); put(ba, ba.slots[3], 20, 8);
  put(pd, pd.slots[0], 0, 32);
  put(pl, pl.slots[2], 16, 12);
  put(ky, ky.slots[1], 8, 8); put(ky, ky.slots[3], 20, 8);
  put(br, br.slots[3], 20, 8);
  put(vx, vx.slots[2], 16, 4); put(vx, vx.slots[3], 24, 4);
  // 자동화: 패드 볼륨 페이드 인/아웃, 빌드업에서 패드 필터 열기
  pd.auto.vol = [{ t: 0, v: 0.3 }, { t: 16, v: U.dbToPos(0) }, { t: 112, v: U.dbToPos(0) }, { t: 128, v: 0.2 }];
  const padSynth = pd.devices[0];
  const cutSpec = U.DEV.polysynth.byId.cut;
  pd.auto['dev:' + padSynth.id + ':cut'] = [{ t: 0, v: U.toNorm(cutSpec, 500) }, { t: 64, v: U.toNorm(cutSpec, 900) }, { t: 80, v: U.toNorm(cutSpec, 4200) }, { t: 112, v: U.toNorm(cutSpec, 1100) }];
  pr.loop = { on: false, start: 64, end: 96 };
  return pr;
}
U.demoProject = demoProject;
})(window.U = window.U || {});
