// Converts the official Banco Nacional de Questões (Senatran v1.0) into public/questions.json.
// Input is the PDF as text: pdftotext -layout bnq.pdf bnq.txt
// Usage: node scripts/import-bnq.mjs bnq.txt
import { readFile, writeFile } from 'node:fs/promises';

const FOOTER = 'CNH do Brasil - Ministério dos Transportes - Secretaria Nacional de Trânsito';
const MODULES = { 1: 'placas', 2: 'escolhas', 3: 'seguranca', 4: 'cuidar' };
// Questions that point at a sign ("a placa acima") cannot be answered without seeing it.
const NEEDS_SIGN = /\b(esta|essa|desta|dessa|nesta|nessa|nesse|neste)\b|acima|abaixo|a seguinte|a placa(?! de)/i;

const [input] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/import-bnq.mjs bnq.txt');
const lines = (await readFile(input, 'utf8')).split('\n').map(line => line.trim());
const decks = JSON.parse(await readFile(new URL('../public/decks.json', import.meta.url), 'utf8'));

// Sign crops already cut for the flashcards; codes printed twice on the sheet are ambiguous.
const signCards = decks.decks.flatMap(deck => deck.cards).filter(card => card.sourceCode && card.image);
const codeCount = new Map();
for (const card of signCards) codeCount.set(card.sourceCode, (codeCount.get(card.sourceCode) ?? 0) + 1);
const signImage = new Map(signCards.filter(card => codeCount.get(card.sourceCode) === 1).map(card => [card.sourceCode, card.image]));

const raw = [];
let part = 0;
let module = 0;
let current = null;
let field = null;
for (const line of lines) {
  if (!line || line === FOOTER) continue;
  let match;
  if ((match = line.match(/^PARTE (\d)/))) { part = Number(match[1]); current = null; continue; }
  if ((match = line.match(/^MÓDULO (\d) - /))) { module = Number(match[1]); current = null; continue; }
  if ((match = line.match(/^● \((Fácil|Intermediário|Difícil)\) (\d+)\. (.*)$/))) {
    current = { part, module, level: match[1], n: Number(match[2]), text: match[3], sign: null, correct: '', comment: '', wrong: [] };
    raw.push(current);
    field = 'text';
    continue;
  }
  if (!current) continue;
  if (line.startsWith('Código da placa:')) { current.sign = line.slice(16).trim(); field = null; continue; }
  if (line.startsWith('Alternativa correta:')) { current.correct = line.slice(20).trim(); field = 'correct'; continue; }
  if (line.startsWith('Comentário:')) { current.comment = line.slice(11).trim(); field = 'comment'; continue; }
  if (line.startsWith('Respostas incorretas')) { field = null; continue; }
  if (line.startsWith('✗')) { current.wrong.push(line.slice(1).trim()); field = 'wrong'; continue; }
  if (field === 'wrong') current.wrong[current.wrong.length - 1] += ` ${line}`;
  else if (field) current[field] += ` ${line}`;
  else throw new Error(`Unexpected line after question ${current.part}.${current.module}.${current.n}: ${line}`);
}

const normalise = text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const seen = new Set();
const skipped = { duplicate: 0, missingSign: [] };
const questions = [];
for (const item of raw) {
  const correct = item.correct.replace(/\s*✓\s*$/, '').trim();
  if (item.wrong.length !== 3 || !correct) throw new Error(`Malformed question ${item.part}.${item.module}.${item.n}`);
  const key = normalise(item.text);
  if (seen.has(key)) { skipped.duplicate++; continue; }
  seen.add(key);
  const image = item.sign ? signImage.get(item.sign) : undefined;
  if (item.sign && !image && NEEDS_SIGN.test(item.text)) { skipped.missingSign.push(item.sign); continue; }
  questions.push({
    id: `bnq-${item.part}-${item.module}-${item.n}`,
    topic: MODULES[item.module],
    level: item.level,
    text: item.text,
    options: [correct, ...item.wrong],
    answer: 0,
    explanation: item.comment || undefined,
    ...(item.sign ? { sign: item.sign } : {}),
    ...(image ? { image } : {}),
  });
}

// Senatran does not publish the per-module split, so the exam samples each module in proportion to the bank.
const sizes = Object.values(MODULES).map(topic => [topic, questions.filter(q => q.topic === topic).length]);
const quotas = sizes.map(([topic, size]) => [topic, 30 * size / questions.length]);
const distribution = Object.fromEntries(quotas.map(([topic, quota]) => [topic, Math.floor(quota)]));
let missing = 30 - Object.values(distribution).reduce((sum, count) => sum + count, 0);
for (const [topic] of [...quotas].sort((a, b) => (b[1] % 1) - (a[1] % 1))) {
  if (missing-- <= 0) break;
  distribution[topic]++;
}

const payload = {
  version: 1,
  source: 'Banco Nacional de Questões v1.0 — CNH do Brasil, Ministério dos Transportes / Senatran (dez. 2025)',
  exam: { questions: 30, passScore: 20, minutes: 60, distribution },
  questions,
};
await writeFile(new URL('../public/questions.json', import.meta.url), `${JSON.stringify(payload, null, 1)}\n`);
console.log(`${raw.length} lidas, ${questions.length} no banco, ${skipped.duplicate} repetidas, ${skipped.missingSign.length} sem imagem da placa (${[...new Set(skipped.missingSign)].join(', ')})`);
console.log('Prova por módulo:', distribution);
