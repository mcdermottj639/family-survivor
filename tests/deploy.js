/* ⚠️ This suite deliberately uses the REAL playwright, not tests/_pw.js:
   it is about which store the app chooses and what a stranded link shows,
   so a shim that forces demo mode would test the opposite of the point.
   It stubs Supabase instead (tests/_fakesupa.js), because since the league
   went live the app is CONFIGURED — the "unconfigured app" this suite was
   originally written against is a state it can no longer be in. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});

 // A live league with two people in it, answered by the stub.
 const db=fake.makeDB();
 fake.rpc(db,'admin_add_player',{p_admin_token:'bootstrap',p_name:'Jack'});
 fake.rpc(db,'admin_add_player',{p_admin_token:db.players[0].token,p_name:'Nana'});

 console.log('\n— a relative whose link got mangled by a text message —');
 const N=await b.newContext({viewport:{width:390,height:844}}); await fake.attach(N,db);
 const n=await N.newPage();
 const errs=[]; n.on('pageerror',e=>errs.push(e.message));
 await n.goto('http://127.0.0.1:8099/?u=nana-abc123',{waitUntil:'networkidle'});
 await n.waitForTimeout(900);
 const txt=await n.locator('#s-pick').innerText();
 ok(/link isn't working/i.test(txt),'she is told the link is not working');
 ok(!/start the league/i.test(txt),'she is NOT invited to start her own league');
 ok(await n.locator('#first-go').count()===0,'and there is no way for her to create one by accident');
 ok(/ask jack/i.test(txt),'she is told who to ask');
 ok(/nothing is wrong with your phone/i.test(txt),'and reassured it is not her fault');
 ok(await n.locator('#tabs').isHidden(),'no tabs to wander into');

 console.log('\n— arriving with no link at all, now the league is live —');
 const L=await b.newContext({viewport:{width:390,height:844}}); await fake.attach(L,db);
 const l=await L.newPage();
 await l.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle'}); await l.waitForTimeout(900);
 // 🚨 This assertion is INVERTED from what it was, deliberately. Setup used
 // to be offered here because no league existed. One does now, so offering
 // "start the league" would let a relative create a second, empty one and
 // strand themselves in it. They get the roster to tap instead.
 ok(await l.locator('#first-go').count()===0,'setup is NOT offered — a league already exists');
 ok(await l.locator('.namebtn').count()>=2,`she is offered the roster to tap (${await l.locator('.namebtn').count()} names)`);
 await L.close();

 console.log('\n— the admin screen says the paste box is device-only —');
 const A=await b.newContext();
 await A.addInitScript(()=>{try{localStorage.setItem('survivor:demo','1');}catch(e){}});
 const a=await A.newPage();
 await a.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle'});
 await a.click('#first-demo'); await a.waitForSelector('#tabs:not([hidden])');
 await a.click('.tab[data-screen="admin"]'); await a.waitForTimeout(300);
 const boxes=await a.locator('#s-admin .warnbox').count();
 ok(boxes>=2,`both warnings present (not-shared + device-only): ${boxes}`);
 const adm=await a.locator('#s-admin').innerText();
 ok(/only configures THIS phone/i.test(adm),'it says saving configures only this phone');
 ok(/survivor\.js/i.test(adm),'and names the file the values must go into');

 console.log('\n— the deploy snippet —');
 await a.fill('#sb-url','https://demo.supabase.co/');
 await a.fill('#sb-key','anon-key-123');
 await A.grantPermissions(['clipboard-read','clipboard-write']);
 await a.click('#sb-copycfg'); await a.waitForTimeout(400);
 const clip=await a.evaluate(()=>navigator.clipboard.readText().catch(()=>''));
 ok(/let SUPABASE_URL = 'https:\/\/demo\.supabase\.co';/.test(clip),'snippet has the URL line, trailing slash stripped');
 ok(/let SUPABASE_KEY = 'anon-key-123';/.test(clip),'snippet has the key line');
 ok(clip.split('\n').length===2,'exactly two lines, ready to paste');

 console.log('\n— and the shipped file really does carry them —');
 // ⚠️ This used to patch the two EMPTY constants and re-read the file. They
 // are not empty any more — the league is live — so that replace silently
 // became a no-op and the check failed against a correct file. Assert the
 // real thing instead: what ships must carry a real project URL and the
 // ANON key. That a fresh device then boots into cloud mode off the file
 // alone is proved for real in tests/cloud.js, against a stubbed backend.
 const fs=require('fs');
 const src=fs.readFileSync(require('path').join(__dirname,'..','survivor.js'),'utf8').slice(0,4000);
 const url=(src.match(/let SUPABASE_URL = '([^']*)'/)||[])[1];
 const key=(src.match(/let SUPABASE_KEY = '([^']*)'/)||[])[1];
 ok(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||''),`the file carries a real project URL (${url})`);
 ok((key||'').length>100,'and a key');
 let role=null; try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64').toString()).role;}catch(e){}
 ok(role==='anon',`which is the ANON key, never service_role (role: ${role})`);

 ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
 console.log(`\n${pass} passed, ${fail} failed\n`);
 await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
