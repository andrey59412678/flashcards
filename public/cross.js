// "Quem passa primeiro": right of way at crossings, roundabouts and crosswalks, and which signal wins
// when two disagree (agente > semáforo > placa > regra geral). Seen from above, your car at the bottom
// driving up, like the line drill. Each scene cites the bank question that asks it. No DOM here.
import { shuffled } from './exam.js';

const OTHER_NAMES = { carro: 'O outro carro', ambulancia: 'A ambulância', pedestre: 'O pedestre', bonde: 'O bonde' };

// layout: cruz | rotatoria | rotatoria-dentro | rodovia | faixa | bonde | saida
// from: where the other one comes from (direita | esquerda | frente | anel).
export const SCENES = {
  direita: { layout: 'cruz', from: 'direita', answer: 'outro', why: 'Sem placa nem semáforo, passa quem vem pela sua direita.', source: 'bnq-1-1-8' },
  esquerda: { layout: 'cruz', from: 'esquerda', answer: 'eu', why: 'Ele vem pela sua esquerda, então você está à direita dele: você passa primeiro.', source: 'bnq-1-1-7' },
  'rotatoria-entrando': { layout: 'rotatoria', from: 'anel', answer: 'outro', why: 'Na rotatória, passa quem já está circulando nela. Quem entra espera.', source: 'bnq-1-3-102' },
  'rotatoria-dentro': { layout: 'rotatoria-dentro', from: 'direita', answer: 'eu', why: 'Você já está circulando na rotatória, então quem entra espera por você.', source: 'bnq-1-3-102' },
  rodovia: { layout: 'rodovia', from: 'esquerda', answer: 'outro', why: 'Sem sinalização, quem está na rodovia passa, mesmo vindo pela esquerda.', source: 'bnq-1-1-4' },
  'pare-seu': { layout: 'cruz', from: 'esquerda', mySign: 'pare', answer: 'outro', why: 'A placa vale mais que a regra da direita: com PARE para você, ele passa mesmo vindo pela esquerda.', source: 'bnq-1-1-270' },
  'preferencia-seu': { layout: 'cruz', from: 'esquerda', mySign: 'preferencia', answer: 'outro', why: '"Dê a preferência" é para você: deixe passar quem vem na outra via, de qualquer lado.', source: 'bnq-2-1-11' },
  'pare-dele': { layout: 'cruz', from: 'direita', theirSign: 'pare', answer: 'eu', why: 'Ele vem pela direita, mas a placa PARE é para ele, e a placa vale mais que a regra geral.', source: 'bnq-1-1-270' },
  semaforo: { layout: 'cruz', from: 'direita', myLight: 'verde', theirLight: 'vermelho', answer: 'eu', why: 'O semáforo vale mais que a regra da direita: verde para você, vermelho para ele.', source: 'bnq-1-1-270' },
  'agente-pare': { layout: 'cruz', from: null, myLight: 'verde', agent: 'pare', ask: 'acao', answer: 'parar', why: 'A ordem do agente vale mais que o semáforo: ele mandou parar, você para, mesmo no verde.', source: 'bnq-1-1-231' },
  'agente-siga': { layout: 'cruz', from: null, myLight: 'vermelho', agent: 'siga', ask: 'acao', answer: 'seguir', why: 'A ordem do agente vale mais que o semáforo: ele mandou seguir, você segue com cuidado, mesmo no vermelho.', source: 'bnq-1-1-5' },
  ambulancia: { layout: 'cruz', from: 'esquerda', who: 'ambulancia', answer: 'outro', why: 'Veículo de emergência com sirene e luzes ligadas tem preferência: reduza e deixe passar.', source: 'bnq-1-3-113' },
  pedestre: { layout: 'faixa', from: 'esquerda', who: 'pedestre', answer: 'outro', why: 'Na faixa sem semáforo, o pedestre tem preferência: pare e deixe atravessar.', source: 'bnq-1-1-6' },
  conversao: { layout: 'cruz', from: 'frente', turn: 'esquerda', answer: 'outro', why: 'Para virar à esquerda você cruza o caminho de quem vem em sentido contrário: ele segue reto e passa primeiro.', source: 'bnq-1-1-3' },
  bonde: { layout: 'bonde', from: 'direita', who: 'bonde', answer: 'outro', why: 'Veículo sobre trilhos tem preferência no cruzamento: pare e espere.', source: 'bnq-1-3-114' },
  saida: { layout: 'saida', from: 'esquerda', answer: 'outro', why: 'Quem sai de posto ou garagem espera quem já circula na via.', source: 'bnq-1-3-367' },
};

