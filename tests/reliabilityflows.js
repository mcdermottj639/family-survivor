/* Production calculations and interrupted writes, with synthetic state only. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, '../survivor.js'), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + ': ' + e.message); }
}
function load(ctx, names) {
  for (const name of names) {
    const m = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm'));
    assert(m, name); vm.runInContext(m[0], ctx);
  }
}
const ctx = vm.createContext({ console: { warn() {} }, S: {}, LAST_WEEK: 18,
  ABBRS: ['A', 'B', 'C', 'D'], render() {}, teamShort: t => t });
load(ctx, ['gameForTeam', 'gradePick', 'pickVisible', 'picksOf', 'pickIn', 'usedTeamsVisible',
  'tallyFor', 'standings', 'weekIsComplete', 'lastCompleteWeek', 'trendMap', 'weeklyWinners',
  'andList', 'shareCardData', 'reloadPicks', 'say', 'savePick', 'clearPick', 'askConfirm', 'askClear']);
for (const name of ['signed', 'winnerTeams']) {
  const m = source.match(new RegExp(`^const ${name} = .*;$`, 'm'));
  assert(m, name); vm.runInContext(m[0], ctx);
}
const game = (home = 'A', away = 'B', state = 'post', h = 20, a = 10) => ({
  state, home: { abbr: home, score: h }, away: { abbr: away, score: a }, date: '2099-10-01T17:00:00Z' });
const slate = () => [game(), game('C', 'D')];
function resetResults() {
  ctx.S = { me: { id: 1 }, players: [{ id: 1, display_name: 'Alex' }, { id: 2, display_name: 'Sam' }],
    games: { 1: slate(), 2: slate() }, picks: [
      { player_id: 1, week: 1, team: 'A' }, { player_id: 2, week: 1, team: 'B' },
      { player_id: 1, week: 2, team: 'C' }, { player_id: 2, week: 2, team: 'C' }] };
}
function resetWrite() {
  const db = { picks: [{ player_id: 1, week: 3, team: 'B' }, { player_id: 2, week: 3, team: 'C' }], writes: 0, reads: 0 };
  ctx.S = { week: 3, me: { id: 1, token: 'test-only-token' }, games: { 3: slate() },
    picks: structuredClone(db.picks), store: {
      async listPicks() { db.reads++; return structuredClone(db.picks); },
      async submitPick(token, week, team) {
        db.writes++; db.args = [token, week, team];
        db.picks = db.picks.filter(p => p.player_id !== 1 || p.week !== week);
        db.picks.push({ player_id: 1, week, team }); return { ok: true };
      },
      async clearPick(token, week) {
        db.writes++; db.args = [token, week];
        db.picks = db.picks.filter(p => p.player_id !== 1 || p.week !== week); return { ok: true };
      }
    } };
  return db;
}
const offline = () => { throw Error('response lost'); };

(async () => {
  await test('Missing or unknown game data keeps another member’s pick hidden', () => {
    for (const games of [undefined, [], [game('C', 'D')], [game('A', 'B', 'unknown')]])
      assert.equal(ctx.pickVisible('A', games), false);
  });
  await test('Picks reveal only for an in-progress or final game', () => {
    assert.equal(ctx.pickVisible('A', [game('A', 'B', 'pre')]), false);
    for (const state of ['in', 'post']) assert.equal(ctx.pickVisible('A', [game('A', 'B', state)]), true);
    assert.equal(ctx.pickVisible(null, slate()), false);
  });
  await test('The owner can still see their own used team during a feed gap', () => {
    resetResults(); ctx.S.games = {};
    assert.deepEqual(Object.keys(ctx.usedTeamsVisible(1)), ['A', 'C']);
    assert.equal(Object.keys(ctx.usedTeamsVisible(2)).length, 0);
  });
  await test('A Thursday result cannot crown a finished weekly winner', () => {
    resetResults(); ctx.S.games[2][0].state = 'pre';
    assert.equal(ctx.weeklyWinners().some(w => w.week === 2), false);
    const leader = ctx.weeklyWinners(true).find(w => w.week === 2);
    assert.equal(leader.complete, false); assert.equal(leader.winners.length, 2);
  });
  await test('A complete week keeps every tied winner and moves the cutoff', () => {
    resetResults(); const w = ctx.weeklyWinners().find(w => w.week === 2);
    assert.equal(w.complete, true); assert.equal(w.winners.length, 2);
    assert.equal(ctx.lastCompleteWeek(ctx.S.games), 2);
  });
  await test('Missing scores, duplicate games and partial opening slates cannot finish a week', () => {
    for (const damage of [s => { s[0].home.score = null; }, s => { s.push(s[0]); }, s => { s.pop(); }]) {
      resetResults(); damage(ctx.S.games[2]); assert.equal(ctx.weekIsComplete(2, ctx.S.games), false);
      assert.equal(ctx.lastCompleteWeek(ctx.S.games), 1);
    }
  });
  await test('A saved pick missing from the feed blocks a finished week', () => {
    resetResults(); ctx.S.picks.push({ player_id: 1, week: 2, team: 'MISSING' });
    assert.equal(ctx.weekIsComplete(2, ctx.S.games), false);
  });
  await test('Zero scores are valid finals and tied games do not invent a winner', () => {
    resetResults(); for (const g of ctx.S.games[2]) { g.home.score = 0; g.away.score = 0; }
    assert.equal(ctx.weekIsComplete(2, ctx.S.games), true);
    assert.equal(ctx.weeklyWinners().some(w => w.week === 2), false);
  });
  await test('Share card records and leader match its completed-week label', () => {
    resetResults(); ctx.S.games[3] = [game('C', 'D', 'post', 60, 0), game('A', 'B', 'pre')];
    ctx.S.picks.push({ player_id: 2, week: 3, team: 'C' });
    assert.equal(ctx.standings(ctx.S.games)[0].p.display_name, 'Sam');
    const card = ctx.shareCardData(); assert.equal(card.week, 2);
    assert.equal(card.top[0].name, 'Alex'); assert.equal(card.top[0].rec, '2-0'); assert.equal(card.top[0].pts, '+20');
    assert.equal(card.top[1].name, 'Sam'); assert.equal(card.top[1].rec, '1-1'); assert.equal(card.top[1].pts, '0');
    assert.equal(card.standout.names.length, 2);
  });
  await test('Acknowledged save says saved, with exactly one write', async () => {
    const db = resetWrite(); await ctx.savePick('A');
    assert.equal(db.writes, 1); assert.equal(ctx.pickIn(1, 3).team, 'A');
    assert.equal(ctx.S.msg.kind, 'ok'); assert.match(ctx.S.msg.text, /Pick saved/);
    assert.doesNotMatch(ctx.S.msg.text, /Locked in/); assert.equal(ctx.S.saving, false);
    assert.equal(ctx.pickIn(2, 3).team, 'C');
  });
  await test('Committed save with a dropped response is verified without resubmitting', async () => {
    const db = resetWrite(), submit = ctx.S.store.submitPick;
    ctx.S.store.submitPick = async (...args) => { await submit(...args); offline(); };
    await ctx.savePick('A'); assert.equal(db.writes, 1); assert.equal(db.reads, 1);
    assert.equal(ctx.S.msg.kind, 'ok'); assert.equal(ctx.pickIn(1, 3).team, 'A');
  });
  await test('Uncommitted save never reports success', async () => {
    const db = resetWrite(); ctx.S.store.submitPick = () => { db.writes++; offline(); };
    await ctx.savePick('A'); assert.equal(db.writes, 1); assert.equal(ctx.S.msg.kind, 'bad');
    assert.equal(ctx.pickIn(1, 3).team, 'B'); assert.match(ctx.S.msg.text, /couldn't confirm/);
  });
  await test('A failed write and failed read retain the last known pick without a success claim', async () => {
    resetWrite(); ctx.S.store.submitPick = offline; ctx.S.store.listPicks = offline;
    await ctx.savePick('A'); assert.equal(ctx.pickIn(1, 3).team, 'B');
    assert.equal(ctx.S.msg.kind, 'bad'); assert.match(ctx.S.msg.text, /last loaded pick/);
    assert.equal(ctx.S.refreshError, true); assert.equal(ctx.S.saving, false);
  });
  await test('Acknowledged save survives a failed refresh', async () => {
    resetWrite(); ctx.S.store.listPicks = offline; await ctx.savePick('A');
    assert.equal(ctx.pickIn(1, 3).team, 'A'); assert.equal(ctx.pickIn(1, 3).entered_by, 'self');
    assert.equal(ctx.S.msg.kind, 'ok'); assert.equal(ctx.S.refreshError, true);
  });
  await test('A later device change is displayed rather than a stale success', async () => {
    resetWrite(); ctx.S.store.listPicks = async () => [{ player_id: 1, week: 3, team: 'D' }];
    await ctx.savePick('A'); assert.equal(ctx.pickIn(1, 3).team, 'D');
    assert.equal(ctx.S.msg.kind, 'bad'); assert.match(ctx.S.msg.text, /changed again/);
  });
  await test('Server rule refusals preserve the prior pick and the exact reason', async () => {
    const db = resetWrite(); ctx.S.store.submitPick = async () => ({ ok: false, error: 'That game has already started.' });
    await ctx.savePick('A'); assert.equal(ctx.pickIn(1, 3).team, 'B'); assert.equal(db.reads, 0);
    assert.equal(ctx.S.msg.kind, 'bad'); assert.equal(ctx.S.msg.text, 'That game has already started.');
  });
  await test('Definitive HTTP refusals retain the helpful server explanation without reconciliation', async () => {
    for (const action of ['savePick', 'clearPick']) {
      const db = resetWrite(), error = Object.assign(Error('This part of the app needs the league database updated.'), { status: 404 });
      ctx.S.store[action === 'savePick' ? 'submitPick' : 'clearPick'] = async () => { throw error; };
      await ctx[action]('A'); assert.equal(db.reads, 0); assert.equal(ctx.pickIn(1, 3).team, 'B');
      assert.equal(ctx.S.msg.kind, 'bad'); assert.equal(ctx.S.msg.text, error.message);
    }
  });
  await test('An in-flight save keeps its original week and blocks duplicate actions', async () => {
    const db = resetWrite(), submit = ctx.S.store.submitPick; let release;
    ctx.S.store.submitPick = (...args) => new Promise(resolve => { release = async () => resolve(await submit(...args)); });
    const pending = ctx.savePick('A'); ctx.S.week = 4;
    await ctx.savePick('C'); await ctx.clearPick(); ctx.askConfirm('C'); ctx.askClear();
    assert.equal(ctx.S.confirming, undefined); await release(); await pending;
    assert.equal(db.writes, 1); assert.equal(db.args[1], 3); assert.equal(ctx.pickIn(1, 3).team, 'A');
    assert.match(ctx.S.msg.text, /week 3/); assert.equal(ctx.pickIn(1, 4), null);
  });
  await test('Committed clear with a dropped response is verified once', async () => {
    const db = resetWrite(), clear = ctx.S.store.clearPick;
    ctx.S.store.clearPick = async (...args) => { await clear(...args); offline(); };
    await ctx.clearPick(); assert.equal(db.writes, 1); assert.equal(db.reads, 1);
    assert.equal(ctx.pickIn(1, 3), null); assert.equal(ctx.S.msg.kind, 'ok');
    assert.equal(ctx.pickIn(2, 3).team, 'C');
  });
  await test('Uncommitted clear retains the saved pick and reports uncertainty', async () => {
    resetWrite(); ctx.S.store.clearPick = offline; await ctx.clearPick();
    assert.equal(ctx.pickIn(1, 3).team, 'B'); assert.equal(ctx.S.msg.kind, 'bad');
    assert.match(ctx.S.msg.text, /still saved/);
  });
  await test('Clear with no write response and no fresh read does not invent success', async () => {
    resetWrite(); ctx.S.store.clearPick = offline; ctx.S.store.listPicks = offline;
    await ctx.clearPick(); assert.equal(ctx.pickIn(1, 3).team, 'B'); assert.equal(ctx.S.msg.kind, 'bad');
    assert.match(ctx.S.msg.text, /last loaded pick/); assert.equal(ctx.S.saving, false);
  });
  await test('Acknowledged clear survives a failed refresh', async () => {
    resetWrite(); ctx.S.store.listPicks = offline; await ctx.clearPick();
    assert.equal(ctx.pickIn(1, 3), null); assert.equal(ctx.S.msg.kind, 'ok');
  });
  await test('A pick restored by another device prevents a stale clear confirmation', async () => {
    resetWrite(); ctx.S.store.listPicks = async () => [{ player_id: 1, week: 3, team: 'D' }];
    await ctx.clearPick(); assert.equal(ctx.pickIn(1, 3).team, 'D');
    assert.equal(ctx.S.msg.kind, 'bad'); assert.match(ctx.S.msg.text, /saved again/);
  });
  await test('A locked clear preserves the pick and server explanation', async () => {
    resetWrite(); ctx.S.store.clearPick = async () => ({ ok: false, error: 'Week 3 is locked in.' });
    await ctx.clearPick(); assert.equal(ctx.pickIn(1, 3).team, 'B');
    assert.equal(ctx.S.msg.kind, 'bad'); assert.equal(ctx.S.msg.text, 'Week 3 is locked in.');
  });
  await test('Malformed readback cannot erase a good snapshot', async () => {
    resetWrite(); ctx.S.store.listPicks = async () => null;
    assert.equal(await ctx.reloadPicks(), false); assert.equal(ctx.S.picks.length, 2);
  });
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})();
