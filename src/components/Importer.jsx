import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { schemas, toDelimited } from '../lib/metrics.mjs';
import { fieldLabel } from '../lib/catalog.mjs';
export default function Importer({ sheets, metric, lang, t, apply, close }) {
  const initial = Math.max(0, sheets.findIndex(s => s.sheet.toLowerCase() === metric.toLowerCase()));
  const [selected, setSelected] = useState(initial), [start, setStart] = useState(2), [mapping, setMapping] = useState(() => schemas[metric].map((_, i) => String(i)));
  const [feature, setFeature] = useState(lang === 'ru' ? 'Атрибут 1' : 'Attribute 1'), [append, setAppend] = useState(false);
  const rows = sheets[selected].data, width = Math.min(250, Math.max(...rows.slice(0, 30).map(r => r.length), 1));
  const preview = useMemo(() => rows.slice(Math.max(0, Number(start) - 1), Math.max(0, Number(start) - 1) + 4), [rows, start]);
  const valid = Number.isInteger(Number(start)) && Number(start) >= 1 && Number(start) <= rows.length && mapping.every((value, i) => value !== '' && (value !== 'fixed' || (schemas[metric][i][0] === 'feature' && feature.trim()))) && new Set(mapping.filter(m => m !== 'fixed')).size === mapping.filter(m => m !== 'fixed').length;
  function commit() {
    const mapped = rows.slice(Number(start) - 1).filter(row => mapping.some(index => index !== 'fixed' && String(row[Number(index)] ?? '').trim())).map(row => mapping.map(index => index === 'fixed' ? feature.trim() : row[Number(index)] ?? ''));
    apply(toDelimited(mapped), append);
  }
  return <Modal title={t.importTitle} close={close} closeLabel={t.close} wide>
    <p className="muted">{t.importHelp}</p><div className="import-controls"><label>{t.sheet}<select value={selected} onChange={e => { setSelected(Number(e.target.value)); }}>{sheets.map((s, i) => <option key={i} value={i}>{s.sheet}</option>)}</select></label><label>{t.startRow}<input type="number" min="1" max={rows.length} value={start} onChange={e => setStart(e.target.value)}/></label></div>
    <div className="mapping-grid">{schemas[metric].map(([key], i) => <label key={key}>{fieldLabel(key, lang)}<select value={mapping[i]} onChange={e => setMapping(m => m.map((value, j) => i === j ? e.target.value : value))}><option value="">{t.selectColumn}</option>{key === 'feature' && <option value="fixed">{t.fixedFeature}</option>}{Array.from({ length: width }, (_, j) => <option key={j} value={j}>{j + 1}. {String(rows[Math.max(0, Number(start) - 2)]?.[j] ?? '').slice(0, 85) || t.column + ' ' + (j + 1)}</option>)}</select></label>)}</div>
    {mapping.includes('fixed') && <label className="block-label">{t.featureName}<input value={feature} maxLength="120" onChange={e => setFeature(e.target.value)}/></label>}
    <h3>{t.preview}</h3><div className="table-scroll preview-table"><table><thead><tr>{schemas[metric].map(([key]) => <th key={key}>{fieldLabel(key, lang)}</th>)}</tr></thead><tbody>{preview.map((row, i) => <tr key={i}>{mapping.map((index, j) => <td key={j}>{index === 'fixed' ? feature : String(row[Number(index)] ?? '')}</td>)}</tr>)}</tbody></table></div>
    <label className="checkbox"><input type="checkbox" checked={append} onChange={e => setAppend(e.target.checked)}/>{lang === 'ru' ? 'Добавить к существующим данным' : 'Append to existing data'}</label>
    <div className="modal-actions"><button className="button tonal" onClick={close}>{t.cancel}</button><button className="button primary" disabled={!valid} onClick={commit}>{t.apply}</button></div>
  </Modal>;
}
