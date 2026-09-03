/* A stand-in for PostgREST + schema.sql, so the CLOUD path can be tested.
   ------------------------------------------------------------------
   🚨 Why this exists. Every other suite runs on LocalStore, so until now
   SupaStore — the code that will actually run for twenty relatives — had
   ZERO coverage. The sandbox cannot reach supabase.co, and the real database
   is the owner's, so the only honest way to exercise it is to answer its
   HTTP calls with something that behaves like the schema.

   ⚠️ This is a MODEL of schema.sql, not the thing itself. It proves the
   CLIENT half is right: the URLs, the headers, the payload shapes, the error
   handling, and that two devices sharing one backend see each other. It
   cannot prove the SQL, which has never met a live Postgres — tests/schema.js
   covers as much of that as static analysis can.

   Keep the two in step: if a rule moves in schema.sql, it moves here too. */
const SEASON = 2026;

function makeDB() {
  return { players: [], picks: [], seq: 1, calls: [], noKey: [] };
}

/* The rules that matter, mirrored from schema.sql. */
function rpc(db, fn, b) {
  const isAdmin = (t) => db.players.some((p) => p.token === t && p.is_admin);
  const byToken = (t) => db.players.find((p) => p.token === t);
  const tok = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + Math.random().toString(16).slice(2, 8);

  switch (fn) {
    case 'whoami': {
      const p = byToken(b.p_token);
      return p ? { id: p.id, display_name: p.display_name, is_admin: p.is_admin, token: p.token } : {};
    }
    case 'admin_add_player': {
      const first = db.players.length === 0;
      if (!first && !isAdmin(b.p_admin_token)) return { ok: false, error: 'Not an admin.' };
      const t = tok(b.p_name);
      db.players.push({ id: db.seq++, display_name: String(b.p_name).trim(), token: t, is_admin: first, claimed_at: null });
      return { ok: true, token: t };
    }
    case 'admin_del_player':
      db.players = db.players.filter((p) => p.id !== b.p_player_id);
      db.picks = db.picks.filter((p) => p.player_id !== b.p_player_id);
      return { ok: true };
    case 'admin_token_for': {
      if (!isAdmin(b.p_admin_token)) return { ok: false, error: 'Not an admin.' };
      const p = db.players.find((x) => x.id === b.p_player_id);
      return p ? { ok: true, token: p.token } : { ok: false, error: 'No such player.' };
    }
    case 'claim_player': {
      // Conditional update: two people cannot claim one name (the TOCTOU fix).
      const p = db.players.find((x) => x.id === b.p_player_id && !x.claimed_at);
      if (!p) return { ok: false, error: 'Somebody has already taken that name. Ask the commissioner.' };
      p.claimed_at = new Date().toISOString();
      return { ok: true, token: p.token };
    }
    case 'join_league': {
      const n = String(b.p_name || '').trim();
      if (!n) return { ok: false, error: 'Type a name.' };
      if (n.length > 28) return { ok: false, error: 'That name is too long.' };
      if (db.players.some((p) => p.display_name.toLowerCase() === n.toLowerCase()))
        return { ok: false, error: 'Somebody is already using that name.' };
      const t = tok(n);
      // ⚠️ NEVER grants admin, however it is called.
      db.players.push({ id: db.seq++, display_name: n, token: t, is_admin: false, claimed_at: new Date().toISOString() });
      return { ok: true, token: t };
    }
    case 'release_me': {
      const p = byToken(b.p_token);
      if (!p) return { ok: false, error: 'Unknown link.' };
      if (db.picks.some((x) => x.player_id === p.id))
        return { ok: false, error: 'You have already made picks — ask the commissioner to sort this out.' };
      p.claimed_at = null;
      return { ok: true };
    }
    case 'admin_unclaim': {
      if (!isAdmin(b.p_admin_token)) return { ok: false, error: 'Not an admin.' };
      const p = db.players.find((x) => x.id === b.p_player_id);
      if (p) p.claimed_at = null;
      return { ok: true };
    }
    case 'submit_pick':
    case 'admin_set_pick': {
      const admin = fn === 'admin_set_pick';
      let p;
      if (admin) {
        if (!isAdmin(b.p_admin_token)) return { ok: false, error: 'Not an admin.' };
        p = db.players.find((x) => x.id === b.p_player_id);
      } else {
        p = byToken(b.p_token);
      }
      if (!p) return { ok: false, error: 'Unknown link.' };
      const team = b.p_team, week = b.p_week, kick = b.p_kickoff;
      const shortT = (t) => String(t || '');
      // A bye pick carries no kickoff — that equivalence is what lets the
      // database enforce the bye rule without knowing the NFL schedule.
      if (team && !kick) return { ok: false, error: `The ${shortT(team)} are on bye in week ${week}.` };
      if (team && new Date(kick) <= new Date())
        return { ok: false, error: 'That game has already started.' };
      // Never the same team twice — a UNIQUE constraint, not a UI check.
      if (team) {
        const dup = db.picks.find((x) => x.player_id === p.id && x.season === SEASON && x.team === team && x.week !== week);
        if (dup) return { ok: false, error: `You already used the ${shortT(team)} in week ${dup.week}.` };
      }
      // A decided week is decided — for the commissioner too.
      const cur = db.picks.find((x) => x.player_id === p.id && x.season === SEASON && x.week === week);
      if (cur && cur.team !== team && cur.kickoff && new Date(cur.kickoff) <= new Date())
        return { ok: false, error: `Week ${week} is locked in.` };
      db.picks = db.picks.filter((x) => !(x.player_id === p.id && x.season === SEASON && x.week === week));
      if (team) db.picks.push({ id: db.seq++, player_id: p.id, season: SEASON, week, team, kickoff: kick,
        entered_by: admin ? 'admin' : 'self', updated_at: new Date().toISOString() });
      return { ok: true };
    }
    default:
      return { __status: 404, message: `Could not find the function public.${fn}` };
  }
}

/* Attach to a Playwright context. Several contexts may share one `db`, which
   is the whole point: that is what "two phones, one league" means. */
async function attach(ctx, db) {
  await ctx.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const h = await req.allHeaders();
    // 🚨 Every request must carry the key, or the real PostgREST answers
    // "No API key found in request" and the league looks broken.
    if (!h.apikey || !h.authorization) { db.noKey.push(url.pathname); }
    const path = url.pathname.replace('/rest/v1/', '');
    db.calls.push(path.split('?')[0]);

    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
      const out = rpc(db, fn, body);
      if (out && out.__status) {
        return route.fulfill({ status: out.__status, contentType: 'application/json',
          body: JSON.stringify({ message: out.message }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
    }
    if (path.startsWith('players_public')) {
      // ⚠️ The VIEW omits `token`. If it ever leaked, anybody could pick as
      // anybody. The test asserts on this.
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(db.players
          .map((p) => ({ id: p.id, display_name: p.display_name, is_admin: p.is_admin, claimed: !!p.claimed_at }))
          .sort((a, b) => a.display_name.localeCompare(b.display_name))) });
    }
    if (path.startsWith('picks')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(db.picks.map((p) => ({ player_id: p.player_id, week: p.week, team: p.team,
          kickoff: p.kickoff, entered_by: p.entered_by }))) });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"not found"}' });
  });
}

module.exports = { makeDB, attach, rpc };
