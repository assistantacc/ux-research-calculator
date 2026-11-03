import React, { useEffect, useMemo, useRef, useState } from 'react';
import { analyze, metricIds, parseDelimited, schemas, toDelimited } from './lib/metrics.mjs';
import { copy, demoData, fieldLabel, getMetric } from './lib/catalog.mjs';
import { freshProject, STORAGE_KEY, validateProject } from './lib/storage.mjs';
import Icon from './components/Icon.jsx';
import Modal from './components/Modal.jsx';
import Importer from './components/Importer.jsx';
import { Distribution, PriceChart, Scatter } from './components/Charts.jsx';

function loadProject() {
  let project;
  try { project = validateProject(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { project = freshProject(); }
  const hash = decodeURIComponent(location.hash.slice(1));
  if (metricIds.includes(hash)) project.selected = hash;
  return project;
}
function saveFile(name, text, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime })), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeCsv(rows) {
  return '\uFEFF' + toDelimited(rows.map(row => row.map(value => typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value)), ',');
}

export default function App() {
  const [project, setProject] = useState(loadProject), [search, setSearch] = useState(''), [page, setPage] = useState('data'), [mode, setMode] = useState('paste');
  const [navOpen, setNavOpen] = useState(false), [exportOpen, setExportOpen] = useState(false), [importSheets, setImportSheets] = useState(null);
  const [notice, setNotice] = useState(''), [storageError, setStorageError] = useState(false), [busy, setBusy] = useState(false);
  const fileInput = useRef(null), tableRef = useRef(null), toastTimer = useRef(null);
  const lang = project.language, metric = project.selected, t = copy[lang], meta = getMetric(metric, lang), dataset = project.datasets[metric];
  const result = useMemo(() => analyze(metric, dataset.text, dataset), [metric, dataset]);
  const format = (value, digits = 1) => value === null || value === undefined || !Number.isFinite(value) ? '—' : new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: digits }).format(value);
  const field = key => fieldLabel(key, lang);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dataset.theme = project.theme; document.title = `${metric} · UX Research Calculator`; }, [lang, project.theme, metric]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); setStorageError(false); } catch { setStorageError(true); } }, [project]);
  useEffect(() => { history.replaceState(null, '', `#${metric}`); }, [metric]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const toast = text => { setNotice(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setNotice(''), 4200); };
  const update = patch => setProject(p => ({ ...p, datasets: { ...p.datasets, [metric]: { ...p.datasets[metric], ...patch } } }));
  const selectMetric = id => { setProject(p => ({ ...p, selected: id })); setPage('data'); setNavOpen(false); };
  const changeLang = language => setProject(p => ({ ...p, language, datasets: Object.fromEntries(metricIds.map(id => [id, p.datasets[id].isDemo ? { ...p.datasets[id], text: demoData(id, language) } : p.datasets[id]])) }));
  const catalog = metricIds.map(id => getMetric(id, lang)).filter(m => `${m.id} ${m.title} ${m.short}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const rows = useMemo(() => { try { return parseDelimited(dataset.text); } catch { return []; } }, [dataset.text]);
  const template = () => {
    saveFile(`${metric}-template.csv`, safeCsv([schemas[metric].map(([key]) => field(key)), ...parseDelimited(demoData(metric, lang)).slice(0, 3)]), 'text/csv;charset=utf-8'); toast(t.downloaded);
  };
  const editCell = (rowIndex, columnIndex, value) => {
    const next = rows.map(row => [...row]);
    if (!next[rowIndex]) next[rowIndex] = schemas[metric].map(() => '');
    next[rowIndex][columnIndex] = value;
    update({ text: toDelimited(next), isDemo: false });
  };
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast(t.bigFile); return; }
    setBusy(true);
    try {
      if (/\.json$/i.test(file.name)) {
        const restored = validateProject(JSON.parse(await file.text()));
        if (window.confirm(t.confirmReplace)) { setProject(restored); toast(copy[restored.language].savedProject); }
      } else if (/\.xlsx$/i.test(file.name)) {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const sheets = await readXlsxFile(file);
        if (!Array.isArray(sheets) || !sheets.length || !sheets.every(s => typeof s.sheet === 'string' && Array.isArray(s.data))) throw new Error('invalidFile');
        setImportSheets(sheets);
      } else if (/\.(csv|tsv|txt)$/i.test(file.name)) {
        const data = parseDelimited(await file.text());
        if (!data.length) throw new Error('invalidFile');
        setImportSheets([{ sheet: file.name, data }]);
      } else throw new Error('invalidFile');
    } catch { toast(t.invalidFile); } finally { setBusy(false); }
  }
  function exportData(type) {
    if (type === 'project') saveFile('ux-research-project.json', JSON.stringify(project, null, 2), 'application/json');
    if (type === 'data') saveFile(`${metric}-data.csv`, safeCsv(dataset.hasHeader ? rows : [schemas[metric].map(([key]) => field(key)), ...rows]), 'text/csv;charset=utf-8');
    if (type === 'results') {
      const output = [[t.calculators, metric], [t.score, result.score ?? ''], [t.valid, result.n], [t.excluded, result.excluded], [t.demoData, dataset.isDemo ? 'true' : 'false']];
      if (result.ci) output.push([`${result.confidence}% ${t.ci}`, ...result.ci]);
      if (result.categories) { output.push([], [t.category, t.count, t.share]); result.categories.forEach(c => output.push([t[c.key], c.value, c.value / result.n * 100])); }
      if (result.table.length) {
        const keys = Object.keys(result.table[0]).filter(k => !['counts', 'categories'].includes(k));
        output.push([], keys.map(k => ({ name: t.feature, n: t.count }[k] ?? t[k] ?? k)));
        result.table.forEach(r => output.push(keys.map(k => r[k] ?? '')));
        if (metric === 'Kano') { output.push([], [t.feature, ...['M', 'P', 'A', 'I', 'Q', 'R'].map(k => t[k])]); result.table.forEach(r => output.push([r.name, ...Object.values(r.counts)])); }
      }
      if (metric === 'SUM') output.push([], [t.goldenTime, result.goldenTime ?? ''], ...result.bars.map(b => [field(b.key), b.value ?? '']));
      if (metric === 'PSM' && result.curves) output.push([], [t.lower, result.lower], [t.upper, result.upper], [t.indifference, result.indifference], [], [t.price, ...schemas.PSM.map(([k]) => field(k))], ...result.curves.map(c => [c.price, ...schemas.PSM.map(([k]) => c[k])]));
      saveFile(`${metric}-results.csv`, safeCsv(output), 'text/csv;charset=utf-8');
    }
    setExportOpen(false); toast(t.downloaded);
  }

  const scoreSuffix = ['SUM', 'UMUX', 'CES'].includes(metric) ? '%' : metric === 'CSI' ? '/ 5' : metric === 'ODI' ? '/ 20' : metric === 'PSM' ? dataset.currency : '';
  const scoreText = (metric === 'NPS' && result.score > 0 ? '+' : '') + format(result.score, metric === 'PSM' ? 0 : 1);
  function interpretation() {
    if (metric === 'NPS') return lang === 'ru' ? `${format(result.categories[2].value / result.n * 100)}% участников — промоутеры, ${format(result.categories[0].value / result.n * 100)}% — критики. ${result.score > 0 ? 'Промоутеров больше, чем критиков.' : result.score < 0 ? 'Критиков больше, чем промоутеров.' : 'Доли промоутеров и критиков одинаковы.'} Сопоставьте результат с предыдущими волнами исследования.` : `${format(result.categories[2].value / result.n * 100)}% are promoters and ${format(result.categories[0].value / result.n * 100)}% are detractors. ${result.score > 0 ? 'Promoters outnumber detractors.' : result.score < 0 ? 'Detractors outnumber promoters.' : 'Promoter and detractor shares are equal.'} Compare with previous research waves.`;
    if (metric === 'CES') return lang === 'ru' ? `${result.positive} из ${result.n} участников согласились, что действие было легко выполнить. Средняя оценка — ${format(result.mean)} из 5.` : `${result.positive} of ${result.n} participants agreed the action was easy. The mean rating is ${format(result.mean)} out of 5.`;
    if (metric === 'ODI') return lang === 'ru' ? `Наибольшая возможность в этой выборке — «${result.table[0].name}»: ${format(result.score)} из 20. Важность ${format(result.table[0].importance)} и удовлетворённость ${format(result.table[0].satisfaction)} из 10.` : `The largest opportunity in this sample is “${result.table[0].name}”: ${format(result.score)} out of 20. Importance is ${format(result.table[0].importance)} and satisfaction ${format(result.table[0].satisfaction)} out of 10.`;
    if (metric === 'Kano') return lang === 'ru' ? `Оценено свойств: ${result.table.length}. Категории отражают реакции на наличие и отсутствие свойства. Смотрите распределения: небольшая разница между категориями может скрывать неоднородность ответов.` : `${result.table.length} features evaluated. Categories describe reactions to feature presence and absence. Review the distributions: small differences between categories may hide mixed responses.`;
    if (metric === 'PSM') return lang === 'ru' ? `Приемлемый диапазон: ${format(result.lower, 0)}–${format(result.upper, 0)} ${dataset.currency}. Точка OPP — ${format(result.score, 0)} ${dataset.currency}. Это оценка восприятия цены, а не прогноз покупок или выручки.` : `Acceptable range: ${format(result.lower, 0)}–${format(result.upper, 0)} ${dataset.currency}. OPP is ${format(result.score, 0)} ${dataset.currency}. This measures price perceptions, not purchases or revenue.`;
    return meta.method;
  }

  return <div className="app-shell">
    {navOpen && <button className="nav-backdrop" aria-label={t.close} onClick={() => setNavOpen(false)}/>}
    <aside className={`sidebar ${navOpen ? 'is-open' : ''}`}>
      <a className="brand" href="#NPS" onClick={e => { e.preventDefault(); selectMetric('NPS'); }}><span className="brand-symbol"><Icon name="chart" size={26}/></span><span>UX Research<small>Calculator</small></span></a>
      <div className="sidebar-section-label">{t.workspace}</div>
      <div className="search-field"><Icon name="search" size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} aria-label={t.search}/>{search && <button className="icon-button small" aria-label={t.clear} onClick={() => setSearch('')}><Icon name="close" size={15}/></button>}</div>
      <nav aria-label={t.calculators}>{['usability', 'experience', 'strategy'].map(group => {
        const items = catalog.filter(m => m.group === group);
        return items.length ? <div className="nav-group" key={group}><div className="nav-group-label">{{ usability: lang === 'ru' ? 'Юзабилити' : 'Usability', experience: lang === 'ru' ? 'Клиентский опыт' : 'Customer experience', strategy: lang === 'ru' ? 'Продуктовые решения' : 'Product decisions' }[group]}</div>{items.map(m => <button key={m.id} className={`nav-item ${metric === m.id ? 'active' : ''}`} aria-current={metric === m.id ? 'page' : undefined} onClick={() => selectMetric(m.id)}><span className={`metric-glyph ${m.color}`}>{m.id === 'Kano' ? 'K' : m.id.slice(0, 1)}</span><span><strong>{m.id}</strong><small>{m.short}</small></span>{metric === m.id && <span className="active-dot"/>}</button>)}</div> : null;
      })}{!catalog.length && <p className="muted nav-empty">{t.noSearch}</p>}</nav>
      <div className="sidebar-bottom"><div className="privacy-tile"><Icon name="shield"/><div><strong>{t.dataLocal}</strong><p>{t.localHelp}</p></div></div><a className="source-link" href="https://github.com/UXRozum/Swiss_Excelbook" target="_blank" rel="noreferrer"><Icon name="book" size={16}/>{t.source}<Icon name="arrow" size={15}/></a></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label={t.menu} onClick={() => setNavOpen(true)}><Icon name="menu"/></button><span>{t.calculators}</span><Icon name="chevron" size={14}/><strong>{metric}</strong></div><div className="topbar-actions"><span className="save-status"><Icon name="check" size={14}/>{t.local}</span><div className="language-switch" role="group" aria-label="Rus/En"><button aria-pressed={lang === 'ru'} className={lang === 'ru' ? 'selected' : ''} onClick={() => changeLang('ru')}>Rus</button><button aria-pressed={lang === 'en'} className={lang === 'en' ? 'selected' : ''} onClick={() => changeLang('en')}>En</button></div><button className="icon-button" aria-label={project.theme === 'light' ? t.dark : t.light} title={project.theme === 'light' ? t.dark : t.light} onClick={() => setProject(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))}><Icon name={project.theme === 'light' ? 'moon' : 'sun'}/></button></div></header>
      <main id="main-content">
        {storageError && <div role="alert" className="alert">{t.storageError}</div>}
        <section className="page-heading"><div><div className="eyebrow"><span className={`metric-label ${meta.color}`}>{metric}</span><span>{meta.short}</span></div><h1>{meta.title}</h1><p>{meta.description}</p></div><div className="heading-actions"><button className="button tonal" onClick={() => update({ text: demoData(metric, lang), isDemo: true, hasHeader: false })}><Icon name="spark" size={18}/>{t.loadDemo}</button><button className="button primary" onClick={() => setExportOpen(true)}><Icon name="download" size={18}/>{t.export}</button></div></section>
        <div className="page-tabs" role="tablist"><button role="tab" aria-selected={page === 'data'} onClick={() => setPage('data')} className={page === 'data' ? 'active' : ''}><Icon name="chart" size={18}/>{t.data} <span>&</span> {t.results}</button><button role="tab" aria-selected={page === 'method'} onClick={() => setPage('method')} className={page === 'method' ? 'active' : ''}><Icon name="book" size={18}/>{t.methodology}</button></div>
        {page === 'method' ? <section className="method-page card"><span className="eyebrow">{metric} / {t.methodology}</span><h2>{t.readMethod}</h2><p>{meta.method}</p><div className="formula-block"><small>{t.formula}</small><code>{meta.formula}</code></div><p>{meta.note}</p><h3>{t.questionGuide}</h3><div className="table-scroll"><table><thead><tr><th>{t.column}</th><th>{t.scale}</th></tr></thead><tbody>{schemas[metric].map(([key, lo, hi]) => <tr key={key}><td>{field(key)}</td><td>{lo === undefined ? (lang === 'ru' ? 'Название' : 'Name') : hi === Infinity ? `> 0${key === 'time' ? ` ${t.seconds}` : ''}` : `${lo}–${hi}`}</td></tr>)}</tbody></table></div><p className="muted">{t.sourceNote}</p><a href="https://github.com/UXRozum/Swiss_Excelbook" target="_blank" rel="noreferrer">{t.sourceWorkbook} ↗</a>{metric === 'ODI' && <p><a href="https://strategyn.com/outcome-driven-innovation/" target="_blank" rel="noreferrer">Strategyn · Opportunity Algorithm ↗</a></p>}</section> :
        <div className="workbench">
          <section className="input-card card"><div className="section-heading"><div className="section-title"><span className="step">01</span><h2>{t.inputTitle}</h2></div><button className="icon-button" title={t.clear} aria-label={t.clear} onClick={() => { if (window.confirm(t.confirmClear)) update({ text: '', isDemo: false, hasHeader: false }); }}><Icon name="trash" size={18}/></button></div>
            <p className="muted input-help">{t.inputHelp}</p>
            <div className="input-toolbar"><div className="segmented" role="group" aria-label={t.data}><button aria-pressed={mode === 'paste'} className={mode === 'paste' ? 'selected' : ''} onClick={() => setMode('paste')}>{t.paste}</button><button aria-pressed={mode === 'table'} className={mode === 'table' ? 'selected' : ''} onClick={() => setMode('table')}>{t.table}</button></div><button className="button text-button" disabled={busy} onClick={() => fileInput.current.click()}><Icon name="upload" size={17}/>{busy ? '…' : t.import}</button></div>
            <div className="field-guide">{schemas[metric].map(([key, lo, hi], i) => <span key={key}><b>{i + 1}</b>{field(key)}{hi !== undefined && <small>{hi === Infinity ? '>0' : `${lo}–${hi}`}</small>}</span>)}</div>
            {mode === 'paste' ? <textarea className="data-input" aria-label={t.inputTitle} value={dataset.text} spellCheck="false" placeholder={schemas[metric].map(([key]) => field(key)).join('\t')} onChange={e => update({ text: e.target.value, isDemo: false })}/> : <div ref={tableRef} className="table-scroll editable-table"><table><thead><tr><th>#</th>{schemas[metric].map(([key]) => <th key={key}>{field(key)}</th>)}<th/></tr></thead><tbody>{[...rows.slice(0, 50), ...(rows.length < 50 ? [schemas[metric].map(() => '')] : [])].map((row, i) => <tr key={i}><td>{i + 1}</td>{schemas[metric].map(([key], j) => <td key={key}><input aria-label={`${t.row} ${i + 1}, ${field(key)}`} value={row[j] ?? ''} onChange={e => editCell(i, j, e.target.value)}/></td>)}<td><button className="icon-button small" aria-label={`${t.deleteRow} ${i + 1}`} disabled={i >= rows.length} onClick={() => update({ text: toDelimited(rows.filter((_, j) => j !== i)), isDemo: false })}><Icon name="close" size={13}/></button></td></tr>)}</tbody></table></div>}
            {mode === 'table' && <button className="button text-button add-row" disabled={rows.length >= 50} onClick={() => { const input = tableRef.current?.querySelector('tbody tr:last-child input'); input?.focus(); input?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }}><Icon name="plus" size={17}/>{t.addRow}</button>}
            {rows.length > 50 && mode === 'table' && <p className="muted small-text">{t.visibleRows}</p>}
            <div className="input-footer"><label className="checkbox"><input type="checkbox" checked={dataset.hasHeader} onChange={e => update({ hasHeader: e.target.checked, isDemo: false })}/>{t.header}</label>{dataset.isDemo && <span className="demo-badge">{t.demoData}</span>}</div>
            <div className="data-summary"><span><i className="status-dot"/>{t.valid}<strong>{result.n}</strong></span><span className={result.excluded ? 'error-text' : ''}>{t.excluded}<strong>{result.excluded}</strong></span></div>
            {result.parseError && <p role="alert" className="alert">{t[result.parseError] ?? t.invalidFile}</p>}
            {result.issues.length > 0 && <details className="issues"><summary>{t.excluded}: {result.excluded}</summary><ul>{result.issues.slice(0, 12).map((issue, i) => <li key={i}>{t.row} {issue.row} · {field(issue.key)}: {t[issue.code]}</li>)}</ul>{result.issues.length > 12 && <span>+{result.issues.length - 12}</span>}</details>}
            {metric === 'SUM' && <label className="block-label settings-field">{t.goldenTime}<input inputMode="decimal" placeholder={t.automatic} value={dataset.goldenTime} onChange={e => update({ goldenTime: e.target.value })}/></label>}
            {metric === 'PSM' && <label className="block-label settings-field">{t.currency}<select value={dataset.currency} onChange={e => update({ currency: e.target.value })}>{['₽', '$', '€', '£', '¥', '₸'].map(c => <option key={c}>{c}</option>)}</select></label>}
            <button className="button text-button template-button" onClick={template}><Icon name="file" size={16}/>{t.template}</button><p className="file-help">{t.importFileHelp}</p>
          </section>
          <div className="results-column" aria-live="polite" aria-atomic="false">
            {!result.n ? <section className="empty-state card"><span className="empty-symbol"><Icon name="chart" size={42}/></span><h2>{t.empty}</h2><p>{t.emptyHelp}</p><button className="button primary" onClick={() => update({ text: demoData(metric, lang), isDemo: true, hasHeader: false })}>{t.loadDemo}<Icon name="arrow" size={18}/></button></section> : <>
            <div className="stat-grid"><section className={`score-card ${metric === 'NPS' && result.score >= 0 ? 'positive' : ''}`}><span className="stat-label">{metric === 'PSM' ? t.optimal : metric === 'Kano' ? t.features : metric === 'ODI' ? t.highestOpportunity : `${metric} ${t.score.toLowerCase()}`}</span><div className="score-value">{scoreText}<small>{result.score !== null ? scoreSuffix : ''}</small></div><div className="score-foot">{metric === 'NPS' ? '−100 … +100' : metric === 'Kano' ? t.category : metric === 'PSM' ? 'Van Westendorp' : `${result.range?.[0] ?? 0}–${result.range?.[1] ?? 100}`}</div></section>
              <section className="stat-card card"><span className="stat-icon"><Icon name="users"/></span><span className="stat-label">{t.valid}</span><strong className="stat-number">{format(result.n, 0)}</strong><span className="muted small-text">{result.excluded ? `${t.excluded}: ${result.excluded}` : t.research}</span></section>
              <section className="stat-card card"><span className="stat-icon"><Icon name={['NPS', 'UMUX'].includes(metric) ? 'shield' : 'chart'}/></span><span className="stat-label">{['NPS', 'UMUX'].includes(metric) ? t.ci : ['CSI', 'ODI', 'Kano'].includes(metric) ? t.attributes : metric === 'PSM' ? t.acceptable : t.mean}</span><strong className="stat-detail">{['NPS', 'UMUX'].includes(metric) ? result.ci ? `${format(result.ci[0])} … ${format(result.ci[1])}` : '—' : ['CSI', 'ODI', 'Kano'].includes(metric) ? result.table.length : metric === 'PSM' ? `${format(result.lower, 0)}–${format(result.upper, 0)}` : metric === 'SUM' ? format(result.meanTime) : format(result.mean)}</strong>{['NPS', 'UMUX'].includes(metric) ? <select className="confidence-select" aria-label={t.confidence} value={dataset.confidence} onChange={e => update({ confidence: Number(e.target.value) })}><option value="90">90%</option><option value="95">95%</option></select> : <span className="muted small-text">{metric === 'PSM' ? dataset.currency : metric === 'SUM' ? t.seconds : metric === 'CES' ? '/ 5' : t.research}</span>}</section>
            </div>
            {result.problem && <div role="alert" className="alert"><Icon name="info"/>{t[result.problem]}</div>}
            <section className="chart-card card"><div className="section-heading"><div className="section-title"><span className="step">02</span><h2>{['CSI', 'ODI', 'Kano'].includes(metric) ? `${metric === 'Kano' ? t.worse : t.importance} / ${t.satisfaction}` : metric === 'PSM' ? t.acceptable : t.distribution}</h2></div><span className="sample-badge">n = {result.n}</span></div>
              {metric === 'NPS' && <div className="nps-breakdown"><div className="nps-stacked">{result.categories.map(c => <span key={c.key} className={c.key} style={{ width: `${c.value / result.n * 100}%` }} title={`${t[c.key]}: ${format(c.value / result.n * 100)}%`}/>)}</div><div className="nps-legend">{result.categories.map(c => <div key={c.key}><span><i className={c.key}/>{t[c.key]}</span><strong>{format(c.value / result.n * 100)}%<small>{c.value}</small></strong></div>)}</div></div>}
              {metric === 'PSM' ? <PriceChart result={result} lang={lang} t={t} format={format}/> : ['CSI', 'ODI', 'Kano'].includes(metric) ? <Scatter result={result} metric={metric} t={t} format={format}/> : <Distribution result={result} metric={metric} lang={lang} t={t} format={format}/>}
              {['NPS', 'CES', 'SUM', 'UMUX'].includes(metric) && <details className="chart-table"><summary>{t.details}</summary><table><thead><tr><th>{t.response}</th><th>{metric === 'UMUX' ? t.mean : metric === 'SUM' ? t.score : t.count}</th></tr></thead><tbody>{result.bars.map((bar, i) => <tr key={i}><td>{bar.label ?? field(bar.key)}</td><td>{format(bar.value)}</td></tr>)}</tbody></table></details>}
            </section>
            <section className="interpretation-card"><div className="interpretation-icon"><Icon name="spark" size={24}/></div><div><h3>{t.interpretation}</h3><p>{interpretation()}</p><button className="button text-button" onClick={() => setPage('method')}>{t.readMethod}<Icon name="arrow" size={16}/></button></div></section>
            {metric === 'PSM' && <section className="card price-points">{[['lower', result.lower], ['optimal', result.score], ['upper', result.upper], ['indifference', result.indifference]].map(([key, value]) => <div key={key}><span>{t[key]}</span><strong>{format(value, 0)} <small>{dataset.currency}</small></strong></div>)}</section>}
            {result.table.length > 0 && <section className="card detailed-card"><h2>{t.details}</h2><div className="table-scroll"><table><thead><tr><th>{t.feature}</th>{metric === 'Kano' ? <><th>{t.category}</th><th>Better</th><th>Worse</th><th>{t.count}</th></> : <><th>{t.importance}</th><th>{t.satisfaction}</th><th>{metric === 'CSI' ? t.weight : t.opportunity}</th></>}</tr></thead><tbody>{result.table.map(row => <tr key={row.name}><td><strong>{row.name}</strong></td>{metric === 'Kano' ? <><td><span className="category-tag" title={row.categories.length > 1 ? t.tie : undefined}>{row.categories.map(c => `${c} · ${t[c]}`).join(' / ')}</span></td><td>{format(row.better, 2)}</td><td>{format(row.worse, 2)}</td><td>{row.n}</td></> : <><td>{format(row.importance)}</td><td>{format(row.satisfaction)}</td><td>{metric === 'CSI' ? `${format(row.weight * 100)}%` : format(row.opportunity)}</td></>}</tr>)}</tbody></table></div>{metric === 'Kano' && <details className="chart-table"><summary>{t.distribution}</summary><div className="table-scroll"><table><thead><tr><th>{t.feature}</th>{['M', 'P', 'A', 'I', 'Q', 'R'].map(c => <th key={c} title={t[c]}>{c}</th>)}</tr></thead><tbody>{result.table.map(row => <tr key={row.name}><td>{row.name}</td>{Object.entries(row.counts).map(([key, value]) => <td key={key}>{value}</td>)}</tr>)}</tbody></table></div></details>}</section>}
            </>}
          </div>
        </div>}
        <footer className="page-footer"><span>UX Research Calculator</span><span><Icon name="shield" size={14}/>{t.dataLocal}</span><a href="https://m3.material.io/" target="_blank" rel="noreferrer">Material Design 3 ↗</a></footer>
      </main>
    </div>
    <input className="visually-hidden" ref={fileInput} type="file" accept=".xlsx,.csv,.tsv,.txt,.json" onChange={importFile} aria-label={t.import}/>
    {notice && <div className="toast" role="status"><Icon name="info" size={18}/>{notice}<button className="icon-button" aria-label={t.close} onClick={() => setNotice('')}><Icon name="close" size={17}/></button></div>}
    {exportOpen && <Modal title={t.exportTitle} close={() => setExportOpen(false)} closeLabel={t.close}><div className="export-options">{[['results', t.exportResults, 'chart'], ['data', t.exportData, 'file'], ['project', t.exportProject, 'download']].map(([key, label, icon]) => <button key={key} onClick={() => exportData(key)} disabled={key === 'results' && !result.n}><span className="stat-icon"><Icon name={icon}/></span><span>{label}</span><Icon name="arrow" size={18}/></button>)}<button onClick={() => { setExportOpen(false); setTimeout(() => window.print(), 100); }}><span className="stat-icon"><Icon name="file"/></span><span>{t.print}</span><Icon name="arrow" size={18}/></button></div><p className="muted small-text">{t.localHelp}</p></Modal>}
    {importSheets && (
      <Importer sheets={importSheets} metric={metric} lang={lang} t={t} close={() => setImportSheets(null)} apply={(text, append) => {
        let combined = text;
        if (append && dataset.text.trim()) {
          const existing = parseDelimited(dataset.text);
          combined = toDelimited([...(dataset.hasHeader ? existing.slice(1) : existing), ...parseDelimited(text)]);
        }
        update({ text: combined, hasHeader: false, isDemo: false });
        setImportSheets(null);
        toast(t.importComplete);
      }}/>
    )}
  </div>;
}