export function question(scene) {
  const spec = SCENES[scene];
  if (spec.ask === 'acao') return { type: 'choice', scene, prompt: 'O que você faz?', options: [['parar', 'Paro'], ['seguir', 'Sigo']], answer: spec.answer, why: spec.why };
  return { type: 'choice', scene, prompt: spec.layout === 'faixa' ? 'Quem passa primeiro: você ou o pedestre?' : 'Quem passa primeiro?', options: [['eu', 'Você'], ['outro', OTHER_NAMES[spec.who ?? 'carro']]], answer: spec.answer, why: spec.why };
}

// Every scene once before any repeats, and never the same picture twice in a row.
export function makeRound(size = 12, random = Math.random) {
  const keys = Object.keys(SCENES);
  const picked = [];
  let pool = [];
  while (picked.length < size) {
    if (!pool.length) pool = shuffled(keys, random);
    const next = pool.findIndex(key => key !== picked[picked.length - 1]);
    if (next === -1) { pool = shuffled(keys, random); continue; }
    picked.push(pool.splice(next, 1)[0]);
  }
  return picked.map(question);
}

// Drawing.

const S = 300;
const C = S / 2;
const ROAD = '#34444c';
const DIRT = '#5a4b3a';
const YELLOW = '#f7c740';
const WHITE = '#f4f7f8';
const ME = '#5bc0eb';
const THEM = '#f2e6c9';
const RED = '#d9483b';

// Drawn pointing up around (0, 0); angle turns it clockwise (90 = heading right).
function vehicle(x, y, angle, kind = 'carro', color = THEM) {
  const body = kind === 'bonde'
    ? `<rect x="-16" y="-58" width="32" height="116" rx="8" fill="#d7a943"/><rect x="-11" y="-50" width="22" height="12" rx="3" fill="#1b2a31" opacity=".7"/><rect x="-11" y="-28" width="22" height="56" rx="3" fill="#1b2a31" opacity=".25"/>`
    : `<rect x="-15" y="-25" width="30" height="50" rx="9" fill="${kind === 'ambulancia' ? '#f7fafb' : color}"/><rect x="-10" y="-17" width="20" height="10" rx="3" fill="#1b2a31" opacity=".75"/><rect x="-10" y="13" width="20" height="7" rx="3" fill="#1b2a31" opacity=".45"/>`;
  const extra = kind === 'ambulancia' ? '<rect x="-12" y="-6" width="24" height="5" rx="2" fill="#3d7bd9"/><path d="M0 2v14M-7 9h14" stroke="#d9483b" stroke-width="4"/>' : '';
  return `<g transform="translate(${x} ${y}) rotate(${angle})">${body}${extra}</g>`;
}

function arrow(x1, y1, x2, y2, color = WHITE) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = (a) => `${x2 - 9 * Math.cos(angle + a)} ${y2 - 9 * Math.sin(angle + a)}`;
  return `<path d="M${x1} ${y1}L${x2} ${y2}M${head(0.6)}L${x2} ${y2}L${head(-0.6)}" stroke="${color}" stroke-opacity=".7" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function dashes(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${YELLOW}" stroke-width="3" stroke-dasharray="14 10"/>`;
}

function stopSign(x, y) {
  const r = 15;
  const points = Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return `<polygon points="${points}" fill="${RED}" stroke="${WHITE}" stroke-width="2"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="9" font-weight="800" fill="${WHITE}">PARE</text>`;
}

function yieldSign(x, y) {
  return `<polygon points="${x - 16},${y - 12} ${x + 16},${y - 12} ${x},${y + 15}" fill="${WHITE}" stroke="${RED}" stroke-width="4" stroke-linejoin="round"/>`;
}

function trafficLight(x, y, lit) {
  const lamp = (cy, color, on) => `<circle cx="${x}" cy="${cy}" r="5" fill="${color}" opacity="${on ? 1 : 0.18}"/>`;
  return `<rect x="${x - 9}" y="${y - 22}" width="18" height="44" rx="5" fill="#111a1f" stroke="#5b707a"/>${lamp(y - 12, '#e5483b', lit === 'vermelho')}${lamp(y, '#f7c740', false)}${lamp(y + 12, '#43c46b', lit === 'verde')}`;
}

function agent(x, y, order) {
  const word = order === 'pare' ? 'PARE' : 'SIGA';
  const arms = order === 'pare' ? `<path d="M${x} ${y - 2}L${x + 10} ${y - 22}M${x} ${y - 2}L${x - 9} ${y + 8}" stroke="${WHITE}" stroke-width="3.5" stroke-linecap="round"/>` : `<path d="M${x} ${y - 2}L${x - 14} ${y - 10}M${x} ${y - 2}L${x + 9} ${y + 8}" stroke="${WHITE}" stroke-width="3.5" stroke-linecap="round"/>`;
  return `<g><rect x="${x - 30}" y="${y - 56}" width="60" height="22" rx="8" fill="${WHITE}"/><text x="${x}" y="${y - 40}" text-anchor="middle" font-size="12" font-weight="800" fill="#1b2a31">${word}!</text>`
    + `<circle cx="${x}" cy="${y - 12}" r="6" fill="#f7c740"/><path d="M${x} ${y - 6}V${y + 14}" stroke="${YELLOW}" stroke-width="5" stroke-linecap="round"/>${arms}</g>`;
}

