import { metricIds } from './metrics.mjs';
import { demoData } from './catalog.mjs';
export const STORAGE_KEY = 'ux-research-calculator.v1';
export const freshDataset = (id, lang = 'ru') => ({ text: demoData(id, lang), isDemo: true, hasHeader: false, confidence: id === 'NPS' ? 90 : 95, goldenTime: '', currency: '₽' });
export const freshProject = () => ({ version: 1, language: 'ru', theme: 'light', selected: 'NPS', datasets: Object.fromEntries(metricIds.map(id => [id, freshDataset(id)])) });
export function validateProject(value) {
  if (!value || value.version !== 1 || !value.datasets || !['ru', 'en'].includes(value.language) || !['light', 'dark'].includes(value.theme) || !metricIds.includes(value.selected)) throw new Error('invalidFile');
  const result = freshProject();
  result.language = value.language; result.theme = value.theme; result.selected = value.selected;
  for (const id of metricIds) {
    const data = value.datasets[id];
    if (!data || typeof data.text !== 'string' || data.text.length > 2_000_000) throw new Error('invalidFile');
    result.datasets[id] = { text: data.text, isDemo: data.isDemo === true, hasHeader: data.hasHeader === true, confidence: [90, 95].includes(Number(data.confidence)) ? Number(data.confidence) : id === 'NPS' ? 90 : 95, goldenTime: String(data.goldenTime ?? '').slice(0, 40), currency: String(data.currency ?? '₽').slice(0, 8) };
  }
  return result;
}
