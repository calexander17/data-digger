#!/usr/bin/env node
// Live scores for the NFL week in progress, for the Monday Mayhem column.
// Usage: NODE_USE_ENV_PROXY=1 node live.js page-data.json live.json
// MFL leagues read MFL's liveScoring export; Sleeper leagues read the week's matchups; ESPN and Yahoo leagues
// already carry the week in progress in their refreshed data, so their live numbers come from page-data.json.
// Writes { y, w, ts, src, teams: { f: { pts, players: [[pid, pts, secsLeft, nflTeam]] } }, pairs: [[a, b]] }.
// secsLeft is game seconds left for that player's NFL game (3600 = not started, 0 = final, null = unknown).
const fs = require('fs');
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const env = { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' };
  if (fs.existsSync('/root/.ccr/ca-bundle.crt') && !env.NODE_EXTRA_CA_CERTS) env.NODE_EXTRA_CA_CERTS = '/root/.ccr/ca-bundle.crt';
  const r = require('child_process').spawnSync(process.execPath, process.argv.slice(1), { env, stdio: 'inherit' });
  process.exit(r.status == null ? 1 : r.status);
}
const CFG = {
  loc: { kind: 'mfl', league: '56819' },
  titan: { kind: 'mfl', league: '25778' },
  flex: { kind: 'sleeper', league: '1316519766675984384', rosterMap: { 1: 12, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 11: 10, 12: 11 } },
  sunday: { kind: 'sleeper', league: '1312833415829000192' },
  bush: { kind: 'data' },
  espn: { kind: 'data' },
};
const TEAM = { GB: 'GBP', KC: 'KCC', LV: 'LVR', NO: 'NOS', NE: 'NEP', SF: 'SFO', TB: 'TBB', JAX: 'JAC', WSH: 'WAS', LA: 'LAR', OAK: 'LVR', SD: 'LAC', STL: 'LAR' };
const NICK = { Cardinals: 'ARI', Falcons: 'ATL', Ravens: 'BAL', Bills: 'BUF', Panthers: 'CAR', Bears: 'CHI', Bengals: 'CIN', Browns: 'CLE', Cowboys: 'DAL', Broncos: 'DEN', Lions: 'DET', Packers: 'GBP', Texans: 'HOU', Colts: 'IND', Jaguars: 'JAC', Chiefs: 'KCC', Chargers: 'LAC', Rams: 'LAR', Raiders: 'LVR', Dolphins: 'MIA', Vikings: 'MIN', Patriots: 'NEP', Saints: 'NOS', Giants: 'NYG', Jets: 'NYJ', Eagles: 'PHI', Steelers: 'PIT', Seahawks: 'SEA', '49ers': 'SFO', Buccaneers: 'TBB', Titans: 'TEN', Commanders: 'WAS' };
const normTeam = (t, name) => { t = String(t || '').toUpperCase(); if (t === 'DEF' || t === 'FA' || !t) { const n = Object.keys(NICK).find(k => (name || '').includes(k)); return n ? NICK[n] : null; } return TEAM[t] || t; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) { for (let a = 0; a < 5; a++) { try { const r = await fetch(url, { headers: { 'User-Agent': 'data-digger-live' } }); if (r.ok) { const t = await r.text(); if (t.trimStart()[0] === '{' || t.trimStart()[0] === '[') return JSON.parse(t); } } catch (e) {} await sleep(2500 * (a + 1)); } return null; }
const arr = x => [].concat(x || []);
(async () => {
  const [file, out] = process.argv.slice(2);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const key = raw.crossKey; const C = CFG[key]; if (!C) throw new Error('no live config for ' + key);
  const years = Object.keys(raw.fr).map(Number).sort((a, b) => a - b); const y = years[years.length - 1], yi = years.length - 1;
  const st = await get('https://api.sleeper.app/v1/state/nfl');
  const w = +process.env.LIVE_WEEK || (st && +st.week); if (!w) throw new Error('could not read the current NFL week');
  const sch = await get(`https://api.myfantasyleague.com/${y}/export?TYPE=nflSchedule&W=${w}&JSON=1`);
  const secs = {}; arr(sch && sch.nflSchedule && sch.nflSchedule.matchup).forEach(m => { const s = m.gameSecondsRemaining != null ? +m.gameSecondsRemaining : 3600; arr(m.team).forEach(t => secs[t.id] = s); });
  const teamOf = pid => { const p = raw.pl[pid]; return p ? normTeam(p[2], p[0]) : null; };
  const secsOf = pid => { const t = teamOf(pid); return t ? (t in secs ? secs[t] : 0) : null; }; // a team not on the schedule is on bye
  const R = { y, w, ts: new Date().toISOString(), src: C.kind, teams: {}, pairs: [] };
  if (C.kind === 'mfl') {
    const d = await get(`https://api.myfantasyleague.com/${y}/export?TYPE=liveScoring&L=${C.league}&W=${w}&DETAILS=1&JSON=1`);
    if (!d || !d.liveScoring) throw new Error('MFL liveScoring unavailable');
    arr(d.liveScoring.matchup).forEach(m => { const fs2 = arr(m.franchise); if (fs2.length !== 2) return; const ids = fs2.map(f => +f.id); R.pairs.push(ids);
      fs2.forEach(f => { R.teams[+f.id] = { pts: +f.score || 0, players: arr(f.players && f.players.player).filter(p => p.status === 'starter').map(p => [p.id, +p.score || 0, p.gameSecondsRemaining != null ? +p.gameSecondsRemaining : secsOf(p.id), teamOf(p.id)]) }; }); });
  } else if (C.kind === 'sleeper') {
    const ms = await get(`https://api.sleeper.app/v1/league/${C.league}/matchups/${w}`);
    if (!ms) throw new Error('Sleeper matchups unavailable');
    const sl = await get('https://api.sleeper.app/v1/players/nfl') || {};
    // Sleeper id -> page id: 9000000+id when the page uses that, otherwise the page player with the same name and position
    const norm = n => (n || '').toLowerCase().replace(/[.']/g, '').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/[^a-z ]/g, '').trim().split(/\s+/).join(' ');
    const byName = {}, nameOnly = {}; Object.entries(raw.pl).forEach(([id, p]) => { const [a, b] = p[0].split(', '); const n = norm(b ? b + ' ' + a : a); byName[n + '|' + p[1]] = id; nameOnly[n] = nameOnly[n] === undefined ? id : null; });
    const pid = sid => { if (raw.pl[String(9000000 + +sid)]) return String(9000000 + +sid); const p = sl[sid]; if (!p) return 'S' + sid; if (p.position === 'DEF') { const t = normTeam(sid); const id = Object.keys(raw.pl).find(k => raw.pl[k][1] === 'DEF' && normTeam(raw.pl[k][2], raw.pl[k][0]) === t); return id || 'S' + sid; } const n = norm(p.full_name || (p.first_name + ' ' + p.last_name)); return byName[n + '|' + p.position] || nameOnly[n] || 'S' + sid; };
    const RM = C.rosterMap || {}; const by = {};
    arr(ms).forEach(m => { if (m.matchup_id == null) return; const f = RM[m.roster_id] || m.roster_id; (by[m.matchup_id] = by[m.matchup_id] || []).push(f);
      R.teams[f] = { pts: +m.points || 0, players: arr(m.starters).filter(s => s && s !== '0').map((s, i) => { const p = sl[s] || {}; const t = normTeam(p.position === 'DEF' ? s : p.team, p.full_name); const id = pid(s); return [id, +((m.starters_points || [])[i]) || 0, t ? (t in secs ? secs[t] : 0) : null, t, raw.pl[id] ? null : `${p.full_name || s} ${p.position || ''}`.trim()]; }) }; });
    R.pairs = Object.values(by).filter(x => x.length === 2);
  } else {
    // ESPN and Yahoo: the refreshed data already has the week in progress
    const g = (raw.games || '').split('\n').filter(Boolean).map(l => l.split('|')).filter(a => +a[0] === yi && +a[1] === w);
    if (!g.length || !raw.lw || +raw.lw.w !== w) throw new Error(`the ${key} data has no week ${w} scores yet; run the daily refresh first`);
    g.forEach(a => { R.pairs.push([+a[3], +a[7]]); R.teams[+a[3]] = { pts: +a[4], players: [] }; R.teams[+a[7]] = { pts: +a[8], players: [] }; });
    String(raw.lw.rows).split('\n').filter(Boolean).map(l => l.split('|')).forEach(([f, p, pts, started]) => { if (started !== '1' || !R.teams[+f]) return; R.teams[+f].players.push([p, +pts || 0, secsOf(p), teamOf(p)]); });
  }
  if (!R.pairs.length) throw new Error('no matchups found for week ' + w);
  fs.writeFileSync(out, JSON.stringify(R));
  const left = Object.values(R.teams).reduce((n, t) => n + t.players.filter(p => p[2] == null || p[2] > 0).length, 0);
  console.log(JSON.stringify({ ok: true, key, y, w, games: R.pairs.length, playersLeft: left, unknownTeam: Object.values(R.teams).reduce((n, t) => n + t.players.filter(p => p[2] == null).length, 0) }));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
