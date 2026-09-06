/* ESPN's odds payload, in BOTH shapes it is published in.
   ------------------------------------------------------------------
   ⚠️ Why this suite exists. `normOdds` is the one function in the app that
   parses live ESPN data, and until now NOTHING exercised it: every other suite
   manipulates `g.odds` AFTER normalisation, and the demo builds its own odds
   object directly. So the parser that decides whether twenty relatives see a
   win percentage at all had zero coverage, on a screen the owner has asked
   about twice (v39, v58).

   The sandbox reaches neither ESPN nor a.espncdn.com — verified again, the
   proxy answers 403 to CONNECT — so the shape can never be checked live from
   here. What CAN be pinned is that both documented shapes parse, and the
   numbers below are the real ones off the owner's own screenshot of
   NE @ SEA on 9 Sep 2026: SEA -3.5, o/u 44.5, NE +150, SEA -180.

   ⚠️ Reading only one shape is not a visible error. `hML`/`aML` come back null
   and the percentage silently falls back to the spread (a `~`) or vanishes —
   which is exactly the failure `tvFor()` already had with broadcasts, where
   ESPN publishes the channel in two shapes too. */
const { chromium } = require('./_pw');
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

// The flat scoreboard shape ESPN has served for years.
const FLAT = {
  odds: [{
    provider: { id: '58', name: 'ESPN BET', priority: 1 },
    details: 'SEA -3.5', overUnder: 44.5, spread: -3.5,
    awayTeamOdds: { favorite: false, underdog: true, moneyLine: 150 },
    homeTeamOdds: { favorite: true, underdog: false, moneyLine: -180 },
  }],
};
/* The newer shape: every price nested under current / close / open, the
   moneyline an OBJECT, its number a STRING with a leading +, the total written
   "o44.5", no `favorite` flags and no `details` string at all. */
const NESTED = {
  odds: [{
    provider: { id: '58', name: 'ESPN BET', priority: 1 },
    current: { total: { value: 44.5, displayValue: '44.5', alternateDisplayValue: 'o44.5' } },
    awayTeamOdds: {
      current: {
        moneyLine: { value: 150, displayValue: '+150', american: '+150' },
        pointSpread: { value: 3.5, displayValue: 'NE +3.5', alternateDisplayValue: '+3.5', american: '-115' },
      },
    },
    homeTeamOdds: {
      current: {
        moneyLine: { value: -180, displayValue: '-180', american: '-180' },
        pointSpread: { value: -3.5, displayValue: 'SEA -3.5', alternateDisplayValue: '-3.5', american: '-105' },
      },
    },
  }],
};
// A finished game: the price only survives under `close`.
const CLOSED = {
  odds: [{
    provider: { name: 'ESPN BET' },
    close: { total: { alternateDisplayValue: 'o44.5' } },
    awayTeamOdds: { close: { moneyLine: { american: '+150' }, pointSpread: { alternateDisplayValue: '+3.5' } } },
    homeTeamOdds: { close: { moneyLine: { american: '-180' }, pointSpread: { alternateDisplayValue: '-3.5' } } },
  }],
};

