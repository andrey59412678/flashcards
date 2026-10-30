// Horizontal road markings: the scenes, the rule behind each one and its SVG picture. No DOM here.
// Seen from above with "your" car always at the bottom driving up, the way a driver reads the road.

// mine = the line next to your lane; theirs = the line next to the oncoming lane.
export const SCENES = {
  continua: { flow: 'opostos', mine: 'continua', theirs: 'continua', double: false },
  tracejada: { flow: 'opostos', mine: 'tracejada', theirs: 'tracejada', double: false },
  'dupla-continua': { flow: 'opostos', mine: 'continua', theirs: 'continua', double: true },
  'mista-eu-continua': { flow: 'opostos', mine: 'continua', theirs: 'tracejada', double: true },
  'mista-eu-tracejada': { flow: 'opostos', mine: 'tracejada', theirs: 'continua', double: true },
  'branca-continua': { flow: 'mesmo', mine: 'continua' },
  'branca-tracejada': { flow: 'mesmo', mine: 'tracejada' },
  // Only used to illustrate bank questions, not drilled.
  transicao: { flow: 'opostos', mine: 'transicao', theirs: 'transicao', double: false },
  canalizacao: { flow: 'mesmo', mine: 'canalizacao' },
};

// Bank questions that a picture of the road explains. Shown only after the answer, since the real exam is text.
export const BANK_SCENES = {
  'bnq-1-1-190': 'dupla-continua',
  'bnq-1-1-284': 'continua',
  'bnq-1-1-285': 'dupla-continua',
  'bnq-1-1-286': 'tracejada',
  'bnq-1-1-287': 'canalizacao',
  'bnq-1-1-288': 'branca-continua',
  'bnq-1-1-289': 'branca-tracejada',
  'bnq-1-1-293': 'canalizacao',
  'bnq-1-1-294': 'canalizacao',
  'bnq-1-1-296': 'transicao',
  'bnq-1-1-299': 'canalizacao',
  'bnq-1-1-306': 'mista-eu-tracejada',
  'bnq-1-1-307': 'canalizacao',
  'bnq-2-1-17': 'dupla-continua',
  'bnq-2-1-20': 'continua',
  'bnq-2-1-22': 'canalizacao',
  'bnq-2-1-23': 'mista-eu-continua',
  'bnq-2-1-33': 'branca-tracejada',
};

// The two mixed lines are where she gets lost, so they come up twice as often.
const DRILL_POOL = ['continua', 'tracejada', 'dupla-continua', 'mista-eu-continua', 'mista-eu-continua', 'mista-eu-tracejada', 'mista-eu-tracejada', 'branca-continua', 'branca-tracejada'];

// Same wording as the exam's alternatives, including the "ambos" trap (permitida vs proibida).
export const WHO = {
  eu: 'Permitida só para o seu sentido',
  outro: 'Permitida só para o sentido oposto',
  ambos: 'Permitida para ambos os sentidos',
  ninguem: 'Proibida para ambos os sentidos',
};

export function canCross(scene, side = 'mine') {
  return SCENES[scene][side] === 'tracejada';
}

export function whoCanPass(scene) {
  const me = canCross(scene, 'mine');
  const them = canCross(scene, 'theirs');
  return me && them ? 'ambos' : me ? 'eu' : them ? 'outro' : 'ninguem';
}

const NAMES = { continua: 'contínua', tracejada: 'tracejada (seccionada)' };

