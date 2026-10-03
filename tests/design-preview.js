/* Commissioner-only opt-in and real UI interactions; all league traffic is faked. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${m}`); };
const B = 'http://127.0.0.1:8099/';
async function visualFixture(p) {
  return p.evaluate(() => {
    clearInterval(S.refreshTimer); S.refreshTimer = null;
    S.week = 4; S.liveWeek = 4; S.weekPinned = true; S.apWeek = 4;
    S.games = { 1: demoGames(1), 2: demoGames(2), 3: demoGames(3), 4: [
      { id: 'preview-ne', state: 'pre', date: '2099-10-01T17:00:00Z',
        home: { abbr: 'NE', score: null }, away: { abbr: 'MIA', score: null } },
      { id: 'preview-sf', state: 'pre', date: '2099-10-01T20:00:00Z',
        home: { abbr: 'SF', score: null }, away: { abbr: 'SEA', score: null } }] };
    for (const w of [1, 2, 3]) for (const g of S.games[w]) {
      g.state = 'post'; g.home.score = 24; g.away.score = 17;
    }
    S.picks = [];
    for (const w of [1, 2, 3]) for (const p of S.players) {
      const g = S.games[w][(p.id + w) % S.games[w].length];
      S.picks.push({ player_id: p.id, week: w, team: g.home.abbr, kickoff: g.date, entered_by: 'self' });
    }
    S.picks.push({ player_id: S.me.id, week: 4, team: 'NE', kickoff: S.games[4][0].date, entered_by: 'self' });
    S.screen = 'pick'; render();
    return S.picks;
  });
}
(async () => {
  const b = await chromium.launch({ executablePath: process.env.SURVIVOR_CHROMIUM || undefined, args: ['--no-sandbox'] });
  try {
    const db = fake.makeDB();
    for (const name of ['Jack', 'Nana', 'Grandpa Bartholomew', 'Sam'])
      fake.rpc(db, 'admin_add_player', { p_admin_token: db.players[0]?.token || 'bootstrap', p_name: name });
    db.players.forEach(p => { p.claimed_at = '2026-09-01T12:00:00Z'; });
    const [jack, nana] = db.players;
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    await fake.attach(ctx, db);
    await ctx.route('**/site.api.espn.com/**', r => r.fulfill({ contentType: 'application/json', body: '{"events":[]}' }));
    const p = await ctx.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(B + '?u=' + jack.token); await p.waitForSelector('#tabs:not([hidden])');
    db.picks = (await visualFixture(p)).map(p => ({ ...p, season: 2026 }));
    const before = JSON.stringify([db.players, db.picks]);
    const identity = await p.evaluate(() => ({ url: location.href, token: localStorage.getItem(meKey()), id: S.me.id }));
    const oldStyle = await p.locator('.locked').evaluate(e => getComputedStyle(e).backgroundImage);
    ok(!await p.evaluate(() => designPreviewOn()), 'preview starts off for the commissioner');
    ok(await p.locator('#design-preview-bar').isHidden(), 'no preview banner until opted in');
    await p.click('#tab-admin');
    ok(await p.locator('#design-preview-toggle').getAttribute('aria-pressed') === 'false', 'Admin offers an accessible off-by-default toggle');
    await p.click('#design-preview-toggle');
    ok(await p.evaluate(() => designPreviewOn()), 'Admin toggle enables the private preview');
    ok(await p.locator('#design-preview-toggle').getAttribute('aria-pressed') === 'true', 'toggle reflects its enabled state');
    ok(/real league/.test(await p.locator('#design-preview-control').innerText()), 'Admin states that real picks still count');
    await p.click('[data-screen="pick"]');
    ok(await p.locator('.locked').evaluate(e => getComputedStyle(e).backgroundImage) === 'none', 'saved pick uses a quiet surface instead of a gold plate');
    ok(/Your pick is saved/.test(await p.locator('.lk-k').innerText()), 'saved state is clear before kickoff');
    ok(await p.locator('.locked').evaluate(e => !!(e.compareDocumentPosition(document.querySelector('.recap-entry')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'saved pick comes before its optional recap');
    ok(await p.locator('#pk-clear').isVisible(), 'the existing clear-pick control remains available');
    await p.evaluate(() => { const g = S.games[4][0]; g.state = 'in'; g.home.score = 10; g.away.score = 7; render(); });
    ok(/live and locked/i.test(await p.locator('.lk-k').innerText()) && await p.locator('#pk-clear').count() === 0, 'live pick is labeled and retains its lock');
    await p.evaluate(() => { S.games[4][0].state = 'post'; render(); });
    ok(/final result/i.test(await p.locator('.lk-k').innerText()) && /Won by 3/i.test(await p.locator('.lk-res').innerText()), 'final pick shows the real result');
    await p.evaluate(() => { S.games[4] = []; render(); });
    ok(/schedule unavailable/i.test(await p.locator('.lk-k').innerText()), 'missing feed keeps a saved pick visible without inventing a result');
    await visualFixture(p);
    await p.evaluate(() => { S.picks = S.picks.filter(x => x.player_id !== S.me.id || x.week !== 4); render(); });
    ok(/No pick saved for Week 4/.test(await p.locator('.pv-status').innerText()), 'unpicked week is explicit and still offers the team choices');
    await visualFixture(p);
    await p.click('#pk-clear');
    ok(await p.locator('#confirm').isVisible() && await p.locator('#cl-yes').isDisabled(), 'clearing keeps the real confirmation and tremor guard');
    await p.click('#cf-no');
    ok(JSON.stringify([db.players, db.picks]) === before, 'preview activation and cancelled confirmation make no league writes');
    await p.click('[data-screen="standings"]');
    const summary = await p.locator('.pv-season-grid strong').allTextContents();
    const expected = await p.evaluate(() => { const r = standings(S.games).find(r => r.p.id === S.me.id); return [String(r.rank), `${r.w}–${r.l}–${r.t}`, signed(r.pts)]; });
    ok(JSON.stringify(summary) === JSON.stringify(expected), 'personal place, W–L–T and points equal the existing standings calculation');
    ok(await p.locator('.st tbody tr').count() === db.players.length, 'the full family table remains');
    await p.click('[data-stview="grid"]');
    ok(await p.locator('.grid-wrap').isVisible(), 'week-by-week view remains available');
    await p.click('[data-screen="history"]');
    ok(await p.locator('.pv-number-label').allTextContents().then(a => a.includes('This week') && a.includes('Season total')), 'weekly points and running total have distinct labels');
    ok(await p.locator('.pv-outcome').allTextContents().then(a => a.includes('Won') && a.includes('Pending')), 'history names the actual results and pending state');
    await p.click('[data-screen="stats"]');
    const sections = await p.locator('#s-stats > .pv-fold > summary').allTextContents();
    ok(sections[0] === 'Week winners' && sections[1] === 'With the crowd, or against it', 'the required Stats section order is preserved');
    ok(await p.locator('[data-preview-fold="stats-winners"]').evaluate(e => e.open) && await p.locator('[data-preview-fold="stats-crowd"]').evaluate(e => e.open), 'weekly winners and crowd open first');
    ok(await p.locator('[data-preview-fold="stats-people"]').evaluate(e => !e.open), 'longer player detail starts collapsed without being removed');
    ok(await p.locator('#s-stats .cw-week').count() === 3, 'every completed crowd week remains in the DOM');
    ok(await p.locator('.cw-week .cw-wk').first().textContent() === 'Week 3', 'latest crowd week leads');
    ok(await p.locator('[data-preview-fold="earlier-crowd"]').evaluate(e => !e.open), 'older weeks start folded');
    await p.locator('[data-preview-fold="earlier-crowd"] > summary').click();
    await p.locator('[data-preview-fold="stats-people"] > summary').click();
    await p.waitForFunction(() => localStorage.getItem(designPreviewKey('fold:stats-people')) === '1');
    const focusKey = await p.evaluate(() => { document.querySelector('[data-preview-fold="stats-people"] > summary').focus(); return previewFocus(); });
    const scrollBefore = await p.evaluate(() => scrollY);
    await p.evaluate(() => renderStats());
    ok(await p.locator('[data-preview-fold="stats-people"]').evaluate(e => e.open), 'expanded sections survive the direct odds-refresh render');
    ok(await p.locator('[data-preview-fold="earlier-crowd"]').evaluate(e => e.open), 'expanded earlier weeks survive refresh');
    ok(await p.evaluate(() => previewFocus()) === focusKey, 'refresh restores keyboard focus to the same disclosure');
    ok(Math.abs(await p.evaluate(() => scrollY) - scrollBefore) < 2, 'refresh keeps the reader’s scroll position');
    await p.evaluate(() => render());
    ok(await p.locator('[data-preview-fold="stats-people"]').evaluate(e => e.open), 'expanded state survives the full background render');
    await p.click('[data-screen="pick"]'); await p.click('#design-preview-exit');
    ok(await p.locator('.locked').evaluate(e => getComputedStyle(e).backgroundImage) === oldStyle, 'one-tap exit restores the exact original gold plate');
    ok(await p.locator('#design-preview-bar').isHidden(), 'exit removes the preview banner');
    const identityAfter = await p.evaluate(() => ({ url: location.href, token: localStorage.getItem(meKey()), id: S.me.id }));
    ok(JSON.stringify(identityAfter) === JSON.stringify(identity), 'toggling preserves the URL, token and member ID');
    await p.click('#tab-admin'); await p.click('#design-preview-toggle');
    await p.reload(); await p.waitForSelector('#tabs:not([hidden])');
    ok(await p.evaluate(() => designPreviewOn()), 'preview opt-in survives reopening the same commissioner account');
    await p.click('#tab-admin'); await p.selectOption('#ad-view-who', String(nana.id)); await p.click('#ad-view-member');
    await p.waitForFunction(id => S.me?.id === id, nana.id);
    ok(!await p.evaluate(() => designPreviewOn()) && !await p.evaluate(() => document.documentElement.hasAttribute('data-design-preview')), 'View as restores the member design');
    ok(await p.locator('#design-preview-bar').isHidden() && await p.locator('#design-preview-toggle').count() === 0, 'members have neither preview controls nor banner');
    await p.evaluate(() => { localStorage.setItem(designPreviewKey(), '1'); render(); });
    ok(!await p.evaluate(() => designPreviewOn()), 'a forged member preference cannot enable preview');
    for (const screen of ['pick', 'standings', 'history', 'stats']) {
      await p.click(`[data-screen="${screen}"]`);
      ok(await p.locator('.pv-season, .pv-outcome, .pv-fold, .pv-status').count() === 0, `member ${screen} contains none of the preview layout`);
    }
    await p.click('#va-back'); await p.waitForFunction(id => S.me?.id === id, jack.id);
    ok(await p.evaluate(() => designPreviewOn()), 'Back to my account restores the commissioner preview');
    ok(JSON.stringify([db.players, db.picks]) === before, 'View as and return preserve every fake member and pick');
    ok(!db.calls.some(c => /rpc\/(submit_pick|clear_pick|recover_player|claim_player|join_league)/.test(c)), 'preview and identity navigation used no write or recovery RPC');
    await visualFixture(p);
    // Verify every preview screen at narrow/large sizes, light/dark, and Bigger Text.
    fs.mkdirSync('/tmp/family-survivor-preview-shots', { recursive: true });
    for (const width of [320, 390, 1100]) for (const big of [false, true]) {
      await p.setViewportSize({ width, height: 950 });
      await p.evaluate(big => document.documentElement.toggleAttribute('data-big', big), big);
      for (const screen of ['pick', 'standings', 'history', 'stats', 'admin']) {
        await p.click(`[data-screen="${screen}"]`);
        const layout = await p.evaluate(() => {
          const over = [];
          for (const e of document.querySelectorAll('#main *')) {
            if (!e.checkVisibility() || !Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) continue;
            let n = e, scrolls = false;
            while (n && n !== document.body) { if (['auto','scroll'].includes(getComputedStyle(n).overflowX)) scrolls = true; n = n.parentElement; }
            if (scrolls) continue;
            const r = document.createRange(); r.selectNodeContents(e);
            if (Array.from(r.getClientRects()).some(b => b.right > innerWidth + 1)) over.push(e.className || e.tagName);
          }
          return { fits: document.documentElement.scrollWidth <= innerWidth + 1, over };
        });
        ok(layout.fits && !layout.over.length, `${screen} fits ${width}px${big ? ' Bigger Text' : ''}${layout.over.length ? ': ' + layout.over.join(', ') : ''}`);
        if (width === 390 && !big) await p.screenshot({ path: `/tmp/family-survivor-preview-shots/${screen}.png`, fullPage: true });
      }
    }
    await p.setViewportSize({ width: 390, height: 950 });
    await p.evaluate(() => { document.documentElement.removeAttribute('data-big'); document.documentElement.setAttribute('data-palette','onyx'); document.documentElement.setAttribute('data-theme','dark'); });
    await p.click('[data-screen="pick"]');
    ok(await p.locator('.locked').evaluate(e => getComputedStyle(e).color !== getComputedStyle(e).backgroundColor), 'soft pick card retains contrasting ink in dark mode');
    await p.screenshot({ path: '/tmp/family-survivor-preview-shots/pick-dark.png', fullPage: true });
    await p.click('#pk-clear'); await p.click('#cl-yes');
    await p.waitForFunction(() => !S.saving && !pickIn(S.me.id, 4));
    ok(!db.picks.some(x => x.player_id === jack.id && x.week === 4), 'preview clear confirmation still clears the synthetic server pick');
    await p.click('.pk[data-team="NE"]'); await p.click('#cf-yes');
    await p.waitForFunction(() => !S.saving && pickIn(S.me.id, 4)?.team === 'NE');
    ok(db.picks.some(x => x.player_id === jack.id && x.week === 4 && x.team === 'NE'), 'preview pick confirmation still saves through the existing server API');
    ok(await p.evaluate(() => localStorage.getItem(meKey())) === jack.token, 'preview saves preserve the original commissioner token');
    ok(!errors.length, 'no browser errors: ' + errors.join('; '));
    await ctx.close();
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
