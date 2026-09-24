/* Regression tests of production functions; no browser or live data writes. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, '../survivor.js'), 'utf8');
let pass=0,fail=0;
async function test(name, fn) { try { await fn(); pass++; console.log('  ✓ '+name); } catch(e) { fail++; console.log('  ✗ '+name+': '+e.message); } }
function load(ctx, names) { for(const name of names) { const m=source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm')); assert(m, name); vm.runInContext(m[0],ctx); } }
(async()=>{
 const ctx=vm.createContext({console, S:{games:{}}, ABBRS:[],
  tallyFor:()=>({w:4,l:0,pts:40,rows:[1,2,3,4].map(week=>({week,pick:{team:'A'},status:'win',margin:10}))}),
  pickProbInfo:(_t,w)=>({probability:w===4?null:.75,basis:w===3?'spread':'moneyline'}),
  pickProb:(_t,w)=>w===4?null:.75, teamRatings:()=>({}),usedTeamsVisible:()=>({}),byRating:()=>()=>0});
 load(ctx,['statsFor']);
 await test('Missing odds do not inflate the luck calculation',()=>{const s=ctx.statsFor(1);assert.equal(s.luck,.75);assert.equal(s.xwWins,3);assert.equal(s.xw,2.25);assert.equal(s.xwN,3);});
 await test('Spread-derived expectations are identified separately',()=>assert.equal(ctx.statsFor(1).xwSpread,1));
 const store=new Map(), games=[{id:'1',state:'post',home:{abbr:'A',score:20},away:{abbr:'B',score:10}}];
 const score=vm.createContext({console:{warn(){}},S:{demo:false,games:{}},SEASON:2026,ESPN_SB:'https://example.test',SCORE_MAX_AGE:21600000,
  memCache:{},scoreFetchedAt:{},scoreStale:{},AbortController,setTimeout,clearTimeout,
  jGet:(k,d)=>store.has(k)?store.get(k):d,jSet:(k,v)=>store.set(k,v),normGame:g=>g,
  savePrice:()=>false,
  fetch:async()=>({ok:true,json:async()=>({events:games})})});
 load(score,['weekGames']);
 await test('Final score cache stores a revalidation timestamp',async()=>{await score.weekGames(1);assert(store.get('survivor:wk:2026:1').fetchedAt);});
 await test('Corrections replace cached final scores',async()=>{score.fetch=async()=>({ok:true,json:async()=>({events:[{...games[0],home:{abbr:'A',score:21}}]})});await score.weekGames(1,true);assert.equal(score.S.games[1][0].home.score,21);});
 await test('Failed score refresh preserves last known results and marks stale',async()=>{score.fetch=async()=>{throw Error('offline')};await score.weekGames(1,true);assert.equal(score.S.games[1][0].home.score,21);assert.equal(score.scoreStale[1],true);});
 await test('Partial replacement cannot silently erase a game',async()=>{score.fetch=async()=>({ok:true,json:async()=>({events:[]})});await score.weekGames(1,true);assert.equal(score.S.games[1].length,1);assert.equal(score.scoreStale[1],true);});
 await test('A successful retry clears the stale flag',async()=>{score.fetch=async()=>({ok:true,json:async()=>({events:games})});await score.weekGames(1,true);assert.equal(score.scoreStale[1],false);});
 let renders=0,calls=0;
 const refresh=vm.createContext({Date,Set,Promise,S:{me:{id:1},screen:'pick',week:2,liveWeek:2,games:{1:games,2:games},store:{
  listPlayers:async()=>[{id:1}],listPicks:async()=>{calls++;return[{player_id:1,week:2,team:'A'}];}}},
  document:{hidden:false,activeElement:{matches:()=>false}},currentWeek:async()=>2,
  LAST_WEEK:18,FETCH_LANES:3,SCORE_MAX_AGE:21600000,scoreFetchedAt:{1:Date.now(),2:Date.now()},
  weekGames:async()=>games,render:()=>renders++});
 load(refresh,['refreshBusy','refreshLeague']);
 await test('Background refresh fetches other members picks even when games are final',async()=>{await refresh.refreshLeague(true);assert.equal(calls,1);assert.equal(refresh.S.picks.length,1);assert.equal(renders,1);});
 await test('Confirmation is never interrupted by a refresh',async()=>{refresh.S.confirming={team:'A'};await refresh.refreshLeague(true);assert.equal(calls,1);refresh.S.confirming=null;});
 await test('Open sheets and commissioner forms prevent background rerender',async()=>{refresh.S.sheet='recap:2';await refresh.refreshLeague(true);refresh.S.sheet=null;refresh.S.screen='admin';await refresh.refreshLeague(true);assert.equal(calls,1);refresh.S.screen='pick';});
 await test('Network failures never replace good picks with an empty list',async()=>{refresh.S.store.listPicks=async()=>{throw Error('offline')};await refresh.refreshLeague(true);assert.equal(refresh.S.picks.length,1);assert.equal(refresh.S.refreshError,true);});
 let resolvePicks;
 await test('A confirmation opened during a fetch wins the race',async()=>{refresh.S.store.listPicks=()=>new Promise(r=>{resolvePicks=r});const pending=refresh.refreshLeague(true);refresh.S.confirming={team:'A'};resolvePicks([]);await pending;assert.equal(refresh.S.picks.length,1);refresh.S.confirming=null;});
 await test('A refresh begun before a saved pick cannot overwrite the newer result',async()=>{const pending=refresh.refreshLeague(true);refresh.S.writeEpoch=1;refresh.S.picks=[{player_id:1,week:2,team:'B'}];resolvePicks([]);await pending;assert.equal(refresh.S.picks[0].team,'B');});
 const handlers={},deleted=[],matched=[];
 const sw=vm.createContext({URL,Promise,Response, self:{location:{origin:'https://family.test'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn},
  caches:{keys:async()=>['survivor-v0','survivor-v1','sports-hub-cache','golf-cache'],delete:async k=>deleted.push(k),
  open:async()=>({match:async(req)=>{matched.push(req);return undefined;}})},fetch:async()=>{throw Error('offline')}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),sw);
 await test('Worker cleanup leaves other apps caches alone',async()=>{let done;handlers.activate({waitUntil:p=>done=p});await done;assert.deepEqual(deleted,['survivor-v0']);});
 await test('Offline asset misses never receive the HTML app shell',async()=>{let done;handlers.fetch({request:{url:'https://family.test/survivor.js',method:'GET',mode:'cors'},respondWith:p=>done=p});await done;assert.equal(matched.length,1);assert.notEqual(matched[0],'./');});
 await test('Gold palette tokens remain exactly pinned',()=>{const css=fs.readFileSync(path.join(__dirname,'../survivor.css'),'utf8');const testSource=fs.readFileSync(path.join(__dirname,'gold.js'),'utf8');const begin=testSource.indexOf('const GOLD');assert(begin>=0);const end=testSource.indexOf('\nconst norm',begin);const gold=vm.createContext({});vm.runInContext(testSource.slice(begin,end)+';globalThis.expected=GOLD;',gold);for(const [pal,tokens] of Object.entries(gold.expected)){const block=css.match(new RegExp(':root\\[data-palette="'+pal+'"\\] \\{([^]*?)\\n\\}'))[1];for(const [key,value] of Object.entries(tokens)){const actual=block.match(new RegExp(key+':\\s*([^;]+);'))[1];assert.equal(actual.trim(),value);}}});
 await test('Existing distributed links and token storage conventions are unchanged',()=>{assert(source.includes("const meKey =") || source.includes('function meKey('));assert(source.includes("new URLSearchParams(location.search).get('u')"));assert(source.includes("picks?season=eq.${SEASON}&select=player_id,week,team,kickoff,entered_by"));});
 console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
})();
