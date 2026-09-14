const { chromium } = require('./_pw');
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844},timezoneId:'America/New_York'});
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 try {
 await p.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle'});
 if (await p.locator('#first-demo').count()) { await p.click('#first-demo'); await p.waitForSelector('#tabs:not([hidden])'); }
 await sleep(1600);
 await p.click('.tab[data-screen="stats"]'); await sleep(1600);

 console.log('\n— head to head is gone —');
 const txt=await p.locator('#s-stats').innerText();
 ok(!/head to head/i.test(txt),'no "Head to head" heading');
 ok(await p.locator('#h2h-a, #h2h-b, #h2h-out').count()===0,'and none of its controls remain');
 const src=require('fs').readFileSync('/home/user/family-survivor/survivor.js','utf8');
 ok(!/headToHead|paintH2H|h2h-/.test(src),'no dead code left behind either');
 ok(!/\.h2h/.test(require('fs').readFileSync('/home/user/family-survivor/survivor.css','utf8')),'nor its CSS');

 console.log('\n— the crowd card is there and says something —');
 ok(/with the crowd, or against it/i.test(txt),'the new heading is up');
 ok(await p.locator('.cw-row:not(.cw-hd)').count()>0,`${await p.locator('.cw-row:not(.cw-hd)').count()} people listed`);
 const head=(await p.locator('.cw-head').innerText()).trim();
 console.log('    '+head.replace(/\n/g,' | '));
 ok(/most-picked team has won \d+ of \d+ week/i.test(head),'it states the most-picked team\'s record');
 ok(/paid off|exactly even/i.test(head),'and tells you what that means');
 /* 🚨 v72: the record alone is the scoreline with the news left out. The card
    must NAME the team and say how many were on it. */
 const last=await p.locator('.cw-last').innerText();
 const lastOK=await p.evaluate(()=>{
   const L=crowdStats().latest; if(!L) return {none:true};
   const t=document.querySelector('.cw-last').innerText;
   return { team:teamShort(L.team), n:L.n, total:L.total,
     named:t.includes(teamShort(L.team)), split:t.includes(`${L.n} of ${L.total}`),
     result:/won by \d+|lost by \d+|tied/.test(t), wk:t.includes(`Week ${L.wk}`) };
 });
 ok(lastOK.none||lastOK.named,`the latest week NAMES the team (${lastOK.team})`);
 ok(lastOK.none||lastOK.split,`and says how many were on it (${lastOK.n} of ${lastOK.total})`);
 ok(lastOK.none||lastOK.wk,'and which week it was');
 ok(lastOK.none||lastOK.result,`and how it finished ("${last.trim()}")`);
 const key=await p.locator('.cw-key').innerText();
 ok(/on your pick/i.test(key),'the key says what the two columns are');
 ok(key.length<=110,`and stays a footnote, not a lecture (${key.length} chars)`);

 console.log('\n— the numbers hold up —');
 const chk=await p.evaluate(()=>{
   const c=crowdStats();
   const rows=[...document.querySelectorAll('.cw-row:not(.cw-hd)')].map(r=>({
     nm:r.querySelector('.cw-nm').innerText.replace(/\s*\(you\)$/,'').trim(),
     v:r.querySelector('.cw-v').innerText.trim(),
     on:+(r.querySelector('.cw-v').innerText.match(/^(\d+)/)||[0,0])[1],
     bar:parseFloat(r.querySelector('.cw-bar i').style.width)||0,
     solo:r.querySelector('.cw-s').innerText.trim(),
   }));
   return { c:{weeks:c.weeks.length, packed:c.packed.length, w:c.crowdW, l:c.crowdL, t:c.crowdT, per:c.per.length},
     rows, players:S.players.length,
     model:c.per.map(x=>({nm:x.pl.display_name, v:`${Math.round(x.avgOn)} of ${Math.round(x.avgTot)}`,
       solo:x.off?`${x.aw}-${x.al}`:'—', played:x.played, share:x.share,
       sum:x.withN+x.off, packN:x.packN, avgOn:x.avgOn})) };
 });
 ok(chk.c.weeks>0,`${chk.c.weeks} settled weeks had enough picks to count`);
 // ⚠️ A tie is a real outcome here (house rule 6), so W+L does NOT have to
 // equal the week count — the card names the tied weeks separately.
 ok(chk.c.w+chk.c.l+chk.c.t===chk.c.packed,`every week with a pack is a win, a loss or a tie (${chk.c.w}/${chk.c.l}/${chk.c.t} of ${chk.c.packed})`);
 ok(chk.c.packed<=chk.c.weeks,'a week with no clear favourite still counts for crowding, just not for the record');
 if (chk.c.t) ok(new RegExp(`tied ${chk.c.t}`).test(head),`and the ${chk.c.t} tied weeks are named, not silently dropped`);
 ok(chk.rows.length===chk.model.length,'a row per person with picks');
 const bad=chk.rows.filter((r,i)=>r.nm!==chk.model[i].nm||r.v!==chk.model[i].v||r.solo!==chk.model[i].solo);
 ok(bad.length===0,'every rendered row matches the model'+(bad.length?': '+JSON.stringify(bad[0]):''));
 ok(chk.model.every(m=>m.sum===m.packN),'with-the-pack plus away-from-it equals the weeks that HAD a pack');
 // 🚨 You are always on your own pick, so the headcount can never be 0 — and
 // it can never exceed the number of people in the league.
 ok(chk.model.every(m=>m.avgOn>=1),'nobody is reported as having nobody on their pick');
 ok(chk.rows.every(r=>r.on>=1&&r.on<=chk.players),`no headcount outside 1..${chk.players}`);
 ok(chk.rows[0].on<=chk.rows[chk.rows.length-1].on,'sorted least company first');
 const hd=await p.locator('.cw-hd').innerText();
 ok(/on your pick/i.test(hd)&&/off the pack/i.test(hd),'both columns are labelled: "'+hd.replace(/\n/g,' / ')+'"');
 ok(!/on your own/i.test(await p.locator('.cw-list').innerText()),'and nothing claims "on your own"');
 ok(!/%/.test(await p.locator('.cw-list').innerText()),'no percentages — counts, because five weeks is not a percentage');


 /* 🚨 THE BUG THIS CARD SHIPPED WITH, REPRODUCED (v72).
    Week 1 of the real league: six of the family took the Chargers and lost,
    FIVE took the Jaguars together and won, the rest scattered. The old card
    called all five of the Jaguars backers "on your own". The demo cannot
    express this — its weeks do not split 6-5 — so the week is rebuilt here.
    A fixture that cannot express the failure cannot test the fix. */
 console.log('\n— six one way, five the other: nobody who had company is called alone —');
 const split=await p.evaluate(()=>{
   /* ⚠️ NOT S.liveWeek: the demo's current week has one final and three games
      still being played, so there is almost nothing to grade. Walk back to a
      week that is actually settled. */
   const isFinal=(g)=>g.state==='post'&&g.home.score!=null&&g.away.score!=null;
   const wk=Object.keys(S.games).map(Number).sort((a,b)=>b-a)
     .find(w=>(S.games[w]||[]).filter(isFinal).length>=3);
   if (!wk) return {skip:true};
   const games=S.games[wk]||[];
   const finals=games.filter(isFinal);
   const winner=(g)=>g.home.score>g.away.score?g.home.abbr:g.away.abbr;
   const loser=(g)=>g.home.score>g.away.score?g.away.abbr:g.home.abbr;
   const packTeam=loser(finals[0]), rivalTeam=winner(finals[1]);
   if (packTeam===rivalTeam) return {skip:true};
   const others=finals.slice(2).map(winner);
   const ps=S.players.slice(0,15);
   // This ONE week is the whole season for the duration of the check.
   for (const k of Object.keys(S.games)) if (+k!==wk) delete S.games[k];
   S.picks=[];
   ps.forEach((pl,i)=>S.picks.push({ player_id:pl.id, week:wk,
     team: i<6?packTeam : i<11?rivalTeam : others[(i-11)%others.length], kickoff:null }));
   render();
   const c=crowdStats();
   const row=(id)=>{
     const r=[...document.querySelectorAll('.cw-row:not(.cw-hd)')]
       .find(e=>e.querySelector('.cw-nm').innerText.replace(/\s*\(you\)$/,'').trim()===
                S.players.find(x=>x.id===id).display_name);
     return r?r.querySelector('.cw-v').innerText.trim():null;
   };
   return { packTeam, rivalTeam, total:c.weeks[0].total,
     crowd:c.weeks[0].team, crowdN:c.weeks[0].n,
     packRow:row(ps[0].id), rivalRow:row(ps[6].id), loneRow:row(ps[12].id),
     card:document.querySelector('#s-stats').innerText,
     lastLine:document.querySelector('.cw-last').innerText.trim() };
 });
 if (split.skip) { ok(false,'could not build the 6-5 split — the fixture has too few finals'); }
 else {
   ok(split.crowd===split.packTeam&&split.crowdN===6,`the pack is the six who took the ${split.packTeam}`);
   ok(split.packRow===`6 of ${split.total}`,`one of the six reads "${split.packRow}"`);
   // 🚨 The whole point: five people on one team are FIVE, not one.
   ok(split.rivalRow===`5 of ${split.total}`,`one of the five reads "${split.rivalRow}" — not "on your own"`);
   ok(split.loneRow===`1 of ${split.total}`,`somebody genuinely alone reads "${split.loneRow}"`);
   ok(!/on your own/i.test(split.card),'the words "on your own" appear nowhere on the card');
   ok(split.lastLine.includes(`6 of ${split.total} took the`),`the headline states the split: "${split.lastLine}"`);
 }

 /* A week where everybody picks a different team has no pack at all. It still
    counts for crowding — every pick still had a headcount of one — but it
    contributes nothing to the most-picked team's record. */
 console.log('\n— a week with no favourite counts for one thing and not the other —');
 const nopack=await p.evaluate(()=>{
   const isFinal=(g)=>g.state==='post'&&g.home.score!=null&&g.away.score!=null;
   const wk=Object.keys(S.games).map(Number).sort((a,b)=>b-a)
     .find(w=>(S.games[w]||[]).filter(isFinal).length>=3);
   const teams=(S.games[wk]||[]).filter(isFinal).map(g=>g.home.abbr);
   const ps=S.players.slice(0,Math.min(teams.length,6));
   for (const k of Object.keys(S.games)) if (+k!==wk) delete S.games[k];
   S.picks=[];
   ps.forEach((pl,i)=>S.picks.push({ player_id:pl.id, week:wk, team:teams[i], kickoff:null }));
   render();
   const c=crowdStats();
   return { weeks:c.weeks.length, packed:c.packed.length, per:c.per.length,
     ones:c.per.every(r=>Math.round(r.avgOn)===1), latest:c.latest };
 });
 ok(nopack.weeks>=1,'the week still counts for crowding');
 ok(nopack.packed===0,'but there is no pack, so no record is claimed');
 ok(nopack.ones,'and everybody is reported as the only one on their pick');
 ok(/no week has had a clear favourite/i.test(await p.locator('.cw-head').innerText()),
    'the card says so in words rather than printing "0 of 0"');
 await p.reload({waitUntil:'networkidle'}); await sleep(1600);
 await p.click('.tab[data-screen="stats"]'); await sleep(1400);

 /* ⚠️ "6 of 15" is wider than "0 of 1" was, and Bigger Text is the size this
    app exists for. A fixed track left the bar nothing to draw in. */
 console.log('\n— it still fits at 320px with Bigger Text —');
 await p.setViewportSize({width:320,height:720});
 await p.evaluate(()=>{ document.documentElement.setAttribute('data-big','1'); });
 await sleep(500);
 const tight=await p.evaluate(()=>({
   doc:document.documentElement.scrollWidth<=window.innerWidth,
   bar:Math.min(...[...document.querySelectorAll('.cw-bar')].map(e=>e.getBoundingClientRect().width)),
   clip:[...document.querySelectorAll('.cw-row *')].filter(e=>e.scrollWidth>e.clientWidth+1).length,
 }));
 ok(tight.doc,'no sideways scroll at 320 in Bigger Text');
 ok(tight.bar>=20,`the bar still has room to draw (${Math.round(tight.bar)}px)`);
 ok(tight.clip===0,'and nothing clips');
 await p.evaluate(()=>{ document.documentElement.removeAttribute('data-big'); });
 await p.setViewportSize({width:390,height:844}); await sleep(400);

 console.log('\n— it can never leak a hidden pick —');
 ok(/pickVisible/.test(src.split('function crowdStats')[1].split('function ')[0]),'crowdStats filters through pickVisible');
 const leak=await p.evaluate(()=>{
   // hide every pick of the newest week, then confirm that week stops counting
   const wk=S.liveWeek; const before=crowdStats().weeks.length;
   const saved=(S.games[wk]||[]).map(g=>g.state);
   (S.games[wk]||[]).forEach(g=>{g.state='pre';});
   const after=crowdStats().weeks.length;
   (S.games[wk]||[]).forEach((g,i)=>{g.state=saved[i];});
   return { before, after };
 });
 ok(leak.after<=leak.before,`a week whose games have not kicked off is not counted (${leak.before} -> ${leak.after})`);

 console.log('\n— it fits —');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no sideways scroll');
 const clip=await p.evaluate(()=>[...document.querySelectorAll('.cw-row *')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.innerText).slice(0,3));
 ok(clip.length===0,'nothing clips'+(clip.length?': '+clip.join(', '):''));
 const small=await p.evaluate(()=>[...document.querySelectorAll('.cw-row *, .cw-head *')].filter(e=>{
   const t=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
   return t && parseFloat(getComputedStyle(e).fontSize)<15.5;}).length);
 ok(small===0,'nothing under the 15.5px type floor');
 ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
 } finally { await b.close(); }
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
