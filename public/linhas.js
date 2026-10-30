import { SCENES, makeRound, question, roadSvg } from './road.js';
import { syncNow, currentCode } from './sync.js';

const $ = id => document.getElementById(id);
const SIZE = 12;
const BEST_KEY = 'linhas.best.v1';
let round = [];
let index = 0;
let answers = [];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: the drill still works */ }
}

function show(section) {
  for (const id of ['intro', 'drill', 'done']) $(id).hidden = id !== section;
  window.scrollTo({ top: 0 });
}

function renderIntro() {
  const best = load(BEST_KEY, null);
  $('best').hidden = !best;
  if (best) $('best').textContent = `Seu melhor treino: ${best.correct} de ${best.total}.`;
  show('intro');
}

function start() {
  round = makeRound(SIZE);
  answers = round.map(() => null);
  index = 0;
  show('drill');
  renderItem();
}

function renderItem() {
  const item = round[index];
  const q = question(item);
  const given = answers[index];
  const revealed = given !== null;
  const right = given === q.answer;
  $('d-position').textContent = `${index + 1} de ${round.length}`;
  $('d-progress').max = round.length;
  $('d-progress').value = answers.filter(answer => answer !== null).length;
  const score = answers.filter((answer, i) => answer !== null && answer === question(round[i]).answer).length;
  $('d-score').textContent = `${score} ${score === 1 ? 'certa' : 'certas'}`;
  // The lines light up only after answering, so the picture never hints the answer.
  $('d-road').innerHTML = roadSvg(item.scene, { ask: item.ask, reveal: revealed, id: `drill-${index}`, label: 'Estrada vista de cima. Você é o carro azul, embaixo, subindo.' });
  $('d-prompt').textContent = q.prompt;
  $('d-options').classList.toggle('two', q.options.length === 2);
  $('d-options').classList.toggle('four', q.options.length === 4);
  $('d-options').replaceChildren(...q.options.map(([key, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(given === key));
    button.innerHTML = '<span class="option-text"></span>';
    button.firstChild.textContent = label;
    if (revealed) {
      button.disabled = true;
      if (key === q.answer) button.classList.add('right');
      else if (key === given) button.classList.add('wrong');
    }
    button.addEventListener('click', () => {
      if (answers[index] !== null) return;
      answers[index] = key;
      renderItem();
    });
    return button;
  }));
  $('d-feedback').hidden = !revealed;
  if (revealed) {
    $('d-feedback').classList.toggle('right', right);
    $('d-feedback').classList.toggle('wrong', !right);
    $('d-verdict').textContent = right ? 'Isso!' : hint(item);
    $('d-why').textContent = q.explanation;
  }
  $('d-next').disabled = !revealed;
  $('d-next-label').textContent = index === round.length - 1 ? 'Ver resultado' : 'Próxima';
  $('drill').classList.toggle('revealed', revealed);
  // Keep the picture and the explanation on screen together while the lines blink.
  if (revealed) $('d-road').scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// Each car obeys the line next to it: "can you?" needs only yours, "who can?" needs both.
function hint({ scene, ask }) {
  const { flow, double } = SCENES[scene];
  if (ask === 'cor') return 'Repare só na cor.';
  if (flow === 'mesmo') return 'Não é essa.';
  if (!double) return 'Uma linha só vale para os dois lados.';
  return ask === 'quem' ? 'Leia as duas: a azul é a sua, a clara é de quem vem.' : 'Olha só a sua linha, a azul.';
}

function finish() {
  const correct = answers.filter((answer, i) => answer === question(round[i]).answer).length;
  const total = round.length;
  const best = load(BEST_KEY, null);
  if (!best || correct > best.correct) save(BEST_KEY, { correct, total });
  if (currentCode()) syncNow();
  const passed = correct >= Math.ceil(total * 2 / 3);
  $('d-verdict-box').classList.toggle('pass', passed);
  $('d-verdict-box').classList.toggle('fail', !passed);
  $('d-label').textContent = correct === total ? 'Gabaritou' : passed ? 'Mandou bem' : 'Mais uma rodada';
  $('d-correct').textContent = String(correct);
  $('d-total').textContent = ` de ${total}`;
  $('d-detail').textContent = correct === total
    ? 'Agora tente as questões da prova, que falam disso em texto.'
    : 'Cada carro obedece a linha encostada nele. A sua é a do lado do carro azul.';
  show('done');
}

$('start').addEventListener('click', start);
$('again').addEventListener('click', start);
$('back').addEventListener('click', renderIntro);
$('d-quit').addEventListener('click', renderIntro);
$('d-next').addEventListener('click', () => {
  if (index === round.length - 1) return finish();
  index++;
  renderItem();
});

renderIntro();
