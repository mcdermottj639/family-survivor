/* ⚠️ These suites reach into the app's stored identity to fake a fresh phone.
   They ask the app for the KEY (`meKey()`) rather than naming one: since v50
   the demo and the real league keep their sign-ins apart — one shared key
   used to mean flipping demo mode logged you out of the other — so a
   hardcoded 'survivor:me' silently stops referring to the live one. */
const { chromium } = require('./_pw');
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
const BASE='http://127.0.0.1:8099/';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});

 // Commissioner sets the league up and adds the family's names.
 const A=await b.newContext({viewport:{width:390,height:844}}); const a=await A.newPage();
 const errs=[]; a.on('pageerror',e=>errs.push(e.message));
 await a.goto(BASE,{waitUntil:'networkidle'});
 await a.click('#first-demo'); await a.waitForSelector('#tabs:not([hidden])');
 await a.click('.tab[data-screen="admin"]'); await a.waitForTimeout(300);

 console.log('\n— the commissioner gets ONE link, not twenty —');
 ok(await a.locator('#ad-copyjoin').count()===1,'there is a single "Copy the league link" button');
 const adm=await a.locator('#s-admin').innerText();
 ok(/text this one address to the whole family/i.test(adm),'and it says to text it to everyone');
 ok(/have joined so far/i.test(adm),'with a count of who has joined');
 ok(/not joined yet/i.test(adm),'and per-person status');

 // Free up a name so there is something to claim.
 await a.evaluate(()=>{const db=JSON.parse(localStorage.getItem('survivor:local'));
   db.players.forEach((p,i)=>{p.claimed_at = i===0 ? new Date().toISOString() : null;});
   localStorage.setItem('survivor:local',JSON.stringify(db));});

 console.log('\n— a relative opens the SAME link on a fresh phone —');
 // same browser profile family so localStorage is shared, mimicking one device set
 const n=await A.newPage();
 await n.goto(BASE,{waitUntil:'networkidle'});
 await n.evaluate(()=>localStorage.removeItem(meKey()));
 await n.goto(BASE,{waitUntil:'networkidle'}); await n.waitForTimeout(600);
 const j=await n.locator('#s-pick').innerText();
 ok(/welcome/i.test(j),'she is welcomed');
 ok(/tap your name/i.test(j),'and told to tap her name');
 const names=await n.locator('.namebtn').count();
 ok(names>0,`${names} names offered as big buttons`);
 const h=await n.evaluate(()=>{const b=document.querySelector('.namebtn');return b?b.getBoundingClientRect().height:0;});
 ok(h>=64,`name buttons are ${h.toFixed(0)}px tall`);
 const claimedShown=await n.evaluate(()=>{
   const db=JSON.parse(localStorage.getItem('survivor:local'));
   const taken=db.players.filter(p=>p.claimed_at).map(p=>p.display_name);
   const shown=Array.from(document.querySelectorAll('.namebtn')).map(b=>b.innerText.trim());
   return taken.filter(t=>shown.includes(t));});
 ok(claimedShown.length===0,'names already taken are not offered again');

 console.log('\n— tapping a name signs her in, with no typing —');
 const target=await n.evaluate(()=>document.querySelector('.namebtn').innerText.trim());
 await n.click('.namebtn'); await n.waitForTimeout(350);
 ok(await n.locator('#confirm').isVisible(),'choosing a name confirms first');
 await n.click('#nm-yes'); await n.waitForTimeout(900);
 const who=await n.locator('#whoami').innerText();
 ok(new RegExp(target,'i').test(who),`signed in as ${target}: "${who.trim()}"`);
 /* ⚠️ This suite runs in DEMO mode, where the capture-ready URL is `?demo=1`
    and carries NO token on purpose: demo identities are per-device, so a
    fresh Home Screen container reseeds with new tokens and a captured
    `?u=<demo token>` would resolve to nothing. The property being asserted is
    the same either way — the address bar is something a Home Screen icon can
    usefully capture — and the live half of it is proved in homescreen.js. */
 ok(/\?demo=1/.test(n.url()) && !/\?u=|&u=/.test(n.url()),
    `the demo address bar stays capture-ready and token-free (${n.url().split('/').pop()})`);
 ok(await n.locator('#tabs').isVisible(),'and she is straight into the app');
 ok(await n.locator('#tab-admin').isHidden(),'with no admin tab');

 console.log('\n— the same name cannot be taken twice —');
 const twice=await n.evaluate(async()=>{
   const db=JSON.parse(localStorage.getItem('survivor:local'));
   const mine=db.players.find(p=>p.token===localStorage.getItem(meKey()));
   return S.store.claimPlayer(mine.id);});
 ok(twice&&twice.ok===false,`a second person tapping it is refused: "${twice.error}"`);

 console.log('\n— someone the commissioner forgot can type their name —');
 const m=await A.newPage();
 await m.goto(BASE,{waitUntil:'networkidle'});
 await m.evaluate(()=>localStorage.removeItem(meKey()));
 await m.goto(BASE,{waitUntil:'networkidle'}); await m.waitForTimeout(500);
 await m.click('.usedstrip summary'); await m.waitForTimeout(200);
 await m.fill('#join-name','Great Aunt Edna');
 await m.click('#join-go'); await m.waitForTimeout(900);
 ok(/Great Aunt Edna/i.test(await m.locator('#whoami').innerText()),'typing a new name joins the league');
 const dup=await m.evaluate(async()=>S.store.joinLeague('great aunt edna'));
 ok(dup&&dup.ok===false,'and a duplicate name is refused, case-insensitively');
 const notAdmin=await m.evaluate(()=>S.me.is_admin);
 ok(!notAdmin,'a self-joiner never gets admin');

 console.log('\n— the commissioner can undo a wrong tap —');
 // these pages share one localStorage (LocalStore = one device), so the later
 // joins overwrote survivor:me; put the commissioner back before checking.
 await a.evaluate(()=>{const db=JSON.parse(localStorage.getItem('survivor:local'));
   localStorage.setItem(meKey(), db.players.find(p=>p.is_admin).token);});
 await a.reload({waitUntil:'networkidle'}); await a.waitForTimeout(900);
 await a.click('.tab[data-screen="admin"]'); await a.waitForTimeout(300);
 ok(await a.locator('[data-unclaim]').count()>0,'claimed names have a Release button (inside their row)');
 await a.evaluate(()=>{const d=[...document.querySelectorAll('.plrow')].find(x=>x.querySelector('[data-unclaim]'));if(d)d.open=true;});
 await a.waitForTimeout(200);
 await a.click('[data-unclaim]'); await a.waitForTimeout(500);
 ok(/free again/i.test(await a.locator('#s-admin .msg').innerText()),'releasing puts the name back');

 ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
 console.log(`\n${pass} passed, ${fail} failed\n`);
 await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
