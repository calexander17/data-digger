// Backtest trade value models on past trades: predict each side's value at trade time with data available then,
// compare with the points over replacement the assets actually produced over the next seasons.
const fs = require('fs'); const ds = JSON.parse(fs.readFileSync('ds.json')); const bio = JSON.parse(fs.readFileSync('bio.json'));
const age = (p, y) => bio[p] ? (Date.UTC(y, 8, 1) / 1000 - bio[p][0]) / 31557600 : null;
const grp = p => ['DL', 'LB', 'DB'].includes(p) ? 'IDP' : p;
const B = a => a < 23 ? 0 : a < 25 ? 1 : a < 27 ? 2 : a < 29 ? 3 : a < 31 ? 4 : a < 33 ? 5 : 6;
// last complete season: the newest one with week-by-week data (finished seasons are cached week by week; the current one is not)
const LAST = Math.max(...Object.values(ds).flatMap(L => Object.entries(L.ps).filter(([, m]) => Object.values(m).some(r => r[2])).map(([y]) => +y)));
const TB = fs.existsSync('Tbelow_s.json') ? JSON.parse(fs.readFileSync('Tbelow_s.json')) : {}; // last complete season
// ---- fit tables from seasons strictly before a cutoff year (to keep the test honest)
function fitK(cut) {
  const S = {}; for (const L of Object.values(ds)) Object.keys(L.ps).map(Number).filter(y => y < cut).forEach(y => { const r = L.repl[y] || {}; Object.entries(L.ps[y]).forEach(([p, [pts, g]]) => { if (g < 6) return; const pos = L.pos[p]; const s = pts / g - (r[pos] || 0); if (!(s > 0)) return; const a = age(p, y); if (a == null) return;
    [1, 2, 3].forEach(h => { const yy = y + h; if (yy >= cut || !L.ps[yy]) return; const rr = L.repl[yy] || r; const n = L.ps[yy][p]; const s2 = n && n[1] >= 3 ? Math.max(0, n[0] / n[1] - (rr[pos] || 0)) : 0; const k = grp(pos) + '|' + B(a) + '|' + h; const e = S[k] = S[k] || [0, 0, 0]; e[0] += s2; e[1] += s; e[2]++; }); }); });
  const K = {}; ['QB', 'RB', 'WR', 'TE', 'IDP'].forEach(p => { K[p] = {}; [1, 2, 3].forEach(h => { let t0 = 0, t1 = 0; for (let b = 0; b < 7; b++) { const e = S[`${p}|${b}|${h}`]; if (e) { t0 += e[0]; t1 += e[1]; } } const base = t1 ? t0 / t1 : Math.pow(0.7, h);
    let row = [...Array(7)].map((_, b) => { const e = S[`${p}|${b}|${h}`] || [0, 0, 0]; const w = e[2] / (e[2] + 20); return { v: e[1] ? w * e[0] / e[1] + (1 - w) * base : base, n: e[2] + 1 }; });
    // pool adjacent violators: never better with age, from 23 on
    let blocks = row.slice(1).map(x => ({ v: x.v, n: x.n, c: 1 })); let ch = true; while (ch) { ch = false; for (let i = 0; i < blocks.length - 1; i++) if (blocks[i].v < blocks[i + 1].v) { const a = blocks[i], b = blocks[i + 1]; blocks.splice(i, 2, { v: (a.v * a.n + b.v * b.n) / (a.n + b.n), n: a.n + b.n, c: a.c + b.c }); ch = true; break; } }
    const iso = []; blocks.forEach(b => { for (let i = 0; i < b.c; i++) iso.push(b.v); });
    K[p][h] = [row[0].v, ...iso]; }); [4, 5].forEach(h => K[p][h] = K[p][3].map((v, i) => v * Math.pow(Math.max(0.3, Math.min(1, K[p][3][i] / Math.max(0.01, K[p][2][i]))), h - 3))); });
  return K;
}
// old model's yearly step, compounding
const step = (p, a) => { if (p === 'QB') return a < 25 ? 1.08 : a < 31 ? 1.02 : a < 35 ? 1 : a < 38 ? 0.9 : 0.75; if (p === 'RB') return a < 23 ? 1.1 : a < 26 ? 1.02 : a < 27 ? 0.95 : a < 28 ? 0.88 : a < 29 ? 0.82 : 0.72; if (p === 'WR') return a < 24 ? 1.1 : a < 28 ? 1.03 : a < 30 ? 0.97 : a < 31 ? 0.9 : 0.8; if (p === 'TE') return a < 25 ? 1.12 : a < 29 ? 1.03 : a < 31 ? 0.95 : 0.85; return a < 25 ? 1.04 : a < 29 ? 1 : a < 31 ? 0.92 : a < 33 ? 0.85 : 0.75; };
// pick outcome curve: average surplus by years since draft for picks near each overall slot, drafts before the cutoff
function pickCurve(L, cut, pooled) {
  const src = pooled ? Object.values(ds) : [L]; const rows = [];
  src.forEach(M => M.drafts.filter(d => d.y < cut).forEach(d => { const pos = M.pos[d.pid]; const vals = [0, 1, 2, 3, 4].map(j => { const yy = d.y + j; if (yy >= cut || !M.ps[yy]) return null; const n = M.ps[yy][d.pid]; const r = (M.repl[yy] || {})[pos] || 0; return n && n[1] >= 3 ? Math.max(0, n[0] / n[1] - r) : 0; }); rows.push({ o: d.overall, vals }); }));
  return o => { const w = Math.max(2, Math.round(o * 0.3)); const near = rows.filter(r => Math.abs(r.o - o) <= w); return [0, 1, 2, 3, 4].map(j => { const v = near.map(r => r.vals[j]).filter(x => x != null); if (v.length >= 3) return v.reduce((a, b) => a + b, 0) / v.length; const v1 = near.map(r => r.vals[1]).filter(x => x != null); return v1.length ? v1.reduce((a, b) => a + b, 0) / v1.length : 0; }); };
}
const trades = [];
for (const [key, L] of Object.entries(ds)) L.trades.forEach(t => { if (t.y > LAST - 2) return; trades.push({ key, L, t }); });
function ppgAt(L, p, y, w) { // what we knew: this season before week w (if 4+ games) blended with last season
  const c = L.ps[y] && L.ps[y][p]; let pc = null, gc = 0; if (c && c[2]) { let s = 0; Object.entries(c[2]).forEach(([ww, v]) => { if (+ww < w && v !== 0) { s += v; gc++; } }); if (gc) pc = s / gc; }
  const q = L.ps[y - 1] && L.ps[y - 1][p]; const pp = q && q[1] >= 3 ? q[0] / q[1] : null;
  if (global.BLEND3) { const q2 = L.ps[y - 2] && L.ps[y - 2][p]; const p2 = q2 && q2[1] >= 3 ? q2[0] / q2[1] : null; let num = 0, den = 0; if (pc != null) { num += pc * gc; den += gc; } if (pp != null) { num += pp * q[1] * 0.6; den += q[1] * 0.6; } if (p2 != null) { num += p2 * q2[1] * 0.3; den += q2[1] * 0.3; } if (!den) return 0; const v = num / den; return den < 4 ? v * 0.75 : v; }
  if (pc != null && pp != null) { const k = gc / (gc + 4); return k * pc + (1 - k) * pp; } return pc != null ? (gc >= 3 ? pc : pc * 0.7) : pp != null ? pp * 0.85 : 0;
}
function evalModel(M) {
  const res = [];
  const Kc = {}; const PC = {};
  for (const { key, L, t } of trades) {
    const k1 = L.k1[t.y]; const lrw = L.lrw[t.y] || 14; const w = Math.ceil((t.d - k1) / 7) + 1;
    const off = w > 17; const y0 = off ? t.y + 1 : t.y; const wk = off ? 1 : Math.max(1, w); // season the projection starts in
    if (y0 > LAST - 1) continue;
    const K = Kc[y0] = Kc[y0] || fitK(y0 + (off ? 0 : 0)); const pc = PC[key + y0] = PC[key + y0] || pickCurve(L, y0, M.pooled);
    const remW = Math.max(0, lrw - wk + 1);
    const g = s => s <= 0 ? 0 : Math.pow(s, M.p);
    const side = assets => { let pred = 0, act = 0, ok = true;
      assets.forEach(a => {
        if (/^\d+$/.test(a)) { const pos = L.pos[a]; const r = (L.repl[off ? t.y : y0] || {})[pos] || 0; const v0 = off ? ppgAt(L, a, t.y + 1, 1) : ppgAt(L, a, y0, wk); const s0 = v0 - r; const ag = age(a, y0); const gp = grp(pos);
          for (let h = 0; h <= (M.naive ? 2 : M.H); h++) { const wks = h === 0 ? remW : lrw; let s;
            if (M.kind === 'old') { let v = v0; for (let j = 0; j < h; j++) v *= step(pos, ag == null ? 26 : ag + j); s = v - r; }
            else if (global.BELOW && s0 <= 0 && h > 0 && r > 0) { const bin = v0 / r >= 0.75 ? 1 : 0; const ab = ag == null ? 2 : ag < 23 ? 0 : ag < 25 ? 1 : ag < 27 ? 2 : 3; s = r * ((TB[gp] || [[[0]]])[bin][ab][Math.min(5, h) - 1] || 0); }
            else s = h === 0 || M.naive ? s0 : s0 * ((K[gp] && K[gp][Math.min(5, h)] || [])[B(ag == null ? 26 : ag)] || 0.5);
            pred += Math.pow(M.d, h) * wks * g(s); }
          for (let h = 0; h <= 2; h++) { const yy = y0 + h; if (yy > LAST) break; const n = L.ps[yy] && L.ps[yy][a]; let s = 0; const rr = (L.repl[yy] || {})[pos] || 0;
            if (h === 0 && n && n[2]) { let tot = 0, gg = 0; Object.entries(n[2]).forEach(([ww, v]) => { if (+ww >= wk && +ww <= lrw && v !== 0) { tot += v - rr; gg++; } }); act += Math.max(0, tot); } else if (n && n[1] >= 3) act += Math.max(0, n[0] - rr * n[1]) * (h === 0 ? remW / lrw : 1); }
        } else if (/^FP_/.test(a)) { const m = a.match(/^FP_(\d+)_(\d+)_(\d+)$/); const py = +m[2], rd = +m[3]; const ov = (rd - 1) * 12 + 6.5; const curve = pc(ov);
          for (let j = 0; j <= 4; j++) { const h = py - y0 + j; if (h < 0 || h > M.H + 1) continue; pred += Math.pow(M.d, Math.max(0, h)) * lrw * g(curve[j]) * M.pm; }
          const pid = t.pickPid[a]; if (!pid) { ok = false; return; } const pos = L.pos[pid];
          for (let h = 0; h <= 2; h++) { const yy = y0 + h; if (yy > LAST || yy < py) continue; const n = L.ps[yy] && L.ps[yy][pid]; const rr = (L.repl[yy] || {})[pos] || 0; if (n && n[1] >= 3) act += Math.max(0, n[0] - rr * n[1]); }
        } });
      return { pred, act, ok }; };
    const a = side(t.g2), b = side(t.g1); // f1 received g2
    if (!a.ok || !b.ok) continue; if (a.act + b.act < 20) continue;
    res.push({ key, pd: a.pred - b.pred, ad: a.act - b.act, at: a.act + b.act, rm: (a.pred - b.pred) / Math.max(1, a.pred + b.pred) });
  }
  // winner accuracy on clear outcomes, and rank correlation
  const clear = res.filter(r => Math.abs(r.ad) >= 0.15 * r.at && r.pd !== 0);
  const acc = clear.filter(r => Math.sign(r.pd) === Math.sign(r.ad)).length / clear.length;
  const rank = arr => { const s = arr.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = []; s.forEach(([, i], k) => r[i] = k); return r; };
  const x = rank(res.map(r => r.pd)), y = rank(res.map(r => r.ad)); const n = x.length; const mx = (n - 1) / 2; let num = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - mx); dx += (x[i] - mx) ** 2; dy += (y[i] - mx) ** 2; }
  const conf = (() => { const z = res.map(r => ({ ...r, c: Math.abs(r.pd) / (Math.abs(r.pd) + 1e-9) })); const srt = [...res].sort((a, b) => Math.abs(b.pd) - Math.abs(a.pd)); const q = k => { const top = srt.slice(0, Math.round(srt.length * k)).filter(r => Math.abs(r.ad) >= 0.15 * r.at && r.pd !== 0); return +(100 * top.filter(r => Math.sign(r.pd) === Math.sign(r.ad)).length / top.length).toFixed(1); }; return { top10: q(0.1), top25: q(0.25), top50: q(0.5) }; })();
  if (global.CAL) { for (const k of ['loc', 'titan', 'flex']) { const v = res.filter(r => r.key === k).map(r => Math.abs(r.pd)).sort((a, b) => a - b); const q = f => Math.round(v[Math.floor(v.length * f)]); console.log(k, 'abs margin quantiles 50/75/90:', q(0.5), q(0.75), q(0.9)); }
    const srt = [...res].filter(x => x.ad !== 0).sort((a, b) => Math.abs(b.pd) - Math.abs(a.pd)); const seg = (a, b) => { const r = srt.slice(Math.round(srt.length * a), Math.round(srt.length * b)); return (100 * r.filter(x => Math.sign(x.pd) === Math.sign(x.ad)).length / r.length).toFixed(0) + '% of ' + r.length; }; console.log('  most confident 10%:', seg(0, 0.1), ' next 15%:', seg(0.1, 0.25), ' next 25%:', seg(0.25, 0.5), ' bottom half:', seg(0.5, 1)); const bins = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 1.01]; for (let i = 0; i < bins.length - 1; i++) { const r = res.filter(x => Math.abs(x.rm) >= bins[i] && Math.abs(x.rm) < bins[i + 1] && x.ad !== 0); const won = r.filter(x => Math.sign(x.rm || 1) === Math.sign(x.ad)).length; console.log(`  margin ${bins[i]}-${bins[i + 1]}: n ${r.length}, favored side got more ${r.length ? (100 * won / r.length).toFixed(0) : '-'}%`); } }
  return { n: res.length, clear: clear.length, acc: +(acc * 100).toFixed(1), rho: +(num / Math.sqrt(dx * dy)).toFixed(3), ...conf };
}
const runs = [
  { name: 'naive: current ppg surplus only, this window', kind: 'fit', naive: true, p: 1, d: 1, H: 0, pm: 0, pooled: true },
  { name: 'current model (old age curves, star premium 1.5)', kind: 'old', p: 1.5, d: 0.85, H: 4, pm: 1, pooled: false },
  { name: 'old curves, no star premium', kind: 'old', p: 1, d: 0.85, H: 4, pm: 1, pooled: false },
];
for (const p of [1, 1.25, 1.5]) for (const pm of [1, 1.5]) for (const pooled of [false, true]) runs.push({ name: `fitted curves p${p} picks x${pm}${pooled ? ' pooled' : ''}`, kind: 'fit', p, d: 0.85, H: 4, pm, pooled });
for (const p of [1, 1.5]) for (const pm of [1, 1.5, 2]) runs.push({ name: `fitted, 3-season window p${p} picks x${pm}`, kind: 'fit', p, d: 0.9, H: 2, pm, pooled: true });
const pick = process.argv[2]; const R2 = pick ? runs.filter(r => r.name.includes(pick)) : runs;
R2.forEach(M => console.log(M.name.padEnd(48), JSON.stringify(evalModel(M))));
global.BLEND3 = true; console.log('--- with three-season blend'); R2.forEach(M => console.log(M.name.padEnd(48), JSON.stringify(evalModel(M))));
if (process.argv[3] === 'cal') { global.BLEND3 = true; global.CAL = true; console.log('CALIBRATION, own-league picks, p1.25'); console.log(JSON.stringify(evalModel({ kind: 'fit', p: 1.25, d: 0.85, H: 4, pm: 1, pooled: false }))); }
if (process.argv[3] === 'k') { const K = fitK(LAST + 2); const r = {}; Object.entries(K).forEach(([p, hs]) => r[p] = [1, 2, 3, 4, 5].map(h => hs[h].map(v => +v.toFixed(2)))); fs.writeFileSync('Kfinal.json', JSON.stringify(r)); console.log(JSON.stringify(r)); }

if (process.argv[3] === 'below') { global.BLEND3 = true; const M = { kind: 'fit', p: 1.25, d: 0.85, H: 4, pm: 1, pooled: false }; console.log('without', JSON.stringify(evalModel(M))); global.BELOW = true; console.log('with   ', JSON.stringify(evalModel(M))); }

if (process.argv[3] === 'json') { global.BLEND3 = true; global.BELOW = true; const M = { kind: 'fit', p: 1.25, d: 0.85, H: 4, pm: 1, pooled: false };
  const r = evalModel(M); global.BLEND3 = true; global.BELOW = false; const old = evalModel({ kind: 'old', p: 1.5, d: 0.85, H: 4, pm: 1, pooled: false });
  console.log(JSON.stringify({ last: LAST, model: r, guessedCurves: old })); }
