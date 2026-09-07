/* The commissioner's share card.
   ------------------------------------------------------------------
   The owner: "a share button for me as the admin in the standings section
   that gives me a one page visual download with top 5 season standings and
   the week priors stand out performance."

   Four things this suite exists to hold down, three of which are ways the
   feature could fail SILENTLY — which is the failure mode this repo keeps
   recording:

   1. 🚨 IT IS ADMIN ONLY. A relative seeing it is a leak of the
      commissioner's tooling onto the family's screen. Asserted from a real
      non-admin session, not inferred from the markup.
   2. 🚨 IT CANNOT LEAK A HIDDEN PICK. Everything comes from
      lastCompleteWeek(), so every game on the card is final and every pick
      already public. This is the THIRD feature to read more than one
      player's picks; the Stats tab leaked them at v41 without ever
      displaying one, so the assertion is that no unstarted pick's team can
      appear on the card at all.
   3. 🚨 THE CANVAS MUST NOT BE TAINTED. Drawing a cross-origin ESPN helmet
      would make toBlob throw a SecurityError and the download would fail
      with nothing on screen. The card must produce real PNG bytes.
   4. ⚠️ THE GOLD ON THE CARD IS TRANSCRIBED, not read from CSS — canvas
      cannot parse a CSS gradient. So the two can drift. The stops are
      pinned against the LIVE tokens here, which is the only thing standing
      between "don't change the gold" and a share card quietly using an old
      one. */
