/* A league must never lose its last commissioner.
   ------------------------------------------------------------------
   🚨 The owner did exactly this and locked himself out of his own league. It
   is THE unrecoverable action in the app, and nothing was guarding it:
   `admin_add_player` only bootstraps a commissioner while `players` is EMPTY,
   and `join_league` never grants admin however it is called — so a league
   with no admin can never get one back from inside the app. The only way
   back is the Supabase SQL editor, which is not a thing this app may ever
   require of anybody.
   Held in four places, like every other rule here: the UI, both stores, and
   schema.sql. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = 'http://127.0.0.1:8099/';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    const db = fake.makeDB();
    fake.rpc(db, 'admin_add_player', { p_admin_token: 'bootstrap', p_name: 'Jack' });
    fake.rpc(db, 'admin_add_player', { p_admin_token: db.players[0].token, p_name: 'Nana' });
    const jack = db.players.find((p) => p.is_admin);
    const nana = db.players.find((p) => !p.is_admin);

    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await fake.attach(ctx, db);
    const p = await ctx.newPage();
    await p.goto(`${B}?u=${jack.token}`); await sleep(2000);
    await p.click('.tab[data-screen="admin"]'); await sleep(800);

    console.log('\n— the store refuses it, whatever the screen offers —');
    const self = await p.evaluate((id) => S.store.removePlayer(S.me.token, id), jack.id);
    ok(self && self.ok === false, 'removing yourself is refused');
    ok(/cannot remove yourself/i.test((self || {}).error || ''), `and says why (${(self || {}).error})`);
    ok(db.players.some((x) => x.id === jack.id), 'he is still in the league');
    ok(db.players.some((x) => x.is_admin), 'the league still has a commissioner');

    /* Same refusal reached by id rather than by "is it me" — a second admin
       token must not be able to delete the last admin either. */
    const onlyAdmin = await p.evaluate((id) => S.store.removePlayer(S.me.token, id), jack.id);
    ok(onlyAdmin.ok === false, 'and it stays refused on a second attempt');

    console.log('\n— but an ordinary relative can still be removed —');
    const other = await p.evaluate((id) => S.store.removePlayer(S.me.token, id), nana.id);
    ok(other && other.ok === true, 'removing somebody else still works');
    ok(!db.players.some((x) => x.id === nana.id), 'and she is gone');

    console.log('\n— and the screen does not offer a button that can only fail —');
    await p.reload({ waitUntil: 'networkidle' }); await sleep(1800);
    await p.click('.tab[data-screen="admin"]'); await sleep(800);
    await p.evaluate(() => document.querySelectorAll('#s-admin .plrow').forEach((d) => { d.open = true; }));
    await sleep(300);
    const dels = await p.evaluate(() => [...document.querySelectorAll('#s-admin [data-del]')].map((x) => Number(x.dataset.del)));
    ok(!dels.includes(jack.id), 'no Remove button on the commissioner\'s own row');
    ok(await p.locator('#s-admin .plrow').count() >= 1, 'the roster still renders');

    console.log('\n— the rule is in schema.sql too, not just the client —');
    const sql = require('fs').readFileSync('/home/user/family-survivor/schema.sql', 'utf8');
    const fn = sql.slice(sql.indexOf('function admin_del_player'), sql.indexOf('function admin_token_for'));
    ok(/cannot remove yourself/i.test(fn), 'admin_del_player refuses self-removal');
    ok(/only commissioner/i.test(fn), 'and refuses removing the last admin');
    ok(/count\(\*\) into v_admins/.test(fn), 'by counting the admins, not by trusting the client');
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
