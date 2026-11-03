import React from 'react';
import { fieldLabel } from '../lib/catalog.mjs';

export const colors = ['#6e59ad', '#469683', '#d58e4b', '#bb6f88', '#568ba5', '#8d92a2'];
export function Distribution({ result, metric, lang, t, format }) {
  const bars = result.bars, max = Math.max(1, ...bars.map(b => b.value ?? 0));
  const horizontal = metric === 'SUM' || metric === 'UMUX';
  if (horizontal) return <div className="horizontal-bars">{bars.map((bar, i) => <div className="horizontal-row" key={bar.key}>
    <div><span>{fieldLabel(bar.key, lang)}</span><strong>{format(bar.value)}{metric === 'SUM' && bar.value !== null ? '%' : ''}</strong></div>
    <div className="bar-track"><span style={{ width: `${(bar.value ?? 0) / result.chartMax * 100}%`, background: colors[i] }} /></div>
  </div>)}</div>;
  const width = 640, height = 240, left = 32, top = 20, bottom = 34, step = (width - left - 12) / bars.length;
  return <svg className="distribution" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.distribution}>
    {[0, .5, 1].map(f => <g key={f}><line x1={left} y1={height - bottom - f * (height - top - bottom)} x2={width - 6} y2={height - bottom - f * (height - top - bottom)} className="grid-line"/><text x={left - 8} y={height - bottom - f * (height - top - bottom) + 4} textAnchor="end" className="axis-label">{format(f * max, 0)}</text></g>)}
    {bars.map((bar, i) => {
      const h = bar.value / max * (height - top - bottom), x = left + i * step + step * .18;
      const fill = metric === 'NPS' ? Number(bar.label) <= 6 ? '#d9907d' : Number(bar.label) <= 8 ? '#e4ba70' : '#65a68c' : colors[i % colors.length];
      return <g key={bar.label ?? bar.key}><title>{t.response} {bar.label ?? t[bar.key]}: {bar.value}</title><rect x={x} y={height - bottom - Math.max(h, 2)} width={step * .64} height={Math.max(h, 2)} rx={Math.min(7, step / 5)} fill={fill} opacity={bar.value ? 1 : .28}/><text x={x + step * .32} y={height - 10} textAnchor="middle" className="axis-label">{bar.label ?? bar.key}</text>{bar.value > 0 && <text x={x + step * .32} y={height - bottom - h - 8} textAnchor="middle" className="bar-label">{bar.value}</text>}</g>;
    })}
  </svg>;
}
export function Scatter({ result, metric, t, format }) {
  const maximum = result.chartMax, xLabel = metric === 'Kano' ? t.worse : t.importance, yLabel = metric === 'Kano' ? t.better : t.satisfaction;
  const sx = value => 60 + value / maximum * 560, sy = value => 270 - value / maximum * 220;
  return <div className="scatter-wrap"><svg viewBox="0 0 680 325" role="img" aria-label={`${yLabel} / ${xLabel}`}>
    <rect x="60" y="50" width="280" height="110" rx="10" fill="var(--chart-zone)"/><rect x="340" y="160" width="280" height="110" rx="10" fill="var(--chart-zone)"/>
    {[0, .25, .5, .75, 1].map(f => <g key={f}><line className="grid-line" x1="60" x2="620" y1={sy(f * maximum)} y2={sy(f * maximum)}/><line className="grid-line" x1={sx(f * maximum)} x2={sx(f * maximum)} y1="50" y2="270"/><text x="48" y={sy(f * maximum) + 4} textAnchor="end" className="axis-label">{format(f * maximum)}</text><text x={sx(f * maximum)} y="291" textAnchor="middle" className="axis-label">{format(f * maximum)}</text></g>)}
    <text x="340" y="319" textAnchor="middle" className="axis-title">{xLabel}</text><text x="15" y="165" transform="rotate(-90 15 165)" textAnchor="middle" className="axis-title">{yLabel}</text>
    {result.points.map((point, i) => <g key={point.label}><title>{point.label}: {xLabel} {format(point.x)}, {yLabel} {format(point.y)}</title><circle cx={sx(point.x)} cy={sy(point.y)} r="10" fill={colors[i % colors.length]} stroke="var(--surface)" strokeWidth="3"/><text x={sx(point.x) > 540 ? sx(point.x) - 14 : sx(point.x) + 14} y={sy(point.y) - 12} textAnchor={sx(point.x) > 540 ? 'end' : 'start'} className="point-label">{point.label.length > 22 ? point.label.slice(0, 20) + '…' : point.label}</text></g>)}
  </svg></div>;
}
export function PriceChart({ result, lang, t, format }) {
  const keys = ['tooExpensive', 'tooCheap', 'expensive', 'cheap'], maxPrice = result.range[1];
  const sx = p => 54 + p / maxPrice * 570, sy = v => 265 - v / 100 * 220;
  const step = Math.max(1, Math.ceil(result.curves.length / 800));
  const points = result.curves.filter((_, i) => i % step === 0 || i === result.curves.length - 1);
  return <><svg viewBox="0 0 680 320" role="img" aria-label={t.acceptable}>
    {result.lower !== null && result.upper !== null && <rect x={sx(result.lower)} y="45" width={Math.max(0, sx(result.upper) - sx(result.lower))} height="220" fill="var(--chart-zone)"/>}
    {[0, .25, .5, .75, 1].map(f => <g key={f}><line x1="54" x2="624" y1={sy(f * 100)} y2={sy(f * 100)} className="grid-line"/><text x="44" y={sy(f * 100) + 4} className="axis-label" textAnchor="end">{format(f * 100, 0)}%</text><text x={sx(f * maxPrice)} y="288" textAnchor="middle" className="axis-label">{format(f * maxPrice, 0)}</text></g>)}
    {keys.map((key, i) => <polyline key={key} points={points.map(p => `${sx(p.price)},${sy(p[key])}`).join(' ')} fill="none" stroke={colors[i]} strokeWidth="3" strokeLinejoin="round"/>)}
    {result.score !== null && <line x1={sx(result.score)} x2={sx(result.score)} y1="40" y2="270" stroke="var(--on-surface)" strokeWidth="1.5" strokeDasharray="4 5"/>}
    <text x="340" y="314" textAnchor="middle" className="axis-title">{t.price}</text>
  </svg><div className="chart-legend">{keys.map((key, i) => <span key={key}><i style={{ background: colors[i] }}/>{fieldLabel(key, lang)}</span>)}</div></>;
}
