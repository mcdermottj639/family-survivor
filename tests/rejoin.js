/* 🔗 REJOINING A NAME THAT IS ALREADY YOURS.
   ------------------------------------------------------------------
   The owner, after a relative could not get back in: "Gloria Mary had
   trouble with her link can you allow her to rejoin from any form so any
   link works for her."

   🚨 WHAT THE DEAD END WAS, because every check here is aimed at it. Once a
   name is claimed it is off the tap list (claimed names are filtered out) AND
   join_league refuses it as a duplicate AND, if the link itself is broken or
   was never saved, there is nothing left at all. Three unrelated causes land
   on that one screen — a Home Screen icon's separate storage, cleared site
   data, a link cut short by a text message — and not one of them is something
   she can fix. So typing her own name is now the way back in, on every path.

   ⚠️ THE THINGS THAT MUST NOT MOVE, and each has its own check below:
     · the TOKEN is not re-minted (the v52 rename rule — it is the credential
       in localStorage, the address bar and any Home Screen icon)
     · the row, its id and every pick are untouched
     · it NEVER hands out admin: typing the commissioner's name is refused,
       because claim_player hands out the row's is_admin and a rejoin that did
       the same would make anyone who types "Jack" the commissioner
     · it confirms first, with the v49 arming window — a name typed on a phone
       keyboard can land on somebody else's, and this opens their picks

   The cloud half (the rejoin_player RPC itself, where a renamed argument is a
   404 no browser suite can see) is proved in cloud.js; the broken-link screen
   that now leads here is in deploy.js. This suite is the behaviour. */
const { chromium } = require('./_pw');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'http://127.0.0.1:8099/';

/* Fake a phone that has forgotten who it is — the whole premise. It asks the
   app for the key rather than naming 'survivor:me': since v50 the demo and
   the real league keep their sign-ins apart. */
