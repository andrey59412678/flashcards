import { TOPICS, validateBank, drawExam, optionOrders, newAttempt, choose, goTo, remainingMs, isExpired, finish, unanswered, score, restoreAttempt, updateMissed } from './exam.js';

const $ = id => document.getElementById(id);
const KEYS = { attempt: 'simulado.attempt.v1', missed: 'simulado.missed.v1', history: 'simulado.history.v1' };
const LETTERS = 'ABCDE';
const appBase = new URL('.', import.meta.url);
const assetUrl = path => new URL(path.replace(/^\//, ''), appBase).href;
const svgNS = 'http://www.w3.org/2000/svg';
let bank;
let byId;
let attempt = null;
let ticker;
let toastTimer;

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function save(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    $('storage-notice').hidden = true;
  } catch {
    $('storage-notice').hidden = false;
  }
}

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
}

function show(section) {
  for (const id of ['home', 'exam', 'result']) $(id).hidden = id !== section;
  window.scrollTo({ top: 0 });
}

function clock(ms) {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Same viewport technique as the flashcards: show only the sign, never the sheet's caption.
function signSvg(image, clipId) {
  const { src, width, height, crop } = image;
  const svg = document.createElementNS(svgNS, 'svg');
  svg.classList.add('question-sign');
  svg.setAttribute('viewBox', crop.join(' '));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Placa de trânsito da questão');
  const defs = document.createElementNS(svgNS, 'defs');
  const clip = document.createElementNS(svgNS, 'clipPath');
  clip.id = clipId;
  const rect = document.createElementNS(svgNS, 'rect');
  ['x', 'y', 'width', 'height'].forEach((attribute, index) => rect.setAttribute(attribute, String(crop[index])));
  clip.append(rect);
  defs.append(clip);
  const element = document.createElementNS(svgNS, 'image');
  element.setAttribute('href', assetUrl(src));
  element.setAttribute('width', String(width));
  element.setAttribute('height', String(height));
  element.setAttribute('clip-path', `url(#${clipId})`);
  svg.append(defs, element);
  return svg;
}

function renderHome() {
  const { questions, minutes, passScore } = bank.exam;
  $('exam-rules').textContent = `${questions} questões sorteadas, ${minutes} minutos. Para passar, acerte pelo menos ${passScore}. A correção só aparece quando você entregar.`;
  const missed = load(KEYS.missed, []).filter(id => byId.has(id));
  $('review').hidden = !missed.length;
  $('review').textContent = `Treinar as que errei (${missed.length})`;
  $('resume').hidden = !(attempt && !attempt.finishedAt);
  $('start').firstChild.textContent = attempt && !attempt.finishedAt ? 'Começar uma prova nova' : 'Começar prova';
  $('bank-size').textContent = `Banco com ${bank.questions.length} questões. Cada prova sorteia questões diferentes.`;
  const history = load(KEYS.history, []);
  $('history').hidden = !history.length;
  $('history-list').replaceChildren(...history.slice(0, 6).map(entry => {
    const item = document.createElement('li');
    const date = new Date(entry.at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    item.innerHTML = `<span></span><strong></strong>`;
    item.firstChild.textContent = `${date} · ${entry.kind === 'exam' ? 'Prova' : 'Treino de erros'}`;
    item.lastChild.textContent = `${entry.correct}/${entry.total}`;
    item.classList.add(entry.passed ? 'pass' : 'fail');
    return item;
  }));
  show('home');
}

function renderQuestion() {
  const question = byId.get(attempt.ids[attempt.index]);
  const total = attempt.ids.length;
  const pending = unanswered(attempt);
  $('q-position').textContent = `Questão ${attempt.index + 1} de ${total}`;
  $('q-progress').max = total;
  $('q-progress').value = total - pending;
  $('q-topic').textContent = TOPICS[question.topic];
  $('q-answered').textContent = `${total - pending}/${total} respondidas`;
  $('q-image').hidden = !question.image;
  $('q-image').replaceChildren(...(question.image ? [signSvg(question.image, 'q-sign-clip')] : []));
  $('q-text').textContent = question.text;
  $('q-options').replaceChildren(...attempt.orders[attempt.index].map((index, position) => {
    const option = question.options[index];
    const button = document.createElement('button');
    const selected = attempt.answers[attempt.index] === index;
    button.type = 'button';
    button.className = 'option';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(selected));
    button.innerHTML = '<span class="letter"></span><span class="option-text"></span>';
    button.firstChild.textContent = LETTERS[position];
    button.lastChild.textContent = option;
    button.addEventListener('click', () => {
      attempt = choose(attempt, index);
      persistAttempt();
      renderQuestion();
    });
    return button;
  }));
  $('q-prev').disabled = attempt.index === 0;
  $('q-next-label').textContent = attempt.index === total - 1 ? 'Entregar prova' : 'Próxima';
  $('q-grid').replaceChildren(...attempt.ids.map((_, index) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.textContent = String(index + 1);
    cell.className = 'cell';
    if (attempt.answers[index] !== null) cell.classList.add('done');
    if (index === attempt.index) cell.setAttribute('aria-current', 'true');
    cell.setAttribute('aria-label', `Questão ${index + 1}${attempt.answers[index] === null ? ', sem resposta' : ', respondida'}`);
    cell.addEventListener('click', () => { attempt = goTo(attempt, index); persistAttempt(); renderQuestion(); });
    return cell;
  }));
  tick();
}

