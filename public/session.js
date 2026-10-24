export const FILTERS = ['all', 'warning', 'regulation'];

export function cardsFor(deck, filter) {
  return deck.cards.filter(card => filter === 'all' || card.category === filter);
}

export function shuffled(ids, random = Math.random) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function newSession(deck, filter = 'all', avoidFirst = null, random = Math.random) {
  const order = shuffled(cardsFor(deck, filter).map(card => card.id), random);
  if (order.length > 1 && order[0] === avoidFirst) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return { version: 1, deckId: deck.id, filter, order, index: 0, revealed: false };
}

export function restoreSession(decks, saved) {
  if (!saved || saved.version !== 1 || !FILTERS.includes(saved.filter)) return null;
  const deck = decks.find(item => item.id === saved.deckId);
  if (!deck) return null;
  const ids = cardsFor(deck, saved.filter).map(card => card.id);
  const allowed = new Set(ids);
  if (!Array.isArray(saved.order) || saved.order.length !== ids.length || !ids.length) return null;
  if (new Set(saved.order).size !== ids.length || saved.order.some(id => !allowed.has(id))) return null;
  if (!Number.isInteger(saved.index) || saved.index < 0 || saved.index > ids.length) return null;
  return { version: 1, deckId: deck.id, filter: saved.filter, order: [...saved.order], index: saved.index, revealed: false };
}

export function reveal(session) {
  return session.index < session.order.length ? { ...session, revealed: true } : session;
}

export function advance(session) {
  if (!session.revealed || session.index >= session.order.length) return session;
  return { ...session, index: session.index + 1, revealed: false };
}

export function previous(session) {
  return { ...session, index: Math.max(0, session.index - 1), revealed: false };
}

export function validateDecks(payload) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.decks) || !payload.decks.length) throw new Error('Invalid decks');
  const deckIds = new Set();
  for (const deck of payload.decks) {
    if (typeof deck.id !== 'string' || deckIds.has(deck.id) || typeof deck.title !== 'string' || !Array.isArray(deck.cards) || !deck.cards.length) throw new Error('Invalid deck');
    deckIds.add(deck.id);
    const cardIds = new Set();
    for (const card of deck.cards) {
      if (typeof card.id !== 'string' || cardIds.has(card.id) || typeof card.answer !== 'string' || !card.answer.trim() || typeof card.prompt !== 'string' || !card.prompt.trim()) throw new Error('Invalid card');
      cardIds.add(card.id);
      if (card.image) {
        const { src, width, height, crop } = card.image;
        if (typeof src !== 'string' || !src.startsWith('/assets/') || src.includes('..') || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Array.isArray(crop) || crop.length !== 4 || crop.some(value => !Number.isFinite(value))) throw new Error('Invalid image');
        const [x, y, w, h] = crop;
        if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > width || y + h > height) throw new Error('Invalid crop');
      }
    }
  }
  return payload.decks;
}
