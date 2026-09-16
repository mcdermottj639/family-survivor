/* Real mobile DOM verification for approved recap C. */
const {chromium}=require('./_pw');
let pass=0,fail=0;
function ok(c,m){if(c){pass++;console.log('  ✓ '+m);}else{fail++;console.log('  ✗ '+m);}}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.SURVIVOR_CHROMIUM||undefined,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8099/?demo=1',{waitUntil:'networkidle'});
  await page.waitForSelector('#tabs:not([hidden])');
  const link=page.url();
  await page.evaluate(()=>{localStorage.removeItem(recapSeenKey());render();});
  ok(await page.locator('#s-pick .recap-notice').count()===1,'new completed week has one dismissible notice');
  ok(await page.locator('#sheet').isHidden(),'recap never interrupts with an automatic modal');
  await page.click('[data-recap-dismiss]');
  ok(await page.locator('#s-pick .recap-notice').count()===0,'Maybe later dismisses notice');
  ok(await page.locator('#s-pick .recap-entry').isVisible(),'permanent recap entry stays available');
  await page.click('#s-pick .recap-entry');
  await page.waitForSelector('#sheet:not([hidden])');
  ok((await page.locator('#sheet').getAttribute('aria-label')).includes('family recap'),'sheet announces its actual purpose');
  ok((await page.locator('.weekly-recap').innerText()).includes('Your week'),'personal result is included');
  ok(await page.locator('.weekly-recap [data-recap="1"]').count()===0,'Week 1 is never in the archive');
  await page.click('.weekly-recap [data-recap="2"]');
  ok((await page.locator('#sheet').getAttribute('aria-label')).includes('Week 2'),'archive button opens actual Week 2 results');
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   for(const big of [false,true]){
    await page.evaluate(big=>{if(big)document.documentElement.dataset.big='';else delete document.documentElement.dataset.big;},big);
    const fit=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.querySelector('#sheet').scrollWidth<=innerWidth);
    ok(fit,`recap fits ${width}px${big?' with bigger text':''}`);
   }
  }
  await page.click('#sheet-close');
  ok(await page.locator('#sheet').isHidden(),'close returns to the pick screen');
  ok(await page.evaluate(()=>!document.body.style.position),'closing archive restores scrolling');
  ok(page.url()===link,'opening and closing recaps never changes the personal URL');
  await page.reload({waitUntil:'networkidle'});await page.waitForSelector('#tabs:not([hidden])');
  ok(await page.locator('#s-pick .recap-notice').count()===0,'dismissal survives a page reload');
  await page.evaluate(()=>{for(let w=2;w<=18;w++)delete S.games[w];render();});
  ok(await page.locator('#s-pick [data-recap]').count()===0,'no recap control is displayed before Week 2 is complete');
  ok(errors.length===0,'no runtime errors: '+errors.join('; '));
 }finally{await browser.close();}
 console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
