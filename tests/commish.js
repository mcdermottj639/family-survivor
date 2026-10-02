/* Commissioner-only weekly tools. A fake shared league proves the client
   contract without reading, changing, or recovering any real member. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${m}`); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.SURVIVOR_CHROMIUM || undefined, args: ['--no-sandbox'] });
  try {
    const db = fake.makeDB();
    for (const name of ['Jack', 'Nana', 'Uncle Bob', 'Aunt Mary']) {
      fake.rpc(db, 'admin_add_player', { p_admin_token: db.players[0]?.token || 'bootstrap', p_name: name });
    }
    db.players.forEach((p) => { p.claimed_at = '2026-09-10T12:00:00Z'; });
    const [jack, nana, bob] = db.players;
    db.picks = [
      { player_id: jack.id, week: 4, team: 'NE', kickoff: '2099-10-01T17:00:00Z' },
      { player_id: nana.id, week: 4, team: 'MIA', kickoff: '2099-10-01T17:00:00Z' },
      { player_id: bob.id, week: 3, team: 'BUF', kickoff: '2026-09-27T17:00:00Z' },
    ];
    const original = JSON.stringify({ players: db.players, picks: db.picks });
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await fake.attach(ctx, db);
    await ctx.route('https://site.api.espn.com/**', (r) => r.abort());
    await ctx.route('https://a.espncdn.com/**', (r) => r.abort());
    const p = await ctx.newPage(), errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const url = `http://127.0.0.1:8099/?u=${jack.token}`;
    await p.goto(url);
    await p.waitForSelector('#tabs:not([hidden])');
    await p.evaluate(() => {
      currentWeek = async () => 4;
      S.liveWeek = 4; S.week = 2; S.weekPinned = true; S.apWeek = 4;
      S.games[4] = demoGames(11); // future games for the form, no external scores
    });
    await p.click('#tab-admin');
    ok(await p.locator('.ad-count').innerText() === '2 of 4\npicks saved', 'summary counts the live week while Pick is on an older week');
    ok(await p.locator('#ad-readiness .ad-eyebrow').innerText() === 'Week 4', 'summary names its own current week');
    ok(await p.locator('#ad-reminder').count() === 1, 'one accessible reminder control');
    ok(await p.locator('#ad-proxy').evaluate((e) => !!(e.compareDocumentPosition(document.querySelector('.plrow')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'weekly help comes before the family roster');
    await p.locator('#ad-missing > summary').click();
    const missing = await p.locator('.ad-missing-row > span').allTextContents();
    ok(missing.length === 2 && missing.includes('Uncle Bob') && missing.includes('Aunt Mary'), 'missing list contains exactly the two current-week non-pickers');
    await p.click(`[data-admin-pick="${bob.id}"]`);
    ok(await p.locator('#ap-who').inputValue() === String(bob.id), 'missing-picker shortcut selects the intended person');
    ok(await p.locator('#ap-week').inputValue() === '4', 'shortcut selects the current week');
    ok(await p.evaluate(() => document.activeElement.id) === 'ap-who', 'shortcut moves keyboard focus into the form');
    ok(JSON.stringify({ players: db.players, picks: db.picks }) === original, 'the shortcut does not submit a pick or change any member');
    await p.selectOption('#ap-week', '5');
    await p.waitForFunction(() => S.apWeek === 5);
    ok(await p.locator('#ap-who').inputValue() === String(bob.id), 'changing week preserves the chosen member');

    await p.evaluate(() => {
      S.apWeek = 4; render();
      window.__form = document.querySelector('#ad-proxy');
    });
    const team = await p.locator('#ap-team option').nth(1).getAttribute('value');
    await p.selectOption('#ap-team', team);
    await p.fill('#ad-name', 'Not saved');
    await p.click('#ad-refresh');
    await p.waitForFunction(() => document.querySelector('.ad-refresh-note').textContent.startsWith('Checked'));
    ok(await p.evaluate(() => window.__form === document.querySelector('#ad-proxy')), 'refresh preserves the form DOM');
    ok(await p.locator('#ap-team').inputValue() === team && await p.locator('#ad-name').inputValue() === 'Not saved', 'refresh preserves the draft team and typed family name');
    ok(await p.evaluate(() => document.activeElement.id) === 'ad-refresh', 'refresh restores focus to its button');

    await p.evaluate(() => { window.__readPicks = S.store.listPicks; S.store.listPicks = async () => { throw new Error('offline'); }; });
    await p.click('#ad-refresh');
    await p.waitForFunction(() => document.querySelector('.ad-refresh-note').textContent.includes('Could not refresh'));
    ok((await p.locator('.ad-count').innerText()).startsWith('2 of 4'), 'a failed read keeps the previous count rather than showing an empty league');
    ok(await p.locator('#ap-team').inputValue() === team, 'a failed read also preserves the draft');
    await p.evaluate(() => { S.store.listPicks = window.__readPicks; });

    await p.evaluate(() => {
      window.__snapshot = S.picks;
      S.store.listPicks = () => new Promise((resolve) => { window.__finishRead = resolve; });
    });
    await p.click('#ad-refresh');
    await p.waitForFunction(() => !!window.__finishRead);
    await p.evaluate(() => {
      S.picks = [...S.picks, { player_id: S.players.find((p) => p.display_name === 'Uncle Bob').id, week: 4, team: 'BUF' }];
      window.__finishRead(window.__snapshot);
    });
    await p.waitForFunction(() => !document.querySelector('#ad-refresh').disabled);
    ok((await p.locator('.ad-count').innerText()).startsWith('3 of 4'), 'a late refresh cannot overwrite a newer pick snapshot');
    await p.evaluate(() => { S.picks = window.__snapshot; S.store.listPicks = window.__readPicks; render(); });

    await p.evaluate(() => {
      window.__copy = copyText; copyText = async (text) => { window.__copied = text; return true; };
    });
    await p.click('#ad-reminder');
    await p.waitForFunction(() => !!window.__copied);
    const message = await p.evaluate(() => window.__copied);
    ok(message.includes('Week 4') && message.includes('Uncle Bob') && message.includes('Aunt Mary') && !message.includes('Nana'), 'reminder uses a fresh current-week missing list');
    ok(!message.includes('?u=') && db.players.every((x) => !message.includes(x.token)), 'copied reminder has no personal tokens or links');
    ok(JSON.stringify({ players: db.players, picks: db.picks }) === original, 'status, refresh, and reminder leave all identities and picks unchanged');

    const edge = await p.evaluate(() => {
      const players = S.players, picks = S.picks;
      S.players = [...players, { id: 999, display_name: '<test>', archived: true }];
      S.picks = [...picks, picks[0], { player_id: 999, week: 4, team: 'BUF' }];
      const result = adminReadiness();
      S.players = players; S.picks = picks;
      return { total: result.players.length, saved: result.saved };
    });
    ok(edge.total === 4 && edge.saved === 2, 'archived members and duplicate rows do not inflate the count');

    for (const width of [320, 390, 430]) {
      await p.setViewportSize({ width, height: 844 });
      await p.evaluate(() => { document.documentElement.dataset.big = '1'; document.querySelector('#ad-missing').open = true; });
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `commissioner tools fit ${width}px with Bigger Text`);
      ok(await p.locator('#ad-readiness button').evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 56)), `new controls retain 56px targets at ${width}px`);
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => { document.documentElement.removeAttribute('data-big'); });
    await p.selectOption('#ad-view-who', String(nana.id));
    await p.click('#ad-view-member');
    await p.waitForFunction(() => S.me?.display_name === 'Nana');
    ok(await p.locator('#tab-admin').isHidden(), 'member view has no Admin tab');
    ok(await p.locator('#ad-readiness').count() === 0, 'member view has none of the new commissioner UI');
    ok(await p.locator('#va-back').isVisible(), 'view-as still offers the way home');
    await p.click('#va-back');
    await p.waitForFunction(() => S.me?.is_admin);
    ok(p.url() === url, 'Back to my account restores the same original personal URL');
    ok(await p.locator('#tab-admin').isVisible(), 'commissioner access returns');
    ok(JSON.stringify({ players: db.players, picks: db.picks }) === original, 'view-as round trip does not change identities or saved picks');
    ok(errors.length === 0, 'no browser errors: ' + errors.join(', '));
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
