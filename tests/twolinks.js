/* Two bookmarks: the real league, and the demo.
   ------------------------------------------------------------------
   The owner wanted one link to save for each. A mode that lives only in
   localStorage cannot be bookmarked, so `?demo=1` / `?demo=0` set it.

   🚨 The thing this suite really guards: localStorage is per-ORIGIN, so both
   modes share one bucket, and `survivor:me` used to be ONE key for both.
   Flipping demo on left the REAL token in place, `whoami` could not resolve
   it against the on-device store, and the app dropped to the join screen —
   i.e. switching modes logged you out of the other one. Two keys now. */
const { chromium } = require('../node_modules/playwright-core');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fake = require('./_fakesupa');
const BASE = 'http://127.0.0.1:8099/';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    // A live league with the commissioner already seeded, as the SQL editor does.
    const db = fake.makeDB();
    fake.rpc(db, 'admin_add_player', { p_admin_token: 'bootstrap', p_name: 'Jack' });
    fake.rpc(db, 'admin_add_player', { p_admin_token: db.players[0].token, p_name: 'Nana' });
    const jack = db.players[0].token;

    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
    await fake.attach(ctx, db);
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));

    console.log('\n— the LIVE link —');
    await p.goto(`${BASE}?u=${jack}`, { waitUntil: 'networkidle' });
    await sleep(1200);
    ok(await p.evaluate(() => S.store.kind) === 'cloud', 'opens the shared league');
    ok(await p.evaluate(() => S.me && S.me.display_name) === 'Jack', 'signed in as Jack');
    ok(await p.evaluate(() => S.me.is_admin) === true, 'with the Admin tab');
    ok(await p.evaluate(() => !S.demo), 'and not in demo mode');
    ok(/shared league/i.test(await p.locator('#ft-mode').innerText()), 'the footer says shared league');

    console.log('\n— the DEMO link, on the same phone —');
    await p.goto(`${BASE}?demo=1`, { waitUntil: 'networkidle' });
    await sleep(2500);
    ok(await p.evaluate(() => S.demo) === true, 'the link turns demo mode on');
    ok(await p.evaluate(() => S.store.kind) === 'local', 'and forces the on-device store, so it cannot touch the real league');
    ok(db.picks.length === 0 && db.players.length === 2, `the real roster is untouched (${db.players.length} players, ${db.picks.length} picks)`);
    ok(await p.evaluate(() => S.players.length) > 10, `a full demo family is there to look at (${await p.evaluate(() => S.players.length)})`);
    ok(await p.evaluate(() => !!S.me), 'and it arrives SIGNED IN — a demo link that lands on a join screen is not a demo');
    ok(/DEMO/.test(await p.locator('#whoami').innerText()), 'the header is badged DEMO so it can never be mistaken for the real thing');

    /* 🚨 THIS SECTION ASSERTED THE OPPOSITE, and it was pinning a decision
       that turned out to be wrong. v50 stripped `demo=1` from the address bar
       so it could not ride into a copied link — a real risk, but the owner hit
       the worse consequence: **Add to Home Screen captures the address bar as
       it is at that moment**, so by the time he added the icon the parameter
       was gone and his "demo" icon silently opened the REAL league, with no
       identity and nothing tappable. See tests/homescreen.js.
       The copy risk is guarded where it actually happens, which is what these
       two checks now assert. */
    console.log('\n— the parameter STAYS, so a Home Screen icon can capture it —');
    ok(/demo=1/.test(p.url()), `still in the address bar (${p.url().replace(BASE, '…/')})`);
    // What actually has to be true: the link handed to the family is clean.
    const shared = await p.evaluate(() => location.origin + location.pathname);
    ok(!/demo=/.test(shared), 'the league link the app hands out carries no demo parameter');
    await p.click('.tab[data-screen="admin"]'); await sleep(600);
    const shownLink = (await p.locator('#s-admin .mono').first().innerText()).trim();
    ok(!/demo=/.test(shownLink), `and the one printed on the Admin screen is the ordinary one (${shownLink.replace(BASE, '…/')})`);
    await p.click('.tab[data-screen="pick"]'); await sleep(400);

    console.log('\n— 🚨 and neither mode logs you out of the other —');
    await p.goto(`${BASE}?demo=0`, { waitUntil: 'networkidle' });
    await sleep(1500);
    ok(await p.evaluate(() => S.demo) === false, 'the live link turns demo back off');
    ok(await p.evaluate(() => S.store.kind) === 'cloud', 'back to the shared league');
    ok(await p.evaluate(() => S.me && S.me.display_name) === 'Jack',
       'and Jack is STILL signed in — one shared identity key used to drop him to the join screen here');
    const keys = await p.evaluate(() => ({ live: localStorage.getItem('survivor:me'), demo: localStorage.getItem('survivor:me:demo') }));
    ok(!!keys.live && !!keys.demo && keys.live !== keys.demo, 'the two identities are stored apart and differ');

    await p.goto(`${BASE}?demo=1`, { waitUntil: 'networkidle' });
    await sleep(1800);
    ok(await p.evaluate(() => !!S.me && S.demo), 'and going back to the demo is still signed in too');

    console.log('\n— re-opening the demo link does not reseed over you —');
    const n1 = await p.evaluate(() => S.picks.length);
    await p.goto(`${BASE}?demo=1`, { waitUntil: 'networkidle' });
    await sleep(1800);
    ok(await p.evaluate(() => S.picks.length) === n1, `the season in progress survives (${n1} picks both times)`);

    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
