/* Add to Home Screen, and the way back in.
   ------------------------------------------------------------------
   🚨 The owner hit all of this on his own phone. He opened the demo link,
   added it to his Home Screen, and the icon opened the REAL league with no
   identity, every name already claimed, and nothing he could tap.

   ⚠️ THE FACT THAT MAKES THIS WORK THE WAY IT DOES: an iOS Home Screen web
   app gets its OWN storage container. Nothing from Safari comes across — not
   the token, not the demo flag, not the theme. So **the captured URL is the
   only thing that can carry mode or identity into it**, and Add to Home
   Screen captures the address bar AS IT IS AT THAT MOMENT, not the link that
   was opened. Anything the app strips from the address bar is therefore
   something a Home Screen icon can never have. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = 'http://127.0.0.1:8099/';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    console.log('\n— the DEMO link survives Add to Home Screen —');
    const safari = await b.newContext({ viewport: { width: 390, height: 844 } });
    const s1 = await safari.newPage();
    await s1.goto(B + '?demo=1'); await sleep(2200);
    const captured = await s1.evaluate(() => location.href);
    ok(/[?&]demo=1/.test(captured), `the address bar still says demo=1 (${captured.replace(B, '…/')})`);
    ok(await s1.evaluate(() => S.demo) === true, 'and the app is in demo mode');

    /* The icon: a brand-new storage container opening the captured URL. */
    const live = fake.makeDB();
    fake.rpc(live, 'admin_add_player', { p_admin_token: 'bootstrap', p_name: 'Jack' });
    fake.rpc(live, 'admin_add_player', { p_admin_token: live.players[0].token, p_name: 'Nana' });
    live.players.forEach((x) => { x.claimed_at = new Date().toISOString(); });

    const icon = await b.newContext({ viewport: { width: 390, height: 844 } });
    await fake.attach(icon, live);
    const h1 = await icon.newPage();
    await h1.goto(captured); await sleep(2200);
    ok(await h1.evaluate(() => S.demo) === true, 'the Home Screen icon opens the DEMO, not the real league');
    ok(await h1.evaluate(() => S.store.kind) === 'local', 'so it cannot touch the family league');
    ok(await h1.evaluate(() => !!(S.me && S.me.display_name)), 'and it seeded itself, so there is something to look at');
    ok(live.players.every((p) => p.display_name !== (undefined)) && live.players.length === 2, 'the real roster gained nobody');

    console.log('\n— demo=0 is still stripped, because nothing needs to carry it —');
    const off = await b.newContext({ viewport: { width: 390, height: 844 } });
    await fake.attach(off, live);
    const o = await off.newPage();
    await o.goto(B + '?demo=0'); await sleep(2000);
    ok(!/demo=/.test(await o.evaluate(() => location.href)), 'the live link leaves a clean address bar');

    console.log('\n— "everyone has joined" names the cause and the way out —');
    const dead = await b.newContext({ viewport: { width: 390, height: 844 } });
    await fake.attach(dead, live);
    const d = await dead.newPage();
    await d.goto(B); await sleep(2000);
    const txt = await d.locator('#s-pick').innerText();
    ok(/already joined/i.test(txt), 'it still says everyone has joined');
    /* 🚨 The dead end: it used to stop there, leaving "type your name" as the
       only control — which refuses a name that is already in the league. */
    ok(/open your own link/i.test(txt), 'it tells them to open their own link');
    ok(/will not work/i.test(txt), 'it says plainly that typing their name will NOT work');
    ok(/put your name back on the list/i.test(txt), 'and names the thing to ask the commissioner for');
    ok(/does not know you yet/i.test(txt), 'and blames the right thing — this phone, not the league');

    console.log('\n— the commissioner can save his own way back in —');
    const jack = live.players.find((p) => p.is_admin);
    const A = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await fake.attach(A, live);
    const a = await A.newPage();
    await a.goto(`${B}?u=${jack.token}`); await sleep(2000);
    ok(await a.evaluate(() => !!(S.me && S.me.is_admin)) === true, 'his own link signs him in as commissioner');
    await a.click('.tab[data-screen="admin"]'); await sleep(700);
    const adm = await a.locator('#s-admin').innerText();
    ok(/Your own link/i.test(adm), 'Admin shows "Your own link"');
    ok(adm.includes(jack.token), 'with the real token in it, ready to save');
    ok(/do not send it to anybody/i.test(adm), 'and warns it must not be shared');
    ok(/Add to Home Screen/i.test(adm), 'and says how to make an icon out of it');
    await a.click('#ad-copymine'); await sleep(500);
    const clip = await a.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    ok(clip.includes(`?u=${jack.token}`), 'the copy button emits that link');
    ok(!/demo=/.test(clip), 'and never carries a demo parameter into it');

    /* ⚠️ It is HIS link: it must never appear to somebody who is not admin. */
    const N = await b.newContext({ viewport: { width: 390, height: 844 } });
    await fake.attach(N, live);
    const n = await N.newPage();
    const nana = live.players.find((p) => !p.is_admin);
    await n.goto(`${B}?u=${nana.token}`); await sleep(2000);
    ok(await n.evaluate(() => !!(S.me && S.me.is_admin)) === false, 'a relative is not admin');
    ok(await n.locator('#tab-admin').isHidden(), 'and has no Admin tab to find it in');
    ok(await n.locator('#ad-copymine').count() === 0, 'so the button does not exist for her at all');

    console.log('\n— and the icon he makes from it really does remember him —');
    const icon2 = await b.newContext({ viewport: { width: 390, height: 844 } });   // fresh container
    await fake.attach(icon2, live);
    const h2 = await icon2.newPage();
    await h2.goto(clip); await sleep(2200);
    ok(await h2.evaluate(() => S.me && S.me.display_name) === 'Jack', 'a brand-new storage container knows him from the URL alone');
    ok(await h2.evaluate(() => !!S.me.is_admin) === true, 'still the commissioner');
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
