/* Production odds cache/recovery functions in Node; no browser or league writes. */
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require('path').join(__dirname, '../survivor.js'), 'utf8');
const saved = new Map();
const future = new Date(Date.now() + 86400000).toISOString();
const old = new Date(Date.now() - 86400000).toISOString();
const game = (date, state, odds, homeScore = null, awayScore = null) => ({
  id: '401872935', week: 2, date, state, odds,
  home: { abbr: 'TB', score: homeScore }, away: { abbr: 'CLE', score: awayScore },
});
const line = { hML: -180, aML: 150, favBy: 3.5, favAbbr: 'TB', homeFav: true, awayFav: false };
const ctx = vm.createContext({ Date, Number, Math, String, Map, Set, Promise, console: { warn() {} },
  S: { demo: false, games: {}, picks: [], screen: 'pick' }, SEASON: 2026, LAST_WEEK: 18,
  ESPN_SB: 'https://example.test/scoreboard', ESPN_SUMMARY: 'https://example.test/summary',
  SCORE_MAX_AGE: 21600000, memCache: {}, scoreFetchedAt: {}, scoreStale: {},
  ABBR_FIX: {}, fixAbbr: (s) => String(s || '').toUpperCase(), NFL_SD: 13.5,
  jGet: (k, d) => saved.has(k) ? saved.get(k) : d, jSet: (k, v) => saved.set(k, v),
  normGame: (g) => g, AbortController, setTimeout, clearTimeout, renderStats() {},
});
function load(name) {
  const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm'));
  assert(match, `production function ${name} exists`);
  vm.runInContext(match[0], ctx);
}
vm.runInContext('const priceCache = {}, priceAttempts = {}; let recoveringPrices = null;', ctx);
for (const name of ['mlProb', 'ncdf', 'recTotals', 'matchupRead', 'gameForTeam', 'priceKey',
  'savedPrice', 'savePrice', 'summaryClosingOdds', 'recoverHistoricalOdds', 'weekGames', 'pickProbInfo']) load(name);
function summary(g, odds = line) {
  return { header: { id: g.id, week: g.week, season: { year: 2026, type: 2 },
    competitions: [{ id: g.id, date: g.date, status: { type: { state: 'post' } }, competitors: [
      { homeAway: 'home', team: { abbreviation: g.home.abbr } },
      { homeAway: 'away', team: { abbreviation: g.away.abbr } },
    ] }] }, pickcenter: [{ provider: { name: 'DraftKings' },
      moneyline: { home: { close: { odds: String(odds.hML) } }, away: { close: { odds: String(odds.aML) } } },
      pointSpread: { home: { close: { line: '-3.5' } } },
    }] };
}
(async () => {
  const pre = game(future, 'pre', line);
  ctx.fetch = async () => ({ ok: true, json: async () => ({ events: [pre] }) });
  await ctx.weekGames(2, true);
  assert.equal(ctx.savedPrice(pre).origin, 'pregame');
  assert.equal(ctx.savedPrice(pre).odds.hML, -180);
  assert.equal(ctx.savePrice(game(old, 'pre', { ...line, hML: -900 }), { ...line, hML: -900 }, 'pregame'), false,
    'a late pre-state feed cannot capture after scheduled kickoff');
  ctx.fetch = async () => ({ ok: true, json: async () => ({ events: [game(future, 'pre', null)] }) });
  await ctx.weekGames(2, true);
  assert.equal(ctx.savedPrice(pre).odds.hML, -180, 'null pregame refresh keeps last quote');
  const started = game(future, 'in', { ...line, hML: -900 });
  ctx.fetch = async () => ({ ok: true, json: async () => ({ events: [started] }) });
  await ctx.weekGames(2, true);
  assert.equal(ctx.savedPrice(started).odds.hML, -180, 'in-play line cannot overwrite pregame');
  const final = game(future, 'post', null, 19, 29);
  ctx.fetch = async () => ({ ok: true, json: async () => ({ events: [final] }) });
  await ctx.weekGames(2, true);
  assert.equal(ctx.savedPrice(final).odds.hML, -180, 'null final refresh retains pregame quote');
  assert.equal(ctx.pickProbInfo('TB', 2).basis, 'moneyline');
  vm.runInContext('for (const key of Object.keys(priceCache)) delete priceCache[key]', ctx);
  assert.equal(ctx.savedPrice(final).odds.hML, -180, 'new page restores quote from device storage');
  assert.equal(ctx.savedPrice({ ...final, id: 'other' }), null, 'event mismatch rejected');
  assert.equal(ctx.savedPrice({ ...final, home: { abbr: 'NYJ' } }), null, 'team mismatch rejected');
  assert.equal(ctx.savedPrice({ ...final, date: old }), null, 'kickoff mismatch rejected');
  assert.equal(ctx.savedPrice({ ...final, week: 3 }), null, 'week mismatch rejected');
  assert.equal(ctx.pickProbInfo('TB', 2).basis, 'moneyline');
  assert.equal(ctx.summaryClosingOdds(summary(final), final).hML, -180);
  assert.equal(ctx.summaryClosingOdds({ ...summary(final), header: { ...summary(final).header, week: 3 } }, final), null);
  assert.equal(ctx.summaryClosingOdds({ ...summary(final), header: { ...summary(final).header, season: { year: 2025, type: 2 } } }, final), null);
  assert.equal(ctx.summaryClosingOdds({ ...summary(final), header: { ...summary(final).header,
    competitions: [{ ...summary(final).header.competitions[0], status: { type: { state: 'in' } } }] } }, final), null);
  ctx.S.picks = [{ week: 2, team: 'TB' }];
  ctx.fetch = async () => ({ ok: true, json: async () => summary(final, { hML: -425, aML: 330 }) });
  await ctx.recoverHistoricalOdds();
  assert.equal(ctx.savedPrice(final).origin, 'close');
  assert.equal(ctx.savedPrice(final).odds.hML, -425, 'verified closing quote supersedes pregame');
  ctx.fetch = async () => { throw Error('offline'); };
  await ctx.weekGames(2, true);
  assert.equal(ctx.savedPrice(final).odds.hML, -425, 'network failure retains closing quote');
  assert.equal(ctx.pickProbInfo('TB', 2).basis, 'moneyline');
  console.log('Odds archive: pregame capture, freeze, refresh, reload, identity and close recovery passed');
})().catch((e) => { console.error(e); process.exitCode = 1; });
