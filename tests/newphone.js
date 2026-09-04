/* The commissioner's new phone, and the icon that does not know you.
   ------------------------------------------------------------------
   Two problems with one shape: an identity lives on a DEVICE, and the device
   is the thing that is about to change.

   🚨 THE CLIPBOARD DOES NOT SURVIVE A NEW PHONE. "Copy my own link" is right
   for making a Home Screen icon on the phone you are holding and useless for
   the case it reads as solving — the link has to leave the device before the
   device does. The share sheet is the only thing on iOS that can put it into
   Mail; mailto: is the fallback; the clipboard is the last resort.

   🚨 AND "PUT BACK ON LIST" IS A TRAP FOR THE COMMISSIONER SPECIFICALLY.
   claim_player hands out the row's is_admin, so his name on the family join
   screen makes the next person to tap it the commissioner. The moment he
   would reach for that button is a new phone — i.e. exactly when the league
   link has just gone to twenty relatives. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = 'http://127.0.0.1:8099/';

/* iOS marks a Home Screen web app with navigator.standalone. Chromium has no
   such property, so it is injected before any page script runs — the same
   trick, and the same caveat, as every other iOS behaviour in this repo:
   what is under test is OUR branch, not Safari's. */
const asIcon = (ctx) => ctx.addInitScript(() => {
  try { Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true }); } catch (e) {}
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    const live = fake.makeDB();
    fake.rpc(live, 'admin_add_player', { p_admin_token: 'bootstrap', p_name: 'Jack' });
    const jackTok = live.players[0].token;
    for (const n of ['Nana', 'Uncle Bob', 'Cousin Dave']) fake.rpc(live, 'admin_add_player', { p_admin_token: jackTok, p_name: n });
    const jack = live.players.find((p) => p.is_admin);
    const nana = live.players.find((p) => p.display_name === 'Nana');
    /* Jack and Nana have signed in; Uncle Bob and Cousin Dave have not. That
       mix is the point of the fixture — the icon warning has to fire while
       there are still free names to mis-tap, which is most of the season. */
    jack.claimed_at = new Date().toISOString();
    nana.claimed_at = new Date().toISOString();

    console.log('\n— the new-phone plan is on the Admin screen —');
    const A = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await fake.attach(A, live);
    const a = await A.newPage();
    await a.goto(`${B}?u=${jack.token}`); await sleep(2000);
    ok(await a.evaluate(() => !!(S.me && S.me.is_admin)) === true, 'his own link signs him in as commissioner');
    await a.click('.tab[data-screen="admin"]'); await sleep(700);
    /* ⚠️ A closed <details> contributes NO innerText — the repo's oldest and
       worst failure mode is a check that measures an empty string. */
    ok(await a.locator('#ad-newphone').count() === 1, 'there is a "Moving to a new phone?" section');
    ok(await a.locator('#ad-newphone').evaluate((d) => !d.open) === true, 'folded by default, so it is not in the way every week');
    await a.locator('#ad-newphone summary').click(); await sleep(400);
    const np = await a.locator('#ad-newphone').innerText();
    ok(np.length > 300, `and it really has content (${np.length} chars)`);
    ok(/BEFORE you switch/i.test(np), 'it says to do it BEFORE switching, which is the whole point');
    ok(/clipboard does not survive|not enough/i.test(np), 'and warns that copying to the clipboard is not a plan');
    ok(/email/i.test(np), 'it names email as the place to put it');
    ok(/Add to Home Screen/i.test(np), 'and covers the icon on the new phone too');

    console.log('\n— and it warns about the one button that would hand the league away —');
    ok(/Do NOT use "Put back on list" on yourself/i.test(np), 'it names the trap');
    ok(/commissioner/i.test(np) && /whoever tapped it/i.test(np), 'and says exactly what would go wrong');

    console.log('\n— "Send my link to myself" gets the link OFF the phone —');
    await a.evaluate(() => {
      window.__shared = null;
      navigator.share = (d) => { window.__shared = d; return Promise.resolve(); };
    });
    await a.click('#ad-sendmine'); await sleep(600);
    const shared = await a.evaluate(() => window.__shared);
    ok(!!shared, 'it opens the share sheet rather than only copying');
    ok(shared && shared.text.includes(`?u=${jack.token}`), 'the shared text carries his real link');
    ok(shared && !/demo=/.test(shared.text), 'and never a demo parameter');
    ok(shared && /not be forwarded|must not be/i.test(shared.text), 'the message itself says not to forward it');

    /* A cancelled share sheet is the commonest outcome of tapping a share
       button and must never be reported as a failure — being told your safety
       net broke when you simply changed your mind is worse than silence. */
    await a.evaluate(() => {
      navigator.share = () => Promise.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    });
    await a.click('#ad-sendmine'); await sleep(600);
    const msg = await a.locator('#s-admin').innerText();
    ok(!/could not|bad/i.test(msg.split('\n')[0] || ''), 'cancelling the share sheet reports no error');

    console.log('\n— putting his OWN name back is not one silent tap —');
    let asked = '';
    a.on('dialog', async (d) => { asked = d.message(); await d.dismiss(); });
    await a.locator(`details:has([data-unclaim="${jack.id}"])`).first().locator('summary').click();
    await sleep(300);
    await a.click(`[data-unclaim="${jack.id}"]`); await sleep(700);
    ok(/own name/i.test(asked), 'it asks first');
    ok(/commissioner/i.test(asked), 'naming that his name carries the commissioner powers');
    ok(/Send my link to myself/i.test(asked), 'and pointing at the safe route instead');
    /* `live` is the in-process DB the fake mutates, so it is read directly —
       no reload needed, and no chance of asserting against a stale copy. */
    ok(live.players.find((p) => p.id === jack.id).claimed_at !== null,
       'and saying no really leaves him claimed — the dialog is not decoration');

    console.log('\n— a relative\'s name is still one tap, with no dialog —');
    asked = '';
    await a.locator(`details:has([data-unclaim="${nana.id}"])`).first().locator('summary').click();
    await sleep(300);
    await a.click(`[data-unclaim="${nana.id}"]`); await sleep(800);
    ok(asked === '', 'no confirmation for somebody else — that path is unchanged');

    console.log('\n— the icon warns BEFORE a wrong tap, while names are still free —');
    /* The scenario: she added the icon before tapping her name, so the icon
       has no token. Her own name is claimed (in Safari); everybody else's is
       still on the list, and tapping one of those is somebody else's identity. */
    const I = await b.newContext({ viewport: { width: 390, height: 844 } });
    await asIcon(I);
    await fake.attach(I, live);
    const i = await I.newPage();
    await i.goto(B); await sleep(2200);
    const jt = await i.locator('#s-pick').innerText();
    ok(await i.evaluate(() => !(S.me)) === true, 'the icon opens as a stranger, as iOS really would');
    ok(await i.locator('.namebtn').count() > 0, 'there ARE still free names to mis-tap — the risky state, not the easy one');
    ok(/separate memory/i.test(jt), 'it explains the icon has its own memory');
    ok(/Do not tap somebody else|not tap somebody/i.test(jt), 'and says plainly not to tap another name');
    ok(/Safari/i.test(jt), 'pointing at Safari as the fix');
    ok(jt.indexOf('separate memory') < jt.indexOf(nana.display_name === 'Nana' ? 'Uncle Bob' : 'Nana'),
       'and the warning comes ABOVE the list, where it can still stop the tap');

    console.log('\n— but it is not noise in an ordinary browser tab —');
    const T = await b.newContext({ viewport: { width: 390, height: 844 } });
    await fake.attach(T, live);
    const tb = await T.newPage();
    await tb.goto(B); await sleep(2200);
    const tt = await tb.locator('#s-pick').innerText();
    ok(await tb.locator('.namebtn').count() > 0, 'the same free names are offered');
    ok(!/separate memory/i.test(tt), 'and no icon warning, because a tab does not have that problem');

    console.log('\n— none of this is offered to a relative —');
    const N = await b.newContext({ viewport: { width: 390, height: 844 } });
    await fake.attach(N, live);
    const n = await N.newPage();
    await n.goto(`${B}?u=${nana.token}`); await sleep(2000);
    ok(await n.evaluate(() => !!(S.me && S.me.is_admin)) === false, 'she is not an admin');
    ok(await n.locator('#ad-sendmine').count() === 0, 'so "Send my link to myself" does not exist for her');
    ok(await n.locator('#ad-newphone').count() === 0, 'nor the new-phone section');
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
