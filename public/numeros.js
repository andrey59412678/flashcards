// "Números e prazos": the figures the exam asks for, as quick four-option cards.
// Every fact points at the bank question that asks it (or the CTB article when the bank only implies it),
// so each answer here is exactly the one the exam expects.
import { shuffled } from './exam.js';

export const FACTS = [
  // Velocidades
  { group: 'Velocidades', prompt: 'Via local, sem placa: qual a velocidade máxima?', answer: '30 km/h', wrong: ['40 km/h', '50 km/h', '60 km/h'], why: 'Sobe com o tamanho da via: local 30, coletora 40, arterial 60, trânsito rápido 80.', source: 'bnq-1-3-490' },
  { group: 'Velocidades', prompt: 'Via coletora, sem placa: qual a velocidade máxima?', answer: '40 km/h', wrong: ['30 km/h', '50 km/h', '60 km/h'], why: 'Local 30, coletora 40, arterial 60, trânsito rápido 80.', source: 'bnq-1-3-13' },
  { group: 'Velocidades', prompt: 'Via arterial, sem placa: qual a velocidade máxima?', answer: '60 km/h', wrong: ['40 km/h', '50 km/h', '80 km/h'], why: 'Local 30, coletora 40, arterial 60, trânsito rápido 80.', source: 'bnq-1-3-458' },
  { group: 'Velocidades', prompt: 'Via de trânsito rápido, sem placa: qual a velocidade máxima?', answer: '80 km/h', wrong: ['60 km/h', '90 km/h', '100 km/h'], why: 'Local 30, coletora 40, arterial 60, trânsito rápido 80.', source: 'bnq-1-3-492' },
  { group: 'Velocidades', prompt: 'Estrada (via rural de terra), sem placa: qual a velocidade máxima?', answer: '60 km/h', wrong: ['40 km/h', '80 km/h', '90 km/h'], why: 'Estrada é a via rural sem asfalto. Sem placa, no máximo 60 km/h.', source: 'bnq-1-1-9' },
  { group: 'Velocidades', prompt: 'Qual a velocidade máxima numa zona calma?', answer: '30 km/h', wrong: ['20 km/h', '40 km/h', '50 km/h'], why: 'Zona calma tem o mesmo limite da via local: 30 km/h.', source: 'bnq-1-3-574' },
  { group: 'Velocidades', prompt: 'Passar até 20% acima do limite de velocidade é infração de que tipo?', answer: 'Média', wrong: ['Leve', 'Grave', 'Gravíssima'], why: 'Até 20% acima é média. De 20% a 50%, grave. Mais de 50%, gravíssima.', source: 'bnq-2-2-21' },
  { group: 'Velocidades', prompt: 'Passar mais de 50% acima do limite de velocidade dá o quê?', answer: 'Gravíssima, multa vezes 3 e suspensão', wrong: ['Grave, só multa', 'Média, multa vezes 2', 'Gravíssima, só multa'], why: 'Mais de 50% acima é a faixa mais pesada: multa triplicada e suspensão do direito de dirigir.', source: 'bnq-2-2-34' },
  // Pontos e multas
  { group: 'Pontos e multas', prompt: 'Uma infração leve soma quantos pontos na CNH?', answer: '3 pontos', wrong: ['2 pontos', '4 pontos', '5 pontos'], why: 'Leve 3, média 4, grave 5, gravíssima 7.', source: 'bnq-2-2-31' },
  { group: 'Pontos e multas', prompt: 'Uma infração média soma quantos pontos na CNH?', answer: '4 pontos', wrong: ['3 pontos', '5 pontos', '6 pontos'], why: 'Leve 3, média 4, grave 5, gravíssima 7.', source: 'CTB, art. 259' },
  { group: 'Pontos e multas', prompt: 'Uma infração grave soma quantos pontos na CNH?', answer: '5 pontos', wrong: ['4 pontos', '6 pontos', '7 pontos'], why: 'Leve 3, média 4, grave 5, gravíssima 7.', source: 'CTB, art. 259' },
  { group: 'Pontos e multas', prompt: 'Uma infração gravíssima, como avançar o sinal vermelho, soma quantos pontos?', answer: '7 pontos', wrong: ['5 pontos', '6 pontos', '10 pontos'], why: 'Leve 3, média 4, grave 5, gravíssima 7.', source: 'bnq-2-2-3' },
  { group: 'Pontos e multas', prompt: 'Sem nenhuma infração gravíssima, qual o limite de pontos em 12 meses?', answer: '40 pontos', wrong: ['20 pontos', '30 pontos', '50 pontos'], why: 'Nenhuma gravíssima: 40. Uma gravíssima: 30. Duas ou mais: 20.', source: 'bnq-2-2-15' },
  { group: 'Pontos e multas', prompt: 'Com uma infração gravíssima, qual o limite de pontos em 12 meses?', answer: '30 pontos', wrong: ['20 pontos', '25 pontos', '40 pontos'], why: 'Nenhuma gravíssima: 40. Uma gravíssima: 30. Duas ou mais: 20.', source: 'CTB, art. 261' },
  { group: 'Pontos e multas', prompt: 'Com duas ou mais infrações gravíssimas, qual o limite de pontos em 12 meses?', answer: '20 pontos', wrong: ['10 pontos', '30 pontos', '40 pontos'], why: 'Nenhuma gravíssima: 40. Uma gravíssima: 30. Duas ou mais: 20.', source: 'CTB, art. 261' },
  { group: 'Pontos e multas', prompt: 'Pagando a multa antecipadamente, o desconto pode chegar a quanto?', answer: 'Até 40%', wrong: ['Até 10%', 'Até 20%', 'Até 50%'], why: 'O desconto por pagar antes pode chegar a 40%.', source: 'bnq-1-2-119' },
  { group: 'Pontos e multas', prompt: 'Para trocar a multa por advertência por escrito, a infração leve ou média não pode ter outra infração nos últimos:', answer: '12 meses', wrong: ['6 meses', '24 meses', '5 anos'], why: 'Advertência por escrito: infração leve ou média, sem outra infração nos 12 meses anteriores.', source: 'bnq-1-2-5' },
  { group: 'Pontos e multas', prompt: 'Dirigir sob efeito de álcool (ou recusar o bafômetro) dá o quê?', answer: 'Multa vezes 10 e 12 meses de suspensão', wrong: ['Multa vezes 3 e 6 meses de suspensão', 'Multa vezes 5 e 12 meses de suspensão', 'Multa vezes 10 e 24 meses de suspensão'], why: 'Álcool é gravíssima com multa multiplicada por 10 e 12 meses sem dirigir. Recusar o bafômetro tem as mesmas penalidades.', source: 'bnq-1-2-61' },
  { group: 'Pontos e multas', prompt: 'Transitar pelo acostamento é infração de que tipo?', answer: 'Gravíssima, multa vezes 3', wrong: ['Média', 'Grave', 'Gravíssima, multa vezes 10'], why: 'Acostamento não é faixa: gravíssima com multa triplicada.', source: 'bnq-2-2-26' },
  // Habilitação e documentos
  { group: 'Habilitação', prompt: 'Por quanto tempo vale a Permissão para Dirigir, a primeira habilitação?', answer: '1 ano', wrong: ['6 meses', '2 anos', '5 anos'], why: 'A PPD vale 1 ano. Sem infração grave, gravíssima ou média repetida, vira CNH.', source: 'bnq-1-3-87' },
  { group: 'Habilitação', prompt: 'Com menos de 50 anos, a CNH é renovada a cada quanto tempo?', answer: 'A cada 10 anos', wrong: ['A cada 3 anos', 'A cada 5 anos', 'A cada 15 anos'], why: 'Menos de 50 anos: 10. De 50 a 69: 5. A partir de 70: 3.', source: 'bnq-1-3-20' },
  { group: 'Habilitação', prompt: 'De 50 a 69 anos, a CNH é renovada a cada quanto tempo?', answer: 'A cada 5 anos', wrong: ['A cada 2 anos', 'A cada 3 anos', 'A cada 10 anos'], why: 'Menos de 50 anos: 10. De 50 a 69: 5. A partir de 70: 3.', source: 'bnq-1-4-13' },
  { group: 'Habilitação', prompt: 'A partir de 70 anos, a CNH é renovada a cada quanto tempo?', answer: 'A cada 3 anos', wrong: ['A cada ano', 'A cada 2 anos', 'A cada 5 anos'], why: 'Menos de 50 anos: 10. De 50 a 69: 5. A partir de 70: 3.', source: 'bnq-1-4-14' },
  { group: 'Habilitação', prompt: 'Depois que a CNH vence, qual o prazo para renová-la?', answer: '30 dias', wrong: ['15 dias', '60 dias', '90 dias'], why: 'São 30 dias depois do vencimento.', source: 'bnq-1-2-68' },
  { group: 'Habilitação', prompt: 'Quem compra um veículo tem quanto tempo para transferi-lo para o seu nome?', answer: '30 dias', wrong: ['15 dias', '60 dias', '90 dias'], why: 'O comprador transfere em até 30 dias.', source: 'bnq-1-2-67' },
  { group: 'Habilitação', prompt: 'Na categoria B, qual o peso total máximo do veículo?', answer: '3.500 kg', wrong: ['2.000 kg', '4.500 kg', '6.000 kg'], why: 'Categoria B: até 3.500 kg e até 8 lugares além do motorista.', source: 'bnq-1-3-453' },
  { group: 'Habilitação', prompt: 'Na categoria B, quantos lugares o veículo pode ter, sem contar o motorista?', answer: '8 lugares', wrong: ['5 lugares', '6 lugares', '10 lugares'], why: 'Categoria B: até 3.500 kg e até 8 lugares além do motorista.', source: 'bnq-1-3-460' },
  // Crianças
  { group: 'Crianças', prompt: 'Qual a idade mínima para uma criança andar na garupa de moto?', answer: '10 anos', wrong: ['7 anos', '12 anos', '14 anos'], why: 'Menor de 10 anos não vai na garupa.', source: 'bnq-1-2-46' },
  { group: 'Crianças', prompt: 'O bebê conforto é para qual faixa?', answer: 'Até 1 ano ou 13 kg', wrong: ['Até 6 meses ou 9 kg', 'Até 2 anos ou 18 kg', 'Até 4 anos ou 18 kg'], why: 'Bebê conforto até 1 ano. Cadeirinha de 1 a 4. Assento de elevação de 4 a 10 anos, ou até 1,45 m.', source: 'bnq-1-3-534' },
  { group: 'Crianças', prompt: 'A cadeirinha é para qual faixa?', answer: 'De 1 a 4 anos (9 a 18 kg)', wrong: ['Do nascimento a 1 ano', 'De 4 a 7 anos', 'De 7 a 10 anos'], why: 'Bebê conforto até 1 ano. Cadeirinha de 1 a 4. Assento de elevação de 4 a 10 anos, ou até 1,45 m.', source: 'bnq-1-3-536' },
  { group: 'Crianças', prompt: 'Até quando a criança usa o assento de elevação?', answer: 'Até 10 anos ou 1,45 m de altura', wrong: ['Até 7 anos ou 1,30 m', 'Até 12 anos ou 1,50 m', 'Até 8 anos ou 1,20 m'], why: 'Bebê conforto até 1 ano. Cadeirinha de 1 a 4. Assento de elevação de 4 a 10 anos, ou até 1,45 m.', source: 'bnq-1-3-537' },
  // Segurança na via
  { group: 'Segurança', prompt: 'Ao ultrapassar um ciclista, qual a distância lateral mínima?', answer: '1,5 m', wrong: ['50 cm', '1 m', '3 m'], why: 'Um metro e meio do lado do ciclista, e mais devagar.', source: 'bnq-2-3-33' },
  { group: 'Segurança', prompt: 'Com o carro parado no acostamento, o triângulo vai a que distância?', answer: 'Pelo menos 30 m atrás', wrong: ['5 m atrás', '10 m atrás', '15 m atrás'], why: '30 metros é o mínimo. Com neblina ou em via rápida, mais longe.', source: 'bnq-1-3-484' },
  { group: 'Segurança', prompt: 'Qual a "boa regra" de distância para o carro da frente na rodovia?', answer: 'Pelo menos 2 segundos', wrong: ['Meio segundo', '1 segundo', 'Basta ver a placa dele'], why: 'Conte 2 segundos desde que ele passa por um ponto fixo até você passar pelo mesmo ponto.', source: 'bnq-1-3-519' },
  { group: 'Segurança', prompt: 'Com sono na estrada, qual o descanso mínimo recomendado?', answer: '20 minutos', wrong: ['5 minutos', '10 minutos', 'Só no fim da viagem'], why: 'Pare num local seguro e descanse pelo menos 20 minutos.', source: 'bnq-1-3-530' },
  { group: 'Segurança', prompt: 'Um cochilo de 4 segundos a 80 km/h faz o carro andar quanto sem controle?', answer: 'Quase 100 m', wrong: ['Uns 10 m', 'Uns 30 m', 'Uns 300 m'], why: 'A 80 km/h o carro anda uns 22 metros por segundo: 4 segundos são quase 100 metros de olhos fechados.', source: 'bnq-1-4-126' },
  { group: 'Segurança', prompt: 'Em área urbana, a buzina é proibida em que horário?', answer: 'Das 22h às 6h', wrong: ['Das 20h às 6h', 'Das 22h às 7h', 'Das 23h às 5h'], why: 'À noite, das 22h às 6h, e sempre nas zonas de silêncio.', source: 'bnq-1-3-222' },
  { group: 'Segurança', prompt: 'Num sinistro com carga perigosa (painel laranja), fique a que distância?', answer: 'Pelo menos 50 m', wrong: ['10 m', '20 m', '30 m'], why: 'Pelo menos 50 metros, do lado de onde vem o vento, e informe o número do painel laranja.', source: 'bnq-2-4-8' },
  { group: 'Segurança', prompt: 'O rodízio dos pneus deve ser feito a cada quanto?', answer: 'A cada 10 mil km', wrong: ['A cada 3 mil km', 'A cada 30 mil km', 'A cada 50 mil km'], why: 'O rodízio a cada 10 mil km iguala o desgaste dos pneus.', source: 'bnq-1-4-136' },
  // Emergência
  { group: 'Emergência', prompt: 'Vítima precisando de atendimento médico: qual número?', answer: '192 (SAMU)', wrong: ['190', '191', '193'], why: '192 SAMU, 193 Bombeiros, 191 Polícia Rodoviária Federal.', source: 'bnq-1-4-109' },
  { group: 'Emergência', prompt: 'Carro pegando fogo, fio elétrico caído: qual número?', answer: '193 (Bombeiros)', wrong: ['190', '191', '192'], why: '192 SAMU, 193 Bombeiros, 191 Polícia Rodoviária Federal.', source: 'bnq-1-4-110' },
  { group: 'Emergência', prompt: 'Sinistro numa rodovia federal: qual número?', answer: '191 (PRF)', wrong: ['190', '192', '193'], why: '192 SAMU, 193 Bombeiros, 191 Polícia Rodoviária Federal.', source: 'bnq-2-4-27' },
  { group: 'Emergência', prompt: 'Qual a meta do Pnatrans?', answer: 'Reduzir pela metade as mortes até 2030', wrong: ['Reduzir pela metade as mortes até 2025', 'Zerar as mortes até 2030', 'Reduzir pela metade as mortes até 2040'], why: 'O plano nacional quer metade das mortes no trânsito até 2030.', source: 'bnq-1-3-351' },
];

