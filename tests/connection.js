/* Real cloud client, entirely intercepted: no requests reach the live league. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const B = 'http://127.0.0.1:8099/';
async function fixture(browser) {
  const db = fake.makeDB();
  fake.rpc(db, 'admin_add_player', { p_admin_token: 'bootstrap', p_name: 'Jack' });
  for (const name of ['Nana', 'Sam']) fake.rpc(db, 'admin_add_player', { p_admin_token: db.players[0].token, p_name: name });
  const member = db.players[1]; member.claimed_at = '2026-09-01T00:00:00Z';
  const ctx = await browser.newContext({ viewport: { width: 320, height: 812 }, serviceWorkers: 'block' });
  // External resources are blocked by default, including the real database.
  // The fake DB and ESPN fixtures below are the only external responses.
  await ctx.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await fake.attach(ctx, db);
  await ctx.route('**/site.api.espn.com/**', route => route.fulfill({ status: 200,
    contentType: 'application/json', body: '{"events":[]}' }));
  return { db, member, ctx };
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.SURVIVOR_CHROMIUM || undefined, args: ['--no-sandbox'] });
  try {
    for (const mode of ['link', 'remembered']) {
      const { db, member, ctx } = await fixture(browser), before = JSON.stringify([db.players, db.picks]);
      await ctx.addInitScript(token => localStorage.setItem('survivor:me', token), member.token);
      let failures = 2;
      await ctx.route('**/rest/v1/rpc/whoami', route => failures-- > 0
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporarily unavailable"}' })
        : route.fallback());
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const url = mode === 'link' ? B + '?u=' + member.token : B;
      await page.goto(url); await page.waitForSelector('#boot-retry');
      ok(/Can't reach the league/.test(await page.locator('#boot').innerText()), mode + ': identity outage shows a connection retry');
      ok(!await page.locator('#s-pick').isVisible(), mode + ': it never claims the link is invalid or offers another identity');
      ok(page.url() === url && await page.evaluate(() => localStorage.getItem('survivor:me')) === member.token,
        mode + ': failed lookup preserves the exact URL and remembered token');
      await page.click('#boot-retry');
      await page.waitForFunction(() => document.querySelector('#boot-retry')?.textContent === 'Try again');
      ok(await page.locator('#boot-retry').isEnabled(), mode + ': another failed attempt remains retryable');
      await page.click('#boot-retry'); await page.waitForSelector('#tabs:not([hidden])');
      const identity = await page.evaluate(() => ({ id: S.me.id, token: S.me.token, saved: localStorage.getItem('survivor:me') }));
      ok(identity.id === member.id && identity.token === member.token && identity.saved === member.token,
        mode + ': retry returns to the same member without reset or reclaim');
      ok(new URL(page.url()).searchParams.get('u') === member.token, mode + ': working personal link remains available for return visits');
      ok(JSON.stringify([db.players, db.picks]) === before, mode + ': retries made no member or pick changes');
      ok(!errors.length, mode + ': no browser errors');
      if (mode === 'link') {
        await page.evaluate(() => {
          const g = (h, a, state) => ({ state, date: '2099-10-01T17:00:00Z',
            home: { abbr: h, score: 20 }, away: { abbr: a, score: 10 } });
          S.games = { 3: [g('NE', 'MIA', 'post'), g('SF', 'SEA', 'pre')] };
          S.picks = [{ player_id: S.players.find(p => p.display_name === 'Sam').id, week: 3, team: 'NE' }];
          S.screen = 'stats'; render();
        });
        ok(/Leading so far: Sam/.test(await page.locator('#s-stats .wp-nm').innerText()), 'unfinished weekly leader is explicitly provisional');
        ok(await page.evaluate(() => weeklyWinners().length) === 0, 'unfinished week has no final winner');
        const overflow = await page.locator('#s-stats .wp-row').evaluate(el => el.scrollWidth > el.clientWidth + 1);
        ok(!overflow, 'provisional wording fits the 320px week-winner row');
        await page.evaluate(() => { S.games[3][1].state = 'post'; render(); });
        ok(await page.locator('#s-stats .wp-nm').innerText() === 'Sam', 'final week uses the normal winner name');
        await page.evaluate(() => {
          S.week = 4; S.weekPinned = true; S.screen = 'pick'; S.picks = [];
          S.games[4] = [{ state: 'pre', date: '2099-10-01T17:00:00Z',
            home: { abbr: 'NE', score: null }, away: { abbr: 'MIA', score: null } }]; render();
        });
        let submissions = 0, clears = 0;
        await ctx.route('**/rest/v1/rpc/submit_pick', async route => {
          submissions++; fake.rpc(db, 'submit_pick', JSON.parse(route.request().postData()));
          await route.abort('failed');
        });
        await page.click('.pk[data-team="NE"]'); await page.click('#cf-yes');
        await page.waitForFunction(() => !S.saving && document.querySelector('#s-pick .msg')?.textContent.includes('Pick saved:'));
        ok(submissions === 1 && db.picks.some(p => p.player_id === member.id && p.week === 4 && p.team === 'NE'),
          'dropped HTTP save response is reconciled through the real confirmation flow without resubmission');
        ok(/Pick saved:/.test(await page.locator('#s-pick .msg').innerText()) && await page.locator('#pk-clear').isVisible(),
          'confirmed saved pick remains visible and editable before kickoff');
        await ctx.route('**/rest/v1/rpc/clear_pick', async route => {
          clears++; fake.rpc(db, 'clear_pick', JSON.parse(route.request().postData()));
          await route.abort('failed');
        });
        await page.click('#pk-clear'); await page.click('#cl-yes');
        await page.waitForFunction(() => !S.saving && document.querySelector('#s-pick .msg')?.textContent.includes('is clear'));
        ok(clears === 1 && !db.picks.some(p => p.player_id === member.id && p.week === 4),
          'dropped HTTP clear response is reconciled through the real confirmation flow without resubmission');
        ok(await page.locator('#pk-clear').count() === 0 && await page.locator('.pk[data-team="NE"]').isEnabled(),
          'confirmed clear restores the team and leaves the week pickable');
      }
      await ctx.close();
    }
    const { db, ctx } = await fixture(browser), before = JSON.stringify([db.players, db.picks]);
    const page = await ctx.newPage(); await page.goto(B + '?u=not-a-real-member');
    await page.waitForSelector('#s-pick:not([hidden])');
    ok(/This link isn't working/.test(await page.locator('#s-pick').innerText()), 'a genuinely unrecognized token keeps the existing invalid-link guidance');
    ok(await page.locator('#boot-retry').count() === 0, 'a confirmed invalid link is not mislabeled as a network outage');
    ok(JSON.stringify([db.players, db.picks]) === before, 'invalid-link handling makes no member or pick changes');
    await ctx.close();
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
