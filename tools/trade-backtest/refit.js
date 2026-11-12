#!/usr/bin/env node
// Refits the trade grade curves on the leagues' latest history, backtests them, and patches analytics.js.
// Usage (in this folder, with ../run/<key>/build holding each league's build files): node refit.js <analytics.js to patch>
// Prints one JSON line: {ok, updated, last, model:{acc, rho, top10, top25}, previous, changes}
const fs = require('fs'); const { execFileSync } = require('child_process');
const target = process.argv[2]; if (!target) { console.error('usage: node refit.js <analytics.js>'); process.exit(2); }
const run = (...a) => execFileSync(process.execPath, a, { encoding: 'utf8', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
run('extract.js'); run('bio.js');
run('below.js');
const bt = JSON.parse(run('backtest.js', 'x', 'json').trim().split('\n').pop());
run('backtest.js', 'x', 'k');
// never let value rise over time, and fade seasons 3 and later a little more
const K = JSON.parse(fs.readFileSync('Kfinal.json'));
for (const p in K) for (let h = 1; h < 5; h++) for (let b = 0; b < 7; b++) K[p][h][b] = +Math.min(K[p][h][b], K[p][h - 1][b] * (h >= 3 ? 0.88 : 1)).toFixed(2);
const TB = JSON.parse(fs.readFileSync('Tbelow_s.json'));
const hist = fs.existsSync('history.json') ? JSON.parse(fs.readFileSync('history.json')) : [];
const prev = hist.length ? hist[hist.length - 1] : null;
// guard: only update when the honest backtest has not gotten clearly worse
const worse = prev && bt.model.rho < prev.model.rho - 0.03;
let src = fs.readFileSync(target, 'utf8'); const before = src;
const acc = { all: Math.round(bt.model.acc), top: Math.round((bt.model.top10 + bt.model.top25) / 2), mid: Math.round(bt.model.top50) };
const changes = [];
if (!worse) {
  const oldK = (src.match(/const TG_K = (\{.*?\});/) || [])[1];
  if (oldK) { const o = JSON.parse(oldK); for (const p in K) for (let h = 0; h < 5; h++) for (let b = 0; b < 7; b++) { const d = K[p][h][b] - ((o[p] || [])[h] || [])[b]; if (Math.abs(d) >= 0.05) changes.push(`${p} age group ${['<23', '23-24', '25-26', '27-28', '29-30', '31-32', '33+'][b]}, ${h + 1} season(s) out: ${o[p][h][b]} -> ${K[p][h][b]}`); } }
  src = src.replace(/const TG_K = \{.*?\};/, 'const TG_K = ' + JSON.stringify(K) + ';').replace(/const TG_B = \{.*?\};/, 'const TG_B = ' + JSON.stringify(TB) + ';').replace(/const TG_ACC = \{.*?\};/, 'const TG_ACC = ' + JSON.stringify(acc) + ';');
  fs.writeFileSync(target, src);
}
hist.push({ date: new Date().toISOString().slice(0, 10), last: bt.last, model: bt.model, guessedCurves: bt.guessedCurves, updated: !worse && src !== before });
fs.writeFileSync('history.json', JSON.stringify(hist, null, 1));
console.log(JSON.stringify({ ok: true, updated: !worse && src !== before, heldBack: !!worse, last: bt.last, model: bt.model, previous: prev && prev.model, acc, changes: changes.slice(0, 15), nChanges: changes.length }));
