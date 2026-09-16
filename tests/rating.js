/* HOW STRONG IS A TEAM, AND WHEN ARE WE ALLOWED TO SAY? (v71)
   ------------------------------------------------------------------
   🚨 The bug this exists for could not happen in the demo, which is why ~1400
   checks never saw it. The demo opens on week 10, where every team has nine
   games and a win rate means something. On the Sunday of WEEK 1 it means
   nothing at all: the Cardinals upset the Chargers, went 1-0, and 1.000 was
   the highest number on the board — so every person in the league was told
   their best remaining team was the Cardinals. A fixture that cannot express
   the failure cannot test the fix (the DEMO_BYES lesson), so this suite
   rewrites the records in the running app to build the early-season states
   the demo will never be in. */
const { chromium } = require('./_pw');
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

/* Give every team in every loaded week the record this test wants. Anything
   not named goes to `other`, so "week 1, one game played" is one call. */
const setRecords = (p, recs, other) => p.evaluate(([recs, other]) => {
  for (const wk of Object.keys(S.games)) {
    for (const g of S.games[wk] || []) {
      for (const side of ['home', 'away']) {
        g[side].rec = recs[g[side].abbr] || other;
      }
    }
  }
  render();
}, [recs, other]);

(async()=>{
 const b=await chromium.launch({executablePath:process.env.SURVIVOR_CHROMIUM || undefined,args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844},timezoneId:'America/New_York'});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 try {
 await p.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle'});
 if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
 await sleep(1600);
 await p.click('.tab[data-screen="stats"]'); await sleep(1200);

 console.log('\n— a season in progress: the demo, where a rating is earned —');
 const mid=await p.evaluate(()=>{
   const rt=teamRatings(), st=statsFor(S.me.id);
   const used=usedTeamsVisible(S.me.id,null);
   const left=ABBRS.filter(a=>!used[a]).filter(a=>rt[a]&&rt[a].pct!=null);
   const top=left.slice().sort(byRating(rt));
   return {n:Object.keys(rt).length, minG:Math.min(...Object.values(rt).map(r=>r.n)),
     bench:st.bench, benchTop:st.benchTop, ratedLeft:st.ratedLeft,
     namedG:st.benchTop.map(a=>rt[a].n), best:top[0],
     pcts:st.benchTop.map(a=>rt[a].pct), rendered:document.querySelector('#s-stats').innerText};
 });
 ok(mid.n>=32,`every team carries a record (${mid.n})`);
 ok(mid.minG>=3,`and by week 10 every one of them has played enough (fewest: ${mid.minG})`);
 ok(mid.bench!=null&&mid.bench>0&&mid.bench<1,`so the headline is a real proportion (${(mid.bench*100).toFixed(0)}%)`);
 ok(mid.benchTop.length===3,'three teams are named as the best left');
 ok(mid.namedG.every(n=>n>=3),`and each of them has played at least 3 games (${mid.namedG.join(', ')})`);
 ok(mid.benchTop[0]===mid.best,`the first is genuinely the strongest unused team (${mid.best})`);
 ok(mid.pcts[0]>=mid.pcts[1]&&mid.pcts[1]>=mid.pcts[2],'and they are in descending order');
 ok(/best:/i.test(mid.rendered),'the row names it');
 ok(/\d+%/.test(mid.rendered),'beside a percentage');

 console.log('\n— WEEK 1: one upset, and nobody may be called the best —');
 // The owner's actual screenshot: Arizona have beaten the Chargers and
 // nothing else has been settled.
 await setRecords(p, {ARI:'1-0', LAC:'0-1'}, '0-0');
 await sleep(400);
 const wk1=await p.evaluate(()=>{
   const rt=teamRatings();
   const all=S.players.map(x=>statsFor(x.id));
   return {ari:rt.ARI, lac:rt.LAC, rated:Object.values(rt).filter(r=>r.pct!=null).length,
     bench:all.map(s=>s.bench), tops:all.map(s=>s.benchTop.length), left:all.map(s=>s.teamsLeft),
     rendered:document.querySelector('#s-stats').innerText};
 });
 ok(wk1.ari.n===1,'Arizona are 1-0');
 ok(wk1.ari.pct===null,'and they carry NO rating — one game is not a strength');
 ok(wk1.lac.pct===null,'nor do the Chargers, at 0-1');
 ok(wk1.rated===0,'nothing in the league is rated yet');
 ok(wk1.bench.every(x=>x===null),'so nobody gets a bench percentage');
 ok(wk1.tops.every(n=>n===0),'and nobody is told their best team left');
 ok(!/best:/i.test(wk1.rendered),'🚨 the row no longer says "best: Cardinals" — it says nothing');
 ok(!/\bCardinals\b/.test(wk1.rendered.split('Everyone')[1]||''),'the Cardinals appear nowhere in the list');
 ok(wk1.left.every(n=>n>0),'teams left still counts — that one is a fact, not an estimate');
 ok(/no team has played enough games yet/i.test(wk1.rendered),'and the section says WHY it is empty');

 console.log('\n— the sheet says the same thing, in the same words —');
 await p.click('.statrow'); await sleep(600);
 const sheet=await p.locator('#sheet-body').innerText();
 ok(/how strong[\s\S]{0,60}—/i.test(sheet),'"How strong" is a dash, not a number');
 ok(/no team has played enough yet/i.test(sheet),'with the reason under it');
 ok(/needs 3 games played/i.test(sheet),'and "Best left" says what it is waiting for');
 await p.click('#sheet-close'); await sleep(400);

 console.log('\n— three games is the line —');
 const gate=await p.evaluate(()=>{
   const out={};
   for (const [tag,rec] of [['two','1-1'],['three','2-1']]) {
     for (const wk of Object.keys(S.games))
       for (const g of S.games[wk]||[]) for (const s of ['home','away'])
         if (g[s].abbr===ABBRS[0]) g[s].rec=rec;
     out[tag]=teamRatings()[ABBRS[0]];
   }
   return {...out, min:RATING_MIN_G};
 });
 ok(gate.min===3,'the gate is three games');
 ok(gate.two.n===2&&gate.two.pct===null,'two games played: still no rating');
 ok(gate.three.n===3&&gate.three.pct!=null,`three games played: rated (${(gate.three.pct*100).toFixed(0)}%)`);
 ok(gate.three.pct<0.6,'and a 2-1 team is nowhere near a runaway number');

 console.log('\n— a hot start does not outrank a real season —');
 // ⚠️ On a RAW win rate the 3-0 team reads 1.000 and the 8-1 team .889, so
 // the raw answer here is exactly backwards. Byes make records this uneven
 // for most of the season, not just at the start.
 await setRecords(p, {ARI:'3-0', LAC:'8-1'}, '4-4');
 await sleep(300);
 const cmp=await p.evaluate(()=>{
   const rt=teamRatings();
   return {hot:rt.ARI.pct, real:rt.LAC.pct, mid:rt[ABBRS.find(a=>a!=='ARI'&&a!=='LAC')].pct};
 });
 ok(cmp.hot!=null&&cmp.real!=null,'both are rated');
 ok(cmp.real>cmp.hot,`8-1 (${(cmp.real*100).toFixed(0)}%) rates above 3-0 (${(cmp.hot*100).toFixed(0)}%)`);
 ok(cmp.hot>cmp.mid,'but 3-0 still beats .500 — the evidence counts, it is just not the whole story');
 ok(cmp.real<0.9,'and nothing in a 18-week season reads as a certainty');

 console.log('\n— level on record, settled by points and not by the alphabet —');
 const tie=await p.evaluate(()=>{
   // Two teams on the same record: the one with the better season points
   // difference is the stronger, whatever order the scoreboard listed them.
   for (const wk of Object.keys(S.games))
     for (const g of S.games[wk]||[]) for (const s of ['home','away']) g[s].rec='5-4';
   const rt=teamRatings();
   const a=ABBRS.filter(x=>rt[x]).sort(byRating(rt));
   const same=Object.values(rt).every(r=>r.pct===rt[a[0]].pct);
   return {same, first:a[0], last:a[a.length-1],
     dFirst:rt[a[0]].diff, dLast:rt[a[a.length-1]].diff};
 });
 ok(tie.same,'every team is level on record');
 ok(tie.dFirst>=tie.dLast,`so the differential orders them (${tie.first} ${tie.dFirst} ahead of ${tie.last} ${tie.dLast})`);
 ok(tie.dFirst!==tie.dLast,'and it is a real distinction, not a coin toss');

 console.log('\n— none of this is a way to read a hidden pick —');
 const leak=await p.evaluate(()=>{
   const wk=S.liveWeek, games=S.games[wk]||[];
   const secret=S.picks.find(x=>x.week===wk&&x.player_id!==S.me.id&&!pickVisible(x.team,games));
   if (!secret) return {none:true};
   const st=statsFor(secret.player_id);
   const vis=usedTeamsVisible(secret.player_id,null);
   return {team:secret.team, counted:!!vis[secret.team], top:st.benchTop,
     honest:ABBRS.filter(a=>!vis[a]).length, teamsLeft:st.teamsLeft};
 });
 ok(leak.none||!leak.counted,'a hidden pick is still not counted as spent');
 ok(leak.none||leak.teamsLeft===leak.honest,'so the count cannot fall by one and give it away');

 ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
 } catch(e){ fail++; console.log('  ✗ '+e.message); }
 console.log(`\n${pass} passed, ${fail} failed\n`);
 await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
