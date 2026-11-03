// Calculations follow Swiss Research Excelbook 1.2. See docs/methodology.md.
export const metricIds = ['SUM', 'UMUX', 'CES', 'NPS', 'CSI', 'ODI', 'Kano', 'PSM'];
export const schemas = {
  SUM: [['ease', 1, 5], ['timeRating', 1, 5], ['satisfaction', 1, 5], ['success', 0, 1], ['time', 0, Infinity]],
  UMUX: [['capabilities', 1, 5], ['ease', 1, 5]],
  CES: [['agreement', 1, 5]], NPS: [['recommendation', 0, 10]],
  CSI: [['feature'], ['importance', 1, 5], ['satisfaction', 1, 5]],
  ODI: [['feature'], ['importance', 1, 5], ['satisfaction', 1, 5]],
  Kano: [['feature'], ['presence', 1, 5], ['absence', 1, 5]],
  PSM: [['tooExpensive', 0, Infinity], ['tooCheap', 0, Infinity], ['expensive', 0, Infinity], ['cheap', 0, Infinity]],
};
export const mean = values => values.reduce((sum, n) => sum + n, 0) / values.length;
export const sd = values => {
  if (values.length < 2) return null;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, n) => sum + (n - average) ** 2, 0) / (values.length - 1));
};
export function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * p, lo = Math.floor(index);
  return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo);
}
export function normalCdf(z) {
  if (z === 0) return 0.5;
  const x = Math.abs(z), t = 1 / (1 + 0.2316419 * x);
  const tail = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - tail : tail;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const zValue = confidence => Number(confidence) === 90 ? 1.6448536269514722 : 1.959963984540054;
const normalize = value => String(value ?? '').trim().toLocaleLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const ratings = [
  ['strongly disagree', 'полностью не согласен', 'совершенно не согласен', 'very difficult', 'очень сложно', 'очень трудно', 'very unsatisfied', 'очень не удовлетворен', 'very dissatisfied', 'too much time', 'слишком много времени', 'i dislike it, and i can’t accept it'],
  ['disagree', 'не согласен', 'скорее не согласен', 'difficult', 'сложно', 'трудно', 'unsatisfied', 'не удовлетворен', 'dissatisfied', 'some time', 'много времени', 'i dislike it, but i can live with it that way'],
  ['neutral', 'нейтрально', 'нейтральное', 'затрудняюсь ответить', 'i am neutral', 'мне безразлично'],
  ['agree', 'согласен', 'скорее согласен', 'easy', 'легко', 'little time', 'немного времени', 'satisfied', 'удовлетворен', 'i expect it that way', 'так и должно быть'],
  ['strongly agree', 'полностью согласен', 'совершенно согласен', 'very easy', 'очень легко', 'very little time', 'очень мало времени', 'very satisfied', 'очень удовлетворен', 'i enjoy it that way', 'мне это нравится'],
];
const aliases = new Map(ratings.flatMap((list, i) => list.map(text => [normalize(text), i + 1])));
export function parseNumber(value, key) {
  if (typeof value === 'number') return value;
  const text = normalize(value);
  if (!text) return NaN;
  if (key === 'success') {
    if (['yes', 'true', 'да', 'успех', 'успешно'].includes(text)) return 1;
    if (['no', 'false', 'нет', 'неуспешно', 'неудача'].includes(text)) return 0;
  }
  if (['ease', 'timeRating', 'satisfaction', 'capabilities', 'agreement', 'importance', 'presence', 'absence'].includes(key) && aliases.has(text)) return aliases.get(text);
  const number = text.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(number) ? Number(number) : NaN;
}

export function parseDelimited(text) {
  text = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!text.trim()) return [];
  const first = text.split('\n')[0];
  let inside = false;
  const counts = { '\t': 0, ';': 0, ',': 0 };
  for (let i = 0; i < first.length; i++) {
    if (first[i] === '"') inside = !inside;
    else if (!inside && first[i] in counts) counts[first[i]]++;
  }
  const delimiter = counts['\t'] ? '\t' : counts[';'] ? ';' : ',';
  const rows = [], row = [];
  let value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === '\n')) {
      row.push(value); value = '';
      if (char === '\n') { rows.push([...row]); row.length = 0; }
    } else value += char;
  }
  if (quoted) throw new Error('unclosedQuote');
  row.push(value); rows.push(row);
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}
export function toDelimited(rows, separator = '\t') {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    return /["\t,;\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(separator)).join('\n');
}
export function validateRows(metric, input, hasHeader = false) {
  const schema = schemas[metric], rows = [], issues = [];
  for (let index = hasHeader ? 1 : 0; index < input.length; index++) {
    const raw = input[index];
    if (raw.every(value => String(value ?? '').trim() === '')) continue;
    const row = {}; let invalid = false;
    if (raw.slice(schema.length).some(value => String(value ?? '').trim())) {
      issues.push({ row: index + 1, key: 'columns', code: 'extraColumns' }); continue;
    }
    for (let j = 0; j < schema.length; j++) {
      const [key, min, max] = schema[j];
      const value = String(raw[j] ?? '').trim();
      if (!value) { issues.push({ row: index + 1, key, code: 'required' }); invalid = true; continue; }
      if (key === 'feature') { row[key] = value; continue; }
      const number = parseNumber(raw[j], key);
      if (!Number.isFinite(number) || number < min || number > max || (max !== Infinity && !Number.isInteger(number)) || (max === Infinity && number <= 0)) {
        issues.push({ row: index + 1, key, code: 'range' }); invalid = true;
      } else row[key] = number;
    }
    if (!invalid && metric === 'PSM' && !(row.tooCheap <= row.cheap && row.cheap <= row.expensive && row.expensive <= row.tooExpensive)) {
      issues.push({ row: index + 1, key: 'prices', code: 'priceOrder' }); invalid = true;
    }
    if (!invalid) rows.push(row);
  }
  return { rows, issues, excluded: new Set(issues.map(i => i.row)).size };
}
const frequencies = (values, lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => ({ label: String(i + lo), value: values.filter(v => v === i + lo).length }));
function groups(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.feature)) grouped.set(row.feature, []);
    grouped.get(row.feature).push(row);
  }
  return [...grouped].map(([name, rows]) => ({ name, rows }));
}
// Rows/columns are numerical codes 1..5, exactly as evaluated by Kano!BC5.
export const kanoMatrix = [
  ['Q', 'R', 'R', 'R', 'R'],
  ['M', 'Q', 'I', 'I', 'R'],
  ['M', 'I', 'I', 'I', 'R'],
  ['M', 'I', 'I', 'Q', 'R'],
  ['P', 'A', 'A', 'A', 'Q'],
];
export const kanoCategory = (presence, absence) => kanoMatrix[presence - 1][absence - 1];
const countLess = (values, x, inclusive = false) => {
  let low = 0, high = values.length;
  while (low < high) { const mid = (low + high) >>> 1; if (values[mid] < x || (inclusive && values[mid] === x)) low = mid + 1; else high = mid; }
  return low;
};
export function crossing(curves, a, b) {
  for (let i = 0; i < curves.length; i++) {
    const difference = curves[i][a] - curves[i][b];
    if (Math.abs(difference) < 1e-12) {
      let end = i;
      while (end + 1 < curves.length && Math.abs(curves[end + 1][a] - curves[end + 1][b]) < 1e-12) end++;
      return (curves[i].price + curves[end].price) / 2;
    }
    if (i && difference * (curves[i - 1][a] - curves[i - 1][b]) < 0) {
      const previous = curves[i - 1], d0 = previous[a] - previous[b];
      return previous.price + (curves[i].price - previous.price) * d0 / (d0 - difference);
    }
  }
  return null;
}

