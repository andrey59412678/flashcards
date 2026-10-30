// Quick drills sharing one page: ?t=<key> runs a drill, no key lists them all.
// A drill module exports DRILL { key, title, lede, rules, size, makeRound, figure?, wrongHint, doneHint }.
// Its items are either { type: 'choice', prompt, options: [[key, label]], answer, why }
// or { type: 'order', prompt, steps (right order), shown (indexes as displayed), why }.
import { DRILL as numeros } from './numeros.js';
import { DRILL as preferencia } from './cross.js';
import { DRILL as socorro, isRight } from './socorro.js';
import { syncNow, currentCode } from './sync.js';

const DRILLS = { preferencia, numeros, socorro };
// The line drill lives on its own page but is listed with the others.
const LINES = { key: 'linhas', title: 'Ler o chão', lede: 'Contínua, tracejada, amarela e branca: quem pode cruzar.', href: './linhas.html' };
const BEST_KEY = 'treino.best.v1';
const LINES_BEST_KEY = 'linhas.best.v1';
const $ = id => document.getElementById(id);
let drill = null;
let round = [];
let index = 0;
let answers = [];
// Steps tapped so far in an ordering item.
let picked = [];
// What should hold keyboard focus after the next render (pages rebuild their buttons on every change).
let focusNext = null;

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: the drill still works */ }
}

function show(section) {
  for (const id of ['hub', 'intro', 'drill', 'done']) $(id).hidden = id !== section;
  window.scrollTo({ top: 0 });
}

function bestText(best) {
  return best ? `Melhor: ${best.correct} de ${best.total}` : 'Ainda não treinou';
}

function renderHub() {
  const bests = load(BEST_KEY, {});
  const entries = [LINES, ...Object.values(DRILLS)];
  $('drills').replaceChildren(...entries.map(entry => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'drill-link';
    link.href = entry.href ?? `./treino.html?t=${entry.key}`;
    link.innerHTML = '<span class="drill-name"></span><span class="drill-lede"></span><span class="drill-best"></span>';
    link.children[0].textContent = entry.title;
    link.children[1].textContent = entry.lede;
    link.children[2].textContent = bestText(entry.key === 'linhas' ? load(LINES_BEST_KEY, null) : bests[entry.key]);
    item.append(link);
    return item;
  }));
  document.title = 'Treinos · Autoescola';
  show('hub');
}

function renderIntro() {
  $('t-title').textContent = drill.title;
  $('t-lede').textContent = drill.lede;
  $('t-rules').replaceChildren(...drill.rules.map(([name, text]) => {
    const item = document.createElement('li');
    item.innerHTML = '<span><strong></strong> <span></span></span>';
    item.firstChild.firstChild.textContent = `${name}.`;
    item.firstChild.lastChild.textContent = text;
    return item;
  }));
  $('start-label').textContent = `Treinar ${drill.size} ${drill.key === 'socorro' ? 'situações' : 'perguntas'}`;
  const best = load(BEST_KEY, {})[drill.key];
  $('best').hidden = !best;
  if (best) $('best').textContent = `Seu melhor treino: ${best.correct} de ${best.total}.`;
  document.title = `${drill.title} · Autoescola`;
  show('intro');
}

function start() {
  round = drill.makeRound(drill.size);
  answers = round.map(() => null);
  index = 0;
  picked = [];
  show('drill');
  renderItem();
}

const right = (item, answer) => (item.type === 'order' ? isRight(answer) : answer === item.answer);

function renderItem() {
  const item = round[index];
  const given = answers[index];
  const revealed = given !== null;
  const done = answers.filter(answer => answer !== null).length;
  const score = answers.filter((answer, i) => answer !== null && right(round[i], answer)).length;
  $('d-position').textContent = `${index + 1} de ${round.length}`;
  $('d-progress').max = round.length;
  $('d-progress').value = done;
  $('d-score').textContent = `${score} ${score === 1 ? 'certa' : 'certas'}`;
  $('d-group').hidden = !item.group;
  $('d-group').textContent = item.group ?? '';
  // The picture lights up who passes only after answering, so it never gives the answer away.
  const figure = drill.figure ? drill.figure({ ...item, revealed, index }) : '';
  $('d-figure').hidden = !figure;
  $('d-figure').innerHTML = figure;
  $('d-prompt').textContent = item.prompt;
  if (item.type === 'order') renderOrder(item, given); else renderChoice(item, given);
  $('d-feedback').hidden = !revealed;
  if (revealed) {
    const ok = right(item, given);
    $('d-feedback').classList.toggle('right', ok);
    $('d-feedback').classList.toggle('wrong', !ok);
    $('d-verdict').textContent = ok ? 'Isso!' : drill.wrongHint;
    $('d-solution').hidden = item.type !== 'order' || ok;
    if (item.type === 'order') $('d-solution').replaceChildren(...item.steps.map(step => Object.assign(document.createElement('li'), { textContent: step })));
    $('d-why').textContent = item.why;
  }
  $('d-next').disabled = !revealed;
  $('d-next-label').textContent = index === round.length - 1 ? 'Ver resultado' : 'Próxima';
  $('drill').classList.toggle('revealed', revealed);
  if (revealed) ($('d-figure').hidden ? $('d-feedback') : $('d-figure')).scrollIntoView({ block: 'start', behavior: 'smooth' });
  restoreFocus();
}

