# CLAUDE.md — 🏈 Family Survivor League

> ## What this is
> A standalone NFL survivor-pool web app for the owner's family — about 20
> relatives, including a 95-year-old grandmother. Pure static HTML/CSS/JS, no
> build step, no framework. It ships from this repo via GitHub Pages:
> **https://mcdermottj639.github.io/family-survivor/**
>
> **It has its own repo as of 3 Sep 2026**, having been developed inside
> `mcdermottj639/Sports-Hub` under `survivor/` so the owner could test it on
> his phone. It never shared code with that app and it does not now. See
> "Why it moved" below — the reasons are worth knowing, because two of them
> are traps that would come straight back if anyone ever vendored this into
> another site.

> ## 🥇 THE GOLD IS NOT TO BE CHANGED
> The owner, unprompted: *"Don't change the gold I love the gold."* It is the
> app's whole identity — the tabs, the pick card, the buttons, the bars.
>
> **`--ac`, `--ac6`, `--wm`, `--on-ac`, `--grad` and `--glow` are frozen in
> both palettes.** They have been touched exactly once, in the commit that
> created the app, and that is how it stays.
> - **`tests/gold.js` pins all twelve values** and fails loudly if any of them
>   moves. ⚠️ **If it fails, the change is wrong — do NOT update the
>   expectations to match it.** Ask him.
> - Adding a NEW colour beside the gold is fine and has been done: v35's
>   `--grad-pos` / `--grad-neg` / `--grad-tie` copy its *construction* (a
>   five-stop plate with a double highlight) without touching the gold itself.
>   **Copy the recipe, never the tokens.**
> - ⚠️ Accent fills take **dark** ink (`--on-ac`). White on gold measures about
>   1.9:1 and is unreadable. That rule is part of why the gold works.

> ## 🧪 The tests live in `tests/` — run them
> `node tests/run.js` runs every suite (it starts its own server);
> `node tests/run.js a11y ios` runs just those. **All 38 suites drive the
> real app in headless Chromium — the runner prints the tally.**
> - They used to live in `/tmp` and were lost at the end of every session,
>   which meant each change re-proved the same ground by hand. They are in the
>   repo now. **Add to them rather than starting over.**
> - `tests/README.md` lists what each suite holds down, the sandbox facts that
>   look like bugs and are not, and the several ways a test in this app has
>   previously managed to pass while measuring nothing.

## Why it moved (3 Sep 2026), and what that fixed

It was developed inside the owner's `Sports-Hub` repo, at `/Sports-Hub/survivor/`,
purely so he could open it on his phone while it was being built. Three things
made that untenable the moment the family got links, and all three are gone now
that it has its own origin:

1. **Path deletion.** From `/Sports-Hub/survivor/` any relative could delete one
   path segment and land on the owner's personal betting model and fantasy team.
   This was the reason with a deadline on it.
2. **One origin, one localStorage bucket.** localStorage is per-ORIGIN, not
   per-path, so both apps shared one ~5 MB quota in Safari. The `sportshub:` /
   `survivor:` prefixes stopped collisions, not competition for space — and
   Sports-Hub's own pick tally grows without bound.
3. **Service-worker scope.** The root `sw.js` was scoped to `/Sports-Hub/`,
   which contains `/Sports-Hub/survivor/`. This app's own worker is more
   specific and won, but that root cache was keyed to the *other* app's version,
   so every Sports-Hub release churned the cache covering grandma's page.

⚠️ **All three come straight back if this is ever served from a subdirectory of
something else.** It is designed to own its origin.

**The move itself needed no code changes** — every path in `index.html`, the
manifest and the service-worker registration is relative (`./`, `sw.js`,
`survivor.css`), which was checked rather than assumed. History was carried
across with `git subtree split`, so the 50-odd commits that built it are intact.

⚠️ **Conventions that exist because of where it grew up.** Some rules in this
file are phrased against Sports-Hub because that is what they were defending
against. They still hold on their own terms: the version constant is `APP_V`
(not `APP_VERSION`), storage keys are prefixed `survivor:`, the styling is
`survivor.css` alone, and the release ritual is this file's, not that one's.

## What it is

**🏈 Family Survivor League** — the owner's family survivor pool
(`index.html` / `survivor.css` / `survivor.js` / `sw.js` / `schema.sql` /
`tests/`). Six files and a test directory; there is no build step and nothing
is generated. See `README.md` for the setup steps and the honest limits.
- **The league is non-elimination**: you are never knocked out, you just can
  never pick the same team twice. Six house rules, settled 2 Sep 2026 and
  written at the top of `survivor.js`: a missed week costs nothing (no loss,
  no points, no team burned) · per-GAME deadline (pick or change until that
  game kicks off) · picks hidden until their game starts, then public ·
  regular season only, weeks 1–18 · standings sort on wins with cumulative
  point margin as the tiebreak · a tie is neither a win nor a loss.
- ⚠️ **The no-repeat rule is a `UNIQUE` CONSTRAINT, not a UI check**
  (`never_reuse_a_team` in `schema.sql`). Two open tabs or a stale phone page
  would otherwise produce a duplicate that the commissioner has to adjudicate
  by text message. Anything new that writes a pick must go through
  `submit_pick`/`admin_set_pick`, never straight at the table.
- **🔄 Updates reach every phone by themselves — `sw.js`.** The
  owner: *"if I update the survivor app it needs to update for all the
  family."* It does, but only because of this worker. **The `?v=N` ritual
  had already failed silently: `survivor.js` changed 16 times while
  `index.html` still asked for `?v=1`**, so a returning phone could have
  served a months-old copy of the CSS and JS. Its own **network-first**
  worker now fetches every same-origin file with `cache: 'no-store'`,
  bypassing both the browser cache and GitHub Pages' ~10-minute one; the
  Cache API copy is only the offline fallback. That is the opposite of
  normal PWA advice and is deliberate — being CURRENT matters far more than
  being fast here, and the files are a few KB.
  - ⚠️ **Cross-origin is never intercepted** (`url.origin !== self.location.origin`),
    so ESPN scores and Supabase picks always come from the network. A stale
    score or a stale pick would be worse than none.
  - **🔄 It reloads itself, and the detection no longer depends on anyone
    remembering a version number (v24).** The worker only helps a COLD
    open; on a phone the app is never really closed — a Home Screen icon
    resumes the SAME page for days — so a change could sit on the server
    all week unseen. The page watches for one and reloads.
    - ⚠️ **v23 replaced the self-reload with an "Update now" button and the
      owner rejected it: *"that was stupid change by me. Auto reload is
      better."*** He is right, and the reason is this league specifically:
      the whole promise is that twenty relatives do NOTHING but tap a link.
      A bar asking them to approve an update is a chore handed to people
      with no way to judge whether it matters, and the ones who ignore it
      are exactly the ones you needed to update. **Reverted in v24.**
    - **Two independent signals, because each alone has a hole.** (1) A
      **HEAD on `survivor.js`** comparing ETag/Last-Modified/length against
      the copy booted with (`fileStamp`/`checkForUpdate`) — needs **no
      version bookkeeping at all**, which is the point: a number somebody
      must remember to bump is a number that eventually lies, and that is
      precisely how `?v=1` survived sixteen releases here. (2) The worker
      taking over — free, but it only fires when **`sw.js` itself changed
      byte-wise**, which is why `sw.js` carries its own `APP_V` marker that
      nothing reads. Forgetting that marker costs only signal 2.
    - Checked at boot, on `visibilitychange`/`focus`, and every 15 min,
      throttled to one check per 30s. **The first read is the baseline and
      can never itself count as a change** — otherwise every fresh page
      would reload once on boot.
    - ⚠️ **`applyUpdate` waits out a pick being made** (`S.confirming` /
      the new `S.saving`, retrying every 4s). That is the one moment a
      silent reload destroys something rather than just being abrupt.
      Everything else on screen is re-derived on the way back up.
  - `APP_V` shows in the footer, so the commissioner can ask "what does
    yours say?" and know at once whether somebody is on an old copy. It is
    the **build number** — one per shipped change — so a
    bigger number is always newer. ⚠️ **Bump it on every ship — in BOTH
    `survivor.js` and `sw.js`.** It does not
    affect delivery (the worker does that), but a version that lies is worse
    than none, which is exactly how `?v=1` sat unchanged for sixteen
    releases. It was briefly `v1` for one commit, which read as "brand new
    app" when it was build 17.
    - **🔒 All THREE numbers are now pinned to each other by test** — `APP_V`
      in `survivor.js`, `APP_V` in `sw.js`, and the `?v=` on both assets in
      `index.html` (`tests/update.js`). They had drifted again: at build 43
      the page was still asking for `?v=18` and `?v=22`. The query string no
      longer *delivers* anything — the worker does that, and the same suite
      proves it — but three numbers that all claim to say "this is build N"
      must not be free to disagree, which is precisely the failure this app
      already had once. **Bump `APP_V` in both files and the two `?v=` in
      `index.html` together, or the suite fails and names which is lying.**
  - ⚠️ It used to sit under another app's worker scope, whose cache was keyed
    to THAT app's version — so somebody else's release churned the cache
    covering grandma's page. Owning the origin is what fixed it. Do not serve
    this from a subdirectory of anything.
- **🔗 ONE league link, and each person taps their own NAME.** The owner's
  rule: *"For them on the other end there can be no required work. Just click
  link, add name and pick as we go."* So the commissioner texts a single
  address to the family group; each person opens it, taps their own name
  once, and that phone remembers them forever (`signInWith` writes the token
  to localStorage AND to the address bar via `location.search`, so a
  bookmark or Home Screen icon captures it).
  - `players.claimed_at` marks a name as taken; `claim_player(id)` hands out
    that player's token and is the ONLY way the token can reach them, since
    `players_public` deliberately omits it. A claimed name disappears from
    the list, so two people can never share one entry.
  - `join_league(name)` covers anyone the commissioner forgot — they type a
    name instead. It refuses duplicates case-insensitively and **never grants
    admin, however it is called.**
  - ⚠️ **Tapping the wrong name is confirmed AND self-undoable.** Choosing
    who you are is a bigger commitment than a pick — it takes a name off the
    list for everybody else — so `askName` asks "Are you Nana?" first, with
    the safe answer holding focus. And **before their first pick** the Pick
    screen carries a "Not Nana? Tap here to pick a different name" escape
    (`#notme` → `release_me`), so a mis-tap is fixed in two taps without
    texting the commissioner. Once picks exist the escape disappears and
    `release_me` refuses — untangling that is a real decision and belongs
    with the commissioner via `admin_unclaim`.
  - `admin_unclaim` puts a name back when somebody taps the wrong one.
  - ⚠️ **Pre-add everyone's names.** Tapping beats typing for the people this
    league exists for; the type-your-name path is the fallback, not the plan.
  - This replaced "mint 20 personal links and text them individually".
    Individual links still exist in Admin as a rarely-needed escape hatch.
- **Identity is a personal URL** (`?u=nana`), saved to localStorage on first
  visit. No password, no account, no install — that is the only design that
  a 95-year-old can actually use, and it is a trust model rather than a
  security model on purpose. Tokens are NOT readable by the anon key: the app
  reads a `players_public` VIEW that omits the column.
- **🚨 PICKS ARE THE ONLY THING STORED.** Records, margins and standings are
  computed live from ESPN's free NFL scoreboard on every render. That deletes
  a whole subsystem — no results table, no cron, no scraper, no write path a
  viewer could poison — and it makes the standings tick live on a Sunday.
  Do NOT add a results table; it would immediately be a second source of
  truth that can drift.
- ⚠️ **The app ships NOT SHARED, and that is the last step before the family
  gets links.** `SUPABASE_URL`/`KEY` are empty, so `pickStore()` returns
  `LocalStore` and every person would get their own isolated copy. The
  footgun was that **"Copy everyone's links" worked anyway** — 20 relatives
  could each be texted a link that opens an empty app on their own phone.
  `linkWarnOK()` now guards every path that hands a link to another human,
  the Admin screen leads with a red `.warnbox` instead of a mild note, and
  the setup steps are numbered in-app including the SQL-editor commissioner
  seed the audit called for. `isShared()` is the one predicate for "picks
  actually travel between devices".
- 🚨 **THE CONFIG MUST BE IN THE FILE, NOT IN localStorage.** `pickStore()`
  reads `survivor:sb` from the device and falls back to the module constants.
  So pasting the Supabase URL/key into the Admin panel configures **only the
  commissioner's own phone** — every relative opens the same web address with
  nothing saved and silently gets `LocalStore`. Measured: device A `cloud`,
  device B `local`. **The two constants at the top of `survivor.js` are the
  real switch**; the paste box is a tester's override. Admin now says so in a
  warning box and has a **"Copy the 2 lines for the deployed app"** button
  that emits exactly the two `let SUPABASE_URL/KEY` lines.
- 🚨 **A stranded personal link used to offer "Start the league".** Anyone
  arriving on `?u=…` before the league was switched on was shown the
  first-run setup screen — so Nana could have created her own empty league
  and become its commissioner. `renderPicker` now branches on whether the URL
  carried a token: a failed token gets "This link isn't working · ask
  {LEAGUE_ADMIN_NAME} · nothing is wrong with your phone" and **no way to
  create anything**. Setup is only offered when there is no token at all.
- **Storage is pluggable**: `LocalStore` (localStorage, this device only) and
  `SupaStore` (Supabase free tier, plain `fetch` against PostgREST, no SDK
  and no build step). `pickStore()` picks one; nothing else in the file knows
  which is live. Config goes in `survivor:sb` on the device OR hardcoded at
  the top of `survivor.js`.