function person(x, y) {
  return `<g><circle cx="${x}" cy="${y - 12}" r="5.5" fill="${THEM}"/><path d="M${x} ${y - 6}V${y + 6}M${x} ${y + 6}L${x - 6} ${y + 16}M${x} ${y + 6}L${x + 6} ${y + 16}M${x - 7} ${y - 1}L${x + 7} ${y - 1}" stroke="${THEM}" stroke-width="3" stroke-linecap="round"/></g>`;
}

function label(x, y, text, size = 12) {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${WHITE}">${text}</text>`;
}

function glow(x, y, r) {
  return `<circle class="cross-glow" cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#a6e3b8" stroke-width="4" stroke-dasharray="6 5"/>`;
}

function crossRoads() {
  return `<rect x="115" y="0" width="70" height="${S}" fill="${ROAD}"/><rect x="0" y="115" width="${S}" height="70" fill="${ROAD}"/>`
    + dashes(C, 0, C, 112) + dashes(C, 188, C, S) + dashes(0, C, 112, C) + dashes(188, C, S, C);
}

// Positions of the other one, by where it comes from (keeping to its right-hand lane).
const FROM = {
  direita: { x: 258, y: 133, angle: -90, ahead: [228, 133, 200, 133] },
  esquerda: { x: 42, y: 167, angle: 90, ahead: [72, 167, 100, 167] },
  frente: { x: 133, y: 52, angle: 180, ahead: [133, 84, 133, 108] },
};

const MY_CORNER = [212, 215];
const THEIR_CORNER = { direita: [212, 88], esquerda: [88, 212] };

