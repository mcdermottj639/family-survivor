/* Execute the actual SQL in an isolated in-memory Postgres, never the league. */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); c ? pass++ : fail++; };
(async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role unrelated;');
    const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
    const upgrade = fs.readFileSync(path.join(root, 'database/name-list.sql'), 'utf8');
    await db.exec(schema);
    const definition = s => s.match(/create or replace function public\.admin_hide_name[\s\S]*?end \$\$;/i)[0];
    ok(definition(schema) === definition(upgrade), 'bootstrap and scoped upgrade install the same function');
    await db.exec(`insert into public.players (id, display_name, token, is_admin, claimed_at) overriding system value values
      (101, 'Fixture Admin', 'fixture-admin', true, '2026-09-01'),
      (102, 'Fixture Member', 'fixture-member', false, null),
      (103, 'Other Member', 'fixture-other', false, '2026-09-02');
      insert into public.picks (player_id, season, week, team, kickoff)
      values (102, 2026, 1, 'PHI', '2026-09-10T00:00:00Z');`);
    const snapshot = async () => JSON.stringify({
      players: (await db.query('select * from players order by id')).rows,
      picks: (await db.query('select * from picks order by player_id, week')).rows,
    });
    const original = await snapshot();
    await db.exec(upgrade);
    ok(await snapshot() === original, 'deploying the scoped upgrade does not change any member or pick');
    const call = async (token, id) => {
      await db.exec('set role anon');
      try { return (await db.query('select public.admin_hide_name($1, $2) as result', [token, id])).rows[0].result; }
      finally { await db.exec('reset role'); }
    };
    for (const token of ['wrong-token', 'fixture-member', null]) {
      const r = await call(token, 102);
      ok(r.ok === false && /admin/.test(r.error), `${token === null ? 'null' : token === 'wrong-token' ? 'invalid' : 'ordinary member'} credential cannot change the list`);
    }
    ok(await snapshot() === original, 'refused requests leave every stored value unchanged');
    ok((await call('fixture-admin', -1)).ok === false, 'unknown player is reported rather than claiming success');
    const result = await call('fixture-admin', 102);
    ok(result.ok === true && Object.keys(result).length === 1, 'commissioner can hide a name without receiving its token');
    const claimed = (await db.query('select claimed from players_public where id=102')).rows[0].claimed;
    ok(claimed === true, 'hidden name is excluded by the existing picker claimed flag');
    const after = JSON.parse(await snapshot()), before = JSON.parse(original);
    ok(after.players.every((p, i) => JSON.stringify({...p, claimed_at:null}) === JSON.stringify({...before.players[i], claimed_at:null})), 'IDs, names, personal tokens and roles stay identical');
    ok(JSON.stringify(after.picks) === JSON.stringify(before.picks), 'every saved pick stays identical');
    const hiddenSnapshot = await snapshot();
    ok((await call('fixture-admin',102)).ok && await snapshot() === hiddenSnapshot, 'repeated removal is idempotent, including the timestamp');
    await db.exec('set role anon');
    const who = (await db.query("select whoami('fixture-member') as result")).rows[0].result;
    const recovery = (await db.query("select recover_player('Fixture Member') as result")).rows[0].result;
    ok(who.id === 102 && who.is_admin === false && who.token === 'fixture-member', 'saved member login still resolves to the original ordinary member');
    ok(recovery.ok && recovery.token === 'fixture-member', 'existing typed-name recovery remains available');
    const restore = (await db.query("select admin_unclaim('fixture-admin',102) as result")).rows[0].result;
    await db.exec('reset role');
    ok(restore.ok && await snapshot() === original, 'Put back on list restores the exact original state');
    await db.exec('set role unrelated');
    let refused = false;
    try { await db.query("select public.admin_hide_name('fixture-admin',102)"); }
    catch (e) { refused = e.code === '42501'; }
    finally { await db.exec('reset role'); }
    ok(refused, 'new function has no implicit PUBLIC execution grant');
    await db.exec('set role anon');
    const claim = (await db.query('select claim_player(102) as result')).rows[0].result;
    await db.exec('reset role');
    ok(claim.ok && claim.token === 'fixture-member', 'normal name selection still works after the name is put back');
  } finally { await db.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
