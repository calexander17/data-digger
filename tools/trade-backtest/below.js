// players scoring below replacement: how much surplus (as a share of replacement) they average 1-5 seasons later, by age
const fs = require('fs'); const ds = JSON.parse(fs.readFileSync('ds.json')); const bio = JSON.parse(fs.readFileSync('bio.json'));
const age = (p, y) => bio[p] ? (Date.UTC(y, 8, 1) / 1000 - bio[p][0]) / 31557600 : null;
const grp = p => ['DL', 'LB', 'DB'].includes(p) ? 'IDP' : p;
const B = a => a < 23 ? 0 : a < 25 ? 1 : a < 27 ? 2 : 3;
const S = {};
for (const L of Object.values(ds)) Object.keys(L.ps).map(Number).forEach(y => { const r = L.repl[y] || {}; Object.entries(L.ps[y]).forEach(([p, [pts, g]]) => { if (g < 4) return; const pos = L.pos[p]; const rr = r[pos]; if (!rr) return; const v = pts / g; if (v >= rr) return; const a = age(p, y); if (a == null) return; const bin = v / rr >= 0.75 ? 1 : 0;
  [1, 2, 3, 4, 5].forEach(h => { const yy = y + h; if (!L.ps[yy] || yy === 2026 && false) return; const r2 = (L.repl[yy] || {})[pos] || rr; const n = L.ps[yy][p]; const s2 = n && n[1] >= 3 ? Math.max(0, n[0] / n[1] - r2) / r2 : 0; const k = `${grp(pos)}|${B(a)}|${bin}|${h}`; const e = S[k] = S[k] || [0, 0]; e[0] += s2; e[1]++; }); }); });
const T = {}; ['QB', 'RB', 'WR', 'TE', 'IDP'].forEach(p => { T[p] = [0, 1].map(bin => [0, 1, 2, 3].map(b => [1, 2, 3, 4, 5].map(h => { const e = S[`${p}|${b}|${bin}|${h}`]; return e && e[1] >= 8 ? +(e[0] / e[1]).toFixed(3) : 0; })));
  console.log(p, JSON.stringify(T[p]), [0,1].map(bin=>[0,1,2,3].map(b=>(S[`${p}|${b}|${bin}|1`]||[0,0])[1]).join('/')).join(' ')); });
fs.writeFileSync('Tbelow.json', JSON.stringify(T));
for (const p in T) for (const bin of [0, 1]) for (let b = 0; b < 4; b++) { const v = T[p][bin][b]; T[p][bin][b] = v.map((_, i) => { const w = v.slice(Math.max(0, i - 1), i + 2); return +(w.reduce((a, c) => a + c, 0) / w.length).toFixed(3); }); }
fs.writeFileSync('Tbelow_s.json', JSON.stringify(T));