(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844},timezoneId:'America/New_York'});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 try {
 await p.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle'});
 if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
 await sleep(1200);

 const read = async (comp, label) => {
   const o = await p.evaluate((c)=>normOdds(c), comp);
   console.log(`\n— ${label} —`);
   ok(o !== null, 'the odds block parses at all');
   ok(o.hML === -180, `the home moneyline is -180 (got ${o && o.hML})`);
   ok(o.aML === 150, `the away moneyline is +150 (got ${o && o.aML})`);
   ok(o.ou === 44.5, `the total is 44.5 (got ${o && o.ou})`);
   ok(o.favBy === 3.5, `the spread is 3.5 (got ${o && o.favBy})`);
   ok(o.homeFav === true && o.awayFav === false, 'and Seattle is named the favourite');
   return o;
 };

 await read(FLAT, 'the flat scoreboard shape');
 const nested = await read(NESTED, 'the nested current/open/close shape');
 await read(CLOSED, 'a finished game, priced only under `close`');

 /* ⚠️ THE ONE THAT MATTERS. Before v61 the nested shape read
    `o.homeTeamOdds.moneyLine`, which is undefined there — `Number(undefined)`
    is NaN, so it returned null WITHOUT throwing and the app quietly dropped to
    a spread-derived `~` percentage. This is the assertion that would have
    caught it. */
 console.log('\n— a moneyline in either shape is a moneyline, never a fallback —');
 const got = await p.evaluate((o)=>{
   const g = JSON.parse(JSON.stringify((S.games[S.week]||[]).find(x=>x.state==='pre') || (S.games[S.week]||[])[0]));
   g.odds = o; g.home.abbr = 'SEA'; g.away.abbr = 'NE'; g.state = 'pre';
   const r = matchupRead(g);
   return { basis:r.basis, pHome:r.pHome, favAbbr:r.fav && r.fav.abbr, card:matchupHTML(g) };
 }, nested);
 ok(got.basis === 'moneyline', `basis is 'moneyline', not 'spread' (got '${got.basis}')`);
 ok(Math.round(got.pHome*100) === 62, `de-vigged to 62% for Seattle (got ${Math.round(got.pHome*100)}%)`);
 ok(got.favAbbr === 'SEA', 'and Seattle is the projected winner');
 ok(/on the moneyline/.test(got.card), 'the ⓘ card says the number came off the moneyline');
 ok(!/from the spread/.test(got.card), 'and never claims it came off the spread');
 ok(!/~\s*\d|>~/.test(got.card), 'no ~ anywhere on it — a ~ means a rule of thumb');

 console.log('\n— the two shapes agree, number for number —');
 const both = await p.evaluate((cs)=>cs.map(normOdds), [FLAT, NESTED, CLOSED]);
 const key = (o)=>[o.hML,o.aML,o.ou,o.favBy,o.homeFav].join('|');
 ok(key(both[0]) === key(both[1]), `flat and nested parse identically (${key(both[0])})`);
 ok(key(both[0]) === key(both[2]), 'and so does the closed-price shape');

 /* ⚠️ `pointSpread.american` is the PRICE on the spread (-110/-115), not the
    number of points. Reading it the way a moneyline is read would put a
    115-point spread on the card, which no assertion above would notice
    because it is a perfectly plausible number in the right field. */
 console.log('\n— the spread is the line, never the price on the line —');
 ok(both[1].favBy === 3.5 && Math.abs(both[1].favBy) < 60, 'a 3.5-point spread, not a 115-point one');

 console.log('\n— degrading, when there is nothing to read —');
 const empty = await p.evaluate(()=>[
   normOdds({}), normOdds({odds:[]}),
   normOdds({odds:[{provider:{name:'ESPN BET'}}]}),
   normOdds({odds:[{details:'SEA -3.5', spread:-3.5}]}),
 ]);
 ok(empty[0] === null && empty[1] === null, 'no odds block at all returns null');
 ok(empty[2] && empty[2].hML === null && empty[2].aML === null && empty[2].ou === null,
    'an empty odds block yields nulls rather than NaN');
 ok(empty[3] && empty[3].hML === null && empty[3].favBy === 3.5,
    'a spread with no moneyline keeps the spread — that is the v58 backup');

 console.log('\n— the whole event, through normGame —');
 const ng = await p.evaluate((o)=>{
   const ev = { id:'401', date:'2026-09-09T00:20Z'.replace('Z',':00Z'),
     status:{ type:{ state:'pre', shortDetail:'9/9 - 8:20 PM ET' } },
     competitions:[ Object.assign({
       competitors:[
         { homeAway:'home', score:'', team:{abbreviation:'SEA'}, records:[{type:'total',summary:'0-0'}] },
         { homeAway:'away', score:'', team:{abbreviation:'NE'},  records:[{type:'total',summary:'0-0'}] },
       ],
       geoBroadcasts:[{ media:{ shortName:'NBC' } }],
     }, o) ],
   };
   const g = normGame(ev, 1);
   return { hML:g.odds && g.odds.hML, aML:g.odds && g.odds.aML, tv:g.tv, basis:matchupRead(g).basis };
 }, NESTED);
 ok(ng.hML === -180 && ng.aML === 150, 'a whole ESPN event carries its moneylines through');
 ok(ng.tv === 'NBC', 'and its channel');
 ok(ng.basis === 'moneyline', 'and reads as a moneyline end to end');

 ok(errs.length===0, `no console errors${errs.length?': '+errs[0]:''}`);
 } catch(e) { fail++; console.log('  ✗ threw: '+e.message); }
 await b.close();
 console.log(`\n${pass} passed, ${fail} failed`);
 process.exit(fail?1:0);
})();