function tick() {
  if (!attempt || attempt.finishedAt) return;
  const now = Date.now();
  if (isExpired(attempt, now)) {
    submit();
    notify('Tempo esgotado. A prova foi entregue.');
    return;
  }
  const left = remainingMs(attempt, now);
  $('timer').hidden = left === null;
  if (left !== null) {
    $('timer').textContent = clock(left);
    $('timer').classList.toggle('warn', left <= 5 * 60_000);
  }
}

function persistAttempt() {
  save(KEYS.attempt, attempt);
}

function startAttempt(ids, kind) {
  attempt = newAttempt(ids, { now: Date.now(), minutes: kind === 'exam' ? bank.exam.minutes : null, kind, orders: optionOrders(bank, ids) });
  persistAttempt();
  openExam();
}

function openExam() {
  show('exam');
  renderQuestion();
  clearInterval(ticker);
  ticker = setInterval(tick, 1000);
}

function submit() {
  clearInterval(ticker);
  attempt = finish(attempt, Date.now());
  const result = score(attempt, bank);
  save(KEYS.missed, updateMissed(load(KEYS.missed, []), attempt, bank));
  save(KEYS.history, [{ at: attempt.finishedAt, kind: attempt.kind, correct: result.correct, total: result.total, passed: result.passed }, ...load(KEYS.history, [])].slice(0, 30));
  persistAttempt();
  renderResult();
}

function askSubmit() {
  const pending = unanswered(attempt);
  $('confirm-text').textContent = pending
    ? `Você ainda tem ${pending} ${pending === 1 ? 'questão' : 'questões'} sem resposta. Questão em branco conta como erro.`
    : 'Você respondeu todas. Depois de entregar não dá para mudar as respostas.';
  $('confirm').showModal();
}