// One sentence a learner can repeat to herself; always starts from her own line.
// A solid line forbids crossing for any reason (passing, U-turn, turning left), not only for passing.
export function explain(scene) {
  const { flow, mine, theirs, double } = SCENES[scene];
  if (scene === 'transicao') return 'Onde a linha contínua vira tracejada, a ultrapassagem passa a ser permitida, se for seguro.';
  if (scene === 'canalizacao') return 'Área zebrada (canalização) separa fluxos: não se circula, não se para e não se estaciona sobre ela.';
  if (flow === 'mesmo') {
    return mine === 'continua'
      ? 'Branca contínua separa faixas no mesmo sentido e proíbe trocar de faixa.'
      : 'Branca tracejada (seccionada) separa faixas no mesmo sentido e deixa trocar de faixa, se for seguro.';
  }
  if (!double) {
    return mine === 'continua'
      ? 'Uma linha amarela contínua vale para os dois lados: ninguém cruza, nem para ultrapassar nem para fazer retorno.'
      : 'Uma linha amarela tracejada (seccionada) vale para os dois lados: os dois podem ultrapassar, se for seguro.';
  }
  if (mine === theirs) return 'Duas contínuas: parede dos dois lados. Ninguém cruza, nem para ultrapassar nem para fazer retorno.';
  const verdict = side => (side === 'tracejada' ? 'pode, se for seguro' : 'não pode');
  return `Do seu lado a linha é ${NAMES[mine]}: você ${verdict(mine)}. Do lado de quem vem é ${NAMES[theirs]}: ele ${verdict(theirs)}.`;
}

export function colorRule() {
  return 'Amarela separa sentidos opostos. Branca separa faixas que vão no mesmo sentido.';
}