export function calculate(metric, rows, options = {}) {
  const n = rows.length, base = { n, score: null, bars: [], table: [], points: [], ci: null };
  if (!n) return base;
  if (metric === 'NPS') {
    const values = rows.map(r => r.recommendation);
    const detractors = values.filter(v => v <= 6).length, passives = values.filter(v => v === 7 || v === 8).length, promoters = values.filter(v => v >= 9).length;
    const score = (promoters - detractors) / n * 100, adjustedN = n + 3;
    const pp = (promoters + 0.75) / adjustedN, pd = (detractors + 0.75) / adjustedN;
    const margin = zValue(options.confidence ?? 90) * Math.sqrt((pp + pd - (pp - pd) ** 2) / adjustedN) * 100;
    const center = (pp - pd) * 100;
    return { ...base, score, range: [-100, 100], ci: [clamp(center - margin, -100, 100), clamp(center + margin, -100, 100)], confidence: options.confidence ?? 90, bars: frequencies(values, 0, 10), categories: [{ key: 'detractors', value: detractors }, { key: 'passives', value: passives }, { key: 'promoters', value: promoters }], mean: mean(values) };
  }
  if (metric === 'UMUX') {
    const values = rows.map(r => ((r.capabilities + r.ease - 2) / 8) * 100), score = mean(values);
    const margin = n > 1 ? zValue(options.confidence ?? 95) * sd(values) / Math.sqrt(n) : null;
    return { ...base, score, range: [0, 100], ci: margin === null ? null : [clamp(score - margin, 0, 100), clamp(score + margin, 0, 100)], confidence: options.confidence ?? 95, bars: [{ key: 'capabilities', value: mean(rows.map(r => r.capabilities)) }, { key: 'ease', value: mean(rows.map(r => r.ease)) }], chartMax: 5, individual: values };
  }
  if (metric === 'CES') {
    const values = rows.map(r => r.agreement), positive = values.filter(v => v >= 4).length;
    return { ...base, score: positive / n * 100, range: [0, 100], mean: mean(values), bars: frequencies(values, 1, 5), positive };
  }
  if (metric === 'CSI' || metric === 'ODI') {
    const table = groups(rows).map(({ name, rows: g }) => ({ name, n: g.length, importance: metric === 'CSI' ? mean(g.map(r => r.importance)) : g.filter(r => r.importance >= 4).length / g.length * 10, satisfaction: metric === 'CSI' ? mean(g.map(r => r.satisfaction)) : g.filter(r => r.satisfaction >= 4).length / g.length * 10 }));
    if (metric === 'CSI') {
      const total = table.reduce((sum, r) => sum + r.importance, 0);
      table.forEach(r => { r.weight = r.importance / total; r.contribution = r.weight * r.satisfaction; });
      return { ...base, score: table.reduce((sum, r) => sum + r.contribution, 0), range: [1, 5], table, points: table.map(r => ({ label: r.name, x: r.importance, y: r.satisfaction })), chartMax: 5 };
    }
    table.forEach(r => { r.opportunity = r.importance + Math.max(r.importance - r.satisfaction, 0); });
    table.sort((a, b) => b.opportunity - a.opportunity);
    return { ...base, score: table[0].opportunity, range: [0, 20], table, points: table.map(r => ({ label: r.name, x: r.importance, y: r.satisfaction })), chartMax: 10 };
  }
  if (metric === 'Kano') {
    const table = groups(rows).map(({ name, rows: g }) => {
      const counts = Object.fromEntries(['M', 'P', 'A', 'I', 'Q', 'R'].map(c => [c, 0]));
      g.forEach(r => counts[kanoCategory(r.presence, r.absence)]++);
      const max = Math.max(...Object.values(counts)), categories = Object.keys(counts).filter(c => counts[c] === max);
      const denominator = counts.A + counts.P + counts.M + counts.I;
      return { name, n: g.length, counts, categories, better: denominator ? (counts.A + counts.P) / denominator : null, worse: denominator ? -(counts.P + counts.M) / denominator : null };
    });
    return { ...base, score: table.length, table, points: table.filter(r => r.better !== null).map(r => ({ label: r.name, x: -r.worse * 100, y: r.better * 100 })), chartMax: 100, bars: Object.keys(table[0].counts).map(key => ({ key, value: table.reduce((sum, r) => sum + r.counts[key], 0) })) };
  }
  if (metric === 'SUM') {
    const satisfaction = rows.map(r => mean([r.ease, r.timeRating, r.satisfaction]));
    const satisfactionScore = normalCdf((mean(satisfaction) - 4) / (sd(satisfaction) || 0.4));
    const completion = mean(rows.map(r => r.success));
    const eligible = rows.filter((r, i) => r.success === 1 && satisfaction[i] >= 4).map(r => r.time);
    const custom = String(options.goldenTime ?? '').trim();
    const goldenTime = custom ? parseNumber(custom, 'time') : eligible.length ? percentile(eligible, 0.95) : null;
    if (goldenTime !== null && (!Number.isFinite(goldenTime) || goldenTime <= 0)) return { ...base, problem: 'invalidGoldenTime' };
    const logs = rows.map(r => Math.log(r.time)), deviation = sd(logs);
    const timeScore = goldenTime && deviation > 0 ? normalCdf((Math.log(goldenTime) - mean(logs)) / deviation) : null;
    const bars = [{ key: 'satisfaction', value: satisfactionScore * 100 }, { key: 'completion', value: completion * 100 }, { key: 'time', value: timeScore === null ? null : timeScore * 100 }];
    return { ...base, score: timeScore === null ? null : mean(bars.map(b => b.value)), range: [0, 100], bars, chartMax: 100, goldenTime, meanTime: mean(rows.map(r => r.time)), problem: !goldenTime ? 'goldenTimeNeeded' : timeScore === null ? 'timeVariationNeeded' : null };
  }
  if (metric === 'PSM') {
    const keys = ['tooExpensive', 'tooCheap', 'expensive', 'cheap'];
    const sorted = Object.fromEntries(keys.map(key => [key, rows.map(r => r[key]).sort((a, b) => a - b)]));
    const prices = [...new Set([0, ...Object.values(sorted).flat()])].sort((a, b) => a - b);
    prices.push(prices.at(-1) * 1.01);
    const curves = prices.map(price => ({ price, tooExpensive: countLess(sorted.tooExpensive, price) / n * 100, tooCheap: (n - countLess(sorted.tooCheap, price, true)) / n * 100, expensive: countLess(sorted.expensive, price) / n * 100, cheap: (n - countLess(sorted.cheap, price, true)) / n * 100 }));
    const lower = crossing(curves, 'tooCheap', 'expensive'), upper = crossing(curves, 'cheap', 'tooExpensive');
    const optimal = crossing(curves, 'tooCheap', 'tooExpensive'), indifference = crossing(curves, 'cheap', 'expensive');
    return { ...base, score: optimal, lower, upper, indifference, curves, range: [0, prices.at(-1)] };
  }
  return base;
}

export function analyze(metric, text, options = {}) {
  try {
    const input = parseDelimited(text), validation = validateRows(metric, input, options.hasHeader);
    return { ...calculate(metric, validation.rows, options), ...validation, total: input.length - (options.hasHeader && input.length ? 1 : 0) };
  } catch (error) {
    return { n: 0, score: null, bars: [], table: [], points: [], issues: [], excluded: 0, total: 0, parseError: error.message };
  }
}
