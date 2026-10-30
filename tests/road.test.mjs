import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCENES, BANK_SCENES, WHO, canCross, whoCanPass, explain, makeRound, question, roadSvg } from '../public/road.js';
import { validateBank, drawSet, newAttempt, optionOrders, restoreAttempt } from '../public/exam.js';

const bank = validateBank(JSON.parse(await readFile(new URL('../public/questions.json', import.meta.url), 'utf8')));
const byId = new Map(bank.questions.map(q => [q.id, q]));

function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

test('the line next to your lane decides whether you may cross it', () => {
  assert.equal(whoCanPass('continua'), 'ninguem');
  assert.equal(whoCanPass('tracejada'), 'ambos');
  assert.equal(whoCanPass('dupla-continua'), 'ninguem');
  assert.equal(whoCanPass('mista-eu-continua'), 'outro');
  assert.equal(whoCanPass('mista-eu-tracejada'), 'eu');
  assert.equal(canCross('branca-continua'), false);
  assert.equal(canCross('branca-tracejada'), true);
});

test('every bank question with a road picture exists and agrees with the picture', () => {
  for (const [id, scene] of Object.entries(BANK_SCENES)) {
    assert.ok(byId.has(id), `${id} is not in the bank`);
    assert.ok(SCENES[scene], `${id} has unknown scene ${scene}`);
  }
  const right = id => byId.get(id).options[byId.get(id).answer];
  // The exam's own wording for the mixed line, the one she got stuck on.
  assert.match(right('bnq-2-1-23'), /apenas para os veículos no sentido oposto/);
  assert.match(right('bnq-1-1-306'), /lado da linha tracejada pode/);
  assert.match(right('bnq-1-1-285'), /proibida para os dois sentidos/);
  assert.match(right('bnq-1-1-286'), /Ultrapassar com segurança/);
  assert.match(right('bnq-1-1-288'), /sem mudar de pista/);
  assert.match(right('bnq-2-1-33'), /mesmo sentido/);
});

test('a drill round mixes questions, never shows the same road twice in a row and always has its answer among the options', () => {
  for (let seed = 1; seed < 5000; seed++) {
    const round = makeRound(12, seeded(seed));
    assert.equal(round.length, 12);
    round.forEach((item, i) => {
      if (i) assert.notEqual(item.scene, round[i - 1].scene, `seed ${seed} repeats at ${i}`);
      const q = question(item);
      assert.ok(q.options.some(([key]) => key === q.answer), `${item.scene}/${item.ask}`);
      assert.ok(q.explanation.length > 20);
      if (item.ask === 'quem') assert.equal(SCENES[item.scene].flow, 'opostos');
    });
    assert.ok(round.some(item => item.ask === 'cor'));
    assert.ok(round.some(item => item.scene.startsWith('mista')), `seed ${seed} has no mixed line`);
  }
  assert.deepEqual(Object.keys(WHO), ['eu', 'outro', 'ambos', 'ninguem']);
  // The exam's own trap: two alternatives say "ambos", one allowing and one forbidding.
  assert.equal(Object.values(WHO).filter(text => /ambos os sentidos/.test(text)).length, 2);
});

test('every scene draws a well-formed picture', () => {
  for (const scene of Object.keys(SCENES)) {
    for (const ask of ['eu', 'quem', 'cor']) {
      for (const reveal of [false, true]) {
        const svg = roadSvg(scene, { ask, reveal, id: `t-${scene}` });
        assert.match(svg, /^<svg class="road" viewBox="0 0 240 320"/);
        assert.doesNotMatch(svg, /undefined|NaN/);
        // The colour question cannot be given away by arrows or the oncoming car.
        if (ask === 'cor') assert.doesNotMatch(svg, /stroke-opacity=".45"|#f2e6c9/);
        // "Can you pass?" is about the paint, not about traffic, so no oncoming car beside the truck.
        if (ask === 'eu') assert.doesNotMatch(svg, /rx="10" fill="#f2e6c9"/);
        if (!reveal) assert.doesNotMatch(svg, /road-glow/);
      }
    }
    assert.ok(explain(scene).length > 20);
    // A solid line forbids crossing for any reason, as bnq-2-1-20 says ("a ultrapassagem e o retorno").
    if (SCENES[scene].mine === 'continua' && SCENES[scene].theirs === 'continua') assert.match(explain(scene), /retorno/);
  }
  assert.match(roadSvg('canalizacao', { id: 'abc' }), /clipPath id="hatch-abc"/);
});

test('the line study set draws only its own questions and survives a reload', () => {
  const ids = Object.keys(BANK_SCENES);
  const drawn = drawSet(bank, ids, 10, seeded(7), []);
  assert.equal(drawn.length, 10);
  assert.ok(drawn.every(id => ids.includes(id)));
  const unseen = drawSet(bank, ids, 10, seeded(7), drawn);
  assert.equal(unseen.filter(id => drawn.includes(id)).length, 2, 'unseen questions come first');
  const attempt = newAttempt(drawn, { now: 1, kind: 'study', set: 'linhas', orders: optionOrders(bank, drawn) });
  assert.equal(restoreAttempt(bank, JSON.parse(JSON.stringify(attempt))).set, 'linhas');
  assert.equal(restoreAttempt(bank, { ...attempt, set: undefined }).set, null);
});
