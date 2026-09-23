const { chromium } = require('./_pw');
let pass = 0, fail = 0;
const ok = (yes, label) => { if (yes) { pass++; console.log('  ✓ ' + label); } else { fail++; console.log('  ✗ ' + label); } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.SURVIVOR_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8099/', { waitUntil: 'networkidle' });
    if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
    await p.click('.tab[data-screen="stats"]');
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'survivor.js'), 'utf8');
    ok(!/headToHead|paintH2H|h2h-/.test(source), 'obsolete head-to-head is absent');
    ok(/pickVisible/.test(source.split('function crowdStats')[1].split('function ')[0]), 'favorite model enforces pick visibility');
    ok(await p.locator('.cw-summary, .cw-weeks, .cw-members').count() === 3, 'summary, weekly list and member table render');
    const base = await p.evaluate(() => {
      const c = crowdStats();
      return { all: S.players.length, members: c.per.length, weeks: c.weeks.length,
        correct: c.crowdW + c.crowdL + c.crowdT === c.packed.length,
        lines: document.querySelectorAll('.cw-week').length,
        rows: document.querySelectorAll('.cw-row:not(.cw-hd)').length };
    });
    ok(base.all === base.members && base.rows === base.all, 'every member is listed, including inactive members');
    ok(base.lines === base.weeks && base.correct, 'all modeled completed weeks render and summary counts unique favorites');

    // Make a complete 32-team Week 1 from the actual team catalog, then vary
    // the picks. This controls ties, misses and still-running games precisely.
    const test = await p.evaluate(() => {
      const teams = ABBRS.slice();
      const games = [];
      for (let i = 0; i < teams.length; i += 2) games.push({
        state: 'post', home: { abbr: teams[i], score: 20 }, away: { abbr: teams[i + 1], score: 10 },
      });
      S.games = { 1: games }; S.picks = [];
      const players = S.players;
      const assign = (i, team) => S.picks.push({ player_id: players[i].id, week: 1, team });
      const view = () => { renderStats(); return {
        rows: [...document.querySelectorAll('.cw-row:not(.cw-hd)')],
        weekly: document.querySelector('.cw-weeks').innerText,
        summary: document.querySelector('.cw-summary').innerText,
      }; };
      const row = (rows, i) => rows.find(x => x.querySelector('.cw-nm').innerText.includes(players[i].display_name));
      // Six lose on the favorite, five win on a different shared pick;
      // a third person chooses alone, and a member has no pick.
      for (let i = 0; i < 6; i++) assign(i, teams[1]);
      for (let i = 6; i < 11; i++) assign(i, teams[2]);
      assign(11, teams[4]);
      let c = crowdStats(), v = view();
      const split = { favorite: c.weeks[0].team === teams[1] && c.weeks[0].n === 6,
        result: v.weekly.includes(teamShort(teams[1])) && /6 people picked this team/.test(v.weekly) && /Lost/.test(v.weekly),
        rival: row(v.rows, 6).querySelector('.cw-s').innerText, missed: row(v.rows, players.length - 1).querySelector('.cw-v').innerText,
        all: v.rows.length === players.length, eligible: c.per.find(x => x.pl.id === players[6].id).eligible,
        favored: row(v.rows, 0).querySelector('.cw-v').innerText,
        you: !!document.querySelector('.cw-row.you'), summary: v.summary };
      // 6–6 split: both popular teams are named and neither is attributed
      // a unique favorite or used in the member comparison.
      assign(12, teams[2]); c = crowdStats(); v = view();
      const tied = { teams: c.weeks[0].favorites.length === 2 && v.weekly.includes(teamShort(teams[1])) && v.weekly.includes(teamShort(teams[2])),
        label: /Tied for most picks/.test(v.weekly), noCount: c.packed.length === 0 && c.per.every(x => x.eligible === 0),
        dashes: v.rows.every(x => x.querySelector('.cw-v').innerText === '—') };
      S.picks = []; games[0].away.score = 20;
      for (let i = 0; i < 6; i++) assign(i, teams[0]);
      for (let i = 6; i < 11; i++) assign(i, teams[2]);
      assign(11, teams[1]);
      c = crowdStats(); v = view();
      const gameTie = { favorite: c.crowdT === 1 && /1 tie/.test(v.summary),
        other: c.per.find(x => x.pl.id === players[11].id).at === 1 && row(v.rows, 11).querySelector('.cw-s').innerText === '0–0–1 T',
        reconciliation: c.per.find(x => x.pl.id === players[11].id).off === 1 };
      assign(12, 'MISSING_TEAM');
      const missingPickGame = crowdStats().weeks.length === 0;
      S.picks.pop();
      // No game in progress may masquerade as a completed week.
      games[15].state = 'in'; const unfinished = crowdStats().weeks.length === 0;
      games[15].state = 'post'; games[15].home.score = null;
      const scoreless = crowdStats().weeks.length === 0;
      games[15].home.score = 20; S.games[1] = games.slice(0, 15);
      const missing = crowdStats().weeks.length === 0;
      S.games[1] = games; games[0].state = 'pre';
      const hidden = crowdStats().weeks.length === 0;
      return { split, tied, gameTie, missingPickGame, unfinished, scoreless, missing, hidden };
    });
    ok(test.split.favorite && test.split.result, '6–5 split names the six-person losing favorite and its result');
    ok(test.split.rival === '1–0' && test.split.eligible === 1, 'the five on another team earn an other-pick win, never called solo');
    ok(test.split.favored === '1 of 1' && test.split.missed === '—' && test.split.all, 'favorite and missed-pick member rows are honest');
    ok(test.split.you && /0 wins · 1 loss/.test(test.split.summary), 'current member is marked and the record has singular grammar');
    ok(test.tied.teams && test.tied.label && test.tied.noCount && test.tied.dashes, 'tied top teams both show; member comparisons exclude that week');
    ok(test.gameTie.favorite && test.gameTie.other && test.gameTie.reconciliation, 'tied games appear in favorite record and other-pick result');
    ok(test.missingPickGame, 'a pick whose team is missing from the feed blocks the weekly result');
    ok(test.unfinished && test.scoreless && test.missing && test.hidden, 'live, missing-score, missing-game and hidden weeks never count');
    await p.reload({ waitUntil: 'networkidle' });
    await p.click('.tab[data-screen="stats"]');
    await p.setViewportSize({ width: 320, height: 720 });
    await p.evaluate(() => document.documentElement.setAttribute('data-big', '1'));
    const fit = await p.evaluate(() => ({
      width: document.documentElement.scrollWidth <= window.innerWidth,
      clips: [...document.querySelectorAll('.cw-summary *, .cw-weeks *, .cw-members *')]
        .filter(x => x.scrollWidth > x.clientWidth + 1 && getComputedStyle(x).overflowWrap !== 'anywhere')
        .map(x => [x.className, x.innerText.slice(0, 30), x.scrollWidth, x.clientWidth]),
      tiny: [...document.querySelectorAll('.cw-summary *, .cw-weeks *, .cw-members *')]
        .filter(x => [...x.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(x).fontSize) < 18).length,
    }));
    ok(fit.width && !fit.clips.length, '320px Bigger Text has no overflow or clipped values ' + JSON.stringify(fit));
    ok(!fit.tiny, 'new Stats card has no text below 18px');
    ok(!errors.length, 'no browser errors' + (errors.length ? ': ' + errors[0] : ''));
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
