// Pulls a backtest dataset out of each MFL-history league: player-season scoring, trades, draft picks, replacement levels.
const fs = require('fs'); const R = '../run';
const out = {};
for (const key of ['loc', 'titan', 'flex']) {
  const d = `${R}/${key}/build`; const { buildLeague } = require(`${d}/logic.js`); const { analyze } = require(`${d}/analytics.js`); const lib = require(`${d}/lib.js`);
  const raw = JSON.parse(fs.readFileSync(`${d}/data.json`)); const L = buildLeague(raw), A = analyze(raw, L);
  const part = JSON.parse(fs.readFileSync(`${d}/mfl-part.json`));
  const ps = {}; // y -> pid -> [pts, games, weeks:{w:pts}]
  part.seasons.forEach(s => { const m = ps[s.y] = {}; const seen = new Set(); s.pw.forEach(([pid, f, w, pts]) => { const k = pid + '|' + w; if (seen.has(k)) return; seen.add(k); const r = m[pid] = m[pid] || [0, 0, {}]; r[0] += pts; if (pts !== 0) r[1]++; r[2][w] = pts; }); });
  Object.entries(raw.ps).forEach(([y, m]) => { if (ps[y]) return; ps[y] = {}; Object.entries(m).forEach(([pid, [p, g]]) => ps[y][pid] = [p, g, null]); });
  const pos = {}; Object.entries(raw.pl).forEach(([pid, p]) => pos[pid] = lib.posn(p[1]) || p[1]);
  const repl = {}; Object.entries(raw.repl || {}).forEach(([y, v]) => repl[y] = v.r);
  const k1 = raw.k1; const lrw = raw.lrw;
  const trades = A.trades.map(t => ({ d: t.d, y: A.years[t.yi], f1: t.f1, f2: t.f2, g1: t.g1, g2: t.g2, pickPid: Object.fromEntries([...t.v1, ...t.v2].filter(x => x.kind === 'pick' && (x.pid || (x.journey && x.journey.pid))).map(x => [x.a, x.pid || x.journey.pid])) }));
  const drafts = (A.draftReport ? A.draftReport.picks : []).map(p => ({ y: p.y, rd: p.rd, overall: p.overall, pid: p.pid }));
  out[key] = { years: A.years, ps, pos, repl, k1, lrw, trades, drafts, F: 12 };
  console.error(key, 'trades', trades.length, 'drafts', drafts.length, 'seasons', Object.keys(ps).join(','));
}
fs.writeFileSync('ds.json', JSON.stringify(out));
