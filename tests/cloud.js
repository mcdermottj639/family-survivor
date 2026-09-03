/* The LIVE path: does the app actually work as a shared league?
   ------------------------------------------------------------------
   🚨 Until this suite, SupaStore had zero coverage. Every other suite runs on
   LocalStore, so the code that will actually run for twenty relatives — the
   URLs, the headers, the payloads, the error handling — had never been
   executed once. The sandbox cannot reach supabase.co and the real database
   is the owner's, so this answers the app's HTTP calls with a model of the
   schema (tests/_fakesupa.js).

   ⚠️ What this can and cannot prove. It proves the CLIENT half: that a fresh
   phone with empty storage lands in cloud mode off the file alone, that
   picks travel between two devices, that the token never leaves the server,
   and that a refusal arrives as a sentence rather than a status code. It
   CANNOT prove schema.sql, which has never met a live Postgres —
   tests/schema.js covers as much of that as static analysis allows, and the
   rest is confirmed the first time somebody opens the real link. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const boot = async (ctx, db, url) => {
  await fake.attach(ctx, db);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { p.__err = (p.__err || []).concat(e.message); });
  await p.goto(url || 'http://127.0.0.1:8099/', { waitUntil: 'networkidle' });
  await sleep(900);
  return p;
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    console.log('\n— the deployed file alone puts a fresh phone in the shared league —');
    const src = fs.readFileSync('/home/user/family-survivor/survivor.js', 'utf8');
    const u = (src.match(/let SUPABASE_URL = '([^']*)'/) || [])[1];
    const k = (src.match(/let SUPABASE_KEY = '([^']*)'/) || [])[1];
    ok(!!u && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(u), `SUPABASE_URL is set in the file (${u})`);
    ok(!!k && k.length > 100, 'SUPABASE_KEY is set in the file');
    // 🚨 The one thing that must never be true: the secret key in a public file.
    let role = null;
    try { role = JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString()).role; } catch (e) {}
    ok(role === 'anon', `and it is the ANON key, not service_role (role: ${role})`);

    const db = fake.makeDB();
    // Seed the league the way the commissioner does: in the SQL editor.
    fake.rpc(db, 'admin_add_player', { p_admin_token: 'bootstrap', p_name: 'Jack' });
    fake.rpc(db, 'admin_add_player', { p_admin_token: db.players[0].token, p_name: 'Nana' });
    const jackToken = db.players[0].token;

    // A phone that has never opened the app and has nothing saved.
    const ctxA = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
    const A = await boot(ctxA, db);
    ok(await A.evaluate(() => S.store.kind) === 'cloud', 'a phone with empty storage is in CLOUD mode with no setup at all');
    ok(await A.evaluate(() => isShared()) === true, 'isShared() agrees');
    ok(db.noKey.length === 0, `every request carried the apikey header (${db.calls.length} calls)`);

    console.log('\n— a relative taps their name, and that is the whole sign-up —');
    ok(await A.locator('.namebtn').count() >= 2, `the roster is offered to tap (${await A.locator('.namebtn').count()} names)`);
    ok((await A.locator('#s-pick').innerText()).includes('Nana'), 'Nana is on the list');
    // The token must never be readable by the anon key.
    const leaked = await A.evaluate(async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/players_public?select=*`, { headers: { apikey: SUPABASE_KEY } });
      return (await r.json()).some((p) => 'token' in p);
    });
    ok(leaked === false, 'players_public never returns a token — nobody can pick as somebody else');

    const names = await A.locator('.namebtn').allInnerTexts();
    const nanaIdx = names.findIndex((n) => /Nana/.test(n));
    await A.locator('.namebtn').nth(nanaIdx).click(); await sleep(400);
    // ⚠️ The name confirmation is #nm-yes, NOT #cf-yes (that is the PICK
    // confirmation). Choosing who you are and choosing a team are different
    // decisions and have different buttons.
    ok(await A.locator('#confirm').isVisible(), 'choosing a name confirms first — a mis-tap takes a name off the list for everybody');
    await A.click('#nm-yes'); await sleep(1500);
    ok(await A.evaluate(() => S.me && S.me.display_name) === 'Nana', 'she is signed in — no password, no account, no install');
    ok(await A.evaluate(() => S.me.is_admin) === false, 'and claiming a name never grants admin');
    ok(db.players.find((p) => p.display_name === 'Nana').claimed_at != null, 'the name is marked claimed on the server');

    console.log('\n— she makes a pick, and it is written to the league —');
    /* ⚠️ Games come from ESPN, which the sandbox cannot reach either — and
       demo mode is not an option here because it would force the on-device
       store, which is the exact thing this suite exists to avoid. So the
       SCHEDULE is faked in place (the app's own demoGames fixture) while the
       STORE stays the real SupaStore talking to the stub. */
    const wk = await A.evaluate(() => {
      for (let w = S.liveWeek; w <= 18; w++) {
        S.games[w] = demoGames(w);
        if ((S.games[w] || []).some((g) => g.state === 'pre')) { S.week = w; S.weekPinned = true; S.fullWeek = w; render(); return w; }
      }
      return null;
    });
    await sleep(800);
    const team = await A.evaluate(() => {
      const x = [...document.querySelectorAll('#s-pick .pk')].find((e) => !e.disabled);
      return x ? x.dataset.team : null;
    });
    ok(!!team, `week ${wk} has a pickable team (${team})`);
    await A.click(`#s-pick .pk[data-team="${team}"]`); await sleep(400);
    ok(await A.locator('#confirm').isVisible(), 'it confirms first');
    await A.click('#cf-yes'); await sleep(1500);
    const row = db.picks.find((p) => p.team === team);
    ok(!!row, 'the pick reached the database');
    ok(row && row.kickoff, 'carrying its own kickoff — that is what makes the deadline enforceable server-side');
    ok(row && row.entered_by === 'self', 'recorded as her own pick, not the commissioner\'s');

    console.log('\n— 🚨 THE WHOLE POINT: a second phone sees it —');
    const ctxB = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York' });
    const B = await boot(ctxB, db, `http://127.0.0.1:8099/?u=${jackToken}`);
    await sleep(1200);
    ok(await B.evaluate(() => S.me && S.me.display_name) === 'Jack', 'Jack opens his own link on a different device and is signed in');
    ok(await B.evaluate(() => S.me.is_admin) === true, 'as the commissioner');
    const seen = await B.evaluate(() => S.picks.map((p) => p.team + '@' + p.week));
    ok(seen.some((x) => x.startsWith(team + '@')), `and he can see Nana's pick (${team}) — the league is genuinely shared`);
    ok(await B.evaluate(() => S.store.kind) === 'cloud', 'his phone is in cloud mode too, off the same file');

    console.log('\n— the rules hold across the wire, and refusals are readable —');
    const dup = await A.evaluate(async (t) => S.store.submitPick(
      S.me.token, S.week === 18 ? 17 : S.week + 1, t, new Date(Date.now() + 864e5).toISOString()), team);
    ok(dup && dup.ok === false, 'the same team twice is refused');
    ok(/already used/i.test(dup.error || ''), `in words, not a status code: "${dup.error}"`);
    const started = await A.evaluate(async () => S.store.submitPick(S.me.token, 3, 'KC', new Date(Date.now() - 6e5).toISOString()));
    ok(started && started.ok === false && /already started/i.test(started.error || ''), `a kicked-off game is refused: "${started.error}"`);
    const bye = await A.evaluate(async () => S.store.submitPick(S.me.token, 4, 'KC', null));
    ok(bye && bye.ok === false && /bye/i.test(bye.error || ''), `a bye pick is refused: "${bye.error}"`);
    const notAdmin = await A.evaluate(async () => S.store.addPlayer(S.me.token, 'Sneaky'));
    ok(notAdmin && notAdmin.ok === false && /not an admin/i.test(notAdmin.error || ''), 'a relative cannot add players');

    console.log('\n— it fails like an app, not like a database —');
    // A 500 with a Postgres body: the sentence must reach the screen, the
    // status code must not. "submit_pick failed (409)" on a 95-year-old's
    // phone reads as "the app is broken" and ends in a phone call.
    await ctxA.route('**/rest/v1/rpc/submit_pick', (r) => r.fulfill({ status: 409, contentType: 'application/json',
      body: JSON.stringify({ message: 'You already used the Chiefs in week 3.' }) }));
    const surfaced = await A.evaluate(async () => {
      try { await S.store.submitPick(S.me.token, 9, 'KC', new Date(Date.now() + 864e5).toISOString()); return null; }
      catch (e) { return e.message; }
    });
    ok(surfaced === 'You already used the Chiefs in week 3.', `a 409 surfaces its sentence, not its number: "${surfaced}"`);
    await ctxA.unroute('**/rest/v1/rpc/submit_pick');

    await ctxA.route('**/rest/v1/rpc/**', (r) => r.abort());
    const dead = await A.evaluate(async () => {
      try { await S.store.whoami('x'); return null; } catch (e) { return e.message; }
    });
    ok(/reach the league|signal/i.test(dead || ''), `an unreachable league says so plainly: "${dead}"`);
    ok(!/fetch|network|TypeError|undefined/i.test(dead || ''), 'and never leaks a browser error string');
    await ctxA.unroute('**/rest/v1/rpc/**');

    console.log('\n— demo mode cannot touch the real league —');
    const ctxC = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const C = await boot(ctxC, db);
    const before = db.players.length;
    await C.evaluate(() => localStorage.setItem('survivor:demo', '1'));
    await C.reload({ waitUntil: 'networkidle' }); await sleep(1200);
    ok(await C.evaluate(() => S.store.kind) === 'local', 'with demo on, the store is on-device even though Supabase is configured');
    await C.evaluate(async () => { if (typeof seedDemo === 'function') await seedDemo(); });
    await sleep(1500);
    ok(db.players.length === before, `and seeding 18 demo relatives added NONE to the real roster (still ${db.players.length})`);
    ok(db.picks.every((p) => p.entered_by !== 'demo'), 'no demo pick reached the league');
    await C.evaluate(() => localStorage.setItem('survivor:demo', '0'));
    await C.reload({ waitUntil: 'networkidle' }); await sleep(1000);
    ok(await C.evaluate(() => S.store.kind) === 'cloud', 'turning demo off returns the phone to the shared league');

    const errs = [A, B, C].flatMap((p) => p.__err || []);
    ok(errs.length === 0, 'no page errors anywhere' + (errs.length ? ': ' + errs[0] : ''));
    await ctxA.close(); await ctxB.close(); await ctxC.close();
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
