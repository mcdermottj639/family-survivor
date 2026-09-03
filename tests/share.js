const { chromium } = require('./_pw');
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage();
 const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle'});
 await page.click('#first-demo'); await page.waitForSelector('#tabs:not([hidden])');
 await page.click('.tab[data-screen="admin"]'); await page.waitForTimeout(300);

 /* 🚨 TWO DIFFERENT STATES, and they used to be told apart wrongly.
    This page has the demo ON and the league IS configured (the constants
    have been in the file since v46). Demo forces LocalStore, so isShared()
    is false — but "no league exists" is a different claim, and the Admin
    screen was making it. Asserting the red warning HERE is what let that
    ship, so the two are now tested where each is actually true. */
 console.log('\n— demo mode does not claim the live league is missing —');
 const adm=await page.locator('#s-admin').innerText();
 ok(!/do not send links/i.test(adm),'no "not shared yet" warning when a league IS configured');
 ok(/in the demo season/i.test(adm),'it names the demo as what you are looking at');
 ok(await page.locator('#ad-demo-off').count()===1,'and offers a way back to the real league');
 ok(await page.evaluate(()=>isShared())===false,'isShared() still reports false — the demo is on-device');
 ok(await page.evaluate(()=>leagueConfigured())===true,'but leagueConfigured() reports true — the league exists');

 console.log('\n— and with NO league configured, device-only mode is unmissable —');
 {
  const U=await b.newContext({viewport:{width:390,height:844}});
  await U.addInitScript(()=>{try{localStorage.setItem('survivor:demo','1');}catch(e){}});
  // The only honest way to reach the state this section is about: an app
  // whose two constants are empty, as it shipped before the league went live.
  await U.route('**/survivor.js*',async r=>{
    const res=await r.fetch(); const t=(await res.text())
      .replace(/^let SUPABASE_URL = '[^']*';/m,"let SUPABASE_URL = '';")
      .replace(/^let SUPABASE_KEY = '[^']*';/m,"let SUPABASE_KEY = '';");
    await r.fulfill({status:200,contentType:'application/javascript',body:t});
  });
  const u=await U.newPage();
  await u.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle'});
  await u.click('#first-demo'); await u.waitForSelector('#tabs:not([hidden])');
  await u.click('.tab[data-screen="admin"]'); await u.waitForTimeout(300);
  ok(await u.locator('#s-admin .warnbox').count()>=1,'a red warning box, not a quiet note');
  const w=await u.locator('#s-admin .warnbox').first().innerText();
  ok(/do not send links/i.test(w),'it says plainly: do not send links');
  ok(/none of it will reach you/i.test(w),'and explains the consequence');
  ok(await u.evaluate(()=>leagueConfigured())===false,'leagueConfigured() reports false');
  await U.close();
 }

 console.log('\n— the copy buttons refuse to hand out dead links —');
 let dialog=null;
 page.on('dialog',async d=>{dialog=d.message();await d.dismiss();});
 await page.click('#ad-copyjoin'); await page.waitForTimeout(300);
 ok(dialog&&/NOT connected/i.test(dialog),'copying the league link warns first');
 ok(/would open an empty app/i.test(dialog||''),'and says what the recipient would actually see');
 ok(await page.locator('[data-copy]').count()===0,'per-person private links are gone — Put back on list covers that case');
 ok(await page.locator('#ad-copyall').count()===0,'and so is the bulk copy from the old design');

 console.log('\n— the setup steps are actually present —');
 /* ⚠️ Folded into a <details> once a league exists, and a closed one has no
    innerText — so open it before measuring, or this section would quietly
    measure an empty string. */
 ok(await page.locator('#s-admin .setupfold').count()===1,'the setup section is folded away once it is done');
 ok(await page.evaluate(()=>document.querySelector('#s-admin .setupfold').open)===false,'and starts shut');
 await page.evaluate(()=>{document.querySelector('#s-admin .setupfold').open=true;});
 const steps=await page.locator('#s-admin .steps:not(.demo-guide)').innerText();
 ok(/supabase\.com/i.test(steps),'names where to make the project');
 ok(/schema\.sql/i.test(steps),'tells you to run schema.sql');
 ok(/admin_add_player\('bootstrap'/.test(steps),'gives the exact commissioner-seed SQL');
 ok(/anon/i.test(steps),'tells you which key to copy');
 const n=await page.locator('#s-admin .steps:not(.demo-guide) li').count();
 ok(n===5,`five numbered steps (${n})`);

 console.log('\n— demo mode overrides the config, whichever way round —');
 // 🚨 The rule that keeps a demo from reaching the real league: demo mode is
 // ALWAYS on-device, even with a URL and key present. Without this, "Load a
 // demo family" would put 18 invented relatives into the actual roster.
 await page.evaluate(()=>{localStorage.setItem('survivor:sb',JSON.stringify({url:'https://example.supabase.co',key:'test-key'}));});
 await page.reload({waitUntil:'domcontentloaded'}); await page.waitForTimeout(1200);
 ok(await page.evaluate(()=>S.store&&S.store.kind)==='local','a configured league is still on-device while demo is on');
 ok(await page.evaluate(()=>isShared())===false,'and isShared() says so');

 console.log('\n— with demo off, a URL+key flips everything —');
 /* ⚠️ The URL is the AUTHORITY on mode now (it has to be, or a Home Screen
    icon could never carry one), so poking localStorage and reloading is no
    longer how you leave the demo — applyModeFromURL would put it straight
    back. Navigate, which is what every control in the app does via goMode(). */
 await page.goto("http://127.0.0.1:8099/?demo=0",{waitUntil:"domcontentloaded"}); await page.waitForTimeout(1500);
 const mode=await page.evaluate(()=>({kind:S.store&&S.store.kind, shared:typeof isShared==='function'?isShared():null}));
 ok(mode.kind==='cloud','with a URL+key it uses the Supabase store');
 ok(mode.shared===true,'and isShared() reports true');
 await page.evaluate(()=>{localStorage.removeItem('survivor:sb');localStorage.setItem('survivor:demo','1');});

 ok(errs.length===0,'no page errors'+(errs.length?': '+errs[0]:''));
 console.log(`\n${pass} passed, ${fail} failed\n`);
 await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