- **Demo mode is not a toy, it is the only way to test the app before
  10 Sep 2026** — with no completed games there is nothing to grade and the
  standings and history screens cannot be exercised at all. `demoGames()`
  builds a deterministic season off a circle-method round robin (16 games,
  all 32 teams, nobody twice). It is a FULL season in progress, sized to the
  real league, and every state the app can be in is present on purpose:
  - `DEMO_WEEK` **10** — nine weeks played, week 10 underway: one game final
    since Thursday, **three live right now** (`state: 'in'`), the rest ahead.
  - **18 relatives** (`DEMO_FAMILY`), of whom `DEMO_UNCLAIMED` (4) have not
    tapped their name yet and hold no picks — so the join screen has real
    names to offer and the first-run welcome can be seen.
  - `DEMO_MISSED` gives Nana weeks 2 and 7 off, `DEMO_NO_PICK_THIS_WEEK`
    leaves two people off the current week (the chase list), `DEMO_TIE`
    forces one real tie, and `DEMO_BYES` rests teams from week 5 on.
  - ⚠️ **Kickoff INSTANTS are relative to `Date.now()`, never a fixed clock
    time.** They were pinned to 1pm, so opening the demo after lunch made
    every upcoming game already-kicked-off and refused EVERY pick. Anything
    added here must stay relative.
  - **But the LABEL is a real NFL slot (v27).** The owner: *"The times are
    not realistic in the demo and it's making it hard for me to do it… nfl
    are set times. Everybody is east coast, so order these games logically
    like the nfl does."* Relative instants produced 5:00 AM kickoffs, which
    is not a thing. **The two jobs are now separate fields**: `date` is the
    deadline and stays relative; **`whenLabel`** is what the game shows, and
    it comes from `DEMO_SLOTS` — Thu 8:15, Sun 1:00, 4:05, 4:25, 8:20, Mon
    8:15, Eastern, because everyone in the league is. Every game the app
    renders now formats through **`kickWhen(g)`**, which returns the label
    when a fixture supplies one and `fmtKick(g.date)` otherwise, so real
    ESPN games are untouched.
    - `demoSlotFor(i, n)` keeps the SHAPE of a real week at any slate size
      (bye weeks change the game count): one Thursday game, the bulk at
      1:00, ~30% in the late-afternoon window, then SNF and MNF.
    - The anchor is **20 minutes past the Sunday 1:00 kickoff**, so the demo
      always opens on a genuine mid-week state — Thursday final, the early
      window live, and five games still pickable — at any real hour.
    - `demoSunday(week)` dates each week off Sunday 13 Sep 2026, so the
      labels carry real dates (week 10 is Sun 11/15). Display only.
    - Live scores scale at **0.2**, not 0.6: twenty minutes in is the first
      quarter, and 22 points beside a "1Q" clock is what made the old
      fixture read as fake. Broadcasts match their slot (Prime / NBC / ESPN).
    - ⚠️ Ordering needed no code — the app already sorts by `date`, and the
      slot offsets are monotonic. **If you add a slot, keep `at` in real
      chronological order or the slate will sort against its own labels.**
  - ⚠️ **The seeder writes straight to the store and threads the admin token
    through `addPlayer`** — the first add bootstraps the commissioner and
    every later call must carry that token, or `addPlayer` correctly refuses
    as "not an admin" and only one player is ever created.
  - The Admin screen carries a "what's loaded and what to look at" guide
    (`.demo-guide`), and the suites derive week/player counts from these
    constants rather than hardcoding them.
