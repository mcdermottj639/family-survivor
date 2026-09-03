/* The v51 design merge: structure in, gold untouched.
   ------------------------------------------------------------------
   A design pass was drafted elsewhere and merged as STRUCTURE ONLY — the
   prototype's own flat green/red/gold never came in. This suite holds down
   the parts of that merge that are easy to undo by accident:

   1. the header band really is ONE sticky thing, and the "viewing as"
      warning rides inside it rather than scrolling away;
   2. the resting tab is readable on the dark band (it used to be a light
      pill, which would float);
   3. `text-transform` never reaches a string a human is identified by, or
      that a saved value is compared against — the trap that cost this merge
      three separate fixes;
   4. the gold went into the FRAME (hairlines, section rules, the week nav)
      and not just into three small labels, which is the complaint the whole
      pass started from.

   ⚠️ It deliberately does NOT re-pin the gold values themselves. That is
   `gold.js`'s job and it must stay the only place those numbers live. */
const { chromium } = require('./_pw');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pickableWeek = require('./_pickable');

const lum = (h) => { h = h.replace(/[^0-9a-f]/gi, ''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const hex = (s) => { const m = String(s).match(/[\d.]+/g); return m ? m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('') : '000000'; };
const cr = (a, b) => { const [L1, L2] = [lum(a), lum(b)].sort((x, y) => y - x); return (L1 + 0.05) / (L2 + 0.05); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('https://a.espncdn.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"/>' }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle' });
    if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
    await sleep(1600);

    console.log('\n— the header, the warning and the tabs are one band —');
    const shape = await p.evaluate(() => {
      const bar = document.querySelector('.topbar');
      return bar ? {
        sticky: getComputedStyle(bar).position,
        hd: !!bar.querySelector('.hd'),
        viewas: !!bar.querySelector('#viewas'),
        tabs: !!bar.querySelector('#tabs'),
        bg: getComputedStyle(bar).backgroundColor,
      } : null;
    });
    ok(!!shape, 'there is a .topbar');
    ok(shape && shape.sticky === 'sticky', `and it is sticky (${shape && shape.sticky})`);
    ok(shape && shape.hd && shape.tabs, 'the header and the tab bar are both inside it');
    ok(shape && shape.viewas, 'and so is the view-as warning, which must never scroll off');

    console.log('\n— it stays put when the page scrolls —');
    await p.evaluate(() => window.scrollTo(0, 600)); await sleep(350);
    const stuck = await p.evaluate(() => {
      const r = document.querySelector('.topbar').getBoundingClientRect();
      return { top: Math.round(r.top), y: Math.round(window.scrollY) };
    });
    ok(stuck.y > 200, `the page really scrolled (y=${stuck.y})`);
    ok(stuck.top <= 1, `the band is still at the top of the screen (top=${stuck.top})`);
    const tabsSeen = await p.locator('.tab[data-screen="pick"]').isVisible();
    ok(tabsSeen, 'and the tabs are still reachable without scrolling back');
    await p.evaluate(() => window.scrollTo(0, 0)); await sleep(250);

    console.log('\n— the week is in the band, in gold, and it is right —');
    const wk = await p.evaluate(() => ({
      chip: (document.querySelector('#hd-wk') || {}).textContent,
      week: typeof S !== 'undefined' ? S.week : null,
      col: document.querySelector('#hd-wk') ? getComputedStyle(document.querySelector('#hd-wk')).color : '',
      band: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
    }));
    ok(wk.chip === `Wk ${wk.week}`, `the chip names the live week ("${wk.chip}", S.week=${wk.week})`);
    ok(cr(hex(wk.col), hex(wk.band)) >= 4.5, `and it reads on the band: ${cr(hex(wk.col), hex(wk.band)).toFixed(2)}:1`);
    // The small print underneath must not repeat it — two statements of the
    // same number on two adjacent lines is how a header stops being read.
    const who = await p.locator('#whoami').innerText();
    ok(!/week\s*\d/i.test(who), `the whoami line no longer repeats the week ("${who.trim()}")`);

    console.log('\n— both palettes: a RESTING tab is readable on the band —');
    for (const pal of ['champagne', 'onyx']) {
      await p.evaluate((x) => { document.documentElement.setAttribute('data-palette', x);
        document.documentElement.setAttribute('data-theme', x === 'onyx' ? 'dark' : 'light'); }, pal);
      await sleep(200);
      const t = await p.evaluate(() => {
        const off = [...document.querySelectorAll('.tab')].find((e) => !e.classList.contains('on') && e.offsetParent);
        const on = document.querySelector('.tab.on');
        const bandBg = getComputedStyle(document.querySelector('.topbar')).backgroundColor;
        return { off: getComputedStyle(off).color, band: bandBg,
                 onImg: getComputedStyle(on).backgroundImage, onCol: getComputedStyle(on).color,
                 size: parseFloat(getComputedStyle(off).fontSize) };
      });
      const ratio = cr(hex(t.off), hex(t.band));
      ok(ratio >= 4.5, `${pal}: resting tab ${ratio.toFixed(2)}:1 @ ${t.size}px`);
      ok(t.size >= 15.5, `${pal}: and it clears the 15.5px floor`);
      // The merge was not allowed to touch this. gold.js owns the values;
      // this only proves the ACTIVE tab is still a plate and not an underline.
      ok(/gradient/.test(t.onImg), `${pal}: the active tab is still the plated gold, not a flat fill or a rule`);
      ok(!/255, 255, 255/.test(t.onCol), `${pal}: still carrying dark ink on the gold, never white`);
    }
    await p.evaluate(() => { document.documentElement.setAttribute('data-palette', 'champagne');
      document.documentElement.setAttribute('data-theme', 'light'); });
    await sleep(200);

    console.log('\n— nothing in the band drops under the type floor —');
    const smallInBand = await p.evaluate(() => {
      const bad = [];
      for (const e of document.querySelectorAll('.topbar *')) {
        if (!e.offsetParent) continue;
        if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const fs = parseFloat(getComputedStyle(e).fontSize);
        // .hd-btn's two-line A+/Text label is the app's one standing exception.
        if (fs < 15.5 && !e.closest('.hd-btn')) bad.push(`${e.className || e.tagName}:${fs.toFixed(1)}`);
      }
      return bad;
    });
    ok(smallInBand.length === 0, 'every line in the band is 15.5px or better' + (smallInBand.length ? ': ' + smallInBand.join(', ') : ''));

    console.log('\n— the gold went into the FRAME, not into three small labels —');
    const frame = await p.evaluate(() => {
      const gl = getComputedStyle(document.documentElement).getPropertyValue('--gl').trim();
      const card = document.querySelector('#s-pick .card, .cglist, .usedstrip summary');
      const nav = document.querySelector('.wknav');
      return { gl, card: card ? getComputedStyle(card).borderTopColor : '',
               nav: nav ? getComputedStyle(nav).borderTopColor : '' };
    });
    ok(frame.gl.length > 0, `--gl, the gold hairline, exists (${frame.gl})`);
    ok(frame.nav && frame.nav !== 'rgb(0, 0, 0)', `the week nav is framed in it (${frame.nav})`);
    const rules = await p.evaluate(() => {
      const out = {};
      for (const sc of ['standings', 'history', 'stats']) {
        document.querySelector(`.tab[data-screen="${sc}"]`).click();
        out[sc] = document.querySelectorAll(`#s-${sc} .hh.rule`).length;
      }
      document.querySelector('.tab[data-screen="pick"]').click();
      return out;
    });
    await sleep(400);
    ok(rules.standings >= 1 && rules.history >= 1 && rules.stats >= 3,
      `gold section rules on every screen (standings ${rules.standings}, my picks ${rules.history}, stats ${rules.stats})`);

    console.log('\n— a finished game reads as a RESULT, not as a dimmed choice —');
    /* ⚠️ This section used to end in a cheerful "nothing to measure (skipped)",
       which is the exact failure this suite's own README warns about: a check
       that passes while measuring nothing. The week the demo opens on has its
       own pick locked, so the slate is FOLDED and there are no `.game` cards at
       all. So force the state — a real final, in the full view — rather than
       hoping to find one. */
    await p.click('.tab[data-screen="pick"]'); await sleep(400);
    /* ⚠️ Deliberately a game YOUR pick is not in. The first draft of this
       check grabbed whatever game came first, hit one containing the player's
       own team, and failed — correctly, because a chosen button is exempt from
       the fade by design. Both halves of that rule are measured, separately. */
    const forced = await p.evaluate(() => {
      const games = S.games[S.week] || [];
      const mine = (pickIn(S.me.id, S.week) || {}).team || null;
      const g = games.find((x) => x.home.abbr !== mine && x.away.abbr !== mine);
      if (!g) return null;
      g.state = 'post'; g.statusText = 'Final';
      g.home.score = 31; g.away.score = 17;      // home wins, unambiguously
      S.fullWeek = S.week;                       // and show the full cards
      render();
      return { home: g.home.abbr, away: g.away.abbr };
    });
    await sleep(500);
    ok(!!forced, `forced a final into a game your pick is not in (${forced ? forced.away + ' at ' + forced.home : '—'})`);
    const res = await p.evaluate(() => {
      for (const g of document.querySelectorAll('#s-pick .game.started')) {
        const won = g.querySelector('.pk.won:not(.chosen)'), lost = g.querySelector('.pk.lost:not(.chosen)');
        if (!won || !lost) continue;
        const score = won.querySelector('.pk-rec');
        return {
          found: true,
          winnerOpacity: parseFloat(getComputedStyle(won).opacity),
          loserOpacity: parseFloat(getComputedStyle(lost).opacity),
          plate: score ? getComputedStyle(score).backgroundImage : '',
          plateInk: score ? getComputedStyle(score).color : '',
          cardOpacity: parseFloat(getComputedStyle(g).opacity),
          winnerName: won.querySelector('.pk-name').innerText.trim(),
        };
      }
      return { found: false };
    });
    ok(res.found, 'the finished matchup draws a winning side and a losing side');
    ok(res.found && res.cardOpacity === 1, 'the whole card no longer fades — that used to hide the score');
    ok(res.found && res.winnerOpacity === 1, `the winner keeps full ink (${res.winnerName})`);
    ok(res.found && res.loserOpacity < 1, `and the loser is the only side that recedes (${res.found ? res.loserOpacity : '—'})`);
    ok(res.found && /gradient/.test(res.plate), 'the winning score wears the plate, not a flat fill');
    ok(res.found && /255, 255, 255/.test(res.plateInk), `and the plate carries white, as --grad-pos is measured for (${res.plateInk})`);

    console.log('\n— but YOUR OWN pick never fades, whatever the score did —');
    /* Losing the gold off your own team halfway down a sixteen-game slate is
       how you lose track of which one is yours. The card above already says
       whether it won; the button only has to stay findable. */
    const ownLoss = await p.evaluate(() => {
      const mine = (pickIn(S.me.id, S.week) || {}).team;
      if (!mine) return null;
      const games = S.games[S.week] || [];
      const g = games.find((x) => x.home.abbr === mine || x.away.abbr === mine);
      if (!g) return null;
      const meHome = g.home.abbr === mine;
      g.state = 'post'; g.statusText = 'Final';
      g.home.score = meHome ? 10 : 30; g.away.score = meHome ? 30 : 10;   // yours loses
      S.fullWeek = S.week;
      render();
      const btn = document.querySelector(`#s-pick .game.started .pk.chosen[data-team="${mine}"]`);
      if (!btn) return { team: mine, drawn: false };
      const cs = getComputedStyle(btn);
      return { team: mine, drawn: true, lost: btn.classList.contains('lost'),
               opacity: parseFloat(cs.opacity), bg: cs.backgroundImage };
    });
    await sleep(400);
    if (ownLoss && ownLoss.drawn) {
      ok(ownLoss.lost, `your own pick is marked as the losing side (${ownLoss.team})`);
      ok(ownLoss.opacity === 1, `and it still does NOT fade (opacity ${ownLoss.opacity})`);
      ok(/gradient/.test(ownLoss.bg), 'it keeps the gold plate that says "this one is yours"');
    } else {
      ok(false, `could not draw your own pick as a finished loss (${ownLoss ? ownLoss.team : 'no pick this week'})`);
    }

    console.log('\n— 🚨 text-transform never reaches a name or a saved value —');
    await pickableWeek(p, (ms) => p.waitForTimeout(ms));
    await sleep(400);
    const team = await p.evaluate(() => {
      const btn = [...document.querySelectorAll('#s-pick .pk:not(:disabled)')][0];
      return btn ? btn.dataset.team : null;
    });
    ok(!!team, `found a pickable team (${team})`);
    await p.click(`#s-pick .pk[data-team="${team}"]`); await sleep(250);
    const cf = await p.evaluate((t) => ({
      body: document.querySelector('#confirm-body').innerText,
      want: teamName(t),
      armed: !!document.querySelector('.cf-arm i'),
      yesOpacity: parseFloat(getComputedStyle(document.querySelector('#cf-yes')).opacity),
    }), team);
    /* ⚠️ innerText carries text-transform with it. This is the check that
       catches somebody "tidying up" by uppercasing .cf-team: the panel that
       asks "is this right?" must show the name exactly as it will be saved. */
    ok(cf.body.includes(cf.want), `the confirm panel names the team verbatim, uncased ("${cf.want}")`);
    ok(cf.armed, 'the arming rule is drawn under Yes while it is dead');
    ok(cf.yesOpacity < 0.7, `and Yes still LOOKS unavailable (opacity ${cf.yesOpacity}) — the rule is a sibling, not a child`);
    await sleep(700);
    ok(!(await p.locator('#cf-yes').isDisabled()), 'Yes arms on schedule');
    await p.click('#cf-no'); await sleep(300);

    console.log('\n— and a person is never set in condensed caps —');
    await p.click('.tab[data-screen="stats"]'); await sleep(500);
    await p.click('.statrow'); await sleep(500);
    const name = await p.evaluate(() => {
      const e = document.querySelector('.sh-title');
      return { text: e.innerText.trim(), tf: getComputedStyle(e).textTransform };
    });
    ok(name.tf === 'none', `the stats sheet title is untransformed (${name.tf}) — it holds a person's name: "${name.text}"`);
    ok(!/^[A-Z ]+$/.test(name.text) || name.text.length < 3, `and it is not shouting: "${name.text}"`);

    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  } finally {
    await b.close();
  }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