// Keyboard and screen-reader users keep their place: the tapped step again, Conferir once all are numbered,
// Próxima once the answer is out.
function restoreFocus() {
  const want = focusNext;
  focusNext = null;
  if (want === null) return;
  const target = want === 'next' ? $('d-next') : want === 'check' ? $('d-check') : $('d-steps').querySelector(`[data-step="${want}"]`);
  target?.focus({ preventScroll: true });
}

function renderChoice(item, given) {
  $('d-steps').hidden = true;
  $('d-check').hidden = true;
  $('d-options').hidden = false;
  $('d-options').classList.toggle('two', item.options.length === 2);
  $('d-options').classList.toggle('stack', item.options.length > 2);
  $('d-options').replaceChildren(...item.options.map(([key, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(given === key));
    button.innerHTML = '<span class="option-text"></span>';
    button.firstChild.textContent = label;
    if (given !== null) {
      button.disabled = true;
      if (key === item.answer) button.classList.add('right');
      else if (key === given) button.classList.add('wrong');
    }
    button.addEventListener('click', () => {
      if (answers[index] !== null) return;
      answers[index] = key;
      focusNext = 'next';
      renderItem();
    });
    return button;
  }));
}

// Tap the steps in order; tapping a numbered step takes it (and only it) back out.
function renderOrder(item, given) {
  $('d-options').hidden = true;
  $('d-steps').hidden = false;
  const chosen = given ?? picked;
  $('d-steps').replaceChildren(...item.shown.map(step => {
    const position = chosen.indexOf(step);
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'step';
    button.dataset.step = String(step);
    button.innerHTML = '<span class="step-number"></span><span class="step-text"></span>';
    button.firstChild.textContent = position === -1 ? '' : String(position + 1);
    button.lastChild.textContent = item.steps[step];
    button.setAttribute('aria-label', `${item.steps[step]}${position === -1 ? ', sem número' : `, passo ${position + 1}`}`);
    button.classList.toggle('picked', position !== -1);
    if (given) {
      button.disabled = true;
      button.classList.add(position === step ? 'right' : 'wrong');
      if (position !== step) button.lastChild.textContent += ` (é o ${step + 1}º)`;
    }
    button.addEventListener('click', () => {
      if (answers[index] !== null) return;
      picked = position === -1 ? [...picked, step] : picked.filter(value => value !== step);
      focusNext = picked.length === item.steps.length ? 'check' : step;
      renderItem();
      $('d-pick-status').textContent = position === -1 ? `Passo ${picked.length}: ${item.steps[step]}` : `Sem número: ${item.steps[step]}`;
    });
    li.append(button);
    return li;
  }));
  $('d-check').hidden = Boolean(given);
  $('d-check').disabled = picked.length !== item.steps.length;
}

function finish() {
  const correct = answers.filter((answer, i) => right(round[i], answer)).length;
  const total = round.length;
  const bests = load(BEST_KEY, {});
  const best = bests[drill.key];
  if (!best || correct / total > best.correct / best.total || (correct / total === best.correct / best.total && correct > best.correct)) save(BEST_KEY, { ...bests, [drill.key]: { correct, total } });
  if (currentCode()) syncNow();
  const passed = correct >= Math.ceil(total * 2 / 3);
  $('d-verdict-box').classList.toggle('pass', passed);
  $('d-verdict-box').classList.toggle('fail', !passed);
  $('d-label').textContent = correct === total ? 'Gabaritou' : passed ? 'Mandou bem' : 'Mais uma rodada';
  $('d-correct').textContent = String(correct);
  $('d-total').textContent = ` de ${total}`;
  $('d-detail').textContent = correct === total ? 'Agora tente uma prova completa no simulado.' : drill.doneHint;
  show('done');
}

$('start').addEventListener('click', start);
$('again').addEventListener('click', start);
$('d-quit').addEventListener('click', renderIntro);
$('d-check').addEventListener('click', () => {
  if (answers[index] !== null || picked.length !== round[index].steps.length) return;
  answers[index] = picked;
  picked = [];
  focusNext = 'next';
  renderItem();
});
$('d-next').addEventListener('click', () => {
  if (index === round.length - 1) return finish();
  index++;
  picked = [];
  renderItem();
});

drill = DRILLS[new URLSearchParams(window.location.search).get('t')] ?? null;
if (drill) renderIntro(); else renderHub();
// Pull the bests from the other devices; the hub is the only screen showing them all.
if (!drill && currentCode()) syncNow().then(result => { if (result.changed && !$('hub').hidden) renderHub(); });
