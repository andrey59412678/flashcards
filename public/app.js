import { cardsFor, newSession, restoreSession, reveal, advance, previous, validateDecks } from './session.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'flashcards.session.v1';
const categoryNames = { warning: 'Advertência', regulation: 'Regulamentação' };
const svgNS = 'http://www.w3.org/2000/svg';
// Decks keep root-absolute paths, but the app also runs under a subpath (GitHub Pages).
const appBase = new URL('.', import.meta.url);
const assetUrl = path => new URL(path.replace(/^\//, ''), appBase).href;
let decks = [];
let session = null;
let cardMap = new Map();
let toastTimer;

function persist() {
  try {
    const { revealed, ...saved } = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    $('storage-notice').hidden = true;
  } catch {
    $('storage-notice').hidden = false;
  }
}

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2400);
}

function showImage(card) {
  $('visual').replaceChildren();
  if (!card.image) return;
  const { src, width, height, crop } = card.image;
  const svg = document.createElementNS(svgNS, 'svg');
  svg.classList.add('sign-image');
  svg.setAttribute('viewBox', crop.join(' '));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Placa de trânsito para identificar');
  svg.setAttribute('focusable', 'false');
  const image = document.createElementNS(svgNS, 'image');
  image.setAttribute('href', assetUrl(src));
  image.setAttribute('width', String(width));
  image.setAttribute('height', String(height));
  // Explicit clipping also hides captions in the letterbox around non-square signs.
  const defs = document.createElementNS(svgNS, 'defs');
  const clip = document.createElementNS(svgNS, 'clipPath');
  clip.id = 'current-sign-clip';
  const rect = document.createElementNS(svgNS, 'rect');
  ['x', 'y', 'width', 'height'].forEach((attribute, index) => rect.setAttribute(attribute, String(crop[index])));
  clip.append(rect);
  defs.append(clip);
  image.setAttribute('clip-path', 'url(#current-sign-clip)');
  svg.append(defs, image);
  $('visual').append(svg);
}

function render() {
  const deck = decks.find(item => item.id === session.deckId);
  cardMap = new Map(deck.cards.map(card => [card.id, card]));
  $('deck-title').textContent = deck.title;
  $('deck-description').textContent = deck.id === 'autoescola' ? 'Veja a placa. Lembre o significado.' : (deck.description ?? 'Pense na resposta. Depois, revele.');
  $('deck-select').value = deck.id;
  document.querySelector('[data-count="all"]').textContent = String(deck.cards.length);
  document.querySelectorAll('[data-filter]').forEach(button => {
    const selected = session.filter === button.dataset.filter;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
    const available = cardsFor(deck, button.dataset.filter).length;
    button.hidden = button.dataset.filter !== 'all' && !available;
    button.disabled = !available;
  });
  const done = session.index >= session.order.length;
  $('study').hidden = done;
  $('completed').hidden = !done;
  if (done) {
    $('completed-description').textContent = `Você percorreu ${session.order.length} ${session.order.length === 1 ? 'cartão' : 'cartões'}. Que tal mais uma volta para fixar?`;
    persist();
    return;
  }
  const card = cardMap.get(session.order[session.index]);
  const remaining = session.order.length - session.index - 1;
  $('position').textContent = `Cartão ${session.index + 1} de ${session.order.length}`;
  $('remaining').textContent = remaining ? `${remaining} ${remaining === 1 ? 'restante' : 'restantes'}` : 'Último cartão';
  $('progress').max = session.order.length;
  $('progress').value = session.index;
  $('card-category').textContent = categoryNames[card.category] ?? 'Treino de memória';
  $('flashcard').classList.toggle('revealed', session.revealed);
  $('flashcard').classList.toggle('text-only', !card.image);
  showImage(card);
  $('prompt').hidden = Boolean(card.image);
  $('prompt').textContent = card.image ? '' : card.prompt;
  $('answer-area').replaceChildren();
  if (session.revealed) {
    const text = document.createElement('p');
    text.className = 'answer';
    text.textContent = card.answer;
    $('answer-area').append(text);
  }
  $('primary-label').textContent = session.revealed ? (remaining ? 'Próxima placa' : 'Concluir rodada') : 'Revelar resposta';
  if (session.revealed && !card.image && remaining) $('primary-label').textContent = 'Próximo cartão';
  $('reveal-icon').hidden = session.revealed;
  $('next-icon').hidden = !session.revealed;
  $('hide-answer').hidden = !session.revealed;
  $('previous').disabled = session.index === 0;
  persist();
}

function shuffle() {
  if (!session) return;
  const deck = decks.find(item => item.id === session.deckId);
  session = newSession(deck, session.filter, session.order[session.index]);
  render();
  notify('Baralho embaralhado. Nova rodada!');
}

function primaryAction() {
  if (!session || session.index >= session.order.length) return;
  session = session.revealed ? advance(session) : reveal(session);
  render();
  if (session.index >= session.order.length) $('restart').focus({ preventScroll: true });
}

$('primary').addEventListener('click', primaryAction);
$('previous').addEventListener('click', () => { session = previous(session); render(); });
$('shuffle').addEventListener('click', shuffle);
$('restart').addEventListener('click', () => { shuffle(); $('primary').focus({ preventScroll: true }); });
$('repeat').addEventListener('click', () => { session = { ...session, index: 0, revealed: false }; render(); $('primary').focus({ preventScroll: true }); });
$('hide-answer').addEventListener('click', () => { session = { ...session, revealed: false }; render(); $('primary').focus({ preventScroll: true }); });
$('retry').addEventListener('click', () => window.location.reload());
$('deck-select').addEventListener('change', event => {
  session = newSession(decks.find(item => item.id === event.target.value));
  render();
});
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  if (!session || session.filter === button.dataset.filter) return;
  session = newSession(decks.find(item => item.id === session.deckId), button.dataset.filter);
  render();
}));
document.addEventListener('keydown', event => {
  if (!session || event.repeat || event.altKey || event.metaKey || event.ctrlKey || /^(INPUT|TEXTAREA|SELECT|A)$/.test(event.target.tagName)) return;
  if (session.index >= session.order.length) return;
  if (event.key === ' ' && event.target.tagName === 'BUTTON') return;
  if (event.key === ' ') { event.preventDefault(); session = reveal(session); render(); }
  if (event.key === 'ArrowRight') { event.preventDefault(); session = advance(session); render(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); session = previous(session); render(); }
});

try {
  const response = await fetch(assetUrl('/decks.json'), { cache: 'no-cache' });
  if (!response.ok) throw new Error('Could not load decks');
  decks = validateDecks(await response.json());
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* A new round also works without storage. */ }
  session = restoreSession(decks, saved) ?? newSession(decks[0]);
  $('deck-select').replaceChildren(...decks.map(deck => {
    const option = document.createElement('option');
    option.value = deck.id;
    option.textContent = deck.title;
    return option;
  }));
  $('deck-picker').hidden = decks.length < 2;
  $('shuffle').disabled = false;
  render();
  // Load each original sheet once; the browser reuses it for every card's viewport.
  for (const src of new Set(decks.flatMap(deck => deck.cards.map(card => card.image?.src).filter(Boolean)))) {
    const image = new Image();
    image.src = assetUrl(src);
    image.decode().catch(() => {});
  }
} catch (error) {
  console.error('Não foi possível abrir o baralho:', error.message);
  $('study').hidden = true;
  $('completed').hidden = true;
  $('error').hidden = false;
} finally {
  $('loading').hidden = true;
}