const forget = async (p) => {
  await p.evaluate(() => localStorage.removeItem(meKey()));
  await p.goto(BASE + '?demo=1', { waitUntil: 'networkidle' });
  await sleep(1200);
};
const type = async (p, name) => {
  await p.fill('#join-name', name);
  await p.click('#join-go');
  await sleep(500);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '?demo=1', { waitUntil: 'networkidle' });
  await sleep(1800);

  /* The demo season is the fixture: 18 relatives, most with a season of picks
     behind them, which is exactly what must survive a rejoin. */
  const her = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('survivor:local'));
    const p = db.players.find((x) => !x.is_admin && x.claimed_at
      && db.picks.some((k) => k.player_id === x.id));
    return p && { id: p.id, name: p.display_name, token: p.token,
      picks: db.picks.filter((k) => k.player_id === p.id).length };
  });
  /* ⚠️ A suite that cannot express the failure cannot test the fix — if the
     fixture has nobody claimed with picks, every check below would measure
     nothing and report a pass. This repo has shipped that six times. */
  if (!her || her.picks < 2) { console.log('  ✗ fixture: no claimed relative with picks'); process.exit(1); }
  console.log(`\n— ${her.name} has ${her.picks} picks and has lost her link —`);
  await forget(page);

  const join = await page.locator('#s-pick').innerText();
  ok(await page.locator('#join-name').count() === 1, 'the join screen offers the name box');
  const onList = await page.evaluate(() => Array.from(document.querySelectorAll('.namebtn')).map((x) => x.innerText.trim()));
  // The precondition for the whole bug: her name is NOT tappable.
  ok(!onList.includes(her.name), `her name is not on the tap list — it is already claimed`);
  ok(/type the same name you used before/i.test(join), 'and the screen tells her to type the same name she used before');
  ok(/nothing starts over/i.test(join), 'promising her picks and record survive');
  ok(!/will be refused/i.test(join), 'and never tells her that typing it cannot work');

  console.log('\n— typing it asks whether it is really her —');
  await type(page, her.name);
  ok(await page.locator('#confirm').isVisible(), 'a confirmation opens rather than signing her in at once');
  const cf = await page.locator('#confirm-body').innerText();
  ok(new RegExp(`are you ${her.name}\\?`, 'i').test(cf), `it asks "Are you ${her.name}?"`);
  ok(/welcome back/i.test(cf), 'headed "Welcome back", not treated as a new join');
  ok(/still there|nothing starts over/i.test(cf), 'and says her picks are still there');
  ok(!/comes off the list/i.test(cf), 'and does NOT claim her name is being taken from anybody');
  // The v49 tremor guard: a shaky double contact must not answer this.
  ok(await page.locator('#rj-yes').isDisabled(), 'Yes starts disabled, so a tremor double-tap cannot answer it');
  const dim = await page.evaluate(() => +getComputedStyle(document.querySelector('#rj-yes')).opacity);
  ok(dim < 0.6, `and it LOOKS unavailable while it is (opacity ${dim})`);
  const early = await page.evaluate(() => { document.querySelector('#rj-yes').click(); return !!S.confirming; });
  ok(early, 'a dispatched click during the arming window is refused too');
  await sleep(700);
  ok(!await page.locator('#rj-yes').isDisabled(), 'it arms a moment later');

  console.log('\n— backing out changes nothing —');
  await page.click('#rj-no'); await sleep(500);
  ok(await page.locator('#confirm').isHidden(), '"No, go back" closes the panel');
  ok(await page.locator('#tabs').isHidden(), 'and she is still not signed in');
  ok(await page.evaluate(() => S.rejoining === null), 'and no pending identity is left behind');

  console.log('\n— saying yes puts her back into her own season —');
  await type(page, her.name);
  await sleep(700);
  await page.click('#rj-yes'); await sleep(1200);
  ok(await page.locator('#tabs').isVisible(), 'she is signed in and into the app');
  ok(new RegExp(her.name, 'i').test(await page.locator('#whoami').innerText()), `as ${her.name}`);
  const after = await page.evaluate(() => ({ id: S.me.id, token: S.me.token, admin: !!S.me.is_admin }));
  ok(after.id === her.id, 'the SAME player row — not a second one with her name');
  /* 🚨 The token is the credential, minted from the name only once. Handing
     back a new one would sign her out of her own bookmark and Home Screen
     icon, which is the one thing this app promises never to make her deal
     with. Same rule as rename_me. */
  ok(after.token === her.token, 'and the same token — her old link still works');
  ok(!after.admin, 'rejoining never grants admin');
  ok(await page.locator('#tab-admin').isHidden(), 'so there is no Admin tab');
  const kept = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('survivor:local'));
    return db.picks.filter((k) => k.player_id === S.me.id).length;
  });
  ok(kept === her.picks, `all ${her.picks} of her picks are still there`);
  const rowsNamed = await page.evaluate((n) => {
    const db = JSON.parse(localStorage.getItem('survivor:local'));
    return db.players.filter((p) => p.display_name.toLowerCase() === n.toLowerCase()).length;
  }, her.name);
  ok(rowsNamed === 1, 'and the roster did not gain a duplicate of her');

  console.log('\n— it does not care about capital letters —');
  const him = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('survivor:local'));
    const me = localStorage.getItem(meKey());
    const p = db.players.find((x) => !x.is_admin && x.claimed_at && x.token !== me);
    return p && { id: p.id, name: p.display_name, token: p.token };
  });
  ok(!!him, 'there is a second claimed relative to try');
  await forget(page);
  await type(page, him.name.toUpperCase());
  ok(await page.locator('#rj-yes').count() === 1, `"${him.name.toUpperCase()}" is recognised as ${him.name}`);
  await sleep(700);
  await page.click('#rj-yes'); await sleep(1200);
  ok(await page.evaluate(() => S.me.token) === him.token, 'and it is the same person, same token');

  console.log('\n— but NOT the commissioner, whose name carries his powers —');
  const boss = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('survivor:local'));
    const p = db.players.find((x) => x.is_admin);
    return { id: p.id, name: p.display_name };
  });
  await forget(page);
  await type(page, boss.name);
  ok(await page.locator('#confirm').isHidden(), `typing "${boss.name}" opens no confirmation at all`);
  ok(await page.locator('#tabs').isHidden(), 'and signs nobody in');
  const refused = await page.locator('#s-pick').innerText();
  ok(new RegExp(`that name is ${boss.name}`, 'i').test(refused), 'it says whose name that is');
  ok(/his own link/i.test(refused), 'and names the route that does work for him');
  /* 🚨 The UI routing is a courtesy; the STORE is the rule. Anyone can call
     this directly from the console, and it must refuse there too. */
  const direct = await page.evaluate((id) => S.store.rejoinPlayer(id), boss.id);
  ok(direct && direct.ok === false, `the store refuses it too: "${direct.error}"`);
  ok(!direct.token, 'and hands back no token');

  console.log('\n— every other way in still works —');
  // A brand-new relative: unchanged join path.
  await type(page, 'Great Aunt Edna');
  await sleep(900);
  ok(/Great Aunt Edna/i.test(await page.locator('#whoami').innerText()), 'a NEW name still joins the league outright');
  ok(!await page.evaluate(() => S.me.is_admin), 'and still never gets admin');
  // A pre-added name nobody has tapped: this is a first claim, not a rejoin,
  // and it must ask the first-claim question ("comes off the list").
  const freeName = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('survivor:local'));
    const p = db.players.find((x) => !x.claimed_at);
    return p && p.display_name;
  });
  ok(!!freeName, 'the demo still has an unclaimed name to try');
  await forget(page);
  await type(page, freeName);
  ok(await page.locator('#nm-yes').count() === 1, `typing an unclaimed name ("${freeName}") asks the first-claim question`);
  ok(await page.locator('#rj-yes').count() === 0, 'not the rejoin one');
  ok(/comes off the list/i.test(await page.locator('#confirm-body').innerText()),
    'which is the true thing to say about a name nobody has taken');
  await sleep(700);
  await page.click('#nm-yes'); await sleep(1200);
  ok(new RegExp(freeName, 'i').test(await page.locator('#whoami').innerText()),
    'and typing it signs her in — the tap list is now a shortcut, not the only way');

  ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`);
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