- **"Lost by 7 — 19-26" read as one run of numbers (v24).** The owner:
  *"can u see how the dashes are confusing. Make a distinction between lost
  by and the score total."* An em dash and a hyphen sat side by side, so
  the margin ran straight into the score. The verdict and the score are
  separate elements on separate lines now (`.lk-res` / `.lk-score`), and
  the score **names both teams** — "Lost by 28" over "Final score: Jaguars
  10, Ravens 38". The distinction is structural, not a matter of reading
  punctuation correctly, which is the right call for the reader this app
  exists for.
  - **And in v25 the WHOLE card is the result.** The owner, looking back
    through the demo: *"change the card to green for a win or red for a
    lose so it's clear too."* Right — v24 kept the card gold and left the
    distinction to the words, because coloured TEXT on gold is unreadable.
    Recolouring the fill itself solves the same problem the other way, and
    a season's history now reads at arm's length without parsing a word.
    - **Gold is now reserved for "still your pick"** — the current week,
      and a game still being played. A colour means something is settled.
    - **🥇 PLATED, like the gold (v35).** The owner: *"The golds are beautiful
      but the reds and greens are cheap and stale. How can we strengthen those
      colors like the gold plated is."* Right, and the reason is structural:
      the gold was a five-stop metal with a DOUBLE highlight while green and
      red were single flat hexes — two design languages on one card.
      `--grad-pos` / `--grad-neg` / `--grad-tie` mirror `--grad`'s exact
      construction now, with `--glow-pos` / `--glow-neg` to match, and the
      crowd bars and season-grid swatches pick up the same treatment.
      - ⚠️ **The highlight goes the OTHER WAY from gold.** Gold carries dark
        type, so its bright stop can be very light. These carry WHITE type, so
        the shine is *the lightest stop white can still survive* — every stop
        is measured at 4.5:1 under white at .88 alpha, and the first attempt
        failed on exactly that (a #22855c highlight measured 3.92 and had to
        come down to #1d7350).
      - The semantic TEXT tokens were deepened with them — Champagne `--pos`
        #1d7a52 → **#116b48** and `--neg` #b0332a → **#a52a1e**; Onyx `--pos`
        #4fb383 → **#43c793** and `--neg` #e8635a → **#f26a5c** — each
        re-measured on both the card and the page ground.
    - ⚠️ **The fills are NOT `--pos`/`--neg`.** Those are tuned to be read
      AS text against the page ground, so they are far too light to sit
      under white type (Onyx's `--pos` #4fb383 measures ~2:1). The card
      uses deep dedicated fills — `#17694a` / `#9d2b23` / `#4a4636` for
      the tie — one pair serving both palettes, and `.lk-k`/`.lk-score`
      lift from .75/.72 to .92/.88 because white at low alpha over a
      colour is a grey, where over gold it was only a shade.
    - Measured, not eyeballed: every line on all three cards in both
      palettes, against EVERY STOP of the plate — 4.90:1 at worst.
    - 🚨 **A plated fill breaks a naive contrast harness.** A gradient is a
      background-IMAGE, so `backgroundColor` is transparent and a parent-walk
      measures the text against the PAGE — which reported 18.59:1 (white on
      black) and a bogus "a win looks like a loss", because both fills read as
      `rgba(0,0,0,0)`. The harness reads the gradient's own stops now and
      takes the WORST, which is the honest question anyway: the type sits over
      all of them. **Any new check comparing fills must compare
      `backgroundImage`, not `backgroundColor`.**
- **📋 Once your own game kicks off, the rest of the week folds into a list
  (v26).** Mocked first and approved before a line changed — the owner:
  *"Show me a screenshot of what that would look like before u change a
  thing."* Worth repeating as a habit for anything that changes what a
  screen IS rather than what it says.
  - **The trigger is `locked`** — you have a pick and its game has started.
    Until then every card stays full, because you can still change your
    mind and a list is a worse thing to choose from.
  - Order is **Playing now → Final → Still to play** (the owner's call:
    *"Put final scores above upcoming games"*), with still-to-play split by
    DAY, or Friday's 5:00 AM reads as today's. Each row is one 56px button
    carrying the same `data-info` the ⓘ did, so **dropping that button is
    where the width for full team names came from** — nothing truncates.
  - Measured on the demo's week 10: **2,863px of scrolling → 1,491px**.
  - **Nothing is removed.** "Show the full matchups" restores the cards and
    "Back to the short list" returns. The state is **`S.fullWeek`, a WEEK
    NUMBER rather than a boolean**, so walking to another week starts
    condensed again with no extra bookkeeping.
  - ⚠️ **A live game's score had to move onto the locked card**, because
    the "Already started" list was the only place it existed and this folds
    that away — the one game you care most about would have been the one
    game with no score.
  - ⚠️ **Every size in `.cg*` sits above the app's 15.5px type floor on
    purpose.** A condensed view that shrinks the type is just a smaller
    problem, and this league's whole reason for existing is a reader with
    aging eyes.
  - ⚠️ **Two suites went QUIET rather than red** when this shipped: they
    reach for `.pk` team buttons on the Pick screen, which a locked pick no
    longer draws, and a `querySelector` that finds nothing measured nothing
    and printed nothing. `a11y.js` silently lost both of its "team record"
    contrast checks — 18 passed, still 0 failed. **A check that vanishes is
    worse than one that fails**; it now asserts the buttons are there before
    measuring them.
- 🚨 **OPEN RULES QUESTION this surfaced, NOT a bug I introduced:
  `submitPick` still lets you replace a pick whose game has already
  finished.** Its only deadline test is on the NEW team's kickoff, so
  picking the Broncos on Thursday, watching them lose, and switching to a
  Sunday team erases the loss and its margin. The UI has always called that
  week "LOCKED IN" while the store would have accepted the change, and
  v26's fold hides the path without closing it — "Show the full matchups"
  still gives you working buttons. **Ask the owner before changing it**: it
  is a reading of house rule 2 ("per-GAME deadline"), not an implementation
  detail, and closing it means refusing a change once YOUR OWN pick has
  kicked off, in both stores and `submit_pick`.
- ⚠️ **Two layout traps found while building it, both worth remembering:**
  (a) `.tabs { display: grid }` **out-specifies the browser's `[hidden]`
  rule**, so `el.hidden = true` silently stopped working and the tab bar
  showed on the sign-in screen — there is now an explicit
  `[hidden] { display: none !important }`. (b) In a flex row, a long italic
  label ("picked — hidden until kickoff") shrank the NAME column to a single
  letter; the pick rows are a grid with a `minmax(84px, 1fr)` name column now.
- **🚨 BYE WEEKS — the hole was the ADMIN path, not the pick screen.** The
  pick screen renders from that week's scoreboard, so a team on bye simply
  has no button and was always safe. But the commissioner's "enter a pick for
  someone" dropdown listed **all 32 teams every week** with no schedule check
  — and that is the "Nana texted me her pick" path, i.e. the single most
  likely way a bye team ever gets picked. The outcome was silent and bad:
  `gradePick` returns `nogame`, `tallyFor` scores it as nothing, but
  `usedTeams` still counts it — so **the team was burned for nothing**, which
  house rule 1 makes strictly worse than not picking at all.
  - Fixed in depth: `byeTeams(week)`/`gameFor(week, team)` derive byes from
    the schedule (ESPN lists 13 games ⇒ the other 6 teams are on bye); the
    admin dropdown offers only teams that play and names the byes; BOTH
    stores refuse a pick carrying no kickoff; and `submit_pick` /
    `admin_set_pick` in `schema.sql` reject a null `p_kickoff` as the
    backstop. A stray legacy bye pick now renders ⚠️ in history instead of
    scoring silently.
  - ⚠️ **A no-kickoff pick IS a bye pick.** That equivalence is what lets the
    database enforce the rule without knowing the NFL schedule, and it is why
    `p_kickoff` is now required rather than optional.
  - ⚠️ **The demo season played all 32 teams every week** (a 32-team circle
    round robin is 16 games), so bye handling was **untestable** — which is
    exactly how this survived the first test pass. `DEMO_BYES` now drops
    games from weeks 3 and 4. **A fixture that cannot express the failure
    cannot test the fix.**
  - ⚠️ **A subagent reported this area as "already correct".** It had checked
    only the pick screen. The owner pushed back, and he was right. Verify a
    clean bill of health across EVERY write path before accepting it.
- **📱 iPhone layer** (bottom of `survivor.css`, appended last so it wins).
  The league runs on phones and the user who matters most opens it from a
  Home Screen icon, where Safari's chrome is gone:
  - ⚠️ **An `apple-touch-icon` MUST be a PNG.** iOS silently ignores an SVG
    one and substitutes a screenshot of the page — which was the previous
    state, i.e. grandma's icon would have been a picture of a sign-in
    screen. `icon-180/192/512.png` are real files now, plus a manifest.
  - `viewport-fit=cover` means the page runs UNDER the Dynamic Island and
    the home indicator, so every edge takes `env(safe-area-inset-*)` — the
    header, tabs, screens, footer and the sheet. Without it content is
    physically unreachable on any notched phone.
  - `dvh` on the sheet (with `vh` as fallback): Safari's toolbar grows and
    shrinks while you scroll, so `vh` is a moving target.
  - ⚠️ **iOS ignores `overflow:hidden` on `<body>`**, so the page scrolled
    behind the open matchup sheet. `openSheet` pins the body with
    `position:fixed` + a negative `top` and `closeSheet` restores the
    offset — that is the only lock that actually holds.
  - `-webkit-tap-highlight-color: transparent` (no grey flash) and
    `-webkit-touch-callout: none` on buttons — a shaky hand rests on a
    button longer, and the iOS copy/share bubble popping up over the team
    you are trying to pick is alarming. ⚠️ **Chromium implements neither
    property**, so the callout rule cannot be verified in the sandbox; the
    suite asserts the shipped source and proves the block is live via
    `user-select`, which Chromium does support.
  - `theme-color` and `apple-mobile-web-app-status-bar-style` are updated by
    `setThemeColor()` on every palette change AND in the inline `<head>`
    script, or the notch stays light while the app is dark.
  - Verified across **iPhone SE / 13 mini / 15 / 15 Pro Max** — 60 checks:
    no sideways scroll on any of the four screens, every input ≥16px, every
    tap target ≥44px, the scroll lock and its restore, the sheet clearing
    the home indicator, and the status bar tracking the palette.
- **🔍 Three-agent audit (accessibility · deep stats · adversarial correctness).
  Findings acted on, and the two that are ARCHITECTURAL rather than bugs:**
  - 🚨 **`tallyFor` sums all 18 weeks but only loaded weeks have games**, so a
    week never fetched in THIS session graded as `nogame` and silently
    vanished from that player's record — two people could see different
    standings at the same moment. `weeksInPlay()` + an `ensureWeeks` on entry
    to Standings/History closes it.
  - 🚨 **The admin path had a bye guard but NO deadline guard**, so the
    commissioner could enter a pick on a game that had already finished — a
    pick made with hindsight. Exactly the same shape as the bye hole. Fixed
    in the dropdown (`state === 'pre'` only), both stores and `admin_set_pick`.
  - 🚨 **`if (S.games[week])` is truthy for `[]`**, so ONE failed ESPN fetch
    pinned that week to "no games" for the life of the page. Now tests
    `.length`, which is safe because a real NFL week is never empty.
  - 🚨 **The 60s live refresh gated on the STALE snapshot** (`some(state==='in')`),
    so it could never discover the first kickoff of the day — a tab opened at
    9am never updated. Now refreshes whenever the week is unfinished, and
    re-derives `currentWeek()` so a long-lived tab crosses week boundaries.
  - 🚨 **Tokens were the slugified NAME** — `?u=nana`, `?u=jack` — so anyone
    could guess a relative's link, and guessing the commissioner's got them
    admin. Now `name-xxxxxx` with a random tail (`randTail`, and
    `gen_random_bytes` in SQL).
  - The per-week localStorage cache was permanent and nothing cleared it (not
    even "Erase everything"), so one bad ESPN snapshot was stuck forever.
    `clearWeekCache()` + an admin "Re-fetch all results" button.
  - ⚠️ **NOT FIXED, and it cannot be fixed client-side: "picks are hidden
    until kickoff" is a UI convention, not a security boundary.** The client
    computes standings itself, so it must read every pick, so `picks` is
    readable by anyone with the anon key — which is in the public JS. Anyone
    who opens dev tools can see this week's picks early. Written into
    `schema.sql`'s header so nobody promises the family otherwise. Closing it
    properly means storing kickoff times server-side and gating reads behind
    a function.
  - ⚠️ **Seed the commissioner in the Supabase SQL editor, NOT in the app.**
    `admin_add_player` lets the first caller become admin while `players` is
    empty, and the anon key is public the moment the site deploys.
  - ⚠️ **`em` compounds.** `.gcell` is `.78em`, so a `.9em` child rendered at
    **12.6px**, not 16.2px. Root sizing moved to `:root` (and `[data-big]`
    with it) so `rem` is a true anchor; small labels now use `rem`.
  - 🚨 **The margin in the season grid lived only in a `title` attribute**,
    and the legend told people to "tap and hold" — a gesture **iOS Safari
    does not support on non-image elements**, so the app promised something
    it could never deliver. The margin is printed in the cell now, which
    also removes the app's only colour-only win/loss cue.
  - `setScreen` scrolled to the top on EVERY render, so making a pick threw
    you back up the page. Only a real screen change scrolls now.
  - Contrast, measured: **`--mu` failed AA in Champagne (3.37:1)** and is now
    `#726a5a` (4.74:1); `--mu2` fails in BOTH palettes and must never carry
    text — the two places that did now use `--gy`.
  - ⚠️ **Two test bugs cost real time and are worth remembering.** A contrast
    harness initialised `'rgba(0,0,0,0)'` but compared `'rgba(0, 0, 0, 0)'`,
    so the parent-walk never ran and EVERY ratio was measured against black —
    three "failures" against correct CSS. And the demo seeder wrote through
    `adminSetPick`, so the new deadline guard correctly refused its
    backfilled weeks 1-3 and the fixture silently lost them; the seeder now
    writes straight to the store, because fixture generation must not
    impersonate a commissioner.
  - Verified: **390 checks** across sixteen suites (behaviour, matchup/grid,
    byes, four iPhone sizes, accessibility, audit fixes, the not-shared-yet
    guards, the deployment/stranded-link path, and the zero-touch relative
    experience).
- **The relatives do NOTHING but tap a link — verified, not assumed.** With
  the two constants baked into the deployed file, a phone that has never
  opened the app and has nothing in its localStorage lands in `cloud` mode
  with: no password field, no sign-up, no install prompt, no setup screen and
  **zero dialogs**. The config comes from the FILE, which is the whole reason
  it must live there (see the `pickStore()` note above). The only person who
  ever touches Supabase is the commissioner, once.
- **First-run welcome** (`.welcome`, `survivor:welcomed`) — someone opening a
  link from a text message has no idea what they are looking at. One short
  dismissible card names them, says "pick one team you think will win",
  states the two rules that make this pool unusual (never knocked out, never
  the same team twice) and promises nothing to install. It shows ONLY before
  a player's first pick and only on the Pick screen, so it can never sit
  between a returning player and the game list.
- **✅ Every pick goes through a confirmation step** (`askConfirm` →
  `#confirm`, `savePick`). Owner's ask: *"there should be a confirmation pop
  up... that should help if people accidentally click a team."* A tap on a
  team NEVER writes — it opens a full-screen panel naming the team, the
  opponent and the kickoff, and (when replacing) the team being dropped. A
  pick spends a team for the whole season, and a shaky hand, a pocket or a
  scroll all produce accidental taps, so this is error prevention, not
  ceremony.
  - **The SAFE option takes focus, and both answers are the same size** (66px).
    A cancel that is harder to hit than a commit is not a real cancel.
  - **It names the CHANNEL (v28)** — owner's ask. The panel already carried
    the opponent and the kickoff, so where to watch it is the last thing you
    would otherwise go looking for. Its own line (`.cf-tv`), not another
    clause on a line already holding a venue and a time; absent entirely
    when ESPN lists no broadcast rather than an empty 📺.
    - ⚠️ **`normGame` was only reading `broadcasts`.** ESPN publishes the
      channel in TWO shapes and which one it uses varies by sport and week —
      `geoBroadcasts[].media.shortName/callLetters` is the richer one. The
      main app's `tvFor()` has read both for many versions; survivor now
      does too, deduped. Reading only one would have shown a blank channel
      on live NFL games while every demo game showed one.
  - Backing out via the button, Escape, or the backdrop all leave the
    existing pick untouched.
  - ⚠️ **`pinBody`/`unpinBody` replaced the inline body-pinning in
    `openSheet`.** Two overlays can now be involved (pick from the matchup
    card → confirm), and the old code would have unpinned on the first close
    and left the page scroll-locked. It refcounts; `askConfirm` also closes
    the matchup sheet first so the two never actually stack.
  - ⚠️ **Any test that taps a team must now also click `#cf-yes`** — five
    suites asserted the old direct-save behaviour and failed against
    perfectly correct code.
- **🐑 "With the crowd, or against it" REPLACED head to head (v34).** The
  owner: *"I don't like the head to head part of stats. Anything else we could
  use there?"* He was right to bin it — two dropdowns, two taps, and a duel at
  n=8 that is mostly noise. Given four options he picked this one.
  - `crowdStats()` finds, for each settled week, the single team the family
    piled onto, and grades it. The card then states **the crowd's own record**
    ("has won 0 of 3 weeks, and tied 2") and lists each person by **how often
    they were on it**, with their W-L on the weeks they were not.
  - **Sorted most-contrarian first**, because that is the interesting end.
  - ⚠️ **A COUNT ("1 of 5"), never a percentage (v37).** The owner read "0%"
    beside a "4-1" record and asked *"Just so I get it like 4-1 is 0%?"* —
    which is exactly the confusion two adjacent numbers of different KINDS
    create. At five weeks a percentage is false precision anyway, the same
    reason head to head was always a count. **The two columns are labelled
    now** ("Went with them" / "On your own"), because a footnote at the bottom
    of the card does not reach the eye that is reading row six.
  - ⚠️ **A tie is a real outcome (house rule 6)**, so wins + losses does NOT
    equal the week count and the card names the tied weeks separately. A test
    asserting W+L === weeks fails against correct code.
  - ⚠️ **Weeks with no single most-picked team are skipped entirely** (a tie
    for most-picked, fewer than three graded picks, or nobody doubling up).
    There is no crowd to be with or against, and inventing one would be worse
    than showing less.
  - ⚠️ **Every read goes through `pickVisible()`** — the rule for anything
    touching more than one player's picks. Without it this card would be a
    side channel for a hidden Thursday pick.
  - ⚠️ **Do NOT reuse `.st-n` here.** It is 14.76px, which is fine inside the
    matchup SHEET (the owner asked for tiny footnotes there and a test pins
    them under 15px) but breaks the 15.5px floor that applies in a TAB. The
    card has its own `.cw-n` at .88rem.
  - The old `headToHead`, `paintH2H`, their change handler and their CSS were
    all removed **by name, not by line range** — the mistake this file records
    twice already.
- **📊 Stats tab — the deep layer, built from the research spec.** Owner's
  rule was *visible for all but never in the way*, so it is a fifth tab and
  nothing about it touches the Pick screen. Per player: a headline **bench
  strength** ("how strong are the teams you have NOT spent"), which is the
  number that actually carries a non-elimination season — nobody is
  eliminated, so *what have you got left* is the real tension. Tapping a row
  opens their full numbers in the matchup sheet: luck vs judgement (actual
  wins minus the market's expected wins), style (backs-favourites rate,
  underdog wins, how contrarian), and form (streaks, average win/loss margin,
  biggest win, worst beat). Plus league-wide: **week winners**, **head to
  head**, and **most-picked teams**.
  - **Every number carries a SHORT footnote** (`statRow` → `.st-n`), not a
    paragraph. A stat nobody can read is worse than no stat, but the first
    cut explained each one in two or three sentences and the sheet ran to
    ~4600px; the owner: *"Don't take up so much space explaining. Small
    footnotes. I like the colors and visuals u had."* So it is back to the
    compact `.sh-t` tables with coloured values and a ≤40-character line
    under each — and the full definitions live in a **folded "What do these
    mean?"** accordion for anyone who wants them. Measured **1554px**.
    ⚠️ The footnote is `text-align: left` inside a right-aligned cell: a
    wrapped footnote reads far better ragged-right than ragged-left.
    Tests assert every row has a footnote, that the longest stays ≤60
    chars and under 15px, that the accordion exists and starts closed,
    that the sheet stays under 3400px, and that no statistical jargon
    (variance, regression, EV, de-vig…) appears anywhere.
  - ⚠️ **Verb agreement matters here.** The copy is generated for "you" OR a
    named person, so `vb()` adds the -s: "you take coin flips" but "Patti
    takes coin flips". Without it every sentence about somebody else read as
    broken English. ⚠️ The test for this needs a lookbehind — "Did Patti
    win" is correct (auxiliary + bare infinitive) and a naive regex flags it.
  - ⚠️ **Two rules this screen may never break.** (1) Anything reading MORE
    THAN ONE player's picks goes through `pickVisible()` — otherwise a stats
    page becomes a side channel for reading a hidden Thursday pick. (2)
    Market-derived numbers state their `n` and say they use the **closing**
    line, not the line at pick time: ESPN only ever serves a finished game's
    last posted odds. Storing odds at pick time was considered and rejected —
    it breaks "picks are the only thing stored" for a family-fun stat.
  - Head-to-head is a **count** ("Jack 5 — 3 Nana"), never a percentage;
    at n=8 a percentage is noise wearing a confident face.
  - 🚨 **`[object Promise]` bug worth remembering.** The insertion anchored on
    `function renderAdmin` while the file had `async function renderAdmin`,
    so the `async` was welded onto the new block's first line — `pctStr`
    became async and every percentage rendered as `[object Promise]`, while
    every heading assertion still passed. **Assert rendered VALUES, not just
    labels**; the suite now checks for `[object ` and for real digits.
- **☀️ Opens in light mode always.** It used to follow the OS, so half the
  family would get a dark app they never chose, and dark is the harder read
  for aging eyes. A deliberate tap of the theme button is still remembered
  per device (`survivor:palette`).
- **↩︎ A way back to the current week.** Someone who taps ‹ a few times to
  look at earlier weeks has no obvious route home, and being stranded in
  week 4 wondering why they cannot pick is exactly the kind of stuck this
  app cannot afford. `S.liveWeek` tracks the week the NFL is actually on
  (separately from `S.week`, which is the week being LOOKED at), and the
  week nav renders **"↩︎ Back to this week (Week 10)"** whenever they differ
  — naming the destination rather than just saying "back". The label also
  gains a red "not this week". Tapping it clears `weekPinned`, so the app
  resumes following the season on its own. Shown on both the Pick and
  Standings navs; absent entirely when you are already on the current week.
- 🚨 **"View as" was a ONE-WAY TRIP.** It overwrote `survivor:me` with the
  other player's token and navigated, so the commissioner became that person
  — losing the Admin tab and any route home short of knowing his own link.
  Now the admin token is stashed in `survivor:viewas` first, and a red
  `.viewbar` rides above the tabs on **every** screen: "👀 You're viewing as
  Nana · Back to my account". Impersonation is a state you must never be
  able to forget you are in.
  - ⚠️ Hopping straight from one person to another keeps the ORIGINAL admin
    token (`if (!lsGet('survivor:viewas'))`), or the way home would be lost
    on the second hop.
  - The bar survives a reload, and a stale stash (already back on your own
    account) clears itself rather than nagging.
- **The admin roster is one collapsed row per person.** Four actions plus a
  name on one flex line crushed the name to ~40px — "Cousin Dave" rendered
  as "C... D...". Each person is now a `<details>`: the name is the summary
  (56px tap target), the four actions open underneath. For 18 people that is
  **1457px instead of ~6100px**, and nothing truncates at any width.
  - **Per-person private links are GONE**, along with the bulk "copy every
    link" — both were from the superseded mint-and-text-20-links design.
    The one case they covered (new phone, name already claimed so it is no
    longer on the join list) is covered better by **Put back on list**,
    which uses the flow everybody already knows. ⚠️ It does NOT disturb a
    phone that is already signed in: `whoami` ignores `claimed_at`, so the
    old device keeps working and a second device can claim the same name.
  - Three actions remain, named for what they DO — **Put back on list**
    (was the jargony "Release"), **View as**, **Remove** — with a folded
    "What do these buttons do?" explaining each, including that Remove
    deletes their picks and Put back on list does not.
  - ⚠️ Any test clicking `[data-unclaim]`/`[data-view]` must open the
    containing `<details>` first.
  - ⚠️ **Deleting dead code by line range bit twice here.** Removing the
    `data-copy` handler swallowed `ad-copyjoin` (which sat between it and
    `data-view`), and removing `linkFor` swallowed `isShared`/`linkWarnOK`.
    Both were caught by tests. Cut by NAME, not by "everything up to the
    next function".
- **The pick card carries the FIXTURE, and every team button its chance
  (v29).** Two owner asks in a row, and they are the same instinct: put the
  thing you would otherwise go hunting for on the screen you are already on.
  - The "you can still change it" card now reads **team → who they play and
    when → 📺 channel → the instruction**, in that order, because the
    instruction is what you already know by the second week. A live card
    gains the channel too, which is the moment you most want it.
  - `matchupLine(g, team)` is the ONE description of a fixture, used by the
    card and the confirmation alike, so they can never word it differently.
  - Every team button shows **"68% to win"** — `matchupRead`'s own number, so
    it can never disagree with the ⓘ card, and absent entirely when no line
    is posted or the game has already started. It is the MARKET's view, said
    once under the heading rather than on thirty-two buttons.
- **🪖 The helmets survive a bad moment now (v30).** The owner: *"Bring back
  the helmet logos i liked that."* They were never removed — but they are
  fetched from `a.espncdn.com` and were wired `onerror="this.remove()"`,
  which is **permanent**: one failed load (a tunnel, a dead spot, an ESPN
  hiccup) deleted that logo for the life of the render, and because a whole
  slate loads at once a single bad moment could strip every helmet on the
  page. That is almost certainly what he saw.
  - `logoHTML`/`logoFail` retry once after 700ms and, only if that also
    fails, leave the team's **abbreviation in a badge occupying the exact
    same 34px box** (76px in the confirmation). There is always something,
    the hole never appears, and nothing on the page shifts.
  - ⚠️ **A sandbox screenshot can never show these** — egress to
    `a.espncdn.com` is blocked, so every helmet fails here and always will.
    Route-fulfil them in the test (`ctx.route('https://a.espncdn.com/**')`)
    rather than concluding anything from a blank card.
- ⚠️ **Type floors are deliberate and must not be lowered**: 18px base, ≥56px
  tap targets, and every `input` at ≥16px (the iOS focus-zoom rule the workout
  lab documents). A "Bigger text" toggle takes the base to 22px.
  - 🚨 **They were being broken in seven places, and the check could not see
    it (v29).** `.lk-score` (15.05px, since v24), `.lk-k`, `.game-at`,
    `.h-opp`, `.ibtn-l` (**13.28px** — the spread pill), `.ibtn-i` and
    `.byebar b` all used `em` inside a parent that had already shrunk, so
    they computed under 15.5px. Every one is `rem` now.
  - ⚠️ **The reason it went unnoticed is the lesson.** `a11y.js` swept for
    small text on *whichever screen the previous section happened to leave
    it on* — the standings — so nothing on the Pick or My Picks screen was
    ever measured. It now walks all five screens. Same shape as the two
    suites that went quiet in v26: **a check that never looks is worse than
    one that fails.**
  - The commissioner's own Admin panel is exempt where it renders keys and
    SQL in monospace — that screen is one person, not the family — and
    `.ibtn` (the little ⓘ) is deliberately 44px, the iOS floor, asserted
    separately so the exemption is visible rather than waived.
- Verified by driving the real page in headless Chromium at 390px in both
  palettes — **86 checks across two suites**: all six house rules (including the store refusing
  a reused team and refusing a pick on a kicked-off game), no duplicate teams
  across a seeded season, other players' picks not leaking onto the standings
  screen, a missed week not counting as a loss, running point totals adding up
  to the season total, sorting, the personal link signing someone in with no
  password and NOT granting them admin, zero horizontal overflow at 320/390px,
  the 44px tap-target floor on all four screens, and no console errors —
  plus 14 bye-week checks and 60 iPhone checks across four device sizes —
  plus the matchup card (its three projection sources incl. both fallbacks,
  the favourite carrying the shorter moneyline, a used team offering no pick
  button, a final leading with its score) and the grid (one row per player,
  one column per played week, no hidden pick leaking, agreeing with the
  table, scrolling in its own box rather than moving the page).
- **ⓘ Matchup card** (`matchupRead`/`matchupBlurb`/`matchupHTML`, the `#sheet`
  bottom sheet) on every game: projected winner with a win-probability bar,
  a short written read, the Vegas line (spread · O/U · moneyline), and both
  teams' overall/home/away records — plus a pick button, and a warning when
  a side is already used. ⚠️ **The "projected winner" is THE MARKET'S view,
  not a model of our own**, and the copy says so. Porting Sports-Hub's model
  would drag half of `app.js` into a page twenty relatives can open, and the
  de-vigged moneyline is both a better forecaster and honestly stateable.
  - 🚨 **The PERCENTAGE comes from the de-vigged MONEYLINE and nothing else
    (v39).** The owner: *"The win percentage should be based on money line not
    the spread as well... but still show the spread in the little information
    widget."* It used to fall back to converting the spread through
    `ncdf(-s/13.5)`, which is a **rule of thumb, not a market price** — it
    assumes every game carries the same scoring variance and it invents a
    precision the book never quoted. On screen the two were indistinguishable
    while only one of them was actually somebody's money.
  - **The spread is untouched as INFORMATION**: it still shows in the ⓘ pill,
    still fills the Vegas-line table, and still names the favourite when no
    moneyline is posted. It just never becomes a percentage.
  - With a spread but no moneyline the card shows the projected winner with
    **no number**, and the read says *"No moneyline is posted, so there is no
    percentage to quote."* Records remain the last resort for naming a
    favourite, labelled as such. With neither it says so rather than guessing.
  - ⚠️ `NFL_SD` and `ncdf` survive — the DEMO prices its fixtures with them —
    so grepping for `ncdf` still hits `matchupRead`'s comment, which names the
    conversion it deliberately does not do. **A test asserting its absence
    must strip comments first**, or the explanation reads as the offence.
- **"What does LEFT mean here?" → the column is GONE (v31 → v32).** It was
  `32 - used`, how many NFL teams you still have available. v31 renamed it
  "Teams left" and explained it in the note; the owner's answer was better:
  *"Remove that from the standings everyone's gonna have the same teams left
  mainly."* He is right — everybody plays the same weeks, so the column read
  22 / 22 / 23 / 22 down the page. **A column whose values are all the same
  is not information, it is width**, and it was taking width from the names.
  - **The count still lives where it is ABOUT you**: the "Teams left" tile
    and the used-team chips on My Picks, and the Stats tab. `tallyFor`'s
    `used` field stays for them.
  - 🚨 **It surfaced that the table was truncating NAMES** — "Grandpa J…" is
    in the owner's own screenshot from BEFORE any of this. Same fault the
    admin roster had ("Cousin Dave" → "C... D..."), and a person's name is
    the one thing in a table that must never be cut. The name column wraps
    instead of ellipsing; **that fix stays**, and with the column gone every
    name now fits on one line anyway.
- **▲▼ Rank movement in the standings (v33).** Owner: *"put a trend arrow to
  show the rising and falling each week."* `trendMap` ranks the league twice —
  as it stands now, and as it stood at the end of the week before the last
  graded one — and stacks the difference under the rank number.
  - **Stacked under the rank, not given a column.** A fifth column is what
    crowded the names in the first place (see the "Teams left" entry); this
    costs the name column nothing.
  - **`tallyFor` gained an optional `uptoWeek`.** Every other caller omits it
    and is unchanged; it exists only so the league can be ranked as of a past
    week.
  - **The baseline is the last COMPLETE week (v37).** It used to be the last
    week with any graded pick — which mid-week is the week in progress, so the
    arrows measured a half-played week: empty all Sunday morning, then
    appearing one at a time as games ended. The owner: *"The trend should
    still be live from the week before... just make it show the trend that we
    have and then when final game in finished we update standings for the
    new."* `lastCompleteWeek` requires every game in the week to be final, and
    both sides of the comparison are settled weeks, so the arrows are **stable
    all week** and roll over only when the next week is genuinely done. The
    note names the week they belong to ("when week 9 was played").
  - ⚠️ **Nobody who has not moved carries a mark (v36).** v33 drew a dash on
    every unchanged row, which mid-week is EVERY row — and under a rank number
    a dash reads as a stray mark, or worse as a minus sign attached to the
    rank. Absence is the cleaner way to say "no change", and the note under
    the table already explains what ▲▼ mean and names the baseline ("since
    the end of week 9"). Mid-week the column is simply empty, which is both
    truthful and quiet.
  - ⚠️ **Ranks are NOT a permutation**: tied players share a rank and the next
    is skipped, so the moves do **not** have to sum to zero. A test asserting
    that fails against correct code — assert instead that the table starts at
    1, never goes backwards, and that each arrow equals a re-derived
    `was - now`.
  - 🚨 **Caught by test, invisible to the eye:** the first cut passed
    `renderStandings`'s local `games` (THIS week's slate) where `trendMap`
    wanted `S.games` (the whole season, week -> games). It threw nothing and
    rendered nothing at all.
- 🚨 **The sticky name column must be OPAQUE on every row (v40).** The owner
  sent a screenshot of the week-by-week grid with earlier weeks' cells sliding
  over his own name. Cause: `.gr tr.you .gnm` highlighted your row with
  `--pos-bg`, which is an **rgba tint at .12 alpha** — so it replaced the
  column's opaque `var(--sf)` and the cells scrolling underneath showed
  straight through. It is the tint layered over an opaque surface now
  (`linear-gradient(--pos-bg, --pos-bg), var(--sf)`): identical colour,
  nothing visible behind it.
  - The scrolling `td`s may stay translucent — they sit on the card and have
    nothing passing under them.
  - ⚠️ **The general rule: a `position: sticky` cell can never take a
    translucent background.** Anything highlighting a row in this grid has to
    composite over `var(--sf)`.
  - The test asserts every name cell's computed `background-color` is alpha 1
    in both palettes, and — the real proof — scrolls the grid to the end and
    uses `elementFromPoint` at the name's centre to confirm the NAME is what
    is painted on top while cells are physically underneath it.
- **Standings has two views** (`S.stView`): the W-L-T table (default) and a
  **week-by-week grid** (`seasonGridHTML`) — player rows × week columns,
  colour-coded win/loss/tie/no-pick, modelled on the pool app the family
  already used. Both read the SAME `tallyFor`, so they cannot disagree; a
  test asserts they list the same players, order and records. The grid
  auto-scrolls to the newest week (otherwise it opens on week 1 with the
  live column off the right edge) and **honours the hidden-pick rule**, so
  an unstarted pick shows 🔒 rather than the team.
- **🕓 The week turns over on TUESDAY at 4 AM EASTERN (v38).** The owner's
  rule. `weekFromClock` decides the week from the clock alone; `currentWeek`
  is now just that plus the demo override, and **makes no network call**.
  - ⚠️ **It used to read ESPN's `week.number`,** which flips on ESPN's own
    schedule — often Tuesday afternoon, sometimes Wednesday. The app could sit
    on a finished week for a day and a half, still offering picks on games
    that had already been played. **The clock decides the week now; ESPN is
    asked only for scores.**
  - **4 AM, not midnight**, for the same reason Sports-Hub's `sportsDate()`
    uses it: a west-coast Monday-night game can run past midnight Eastern, and
    somebody opening the app right afterwards should still see that week.
  - **Eastern, because everybody in the league is** — and via `Intl` with a
    real time zone, NOT a fixed UTC offset. 4 AM Eastern is 08:00 UTC in
    September and 09:00 UTC in December; hardcoding either slips the rollover
    by an hour for half the season. There is a test for exactly that boundary.
  - ⚠️ **`WEEK2_TUESDAY` is the ONE date to change each season**, and it must
    be a Tuesday: the first rollover, i.e. the Tuesday after week 1's Monday
    night game. Everything else is derived. Weeks clamp to 1–18, so the
    off-season can never produce week 0 or week 40.
- **🧪 THE OVERNIGHT STRESS TEST (v41–v43).** The owner, going to bed:
  *"deploy some sub sonnet agents to stress test this app. Use tons of real
  scenarios and things that could go wrong structurally visually or anything
  in between."* Five agents attacked from different directions — house rules,
  security, failure modes, visual/layout, and a relative's journey. **Four
  correctness blockers and one visual blocker came back.** They are worth
  reading as a set, because every one of them is a thing the existing ~600
  checks could not see, and each failure mode has a general shape.
  - 🚨 **A DECIDED WEEK COULD BE RE-PICKED — the open question from v26,
    answered.** Take the Broncos on Thursday, watch them lose, then switch to
    a Sunday team: **the loss vanished AND the spent team came back.** A pick
    is one row per player per week, so a change overwrites rather than adds —
    which is right before kickoff and catastrophic after it. It breaks "never
    the same team twice", which is not a matter of interpretation, so it was
    closed rather than asked about.
    - **The pick row stores its own `kickoff` now.** That is the whole fix:
      the guard needs to know when YOUR pick's game starts, and previously
      only the NEW team's kickoff was ever checked. So `submit_pick` in
      `schema.sql` can enforce it without knowing the NFL schedule — the same
      trick that lets the database enforce the bye rule.
    - Held in **four places**: both stores, `submit_pick`, and
      `admin_set_pick`. **The commissioner is not exempt** — "helping Nana
      with her late pick" would erase the result she already has.
    - Changing a pick whose game has NOT started works exactly as before, and
      still frees the team you moved away from.
  - 🚨 **The Stats tab leaked hidden picks.** "Teams left" and "best left"
    counted a player's secret pick, so mid-week their count dropped by one and
    a team disappeared from their best-left list. Since the sensible play is
    usually your best remaining team, **the name that vanished often WAS the
    pick** — a subtraction is a side channel exactly like a list is.
    `usedTeamsVisible` withholds other people's unstarted picks; your own
    still count against your own bench, because you already know them.
    - ⚠️ **This is the second time this rule has been broken by a screen that
      never displays a pick.** `pickVisible` is not a rendering helper — it
      gates anything that READS more than one player's picks, including a
      count, a maximum, or a difference.
  - 🚨 **A scoreless "final" froze the week forever.** ESPN can report a game
    `post` with one score still `null` at the whistle. The week cached to the
    device permanently: the result never counted, the week was never
    re-fetched, and **two relatives could see different standings for the same
    finished game all season**. A week only freezes now when every game is
    final AND both scores are real numbers, and a bad copy already on a phone
    is dropped on sight. ⚠️ `state === 'post'` is not the same claim as "this
    game has a result".
  - 🚨 **A dead browser store stranded people permanently.** Safari private
    mode, or iOS evicting storage from an app opened once a week, produced
    "This link isn't working — ask Jack" **with no way out**, because the
    token lives in the URL and could not be written down. `storageWorks()` is
    a canary write that tells the two cases apart and names the real cause.
    ⚠️ The wrong diagnosis is worse than none: it sends the one person who
    could fix it to the one person who cannot.
  - 🚨 **THE ADMIN TAB WAS OFF-SCREEN — for the commissioner, on his own
    phone (v43).** `.tabs` was `grid-auto-columns: 1fr` with `nowrap` labels,
    so the row's intrinsic width was the sum of five labels: on a 320px phone
    the **whole page** became 376px and the Admin tab rendered entirely
    outside the viewport, with no scrollbar and nothing hinting the page could
    move sideways. In **Bigger Text** — the grandmother-facing accommodation —
    it happened at 375, 390 and 430 too, i.e. every phone size this app tests.
    - **A relative sees four tabs and they fit.** That is why every prior
      layout pass missed it: they were all run signed in as a relative.
      `tests/fit.js` signs in as the **commissioner** and is the only suite
      that does.
    - It is `flex-wrap` now. Whatever does not fit moves to a second row, at
      full size — a wrapping bar cannot hide a control, and shrinking the type
      to make five fit would have broken the floor this app exists for.
  - **Three more of the same bug, and the shape is worth naming.** A CSS grid
    track that cannot shrink does not clip locally — it **pushes the DOCUMENT
    wider than the phone**, and the overflow is then only reachable by
    scrolling the entire app sideways, which nothing advertises. It cost:
    - **Week winners lost the result.** "Buccaneers +20" painted past the right
      edge, so most rows read as a team name and nothing — the answer to the
      question the section exists to answer, silently gone. ⚠️ **Shrinking the
      tracks was not enough**: at 22px Bigger Text the single word
      "Buccaneers" is wider than any share of 320px it can be given, so the
      result **wraps to its own line** instead.
    - **Most-picked teams printed the name over its own bar** — a hard 62px
      column could not hold "Commanders", at *every* width, with stock data.
    - **My Picks** rows crowded their running total against the card edge.
  - 🚨 **The week-by-week grid truncated names — the one rule this app has
    already learned twice.** `.gr .gnm` still had `text-overflow: ellipsis`,
    so "Grandpa Bartholomew" rendered as "Grandpa Bar…" in the one screen
    built for everybody to find their own row. **A person's name is the one
    thing in a table that must never be cut**; the standings table and the
    admin roster were both fixed for this and the grid was never brought
    along. Fixed here and in `.wp-nm`, `.cw-nm` and `.plrow .pn` at the same
    time — grep for `text-overflow` before adding another.
  - **`--mu2` carried text for a third time**, on `.cg-go` — the `›` that is
    the ONLY cue a condensed row is tappable, at **2.56:1** in the default
    palette. It is `--gy` now. That token must never carry text; it has now
    been caught three times.
  - **Also fixed:** the week never advanced on a page left open (the refresh
    gate went false forever once a week finished — the clock is re-read every
    tick now, and only the score re-fetch stays gated); admin proxy-picks
    overwrote silently and never showed what was already there; a raw
    `submit_pick failed (409)` could reach a relative's screen; `claim_player`
    could hand two people the same identity (TOCTOU — it is a conditional
    `update … where claimed_at is null returning *` now); a failed save
    reported success (the verification read back the value it had just failed
    to write); an unreadable kickoff **failed open**; a slow submit had no
    timeout and no "saving…"; names had no length cap; and an unreachable
    branch that read a token with no admin check is gone. Matchup-sheet
    labels sitting at 13.3–14.0px were lifted and moved to `rem`.
  - **New suites: `locked` (14), `leak` (9), `resilience` (11), `fit` (116).**
    ⚠️ **`fit` is the durable half of the visual fix** — it checks the thing
    the user experiences ("is any of it off the edge of my phone") rather than
    any one selector, **as the commissioner**, on all five screens, at
    320/375/390/430, with Bigger Text on and off. A selector-level assertion
    would have passed on all four of these bugs.
  - ⚠️ **One regression this found in my own tests:** `confirm.js` cleared the
    current week with `adminSetPick(…, null)` to get a clean slate, which the
    new locked-week guard correctly refuses — so the SETUP failed silently and
    every assertion below it then ran against a locked slate with no buttons
    to measure. It walks to a pickable week now and **asserts the slate has
    pickable games before measuring anything.** Same lesson as v26 and v29: a
    check that measures nothing is worse than one that fails.
  - ⚠️ **An agent's contrast harness produced ~4,970 false positives** by
    reading a gradient's stops without accounting for **alpha** — the v40
    sticky-name fix layers a .12 tint over an opaque surface, which it read as
    solid green. Same family as the trap this file already documents for
    plated fills. Verify a "failure" against the composite before believing it.
  - ⚠️ **Still unverified:** `schema.sql`'s new guards have never met a live
    Postgres — the sandbox has none — so they are written carefully and must
    be confirmed when the project is created.

- **🥈 "Best chance" — a second way to order the slate (v44).** The owner:
  *"For current week and future weeks allow us to be sorted by time like it
  is now as default, but then they can sort by % to win which sorts out the
  ones they already picked and gives the remaining options with highest % to
  win."*
  - **The two orders answer different questions, and that is why the second
    one is a list of TEAMS rather than of games.** Kickoff order is the
    schedule — how the week actually happens, and what you want when you are
    looking for a particular game. "Best chance" is the question you ask when
    you are *choosing*: out of the teams I have left, who is most likely to
    win? A game has two sides and you can only take one, so ranking games
    would have answered a question nobody asked.
  - ⚠️ **A team you have already used is ABSENT, not greyed out.** That is
    the owner's word — "sorts out" — and it is right: in a list headed "what
    can I still pick", a spent team is not a dimmed option, it is not an
    option. (In the kickoff view it stays visible and struck through, because
    that view is the slate, not a set of choices.)
  - **The percentage is `matchupRead`'s own number** — the de-vigged
    moneyline and nothing else, per v39 — so the list, the team button and
    the ⓘ card physically cannot disagree. A test asserts every rendered
    percentage equals `matchupRead`'s to the point.
  - ⚠️ **A team with no line posted is MOVED, never dropped.** It sorts to
    the end under a line saying why it carries no number. Silently hiding a
    team you could legitimately pick would be a worse error than showing one
    without a percentage.
  - **`.pk` is reused verbatim**, `data-team` and all, so a tap goes through
    the same `askConfirm` as every other pick. ⚠️ It must never become a
    second write path.
  - **Kickoff order stays the default and is unchanged**, and `S.pickSort`
    lives in memory only — a reload returns to kickoff order, which is what
    "default" has to mean, while switching weeks inside one visit keeps your
    choice.
  - 🚨 **It surfaced that the app was still OFFERING picks the store refuses.**
    v41 closed the "a decided week can be re-picked" hole in both stores and
    in `schema.sql`, but the UI never caught up: on a locked week "Show the
    full matchups" still drew live team buttons, so a tap now produced an
    error message instead of doing nothing. The buttons are `disabled` on a
    locked week, and the sort control is not offered there at all — there is
    nothing to choose, so there is nothing to sort. **When a rule moves into
    the store, check what the screen is still advertising.**
  - 🚨 **`.wknav-l i` — "not this week" — had been at 14.04px all along**, and
    no suite had ever measured it, because `a11y.js` only ever ran on the
    LIVE week where that line does not render. It is the one thing telling
    somebody why they cannot pick on a week they wandered into. Now `.88rem`.
    **Fifth instance of "a check that never looks is worse than one that
    fails."**
  - ⚠️ **`tests/_pickable.js` — the shared setup, and why it exists.** Three
    suites broke at once on the disabled-buttons change, all doing
    `[...document.querySelectorAll('#s-pick .pk')].find(x => !x.disabled)` on
    the demo's week 10, whose pick has already kicked off. The walk-to-a-
    pickable-week is written once now and **throws if it lands somewhere with
    no live buttons**, rather than letting the suite below it measure
    nothing. `run.js` skips `_`-prefixed files so a helper is not run as a
    suite.
  - ⚠️ **`helmet.js` was passing on page height.** It asserted "a badge for
    every team" and "a second request per logo" over the whole page, but the
    logos are `loading="lazy"` — one below the fold is never requested, so it
    never fails, so it never falls back. Both assertions were true only
    because everything happened to fit; adding a ~56px control pushed two
    images past the threshold and it "failed" against correct markup. It
    scrolls the page first now. **A lazy image is not a rendered image.**
  - Verified: **44 checks** in `tests/sortodds.js` — kickoff order still the
    default and still in real kickoff order (read from the DOM, not from
    `S.games`, which is fetch order); used teams absent; one row per
    remaining option, none disabled, none duplicated; strictly descending;
    the top row equal to the best remaining option; every percentage matching
    `matchupRead`; unpriced teams last and still present; a tap going through
    the confirmation and saving; the view holding across the save; the
    control absent on a past week and present on a future one; no sideways
    scroll or sub-floor type at 320 and 390; and a decided week offering
    neither a sort control nor a live button.

- **🗄️ `schema.sql` is no longer unverified — `tests/schema.js` (45 checks).**
  It was the only component with zero coverage and it is the one that will
  actually run in production. There is no Postgres SERVER in the sandbox, so
  behaviour still cannot be proved — but the two things that would otherwise
  fail *silently on the family's phones* now are:
  - **It parses, PL/pgSQL function bodies included**, under **libpg_query**
    (`pip install pglast`) — the same parser Postgres itself uses. A syntax
    error inside a `$$ … $$` body is opaque to the outer parser and invisible
    to any amount of reading; it would have surfaced only when the
    commissioner pasted the file into the SQL editor and the league failed to
    exist. All 35 statements and all 10 plpgsql bodies parse.
  - **Every RPC the app calls exists, with EXACTLY the argument names it
    sends.** ⚠️ **PostgREST resolves a function by its NAMED arguments**, so
    one renamed parameter is not a type error anywhere in the JS — it is a
    404 at the moment a relative taps a team, and no browser suite can ever
    see it because the sandbox never reaches Supabase. The suite reads the
    call sites out of `survivor.js` and the signatures out of the SQL and
    compares them both ways, so an argument the app stops sending is caught
    as well as one the database stops accepting.
  - It also pins: every RPC granted to `anon` (a missing grant is a 403),
    `picks` revoked at the table so a write can only go through
    `submit_pick`, `players_public` never selecting the token column,
    `SECURITY DEFINER` on the four functions that touch rows anon cannot, and
    that the v41 guards (`p_kickoff is null`, `now()` in both `submit_pick`
    and `admin_set_pick`, the `UNIQUE` no-repeat constraint) are really in
    the file rather than only in the changelog.
  - ⚠️ **Without `pglast` it SKIPS and says so, rather than passing.** A suite
    that quietly measures nothing is the failure mode this repo has recorded
    three times.
- **☁️ THE LEAGUE WENT LIVE (v46), and turning it on found four bugs.** The
  owner created the Supabase project; `SUPABASE_URL`/`KEY` are now filled in
  at the top of `survivor.js`, so the deployed file alone puts every phone in
  the shared league with no setup by anybody. The key is the **anon** one,
  which is safe in a public file for the reasons in `schema.sql`'s header —
  and a test now asserts it is anon and never `service_role`.
  - 🚨 **Demo mode would have written into the real league.** It swaps the
    SCHEDULE for a made-up one but kept writing picks to whatever store was
    configured — so with Supabase live, "Load a demo family" would have put
    **18 invented relatives into the actual roster**, and any pick made in
    demo mode would have gone to the real league carrying a **fake kickoff**,
    letting it slip past a real deadline. There was a confirm dialog in front
    of it, which is not the same as being safe. `pickStore()` now returns
    `LocalStore` whenever `survivor:demo` is on, **whatever is configured**.
    The demo is a sandbox on your own phone; nothing it does can reach anyone.
  - 🚨 **`_get` leaked the browser's own error onto the boot screen.** It had
    no try/catch and no timeout, unlike `_rpc`, so an unreachable Supabase
    printed **"Failed to fetch"** under "Couldn't reach the league database" —
    the same class of bug as the v41 `submit_pick failed (409)`, and the same
    reader. It now degrades like `_rpc`, and the boot failure is no longer a
    dead end: it says a signal problem is the likely cause, promises nothing
    is lost, and offers **Try again**.
  - 🚨 **A dead browser store was blamed on the network.** `storageWorks()`
    was only consulted inside `renderPicker`'s `hadToken` branch, and boot hit
    the network first — so Private Browsing plus an unreachable league said
    "check your signal", which will never work. **Storage is checked FIRST
    now**, because it is the unrecoverable cause, and the check was hoisted
    out of `hadToken` as well: somebody arriving with NO link on a browser
    that saves nothing was being offered the first-run setup, i.e. invited to
    build a league that could not survive closing the tab.
  - **🧪 `tests/cloud.js` (35 checks) — SupaStore had ZERO coverage until
    now.** Every other suite runs on `LocalStore`, so the code that actually
    runs for twenty relatives had never been executed once. `tests/_fakesupa.js`
    answers the app's HTTP calls with a model of `schema.sql`, which proves
    the CLIENT half: a fresh phone lands in cloud mode off the file alone,
    every request carries the `apikey` header, `players_public` never returns
    a token, a name-tap signs somebody in and never grants admin, and — the
    one that matters — **two separate browser contexts sharing one backend
    see each other's picks.** Plus every refusal arriving as a sentence
    (`"You already used the LV in week 10"`) rather than a status code, and
    demo mode provably adding nothing to the real roster.
    - ⚠️ **It is a MODEL of the schema, not the schema.** It cannot prove
      `schema.sql`, which has still never met a live Postgres.
      `tests/schema.js` covers what static analysis can. **Keep the two in
      step: a rule that moves in `schema.sql` moves in `_fakesupa.js` too.**
  - ⚠️ **`tests/_pw.js` — why 33 suites suddenly needed a shim.** With a real
    league configured, a fresh browser boots into cloud mode, and the sandbox
    cannot reach supabase.co — so every UI suite died at boot. That is the app
    behaving CORRECTLY (with a league configured, the first-run screen must
    not offer a stranger a demo league to start), so the suites opt in
    instead: the shim sets `survivor:demo` before any page script runs, and
    demo forces the on-device store. **It sets a DEFAULT, not an override** —
    `addInitScript` runs on every navigation, so setting it unconditionally
    undid `share.js`'s own `demo = 0` on the next reload, which failed against
    correct code. `cloud.js` and `deploy.js` deliberately use the real
    playwright, or they would test the local store while claiming otherwise.
  - ⚠️ **Two suites were asserting a state the app can no longer be in.**
    `deploy.js` tested "a relative arriving at an UNCONFIGURED app" — one now
    exists, so it stubs the backend and one assertion is **deliberately
    inverted**: arriving with no link must NOT offer setup any more, because
    that would let a relative create a second empty league and strand
    themselves in it. Its "the two lines really do switch everyone on" check
    patched the two EMPTY constants and silently became a no-op once they were
    filled. **When the world changes, a test that still passes is the
    dangerous one; these failed, which is the good outcome.**

- 🚨 **`schema.sql` FAILED on its very first real call (v47) — pgcrypto vs
  `search_path`.** The owner ran the file (clean: "Success. No rows
  returned"), then the commissioner seed, and got
  **`function gen_random_bytes(integer) does not exist`**.
  - **The mechanism.** Tokens were built with `gen_random_bytes` from
    **pgcrypto**. On Supabase, extensions install into the **`extensions`**
    schema — and every function here is hardened with
    `set search_path = public`, which cannot see it. `create extension if not
    exists pgcrypto` succeeded, so nothing looked wrong until a function
    actually ran.
  - **The fix is NOT to widen the search_path.** That hardening is what stops
    a search_path attack on a `SECURITY DEFINER` function, and these functions
    are the only write path in the app. Tokens now use **`gen_random_uuid()`**,
    a PostgreSQL **built-in** (13+) living in `pg_catalog`, which is on the
    search path whatever `search_path` is set to. Same six hex characters, no
    extension, hardening intact.
  - ⚠️ **This is exactly the gap `tests/schema.js` documented and could not
    close.** The file parsed perfectly — libpg_query has no opinion about
    whether a called function will be *reachable at runtime*. It does now:
    a check asserts no hardened function calls a known extension function
    (`gen_random_bytes`, `crypt`, `digest`, `uuid_generate_v4`…). **The
    general rule: a function hardened to `public` may only call things in
    `public` plus built-ins.**
  - ⚠️ **And that check first failed on its own explanation** — the comment
    saying why `gen_random_bytes` was removed NAMES it, so scanning the raw
    file read the explanation as the offence. It strips `--` comments now.
    Third time this repo has hit that; `ncdf` was the first.
  - **Re-running the whole file is safe and is the fix** — every statement is
    `create or replace` / `if not exists` / `if exists`, so it is idempotent.

- **♿ THE TREMOR BUG, and six more from the accessibility audit (v49).** The
  fifth stress-test agent's angle — a relative's journey, and screen-reader /
  keyboard semantics. It reported the Bigger-Text flow, the tables, Escape,
  the error copy, the focus ring and the never-colour-alone rule all CLEAN,
  and then found this:
  - 🚨 **A shaky hand could confirm a pick it never read.** The confirmation
    exists for exactly one person, and for a fifth of the slate it was doing
    the opposite: two taps ~90ms apart at the SAME POINT — an ordinary tremor
    double contact — had the first open the panel and the second land squarely
    on **"Yes — that's my pick"**, because that is where Yes renders over a
    card scrolled to mid-screen. Which games it happened on was decided by
    **scroll position alone**. Verified end to end: the pick saved, gold card
    and all, with the question never read. And `touch-action: manipulation`
    means iOS does not swallow the second tap as a zoom, so it fires for real.
    - **`CONFIRM_ARM_MS` (600ms):** Yes opens `disabled` and arms after the
      window, with `yesArmed()` refusing an early activation even if a
      dispatched event gets past the attribute. `askName` gets it too —
      choosing who you are takes a name off the list for everybody.
    - ⚠️ **It must LOOK unavailable for as long as it is** (`.cf-yes:disabled`
      at .45). A time gate alone would leave a button that looks tappable and
      is not, which is the confusion this app exists to avoid. 600ms is far
      under the time it takes to read a team name, so a deliberate tap never
      meets it.
    - ⚠️ **The test REPORTS how many taps land on Yes rather than asserting
      it** — that number depends on scroll position, game count and panel
      height, so pinning it would break the suite on any layout change. The
      assertion is that **none of 22 tremor double-taps saves anything**.
  - 🚨 **Focus walked straight out of the modal, and the screen changed
    underneath it.** The backdrop hides the app visually; it hides nothing
    from Tab or from VoiceOver, whose swipe order follows the DOM and not the
    z-index. One Tab press left the dialog, and activating the Standings tab
    from there genuinely switched the screen under an unanswered "Is this
    right?". The background is `inert` while either overlay is open.
    - ⚠️ **`inert` stops a PERSON, not a dispatched click** — found by test,
      when a programmatic `.click()` sailed through it. `setScreen` refuses
      while `S.confirming`, so the app does not depend on the overlay being
      the only thing in the way.
    - ⚠️ **`body` is not an escape.** At the end of the tab ring focus leaves
      the document and `activeElement` reads as `body`; the next Tab comes
      back. The assertion is that ten Tab presses never reach anything
      *activatable* outside the dialog.
  - 🚨 **`aria-labelledby="cf-title"` pointed at an id that did not exist**, so
    the app's single most consequential dialog had **no accessible name at
    all** — a dangling reference produces none, and VoiceOver announced a bare
    "dialog". Both users of `#confirm` now carry the id.
  - **The tabs never said which one was selected.** `aria-selected` was never
    set on any of them, ever: the active tab was communicated only by a CSS
    class, so the app's primary navigation was five identical unlabelled
    buttons. Set in `setScreen` alongside the class, and every screen is a
    real `role="tabpanel"`.
  - **Focus was dropped to `<body>` by the live-score poller.** The team grid
    is replaced wholesale by `innerHTML`, and `render()` runs every 60s while
    games are on — so a keyboard or switch user who focused a team and paused
    to think lost it mid-decision, with no cause they could see. `render()`
    remembers the focused `data-team` and puts it back.
  - **Nothing was ever announced.** `say()`'s messages had no live region, so
    a screen-reader user tapped Yes and nothing happened as far as they could
    tell — and the usual answer to that is tapping again. `role="status"`.
  - **`#notme` sat at 44px.** The one control between a brand-new signee and
    playing a whole season under somebody else's name, and the a11y sweep
    could never see it: that suite runs as a player who has already picked,
    and this control is deliberately gone by then. 56px now.
  - **New suite: `tremor` (23 checks).**

- 🚨 **A tracked `node_modules` SYMLINK failed every Pages build (v48).**
  Pages was on, the build ran, and the only clue was one line in a log:
  `tar: ./node_modules: File removed before we read it`. Pages builds by
  tarring the checkout with `--dereference`; a symlink pointing outside the
  repo dangles on the builder, tar exits 1, no artifact is produced and **the
  site never deploys**.
  - **The cause is a gitignore subtlety worth knowing: `node_modules/` with a
    TRAILING SLASH matches a directory only.** The symlink added so the
    suites could find Playwright is not a directory, so git tracked it. It is
    `node_modules` (no slash) now, and the symlink is untracked.
  - Guarded in `tests/deploy.js`: **no tracked symlink of any kind**,
    `node_modules` never tracked, and `.gitignore` written so a symlink of
    that name is caught. A total, silent deploy failure is exactly what has to
    fail in the suite instead.

- **🔗 TWO LINKS: the real league and the demo (v50).** The owner: *"is there
  a link for the demo and the live for me to save?"* There wasn't — demo was a
  localStorage flag with nothing to bookmark. `?demo=1` / `?demo=0` set it now.
  - ⚠️ **The parameter is STRIPPED once applied.** Anything that sets
    `location.search` (signing in does) would drop it anyway, and left in
    place it rides into any link the owner copies out of his own address bar
    — which is exactly how a relative ends up in a demo making picks that
    count for nothing. The bookmark still works: it is re-read on every open.
  - 🚨 **The two modes were logging each other out.** localStorage is
    per-ORIGIN, so both share one bucket — and `survivor:me` was ONE key for
    both. Flipping to demo left the REAL token sitting there, which the
    on-device store cannot resolve, so the app dropped to the join screen;
    flipping back could strand the demo token instead. **`meKey()`** returns
    `survivor:me:demo` in demo mode: two modes, two identities, neither able
    to overwrite the other.
  - 🚨 **Demo mode was an INESCAPABLE dead end, and the owner hit it.** Since
    v46 demo forces the on-device store, so a phone left in demo could not
    resolve a real token — and the screen said *"this league hasn't been
    switched on yet"*, blaming the league. The way out is the Admin tab, and
    you cannot reach Admin because you cannot sign in. It now names the real
    cause and carries a **Leave demo mode** button.
  - **Three wrong guesses in a row, and what each cost.** Worth reading as a
    method failure, not just a list:
    1. Twelve suites went red. Two passed standalone, so it was called
       "probably interference" — **it was not**, and the next full run
       reproduced all twelve identically. *A suite that passes alone and fails
       in the run is a difference in STATE, not noise.*
    2. Then blamed on the new demo-dead-end branch firing too broadly.
       Scoping it to `hadToken` was a genuine fix (arriving with no link in
       demo mode is the normal way in, not a dead end) but changed nothing:
       still twelve.
    3. Reading one actual failure took a minute and gave the answer:
       `#first-demo` never appeared, because the demo-link **auto-seed ran on
       every demo boot**, so there were always players and the first-run
       screen could never render. Seeding is a property of arriving **by the
       link**, once — gated on `askedForDemo`, not on `S.demo`.
    ⚠️ **The lesson: read one failure before forming a hypothesis.** Two
    guesses cost two full ten-minute suite runs; the log cost sixty seconds.
  - ⚠️ **`join.js` / `wrongname.js` reach into the stored identity** to fake a
    fresh phone. They ask the app for the KEY (`meKey()`) rather than naming
    `survivor:me`, or they silently stop referring to the live one.
  - **New suite: `twolinks` (20 checks)** — each link opening its own mode,
    the demo provably not touching the real roster, the parameter stripped,
    the DEMO badge, re-opening not reseeding over a season in progress, and
    the one that matters: **neither mode logs you out of the other.**

- **🧪 THE DEMO WAS TELLING THE COMMISSIONER HIS LEAGUE DID NOT EXIST (v51).**
  Found by a health check, not by the suites. Since v46 demo mode forces
  `LocalStore` **whatever is configured**, and the Admin screen branched on
  `S.store.kind === 'cloud'` — so with the league LIVE, opening Admin in the
  demo led with a red `.warnbox`: *"⚠️ Not shared yet — do not send links ·
  Connect a free Supabase project below"*. Every word of that is false about
  his actual league, and it invites him to paste config into the box the app's
  own 🚨 warning says configures **only his own phone**.
  - **The cause is one predicate doing two jobs.** "Is a real league
    configured" and "are we talking to it right now" are different questions,
    and demo mode is exactly the state where the answers differ.
    **`leagueConfigured()`** reads the file constants (or the device
    override) and knows nothing about which store is live; `isShared()` is
    unchanged and still gates anything that hands a link to a human.
  - The status box has **three states**, not two: connected · *"🧪 You're in
    the demo season — the real league **is** connected and untouched"* with a
    **Leave demo mode** button right there · and the original red warning,
    which now appears only when no league really is configured.
  - **And the "Shared database" section FOLDS once the league exists.** It is
    a five-minute job done ONCE, and it was holding roughly 40% of the Admin
    screen for the rest of the season — pushing the roster and the proxy-pick
    box, which are used every week, below a wall of finished setup. It is a
    `<details>`, **`open` when there is no league yet** (then it is the most
    important thing on the page) and shut afterwards under *"Shared database
    — already set up"*, with the steps reworded so they stop reading as an
    unfinished chore.
    - ⚠️ **A closed `<details>` contributes NO `innerText` and cannot be
      filled**, so `share.js` and `deploy.js` open it before measuring — the
      same rule the per-person roster rows already have. Without that they
      would not have failed; they would have measured an empty string, which
      is this repo's oldest and worst failure mode.
  - ⚠️ **Third time this app has blamed the wrong thing**, and the shape is
    always the same: v46 told a dead browser store to check its signal, v50
    told a phone stuck in demo that the league had never been switched on.
    **When two states share a symptom, they need two predicates** — the
    wrong diagnosis is worse than none, because it sends the one person who
    could fix it to do something that cannot work.
  - 🚨 **TWO SUITES WERE ASSERTING THE BUG.** `share.js` ("device-only mode is
    unmissable") and `deploy.js` ("both warnings present") both ran with the
    demo ON against a configured league and demanded the red *"do not send
    links"* box — so the wrong message was not an oversight the tests missed,
    it was a behaviour they *pinned*. **They failed on the fix, which is the
    good outcome**, exactly as they did when the league went live at v46.
    Each claim is now tested where it is actually true: the demo page asserts
    the demo copy, and a second context **route-patches the two constants
    empty** to reach the genuinely-unconfigured state and assert the red box
    there. ⚠️ **When a test fails on a fix, ask which of the two is wrong
    before touching either** — the answer here was the test, and the reason
    was that it could only ever reach one of the two states.
- **🚨 `tests/nana.js` — the suite covering the whole promise asserted
  NOTHING (v51).** It printed six lines about a relative's fresh phone (no
  password, no sign-up, nothing to install, no setup screen, no dialogs) and
  had **zero assertions**, so it could never fail. Sixth instance of "a check
  that never looks is worse than one that fails", sitting on the one journey
  the app exists for.
  - ⚠️ **And it had drifted past quiet into WRONG.** Its headline said the
    phone "landed in cloud mode **from the FILE**, not her device" — but
    since v46 the shared `_pw` shim forces demo mode on every suite, which
    forces `LocalStore`. It was printing a claim while measuring its
    opposite. Like `cloud.js` and `deploy.js` it now requires
    `playwright-core` directly and answers the league over `_fakesupa`, so
    the cloud path is really the one under test. **15 real checks.**
  - ⚠️ **Its "nothing pushy on screen" sweep flagged the welcome card**, which
    promises *"Nothing to install and nothing to remember"* — the opposite of
    the offence. **Fourth time this repo has read an explanation as the thing
    it explains** (`ncdf`, `gen_random_bytes`, the SQL comment). The sweep
    strips the negation first, and a table proves it still catches "create an
    account", "install the app", "sign up", "enter your password".
- **⚙️ A cloud session could not run the suites at all (v51).** `node_modules`
  is deliberately untracked — a tracked symlink of that name once failed
  every Pages build — and `pglast` is not in the image, so every fresh Claude
  Code web session began by hand-installing both or, worse, skipping the 38
  suites that are this app's entire safety net.
  **`.claude/hooks/session-start.sh`** installs `playwright-core` and
  `pglast` on a remote session and is a silent no-op locally. Verified from a
  genuinely empty state: `rm -rf node_modules`, uninstall `pglast`, run the
  hook, suites green.
  - ⚠️ **It equips the HARNESS, never the app.** The shipped thing stays six
    files with no build step and no dependencies; nothing the hook installs
    is served to a phone.
- **📄 The README had said "35 suites, 856 checks" for three releases** while
  the real figure climbed past 900 — the same failure as `?v=1` sitting
  unchanged through sixteen releases. **A number somebody has to remember to
  bump is a number that eventually lies**, so the README no longer carries
  one: the runner prints the tally and is the only place it is stated.

- **✏️ PEOPLE CAN CHANGE THEIR OWN NAME (v52).** The owner: *"allow people to
  change their name if they would like."* `rename_me(p_token, p_name)`, a
  folded **"Change my name"** on My Picks, and the same validation as
  `join_league` — empty, a 28-character cap, and a case-insensitive duplicate
  check — held in both stores, `schema.sql` and `_fakesupa.js`.
  - ⚠️ **It stays available ALL SEASON, where `release_me` does not.** That
    asymmetry is the whole design. Releasing takes a name off the roster and
    orphans the picks attached to it, so once picks exist it is a real
    decision and belongs with the commissioner. A rename takes nothing from
    anybody — **same row, same id, same picks, same token** — so there is
    nothing to adjudicate and no reason to make somebody text him about it.
  - 🚨 **THE TOKEN IS NOT RE-MINTED.** It is derived from the name, but only
    once, at creation; after that it is the credential — in localStorage, in
    the address bar, in whatever Home Screen icon they made. A rename that
    re-mints it **signs somebody out of their own bookmark**, which is the one
    thing this app promises never to make them deal with. Asserted in both
    `rename.js` and `cloud.js`.
  - The duplicate check **excludes yourself**, so `nana` → `Nana` is a fix
    somebody is allowed to make rather than a clash with themselves.
  - ⚠️ It lives on **My Picks, not the Pick screen** (that screen has one
    job), and **LAST on it rather than first**. Directly under the heading is
    where it belongs by meaning and the wrong place by use: a control
    somebody touches once ever was pushing the record, the points and every
    week's pick down the page on every visit. Same mistake the Admin setup
    panel had, and the same fix — **once-ever controls go last.**
  - 🚨 **`say()` only sets `S.msg` — nothing paints without `render()`**, and
    two of the new early returns lacked one. So the two most likely mistakes
    (an empty box, and tapping Save without changing anything) produced
    complete silence, which reads as a broken button. Found by test.
  - ⚠️ **A refusal must not also bin what they typed.** `render()` rebuilds
    the `<details>` shut, so a rejected name slammed the panel closed and
    threw away the typing, leaving an error pointing at a control no longer on
    screen. `S.renameOpen` / `S.renameTried` hold both.
  - ⚠️ **Two test traps worth remembering.** (1) `maxlength` **defeats
    `page.fill()`**, which honours it and hands the app a perfectly legal
    28-character name — so a "the store rejects 40 characters" check proved
    only that Playwright respects an HTML attribute. It sets `.value`
    directly now, which is what a paste or an autofill actually does. (2) The
    cloud suite's first draft asserted a clash against `"Nana"` **while
    signed in as Nana** — renaming her away frees that name, so the refusal
    it demanded was one the code was right to withhold. A clash needs
    somebody ELSE's name.
- 🚨 **EVERY `<details>` IN THE APP WAS INVISIBLE TO THE a11y SWEEP (v52).**
  Caught while folding the Admin setup panel — and it turned out to predate
  that change entirely. `a11y.js` skips any element with **no `offsetParent`**,
  and a closed `<details>` gives its children exactly that, so the per-person
  roster rows, the "What do these buttons do?" accordion and the stats
  explainers had **never** been measured against the 15.5px floor while the
  suite reported a clean sweep. Given this app shipped seven type-floor
  violations in a single release (v29), that is not a theoretical hole. The
  sweep opens every `<details>` on each screen first.
  - ⚠️ **And it now asserts it SWEPT something** (`swept > 400` elements).
    The failure this suite keeps having is not a wrong answer, it is
    measuring nothing and reporting a pass — so the count is checked, not
    just the absence of findings. **Sixth instance, and the first caught
    before it shipped.**

- **📲 ADD TO HOME SCREEN LOCKED THE COMMISSIONER OUT OF HIS OWN LEAGUE
  (v53).** The owner saved the demo link to his Home Screen, tapped the icon,
  and got the join screen of the REAL league with every name already claimed
  and nothing he could tap. Three faults in one chain, reproduced end to end
  in `tests/homescreen.js`.
  - ⚠️ **The fact underneath all of it: an iOS Home Screen web app gets its
    OWN storage container.** Nothing comes across from Safari — not the token,
    not the demo flag, not the theme. **So the captured URL is the only thing
    that can carry mode or identity into it**, and Add to Home Screen captures
    **the address bar as it is at that moment**, not the link that was opened.
    Anything the app strips from the address bar is therefore something a Home
    Screen icon can never have.
  - 🚨 **`demo=1` is no longer stripped.** v50 stripped it so it could not ride
    into a copied link, and noted that "the bookmark still works". That is true
    of a SAVED LINK and false of the Home Screen — which is the one he actually
    uses — so his demo icon was silently an icon for the live league. The copy
    risk is guarded where it happens instead: **"Copy the league link" emits
    `origin + pathname`** and never the query, and `linkWarnOK()` already stops
    a copy in demo mode. `demo=0` is still stripped, because nothing needs to
    carry it. **A saved link that quietly becomes a different app is the worse
    failure.**
  - 🚨 **"Everyone on the list has already joined" was a DEAD END.** With every
    name claimed there was nothing to tap, and the only remaining control —
    "type your name" — refuses a name already in the league. The screen stated
    a fact, offered the one action that cannot work, and stopped. It now names
    the cause (*this phone does not know you yet*), says plainly that typing
    the name **will not work**, and gives the two real ways out: open your own
    link, or ask for **Put back on list**. Third time this app has stated a
    symptom without its cause; see the v46 and v50 entries.
  - 🚨 **The commissioner had no way to save his own link — Admin now shows
    it.** Per-person links were dropped as a leftover of the mint-and-text-20-
    links design, which was right for everybody else: a relative who loses
    their phone gets **Put back on list** and taps their name again. But that
    path runs THROUGH the commissioner, so it can never be the commissioner's
    own path, and his name is claimed like anybody's. On any device that does
    not already know him he was locked out with no route back short of the SQL
    editor. **"Your own link"** prints it with a copy button and the Add to
    Home Screen instructions.
    - ⚠️ **It carries admin, so it is shown only to an admin** and the copy
      says plainly not to send it. A relative has no Admin tab, so the control
      does not exist for her at all — asserted, not assumed.
  - ⚠️ **`twolinks.js` was pinning the stripping**, exactly as `share.js` and
    `deploy.js` pinned the "not shared yet" bug two versions ago. It failed on
    the fix, which is the good outcome. It now asserts the property that
    actually has to hold — **the link the app HANDS OUT is clean** — rather
    than the mechanism that was one way of achieving it. **Assert the promise,
    not the implementation.**
  - **New suite: `homescreen` (24).**

- **🔗 THE ADDRESS BAR IS NOW ALWAYS CAPTURE-READY (v54).** The owner, on the
  general case rather than his own: *"This is gonna get screwed up when people
  add there name in browser then add the app the Home Screen... browser has me
  as admin and home app doesn't. How can we stop this disconnect."* He is
  right, and v53 only fixed his half of it. Two causes:
  - 🚨 **`signInWith` wrote `location.search = '?u=…'`, which replaces the
    WHOLE query string** — so the moment anybody tapped a name in the demo it
    destroyed `demo=1`, leaving an address bar pointing at the REAL league
    while the phone itself was still in the demo. That is exactly the split he
    described: Safari knows you, the icon does not.
  - 🚨 **The token was only in the URL for the instant after signing in.** A
    relative who tapped her name on Monday, closed Safari and re-opened the
    texted league link the next week was signed in from localStorage with a
    **bare** address bar — and Add to Home Screen at that moment captures a
    link that knows nobody. `boot()` now rewrites the URL to match who this
    phone is on every load (`replaceState`, so no navigation and no history
    entry), so the icon works **no matter when it is made**.
  - **`urlForMe()` is the one description of "the URL this phone should be
    showing"**, and it is mode-aware. ⚠️ **In demo it carries NO token**:
    demo identities are per-device, a fresh Home Screen container reseeds with
    *new* tokens, so a captured `?u=<demo token>` would resolve to nothing and
    show "this link isn't working". `?demo=1` alone reseeds and lands on the
    commissioner, which is what a demo icon should do.
  - 🚨 **Switching mode is a NAVIGATION, not a reload — and this was a bug I
    introduced.** Once `demo=1` stays in the address bar it is the AUTHORITY
    (`applyModeFromURL` runs before anything reads the stored flag), so
    "Leave demo mode" setting the flag and reloading put you straight back
    into the demo. Every switch goes through **`goMode()`** now, and
    `dm-seed`/`dm-wipe` land on the URL that matches the mode they leave you
    in. **Caught by `tests/share.js`**, which flips modes exactly that way —
    a suite testing something else entirely.
  - **`isStandalone()`** tailors the dead-end copy: from a Home Screen icon
    the advice is *"an icon keeps its own separate memory — open the app in
    Safari, check your name is at the top, then Add to Home Screen again"*,
    which is real advice there and nonsense in a tab.
  - ⚠️ **`join.js` was asserting `?u=` in demo mode**, which is precisely what
    this removes. The property it was reaching for still holds — the address
    bar is something an icon can usefully capture — so it asserts *that*, per
    mode, and the live half is proved in `homescreen` (**32 checks**).

- 🚨 **THE COMMISSIONER COULD REMOVE HIMSELF, AND IT WAS UNRECOVERABLE
  (v55).** The owner did it — *"I had removed myself on the browser before is
  that why it's screwed up"* — and yes, that was it. **This is THE
  unrecoverable action in the app**, and nothing was guarding it:
  `admin_del_player` checked only that the caller was an admin, then deleted.
  - **Why it cannot be undone from inside the app.** `admin_add_player` only
    bootstraps a commissioner while `players` is **EMPTY**, and the roster
    still has everybody else in it; `join_league` **never grants admin,
    however it is called**. So a league that loses its last admin has no way
    to get one back — no Admin tab, no "Put back on list", nothing. The only
    route is the Supabase SQL editor, which is not a thing this app may ever
    require of anybody.
  - **What it looks like from the outside is the thing that makes it nasty:**
    the deleted name is gone from the roster, so it is not on the join list
    either, and everybody else has joined — so the screen says *"Everyone on
    the list has already joined"* and offers a name box that refuses you.
    Identical to the Home Screen symptom of v53, from a completely different
    cause. **Two causes, one screen** — which is why the v53 copy names the
    cause rather than restating the symptom.
  - **Held in four places**, like every other rule here: the roster does not
    draw the button (for yourself, or for the last admin), both stores refuse,
    and `admin_del_player` counts the admins server-side rather than trusting
    the client. Removing an ordinary relative is unchanged.
  - ⚠️ **Refusing self-removal is the right rule even with two admins.** From
    the Admin screen it is only ever a mis-tap: there is no "hand the league
    to somebody else" flow, so nobody has a reason to delete their own row.
    The message points at **Put back on list**, which is the recoverable thing
    they probably wanted.
  - **New suite: `lastadmin` (12).**
  - ⚠️ **And the roster query cleared him: he had NOT removed himself.** One
    row, `Jack`, `is_admin true`, `claimed true` — the league was intact and
    the phone had simply lost the token. **Three independent causes produce
    that one screen** (a Home Screen icon's separate storage, a deleted admin,
    and cleared site data), which is exactly why the copy has to name a cause
    rather than restate the symptom. The guard stays: it is right on its own
    terms, and it was never the diagnosis that mattered.
  - 🚨 **THE COPY ADDRESSED ONLY ONE OF ITS TWO READERS.** "Typing your name
    below will not work — it is already taken, by you" is true of somebody
    returning and **false for a brand-new relative** whose name was never
    pre-added, for whom typing is exactly the right thing to do. A league
    whose roster is just the commissioner puts EVERY relative in that second
    case — which is precisely the state the owner's real league was in when
    he sent the screenshot. It now answers both: *"New to the league? Type
    your name below — that works."* / *"Been here before? …"* **A screen
    reached by several routes has several readers; copy that assumes one of
    them is wrong for the others.**

- 🚨🚨 **`start_url` IN THE MANIFEST WAS OVERRIDING EVERYTHING (v57).** Four
  releases of address-bar work — v53's own-link, v54's `urlForMe()` and the
  boot-time rewrite — and the owner's Home Screen icon STILL did not know him.
  The cause was one line of JSON: `"start_url": "./"`.
  **When a manifest declares `start_url`, iOS uses THAT for the Home Screen
  icon, not the URL in the address bar.** So every icon he ever made opened
  the bare app with no token, however correct the address bar was, and none of
  the fixes above it could ever have worked on their own.
  - **`start_url` is simply gone.** With it absent the spec falls back to the
    document URL the icon was added from, which is exactly what every fix
    depends on. `scope`, `display`, the icons and the rest are untouched.
  - ⚠️ **It cannot be proved here — there is no iOS in the sandbox.** What
    `tests/homescreen.js` pins is the precondition: **the manifest must never
    carry a start URL.** That is the whole of what static analysis can say,
    and it is the thing that would silently undo the feature again.
  - ⚠️ **The lesson is about where I looked.** Every round measured the
    address bar, which was correct every time, and never asked what iOS
    actually reads when it makes an icon. **When a fix that is provably right
    keeps not working, the bug is in a layer nobody has looked at yet** — stop
    re-verifying the layer you already trust.
- ⚠️ **A `?u=` LINK NOW LEAVES THE DEMO (v57).** The owner opened his own
  commissioner link in Safari and got *"This phone is in demo mode"* with a
  button to press, because a demo flag left in storage days earlier outranked
  the link he had just tapped. **A stored preference must never outrank an
  explicit link.** An explicit `demo=` in the URL still wins over both.
  - 🚨 **The first cut of this was too broad, and two suites caught it.**
    `viewas` and `welcome` went red because **"View as" itself navigates to
    `?u=<token>`** — with `location.search = …`, the same whole-query-string
    replacement already fixed in `signInWith` and missed here — so viewing as
    somebody in the demo threw the phone out of the demo. The app was wrong,
    not the tests: `data-view` and `va-back` go through **`urlForMe()`** now,
    like every other navigation. **Asking which of the two is wrong before
    touching either is what found it.**

- **🥇 THE SPREAD IS A BACKUP AGAIN — v58 AMENDS v39.** The owner, looking at
  a real week-1 slate six days out with spreads posted and no moneylines:
  *"use the spread as percentage as a backup if or when the ML is not
  available."* Right, and the reason is one v39 could not see: **the books
  publish spreads long before moneylines**, so "moneyline only" meant no
  percentages at all on exactly the screen where somebody is choosing.
  - **The moneyline is still preferred and always wins when posted.** The
    spread is used only when there is none, via the `ncdf(-s/NFL_SD)` that
    v39 removed and that `NFL_SD`/`ncdf` were kept alive for.
  - ⚠️ **v39's actual complaint was never the number — it was that the two
    were INDISTINGUISHABLE on screen while only one of them was somebody's
    money.** That complaint stands, so the fallback is always LABELLED:
    `basis` says `'moneyline'` or `'spread'`, the ⓘ card says *"about 62%
    from the spread"* instead of *"on the moneyline"*, the written read says
    *"a rule of thumb, not a price anybody is quoting"*, and the team button
    prefixes **`~`**. One character, no extra line of type, and the two can
    never be confused.
  - Both pick views carry it — kickoff order and "Best chance" — because they
    read the same `matchupRead`, so the three can still never disagree.
  - 🚨 **`tests/mlonly.js` existed to pin the OLD rule and had to be rewritten
    rather than deleted.** It now enforces the thing that actually matters:
    every probability declares its source, a moneyline always beats a spread,
    and — the real safeguard — it **strips every moneyline from a live slate
    and asserts that every rendered percentage gains a `~`**, and that none
    of them carried one before. A test that only checked "a number appears"
    would pass with the distinction silently gone.
  - ⚠️ **`winpct.js` caught the copy, not the code.** The new note ended
    "Neither is a guarantee" and the suite wants the phrase *not a
    guarantee* — the assertion's intent was right, so the COPY was reworded
    rather than the check loosened. It did it a second time when the note was
    trimmed to bare "the market's own view": the suite wants **"betting
    market"**, and for a 95-year-old reader that really is the clearer phrase.
  - 🚨 **A BACKUP MUST NOT ANNOUNCE ITSELF (v59).** The owner: *"I said as a
    backup remember."* The LOGIC was already backup-only — moneyline strictly
    wins, verified in the running app — but v58 also put a `~` on every button
    AND three sentences on the pick screen, so a quiet fallback had become the
    loudest thing on the family's main screen. The `~` stays (one character,
    and without it a rule of thumb is indistinguishable from a price); the
    note is one short clause again and the full explanation lives in the ⓘ
    card, where somebody who cares will look.
    - ⚠️ **The test pins the LENGTH against its pre-fallback value (184
      chars).** "Short" is not assertable, but "no longer than before this
      feature existed" is exactly the promise being made — a backup that
      lengthens the copy on the screen twenty relatives read has stopped
      being a backup.

- ⚠️ **Unverified live:** the sandbox reaches neither ESPN nor Supabase, so
  the real week-scoreboard shape
  (`?dates=2026&seasontype=2&week=N`), `currentWeek()`'s read of
  `season.type`/`week.number`, and what each `schema.sql` function DOES with
  a real row are coded defensively but must be confirmed on device. (That the
  file installs, and that the app calls it correctly, is now covered — see
  above.)

## The v51 design merge (3 Sep 2026)

A design pass was drafted in Claude Design as a self-contained prototype and
handed over for implementation. **It was merged as STRUCTURE ONLY.** The
prototype's own palette — flat `#1f7a3d` green, `#c0342b` red, `#a8751f` gold —
was discarded on sight: those are the same three colours this app already has
as five-stop plates, drawn worse. The owner's brief was exact: *"take what they
did and merge it with ours so we lose nothing but gain the structural value."*
So every fill below is `--grad` / `--grad-pos` / `--grad-neg` / `--grad-tie`,
unchanged, and `tests/gold.js` still passes untouched.

**What the design pass was right about, and what came in:**
- **One sticky band at the top.** The brand, the week, the view-as warning and
  the tabs were four separate strips that scrolled away independently. They are
  one `.topbar` now, sticky, on a deep green ground (`--band`) in BOTH palettes
  — the band is identity, not a surface that follows the theme.
  - ⚠️ **`#viewas` is inside it on purpose.** The red "you are picking as
    somebody else" bar had a stated rule that it must never be off-screen, and
    before v51 it scrolled away like everything else. It also had to change
    colour: it was a pale `--neg-bg` tint carrying dark text, which is invisible
    on a dark ground, so it takes `--grad-neg`, the plate already measured to
    carry white.
  - ⚠️ **`.hd`, `#viewas` and `#tabs` stay separate elements** inside the
    wrapper. `INERT_WHILE_OPEN` finds each of them by its own selector.
- **The active tab did NOT become the design's gold underline.** It is still
  the plated gold pill with `--on-ac` ink, because that is pinned by
  `tests/gold.js` and by the owner outright. Only the RESTING tab changed, from
  a light pill (which would have floated on the dark band) to a quiet outline.
- **Condensed type for the scoreboard.** Team names, scores, margins, ranks,
  points, week numbers and section labels are Barlow Condensed; sentences,
  people's names and every line of explanatory copy are not. Condensed type is
  measurably harder to read at length, and this app's type rules exist for one
  95-year-old reader.
  - **It is SELF-HOSTED (`fonts/`, latin subset, three weights, ~67KB).** The
    design file loaded it from Google Fonts. `sw.js` never intercepts
    cross-origin, by design, so a CDN font is a file the app cannot cache — it
    would lose its own typography the moment a phone went offline, and flash on
    every cold load. Self-hosting also keeps `survivor.css`'s promise that it
    imports nothing. `OFL.txt` ships beside the files.
  - Everything condensed is set a notch LARGER than the face it replaced. A
    narrower letterform reads optically smaller at the same px; the 15.5px
    floor is a floor on the number, but legibility is the point of it.
- **The slate reads as two groups.** "Still to kick off" and "Already started",
  each under a gold rule (`.hh.rule`), and the same rule on every secondary
  heading across Standings, My Picks and Stats. That is where the gold the
  owner kept asking for actually went — into the frame, plus a gold hairline
  (`--gl`) on every list container and stat card.
- **A finished matchup is drawn as a RESULT, not a dimmed choice.** `.started`
  used to fade the whole card to `opacity: .6`, which faded the score — the one
  thing on it worth reading. Now the winner keeps full ink and takes the green
  plate on its score, a live game takes gold, and the loser is the only side
  that recedes.
  - ⚠️ **`:not(.chosen)` on both the fade and the surface.** YOUR pick keeps
    its gold plate whatever the score did, or you lose track of which team is
    yours halfway down a sixteen-game slate.
- **Plates where there were bare numbers**: the rank-1 badge, the standings
  points column, week-pick results, My Picks margins.
- **The arming window says how long it is.** The 600ms dead period on "Yes"
  now fills a gold rule under the button, so the dim state reads as *wait*
  rather than *broken*.

**Three traps this merge walked into, all worth remembering:**
1. ⚠️ **`text-transform: uppercase` changes `innerText`.** Three classes could
   not take the design's uppercase treatment, and only one of them was obvious:
   `.cf-team` (tests/confirm compares the rendered name to `teamName()`
   character for character — and independently of the test, the panel asking
   *"is this right?"* must show the name exactly as it will be saved);
   `.cf-team.cf-ask`, which holds *"Are you Grandpa Joe?"*; and `.sh-title`,
   which is a MATCHUP title on the Pick screen and a PERSON'S NAME on Stats,
   where `tests/stats` builds a grammar regex out of it.
2. ⚠️ **A backtick inside an HTML comment inside a template literal ends the
   template literal.** A explanatory comment written as ``<!-- `cf-ask` … -->``
   inside `askName`'s markup took the whole of `survivor.js` down with a syntax
   error, and 36 of 37 suites reported it as "S is not defined". Comments about
   markup go OUTSIDE the template, as JS comments.
3. ⚠️ **A plate is a box, and a box has width.** The standings table pushed the
   DOCUMENT to 333px on a 320px phone in Bigger Text — the precise failure
   `tests/fit` was written for — because every bare number became a padded
   plate. The fix was to stop paying for the gap twice: the plates have padding
   of their own, so `.st` cell padding dropped from 4px to 3px a side.
4. ⚠️ **Making the tab bar sticky changed what a tap at its coordinates hits.**
   `tests/tremor` taps where the Standings tab is while the confirm dialog is
   open, to prove the tap cannot switch the screen. It cannot — but the tab bar
   used to scroll away, so by that point in the run its box was often
   off-screen and the click reached nothing. Inside the sticky band the tab is
   always on screen and therefore always UNDER the backdrop, so the tap now
   lands on `.sheet-back` and CANCELS — which is what `confirm.js` requires of
   a backdrop tap, and is the safer outcome. The suite's next two checks were
   then measuring a closed dialog, so they re-open it first. **The app was
   right and the test's precondition had gone stale; that is the order those
   two possibilities should always be considered in.**

## How it came about

**🏈 Family Survivor League built (2 Sep 2026 — no `APP_VERSION` bump)** — the
owner's family has run a non-elimination survivor pool for years, built around
keeping his 95-year-old grandmother involved, and no off-the-shelf app models
it. Built as a standalone mini-app; see **Files** for the rules, the
architecture and the traps. Three things worth carrying forward:
- **The hard part was never the UI, it was shared state.** Every previous
  feature in this repo is either `localStorage` (per device) or a read-only
  backend. Twenty people picking against each other needs a real shared
  database, which is why this is the first thing here to use one (Supabase
  free tier). **The Render backend cannot do this job** — its free tier is
  in-memory with no disk, so the picks would vanish on every redeploy, and a
  30–60s cold start is fatal for the one user the league exists for.
- **A separate repo was always the plan, and the reason was never tidiness.**
  It was built inside the owner's Sports-Hub repo only so it could be opened
  on a phone; it moved to its own on 3 Sep 2026, before any family link went
  out. **See "Why it moved" above for the three reasons** — the first of them
  is that a relative could delete one path segment and land on the owner's
  betting model.
- **The six house rules were settled BEFORE any code was written**, because
  each one changes what gets built — "a missed week is not a loss" in
  particular is why `tallyFor` counts only graded picks and why a week with
  no pick burns no team.