function renderResult() {
  const result = score(attempt, bank);
  const isExam = attempt.kind === 'exam';
  $('verdict').classList.toggle('pass', result.passed);
  $('verdict').classList.toggle('fail', !result.passed);
  $('verdict-label').textContent = isExam ? (result.passed ? 'Aprovada' : 'Reprovada') : (result.passed ? 'Mandou bem' : 'Ainda não');
  $('verdict-correct').textContent = String(result.correct);
  $('verdict-total').textContent = ` de ${result.total}`;
  const minutes = Math.round((attempt.finishedAt - attempt.startedAt) / 60_000);
  $('verdict-detail').textContent = `${isExam ? 'Precisava de' : 'Na proporção da prova, precisaria de'} ${result.needed} acertos. ${isExam ? `Tempo usado: ${minutes} min.` : ''}`.trim();
  $('topic-scores').replaceChildren(...Object.keys(TOPICS).filter(topic => result.byTopic[topic]).map(topic => {
    const { correct, total } = result.byTopic[topic];
    const item = document.createElement('li');
    item.innerHTML = '<span class="topic-name"></span><span class="topic-bar"><span></span></span><span class="topic-count"></span>';
    item.children[0].textContent = TOPICS[topic];
    item.children[1].firstChild.style.width = `${Math.round(100 * correct / total)}%`;
    item.children[2].textContent = `${correct}/${total}`;
    return item;
  }));
  $('retry-wrong').hidden = !result.wrong.length;
  $('review-title').textContent = result.wrong.length ? `Correção das ${result.wrong.length} que você errou` : 'Você acertou todas!';
  $('review-list').replaceChildren(...attempt.ids.flatMap((id, position) => {
    const question = byId.get(id);
    const given = attempt.answers[position];
    if (given === question.answer) return [];
    const item = document.createElement('li');
    item.className = 'review-item';
    const letter = option => LETTERS[attempt.orders[position].indexOf(option)];
    const parts = [`<p class="review-meta"></p>`, question.image ? '<div class="review-sign"></div>' : '', '<p class="review-q"></p>', '<p class="review-given"></p>', '<p class="review-right"></p>', question.explanation ? '<p class="review-why"></p>' : ''];
    item.innerHTML = parts.join('');
    item.querySelector('.review-meta').textContent = `Questão ${position + 1} · ${TOPICS[question.topic]}`;
    if (question.image) item.querySelector('.review-sign').append(signSvg(question.image, `review-clip-${position}`));
    item.querySelector('.review-q').textContent = question.text;
    item.querySelector('.review-given').textContent = given === null ? 'Você deixou em branco.' : `Você marcou: ${letter(given)}) ${question.options[given]}`;
    item.querySelector('.review-right').textContent = `Certa: ${letter(question.answer)}) ${question.options[question.answer]}`;
    if (question.explanation) item.querySelector('.review-why').textContent = question.explanation;
    return [item];
  }));
  show('result');
}

$('start').addEventListener('click', () => startAttempt(drawExam(bank), 'exam'));
$('resume').addEventListener('click', openExam);
$('review').addEventListener('click', () => {
  const missed = load(KEYS.missed, []).filter(id => byId.has(id));
  if (missed.length) startAttempt(missed.slice(0, 30), 'review');
});
$('q-prev').addEventListener('click', () => { attempt = goTo(attempt, attempt.index - 1); persistAttempt(); renderQuestion(); });
$('q-next').addEventListener('click', () => {
  if (attempt.index === attempt.ids.length - 1) return askSubmit();
  attempt = goTo(attempt, attempt.index + 1);
  persistAttempt();
  renderQuestion();
});
$('submit').addEventListener('click', askSubmit);
$('confirm').addEventListener('close', () => { if ($('confirm').returnValue === 'ok' && attempt && !attempt.finishedAt) submit(); });
$('again').addEventListener('click', () => startAttempt(drawExam(bank), 'exam'));
$('retry-wrong').addEventListener('click', () => startAttempt(score(attempt, bank).wrong, 'review'));
$('home-link').addEventListener('click', renderHome);
$('reload').addEventListener('click', () => window.location.reload());
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

try {
  const response = await fetch(assetUrl('/questions.json'), { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load questions');
  bank = validateBank(await response.json());
  byId = new Map(bank.questions.map(q => [q.id, q]));
  attempt = restoreAttempt(bank, load(KEYS.attempt, null));
  if (attempt && !attempt.finishedAt && isExpired(attempt, Date.now())) {
    submit();
    notify('O tempo acabou enquanto a página estava fechada. A prova foi entregue.');
  } else if (attempt && !attempt.finishedAt) {
    openExam();
  } else {
    renderHome();
  }
} catch (error) {
  console.error('Não foi possível abrir o simulado:', error.message);
  $('error').hidden = false;
} finally {
  $('loading').hidden = true;
}
