/* Production calculation regression fixtures; no browser or live writes. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, '../survivor.js'), 'utf8');
const players = Array.from({ length: 4 }, (_, id) => ({ id, display_name: `Member ${id}` }));
const game = (home, away, win = false) => ({ state: 'post', home: { abbr: home, score: win ? 20 : 10 }, away: { abbr: away, score: 14 } });
const S = { players, games: { 1: [game('A', 'B')], 2: [game('A', 'B')], 3: [game('A', 'B', true), game('C', 'D')] }, picks: [] };
for (let week = 1; week <= 3; week++) players.forEach(p => S.picks.push({ player_id: p.id, week, team: week === 3 && p.id >= 2 ? 'C' : 'A' }));
const ctx = vm.createContext({ S, ABBRS: ['A', 'B'], LAST_WEEK: 18 });
for (const name of ['gameForTeam', 'gradePick', 'pickVisible', 'crowdStats']) vm.runInContext(source.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'))[0], ctx);
let pass = 0;
function check(label, expected) { const c = ctx.crowdStats(); assert.deepStrictEqual([c.crowdW, c.crowdL, c.crowdT], expected, label); pass++; }
check('Week 3 split favorites add a win and a loss to 0–2', [1, 3, 0]);
assert(ctx.crowdStats().per.every(p => p.eligible === 2)); pass++;
S.games[3][1].home.score = 20; check('Both favorites win', [2, 2, 0]);
S.games[3][0].home.score = 10; S.games[3][1].home.score = 10; check('Both favorites lose', [0, 4, 0]);
S.games[3][1].home.score = 14; check('Actual game tie counts separately', [0, 3, 1]);
S.games[3][1].state = 'in'; check('Unfinished week excluded', [0, 2, 0]);
S.games[3][1].state = 'post'; S.games[3][1].home.score = null; check('Missing score excluded', [0, 2, 0]);
S.games[3][1].home.score = 20; S.games[3][0].state = 'pre'; check('Hidden picks excluded', [0, 2, 0]);
S.games[3][0].state = 'post'; S.games[3].pop(); check('Missing picked game excluded', [0, 2, 0]);
const v = source.match(/const APP_V = '(v\d+)'/)[1];
assert(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8').includes(`const APP_V = '${v}'`));
assert.equal((fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').match(new RegExp('\\?v=' + v.slice(1), 'g')) || []).length, 2); pass++;
console.log(`${pass} passed, 0 failed`);
