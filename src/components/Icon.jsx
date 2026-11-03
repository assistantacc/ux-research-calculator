import React from 'react';
const paths = {
  chart: 'M5 19V11M12 19V5M19 19V8', search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow: 'M5 12h14m-6-6 6 6-6 6', download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4', upload: 'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-5', check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6',
  plus: 'M12 5v14M5 12h14', trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7M14 10v7', info: 'M12 11v6m0-10v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z', book: 'M4 4h7l1 2 1-2h7v15h-7l-1 2-1-2H4V4Zm8 2v15', menu: 'M4 6h16M4 12h16M4 18h16',
  file: 'M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h8', spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  users: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-3.9M13 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  chevron: 'm9 5 7 7-7 7', clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
};
export default function Icon({ name, size = 20, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] ?? paths.chart}/></svg>; }
