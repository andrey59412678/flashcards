import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateBank } from '../public/exam.js';
import { FACTS, makeRound as numberRound, question as numberQuestion } from '../public/numeros.js';
import { SEQUENCES, makeRound as aidRound, question as aidQuestion, isRight } from '../public/socorro.js';
import { SCENES, makeRound as crossRound, question as crossQuestion, crossSvg } from '../public/cross.js';

const bank = validateBank(JSON.parse(await readFile(new URL('../public/questions.json', import.meta.url), 'utf8')));
const byId = new Map(bank.questions.map(q => [q.id, q]));
const right = id => byId.get(id).options[byId.get(id).answer];

function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

test('every number fact comes from a bank question or a CTB article, with four distinct options', () => {
  for (const fact of FACTS) {
    assert.ok(byId.has(fact.source) || /^CTB, art\. \d+$/.test(fact.source), `${fact.prompt}: unknown source ${fact.source}`);
    assert.equal(new Set([fact.answer, ...fact.wrong]).size, 4, fact.prompt);
    assert.ok(fact.why && fact.group);
  }
  // The figures match the bank's own right answers.
  for (const [id, figure] of [['bnq-1-3-490', '30'], ['bnq-1-3-13', '40'], ['bnq-1-3-458', '60'], ['bnq-1-3-492', '80'], ['bnq-2-2-31', '3 pontos'], ['bnq-2-2-3', '7 pontos'], ['bnq-2-2-15', '40'], ['bnq-1-4-13', '5 anos'], ['bnq-1-4-14', '3 anos'], ['bnq-2-3-33', '1,5'], ['bnq-1-3-484', '30 metros'], ['bnq-2-4-27', '191'], ['bnq-1-2-46', '10 anos'], ['bnq-1-3-453', '3.500']]) {
    assert.ok(right(id).includes(figure), `${id}: "${right(id)}" should include ${figure}`);
    const fact = FACTS.find(item => item.source === id);
    assert.ok(fact.answer.includes(figure.split(' ')[0]), `${id}: fact answer ${fact.answer}`);
  }
});

test('a numbers round spreads across groups, never repeats a fact and keeps the answer among the options', () => {
  for (let seed = 1; seed < 300; seed++) {
    const round = numberRound(12, seeded(seed));
    assert.equal(round.length, 12);
    assert.equal(new Set(round.map(item => item.prompt)).size, 12);
    assert.ok(new Set(round.map(item => item.group)).size >= 5);
    for (const item of round) assert.ok(item.options.some(([key]) => key === item.answer));
  }
  assert.equal(numberQuestion(FACTS[0]).options.length, 4);
});

test('first-aid sequences cite real bank questions and never start already in order', () => {
  for (const sequence of SEQUENCES) {
    for (const id of sequence.sources) assert.ok(byId.has(id), `${id} is not in the bank`);
    for (let seed = 1; seed < 200; seed++) {
      const item = aidQuestion(sequence, seeded(seed));
      assert.deepEqual([...item.shown].sort(), sequence.steps.map((_, i) => i));
      assert.ok(!isRight(item.shown), 'shown in the right order');
    }
  }
  assert.ok(isRight([0, 1, 2]));
  assert.ok(!isRight([1, 0, 2]));
  assert.equal(aidRound().length, SEQUENCES.length);
  // The orders agree with the bank: your own safety first, never remove the helmet.
  assert.match(right('bnq-1-4-85'), /própria segurança/);
  assert.match(right('bnq-2-4-5'), /capacete/);
  assert.match(right('bnq-2-4-8'), /50 metros/);
});

test('right-of-way scenes cite the bank, answer what it says, and the picture marks the winner only when revealed', () => {
  for (const [scene, spec] of Object.entries(SCENES)) {
    assert.ok(byId.has(spec.source), `${scene}: ${spec.source} is not in the bank`);
    const item = crossQuestion(scene);
    assert.ok(item.options.some(([key]) => key === item.answer), scene);
    const hidden = crossSvg(scene, { id: scene });
    assert.doesNotMatch(hidden, /cross-glow/, `${scene} gives the answer away`);
    if (spec.ask !== 'acao') assert.match(crossSvg(scene, { reveal: true, id: scene }), /cross-glow/, scene);
    assert.match(hidden, /^<svg[^>]*viewBox="0 0 300 300"/);
    assert.doesNotMatch(hidden, /NaN|undefined/, scene);
  }
  assert.match(right('bnq-1-1-8'), /direita/);
  assert.match(right('bnq-1-3-102'), /já está circulando/);
  assert.match(right('bnq-1-1-4'), /rodovia/);
  assert.match(right('bnq-1-1-231'), /agente/);
  assert.match(right('bnq-1-1-5'), /agente/);
  assert.match(right('bnq-1-1-270'), /Agente de trânsito > semáforo > placas/);
});

test('a right-of-way round shows every scene before repeating and never the same twice in a row', () => {
  const total = Object.keys(SCENES).length;
  for (let seed = 1; seed < 500; seed++) {
    const round = crossRound(total + 4, seeded(seed));
    assert.equal(new Set(round.slice(0, total).map(item => item.scene)).size, total);
    round.forEach((item, i) => { if (i) assert.notEqual(item.scene, round[i - 1].scene); });
  }
});
