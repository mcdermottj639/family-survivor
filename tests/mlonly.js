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
 await sleep(1500);
 await p.evaluate(async()=>{ S.weekPinned=true; S.week=S.liveWeek+1; await ensureWeeks([S.week]); render(); });
 await sleep(700);

 /* 🥇 v58 AMENDED v39. The owner asked for the spread as a BACKUP when no
    moneyline is posted, because a week out the books publish spreads long
    before moneylines — so "moneyline only" meant no percentages at all on
    the screen where somebody is choosing. v39's real complaint stands and is
    what this suite now enforces: the two must never be INDISTINGUISHABLE.
    The moneyline is still preferred; the spread is labelled wherever it is
    used. */
 console.log('\n— the moneyline is preferred, and the source is always named —');
 const basis=await p.evaluate(()=>{
   const gs=(S.games[S.week]||[]);
   return gs.map(g=>{const r=matchupRead(g);return {b:r.basis, p:r.pHome, s:r.homeSpread};});
 });
 ok(basis.every(x=>x.p==null||x.b==='moneyline'||x.b==='spread'),'every probability declares its source');
 ok(basis.some(x=>x.b==='moneyline'),'the demo games have moneylines, and those win');
 ok(basis.every(x=>x.b!=='moneyline'||x.p!=null),'a moneyline always yields a number');
 ok(basis.every(x=>x.p!=null||x.s==null),'and no game with a spread is left without one');

 console.log('\n— a game with a spread but NO moneyline falls back, and says so —');
 const nolm=await p.evaluate(()=>{
   const g=(S.games[S.week]||[]).find(x=>x.state==='pre');
   const keep={h:g.odds.hML,a:g.odds.aML};
   g.odds.hML=null; g.odds.aML=null;
   const r=matchupRead(g);
   const out={ fav:!!r.fav, favBy:r.favBy, p:r.pHome, basis:r.basis, hasLine:r.hasLine,
               card:matchupHTML(g) };
   g.odds.hML=keep.h; g.odds.aML=keep.a;
   return out;
 });
 ok(nolm.p!==null,'it now yields a probability from the spread');
 ok(nolm.basis==='spread',"and declares basis 'spread', never 'moneyline'");
 ok(nolm.p>0&&nolm.p<1,`a real number (${Math.round(nolm.p*100)}%)`);
 ok(nolm.fav===true&&nolm.favBy>0,`the spread still names the favourite (by ${nolm.favBy})`);
 ok(/from the spread/.test(nolm.card),'the card says the number came FROM THE SPREAD');
 ok(!/on the moneyline/.test(nolm.card),'and never claims a moneyline it does not have');
 ok(/No moneyline is posted yet/.test(nolm.card),'the read names the missing source');
 ok(/rule of thumb, not a price/.test(nolm.card),'and says plainly what kind of number it is');
 ok(/Spread/.test(nolm.card),'the Vegas line table still shows the spread');

 console.log('\n— the spread is still information, everywhere it was —');
 const pill=await p.locator('.ibtn-l').first().innerText();
 ok(/-\d/.test(pill),`the little ⓘ widget still shows the spread: "${pill}"`);
 await p.locator('.ibtn').first().click(); await sleep(500);
 const sheet=await p.locator('#sheet-body').innerText();
 ok(/Spread/.test(sheet)&&/-\d/.test(sheet),'the matchup card still lists the spread');
 ok(/Moneyline/.test(sheet),'and the moneyline beside it');
 ok(/on the moneyline/.test(sheet),'the projection names where its number came from');
 await p.click('#sheet-close'); await sleep(300);

 console.log('\n— the pick buttons agree with the card —');
 const agree=await p.evaluate(()=>{
   const out=[];
   for (const card of document.querySelectorAll('#s-pick .game:not(.started)')) {
     const g=(S.games[S.week]||[]).find(x=>x.id===card.dataset.gid) ||
             (S.games[S.week]||[]).find(x=>x.away.abbr===card.querySelector('.pk').dataset.team);
     if (!g) continue;
     const r=matchupRead(g);
     const w=[...card.querySelectorAll('.pk-win')].map(e=>+e.innerText.match(/\d+/)[0]);
     if (!w.length) { out.push({skip:true}); continue; }
     out.push({ away:w[0], home:w[1], eAway:Math.round((1-r.pHome)*100), eHome:Math.round(r.pHome*100), basis:r.basis });
   }
   return out;
 });
 const shown=agree.filter(x=>!x.skip);
 ok(shown.length>0,`${shown.length} games show a percentage`);
 ok(shown.every(x=>x.basis==='moneyline'),'every one of them is moneyline-based');
 ok(shown.every(x=>x.away===x.eAway&&x.home===x.eHome),'and each matches matchupRead exactly');

 /* 🚨 THE SAFEGUARD ITSELF: a spread-derived percentage must be visibly
    different from a moneyline one. If this ever passes silently, v39's
    complaint is back — two numbers that look identical while only one of
    them is a price somebody is taking bets at. */
 console.log('\n— a spread-derived percentage is marked with ~, a moneyline one is not —');
 const marks = await p.evaluate(async () => {
   const wk = S.games[S.week] || [];
   const before = [...document.querySelectorAll('#s-pick .pk-win')].map(x => x.innerText.trim());
   const keep = wk.map(g => ({ g, h: g.odds.hML, a: g.odds.aML }));
   wk.forEach(g => { g.odds.hML = null; g.odds.aML = null; });   // strip every moneyline
   render(); await new Promise(r => setTimeout(r, 500));
   const after = [...document.querySelectorAll('#s-pick .pk-win')].map(x => x.innerText.trim());
   keep.forEach(k => { k.g.odds.hML = k.h; k.g.odds.aML = k.a; });
   render(); await new Promise(r => setTimeout(r, 500));
   return { before, after };
 });
 ok(marks.before.length > 0, `${marks.before.length} buttons show a percentage with moneylines posted`);
 ok(marks.before.every(t => !t.startsWith('~')), 'none of them is marked ~, because they are real prices');
 ok(marks.after.length > 0, `${marks.after.length} still show one with every moneyline stripped`);
 ok(marks.after.every(t => t.startsWith('~')), 'and EVERY one of those is marked ~');
 ok(marks.after.every(t => /\d+% to win/.test(t)), `still a readable number (${marks.after[0]})`);
 const note = await p.locator('#s-pick .sub').first().innerText();
 ok(/~/.test(note) && /spread/i.test(note), 'and the note on the screen explains what ~ means');

 ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
 } finally { await b.close(); }
 console.log(`\n${pass} passed, ${fail} failed\n`);
 process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
