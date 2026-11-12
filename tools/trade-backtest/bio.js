const fs = require('fs'); const lib = require(require('path').resolve(__dirname, '../run/loc/build/lib.js'));
const ds = JSON.parse(fs.readFileSync('ds.json'));
const ids = new Set(); Object.values(ds).forEach(L => Object.values(L.ps).forEach(m => Object.keys(m).forEach(p => ids.add(p))));
(async () => { const bio = {}; let need = [...ids];
  for (const y of [2026, 2024, 2022, 2020, 2018]) { if (!need.length) break; const b = await lib.mflBio(y, need); Object.entries(b).forEach(([p, v]) => { if (v[0]) bio[p] = v; }); need = need.filter(p => !bio[p]); console.error(y, Object.keys(bio).length, 'missing', need.length); }
  fs.writeFileSync('bio.json', JSON.stringify(bio)); })();
