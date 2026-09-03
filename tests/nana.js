/* The whole promise, as one test: a relative does NOTHING but tap a link.
   ------------------------------------------------------------------
   🚨 This suite used to PRINT six lines and assert nothing. It could never
   fail — if the fresh-phone journey regressed, the run stayed green and a
   line nobody reads just printed a different value. That is the failure mode
   this repo has now recorded six times, and it was sitting on the one
   journey the app exists for.

   🚨 And it had gone further than quiet: since v46 put the real Supabase
   constants in the file, the shared `_pw` shim forces demo mode on every
   suite — so this one booted into LocalStore while its headline claimed the
   phone had "landed in cloud mode FROM THE FILE, not her device". It was
   measuring the opposite of its own claim. Like cloud.js and deploy.js it
   requires playwright-core directly, and answers the league's HTTP calls
   with the schema model, so the cloud path is really the one under test.

   What it holds down, in Nana's words: I tapped the link Jack sent and I was
   in. No password, no sign-up, nothing to install, no setup screen, and not
   one box to dismiss. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    // The commissioner has set the league up and added everybody's name.
    const db = fake.makeDB();
    fake.rpc(db, 'admin_add_player', { p_admin_token: 'bootstrap', p_name: 'Jack' });
    fake.rpc(db, 'admin_add_player', { p_admin_token: db.players[0].token, p_name: 'Nana' });
    const nana = db.players.find((p) => p.display_name === 'Nana');

    /* A phone that has NEVER opened this app: no localStorage, no config,
       nothing. She has exactly one thing — the link in a text message. */
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await fake.attach(ctx, db);
    const page = await ctx.newPage();
    let prompts = 0;
    const errs = [];
    page.on('dialog', async (d) => { prompts++; await d.dismiss(); });
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:8099/?u=${nana.token}`, { waitUntil: 'networkidle' });
    await sleep(1200);

    const st = await page.evaluate(() => ({
      store: S.store && S.store.kind,
      cfgOnThisPhone: localStorage.getItem('survivor:sb'),
      password: !!document.querySelector('input[type=password]'),
      /* ⚠️ Sweep for a DEMAND, not for the word. The first-run welcome card
         promises "Nothing to install and nothing to remember" — the opposite
         of the offence — and a bare substring sweep reads that promise as the
         thing it is ruling out. Fourth time this repo has hit that shape
         (ncdf, gen_random_bytes, the SQL comment); the answer is the same
         each time: strip the negation before looking. */
      pushy: (() => {
        const t = document.body.innerText
          .replace(/\b(nothing|no|never|not?)\b[^.!?]{0,40}?\b(to )?(install|download|sign ?up|create an? account|password)\w*/gi, '');
        return /install|download|sign ?up|create an? account|password/i.test(t);
      })(),
      setupScreen: !!document.querySelector('#first-go, #sb-url'),
      me: document.body.innerText.includes('Nana'),
      tabs: !!document.querySelector('.tabs') && !document.querySelector('.tabs').hidden,
      adminTab: (() => { const t = document.querySelector('#tab-admin'); return t ? !t.hidden : false; })(),
      pickScreen: !!document.querySelector('#s-pick') && !document.querySelector('#s-pick').hidden,
      saved: localStorage.getItem('survivor:me'),
    }));

    console.log('\n— Nana taps the link Jack texted her, on a phone that has never seen this app —');
    /* 🚨 The one that matters: the config comes from the FILE. If this ever
       reads 'local', every relative gets their own private empty league and
       nobody finds out until the picks do not add up. */
    ok(st.store === 'cloud', `she lands in the SHARED league from the file alone (store: ${st.store})`);
    ok(st.cfgOnThisPhone === null, 'nothing had to be configured on her phone');
    ok(st.me, 'the app knows who she is — her name is on the screen');
    ok(st.saved === nana.token, 'and her phone remembers her, so the next open needs no link');

    ok(!st.password, 'no password field');
    ok(!st.pushy, 'nothing asking her to install, sign up or make an account');
    ok(!st.setupScreen, 'no setup screen — she is never offered a league to create');
    ok(prompts === 0, `no dialogs to dismiss (${prompts})`);

    ok(st.pickScreen, 'she arrives on the Pick screen, ready to play');
    ok(st.tabs, 'the tab bar is there');
    /* 🚨 A personal link signs somebody IN. It must never make them
       commissioner — the token in the URL is the only credential there is. */
    ok(!st.adminTab, 'and it did NOT make her the commissioner');
    ok(errs.length === 0, `no page errors (${errs.length ? errs[0] : 'none'})`);

    // She closes it and opens it again days later, from the Home Screen icon.
    const p2 = await ctx.newPage();
    await p2.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle' });
    await sleep(1200);
    const again = await p2.evaluate(() => ({
      me: document.body.innerText.includes('Nana'),
      store: S.store && S.store.kind,
      setupScreen: !!document.querySelector('#first-go, #sb-url'),
    }));
    console.log('\n— she opens it again later with no link at all —');
    ok(again.me, 'still signed in as Nana, with no link and nothing to tap');
    ok(again.store === 'cloud', 'still in the shared league');
    ok(!again.setupScreen, 'and still never offered a setup screen');
  } finally {
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
