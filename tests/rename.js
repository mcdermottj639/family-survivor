/* Changing your own name.
   ------------------------------------------------------------------
   The owner: "allow people to change their name if they would like."

   ⚠️ Why this is allowed ALL SEASON while "Not Nana?" (release_me) is not.
   Releasing takes a name off the roster and orphans the picks attached to
   it, so once picks exist it is a real decision and belongs with the
   commissioner. A rename takes nothing from anybody — same row, same id,
   same picks, same token — so there is nothing to adjudicate and no reason
   to make somebody text him about it.

   🚨 The token must survive. It is minted FROM the name at creation and is
   the credential ever after: localStorage, the address bar, the Home Screen
   icon. A rename that re-mints it signs somebody out of their own bookmark. */
const { chromium } = require('./_pw');
const pickableWeek = require('./_pickable');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const openFold = (p) => p.evaluate(() => { const d = document.querySelector('.renamefold'); if (d) d.open = true; });
const goHistory = async (p) => { await p.click('.tab[data-screen="history"]'); await sleep(500); await openFold(p); await sleep(200); };
const rename = async (p, name) => {
  await goHistory(p);
  await p.fill('#rn-name', name);
  await p.click('#rn-go');
  await sleep(900);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:8099/?demo=1', { waitUntil: 'networkidle' });
  await sleep(1600);

  console.log('\n— the control is there and starts folded —');
  await page.click('.tab[data-screen="history"]'); await sleep(500);
  ok(await page.locator('.renamefold').count() === 1, 'a "Change my name" fold on My Picks');
  ok(await page.evaluate(() => document.querySelector('.renamefold').open) === false, 'shut by default — it is not what that screen is for');
  ok(await page.locator('#s-pick .renamefold').count() === 0, 'and NOT on the Pick screen, which has one job');
  await openFold(page); await sleep(250);
  ok(await page.inputValue('#rn-name') === await page.evaluate(() => S.me.display_name), 'the box opens pre-filled with the current name');
  const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#rn-name')).fontSize));
  ok(fs >= 16, `the input is ≥16px, so iOS does not zoom on focus (${fs})`);
  const bh = await page.evaluate(() => document.querySelector('#rn-go').getBoundingClientRect().height);
  ok(bh >= 56, `and the button clears the 56px tap floor (${bh.toFixed(0)})`);

  console.log('\n— renaming works, and everything else survives it —');
  const before = await page.evaluate(() => ({ token: S.me.token, id: S.me.id, admin: !!S.me.is_admin }));
  const picksBefore = await page.evaluate(() => (JSON.parse(localStorage.getItem('survivor:local')).picks || []).filter((x) => x.player_id === S.me.id).length);
  ok(picksBefore > 0, `they have picks already (${picksBefore}) — a rename must not need an empty season`);

  await rename(page, 'Great Grandma Rose');
  const after = await page.evaluate(() => ({ name: S.me.display_name, token: S.me.token, id: S.me.id, admin: !!S.me.is_admin }));
  ok(after.name === 'Great Grandma Rose', 'the name changed');
  /* 🚨 The one that matters: a re-minted token is a signed-out relative. */
  ok(after.token === before.token, 'the TOKEN did not change — their saved link still works');
  ok(after.id === before.id, 'and it is the same player row, not a new one');
  ok(after.admin === before.admin, 'a rename never grants or removes admin');
  const picksAfter = await page.evaluate(() => (JSON.parse(localStorage.getItem('survivor:local')).picks || []).filter((x) => x.player_id === S.me.id).length);
  ok(picksAfter === picksBefore, `every pick is still theirs (${picksAfter})`);
  ok(await page.evaluate(() => localStorage.getItem(meKey())) === before.token, 'the phone still remembers them under the same token');

  console.log('\n— the new name is what the whole league sees —');
  ok((await page.locator('#s-history').innerText()).includes('Great Grandma Rose'), 'My Picks heading');
  await page.click('.tab[data-screen="standings"]'); await sleep(700);
  ok((await page.locator('#s-standings').innerText()).includes('Great Grandma Rose'), 'the standings table');
  await page.click('[data-stview="grid"]'); await sleep(700);
  ok((await page.locator('#s-standings').innerText()).includes('Great Grandma Rose'), 'and the week-by-week grid');
  await page.click('[data-stview="table"]'); await sleep(400);

  console.log('\n— it survives a reload, because it went to the store —');
  await page.reload({ waitUntil: 'networkidle' }); await sleep(1600);
  ok(await page.evaluate(() => S.me.display_name) === 'Great Grandma Rose', 'still renamed after a reload');

  console.log('\n— the refusals arrive as sentences, not status codes —');
  const others = await page.evaluate(() => S.players.filter((p) => p.id !== S.me.id).map((p) => p.display_name));
  await rename(page, others[0]);
  let msg = await page.evaluate(() => (document.querySelector('.msg') || {}).innerText || '');
  ok(/already called that/i.test(msg), `taking somebody else's name is refused in words (${msg.trim().slice(0, 46)})`);
  ok(await page.evaluate(() => S.me.display_name) === 'Great Grandma Rose', 'and the old name is untouched by the failure');

  /* ⚠️ maxlength is a KEYBOARD COURTESY, not a rule — and it defeats a
     naive test, because page.fill() honours it and silently hands the app a
     28-character name that is perfectly legal. Set the value directly, which
     is what a paste, an autofill or a stale page actually does, or this
     "check" proves only that Playwright respects an HTML attribute. */
  await goHistory(page);
  await page.evaluate(() => {
    const i = document.querySelector('#rn-name');
    i.value = 'x'.repeat(40);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  ok(await page.inputValue('#rn-name') === 'x'.repeat(40), 'the over-long name really is in the box (maxlength bypassed)');
  await page.click('#rn-go'); await sleep(900);
  msg = await page.evaluate(() => (document.querySelector('.msg') || {}).innerText || '');
  ok(/too long/i.test(msg), 'a 40-character name is refused by the STORE, not just by maxlength');
  ok(await page.evaluate(() => S.me.display_name) === 'Great Grandma Rose', 'still not renamed');
  /* The refusal must not also bin what they typed. */
  ok(await page.evaluate(() => document.querySelector('.renamefold').open) === true, 'and the fold stayed open, with the error next to the box');

  await rename(page, '   ');
  msg = await page.evaluate(() => (document.querySelector('.msg') || {}).innerText || '');
  ok(/type your name/i.test(msg), 'and so is a name that is only spaces');

  console.log('\n— changing only the CAPITALS is allowed —');
  await rename(page, 'great grandma rose');
  ok(await page.evaluate(() => S.me.display_name) === 'great grandma rose', 'you do not clash with yourself');

  console.log('\n— and it can be done again —');
  await rename(page, 'Nana Rose');
  ok(await page.evaluate(() => S.me.display_name) === 'Nana Rose', 'a rename is not a one-time move');

  console.log('\n— nothing broke —');
  ok(errs.length === 0, `no page errors (${errs[0] || 'none'})`);
  const w = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }));
  ok(w.d <= w.w + 1, `no sideways scroll with the fold open (${w.d} vs ${w.w})`);

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