export const GROUPS = [...new Set(FACTS.map(fact => fact.group))];

// A round spreads across the groups, so it is never twelve speed limits in a row.
export function makeRound(size = 12, random = Math.random) {
  const byGroup = GROUPS.map(group => shuffled(FACTS.filter(fact => fact.group === group), random));
  const picked = [];
  for (let i = 0; picked.length < Math.min(size, FACTS.length); i++) {
    const group = byGroup[i % byGroup.length];
    if (group.length) picked.push(group.shift());
  }
  return shuffled(picked, random).map(fact => question(fact, random));
}

export function question(fact, random = Math.random) {
  const options = shuffled([fact.answer, ...fact.wrong], random).map(label => [label, label]);
  return { type: 'choice', group: fact.group, prompt: fact.prompt, options, answer: fact.answer, why: fact.why };
}

export const DRILL = {
  key: 'numeros',
  title: 'Números e prazos',
  lede: 'Velocidades, pontos, prazos da CNH, cadeirinha e telefones de emergência: os números que a prova cobra.',
  rules: [
    ['Velocidades', 'Local 30, coletora 40, arterial 60, trânsito rápido 80.'],
    ['Pontos', 'Leve 3, média 4, grave 5, gravíssima 7. Limite de 40, 30 ou 20 pontos, conforme as gravíssimas.'],
    ['Renovação', 'Menos de 50 anos: 10. De 50 a 69: 5. A partir de 70: 3.'],
  ],
  size: 12,
  makeRound,
  wrongHint: 'Não é essa.',
  doneHint: 'Repare nas regrinhas: velocidade sobe com o tamanho da via, pontos são 3-4-5-7.',
};