const { chromium } = require('./_pw');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const boot = async (b, w = 390) => {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, timezoneId: 'America/New_York' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8099/?demo=1', { waitUntil: 'networkidle' });
  if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
  await sleep(1600);
  await p.click('.tab[data-screen="standings"]'); await sleep(2500);
  return { ctx, p, errs };
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    const { ctx, p, errs } = await boot(b);

    console.log('\n— the commissioner sees it, at the bottom of the table —');
    ok(await p.locator('#st-share').count() === 1, 'the share button is on the standings screen');
    const box = await p.locator('#st-share').boundingBox();
    ok(box && box.height >= 56, `and clears the 56px tap floor (${box && Math.round(box.height)}px)`);
    ok(/share/i.test(await p.locator('#st-share').innerText()), 'it says what it does');
    // Once-ever / once-a-week controls go LAST — the v52 rule.
    const order = await p.evaluate(() => {
      const t = document.querySelector('#s-standings .st');
      const s = document.querySelector('#st-share');
      return t && s ? (t.getBoundingClientRect().top < s.getBoundingClientRect().top) : null;
    });
    ok(order === true, 'and sits below the table, not above it');

    console.log('\n— the card says the right things —');
    const d = await p.evaluate(() => shareCardData());
    ok(d && d.week > 0, `there is a completed week to report (week ${d && d.week})`);
    ok(d.top.length > 0 && d.top.length <= 5, `top ${d.top.length}, never more than five`);
    ok(d.top[0].rank === 1, 'it starts at rank 1');
    ok(d.top.every((r, i, a) => !i || r.rank >= a[i - 1].rank), 'ranks never go backwards');
    ok(d.top.every((r) => r.name && r.rec && r.pts), 'every row carries a name, a record and points');
    // The card must agree with the screen it was launched from.
    const live = await p.evaluate(() => standings(S.games).slice(0, 5).map((r) => r.p.display_name));
    ok(JSON.stringify(d.top.map((r) => r.name)) === JSON.stringify(live),
      'and lists exactly who the standings table lists, in the same order');
    ok(/week \d+/i.test(d.sub), `it names the week it is current to ("${d.sub}")`);
    ok(!/\[object |undefined|NaN/.test(JSON.stringify(d)), 'nothing rendered as [object …], undefined or NaN');

    console.log('\n— the standout is a real, settled win —');
    if (d.standout) {
      ok(/^Won by \d+$/.test(d.standout.verdict), `the verdict is a margin ("${d.standout.verdict}")`);
      ok(/^Took the /.test(d.standout.line), `and names the team ("${d.standout.line}")`);
      // v24: the margin and the score are separate lines, and the score names
      // both teams — "Won by 28 — 37-9" read as one run of numbers.
      ok(d.standout.score === '' || /\w+ \d+, \w+ \d+/.test(d.standout.score),
        `the score names both teams ("${d.standout.score}")`);
      ok(!d.standout.verdict.includes(d.standout.score), 'the verdict and the score are never one string');
      const real = await p.evaluate((wk) => {
        const w = weeklyWinners().find((x) => x.week === wk);
        return w ? { name: w.p.display_name, margin: w.margin } : null;
      }, d.week);
      ok(real && d.standout.name === real.name, `it is the week's actual best result (${real && real.name})`);
      ok(real && d.standout.verdict === `Won by ${real.margin}`, 'with the margin the app computed');
    } else {
      ok(true, 'no standout this week, and the block is dropped rather than faked');
    }

    console.log('\n— 🚨 it can never carry a hidden pick —');
    const leak = await p.evaluate(() => {
      const wk = lastCompleteWeek(S.games);
      const games = S.games[wk] || [];
      return {
        allFinal: games.length > 0 && games.every((g) => g.state === 'post'),
        allVisible: S.picks.filter((x) => x.week === wk).every((x) => pickVisible(x.team, games)),
        // Any team picked for the CURRENT week that has not kicked off yet.
        secret: S.picks.filter((x) => x.week === S.week && !pickVisible(x.team, S.games[S.week] || []))
          .map((x) => teamShort(x.team)),
      };
    });
    ok(leak.allFinal, 'every game in the reported week is final');
    ok(leak.allVisible, 'so every pick in it is already public under house rule 3');
    const blob = JSON.stringify(d);
    const hit = leak.secret.filter((t) => blob.includes(t));
    ok(hit.length === 0, `no unstarted pick appears on the card (${leak.secret.length} secret this week, 0 leaked)`);

    console.log('\n— 🚨 the canvas is not tainted, and really makes a PNG —');
    const png = await p.evaluate(async () => {
      await cardFontsReady();
      const c = drawShareCard(shareCardData());
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const buf = new Uint8Array(await blob.arrayBuffer());
      return { w: c.width, h: c.height, bytes: blob.size, type: blob.type,
               sig: [...buf.slice(0, 8)].join(','), corner: c.getContext('2d').getImageData(2, 2, 1, 1).data.join(',') };
    });
    ok(png.w === 1080 && png.h === 1350, `1080x1350 (${png.w}x${png.h})`);
    ok(png.type === 'image/png', 'a real image/png blob');
    // The PNG magic number. toBlob on a tainted canvas throws instead.
    ok(png.sig === '137,80,78,71,13,10,26,10', 'with the PNG signature — the canvas was never tainted');
    ok(png.bytes > 12000, `and real content, not a blank frame (${Math.round(png.bytes / 1024)}KB)`);
    // getImageData on a tainted canvas throws too, so reaching this is proof.
    ok(png.corner.startsWith('22,48,31'), `the band is painted at the top-left (${png.corner})`);

    console.log('\n— 🚨 the transcribed gold matches the live tokens —');
    const gold = await p.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const stops = (v) => (v.match(/#[0-9a-f]{6}/gi) || []).map((x) => x.toLowerCase());
      return { css: stops(cs.getPropertyValue('--grad')), card: CARD_GOLD.map((x) => x.toLowerCase()),
               cssPos: stops(cs.getPropertyValue('--grad-pos')), cardPos: CARD_GREEN.map((x) => x.toLowerCase()) };
    });
    ok(JSON.stringify(gold.css) === JSON.stringify(gold.card),
      `the card's gold is --grad, stop for stop (${gold.card.join(' ')})`);
    ok(JSON.stringify(gold.cssPos) === JSON.stringify(gold.cardPos),
      'and its green is --grad-pos, stop for stop');
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();

    console.log('\n— 🚨 a relative never sees it —');
    const r2 = await boot(b);
    const gone = await r2.p.evaluate(async () => {
      // Become somebody who is not the commissioner, the way the app does.
      const other = S.players.find((x) => !x.is_admin);
      const tok = await S.store.tokenFor(S.me.token, other.id);
      localStorage.setItem(meKey(), tok);
      location.search = `?u=${tok}&demo=1`;
      return other.display_name;
    });
    await r2.p.waitForTimeout(2500);
    await r2.p.click('.tab[data-screen="standings"]'); await r2.p.waitForTimeout(2000);
    const who = await r2.p.evaluate(() => ({ me: S.me.display_name, admin: !!S.me.is_admin }));
    ok(who.admin === false, `signed in as ${who.me}, who is not an admin`);
    ok(await r2.p.locator('#st-share').count() === 0, 'and the share button does not exist for them');
    ok(await r2.p.locator('#tab-admin:not([hidden])').count() === 0, 'nor does the Admin tab, as a control');
    await r2.ctx.close();

    console.log('\n— 🚨 before any week has finished, which is where the real league is TODAY —');
    /* The owner's league is at week 1 with nothing complete, so this is the
       FIRST state he will meet, not an edge case. An empty card, or a card
       claiming "after week 0", would be the thing he sees first. */
    const r3 = await boot(b);
    await r3.p.evaluate(() => { S.games = {}; });   // no week can be complete
    const empty = await r3.p.evaluate(() => shareCardData());
    ok(empty === null, 'there is no card to build, and the code says so rather than guessing');
    await r3.p.click('.tab[data-screen="standings"]'); await sleep(600);
    await r3.p.evaluate(() => { S.games = {}; render(); });
    await sleep(300);
    await r3.p.click('#st-share'); await sleep(600);
    const msg = await r3.p.evaluate(() => (document.querySelector('#s-standings .msg') || {}).innerText || '');
    ok(/no week has finished/i.test(msg), `it explains why instead of failing silently ("${msg.trim().slice(0, 70)}")`);
    ok(!/error|undefined|null/i.test(msg), 'and the message is a sentence, not a symptom');
    ok(r3.errs.length === 0, 'and nothing threw' + (r3.errs.length ? ': ' + r3.errs[0] : ''));
    await r3.ctx.close();

    console.log('\n— it fits, and nothing under the type floor —');
    for (const w of [320, 390]) {
      for (const big of [false, true]) {
        const r = await boot(b, w); const pp = r.p;
        if (big) { await pp.click('#big-btn'); await sleep(400); }
        const m = await pp.evaluate(() => {
          const n = document.querySelector('.sharecard');
          if (!n) return null;
          const small = [...n.querySelectorAll('*')].filter((e) => e.textContent.trim() && e.offsetParent)
            .map((e) => [e.className || e.tagName, parseFloat(getComputedStyle(e).fontSize)])
            .filter(([, f]) => f < 15.5);
          return { doc: document.documentElement.scrollWidth, vw: innerWidth,
                   right: n.getBoundingClientRect().right, small };
        });
        ok(m && m.doc <= m.vw, `@${w}${big ? '/big' : ''}: no sideways scroll (${m && m.doc} <= ${m && m.vw})`);
        ok(m && m.right <= m.vw + 1, `@${w}${big ? '/big' : ''}: the card sits inside the phone`);
        ok(m && m.small.length === 0,
          `@${w}${big ? '/big' : ''}: nothing under 15.5px${m && m.small.length ? ' — ' + JSON.stringify(m.small) : ''}`);
        await r.ctx.close();
      }
    }
  } catch (e) { fail++; console.log('  ✗ threw: ' + e.message); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
