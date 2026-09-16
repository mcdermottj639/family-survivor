/* Executes the production recap/ranking functions in Node. No network, no
   live league writes. Browser suites remain responsible for rendered layout. */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(require('path').join(__dirname, '../survivor.js'), 'utf8');
const functions = ['esc', 'gameForTeam', 'gradePick', 'picksOf', 'pickIn', 'tallyFor', 'standings',
  'weeklyWinners', 'recapWeeks', 'recapSeenKey', 'recapEntryHTML', 'recapData', 'recapHTML', 'openRecap'];
const nodes = new Map();
const ctx = vm.createContext({ console, S: {}, SEASON: 2026, LAST_WEEK: 18,
  ABBRS: Array.from({ length: 32 }, (_, i) => `T${i}`),
  teamShort: (a) => a, lsGet: (k, d) => nodes.has(k) ? nodes.get(k) : d,
  lsSet: (k, v) => nodes.set(k, v), render() {}, pinBody() { ctx.pins++; }, pins: 0,
  setSheetLabel(label) { ctx.label = label; },
  $: (key) => { if (!nodes.has(key)) nodes.set(key, { focus() {} }); return nodes.get(key); }
});
for (const name of functions) {
  const match = source.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'));
  assert(match, `production function ${name} exists`);
  vm.runInContext(match[0], ctx);
}
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log(`  ✓ ${name}`); } catch (e) { fail++; console.log(`  ✗ ${name}: ${e.message}`); } }
function slate() { return Array.from({ length: 16 }, (_, i) => ({ id: String(i), state: 'post',
  home: { abbr: `T${i * 2}`, score: 24 }, away: { abbr: `T${i * 2 + 1}`, score: 17 } })); }
function reset() {
  nodes.clear(); ctx.pins = 0;
  ctx.S = { demo: false, me: { id: 1 }, players: [
    { id: 1, display_name: 'Jack' }, { id: 2, display_name: '<Alex>' },
    { id: 3, display_name: 'Sam' }, { id: 4, display_name: 'Nana' }],
  games: { 1: slate(), 2: slate() }, picks: [
    { player_id: 1, week: 1, team: 'T1' }, { player_id: 2, week: 1, team: 'T0' },
    { player_id: 3, week: 1, team: 'T0' }, { player_id: 4, week: 1, team: 'T1' },
    { player_id: 1, week: 2, team: 'T2' }, { player_id: 2, week: 2, team: 'T2' },
    { player_id: 3, week: 2, team: 'T3' }] };
}
reset();
test('Week 1 alone has no recap or entry', () => { delete ctx.S.games[2]; assert.equal(ctx.recapWeeks().length, 0); assert.equal(ctx.recapEntryHTML(true), ''); });
reset();
test('One unfinished Week 2 game blocks publication', () => { ctx.S.games[2][15].state = 'in'; assert.equal(ctx.recapWeeks().length, 0); });
reset();
test('An incomplete Week 2 slate blocks publication', () => { ctx.S.games[2].pop(); assert.equal(ctx.recapWeeks().length, 0); });
reset();
test('A missing score blocks publication', () => { ctx.S.games[2][0].home.score = null; assert.equal(ctx.recapWeeks().length, 0); });
reset();
test('Duplicate games cannot masquerade as a complete slate', () => { ctx.S.games[2].push(ctx.S.games[2][0]); assert.equal(ctx.recapWeeks().length, 0); });
reset();
test('Missing earlier results block invented standings movement', () => { delete ctx.S.games[1]; assert.equal(ctx.recapWeeks().length, 0); });
reset();
test('Week 2 final publishes exactly the first recap', () => { assert.deepEqual(Array.from(ctx.recapWeeks()), [2]); });
test('Week 1 cannot be opened directly', () => { assert.equal(ctx.recapData(1), null); ctx.openRecap(1); assert.equal(ctx.pins, 0); });
test('Win, loss, missed-pick totals reconcile', () => { const c = ctx.recapData(2).counts; assert.equal(c.win, 2); assert.equal(c.loss, 1); assert.equal(c.missed, 1); assert.equal(c.tie, 0); });
test('Missed pick has no loss or point penalty', () => { const r = ctx.recapData(2).rows.find(r => r.p.id === 4); assert.equal(r.l, 1); assert.equal(r.pts, -7); });
test('Weekly co-winners include every tied member', () => { assert.equal(ctx.recapData(2).winner.winners.length, 2); });
test('Movement uses prior settled week and tied ranks', () => { const r = ctx.recapData(2).mine; assert.equal(r.move, 1); assert.equal(r.rank, 2); });
test('Popular team and its count are derived from actual picks', () => { const p = ctx.recapData(2).popular; assert.equal(p.length, 1); assert.equal(p[0][0], 'T2'); assert.equal(p[0][1], 2); });
test('Names are escaped in the recap', () => { const h = ctx.recapHTML(2); assert(h.includes('&lt;Alex&gt;')); assert(!h.includes('<Alex>')); });
test('New recap has notice plus permanent button', () => { const h = ctx.recapEntryHTML(true); assert(h.includes('recap-notice')); assert(h.includes('recap-entry')); });
test('Opening marks it read and uses one accessible sheet', () => { ctx.openRecap(2); assert.equal(ctx.pins, 1); assert.equal(ctx.S.sheet, 'recap:2'); assert.equal(ctx.label, 'Week 2 family recap'); assert(!ctx.recapEntryHTML(true).includes('recap-notice')); assert(ctx.recapEntryHTML(true).includes('recap-entry')); });
test('Reopening in the same sheet does not double-lock scrolling', () => { ctx.openRecap(2); assert.equal(ctx.pins, 1); });
test('Dismissal is isolated per person', () => { ctx.S.me.id = 2; assert(ctx.recapEntryHTML(true).includes('recap-notice')); ctx.S.me.id = 1; });
test('Demo does not suppress the real league notice', () => { ctx.S.demo = true; assert(ctx.recapEntryHTML(true).includes('recap-notice')); ctx.S.demo = false; });
test('Next completed week reintroduces notice and preserves archive', () => { ctx.S.games[3] = slate(); assert.deepEqual(Array.from(ctx.recapWeeks()), [3, 2]); assert(ctx.recapEntryHTML(true).includes('recap-notice')); assert(ctx.recapHTML(3).includes('data-recap="2"')); });
reset();
test('A tie is neither a win nor a loss', () => { ctx.S.games[2][1].away.score = 24; const c = ctx.recapData(2).counts; assert.equal(c.tie, 3); assert.equal(c.win, 0); assert.equal(c.loss, 0); assert.equal(ctx.recapData(2).winner, undefined); });
test('All ties do not invent a winner', () => { assert(ctx.recapHTML(2).includes('No winning picks')); });
reset();
test('Missing picked-team game blocks a false finished recap', () => { ctx.S.picks[4].team = 'MISSING'; assert.equal(ctx.recapWeeks().length, 0); });
test('Release versions stay synchronized', () => { const root = require('path').join(__dirname, '..'); const v = source.match(/const APP_V = 'v(\d+)'/)[1]; assert(fs.readFileSync(root + '/sw.js', 'utf8').includes(`const APP_V = 'v${v}'`)); assert.equal((fs.readFileSync(root + '/index.html', 'utf8').match(new RegExp(`\\?v=${v}`, 'g')) || []).length, 2); });
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