export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A round mixes "can you pass?", "who can pass?" (the exam's own wording) and the colour rule.
export function makeRound(size = 12, random = Math.random) {
  const scenes = [];
  let pool = [];
  while (scenes.length < size) {
    // Never the same picture twice in a row; the pool holds the mixed lines twice, so it may need topping up.
    let next = pool.findIndex(scene => scene !== scenes[scenes.length - 1]);
    if (next < 0) {
      pool.push(...shuffled(DRILL_POOL, random));
      next = pool.findIndex(scene => scene !== scenes[scenes.length - 1]);
    }
    scenes.push(...pool.splice(next, 1));
  }
  return scenes.map((scene, index) => {
    if (index % 4 === 3) return { scene, ask: 'cor' };
    if (SCENES[scene].flow === 'opostos' && random() < 0.5) return { scene, ask: 'quem' };
    return { scene, ask: 'eu' };
  });
}

export function question({ scene, ask }) {
  const { flow } = SCENES[scene];
  if (ask === 'cor') {
    return {
      prompt: 'Pela cor da linha, os carros dos dois lados dela andam…',
      options: [['opostos', 'Em sentidos opostos'], ['mesmo', 'No mesmo sentido']],
      answer: flow,
      explanation: colorRule(),
    };
  }
  if (ask === 'quem') {
    return {
      prompt: 'Cruzar a linha do meio para ultrapassar é…',
      options: Object.entries(WHO),
      answer: whoCanPass(scene),
      explanation: explain(scene),
    };
  }
  return {
    prompt: flow === 'mesmo' ? 'A linha deixa você passar para a faixa da esquerda?' : 'A linha deixa você ultrapassar o caminhão?',
    options: [['sim', 'Deixa, se for seguro'], ['nao', 'Não deixa']],
    answer: canCross(scene) ? 'sim' : 'nao',
    explanation: explain(scene),
  };
}

// ---- SVG ----

const W = 240;
const H = 320;
const YELLOW = '#f7c740';
const WHITE = '#f4f7f8';
const ME = '#5bc0eb';
const THEM = '#f2e6c9';
const DASH = '22 16';

function line(x, kind, color, y1 = 0, y2 = H) {
  const dash = kind === 'tracejada' ? ` stroke-dasharray="${DASH}"` : '';
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="4" stroke-linecap="butt"${dash}/>`;
}

function glow(x, color) {
  return `<rect class="road-glow" x="${x - 6}" y="0" width="12" height="${H}" rx="6" fill="${color}" opacity=".55"/>`;
}

function arrow(x, y, up) {
  const s = up ? 1 : -1;
  return `<path d="M${x} ${y + 14 * s}V${y - 8 * s}M${x - 6} ${y}L${x} ${y - 8 * s}L${x + 6} ${y}" stroke="${WHITE}" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function car(cx, y, up, color) {
  const w = 34;
  const h = 56;
  const x = cx - w / 2;
  const front = up ? y + 9 : y + h - 21;
  const rear = up ? y + h - 13 : y + 5;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${color}"/>`
    + `<rect x="${x + 5}" y="${front}" width="${w - 10}" height="12" rx="4" fill="#1b2a31" opacity=".75"/>`
    + `<rect x="${x + 6}" y="${rear}" width="${w - 12}" height="8" rx="3" fill="#1b2a31" opacity=".45"/></g>`;
}

function truck(cx, y) {
  const w = 42;
  return `<g><rect x="${cx - w / 2}" y="${y + 24}" width="${w}" height="70" rx="5" fill="#b9c6cc"/>`
    + `<rect x="${cx - w / 2 + 3}" y="${y}" width="${w - 6}" height="22" rx="7" fill="#8fa3ad"/>`
    + `<rect x="${cx - w / 2 + 8}" y="${y + 4}" width="${w - 16}" height="8" rx="3" fill="#1b2a31" opacity=".7"/></g>`;
}

function hatch(cx, id) {
  // A lozenge of diagonal stripes between the two lanes, outlined by solid white lines.
  const top = 70;
  const mid = 150;
  const bottom = 230;
  const half = 26;
  const outline = `M${cx} ${top}L${cx + half} ${mid}L${cx} ${bottom}L${cx - half} ${mid}Z`;
  const stripes = Array.from({ length: 14 }, (_, i) => {
    const y = top - 20 + i * 14;
    return `<line x1="${cx - half}" y1="${y + 20}" x2="${cx + half}" y2="${y - 6}" stroke="${WHITE}" stroke-width="4"/>`;
  }).join('');
  return `<clipPath id="${id}"><path d="${outline}"/></clipPath><g clip-path="url(#${id})">${stripes}</g>`
    + `<path d="${outline}" stroke="${WHITE}" stroke-width="3" fill="none"/>`;
}

// reveal: tint your line (and the oncoming driver's) in the colour of each car.
// id keeps clip paths unique when several roads share a page.
export function roadSvg(scene, { ask = 'eu', reveal = false, label = '', id = 'road' } = {}) {
  const spec = SCENES[scene];
  const left = 72;
  const right = 168;
  const center = W / 2;
  const opposite = spec.flow === 'opostos';
  const color = opposite ? YELLOW : WHITE;
  const mineX = spec.double ? center + 9 : center;
  const theirsX = spec.double ? center - 9 : center;
  const parts = [`<rect x="16" y="0" width="${W - 32}" height="${H}" rx="18" fill="#34444c"/>`, line(28, 'continua', WHITE), line(W - 28, 'continua', WHITE)];

  if (reveal && ask !== 'cor' && spec.mine !== 'canalizacao') {
    parts.push(glow(mineX, ME));
    if (opposite && spec.double) parts.push(glow(theirsX, THEM));
  }

  if (scene === 'transicao') {
    parts.push(line(center, 'continua', color, 160, H), line(center, 'tracejada', color, 0, 160));
  } else if (scene === 'canalizacao') {
    parts.push(hatch(center, `hatch-${id}`));
  } else if (spec.double) {
    parts.push(line(theirsX, spec.theirs, color), line(mineX, spec.mine, color));
  } else {
    parts.push(line(center, spec.mine, color));
  }

  // The colour question must be answered from the paint alone, so no arrows or oncoming car give it away.
  if (ask !== 'cor') parts.push(arrow(right, 196, true), arrow(left, opposite ? 140 : 196, !opposite));
  if (ask !== 'cor' && scene !== 'canalizacao') parts.push(truck(right, 64));
  // Only "who may pass" needs the oncoming car; next to the truck it would make "can you pass?" a safety call.
  if (ask === 'quem' && opposite) parts.push(car(left, 26, false, THEM));
  parts.push(car(right, 226, true, ME));
  parts.push(`<text x="${right}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="700" fill="${WHITE}">você</text>`);

  const title = label ? `<title>${label}</title>` : '';
  return `<svg class="road" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">${title}${parts.join('')}</svg>`;
}
