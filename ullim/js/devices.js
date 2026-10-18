/* 울림 — 장치(악기·이펙트) 정의: 파라미터 범위, 기본값, 화면 배치, 설명 */
(function (U) {
'use strict';

/* ================= 파라미터 도구 ================= */
function num(id, label, min, max, def, o) { return Object.assign({ id, label, min, max, def, curve: 'lin' }, o); }
function en(id, label, options, def, o) { return Object.assign({ id, label, type: 'enum', options, def }, o); }
function bool(id, label, def, o) { return Object.assign({ id, label, type: 'bool', def }, o); }
const hz = (id, label, min, max, def, o) => num(id, label, min, max, def, Object.assign({ unit: 'Hz', curve: 'log' }, o));
const sec = (id, label, min, max, def, o) => num(id, label, min, max, def, Object.assign({ unit: 's', curve: 'pow3' }, o));
const db = (id, label, min, max, def, o) => num(id, label, min, max, def, Object.assign({ unit: 'dB' }, o));
const pct = (id, label, def, o) => num(id, label, 0, 1, def, Object.assign({ unit: '%' }, o));
const mix = (def = 1) => pct('mix', 'Dry/Wet', def, { info: '원래 소리와 효과가 걸린 소리의 비율. 100%면 효과 소리만 나요.' });

const WAVES = [['sawtooth', 'Saw'], ['square', 'Square'], ['triangle', 'Tri'], ['sine', 'Sine']];
const LFO_WAVES = [['sine', 'Sine'], ['triangle', 'Tri'], ['square', 'Square'], ['sawtooth', 'Saw']];
const FTYPES = [['lp12', 'LP12'], ['lp24', 'LP24'], ['hp12', 'HP12'], ['bp', 'BP']];
const DIVS = U.SYNC_DIVS.map(d => [d.id, d.id]);
const ARP_DIVS = ['1/4', '1/8', '1/8T', '1/16', '1/16T', '1/32'].map(x => [x, x]);

function toNorm(s, v) {
  if (s.type === 'bool') return v ? 1 : 0;
  if (s.type === 'enum') { const i = s.options.findIndex(o => o[0] === v); return s.options.length > 1 ? Math.max(0, i) / (s.options.length - 1) : 0; }
  const r = s.max - s.min;
  const x = U.clamp(v, s.min, s.max);
  switch (s.curve) {
    case 'log': return Math.log(x / s.min) / Math.log(s.max / s.min);
    case 'pow2': return Math.sqrt((x - s.min) / r);
    case 'pow3': return Math.cbrt((x - s.min) / r);
    default: return (x - s.min) / r;
  }
}
function fromNorm(s, n) {
  n = U.clamp(n, 0, 1);
  if (s.type === 'bool') return n >= 0.5;
  if (s.type === 'enum') return s.options[Math.round(n * (s.options.length - 1))][0];
  let v;
  switch (s.curve) {
    case 'log': v = s.min * Math.pow(s.max / s.min, n); break;
    case 'pow2': v = s.min + (s.max - s.min) * n * n; break;
    case 'pow3': v = s.min + (s.max - s.min) * n * n * n; break;
    default: v = s.min + (s.max - s.min) * n;
  }
  if (s.step) v = Math.round(v / s.step) * s.step;
  return U.clamp(v, s.min, s.max);
}
function fmtParam(s, v) {
  if (s.fmt) return s.fmt(v);
  if (s.type === 'bool') return v ? 'On' : 'Off';
  if (s.type === 'enum') { const o = s.options.find(x => x[0] === v); return o ? o[1] : String(v); }
  switch (s.unit) {
    case 'Hz': return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + ' kHz' : (v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)) + ' Hz';
    case 's': return v < 1 ? (v * 1000).toFixed(v < 0.01 ? 1 : 0) + ' ms' : v.toFixed(2) + ' s';
    case 'dB': return v <= -69.9 ? '-∞ dB' : (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
    case '%': return Math.round(v * 100) + ' %';
    case 'st': return (v > 0 ? '+' : '') + Math.round(v) + ' st';
    case 'ct': return (v > 0 ? '+' : '') + Math.round(v) + ' ct';
    case 'x': return v.toFixed(v < 10 ? 2 : 1);
    case 'ratio': return v.toFixed(1) + ':1';
    case 'oct': return (v > 0 ? '+' : '') + Math.round(v);
    case 'pan': return Math.abs(v) < 0.005 ? 'C' : Math.round(Math.abs(v) * 50) + (v < 0 ? 'L' : 'R');
    case 'note': return U.noteName(Math.round(v));
    case 'key': return U.ROOT_NAMES[((Math.round(v) % 12) + 12) % 12];
    case 'bip': return (v > 0 ? '+' : '') + Math.round(v * 100) + ' %';
    default: return s.step && s.step >= 1 ? String(Math.round(v)) : (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
  }
}

/* ================= 장치 목록 ================= */
const DEV = {};
function def(kind, o) {
  o.kind = kind;
  o.byId = Object.fromEntries(o.params.map(p => [p.id, p]));
  DEV[kind] = o;
}
/* ids: [어택, 디케이, 서스테인, 릴리스] 파라미터 이름 */
const ENV = (ids, title, d) => [
  sec(ids[0], 'Attack', 0.001, 10, d[0], { info: title + '이 0에서 최고점까지 올라가는 시간' }),
  sec(ids[1], 'Decay', 0.001, 10, d[1], { info: title + '이 최고점에서 서스테인 높이까지 내려오는 시간' }),
  pct(ids[2], 'Sustain', d[2], { info: '건반을 누르고 있는 동안 유지되는 ' + title + ' 높이' }),
  sec(ids[3], 'Release', 0.001, 10, d[3], { info: '건반을 뗀 뒤 ' + title + '이 0으로 사라지는 시간' })
];
const AMP = ['a', 'd', 's', 'r'];

/* ---------- 악기 ---------- */
def('polysynth', {
  name: 'Poly Synth', type: 'instrument',
  info: '오실레이터 두 개와 필터, 엔벌로프, LFO로 만드는 아날로그 방식 신스예요. 패드·베이스·리드 모두 잘 어울려요.',
  params: [
    en('w1', 'Wave', WAVES, 'sawtooth', { info: '오실레이터 1의 파형. Saw는 밝고 꽉 찬 소리, Sine은 둥글고 순한 소리예요.' }),
    num('o1', 'Octave', -3, 3, 0, { step: 1, unit: 'oct', info: '오실레이터 1을 옥타브 단위로 올리거나 내려요.' }),
    num('d1', 'Detune', -50, 50, 0, { unit: 'ct', info: '오실레이터 1의 음을 센트(반음의 1/100) 단위로 살짝 비틀어요.' }),
    pct('l1', 'Level', 0.8, { info: '오실레이터 1의 음량' }),
    en('w2', 'Wave', WAVES, 'sawtooth', { info: '오실레이터 2의 파형' }),
    num('o2', 'Octave', -3, 3, 0, { step: 1, unit: 'oct', info: '오실레이터 2를 옥타브 단위로 옮겨요.' }),
    num('s2', 'Semi', -12, 12, 0, { step: 1, unit: 'st', info: '오실레이터 2를 반음 단위로 옮겨요. 7이면 완전5도 위예요.' }),
    num('d2', 'Detune', -50, 50, 7, { unit: 'ct', info: '오실레이터 2를 살짝 어긋나게 해서 소리를 두껍게 만들어요.' }),
    pct('l2', 'Level', 0.6, { info: '오실레이터 2의 음량' }),
    pct('nz', 'Noise', 0, { info: '화이트 노이즈를 섞어요. 숨소리나 바람 같은 질감이 생겨요.' }),
    en('ft', 'Type', FTYPES, 'lp24', { info: '필터 종류. LP는 높은 소리를 깎고, HP는 낮은 소리를 깎고, BP는 가운데만 남겨요.' }),
    hz('cut', 'Freq', 30, 20000, 2400, { info: '필터가 걸리기 시작하는 주파수(컷오프). 낮출수록 소리가 어두워져요.' }),
    pct('res', 'Res', 0.15, { info: '컷오프 근처를 강조하는 레조넌스. 올리면 "뾰옹" 하는 특유의 소리가 나요.' }),
    num('fenv', 'Env Amt', -1, 1, 0.3, { unit: 'bip', info: '필터 엔벌로프가 컷오프를 얼마나 움직일지. 음수면 반대 방향으로 움직여요.' }),
    pct('fkey', 'Key Trk', 0.5, { info: '높은 음일수록 컷오프를 올려서 음역마다 밝기를 고르게 맞춰요.' }),
    ...ENV(['fa', 'fd', 'fs', 'fr'], '필터 엔벌로프', [0.005, 0.4, 0.3, 0.4]),
    ...ENV(AMP, '음량', [0.005, 0.3, 0.7, 0.25]),
    en('lw', 'Wave', LFO_WAVES, 'sine', { info: 'LFO(느린 진동기)의 파형' }),
    hz('lrate', 'Rate', 0.05, 20, 4, { info: 'LFO가 1초에 몇 번 흔들리는지' }),
    pct('lpitch', 'Pitch', 0, { info: 'LFO로 음높이를 흔들어 비브라토를 만들어요 (최대 ±1반음).' }),
    pct('lfilt', 'Filter', 0, { info: 'LFO로 컷오프를 흔들어 와우 효과를 만들어요 (최대 ±2옥타브).' }),
    pct('lamp', 'Amp', 0, { info: 'LFO로 음량을 흔들어 트레몰로를 만들어요.' }),
    bool('mono', 'Mono', false, { info: '켜면 한 번에 한 음만 나요. 베이스나 리드에 좋아요.' }),
    sec('glide', 'Glide', 0, 1, 0.04, { curve: 'pow2', info: '모노일 때 앞 음에서 다음 음으로 미끄러지는 시간' }),
    pct('vel', 'Vel', 0.5, { info: '세게 친 음(벨로시티)일수록 크게 나는 정도' }),
    db('vol', 'Volume', -36, 6, -6, { info: '악기 출력 음량' })
  ],
  layout: [
    { title: 'Osc 1', params: ['w1', 'o1', 'd1', 'l1'] },
    { title: 'Osc 2', params: ['w2', 'o2', 's2', 'd2', 'l2'] },
    { title: 'Filter', visual: 'filter', params: ['ft', 'cut', 'res', 'fenv', 'fkey'] },
    { title: 'Filter Env', visual: 'adsr:f', params: ['fa', 'fd', 'fs', 'fr'] },
    { title: 'Amp Env', visual: 'adsr', params: ['a', 'd', 's', 'r'] },
    { title: 'LFO', params: ['lw', 'lrate', 'lpitch', 'lfilt', 'lamp'] },
    { title: 'Voice', params: ['nz', 'mono', 'glide', 'vel', 'vol'] }
  ]
});

const RATIO = (id, label, d, info) => num(id, label, 0.5, 16, d, { step: 0.5, unit: 'x', curve: 'pow2', info });
def('fm', {
  name: 'FM Synth', type: 'instrument',
  info: '오퍼레이터끼리 주파수를 흔들어(FM) 소리를 만드는 신스예요. 전자 피아노, 종소리, 단단한 베이스가 잘 나와요.',
  params: [
    en('algo', 'Algo', [['para', 'A+B→C'], ['stack', 'B→A→C'], ['dual', 'A→C + B']], 'para', { info: '오퍼레이터 연결 방식. 화살표는 왼쪽이 오른쪽을 흔든다는 뜻이에요.' }),
    en('cw', 'Wave', WAVES, 'sine', { info: '캐리어(실제로 들리는 오퍼레이터)의 파형' }),
    RATIO('cr', 'Ratio', 1, '캐리어 주파수 배율. 1이면 친 음 그대로예요.'),
    RATIO('ar', 'Ratio', 1, '모듈레이터 A의 주파수 배율. 정수면 맑고, 소수면 금속성 소리가 나요.'),
    pct('al', 'Amount', 0.35, { info: '모듈레이터 A가 캐리어를 흔드는 세기. 올리면 배음이 많아져요.' }),
    ...ENV(['aa', 'ad', 'as', 'arl'], '모듈레이터 A 세기', [0.002, 0.9, 0.15, 0.4]),
    RATIO('br', 'Ratio', 14, '모듈레이터 B의 주파수 배율'),
    pct('bl', 'Amount', 0.12, { info: '모듈레이터 B의 세기' }),
    ...ENV(['ba', 'bd', 'bs', 'brl'], '모듈레이터 B 세기', [0.001, 0.12, 0, 0.1]),
    ...ENV(AMP, '음량', [0.002, 1.6, 0.25, 0.5]),
    hz('cut', 'Filter', 30, 20000, 20000, { info: '출력 로우패스 필터. 낮추면 부드러워져요.' }),
    pct('res', 'Res', 0, { info: '필터 레조넌스' }),
    pct('vel', 'Vel', 0.6, { info: '벨로시티에 따라 음량과 밝기가 달라지는 정도' }),
    db('vol', 'Volume', -36, 6, -6, { info: '악기 출력 음량' })
  ],
  layout: [
    { title: 'Carrier', visual: 'algo', params: ['algo', 'cw', 'cr'] },
    { title: 'Mod A', params: ['ar', 'al', 'aa', 'ad', 'as', 'arl'] },
    { title: 'Mod B', params: ['br', 'bl', 'ba', 'bd', 'bs', 'brl'] },
    { title: 'Amp Env', visual: 'adsr', params: ['a', 'd', 's', 'r'] },
    { title: 'Out', params: ['cut', 'res', 'vel', 'vol'] }
  ]
});

def('drums', {
  name: 'Drum Machine', type: 'instrument',
  info: '패드 16개짜리 드럼 머신이에요. 패드마다 합성 드럼 소리나 오디오 샘플을 넣을 수 있고, C1부터 반음씩 패드가 이어져요.',
  params: [db('vol', 'Volume', -36, 6, 0, { info: '드럼 머신 전체 음량' })],
  layout: [{ visual: 'pads' }, { title: 'Out', params: ['vol'] }]
});

def('sampler', {
  name: 'Sampler', type: 'instrument',
  info: '오디오 샘플 하나를 건반으로 연주하는 악기예요. 샘플을 끌어다 놓으면 음높이에 맞춰 재생하고, Slice 모드로 잘게 나눠 칠 수도 있어요.',
  params: [
    en('mode', 'Mode', [['classic', 'Classic'], ['oneshot', '1-Shot'], ['slice', 'Slice']], 'classic', { info: 'Classic: 건반 음높이대로 연주 · 1-Shot: 건반을 떼도 끝까지 재생 · Slice: 샘플을 여러 조각으로 나눠 C1부터 하나씩 배치' }),
    pct('start', 'Start', 0, { info: '샘플에서 재생을 시작할 위치' }),
    pct('end', 'End', 1, { info: '샘플에서 재생을 끝낼 위치' }),
    bool('loop', 'Loop', false, { info: '건반을 누르고 있는 동안 루프 구간을 반복해요.' }),
    pct('lstart', 'Loop Pos', 0.5, { info: '루프가 시작되는 위치 (끝은 End와 같아요)' }),
    num('slices', 'Slices', 2, 32, 8, { step: 1, info: 'Slice 모드에서 샘플을 몇 조각으로 나눌지' }),
    num('root', 'Root', 24, 96, 60, { step: 1, unit: 'note', info: '이 음을 치면 샘플이 원래 높이로 나와요.' }),
    num('tune', 'Transp', -24, 24, 0, { step: 1, unit: 'st', info: '반음 단위로 음높이를 옮겨요.' }),
    num('fine', 'Detune', -50, 50, 0, { unit: 'ct', info: '센트 단위 미세 조정' }),
    ...ENV(AMP, '음량', [0.002, 0.3, 1, 0.12]),
    bool('fon', 'Filter', false, { info: '필터를 켜요.' }),
    en('ft', 'Type', FTYPES, 'lp12', { info: '필터 종류' }),
    hz('cut', 'Freq', 30, 20000, 6000, { info: '필터 컷오프' }),
    pct('res', 'Res', 0.1, { info: '필터 레조넌스' }),
    pct('vel', 'Vel', 0.5, { info: '벨로시티에 따른 음량 변화' }),
    db('vol', 'Volume', -36, 6, -3, { info: '악기 출력 음량' })
  ],
  layout: [
    { title: 'Sample', visual: 'sample', params: ['mode', 'start', 'end', 'loop', 'lstart', 'slices'] },
    { title: 'Pitch', params: ['root', 'tune', 'fine'] },
    { title: 'Amp Env', visual: 'adsr', params: ['a', 'd', 's', 'r'] },
    { title: 'Filter', visual: 'filter', params: ['fon', 'ft', 'cut', 'res'] },
    { title: 'Out', params: ['vel', 'vol'] }
  ]
});

def('looppad', {
  name: 'Loop Pad', type: 'instrument',
  info: '패드 16개로 샘플 조각(찹)이나 루프를 두드려 연주해요. MPC처럼 보컬을 잘게 잘라 손가락으로 치거나, 루프를 켜고 끄며 곡을 쌓아요. 패드마다 컴퓨터 키보드 글자를 정할 수 있어요.',
  params: [
    en('q', 'Launch', [['none', '바로'], ['1/16', '1/16'], ['1/8', '1/8'], ['1/4', '1/4'], ['1bar', '1마디']], 'none', { info: '반복·켜고 끄기 패드를 손으로 칠 때 다음 박자 경계까지 기다렸다가 시작하고 멈춰요. 재생 중일 때만 맞춰요. 원샷 패드는 늘 바로 울려요.' }),
    sec('rel', 'Release', 0.003, 2, 0.03, { info: '누르는 동안·반복 패드에서 손을 뗐을 때 소리가 사라지는 시간' }),
    pct('vel', 'Vel', 0.4, { info: '세게 칠수록 크게 나는 정도. 0%면 늘 같은 크기예요.' }),
    db('vol', 'Volume', -36, 6, 0, { info: '루프 패드 전체 음량' })
  ],
  layout: [{ visual: 'looppads' }, { title: 'Out', params: ['q', 'rel', 'vel', 'vol'] }]
});

/* ---------- 오디오 이펙트 ---------- */
const EQT =[['hp', 'Low Cut'], ['ls', 'Low Shelf'], ['pk', 'Bell'], ['notch', 'Notch'], ['hs', 'High Shelf'], ['lp', 'High Cut']];
const EQ_DEF = [
  [false, 'hp', 40, 0, 0.71], [true, 'ls', 110, 0, 0.71], [true, 'pk', 400, 0, 1],
  [true, 'pk', 2200, 0, 1], [true, 'hs', 8000, 0, 0.71], [false, 'lp', 16000, 0, 0.71]
];
def('eq', {
  name: 'EQ Six', type: 'audio',
  info: '6밴드 이퀄라이저. 그래프의 점을 끌어 주파수와 크기를 바꾸고, 휠로 폭(Q)을 바꿔요. 더블클릭하면 그 밴드를 켜고 꺼요.',
  params: [].concat(...EQ_DEF.map((d, i) => {
    const n = i + 1;
    return [
      bool('b' + n + 'on', n + ' On', d[0], { info: n + '번 밴드를 켜고 꺼요.' }),
      en('b' + n + 't', n + ' Type', EQT, d[1], { info: '필터 모양: Low/High Cut은 한쪽을 잘라내고, Shelf는 한쪽을 통째로 올리거나 내리고, Bell은 한 지점만 올리거나 내려요.' }),
      hz('b' + n + 'f', n + ' Freq', 20, 20000, d[2], { info: '밴드의 중심(또는 경계) 주파수' }),
      db('b' + n + 'g', n + ' Gain', -18, 18, d[3], { info: '밴드를 올리거나 내리는 양' }),
      num('b' + n + 'q', n + ' Q', 0.1, 12, d[4], { curve: 'log', unit: 'x', info: '밴드 폭. 클수록 좁고 날카로워요.' })
    ];
  }), [db('gain', 'Output', -18, 18, 0, { info: 'EQ를 지난 뒤의 음량' })]),
  layout: [{ visual: 'eq' }]
});

def('comp', {
  name: 'Compressor', type: 'audio',
  info: '큰 소리를 눌러서 음량 차이를 줄여요. 소리가 단단하고 앞으로 나와요.',
  params: [
    db('thr', 'Thresh', -60, 0, -18, { info: '이 크기를 넘는 소리부터 눌러요.' }),
    num('ratio', 'Ratio', 1, 20, 4, { curve: 'log', unit: 'ratio', info: '넘친 소리를 얼마나 세게 누를지. 4:1이면 넘친 양을 1/4로 줄여요.' }),
    sec('att', 'Attack', 0.0005, 0.25, 0.01, { curve: 'log', info: '소리가 넘친 뒤 누르기 시작하기까지의 시간. 길면 타격감이 살아요.' }),
    sec('rel', 'Release', 0.01, 1.5, 0.15, { curve: 'log', info: '누르던 힘을 푸는 시간' }),
    db('knee', 'Knee', 0, 30, 6, { info: '누르기 시작하는 경계를 부드럽게 만드는 폭' }),
    db('makeup', 'Makeup', -12, 24, 0, { info: '눌러서 작아진 음량을 다시 올려요.' }),
    mix(1)
  ],
  layout: [{ visual: 'comp', params: ['thr', 'ratio', 'knee'] }, { params: ['att', 'rel'] }, { params: ['makeup', 'mix'] }]
});

def('reverb', {
  name: 'Reverb', type: 'audio',
  info: '방이나 홀에서 소리가 울리는 느낌을 더해요. 보통 리턴 트랙에 두고 센드로 보내 써요.',
  params: [
    sec('pre', 'Predelay', 0, 0.25, 0.02, { curve: 'pow2', info: '원래 소리 뒤에 잔향이 시작되기까지의 시간' }),
    pct('size', 'Size', 0.6, { info: '공간 크기. 초기 반사음이 퍼지는 정도가 달라져요.' }),
    num('decay', 'Decay', 0.2, 20, 2.2, { unit: 's', curve: 'log', info: '잔향이 60dB 줄어들 때까지의 시간' }),
    hz('damp', 'Hi Cut', 800, 20000, 6500, { info: '잔향의 높은 소리를 깎아요. 낮출수록 따뜻해져요.' }),
    hz('lowcut', 'Lo Cut', 20, 1000, 140, { info: '잔향의 낮은 소리를 깎아 웅웅거림을 줄여요.' }),
    mix(0.3)
  ],
  layout: [{ params: ['pre', 'size'] }, { params: ['decay', 'damp', 'lowcut'] }, { params: ['mix'] }]
});

def('delay', {
  name: 'Delay', type: 'audio',
  info: '소리를 일정 시간 뒤에 메아리처럼 되풀이해요. 템포에 맞추거나(Sync) 밀리초로 정할 수 있어요.',
  params: [
    en('mode', 'Mode', [['ping', 'Ping-Pong'], ['stereo', 'Stereo']], 'ping', { info: 'Ping-Pong은 메아리가 왼쪽과 오른쪽을 번갈아 튀어요.' }),
    bool('sync', 'Sync', true, { info: '켜면 지연 시간을 박자에 맞춰요.' }),
    en('divl', 'Left', DIVS, '1/8D', { info: '왼쪽 메아리 간격 (박자)', show: p => p.sync }),
    en('divr', 'Right', DIVS, '1/4', { info: '오른쪽 메아리 간격 (박자)', show: p => p.sync && p.mode === 'stereo' }),
    sec('tl', 'Left', 0.001, 2, 0.3, { curve: 'log', info: '왼쪽 메아리 간격 (시간)', show: p => !p.sync }),
    sec('tr', 'Right', 0.001, 2, 0.45, { curve: 'log', info: '오른쪽 메아리 간격 (시간)', show: p => !p.sync && p.mode === 'stereo' }),
    pct('fb', 'Feedback', 0.4, { max: 0.95, info: '메아리가 다시 메아리를 만드는 양. 높이면 오래 남아요.' }),
    hz('hp', 'Lo Cut', 20, 2000, 180, { info: '메아리의 낮은 소리를 깎아요.' }),
    hz('lp', 'Hi Cut', 500, 20000, 6500, { info: '메아리의 높은 소리를 깎아요. 테이프 딜레이 같은 느낌이 나요.' }),
    mix(0.25)
  ],
  layout: [{ params: ['mode', 'sync'] }, { params: ['divl', 'tl', 'divr', 'tr'] }, { title: 'Feedback', params: ['fb', 'hp', 'lp'] }, { params: ['mix'] }]
});

def('autofilter', {
  name: 'Auto Filter', type: 'audio',
  info: '필터와 LFO로 소리를 깎고 움직여요. 빌드업의 필터 스윕이나 덥스텝 워블을 만들 때 써요.',
  params: [
    en('ft', 'Type', [['lp12', 'LP12'], ['lp24', 'LP24'], ['hp12', 'HP'], ['bp', 'BP'], ['notch', 'Notch']], 'lp24', { info: '필터 종류' }),
    hz('cut', 'Freq', 30, 20000, 1400, { info: '필터 컷오프. 자동화로 움직이면 스윕이 돼요.' }),
    pct('res', 'Res', 0.3, { info: '컷오프 근처 강조' }),
    db('drive', 'Drive', 0, 24, 0, { info: '필터 앞에서 소리를 세게 밀어 넣어 따뜻하게 일그러뜨려요.' }),
    pct('lamt', 'LFO Amt', 0, { info: 'LFO가 컷오프를 흔드는 양 (최대 ±3옥타브)' }),
    en('lw', 'Shape', LFO_WAVES, 'sine', { info: 'LFO 파형' }),
    bool('lsync', 'Sync', true, { info: '켜면 LFO 속도를 박자에 맞춰요.' }),
    en('ldiv', 'Rate', DIVS, '1/4', { info: 'LFO 한 번의 길이 (박자)', show: p => p.lsync }),
    hz('lrate', 'Rate', 0.05, 20, 1, { info: 'LFO 속도', show: p => !p.lsync })
  ],
  layout: [{ title: 'Filter', visual: 'filter', params: ['ft', 'cut', 'res', 'drive'] }, { title: 'LFO', params: ['lamt', 'lw', 'lsync', 'ldiv', 'lrate'] }]
});

def('sat', {
  name: 'Saturator', type: 'audio',
  info: '소리를 일부러 일그러뜨려 배음과 힘을 더해요. 살짝 쓰면 따뜻하고, 세게 쓰면 거칠어져요.',
  params: [
    en('type', 'Curve', [['soft', 'Soft'], ['tube', 'Tube'], ['hard', 'Hard'], ['fold', 'Fold'], ['crush', 'Bit Crush']], 'soft', { info: '일그러뜨리는 방식. Bit Crush는 옛날 게임기처럼 거친 디지털 소리를 내요.' }),
    db('drive', 'Drive', 0, 36, 6, { info: '얼마나 세게 밀어 넣을지' }),
    num('bits', 'Bits', 2, 16, 6, { step: 1, info: '비트 깊이. 낮을수록 거칠어요.', show: p => p.type === 'crush' }),
    db('out', 'Output', -24, 6, -4, { info: '이펙트 뒤의 음량' }),
    mix(1)
  ],
  layout: [{ visual: 'curve', params: ['type', 'drive', 'bits'] }, { params: ['out', 'mix'] }]
});

def('chorus', {
  name: 'Chorus', type: 'audio',
  info: '조금씩 어긋난 복사본을 겹쳐 소리를 넓고 두껍게 만들어요. Flanger와 Vibrato로도 바꿀 수 있어요.',
  params: [
    en('mode', 'Mode', [['chorus', 'Chorus'], ['flanger', 'Flanger'], ['vibrato', 'Vibrato']], 'chorus', { info: '효과 종류' }),
    hz('rate', 'Rate', 0.05, 8, 0.8, { info: '흔들리는 속도' }),
    pct('depth', 'Amount', 0.5, { info: '흔들리는 폭' }),
    sec('delay', 'Delay', 0.001, 0.03, 0.012, { curve: 'lin', info: '복사본이 늦게 나오는 시간' }),
    pct('fb', 'Feedback', 0, { max: 0.9, info: '되먹임. Flanger에서 올리면 쇳소리가 강해져요.' }),
    pct('width', 'Width', 1, { info: '좌우로 퍼지는 정도' }),
    mix(0.5)
  ],
  layout: [{ params: ['mode', 'rate', 'depth'] }, { params: ['delay', 'fb', 'width'] }, { params: ['mix'] }]
});

def('phaser', {
  name: 'Phaser', type: 'audio',
  info: '주파수 사이에 골을 만들고 움직여 "슈우웅" 도는 소리를 만들어요.',
  params: [
    hz('rate', 'Rate', 0.05, 8, 0.35, { info: '움직이는 속도' }),
    pct('depth', 'Amount', 0.7, { info: '움직이는 폭' }),
    hz('freq', 'Freq', 100, 5000, 800, { info: '효과가 걸리는 중심 주파수' }),
    pct('fb', 'Feedback', 0.5, { max: 0.9, info: '되먹임. 올릴수록 특징이 강해져요.' }),
    mix(0.5)
  ],
  layout: [{ params: ['rate', 'depth', 'freq'] }, { params: ['fb', 'mix'] }]
});

def('utility', {
  name: 'Utility', type: 'audio',
  info: '음량, 팬, 스테레오 폭, 모노 전환, 위상 뒤집기를 한곳에서 다뤄요.',
  params: [
    db('gain', 'Gain', -36, 36, 0, { info: '음량을 올리거나 내려요.' }),
    num('pan', 'Pan', -1, 1, 0, { unit: 'pan', info: '좌우 위치' }),
    num('width', 'Width', 0, 2, 1, { unit: '%', info: '스테레오 폭. 0%는 모노, 200%는 아주 넓게.' }),
    bool('mono', 'Mono', false, { info: '좌우를 합쳐 모노로 만들어요.' }),
    bool('invl', 'Phz-L', false, { info: '왼쪽 채널 위상을 뒤집어요.' }),
    bool('invr', 'Phz-R', false, { info: '오른쪽 채널 위상을 뒤집어요.' })
  ],
  layout: [{ params: ['gain', 'pan'] }, { params: ['width', 'mono'] }, { params: ['invl', 'invr'] }]
});

def('limiter', {
  name: 'Limiter', type: 'audio',
  info: '정해 둔 크기를 넘지 않게 꼭대기를 눌러요. 마스터 트랙 끝에 두면 소리가 찢어지는 걸 막아 줘요.',
  params: [
    db('gain', 'Gain', 0, 24, 0, { info: '리미터에 들어가기 전에 음량을 올려요. 올릴수록 전체가 커지고 단단해져요.' }),
    db('ceil', 'Ceiling', -24, 0, -0.5, { info: '출력이 넘지 않을 최고 크기' }),
    sec('rel', 'Release', 0.005, 1, 0.08, { curve: 'log', info: '누르던 힘을 푸는 시간' })
  ],
  layout: [{ visual: 'comp', params: ['gain', 'ceil', 'rel'] }]
});

def('duck', {
  name: 'Ducker', type: 'audio',
  info: '박자마다 음량을 꾹 눌렀다 풀어서 사이드체인 펌핑 효과를 만들어요. 베이스나 패드에 걸면 킥이 또렷해져요.',
  params: [
    en('div', 'Rate', [['1/2', '1/2'], ['1/4', '1/4'], ['1/8', '1/8'], ['1/16', '1/16']], '1/4', { info: '몇 박마다 누를지' }),
    pct('depth', 'Depth', 0.75, { info: '얼마나 깊게 누를지' }),
    sec('hold', 'Hold', 0, 0.2, 0.01, { curve: 'pow2', info: '눌린 채로 머무는 시간' }),
    sec('rel', 'Release', 0.02, 1, 0.2, { curve: 'log', info: '다시 원래 음량으로 돌아오는 시간' })
  ],
  layout: [{ visual: 'duck', params: ['div', 'depth', 'hold', 'rel'] }]
});

def('spectrum', {
  name: 'Spectrum', type: 'audio',
  info: '지나가는 소리의 주파수 분포를 실시간으로 보여 줘요. 소리는 바꾸지 않아요.',
  params: [],
  layout: [{ visual: 'spectrum' }]
});

/* ---------- MIDI 이펙트 ---------- */
def('arp', {
  name: 'Arpeggiator', type: 'midi',
  info: '누르고 있는 화음을 한 음씩 차례로 쪼개서 연주해요.',
  params: [
    en('style', 'Style', [['up', 'Up'], ['down', 'Down'], ['updown', 'Up-Down'], ['downup', 'Down-Up'], ['converge', 'Converge'], ['random', 'Random'], ['played', 'Played'], ['chord', 'Chord']], 'up', { info: '음을 고르는 순서' }),
    en('rate', 'Rate', ARP_DIVS, '1/16', { info: '음 하나의 간격' }),
    num('gate', 'Gate', 0.05, 2, 0.6, { unit: '%', info: '음 길이. 100%면 다음 음까지 이어져요.' }),
    num('oct', 'Octaves', 1, 4, 1, { step: 1, info: '몇 옥타브까지 넓혀 오르내릴지' }),
    bool('vfix', 'Fixed Vel', false, { info: '켜면 모든 음을 같은 세기로 연주해요.' }),
    num('vel', 'Velocity', 1, 127, 100, { step: 1, info: '고정 벨로시티 값', show: p => p.vfix })
  ],
  layout: [{ params: ['style', 'rate'] }, { params: ['gate', 'oct'] }, { params: ['vfix', 'vel'] }]
});

const SH = (n, d) => num('s' + n, 'Shift ' + n, -24, 24, d, { step: 1, info: n + '번째로 더할 음. 0이면 꺼져요.' });
def('chord', {
  name: 'Chord', type: 'midi',
  info: '한 음을 치면 정해 둔 간격의 음들을 함께 울려 화음을 만들어요. 스케일 모드를 켜면 간격이 스케일 도수가 돼요.',
  params: [bool('sc', 'In Scale', true, { info: '켜면 Shift 값을 반음이 아니라 지금 스케일의 도수로 계산해요. 2는 3도, 4는 5도예요.' }), SH(1, 2), SH(2, 4), SH(3, 0), SH(4, 0)],
  layout: [{ params: ['sc'] }, { params: ['s1', 's2', 's3', 's4'] }]
});

def('scale', {
  name: 'Scale', type: 'midi',
  info: '들어오는 음을 정해 둔 스케일 안의 가장 가까운 음으로 바꿔요. 어떤 건반을 쳐도 틀리지 않아요.',
  params: [
    bool('cur', 'Current', true, { info: '켜면 프로젝트의 키(상단 바)를 따라가요.' }),
    num('root', 'Root', 0, 11, 9, { step: 1, unit: 'key', info: '근음', show: p => !p.cur }),
    en('scale', 'Scale', U.SCALES.map(s => [s.id, s.name]), 'minor', { info: '스케일 종류', show: p => !p.cur }),
    num('trans', 'Transp', -24, 24, 0, { step: 1, unit: 'st', info: '스케일에 맞추기 전에 음을 옮겨요.' })
  ],
  layout: [{ params: ['cur', 'root', 'scale'] }, { params: ['trans'] }]
});

def('velocity', {
  name: 'Velocity', type: 'midi',
  info: '음의 세기(벨로시티)를 범위 안으로 모으거나 무작위로 흔들어 사람이 친 것처럼 만들어요.',
  params: [
    num('lo', 'Out Low', 1, 127, 1, { step: 1, info: '가장 약한 출력 세기' }),
    num('hi', 'Out Hi', 1, 127, 127, { step: 1, info: '가장 센 출력 세기' }),
    num('rnd', 'Random', 0, 64, 0, { step: 1, info: '세기를 무작위로 흔드는 폭' })
  ],
  layout: [{ params: ['lo', 'hi', 'rnd'] }]
});

/* ================= 장치 만들기 ================= */
function defaults(kind) {
  const d = DEV[kind];
  const p = {};
  for (const s of d.params) p[s.id] = s.def;
  return p;
}
/* 드럼 패드 기본값 */
const PAD_TYPES = [
  ['kick', 'Kick'], ['snare', 'Snare'], ['clap', 'Clap'], ['chh', 'Closed Hat'], ['ohh', 'Open Hat'],
  ['tom', 'Tom'], ['rim', 'Rim'], ['cow', 'Cowbell'], ['crash', 'Crash'], ['ride', 'Ride'],
  ['shaker', 'Shaker'], ['conga', 'Conga'], ['sub', '808 Sub'], ['zap', 'Zap'], ['noise', 'Noise Hit'], ['snap', 'Snap']
];
function pad(type, o) {
  const name = (PAD_TYPES.find(t => t[0] === type) || [type, type])[1];
  return Object.assign({ name, src: 'synth', type, tune: 0, decay: 0.5, tone: 0.5, level: 0, pan: 0, choke: 0, sample: null }, o);
}
/* ================= 루프 패드 ================= */
/* 패드 0이 왼쪽 아래, 16이 오른쪽 위 (MPC 배치). 키는 KeyboardEvent.code라서 한글 입력 상태에서도 같다 */
const PAD_MODES = [
  ['oneshot', '원샷', '한 번 치면 조각 끝까지 울려요. 떼도 멈추지 않아요.'],
  ['hold', '누르는 동안', '누르고 있는 동안만 울리고, 떼면 멈춰요.'],
  ['loop', '누르는 동안 반복', '누르고 있는 동안 조각을 계속 되풀이해요.'],
  ['toggle', '켜고 끄기', '한 번 치면 계속 되풀이하고, 다시 치면 멈춰요. 루프를 쌓을 때 좋아요.']
];
const PAD_LAYOUTS = [
  { id: 'left', name: '왼손 4×4 · 1234 / QWER / ASDF / ZXCV', keys: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Digit4'] },
  { id: 'right', name: '오른손 4×4 · 7890 / UIOP / JKL; / M,./', keys: ['KeyM', 'Comma', 'Period', 'Slash', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'Digit7', 'Digit8', 'Digit9', 'Digit0'] },
  { id: 'rows', name: '두 줄 · ASDFGHJK / QWERTYUI', keys: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI'] }
];
const KEY_NAMES = { Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']', Backslash: '\\', IntlBackslash: '\\', Minus: '-', Equal: '=', Backquote: '`', NumpadAdd: 'N+', NumpadSubtract: 'N-', NumpadMultiply: 'N*', NumpadDivide: 'N/', NumpadDecimal: 'N.' };
function keyLabel(code) {
  if (!code) return '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return 'N' + code.slice(6);
  return KEY_NAMES[code] || code;
}
/* 패드에 줄 수 있는 키: 글자·숫자·기호 (Space, Enter, Tab, 화살표 같은 조작 키는 뺀다) */
function padKeyOk(code) { return !!code && (/^(Key[A-Z]|Digit\d|Numpad\d)$/.test(code) || code in KEY_NAMES); }
function lpad(o) {
  return Object.assign({ name: '', key: null, sample: null, start: 0, end: 0, mode: 'oneshot', sync: false, beats: 4, tune: 0, gain: 0, pan: 0, rev: false, choke: 0 }, o);
}
/* 루프 패드 데이터를 고친다: 패드 16개, 빠진 값 채우기 */
function fixLoopPad(data) {
  data = data && typeof data === 'object' ? data : {};
  const pads = Array.isArray(data.pads) ? data.pads : [];
  data.pads = Array.from({ length: 16 }, (_, i) => lpad(pads[i] || { key: PAD_LAYOUTS[0].keys[i] }));
  if (data.src === undefined) data.src = null;
  if (data.sel == null) data.sel = 0;
  return data;
}

function makeDevice(kind, over) {
  const d = DEV[kind];
  if (!d) throw new Error('unknown device ' + kind);
  const dev = { id: U.uid('d'), kind, on: true, p: defaults(kind) };
  if (kind === 'drums') dev.data = { pads: U.DEFAULT_KIT ? U.clone(U.DEFAULT_KIT) : [], sel: 0 };
  if (kind === 'looppad') dev.data = fixLoopPad(U.DEFAULT_LOOPKIT ? U.loopKitData(U.DEFAULT_LOOPKIT) : null);
  if (kind === 'sampler') dev.data = { sample: null };
  if (kind === 'eq') dev.data = { sel: 3 };
  if (over) {
    if (over.p) Object.assign(dev.p, over.p);
    if (over.data) dev.data = Object.assign(dev.data || {}, U.clone(over.data));
    if (over.name) dev.name = over.name;
  }
  if (kind === 'looppad') fixLoopPad(dev.data);
  return dev;
}
function devName(dev) { return dev.name || (DEV[dev.kind] ? DEV[dev.kind].name : dev.kind); }
function visible(spec, p) { return !spec.show || spec.show(p); }

/* EQ 밴드 종류 → BiquadFilter 설정 */
function eqBiquad(type, q) {
  switch (type) {
    case 'hp': return { type: 'highpass', Q: 20 * Math.log10(Math.max(0.1, q)) };
    case 'lp': return { type: 'lowpass', Q: 20 * Math.log10(Math.max(0.1, q)) };
    case 'ls': return { type: 'lowshelf', Q: q };
    case 'hs': return { type: 'highshelf', Q: q };
    case 'notch': return { type: 'notch', Q: q };
    default: return { type: 'peaking', Q: q };
  }
}

Object.assign(U, {
  DEV, toNorm, fromNorm, fmtParam, defaults, makeDevice, devName, visible, PAD_TYPES, pad, eqBiquad,
  PAD_MODES, PAD_LAYOUTS, keyLabel, padKeyOk, lpad, fixLoopPad
});
})(window.U = window.U || {});
