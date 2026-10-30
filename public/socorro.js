// "Primeiros socorros em ordem": put the steps of a situation in the order the exam expects.
// Every step comes from the bank's "Cuidar, agir e preservar" answers, cited in `sources`.
import { shuffled } from './exam.js';

export const SEQUENCES = [
  {
    prompt: 'Você chega a um sinistro com uma pessoa ferida. Em que ordem você age?',
    steps: [
      'Parar o seu carro em local seguro e ligar o pisca-alerta',
      'Sinalizar o local com o triângulo, a pelo menos 30 m',
      'Olhar os riscos: vazamento, fumaça, fios soltos',
      'Ligar para o socorro com o local exato e o número de vítimas',
      'Ficar com a vítima sem movê-la, conversando e acalmando',
    ],
    why: 'Primeiro a sua segurança, depois a dos outros, depois o socorro. Quem não é treinado só acalma a vítima: não remova, não movimente, não transporte.',
    sources: ['bnq-1-4-85', 'bnq-1-4-86', 'bnq-1-4-95', 'bnq-1-4-99', 'bnq-1-4-87'],
  },
  {
    prompt: 'O pneu furou na rodovia. Em que ordem você age?',
    steps: [
      'Parar no acostamento, fora da pista, e ligar o pisca-alerta',
      'Colocar o triângulo a pelo menos 30 m atrás do carro',
      'Só então trocar o pneu',
    ],
    why: 'Saia da pista e ligue o pisca-alerta, depois sinalize com o triângulo, e só então mexa no carro. Com neblina ou em via rápida, o triângulo vai ainda mais longe.',
    sources: ['bnq-1-4-86', 'bnq-1-4-112', 'bnq-1-4-103'],
  },
  {
    prompt: 'Uma vítima está caída e não responde. Em que ordem você age?',
    steps: [
      'Ver se o local é seguro antes de se aproximar',
      'Verificar se ela respira',
      'Ligar para o SAMU (192) e dizer que ela está inconsciente',
      'Seguir as orientações do atendente, sem mover a vítima',
    ],
    why: 'Local seguro primeiro, depois respiração e socorro. Sem treinamento, você segue o atendente do 192 por telefone.',
    sources: ['bnq-1-4-72', 'bnq-1-4-81', 'bnq-1-4-106', 'bnq-2-4-9'],
  },
  {
    prompt: 'Uma batida leve numa avenida, sem feridos. Em que ordem vocês agem?',
    steps: [
      'Ligar o pisca-alerta e garantir a própria segurança',
      'Conferir que ninguém se feriu',
      'Tirar os carros da pista para um local seguro',
    ],
    why: 'Sem feridos, os carros saem da pista para liberar o trânsito e evitar uma nova batida.',
    sources: ['bnq-1-4-204', 'bnq-2-3-9'],
  },
  {
    prompt: 'Um caminhão com painel laranja (carga perigosa) se envolveu num sinistro. Em que ordem você age?',
    steps: [
      'Parar a pelo menos 50 m, do lado de onde vem o vento',
      'Anotar o número do painel laranja',
      'Ligar para o socorro e informar esse número',
    ],
    why: 'Distância e vento primeiro, porque a carga pode ser tóxica. O número do painel diz ao socorro qual é o produto.',
    sources: ['bnq-2-4-8'],
  },
  {
    prompt: 'Um motociclista caiu e reclama de dor na perna. Em que ordem você age?',
    steps: [
      'Sinalizar o local para ninguém atropelá-lo',
      'Ligar para o SAMU (192)',
      'Ficar com ele sem tirar o capacete nem movê-lo, conversando até o socorro chegar',
    ],
    why: 'O capacete fica: tirá-lo pode piorar uma lesão no pescoço. Só se move a vítima com risco iminente, como incêndio.',
    sources: ['bnq-2-4-5', 'bnq-1-4-120', 'bnq-1-4-109', 'bnq-1-4-130'],
  },
];

// The steps start shuffled, never already in the right order.
export function question(sequence, random = Math.random) {
  const order = sequence.steps.map((_, index) => index);
  let shown = shuffled(order, random);
  for (let tries = 0; shown.every((step, i) => step === i) && tries < 10; tries++) shown = shuffled(order, random);
  if (shown.every((step, i) => step === i)) shown = [...order.slice(1), order[0]];
  return { type: 'order', prompt: sequence.prompt, steps: sequence.steps, shown, why: sequence.why };
}

// Right only when every step is in its place.
export function isRight(picked) {
  return picked.every((step, i) => step === i);
}

export function makeRound(size = SEQUENCES.length, random = Math.random) {
  return shuffled(SEQUENCES, random).slice(0, size).map(sequence => question(sequence, random));
}

export const DRILL = {
  key: 'socorro',
  title: 'Primeiros socorros em ordem',
  lede: 'Toque nos passos na ordem certa. A prova cobra o que vem primeiro.',
  rules: [
    ['Você primeiro', 'Pare em local seguro e ligue o pisca-alerta. Sem você bem, não há socorro.'],
    ['Depois os outros', 'Sinalize o local com o triângulo, a pelo menos 30 m.'],
    ['Não remova', 'Não remova, não movimente, não transporte, nem tire o capacete. Só com risco iminente, como incêndio.'],
  ],
  size: SEQUENCES.length,
  makeRound,
  wrongHint: 'A ordem certa é esta:',
  doneHint: 'Primeiro a sua segurança, depois sinalizar, depois o socorro.',
};
