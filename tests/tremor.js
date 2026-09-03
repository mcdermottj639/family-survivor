/* Can a shaky hand save a pick it never read?
   ------------------------------------------------------------------
   🚨 The confirmation exists for exactly one person: a 95-year-old with an
   unsteady finger. An audit found it doing the opposite for a fifth of the
   slate — two taps ~90ms apart at the SAME POINT (a normal tremor double
   contact) had the first open the panel and the second land on "Yes", because
   that is where Yes renders over a card scrolled to mid-screen. Which games
   it happened on was decided by scroll position alone.
   ⚠️ Not a test artefact: `touch-action: manipulation` means iOS does not
   swallow the second tap as a double-tap-zoom either.

   Also pinned here: the six other accessibility findings from that audit. */
const { chromium } = require('./_pw');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pickableWeek = require('./_pickable');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle' });
    if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
    await sleep(1400);
    await pickableWeek(p, sleep);

    console.log('\n— a tremor double-tap cannot confirm a pick —');
    // Sweep EVERY pickable button, because the bug was positional: tap the
    // centre, wait 90ms, then click whatever is now under that same point.
    const teams = await p.evaluate(() => [...document.querySelectorAll('#s-pick .pk')].filter((e) => !e.disabled).map((e) => e.dataset.team));
    ok(teams.length >= 4, `${teams.length} pickable teams to sweep`);
    let landedOnYes = 0, saved = 0;
    for (const tm of teams) {
      await p.evaluate(() => { const c = document.querySelector('#confirm'); if (c && !c.hidden) c.hidden = true; });
      await p.evaluate((t) => { S.confirming = null; document.querySelector(`#s-pick .pk[data-team="${t}"]`).scrollIntoView({ block: 'center' }); }, tm);
      await sleep(150);
      const box = await p.locator(`#s-pick .pk[data-team="${tm}"]`).boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const before = await p.evaluate(() => (pickIn(S.me.id, S.week) || {}).team || null);
      await p.mouse.click(x, y);
      await sleep(90);                                  // the tremor interval
      const under = await p.evaluate(([cx, cy]) => {
        const e = document.elementFromPoint(cx, cy);
        return e ? (e.closest('button') || e).id || '' : '';
      }, [x, y]);
      if (under === 'cf-yes') landedOnYes++;
      await p.mouse.click(x, y);                        // the second contact
      await sleep(700);
      const after = await p.evaluate(() => (pickIn(S.me.id, S.week) || {}).team || null);
      if (after !== before) saved++;
      await p.evaluate(() => { if (typeof closeConfirm === 'function') closeConfirm(); });
      await sleep(120);
    }
    /* ⚠️ How many land on Yes is REPORTED, not asserted. It depends entirely
       on scroll position, the number of games and the panel's height, so
       pinning it would make this suite fail whenever the layout changed —
       while the thing that actually matters is the next line. */
    console.log(`    (the second tap landed on Yes for ${landedOnYes} of ${teams.length} — layout-dependent, which is why the guard cannot be layout-dependent)`);
    ok(saved === 0, `NOT ONE of ${teams.length} tremor double-taps saved a pick (${saved} saved)`);

    console.log('\n— but a deliberate confirmation still works —');
    await p.evaluate(() => { if (typeof closeConfirm === 'function') closeConfirm(); });
    await sleep(200);
    const tm = teams[0];
    await p.click(`#s-pick .pk[data-team="${tm}"]`); await sleep(200);
    ok(await p.locator('#cf-yes').isDisabled(), 'Yes is briefly unavailable, and LOOKS it');
    const dim = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#cf-yes')).opacity));
    ok(dim < 0.7, `visibly dimmed while arming (opacity ${dim})`);
    await sleep(700);
    ok(!(await p.locator('#cf-yes').isDisabled()), 'and available well before anybody has finished reading the team name');
    await p.click('#cf-yes'); await sleep(1200);
    ok(await p.evaluate(() => (pickIn(S.me.id, S.week) || {}).team) === tm, `a real tap saves normally (${tm})`);
    ok(await p.locator('#confirm').isHidden(), 'and the panel closes');

    console.log('\n— the dialog has an accessible name —');
    await p.evaluate(() => { S.week = S.week; render(); });
    await p.click(`#s-pick .pk[data-team="${teams[1]}"]`); await sleep(300);
    const named = await p.evaluate(() => {
      const d = document.getElementById('confirm');
      const id = d.getAttribute('aria-labelledby');
      const t = id ? document.getElementById(id) : null;
      return { id, text: t ? t.textContent.trim() : null };
    });
    ok(!!named.text, `aria-labelledby="${named.id}" resolves — a dangling one gives the dialog NO name at all`);
    ok(/is this right/i.test(named.text || ''), `and it is the question being asked: "${named.text}"`);

    console.log('\n— focus and the screen behind it are sealed off —');
    const trapped = await p.evaluate(() => {
      const hd = document.querySelector('.hd'), tb = document.getElementById('tabs');
      return { hd: hd.hasAttribute('inert'), tabs: tb.hasAttribute('inert') };
    });
    ok(trapped.hd && trapped.tabs, 'the header and tab bar are inert while the dialog is open');
    // The consequence the audit actually demonstrated.
    const before = await p.evaluate(() => S.screen);
    // A real tap at the tab's coordinates: hit-testing sends it to the
    // overlay, which is what `inert` plus the backdrop are for.
    const tb = await p.locator('.tab[data-screen="standings"]').boundingBox();
    await p.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
    await sleep(400);
    const tapped = await p.evaluate(() => S.screen);
    ok(tapped === before, 'a tap on a tab behind it goes to the overlay, not the tab');
    /* ⚠️ THAT TAP MAY HAVE CLOSED THE DIALOG, and since v51 it always does.
       The tab bar used to scroll away with the page, so at this point in the
       run its box was often off-screen and the click reached nothing. It is
       inside the sticky band now, which means it is always on screen and
       always UNDER the backdrop — so the click lands on `.sheet-back`, which
       cancels, exactly as `confirm.js` requires of a backdrop tap. That is
       the right outcome and this suite is not the place to argue with it.
       But the two checks below need an OPEN dialog to mean anything, and
       without this they were quietly measuring a closed one. Re-open it. */
    if (!await p.evaluate(() => !!S.confirming)) {
      const again = await p.evaluate(() => {
        const btn = [...document.querySelectorAll('#s-pick .pk:not(:disabled)')][0];
        if (btn) btn.click();
        return !!btn;
      });
      await sleep(400);
      ok(again && await p.evaluate(() => !!S.confirming), 'the backdrop tap cancelled it — re-opened so the next two checks have a live dialog');
    }
    // And a DISPATCHED click, which `inert` does not stop — the handler must.
    await p.evaluate(() => { const t = document.querySelector('.tab[data-screen="stats"]'); if (t) t.click(); });
    await sleep(400);
    const dispatched = await p.evaluate(() => S.screen);
    ok(dispatched === before,
       'and even a dispatched click cannot switch the screen under an unanswered question — inert alone would not have stopped that');
    /* ⚠️ `body` is NOT an escape. At the end of the tab ring focus leaves the
       document for the browser's own chrome and `activeElement` reads as
       body; the next Tab comes back. What must never happen is landing on an
       element you could ACTIVATE outside the dialog — a header button, a tab,
       the week nav — which is exactly what the audit demonstrated. */
    const escaped = [];
    for (let i = 0; i < 10; i++) {
      await p.keyboard.press('Tab');
      const where = await p.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body || a === document.documentElement) return null;
        if (document.getElementById('confirm').contains(a)) return null;
        return (a.id || a.className || a.tagName) + '';
      });
      if (where) escaped.push(where);
    }
    ok(escaped.length === 0, `ten Tab presses never reach anything outside the dialog${escaped.length ? ' — ' + [...new Set(escaped)].join(', ') : ''}`);
    await p.keyboard.press('Escape'); await sleep(300);
    ok(await p.evaluate(() => !document.querySelector('.hd').hasAttribute('inert')), 'and closing it gives the app back');

    console.log('\n— the tabs say which one is selected —');
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#tabs .tab')].map((t) => ({
      t: t.textContent.trim(), sel: t.getAttribute('aria-selected'), on: t.classList.contains('on') })));
    ok(tabs.every((x) => x.sel === 'true' || x.sel === 'false'), 'every tab carries aria-selected');
    ok(tabs.filter((x) => x.sel === 'true').length === 1, 'exactly one is selected');
    ok(tabs.every((x) => (x.sel === 'true') === x.on), 'and it always agrees with the highlight');
    await p.click('.tab[data-screen="standings"]'); await sleep(500);
    const after2 = await p.evaluate(() => [...document.querySelectorAll('#tabs .tab')].find((t) => t.getAttribute('aria-selected') === 'true').textContent.trim());
    ok(/standings/i.test(after2), `it follows the tap (${after2})`);
    const panels = await p.evaluate(() => [...document.querySelectorAll('section.screen')].map((s) => s.getAttribute('role')));
    ok(panels.every((r) => r === 'tabpanel'), 'and every screen is a real tabpanel');

    console.log('\n— focus survives the live-score re-render —');
    await p.click('.tab[data-screen="pick"]'); await sleep(500);
    const kept = await p.evaluate(async () => {
      const btn = [...document.querySelectorAll('#s-pick .pk')].find((e) => !e.disabled);
      if (!btn) return null;
      const want = btn.dataset.team;
      btn.focus();
      render();                                  // what the 60s poller does
      const a = document.activeElement;
      return { want, got: a && a.dataset ? a.dataset.team : null, tag: a ? a.tagName : null };
    });
    ok(kept && kept.got === kept.want, `focus stays on the same team button (${kept && kept.want}) instead of falling to <body>`);

    console.log('\n— status messages are announced, not silent —');
    await p.evaluate(() => { say('ok', 'Saving your pick…'); render(); });
    await sleep(300);
    ok(await p.locator('.msg[role="status"]').count() >= 1, 'the message is a live region');

    console.log('\n— every control clears the house floor —');
    await p.evaluate(() => { lsDel('survivor:me'); });
    const small = await p.evaluate(() => [...document.querySelectorAll('button, .linkbtn')]
      .filter((e) => e.offsetParent && !e.classList.contains('ibtn'))
      .map((e) => ({ id: e.id || e.className, h: Math.round(e.getBoundingClientRect().height) }))
      .filter((x) => x.h < 56));
    ok(small.length === 0, `nothing under 56px${small.length ? ' — ' + small.map((x) => `${x.id}:${x.h}` ).join(', ') : ''}`);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
