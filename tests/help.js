/* The Rules and Help sheets, and the header that carries them.
   ------------------------------------------------------------------
   The owner: "I want small buttons on the header one for help with like
   navigating the app and some of the feauture and one for rules of the
   survivor league so people know the rules backed into the app."

   Two things this suite exists to hold down, both of which this repo has
   been bitten by before:

   1. 🚨 THE RULES ARE PINNED TO `HOUSE_RULES`. The sheet renders prose that
      restates the six house rules, so there are now two places the rules
      exist — the array and the comment at the top of survivor.js. A rule
      reworded on screen but not in the array (or the reverse) is exactly the
      drift that let `?v=1` survive sixteen releases and the README claim
      "856 checks" for three. The assertion reads the array OUT of the
      running app and demands the sheet match it.

   2. ⚠️ EVERY TOPIC IS A CLOSED <details>, which has no offsetParent — the
      precise condition that hid every fold in this app from the a11y sweep
      until v52. The type-floor pass here OPENS THEM ALL first, and asserts
      it actually measured something rather than reporting a clean sweep of
      nothing. Sixth instance of "a check that never looks is worse than one
      that fails". */
const { chromium } = require('./_pw');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FLOOR = 15.5;

const boot = async (b, w = 390, h = 900) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/New_York' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8099/?demo=1', { waitUntil: 'networkidle' });
  if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
  await sleep(1500);
  return { ctx, p, errs };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    let { ctx, p, errs } = await boot(b);

    console.log('\n— the two buttons are in the header, on every screen —');
    const hdr = await p.evaluate(() => [...document.querySelectorAll('.hd-right .hd-btn')]
      .map((e) => ({ id: e.id, txt: e.innerText.replace(/\n/g, ' ').trim(), lab: e.getAttribute('aria-label'),
                     w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
    ok(hdr.some((x) => x.id === 'rules-btn'), 'a Rules button');
    ok(hdr.some((x) => x.id === 'help-btn'), 'a Help button');
    ok(hdr.every((x) => /\w/.test(x.txt)), `each carries a visible word (${hdr.map((x) => x.txt).join(' / ')})`);
    ok(hdr.every((x) => x.lab && x.lab.length > 4), 'each carries a real aria-label');
    // The house floor is 56px; a shaky hand is the whole reason it exists.
    ok(hdr.every((x) => x.w >= 56 && x.h >= 56), `each clears the 56px tap floor (${hdr.map((x) => `${Math.round(x.w)}x${Math.round(x.h)}`).join(' ')})`);
    ok(!(await p.evaluate(() => !!document.querySelector('#pal-btn'))), 'and the Theme button is gone');

    for (const sc of ['standings', 'history', 'stats', 'admin']) {
      await p.click(`.tab[data-screen="${sc}"]`); await sleep(500);
      const seen = await p.evaluate(() => ['#rules-btn', '#help-btn']
        .every((s) => { const n = document.querySelector(s); return n && n.getBoundingClientRect().width > 0; }));
      ok(seen, `both still reachable on the ${sc} screen`);
    }
    await p.click('.tab[data-screen="pick"]'); await sleep(400);

    console.log('\n— the rules sheet says the SIX house rules, and says them once —');
    await p.click('#rules-btn'); await sleep(400);
    const rules = await p.evaluate(() => ({
      n: HOUSE_RULES.length,
      heads: HOUSE_RULES.map((r) => r[0]),
      body: document.querySelector('#sheet-body').innerText,
      label: document.querySelector('#sheet').getAttribute('aria-label'),
      open: !document.querySelector('#sheet').hidden,
      items: document.querySelectorAll('.hlp-rules li').length,
    }));
    ok(rules.open, 'it opens');
    ok(rules.n === 6, `HOUSE_RULES holds the six house rules (${rules.n})`);
    ok(rules.items === 6, `and the sheet draws all six (${rules.items})`);
    for (const h of rules.heads) {
      // Strip the entities the array uses for typographic apostrophes.
      const plain = h.replace(/&rsquo;/g, '’');
      ok(rules.body.includes(plain), `the sheet states: "${plain.slice(0, 46)}${plain.length > 46 ? '…' : ''}"`);
    }
    ok(/never knocked out/i.test(rules.body), 'and leads with the one thing that makes this pool unusual');
    ok(!/\[object |undefined|NaN/.test(rules.body), 'nothing rendered as [object …], undefined or NaN');

    console.log('\n— #sheet is SHARED, so it must say which dialog it is —');
    ok(rules.label === 'The rules', `the rules sheet is named "${rules.label}"`);
    await p.keyboard.press('Escape'); await sleep(300);
    await p.click('#help-btn'); await sleep(400);
    ok(await p.evaluate(() => document.querySelector('#sheet').getAttribute('aria-label')) === 'How the app works',
      'the help sheet is named "How the app works"');
    await p.keyboard.press('Escape'); await sleep(300);
    // The pre-existing bug this surfaced: the stats sheet announced itself as
    // "Matchup details" from the day it shipped.
    await p.click('.tab[data-screen="stats"]'); await sleep(700);
    await p.click('#s-stats [data-pstat]'); await sleep(600);
    const slab = await p.evaluate(() => document.querySelector('#sheet').getAttribute('aria-label'));
    ok(slab && !/matchup/i.test(slab), `and the stats sheet no longer claims to be a matchup ("${slab}")`);
    await p.keyboard.press('Escape'); await sleep(300);
    await p.click('.tab[data-screen="pick"]'); await sleep(500);

    console.log('\n— it closes every way an overlay in this app closes —');
    for (const [how, act] of [
      ['the ✕ button', async () => p.click('#sheet-close')],
      ['Escape', async () => p.keyboard.press('Escape')],
      ['a tap on the backdrop', async () => p.click('#sheet .sheet-back', { position: { x: 10, y: 10 } })],
    ]) {
      await p.click('#help-btn'); await sleep(350);
      await act(); await sleep(350);
      ok(await p.evaluate(() => document.querySelector('#sheet').hidden), `closes on ${how}`);
    }

    console.log('\n— the background is inert while it is open, and released after —');
    await p.click('#rules-btn'); await sleep(350);
    const inert = await p.evaluate(() => ['.hd', '#tabs', '#main', '.ft']
      .map((s) => [s, document.querySelector(s) && document.querySelector(s).hasAttribute('inert')]));
    ok(inert.every(([, v]) => v), `every background region is inert (${inert.map(([s]) => s).join(' ')})`);
    ok(await p.evaluate(() => getComputedStyle(document.body).position === 'fixed'), 'and the body is pinned, so iOS cannot scroll behind it');
    await p.keyboard.press('Escape'); await sleep(400);
    ok(await p.evaluate(() => !document.querySelector('#main').hasAttribute('inert')), 'and all of it is released on close');
    ok(await p.evaluate(() => getComputedStyle(document.body).position !== 'fixed'), 'and the body is unpinned');

    console.log('\n— the gold plate takes DARK ink, as every accent fill in this app must —');
    await p.click('#rules-btn'); await sleep(350);
    const lede = await p.evaluate(() => {
      const n = document.querySelector('.hlp-lede'), cs = getComputedStyle(n);
      return { img: cs.backgroundImage, col: cs.color };
    });
    ok(/gradient/.test(lede.img), 'the lede is the plated gradient, not a flat hex');
    // White on gold measures about 1.9:1. Dark ink is not a preference here.
    const rgb = lede.col.match(/\d+/g).map(Number);
    ok(rgb[0] + rgb[1] + rgb[2] < 200, `and carries dark ink, not white (${lede.col})`);
    await p.keyboard.press('Escape'); await sleep(300);

    console.log('\n— type floor, with every fold OPENED first —');
    let swept = 0, small = [];
    for (const [btn, nm] of [['#rules-btn', 'rules'], ['#help-btn', 'how it works']]) {
      await p.click(btn); await sleep(400);
      const r = await p.evaluate((floor) => {
        // ⚠️ A closed <details> gives its children no offsetParent, so they are
        // invisible to the sweep below — the v52 hole. Open them all.
        document.querySelectorAll('#sheet-body details').forEach((d) => { d.open = true; });
        const bad = []; let n = 0;
        for (const e of document.querySelectorAll('#sheet-body *')) {
          if (!e.offsetParent && e.tagName !== 'SUMMARY') continue;
          if (!e.textContent.trim()) continue;
          n++;
          const fs = parseFloat(getComputedStyle(e).fontSize);
          if (fs < floor) bad.push(`${e.className || e.tagName} ${fs.toFixed(2)}px`);
        }
        return { n, bad: [...new Set(bad)] };
      }, FLOOR);
      swept += r.n; small = small.concat(r.bad);
      ok(r.bad.length === 0, `nothing under ${FLOOR}px in the ${nm} sheet${r.bad.length ? ' — ' + r.bad.join(', ') : ''}`);
      await p.keyboard.press('Escape'); await sleep(300);
    }
    // 🚨 The failure this suite is most likely to have is measuring NOTHING
    // and reporting a pass. Prove it swept.
    ok(swept > 60, `and it really measured something (${swept} elements)`);

    console.log('\n— every topic in "How the app works" is a real fold —');
    await p.click('#help-btn'); await sleep(400);
    const folds = await p.evaluate(() => {
      const d = [...document.querySelectorAll('#sheet-body details')];
      return { n: d.length, allShut: d.every((x) => !x.open), sums: d.map((x) => x.querySelector('summary').innerText.trim()),
               tap: d.every((x) => x.querySelector('summary').getBoundingClientRect().height >= 56) };
    });
    ok(folds.n >= 6, `${folds.n} topics`);
    ok(folds.allShut, 'all of them start closed, so the sheet opens short');
    ok(folds.tap, 'and every summary is a 56px tap target');
    ok(new Set(folds.sums).size === folds.sums.length, 'no topic is listed twice');
    await p.keyboard.press('Escape'); await sleep(300);

    console.log('\n— no jargon, and nothing that promises what the app cannot do —');
    const words = await p.evaluate(() => {
      document.querySelector('#help-btn').click();
      document.querySelectorAll('#sheet-body details').forEach((d) => { d.open = true; });
      const a = document.querySelector('#sheet-body').innerText;
      document.querySelector('#rules-btn').click();
      return a + '\n' + document.querySelector('#sheet-body').innerText;
    });
    await sleep(200);
    for (const w of ['variance', 'regression', 'de-vig', 'expected value', 'localStorage', 'Supabase', 'cache']) {
      ok(!new RegExp(w, 'i').test(words), `no "${w}"`);
    }
    // "tap and hold" is a gesture iOS Safari does not support on non-image
    // elements — the app promised it once already and could not deliver.
    ok(!/tap and hold|long press/i.test(words), 'no gesture iOS cannot perform');
    await p.keyboard.press('Escape'); await sleep(300);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();

    console.log('\n— it fits, on the smallest phone, in Bigger Text —');
    for (const w of [320, 390]) {
      for (const big of [false, true]) {
        const r = await boot(b, w, 800); const pp = r.p;
        if (big) { await pp.click('#big-btn'); await sleep(350); }
        for (const [btn, nm] of [['#rules-btn', 'rules'], ['#help-btn', 'help']]) {
          await pp.click(btn); await sleep(400);
          /* ⚠️ Measure the height it OPENS at, before forcing the folds. The
             first cut opened every topic and then checked the 3400px stats
             cap, which failed at 3618px — but nobody ever sees that page: the
             folds start shut and a reader opens the one they want. The honest
             promise is that it opens SHORT. */
          const shut = await pp.evaluate(() => document.querySelector('.sheet-card').scrollHeight);
          /* 2200px is the six rules with their explanations at 22px type on a
             320px phone — the worst case, and about a screen and a half of
             scrolling. It is not a round number chosen for comfort: it is
             roughly one more paragraph than the sheet currently holds, so
             padding the rules out lands on it. Help opens far shorter (its
             topics are folded); the same bound covers both. */
          ok(shut < 2200, `${nm} @${w}${big ? '/big' : ''}: opens at ${shut}px, short enough to take in`);
          const m = await pp.evaluate(() => {
            document.querySelectorAll('#sheet-body details').forEach((d) => { d.open = true; });
            return { doc: document.documentElement.scrollWidth, vw: innerWidth,
                     wide: [...document.querySelectorAll('#sheet-body *')]
                       .filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length };
          });
          ok(m.doc <= m.vw, `${nm} @${w}${big ? '/big' : ''}: no sideways scroll with every topic open (${m.doc} <= ${m.vw})`);
          ok(m.wide === 0, `${nm} @${w}${big ? '/big' : ''}: nothing painted past the right edge`);
          await pp.keyboard.press('Escape'); await sleep(250);
        }
        await r.ctx.close();
      }
    }

    console.log('\n— the header still fits, with three buttons on it —');
    for (const [w, big] of [[320, true], [320, false], [375, true], [390, true], [430, true]]) {
      const r = await boot(b, w, 800); const pp = r.p;
      if (big) { await pp.click('#big-btn'); await sleep(350); }
      const m = await pp.evaluate(() => {
        const nm = document.querySelector('.hd-name').getBoundingClientRect();
        const right = document.querySelector('.hd-right').getBoundingClientRect();
        return { doc: document.documentElement.scrollWidth, vw: innerWidth,
                 nmW: nm.width, nmRight: nm.right, rightLeft: right.left, rightTop: right.top, nmTop: nm.top };
      });
      ok(m.doc <= m.vw, `@${w}${big ? '/big' : ''}: the page is not pushed sideways (${m.doc} <= ${m.vw})`);
      /* 🚨 The wordmark must never paint over the buttons. It did, for one
         round: `.hd-brand` carries `min-width: 0`, which overrode the
         automatic min-content floor, so the brand collapsed past its own
         content. They either share a row and clear each other, or the
         buttons are on a row of their own. */
      const sameRow = Math.abs(m.rightTop - m.nmTop) < 20;
      ok(!sameRow || m.nmRight <= m.rightLeft + 1,
        `@${w}${big ? '/big' : ''}: the wordmark never overlaps the buttons (${sameRow ? 'same row' : 'wrapped'})`);
      /* And it must not be chopped mid-word into FAM/ILY/SUR/VIV/OR, which is
         what `overflow-wrap: anywhere` does once the column is squeezed. */
      ok(m.nmW >= 84, `@${w}${big ? '/big' : ''}: the wordmark is not chopped mid-word (${Math.round(m.nmW)}px wide)`);
      await r.ctx.close();
    }
  } catch (e) { fail++; console.log('  ✗ threw: ' + e.message); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
