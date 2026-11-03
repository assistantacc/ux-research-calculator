import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, calculate, kanoCategory, metricIds, normalCdf, parseDelimited, percentile, sd, toDelimited } from '../src/lib/metrics.mjs';
import { copy, demoData, getMetric } from '../src/lib/catalog.mjs';
import { freshProject, validateProject } from '../src/lib/storage.mjs';
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test('NPS category boundaries, zero, and valid-response denominator', () => {
  const r = analyze('NPS', '0\n6\n7\n8\n9\n10\n\n11\n-1\ninvalid');
  close(r.score, 0); assert.equal(r.n, 6); assert.equal(r.excluded, 3);
  assert.deepEqual(r.categories.map(c => c.value), [2, 2, 2]);
  assert.ok(r.ci[0] < 0 && r.ci[1] > 0);
  close(analyze('NPS', '9\n10').score, 100); close(analyze('NPS', '0\n6').score, -100);
});
test('NPS confidence reflects sample size and confidence level', () => {
  const data = '0\n6\n7\n8\n9\n10';
  const r90 = analyze('NPS', data, { confidence: 90 }), r95 = analyze('NPS', data, { confidence: 95 });
  assert.ok(r95.ci[1] > r90.ci[1]);
  const large = analyze('NPS', Array(20).fill(data).join('\n'));
  assert.ok(large.ci[1] < r90.ci[1]);
  assert.ok(analyze('NPS', '10').ci.every(Number.isFinite));
});
test('UMUX uses two positive five-point items, not a seven-point SUS conversion', () => {
  close(analyze('UMUX', '1\t5\n3\t5').score, 62.5);
  close(analyze('UMUX', '1\t1').score, 0); close(analyze('UMUX', '5\t5').score, 100);
  assert.equal(analyze('UMUX', '5\t5').ci, null);
  const partial = analyze('UMUX', '5\t5\n5\t\n8\t5'); assert.equal(partial.n, 1); assert.equal(partial.excluded, 2);
});
test('CES is top-two-box share and shows the mean separately', () => {
  const r = analyze('CES', '1\n2\n3\n4\n5'); close(r.score, 40); close(r.mean, 3);
  close(analyze('CES', 'Strongly agree\nПолностью согласен').score, 100);
});
test('CSI weights attribute means, not the number of observations', () => {
  const r = analyze('CSI', 'A\t5\t1\nA\t5\t1\nB\t1\t5');
  close(r.score, 5 / 3); close(r.table[0].weight, 5 / 6); close(r.table[1].weight, 1 / 6);
  assert.equal(analyze('CSI', 'A\t0\t5').n, 0);
});
test('ODI converts top-two-box shares to 0–10 and ranks opportunities', () => {
  const r = analyze('ODI', 'A\t5\t3\nA\t4\t3\nB\t3\t5\nB\t5\t5');
  assert.deepEqual(r.table.map(r => r.opportunity), [20, 5]);
  close(r.table[1].importance, 5); close(r.table[1].satisfaction, 10);
});
test('Kano reproduces all 25 workbook classification pairs', () => {
  const counts = { M: 0, P: 0, A: 0, I: 0, Q: 0, R: 0 };
  for (let p = 1; p <= 5; p++) for (let a = 1; a <= 5; a++) counts[kanoCategory(p, a)]++;
  assert.deepEqual(counts, { M: 3, P: 1, A: 3, I: 7, Q: 4, R: 7 });
  assert.equal(kanoCategory(5, 1), 'P'); assert.equal(kanoCategory(5, 3), 'A'); assert.equal(kanoCategory(3, 1), 'M');
  assert.equal(kanoCategory(2, 2), 'Q'); assert.equal(kanoCategory(4, 4), 'Q');
});
test('Kano exposes ties and unavailable coefficients rather than inventing a winner', () => {
  const r = analyze('Kano', 'A\t5\t3\nA\t3\t1');
  assert.deepEqual(r.table[0].categories, ['M', 'A']); close(r.table[0].better, .5); close(r.table[0].worse, -.5);
  const invalid = analyze('Kano', 'A\t5\t5').table[0]; assert.equal(invalid.better, null); assert.equal(invalid.worse, null);
});
test('SUM equals an independently evaluated two-observation case', () => {
  const text = '5\t5\t5\t1\t10\n3\t3\t3\t0\t100';
  const r = analyze('SUM', text); close(r.score, 41.325002, 0.00002); close(r.goldenTime, 10);
  close(analyze('SUM', text, { goldenTime: 100 }).score, 58.674998, 0.00002);
});
test('SUM explains missing golden time, zero variation and invalid manual settings', () => {
  assert.equal(analyze('SUM', '1\t1\t1\t0\t10\n2\t2\t2\t0\t20').problem, 'goldenTimeNeeded');
  assert.equal(analyze('SUM', '5\t5\t5\t1\t10').problem, 'timeVariationNeeded');
  assert.equal(analyze('SUM', demoData('SUM'), { goldenTime: '-10' }).problem, 'invalidGoldenTime');
});
test('PSM uses ordered positive prices and explicit coincident-segment midpoints', () => {
  const r = analyze('PSM', '100\t10\t70\t40\n120\t20\t80\t50');
  close(r.lower, 45); close(r.upper, 75); close(r.score, 60); close(r.indifference, 60);
  assert.equal(analyze('PSM', '10\t20\t30\t40').excluded, 1);
  assert.equal(analyze('PSM', '100\t0\t70\t40').excluded, 1);
  const flat = analyze('PSM', '10\t10\t10\t10'); close(flat.score, 10);
});
test('PSM does not depend on respondent ordering', () => {
  const rows = parseDelimited(demoData('PSM')), a = analyze('PSM', toDelimited(rows)), b = analyze('PSM', toDelimited(rows.reverse()));
  close(a.score, b.score); assert.ok(a.lower <= a.score && a.score <= a.upper);
});
test('CSV/TSV parsing preserves quoted separators, newlines and decimal commas', () => {
  const r = analyze('PSM', '100,5;10,5;70,5;40,5'); assert.equal(r.n, 1); close(r.score, 55.5);
  const rows = [['A, B; C', 'text "quoted"', 'two\nlines'], ['0', '', '5']];
  assert.deepEqual(parseDelimited(toDelimited(rows, ',')), rows);
  assert.equal(analyze('NPS', '"unclosed').parseError, 'unclosedQuote');
});
test('Explicit headers and extra columns are handled without silently using IDs', () => {
  const r = analyze('NPS', 'Rating\n0\n10', { hasHeader: true }); assert.equal(r.n, 2); close(r.score, 0);
  assert.equal(analyze('NPS', '123\t10').n, 0);
  assert.equal(analyze('CES', '0').n, 0); assert.equal(analyze('NPS', '0').n, 1);
});
test('All eight demos are complete, finite and available in both languages', () => {
  for (const lang of ['ru', 'en']) for (const id of metricIds) {
    const r = analyze(id, demoData(id, lang)); assert.ok(r.n > 0, id); assert.equal(r.excluded, 0, id); assert.ok(Number.isFinite(r.score), id);
    assert.ok(getMetric(id, lang).method); assert.ok(getMetric(id, lang).note);
  }
  assert.deepEqual(Object.keys(copy.ru).sort(), Object.keys(copy.en).sort());
});
test('Project backups validate types and preserve data across round trips', () => {
  const p = freshProject(); p.datasets.NPS.text = '0\n10'; p.datasets.NPS.isDemo = false; p.language = 'en';
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  assert.throws(() => validateProject({ version: 1, datasets: {} }));
  const bad = freshProject(); bad.datasets.NPS.text = 42; assert.throws(() => validateProject(bad));
});
test('Numerical helpers match known values and large samples remain finite', () => {
  close(normalCdf(0), .5); close(normalCdf(1.95996398454), .975, 1e-6); close(sd([1, 2, 3]), 1); close(percentile([0, 10], .95), 9.5);
  const r = calculate('UMUX', Array.from({ length: 10000 }, (_, i) => ({ capabilities: i % 5 + 1, ease: 5 })));
  close(r.score, 75); assert.ok(r.ci.every(Number.isFinite));
});
