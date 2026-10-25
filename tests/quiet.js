/* v91 — quiet names. Jack (25 Oct 2026): a member he no longer wants chased
   must stop appearing under "Still to pick", but must NOT be removed from the
   standings and must NOT be labelled anywhere ("Don't make her public ...
   Don't want it on display").

   So the promise is three-sided and every side is asserted:
     1. a `muted` member is absent from every chase list — the Standings card
        every relative sees, the Admin readiness count/list, and the copied
        reminder;
     2. they are still in the standings table, unchanged;
     3. nothing on any screen says why — no "muted", "eliminated", "out",
        "archived" or similar next to a name, for a relative OR the
        commissioner.
   A fake shared league (tests/_fakesupa.js) answers the app's HTTP calls; no
   real member is read or changed. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${m}`); };
const LABELS = /\b(muted|eliminated|knocked out|archived|inactive|withdrawn|out of the (league|pool))\b/i;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SURVIVOR_CHROMIUM || undefined, args: ['--no-sandbox'] });
  try {
    const db = fake.makeDB();
    for (const name of ['Jack', 'Nana', 'Uncle Bob', 'Cousin Quiet']) {
      fake.rpc(db, 'admin_add_player', { p_admin_token: db.players[0]?.token || 'bootstrap', p_name: name });
    }
    db.players.forEach((p) => { p.claimed_at = '2026-09-10T12:00:00Z'; });
    const [jack, nana, bob, quiet] = db.players;
        db.picks = [
      { player_id: jack.id, week: 4, team: 'NE', kickoff: '2099-10-01T17:00:00Z' },
      { player_id: nana.id, week: 4, team: 'MIA', kickoff: '2099-10-01T17:00:00Z' },
      { player_id: quiet.id, week: 3, team: 'BUF', kickoff: '2026-09-27T17:00:00Z' },
    ];
    const original = JSON.stringify({ players: db.players, picks: db.picks });

    const open = async (who) => {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await fake.attach(ctx, db);
      await ctx.route('https://site.api.espn.com/**', (r) => r.abort());
      await ctx.route('https://a.espncdn.com/**', (r) => r.abort());
      const p = await ctx.newPage();
      p.__errors = [];
      p.on('pageerror', (e) => p.__errors.push(e.message));
      await p.goto(`http://127.0.0.1:8099/?u=${who.token}`);
      await p.waitForSelector('#tabs:not([hidden])');
      await p.evaluate((qid) => {
        QUIET_IDS.clear(); QUIET_IDS.add(qid);   // the fixture's IDs, not the real league's
        currentWeek = async () => 4;
        S.liveWeek = 4; S.week = 4; S.weekPinned = true;
        render();
      }, quiet.id);
      return { ctx, p };
    };

    console.log('\n— the shipped list is IDs only, and only for the real league —');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'survivor.js'), 'utf8');
    const decl = (src.match(/const QUIET_IDS = new Set\(\[([^\]]*)\]\)/) || [])[1];
    ok(decl !== undefined && decl.split(',').every((x) => /^\s*\d+\s*$/.test(x) || !x.trim()), `QUIET_IDS holds numbers only, no names (${decl})`);
    const A = await open(jack);
    ok(await A.p.evaluate(() => { const d = S.demo; S.demo = true; const r = isQuiet({ id: [...QUIET_IDS][0] }); S.demo = d; return r; }) === false,
      'demo mode never applies the real league\'s quiet list');
    ok(await A.p.evaluate((id) => isQuiet({ id }), quiet.id) === true, 'the quiet member is recognised by ID');

    console.log('\n— a relative\'s Standings: not chased, still ranked, never labelled —');
    const R = await open(bob);
    await R.p.click('[data-screen="standings"]');
    await R.p.waitForTimeout(400);
    const card = await R.p.locator('#s-standings .card.waiting').innerText();
    ok(/Still to pick for week 4:/.test(card) && card.includes('Uncle Bob'), 'the chase card still names a real non-picker');
    ok(!card.includes('Cousin Quiet'), 'the muted member is NOT on the chase card');
    const stText = await R.p.locator('#s-standings').innerText();
    ok(stText.includes('Cousin Quiet'), 'the muted member is still in the standings');
    ok(!LABELS.test(stText), 'no label explains it anywhere on Standings');

    console.log('\n— when the only non-picker is muted, nobody is chased —');
    db.picks.push({ player_id: bob.id, week: 4, team: 'KC', kickoff: '2099-10-01T17:00:00Z' });
    await R.p.evaluate(async () => { S.players = await S.store.listPlayers(); S.picks = await S.store.listPicks(); render(); });
    await R.p.waitForTimeout(300);
    const card2 = await R.p.locator('#s-standings .card.waiting').innerText();
    ok(!card2.includes('Cousin Quiet') && !/Still to pick/.test(card2), `no chase card naming her (${JSON.stringify(card2)})`);
    db.picks.pop();

    console.log('\n— the commissioner\'s Admin: count, list and reminder —');
    await A.p.evaluate(async () => { S.players = await S.store.listPlayers(); S.picks = await S.store.listPicks(); render(); });
    await A.p.click('#tab-admin');
    ok(await A.p.locator('.ad-count').innerText() === '2 of 3\npicks saved', 'the count leaves the muted member out of the total');
    await A.p.locator('#ad-missing > summary').click();
    const missing = await A.p.locator('.ad-missing-row > span').allTextContents();
    ok(missing.length === 1 && missing[0].includes('Uncle Bob'), `the Admin chase list is just Uncle Bob (${JSON.stringify(missing)})`);
    await A.p.evaluate(() => { copyText = async (text) => { window.__copied = text; return true; }; });
    await A.p.click('#ad-reminder');
    await A.p.waitForFunction(() => !!window.__copied);
    const msg = await A.p.evaluate(() => window.__copied);
    ok(msg.includes('Uncle Bob') && !msg.includes('Cousin Quiet'), 'the copied reminder does not name her');
    ok(!LABELS.test(msg), 'and says nothing about why');
    const roster2 = await A.p.locator('#s-admin').innerText();
    ok(roster2.includes('Cousin Quiet'), 'she is still in the commissioner\'s roster');
    ok(!/\bmuted\b/i.test(roster2), 'with no "muted" label in Admin either');

    console.log('\n— nothing changed underneath —');
    ok(JSON.stringify({ players: db.players, picks: db.picks }) === original, 'no member or pick was written');
    ok(A.p.__errors.length === 0 && R.p.__errors.length === 0, `no page errors (${[...A.p.__errors, ...R.p.__errors].join(' | ')})`);
    await A.ctx.close(); await R.ctx.close();
  } catch (e) {
    fail++; console.log('  ✗ suite crashed: ' + e.message);
  } finally {
    await b.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
