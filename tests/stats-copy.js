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
  t: { w: 1, l: 1, t: 1, pts: -5, rows: [
    { week: 1, pick: { team: 'A' }, status: 'win' },
    { week: 2, pick: { team: 'B' }, status: 'loss' },
    { week: 3, pick: { team: 'C' }, status: 'tie' },
    { week: 4, pick: { team: 'D' }, status: 'pending' },
  ] }, bench: null, teamsLeft: 29, benchTop: [],
  xwN: 0, xwSpread: 0, graded: 3, chalkN: 0, dogWins: 0,
  streak: 0, best: 0, avgWin: null, avgLoss: null, blowout: null, beat: null,
};
let stats = base;
ctx.statsFor = () => stats;
let prices = {};
ctx.pickProbInfo = (_team, week) => prices[week] || { probability: null, basis: null };
ctx.S.games = { 1: [{}] };
ctx.S.picks = [
  { player_id: 1, week: 1, team: 'A' },
  { player_id: 2, week: 1, team: 'A' },
  { player_id: 3, week: 1, team: 'B' },
];
assert.equal(ctx.contrarianFor(1).score, 0.5, 'a shared pick can still differ from half of the others');
ctx.openPlayerStats(1);
assert.match(body.innerHTML, /Pick strength/);
assert.match(body.innerHTML, /Average win chance<\/span><strong>Unknown/);
assert.match(body.innerHTML, /No completed picks with usable odds yet/);
assert.match(body.innerHTML, /Expected wins<strong>—/);
assert.match(body.innerHTML, /Actual wins<strong>—/);
assert.match(body.innerHTML, /Picked differently<\/td><td>50%/);
assert.match(body.innerHTML, /average share of other people whose visible picks were on different teams/i);
assert.doesNotMatch(body.innerHTML, /nobody else in the family picked/);
assert.match(body.innerHTML, /saved upcoming picks count as used/);
assert.doesNotMatch(body.innerHTML, /Backs favourites|Underdog wins|Luck or judgement/);
assert.match(body.innerHTML, /Based on 0 of 3 completed picks/);

prices = { 1: { probability: 0.7, basis: 'moneyline' } };
stats = { ...base, xwN: 1, xw: 0.7, xwWins: 1, luck: 0.3 };
ctx.openPlayerStats(1);
assert.match(body.innerHTML, /Average win chance<\/span><strong>70%/);
assert.match(body.innerHTML, /Week 1 · A · 70% chance/);
assert.doesNotMatch(body.innerHTML, /Week 2 ·|Week 3 ·|Week 4 ·/);
assert.match(body.innerHTML, /Based on 1 of 3 completed picks/);
assert.match(body.innerHTML, /2 without usable odds omitted/);
assert.match(body.innerHTML, /Expected wins<strong>0.7/);
assert.match(body.innerHTML, /Actual wins<strong>1/);

prices = { 1: { probability: 0.7, basis: 'moneyline' },
  2: { probability: 0.5, basis: 'spread' }, 3: { probability: 0.3, basis: 'moneyline' },
  4: { probability: 0.9, basis: 'moneyline' } };
stats = { ...base, xwN: 3, xwSpread: 1, xw: 1.5, xwWins: 1, luck: -0.5 };
ctx.openPlayerStats(1);
assert.match(body.innerHTML, /Average win chance<\/span><strong>~50%/);
assert.match(body.innerHTML, /Week 2 · B · ~50% chance/);
assert.match(body.innerHTML, /Week 3 · C · 30% chance/);
assert.match(body.innerHTML, /class="tie">Tied/);
assert.doesNotMatch(body.innerHTML, /Week 4 ·/);
assert.match(body.innerHTML, /Expected wins<strong>1.5/);
assert.match(body.innerHTML, /Actual wins<strong>1/);
assert.match(body.innerHTML, /-0.5 wins below expectation/);
assert.match(body.innerHTML, /Based on 3 of 3 completed picks/);
stats = { ...stats, xw: 1.04, xwWins: 1, luck: -0.04 };
ctx.openPlayerStats(1);
assert.match(body.innerHTML, /In line with expectation/);
assert.doesNotMatch(body.innerHTML, /-0\.0 wins/);
assert.equal(ctx.pins, 1, 'an odds refresh of the open detail sheet does not repin the page');
assert.equal(close.focuses, 1, 'an odds refresh does not steal focus');
console.log('Stats detail copy and missing-odds coverage: 3 cases passed');
