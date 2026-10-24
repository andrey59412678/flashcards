import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cardsFor, newSession, restoreSession, reveal, advance, previous, validateDecks } from '../public/session.js';

const payload = JSON.parse(await readFile(new URL('../public/decks.json', import.meta.url), 'utf8'));
const [deck] = validateDecks(payload);

test('all 86 reference signs have unique IDs and bounded, caption-free symbol viewports', () => {
  assert.equal(deck.cards.length, 86);
  assert.equal(cardsFor(deck, 'warning').length, 55);
  assert.equal(cardsFor(deck, 'regulation').length, 31);
  assert.equal(new Set(deck.cards.map(card => card.id)).size, 86);
  for (const card of deck.cards) {
    const [,,w,h] = card.image.crop;
    assert.ok(w >= 40 && w < 100, card.id);
    assert.ok(h >= 20 && h < 100, card.id);
  }
});

test('shuffling visits each card once and does not immediately repeat the current sign', () => {
  for (const filter of ['all', 'warning', 'regulation']) {
    const ids = cardsFor(deck, filter).map(card => card.id);
    const session = newSession(deck, filter, ids[0], () => 0.9999);
    assert.deepEqual([...session.order].sort(), ids.sort());
    assert.notEqual(session.order[0], ids[0]);
    assert.equal(session.revealed, false);
  }
});

test('reveal precedes advance and the next card starts with its answer hidden', () => {
  const session = newSession(deck);
  assert.equal(advance(session), session);
  const next = advance(reveal(session));
  assert.equal(next.index, 1);
  assert.equal(next.revealed, false);
  assert.equal(previous(reveal(next)).revealed, false);
  assert.equal(previous(next).index, 0);
  assert.equal(previous(session).index, 0);
});

test('the round finishes after exactly its card count without cycling silently', () => {
  let session = newSession(deck, 'regulation');
  for (let index = 0; index < 31; index++) {
    assert.equal(session.index, index);
    session = advance(reveal(session));
  }
  assert.equal(session.index, 31);
  assert.equal(reveal(session), session);
  assert.equal(advance(session), session);
});

test('saved order and position survive reload while the answer is hidden again', () => {
  const saved = reveal(advance(reveal(newSession(deck, 'warning'))));
  const restored = restoreSession([deck], saved);
  assert.deepEqual(restored.order, saved.order);
  assert.equal(restored.index, 1);
  assert.equal(restored.revealed, false);
});

test('invalid storage and an outdated or duplicated card set reset safely', () => {
  const good = newSession(deck);
  for (const bad of [null, {}, { ...good, filter: 'missing' }, { ...good, deckId: 'gone' }, { ...good, index: -1 }, { ...good, index: 0.5 }, { ...good, index: 87 }, { ...good, order: good.order.slice(1) }, { ...good, order: good.order.map(() => good.order[0]) }, { ...good, order: [...good.order.slice(1), 'missing'] }]) {
    assert.equal(restoreSession([deck], bad), null);
  }
});

test('future decks support text-only prompts with the same session flow', () => {
  const textDeck = { id: 'theory', title: 'Teoria', cards: [{ id: 'question-1', prompt: 'Uma pergunta sem imagem?', answer: 'Uma resposta em texto.' }] };
  assert.deepEqual(validateDecks({ version: 1, decks: [textDeck] }), [textDeck]);
  const session = newSession(textDeck);
  assert.equal(session.order.length, 1);
  assert.equal(advance(reveal(session)).index, 1);
});

test('malformed or external image metadata cannot enter the renderer', () => {
  for (const image of [{ src: 'https://example.com/image.png', width: 10, height: 10, crop: [0,0,10,10] }, { src: '/assets/a.png', width: 10, height: 10, crop: [1,1,10,10] }]) {
    const bad = { version: 1, decks: [{ id: 'bad', title: 'Bad', cards: [{ id: 'x', prompt: 'Prompt', answer: 'Answer', image }] }] };
    assert.throws(() => validateDecks(bad));
  }
});
