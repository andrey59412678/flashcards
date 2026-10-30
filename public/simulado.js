import { TOPICS, validateBank, drawExam, drawStudy, drawSet, coverage, updateSeen, optionOrders, newAttempt, choose, goTo, remainingMs, isExpired, finish, unanswered, score, restoreAttempt, updateMissed, historyEntry, reviewFromHistory, reviewPositions } from './exam.js';

import { BANK_SCENES, roadSvg, explain } from './road.js';
import { syncNow, newCode, parseCode, formatCode, currentCode, status as syncStatus, disconnect, hasLocalProgress } from './sync.js';
import { recordMissed } from './merge.js';

const $ = id => document.getElementById(id);
const KEYS = { attempt: 'simulado.attempt.v1', missed: 'simulado.missed.v1', missedLog: 'simulado.missed-log.v1', history: 'simulado.history.v1', seen: 'simulado.seen.v1' };
const STUDY_SIZE = 10;
const KIND_NAMES = { exam: 'Prova', review: 'Treino de erros', study: 'Estudo' };
// Study sets that cut across the four modules.
const SETS = { linhas: { name: 'Linhas no chão', ids: Object.keys(BANK_SCENES) } };
const LETTERS = 'ABCDE';
const appBase = new URL('.', import.meta.url);
const assetUrl = path => new URL(path.replace(/^\//, ''), appBase).href;
const svgNS = 'http://www.w3.org/2000/svg';
let bank;
let byId;
let attempt = null;
// The finished round on the result screen: the one just submitted or one reopened from the history.
let viewing = null;
let reviewFilter = 'wrong';
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

// Only well-formed rounds; a damaged entry is dropped instead of taking the whole page down.
function loadHistory() {
  const history = load(KEYS.history, []);
  return Array.isArray(history) ? history.filter(entry => entry && typeof entry === 'object' && Number.isFinite(entry.at) && Number.isFinite(entry.correct) && Number.isFinite(entry.total)) : [];
}

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  // Long messages stay up long enough to be read.
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, Math.max(2800, message.length * 70));
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

// The road picture behind a question about lines, shown only once the answer is out.
function roadFigure(id, clipId) {
  const scene = BANK_SCENES[id];
  if (!scene) return null;
  const figure = document.createElement('figure');
  figure.className = 'road-figure';
  const caption = explain(scene);
  figure.innerHTML = roadSvg(scene, { reveal: true, ask: 'quem', id: clipId, label: caption });
  const text = document.createElement('figcaption');
  text.textContent = caption;
  figure.append(text);
  return figure;
}

function startSet(key) {
  const ids = SETS[key].ids.filter(id => byId.has(id));
  startAttempt(drawSet(bank, ids, STUDY_SIZE, Math.random, load(KEYS.seen, [])), 'study', key);
}

function roundName(entry) {
  return entry.set ? SETS[entry.set]?.name : entry.topic ? TOPICS[entry.topic] : '';
}

function when(at) {
  const date = new Date(at);
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function renderSync() {
  const code = currentCode();
  $('sync-off').hidden = Boolean(code);
  $('sync-on').hidden = !code;
  if (!code) return;
  $('sync-code').textContent = formatCode(code);
  const last = syncStatus();
  $('sync-status').textContent = !last ? 'Sincronizando…' : last.ok ? `Sincronizado em ${when(last.at)}.` : 'Sem conexão agora. Seu progresso fica salvo aqui e sobe na próxima vez.';
}

let lastSync = 0;

// Merges with the other devices; refreshes the home screen only if something new arrived.
async function sync(options) {
  lastSync = Date.now();
  const result = await syncNow(options);
  if (!$('home').hidden) result.changed ? renderHome() : renderSync();
  return result;
}

function renderHome() {
  const { questions, minutes, passScore } = bank.exam;
  $('exam-rules').textContent = `${questions} questões sorteadas, ${minutes} minutos. Para passar, acerte pelo menos ${passScore}. A correção só aparece quando você entregar.`;
  const missed = load(KEYS.missed, []).filter(id => byId.has(id));
  $('review').hidden = !missed.length;
  $('review').textContent = `Treinar as que errei (${missed.length})`;
  $('resume').hidden = !(attempt && !attempt.finishedAt);
  $('start').firstChild.textContent = attempt && !attempt.finishedAt ? 'Começar uma prova nova' : 'Começar prova';
  const seen = load(KEYS.seen, []).filter(id => byId.has(id));
  $('bank-size').textContent = seen.length
    ? `Você já respondeu ${seen.length} das ${bank.questions.length} questões do banco oficial. As inéditas são sorteadas primeiro.`
    : `Banco oficial com ${bank.questions.length} questões. Cada prova sorteia questões diferentes.`;
  const covered = coverage(bank, seen);
  $('study-topics').replaceChildren(...Object.entries(TOPICS).map(([topic, name]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'study-topic';
    button.innerHTML = '<span class="study-name"></span><span class="topic-bar"><span></span></span><span class="study-count"></span>';
    button.children[0].textContent = name;
    const { seen: done, total } = covered[topic];
    button.children[1].firstChild.style.width = `${Math.round(100 * done / total)}%`;
    button.children[2].textContent = `${done}/${total}`;
    button.setAttribute('aria-label', `Estudar ${name}: ${done} de ${total} questões já respondidas`);
    button.addEventListener('click', () => startAttempt(drawStudy(bank, topic, STUDY_SIZE, Math.random, load(KEYS.seen, [])), 'study'));
    return button;
  }), ...Object.entries(SETS).map(([key, { name, ids }]) => {
    const known = ids.filter(id => byId.has(id));
    const done = known.filter(id => seen.includes(id)).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'study-topic line-set';
    button.innerHTML = '<span class="study-name"></span><span class="topic-bar"><span></span></span><span class="study-count"></span>';
    button.children[0].textContent = `${name} (com desenho)`;
    button.children[1].firstChild.style.width = `${Math.round(100 * done / known.length)}%`;
    button.children[2].textContent = `${done}/${known.length}`;
    button.setAttribute('aria-label', `Estudar ${name}: ${done} de ${known.length} questões já respondidas`);
    button.addEventListener('click', () => startSet(key));
    return button;
  }));
  const history = loadHistory();
  $('history').hidden = !history.length;
  $('history-list').replaceChildren(...history.slice(0, 10).map(entry => {
    const item = document.createElement('li');
    const past = reviewFromHistory(bank, entry);
    const row = document.createElement(past ? 'button' : 'div');
    row.className = 'history-row';
    row.innerHTML = '<span class="history-name"></span><strong></strong>';
    row.firstChild.textContent = `${when(entry.at)} · ${KIND_NAMES[entry.kind] ?? 'Treino'}${roundName(entry) ? ` · ${roundName(entry)}` : ''}`;
    row.children[1].textContent = `${entry.correct}/${entry.total}`;
    if (past) {
      row.type = 'button';
      row.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>');
      row.setAttribute('aria-label', `Ver a correção: ${row.firstChild.textContent}, ${entry.correct} de ${entry.total}`);
      row.addEventListener('click', () => renderResult(past, { past: true }));
    }
    item.append(row);
    item.classList.add(entry.passed ? 'pass' : 'fail');
    return item;
  }));
  $('history-hint').hidden = !history.some(entry => entry.review);
  renderSync();
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
  const given = attempt.answers[attempt.index];
  // In a study round the answer is revealed as soon as one option is picked.
  const revealed = attempt.kind === 'study' && given !== null;
  $('q-options').replaceChildren(...attempt.orders[attempt.index].map((index, position) => {
    const option = question.options[index];
    const button = document.createElement('button');
    const selected = given === index;
    button.type = 'button';
    button.className = 'option';
    if (revealed) {
      button.disabled = true;
      if (index === question.answer) button.classList.add('right');
      else if (selected) button.classList.add('wrong');
    }
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
  $('q-feedback').hidden = !revealed;
  if (revealed) {
    const right = given === question.answer;
    $('q-feedback').classList.toggle('right', right);
    $('q-feedback').classList.toggle('wrong', !right);
    $('q-verdict').textContent = right ? 'Acertou!' : `Errou. A certa é a ${LETTERS[attempt.orders[attempt.index].indexOf(question.answer)]}.`;
    $('q-why').textContent = question.explanation ?? '';
    $('q-why').hidden = !question.explanation;
  }
  const figure = revealed ? roadFigure(question.id, 'q-road-clip') : null;
  $('q-road').hidden = !figure;
  $('q-road').replaceChildren(...(figure ? [figure] : []));
  $('q-prev').disabled = attempt.index === 0;
  const last = attempt.index === total - 1;
  $('q-next-label').textContent = last ? (attempt.kind === 'exam' ? 'Entregar prova' : 'Ver resultado') : 'Próxima';
  document.querySelector('.grid-box').hidden = attempt.kind === 'study';
  $('submit').textContent = attempt.kind === 'exam' ? 'Entregar prova agora' : 'Encerrar e ver resultado';
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

function startAttempt(ids, kind, set = null) {
  // Every way into a new round passes here, including the buttons under an old round's correction.
  if (attempt && !attempt.finishedAt && !window.confirm('Você tem uma prova em andamento. Começar outra rodada descarta essa prova. Continuar?')) return;
  attempt = newAttempt(ids, { now: Date.now(), minutes: kind === 'exam' ? bank.exam.minutes : null, kind, set, orders: optionOrders(bank, ids) });
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
  const missedBefore = load(KEYS.missed, []);
  const missedAfter = updateMissed(missedBefore, attempt, bank);
  save(KEYS.missed, missedAfter);
  // When each miss was added or fixed, so other devices merge question by question (merge.js).
  save(KEYS.missedLog, recordMissed(load(KEYS.missedLog, {}), missedBefore, missedAfter, Date.now()));
  save(KEYS.seen, updateSeen(load(KEYS.seen, []), attempt, bank));
  const topic = attempt.kind === 'study' && !attempt.set ? byId.get(attempt.ids[0]).topic : undefined;
  save(KEYS.history, [historyEntry(attempt, bank, topic), ...loadHistory()].slice(0, 30));
  persistAttempt();
  renderResult();
  sync();
}

function askSubmit() {
  const pending = unanswered(attempt);
  const isExam = attempt.kind === 'exam';
  $('confirm-title').textContent = isExam ? 'Entregar a prova?' : 'Encerrar a rodada?';
  $('confirm-ok').textContent = isExam ? 'Entregar' : 'Encerrar';
  $('confirm-text').textContent = pending
    ? `Você ainda tem ${pending} ${pending === 1 ? 'questão' : 'questões'} sem resposta. Questão em branco conta como erro.`
    : 'Você respondeu todas. Depois de entregar não dá para mudar as respostas.';
  $('confirm').showModal();
}

function renderResult(view = attempt, { past = false } = {}) {
  viewing = view;
  const result = score(view, bank);
  const isExam = view.kind === 'exam';
  $('verdict').classList.toggle('pass', result.passed);
  $('verdict').classList.toggle('fail', !result.passed);
  const studySet = view.kind === 'study' ? view.set : null;
  const studyTopic = view.kind === 'study' && !studySet ? byId.get(view.ids[0]).topic : null;
  const studyName = studySet ? SETS[studySet]?.name : studyTopic ? TOPICS[studyTopic] : null;
  $('again').textContent = studyName ? `Mais ${STUDY_SIZE} de ${studyName.toLowerCase()}` : 'Fazer outra prova';
  $('again').dataset.topic = studyTopic ?? '';
  $('again').dataset.set = studyName && studySet ? studySet : '';
  $('verdict-label').textContent = isExam ? (result.passed ? 'Aprovada' : 'Reprovada') : (result.passed ? 'Mandou bem' : 'Ainda não');
  $('verdict-correct').textContent = String(result.correct);
  $('verdict-total').textContent = ` de ${result.total}`;
  const minutes = Math.round((view.finishedAt - view.startedAt) / 60_000);
  $('verdict-detail').textContent = `${past ? `${KIND_NAMES[view.kind]} de ${when(view.finishedAt)}. ` : ''}${isExam ? 'Precisava de' : 'Na proporção da prova, precisaria de'} ${result.needed} acertos. ${isExam ? `Tempo usado: ${minutes} min.` : ''}`.trim();
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
  reviewFilter = result.wrong.length ? 'wrong' : 'right';
  renderReview();
  show('result');
}

const FILTERS = { wrong: 'Erradas', right: 'Certas', all: 'Todas' };

// The correction of the round on screen: every question can be reread with its right answer and comment.
function renderReview() {
  const view = viewing;
  const counts = Object.fromEntries(Object.keys(FILTERS).map(filter => [filter, reviewPositions(view, bank, filter).length]));
  $('review-title').textContent = counts.wrong ? 'Correção' : 'Você acertou todas!';
  $('review-filter').replaceChildren(...Object.entries(FILTERS).map(([filter, name]) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter';
    chip.classList.toggle('active', filter === reviewFilter);
    chip.setAttribute('aria-pressed', String(filter === reviewFilter));
    chip.textContent = `${name} ${counts[filter]}`;
    chip.disabled = !counts[filter];
    chip.addEventListener('click', () => { reviewFilter = filter; renderReview(); });
    return chip;
  }));
  $('review-list').replaceChildren(...reviewPositions(view, bank, reviewFilter).map(position => {
    const id = view.ids[position];
    const question = byId.get(id);
    const given = view.answers[position];
    const right = given === question.answer;
    const item = document.createElement('li');
    item.className = `review-item ${right ? 'is-right' : 'is-wrong'}`;
    const letter = option => LETTERS[view.orders[position].indexOf(option)];
    const parts = [`<p class="review-meta"></p>`, question.image ? '<div class="review-sign"></div>' : '', '<p class="review-q"></p>', '<p class="review-given"></p>', right ? '' : '<p class="review-right"></p>', question.explanation ? '<p class="review-why"></p>' : ''];
    item.innerHTML = parts.join('');
    const figure = roadFigure(id, `review-road-${position}`);
    if (figure) item.append(figure);
    item.querySelector('.review-meta').textContent = `Questão ${position + 1} · ${TOPICS[question.topic]} · ${right ? 'acertou' : given === null ? 'em branco' : 'errou'}`;
    if (question.image) item.querySelector('.review-sign').append(signSvg(question.image, `review-clip-${position}`));
    item.querySelector('.review-q').textContent = question.text;
    item.querySelector('.review-given').textContent = given === null ? 'Você deixou em branco.' : `Você marcou: ${letter(given)}) ${question.options[given]}`;
    if (!right) item.querySelector('.review-right').textContent = `Certa: ${letter(question.answer)}) ${question.options[question.answer]}`;
    if (question.explanation) item.querySelector('.review-why').textContent = question.explanation;
    return item;
  }));
}

const newExam = () => startAttempt(drawExam(bank, Math.random, load(KEYS.seen, [])), 'exam');
$('start').addEventListener('click', newExam);
$('resume').addEventListener('click', openExam);
$('review').addEventListener('click', () => {
  const missed = load(KEYS.missed, []).filter(id => byId.has(id));
  if (missed.length) startAttempt(missed.slice(0, 30), 'review');
});
$('q-prev').addEventListener('click', () => { attempt = goTo(attempt, attempt.index - 1); persistAttempt(); renderQuestion(); });
$('q-next').addEventListener('click', () => {
  if (attempt.index === attempt.ids.length - 1) return attempt.kind === 'study' && !unanswered(attempt) ? submit() : askSubmit();
  attempt = goTo(attempt, attempt.index + 1);
  persistAttempt();
  renderQuestion();
});
$('submit').addEventListener('click', askSubmit);
$('confirm').addEventListener('close', () => { if ($('confirm').returnValue === 'ok' && attempt && !attempt.finishedAt) submit(); });
$('again').addEventListener('click', event => {
  const { topic, set } = event.currentTarget.dataset;
  if (set) startSet(set);
  else if (topic) startAttempt(drawStudy(bank, topic, STUDY_SIZE, Math.random, load(KEYS.seen, [])), 'study');
  else newExam();
});
$('retry-wrong').addEventListener('click', () => startAttempt(score(viewing, bank).wrong, 'review'));
$('home-link').addEventListener('click', renderHome);
$('sync-create').addEventListener('click', async () => {
  const result = await sync({ code: newCode(), create: true });
  notify(result.ok ? 'Código criado. Guarde-o: sem ele não dá para reconectar.' : 'Sem internet agora. Tente de novo.');
  renderSync();
});
$('sync-now').addEventListener('click', async () => {
  $('sync-status').textContent = 'Sincronizando…';
  const result = await sync();
  if (!result.ok) notify('Sem internet agora. Tente de novo.');
});
$('sync-join').addEventListener('submit', async event => {
  event.preventDefault();
  const code = parseCode($('sync-input').value);
  if (!code) return notify('Confira o código: são 20 letras e números.');
  if (hasLocalProgress() && !window.confirm('Este aparelho já tem progresso. Ele vai se juntar ao desse código, e isso não dá para desfazer. Use só um código seu. Continuar?')) return;
  const result = await sync({ code });
  notify(result.ok ? 'Conectado. O progresso foi juntado.' : result.unknown ? 'Código não encontrado. Confira as letras.' : 'Sem internet agora. Tente de novo.');
  if (result.ok) $('sync-input').value = '';
  renderSync();
});
$('sync-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(formatCode(currentCode()));
    notify('Código copiado.');
  } catch {
    notify('Selecione o código e copie.');
  }
});
$('sync-off-button').addEventListener('click', () => {
  if (!window.confirm(`Este aparelho para de sincronizar, e o progresso dele continua aqui. Para reconectar depois, anote o código: ${formatCode(currentCode())}. Desconectar?`)) return;
  disconnect();
  renderSync();
});
$('reload').addEventListener('click', () => window.location.reload());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  tick();
  // Coming back to an open tab: pick up what the other device did, at most once a minute.
  if (bank && currentCode() && !$('home').hidden && Date.now() - lastSync > 60_000) sync();
});

// Read the drill's link once and drop it, so a later reload never starts a round nobody asked for.
const wantsLines = window.location.hash === '#linhas';
if (wantsLines) history.replaceState(null, '', window.location.pathname);

try {
  const response = await fetch(assetUrl('/questions.json'), { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load questions');
  bank = validateBank(await response.json());
  byId = new Map(bank.questions.map(q => [q.id, q]));
  attempt = restoreAttempt(bank, load(KEYS.attempt, null));
  if (attempt && !attempt.finishedAt && isExpired(attempt, Date.now())) {
    submit();
    notify('O tempo acabou enquanto a página estava fechada. A prova foi entregue.');
  } else if (attempt && !attempt.finishedAt && wantsLines) {
    // Never throw away a running exam; the home screen offers both "continue" and the line questions.
    renderHome();
    notify('Você tem uma prova em andamento.');
  } else if (attempt && !attempt.finishedAt) {
    openExam();
  } else if (wantsLines) {
    startSet('linhas');
  } else {
    renderHome();
  }
  // Pull what the other devices did; never blocks opening the page.
  if (currentCode()) sync();
} catch (error) {
  console.error('Não foi possível abrir o simulado:', error.message);
  $('error').hidden = false;
} finally {
  $('loading').hidden = true;
}
