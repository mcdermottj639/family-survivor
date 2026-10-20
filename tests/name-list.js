/* Commissioner list controls against a synthetic shared league and local store. */
const { chromium } = require('../node_modules/playwright-core');
const fake = require('./_fakesupa');
let pass=0,fail=0;
const ok=(c,m)=>{console.log(`  ${c?'✓':'✗'} ${m}`);c?pass++:fail++;};
const home='http://127.0.0.1:8099/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.SURVIVOR_CHROMIUM||undefined,args:['--no-sandbox']});
 try {
  const db=fake.makeDB();
  db.players=[
   {id:1,display_name:'Fixture Admin',token:'fixture-admin',is_admin:true,claimed_at:'2026-09-01'},
   {id:2,display_name:'Fixture Member',token:'fixture-member',is_admin:false,claimed_at:null},
   {id:3,display_name:'Other Member',token:'fixture-other',is_admin:false,claimed_at:'2026-09-02'}];
  db.seq=4;
  db.picks=[{player_id:2,season:2026,week:1,team:'PHI',kickoff:'2026-09-10T00:00:00Z'}];
  const pickSnapshot=JSON.stringify(db.picks);
  const identities=()=>JSON.stringify(db.players.map(({claimed_at,...p})=>p));
  const identitySnapshot=identities();
  const ctx=await browser.newContext({viewport:{width:390,height:844}});await fake.attach(ctx,db);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(home+'?u=fixture-admin',{waitUntil:'networkidle'});
  await page.click('.tab[data-screen="admin"]');
  const row=page.locator('[data-player-row="2"]');
  await row.locator('summary').click();
  ok((await row.innerText()).includes('On sign-in list'),'available name has an accurate status');
  ok(!/not joined yet|have joined so far/i.test(await page.locator('#s-admin').innerText()),'Admin does not confuse name availability with joined status');
  await page.fill('#ad-name','Keep this unfinished name');
  await page.selectOption('#ap-who','3');
  await page.click('[data-hide-name="2"]');
  await page.waitForFunction(()=>!S.nameListBusy && document.querySelector('[data-unclaim="2"]'));
  ok(!!db.players[1].claimed_at,'removing a name updates the shared list');
  ok(await row.evaluate(e=>e.open),'open member row stays open');
  ok(await page.locator('#ad-name').inputValue()==='Keep this unfinished name' && await page.locator('#ap-who').inputValue()==='3','other Admin fields survive the change');
  ok(await page.evaluate(()=>document.activeElement?.dataset.unclaim==='2'),'focus moves to the inverse action in the same row');
  ok((await page.locator('#ad-name-list-status').innerText()).includes('saved login and picks still work'),'result explains that access and picks are preserved');
  ok(JSON.stringify(db.picks)===pickSnapshot && identities()===identitySnapshot,'all saved picks and identities remain identical');
  const freshCtx=await browser.newContext();await fake.attach(freshCtx,db);
  const fresh=await freshCtx.newPage();await fresh.goto(home,{waitUntil:'networkidle'});
  ok(await fresh.locator('[data-claim="2"]').count()===0,'fresh shared link no longer offers the hidden name');
  await fresh.goto(home+'?u=fixture-member',{waitUntil:'networkidle'});
  ok((await fresh.locator('#whoami').innerText()).includes('Fixture Member'),'old personal link still opens the right account');
  ok(await fresh.locator('#tab-admin').isHidden(),'ordinary member still has no Admin access');
  await fresh.goto(home,{waitUntil:'networkidle'});
  ok((await fresh.locator('#whoami').innerText()).includes('Fixture Member'),'remembered sign-in still works through the shared link');
  await page.click('[data-unclaim="2"]');
  await page.waitForFunction(()=>!S.nameListBusy && document.querySelector('[data-hide-name="2"]'));
  ok(db.players[1].claimed_at===null,'Put back on list reverses the change');
  await fresh.evaluate(()=>localStorage.removeItem(meKey()));
  await fresh.goto(home,{waitUntil:'networkidle'});
  ok(await fresh.locator('[data-claim="2"]').isVisible(),'fresh shared link offers the name again');
  await fresh.click('[data-claim="2"]');await fresh.click('#nm-yes');
  await fresh.waitForSelector('#tabs:not([hidden])');
  await page.click('#ad-names-refresh');await page.waitForFunction(()=>!S.nameListBusy);
  ok(await row.locator('[data-unclaim="2"]').isVisible(),'refresh picks up another device completing sign-in');
  ok(await page.locator('#ad-name').inputValue()==='Keep this unfinished name','refresh preserves unfinished Admin input');
  // Reject a write. The app must retain the real state and show the failure.
  await page.click('[data-unclaim="2"]');await page.waitForFunction(()=>!S.nameListBusy);
  await ctx.route('**/rest/v1/rpc/admin_hide_name',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:'Fixture refusal'})}));
  await page.click('[data-hide-name="2"]');await page.waitForFunction(()=>!S.nameListBusy);
  ok(db.players[1].claimed_at===null && (await page.locator('#ad-name-list-status').innerText()).includes('Fixture refusal'),'refused write never claims removal succeeded');
  await ctx.unroute('**/rest/v1/rpc/admin_hide_name');
  // Simulate a committed write with a lost response; read back without replay.
  let writes=0;
  await ctx.route('**/rest/v1/rpc/admin_hide_name',async route=>{
   writes++;fake.rpc(db,'admin_hide_name',JSON.parse(route.request().postData()));await route.abort();
  });
  await page.click('[data-hide-name="2"]');await page.waitForFunction(()=>!S.nameListBusy);
  ok(writes===1 && !!db.players[1].claimed_at && await row.locator('[data-unclaim="2"]').isVisible(),'lost write response is reconciled by one read without a repeated write');
  await ctx.unroute('**/rest/v1/rpc/admin_hide_name');
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>document.documentElement.dataset.big='');
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Admin list fits ${width}px with Bigger Text`);
  }
  // Demo/local implementation uses the same preservation and permission rules.
  const local=await page.evaluate(async()=>{
   const db={players:[{id:1,display_name:'Test Admin',token:'local-admin',is_admin:true,claimed_at:'2026-09-01'},{id:2,display_name:'Test Member',token:'local-member',is_admin:false,claimed_at:null}],picks:[{player_id:2,week:1,team:'PHI',season:2026}],seq:3};
   localStorage.setItem('survivor:local',JSON.stringify(db));
   const denied=await LocalStore.hideName('local-member',2);
   const hidden=await LocalStore.hideName('local-admin',2);
   const after=JSON.parse(localStorage.getItem('survivor:local'));
   await LocalStore.unclaim('local-admin',2);
   const restored=localStorage.getItem('survivor:local')===JSON.stringify(db);
   const save=LocalStore._save;LocalStore._save=()=>false;
   const failed=await LocalStore.hideName('local-admin',2);LocalStore._save=save;
   return {denied,hidden,after,restored,failed};
  });
  ok(!local.denied.ok && local.hidden.ok && !!local.after.players[1].claimed_at,'local mode requires an admin and supports the same control');
  ok(local.after.players[1].token==='local-member' && local.after.picks[0].team==='PHI' && local.restored,'local hide/show round trip preserves credentials and picks');
  ok(!local.failed.ok,'local storage failure is reported');
  ok(errors.length===0,'no browser runtime errors');
 } finally {await browser.close();}
 console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
