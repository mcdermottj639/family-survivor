/* Clearing a pick you have already made (v65).
   ------------------------------------------------------------------
   The owner: "add in an option to clear selections after you've made it —
   for the picks tab." Until now the only way out of a pick was into a
   different one, so somebody who changed their mind about playing a week had
   to spend a team to say so. House rule 1 makes a missed week free, so "no
   pick" is a legitimate place to end up.

   🚨 What this suite is really guarding is the OTHER direction. Clearing is a
   second write path onto a pick row, and v41 closed a hole where a decided
   week could be re-picked — the loss vanishing and the spent team coming
   back. A clear button that ignores the deadline reopens exactly that hole
   through a different door, so the locked case is tested in the store, in the
   UI, and against the fake backend. */
const { chromium } = require('./_pw');
const pickableWeek = require('./_pickable');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8099/';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route('https://a.espncdn.com/**', (r) => r.fulfill({
      status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"/>' }));
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE, { waitUntil: 'networkidle' });
    if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
    await sleep(1200);

    console.log('\n— the control only exists where clearing is possible —');
    const week = await pickableWeek(p, sleep);
    ok(await p.locator('#pk-clear').count() === 0, 'no pick yet, so nothing to clear');

    const team = await p.evaluate(() => [...document.querySelectorAll('#s-pick .pk')].find((x) => !x.disabled).dataset.team);
    await p.click(`#s-pick .pk[data-team="${team}"]`); await sleep(700);
    await p.click('#cf-yes'); await sleep(1200);
    ok(await p.evaluate((w) => !!pickIn(S.me.id, w), week), `a pick is in for week ${week}`);
    ok(await p.locator('#pk-clear').count() === 1, 'and the card now offers "Clear my pick"');

    console.log('\n— it goes through the same confirmation a pick does —');
    await p.click('#pk-clear'); await sleep(400);
    ok(await p.evaluate(() => !document.querySelector('#confirm').hidden), 'the confirmation panel opens');
    ok(await p.evaluate(() => document.activeElement.id) === 'cf-no', 'the SAFE answer takes focus');
    /* ⚠️ The v49 tremor guard: a shaky hand must not be able to confirm
       something it never read. Yes opens disabled and arms after 600ms. */
    ok(await p.evaluate(() => document.querySelector('#cl-yes').disabled), 'Yes starts disabled — the tremor guard');
    const txt = await p.locator('#confirm-body').innerText();
    ok(/costs nothing/i.test(txt) && /no loss/i.test(txt), 'it says plainly that a blank week costs nothing');
    ok(new RegExp(`back on your list`, 'i').test(txt), 'and that the team comes back');

    console.log('\n— backing out changes nothing —');
    await p.click('#cf-no'); await sleep(600);
    ok(await p.evaluate((w) => !!pickIn(S.me.id, w), week), 'the pick is untouched after "No, keep my pick"');
    ok(await p.evaluate(() => document.querySelector('#confirm').hidden), 'and the panel is closed');

    console.log('\n— clearing really clears, and hands the team back —');
    const usedBefore = await p.evaluate(() => Object.keys(usedTeams(S.me.id)).length);
    await p.click('#pk-clear'); await sleep(900);
    await p.click('#cl-yes'); await sleep(1400);
    ok(await p.evaluate((w) => !pickIn(S.me.id, w), week), 'the pick is gone');
    ok(await p.locator('.locked').count() === 0, 'the gold card is gone with it');
    const usedAfter = await p.evaluate(() => Object.keys(usedTeams(S.me.id)).length);
    ok(usedAfter === usedBefore - 1, `the team is spendable again (${usedBefore} used → ${usedAfter})`);
    ok(/clear/i.test(await p.locator('.msg').first().innerText()), 'and it says so — silence reads as a broken button');

    console.log('\n— the week is pickable again, with the same team —');
    ok(await p.evaluate((t) => {
      const btn = document.querySelector(`#s-pick .pk[data-team="${t}"]`);
      return !!btn && !btn.disabled;
    }, team), 'the team you cleared can be picked again');
    await p.click(`#s-pick .pk[data-team="${team}"]`); await sleep(700);
    await p.click('#cf-yes'); await sleep(1200);
    ok(await p.evaluate((w) => !!pickIn(S.me.id, w), week), 're-picking it works');

    console.log('\n— 🚨 A DECIDED WEEK CANNOT BE CLEARED —');
    /* This is the v41 hole reached through a different door: clearing a pick
       whose game has kicked off would erase the result AND hand back a spent
       team. Tested at the STORE, because that is where the rule has to live —
       the UI not drawing the button is the second line, not the first. */
    const locked = await p.evaluate(async () => {
      // The demo's live week has a pick whose game started on Thursday.
      for (let w = 1; w <= 18; w++) {
        const cur = pickIn(S.me.id, w);
        if (cur && cur.kickoff && new Date(cur.kickoff) <= new Date()) {
          const before = JSON.stringify(cur);
          const r = await S.store.clearPick(S.me.token, w);
          const after = JSON.stringify(pickIn(S.me.id, w));
          return { w, r, kept: before === after, team: cur.team };
        }
      }
      return null;
    });
    ok(!!locked, 'the fixture really has a decided week to try this on');
    ok(locked && locked.r && locked.r.ok === false, `the store refuses it: "${locked && locked.r && locked.r.error}"`);
    ok(locked && /already started/i.test(String(locked.r.error || '')), 'and says why, in a sentence');
    ok(locked && locked.kept, 'the pick and its result are still there');

    console.log('\n— and the button is not offered on a decided week either —');
    await p.evaluate((w) => { S.week = w; S.weekPinned = true; render(); }, locked.w);
    await sleep(700);
    ok(await p.locator('#pk-clear').count() === 0, 'a locked week draws no clear button');

    console.log('\n— clearing a week with no pick is not an error —');
    const none = await p.evaluate(async () => {
      for (let w = 18; w >= 1; w--) if (!pickIn(S.me.id, w)) return S.store.clearPick(S.me.token, w);
      return null;
    });
    ok(none && none.ok === true, 'the caller wanted no pick and there is no pick — that is a success');

    ok(errs.length === 0, `no console errors (${errs.length})`);
    await ctx.close();
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
