/* Focused production-renderer checks without a browser dependency. */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require('path').join(__dirname, '../survivor.js'), 'utf8');
const body = { innerHTML: '' };
const sheet = { hidden: true }, close = { focus() { close.focuses++; }, focuses: 0 };
const ctx = vm.createContext({
  S: { me: { id: 1 }, players: [{ id: 1, display_name: 'Pat' }], sheet: null },
  LAST_WEEK: 18, RATING_MIN_G: 3,
  $: (selector) => selector === '#sheet-body' ? body : selector === '#sheet' ? sheet : close,
  setSheetLabel() {}, pinBody() { ctx.pins++; }, pins: 0, teamShort: (team) => team,
  recoverHistoricalOdds() {},
  signed: (n) => n >= 0 ? `+${n}` : String(n),
  esc: (value) => String(value),
  pickVisible: () => true,
});
for (const name of ['pctStr', 'statRow', 'contrarianFor', 'openPlayerStats']) {
  const match = source.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'));
  assert(match, `production function ${name} exists`);
  vm.runInContext(match[0], ctx);
}
const base = {
  t: { w: 1, l: 2, t: 0, pts: -5 }, bench: null, teamsLeft: 29, benchTop: [],
  xwN: 0, xwSpread: 0, graded: 3, chalkN: 0, dogWins: 0,
  streak: 0, best: 0, avgWin: null, avgLoss: null, blowout: null, beat: null,
};
let stats = base;
ctx.statsFor = () => stats;
ctx.S.games = { 1: [{}] };
ctx.S.picks = [
  { player_id: 1, week: 1, team: 'A' },
  { player_id: 2, week: 1, team: 'A' },
  { player_id: 3, week: 1, team: 'B' },
];
assert.equal(ctx.contrarianFor(1).score, 0.5, 'a shared pick can still differ from half of the others');
ctx.openPlayerStats(1);
assert.match(body.innerHTML, /Underdog wins<\/td><td>Unknown/);
assert.match(body.innerHTML, /no completed picks with usable odds/);
assert.match(body.innerHTML, /Picked differently<\/td><td>50%/);
assert.match(body.innerHTML, /average share of other people whose visible picks were on different teams/i);
assert.doesNotMatch(body.innerHTML, /nobody else in the family picked/);
assert.match(body.innerHTML, /saved upcoming picks count as used/);
assert.match(body.innerHTML, /wins with a team given less than a 50% chance/i);
assert.match(body.innerHTML, /Only 0 completed picks have usable odds here/);

stats = { ...base, xwN: 1, dogWins: 1 };
ctx.openPlayerStats(1);
assert.match(body.innerHTML, /Underdog wins<\/td><td>1/);
assert.match(body.innerHTML, /among 1 of 3 completed picks with odds/);

stats = { ...base, xwN: 3, dogWins: 0, xw: 1.5, xwWins: 1, luck: -0.5 };
ctx.openPlayerStats(1);
assert.match(body.innerHTML, /Underdog wins<\/td><td>0/);
assert.match(body.innerHTML, /among 3 of 3 completed picks with odds/);
assert.equal(ctx.pins, 1, 'an odds refresh of the open detail sheet does not repin the page');
assert.equal(close.focuses, 1, 'an odds refresh does not steal focus');
console.log('Stats detail copy and missing-odds coverage: 3 cases passed');