// reveal: ring whoever passes first.
export function crossSvg(scene, { reveal = false, label: title = '', id = 'cross' } = {}) {
  const spec = SCENES[scene];
  const who = spec.who ?? 'carro';
  const parts = [];
  let me = [167, 248];
  let other = null;
  let myArrow = arrow(167, 216, 167, 190);

  if (spec.layout === 'cruz') {
    parts.push(crossRoads());
    if (spec.from) {
      const from = FROM[spec.from];
      other = [from.x, from.y];
      parts.push(vehicle(from.x, from.y, from.angle, who), arrow(...from.ahead));
      if (who === 'ambulancia') parts.push(`<path d="M${from.x - 8} ${from.y - 34}q8-8 16 0M${from.x - 14} ${from.y - 42}q14-12 28 0" stroke="#5bc0eb" stroke-width="2.5" fill="none" stroke-linecap="round"/>`, label(from.x, from.y + 46, 'sirene', 11));
    }
    if (spec.turn === 'esquerda') myArrow = `<path d="M167 216V170Q167 150 147 150H116" stroke="${WHITE}" stroke-opacity=".7" stroke-width="3.5" fill="none" stroke-linecap="round"/>${arrow(124, 150, 112, 150)}`;
    if (spec.mySign === 'pare') parts.push(stopSign(...MY_CORNER));
    if (spec.mySign === 'preferencia') parts.push(yieldSign(...MY_CORNER));
    if (spec.theirSign === 'pare') parts.push(stopSign(...THEIR_CORNER[spec.from]));
    if (spec.myLight) parts.push(trafficLight(MY_CORNER[0] + 4, MY_CORNER[1] + 6, spec.myLight));
    if (spec.theirLight) parts.push(trafficLight(...THEIR_CORNER[spec.from], spec.theirLight));
    if (spec.agent) parts.push(agent(C, C + 4, spec.agent));
  } else if (spec.layout === 'rotatoria' || spec.layout === 'rotatoria-dentro') {
    parts.push(`<rect x="115" y="0" width="70" height="${S}" fill="${ROAD}"/><rect x="0" y="115" width="${S}" height="70" fill="${ROAD}"/><circle cx="${C}" cy="${C}" r="88" fill="${ROAD}"/><circle cx="${C}" cy="${C}" r="40" fill="#2f5d3a" stroke="${WHITE}" stroke-width="3"/>`);
    // Brazilian roundabouts turn anticlockwise seen from above; two arrows on the ring show it.
    parts.push(arrow(C - 64, C - 10, C - 64, C + 14), arrow(C - 10, C - 64, C - 34, C - 60));
    if (spec.layout === 'rotatoria') {
      me = [167, 262];
      myArrow = arrow(167, 232, 167, 214);
      other = [105, 195];
      parts.push(vehicle(105, 195, 135, who));
    } else {
      me = [196, 198];
      myArrow = '';
      other = [262, 133];
      parts.push(vehicle(262, 133, -90, who), arrow(236, 133, 214, 133));
    }
  } else if (spec.layout === 'rodovia') {
    parts.push(`<rect x="0" y="92" width="${S}" height="92" fill="${ROAD}"/><line x1="0" y1="98" x2="${S}" y2="98" stroke="${WHITE}" stroke-width="3"/><line x1="0" y1="178" x2="${S}" y2="178" stroke="${WHITE}" stroke-width="3"/>${dashes(0, 138, S, 138)}<rect x="128" y="184" width="60" height="${S - 184}" fill="${DIRT}"/>`);
    parts.push(label(64, 82, 'rodovia'), label(234, 290, 'via local'));
    me = [158, 248];
    myArrow = arrow(158, 216, 158, 196);
    other = [48, 160];
    parts.push(vehicle(48, 160, 90, who), arrow(78, 160, 104, 160));
  } else if (spec.layout === 'faixa') {
    parts.push(`<rect x="115" y="0" width="70" height="${S}" fill="${ROAD}"/>${dashes(C, 0, C, 96)}${dashes(C, 154, C, S)}`);
    parts.push(Array.from({ length: 5 }, (_, i) => `<rect x="${119 + i * 13}" y="104" width="8" height="42" fill="${WHITE}" opacity=".85"/>`).join(''));
    parts.push(label(64, 132, 'sem semáforo', 11));
    me = [167, 248];
    myArrow = arrow(167, 216, 167, 192);
    other = [146, 125];
    parts.push(person(146, 125), arrow(158, 132, 176, 132, THEM));
  } else if (spec.layout === 'bonde') {
    parts.push(crossRoads());
    parts.push(`<line x1="0" y1="142" x2="${S}" y2="142" stroke="#9aa9b0" stroke-width="3"/><line x1="0" y1="158" x2="${S}" y2="158" stroke="#9aa9b0" stroke-width="3"/>`);
    other = [252, 150];
    parts.push(vehicle(252, 150, -90, 'bonde'), arrow(186, 150, 168, 150), label(252, 112, 'trilhos', 11));
  } else if (spec.layout === 'saida') {
    parts.push(`<rect x="0" y="54" width="${S}" height="76" fill="${ROAD}"/>${dashes(0, 92, S, 92)}<rect x="24" y="152" width="252" height="${S - 158}" rx="12" fill="#3b4a40"/><rect x="132" y="128" width="64" height="30" fill="${ROAD}"/>`);
    parts.push(label(70, 290, 'posto'));
    me = [164, 214];
    myArrow = arrow(164, 182, 164, 160);
    other = [52, 112];
    parts.push(vehicle(52, 112, 90, who), arrow(82, 112, 108, 112));
  }

  parts.push(vehicle(me[0], me[1], spec.layout === 'rotatoria-dentro' ? 45 : 0, 'carro', ME), myArrow);
  parts.push(label(me[0], Math.min(S - 4, me[1] + 42), 'você'));
  if (reveal && spec.ask !== 'acao') {
    const winner = spec.answer === 'eu' ? me : other;
    if (winner) parts.push(glow(winner[0], winner[1], who === 'bonde' && spec.answer !== 'eu' ? 62 : 36));
  }
  const heading = title ? `<title>${title}</title>` : '';
  return `<svg class="cross" viewBox="0 0 ${S} ${S}" role="img" xmlns="http://www.w3.org/2000/svg" data-scene="${scene}" id="${id}">${heading}${parts.join('')}</svg>`;
}

export const DRILL = {
  key: 'preferencia',
  title: 'Quem passa primeiro',
  lede: 'Cruzamentos, rotatórias, faixa de pedestre e o agente de trânsito. Você é o carro azul, embaixo, subindo.',
  rules: [
    ['Regra geral', 'Sem placa nem semáforo, passa quem vem pela direita. Na rotatória, quem já circula. Rodovia antes de via local.'],
    ['Quem manda mais', 'Agente de trânsito, depois semáforo, depois placa, depois a regra geral.'],
    ['Sempre primeiro', 'Pedestre na faixa, veículo de emergência com sirene e veículo sobre trilhos.'],
  ],
  size: 12,
  makeRound,
  figure: item => crossSvg(item.scene, { reveal: item.revealed, id: `cross-${item.index}`, label: 'Cruzamento visto de cima. Você é o carro azul, embaixo, subindo.' }),
  wrongHint: 'Não é essa.',
  doneHint: 'Quem manda mais: agente, depois semáforo, depois placa, depois a regra geral.',
};
