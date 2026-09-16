# Season protection — staged, not active

The owner's non-negotiable constraint is that current/future league links,
remembered identities, name selection, and the pick/confirmation process stay
unchanged. Only the approved recap is a new member-facing feature, starting
after all NFL Week 2 games are final.

## What shipped in v73

The app refreshes shared picks on resume and every minute when safe, preserves
last-good scores during failures, revalidates final scores after six hours,
corrects matched-sample expected wins, distinguishes spread estimates from
moneylines, and isolates its service-worker cache. Commissioner tools export
only token-free records, copy reminders without sending them, and no longer
offer permanent member deletion. No live database changes were applied.

## Approval block

Automatic approval review rejected the proposed live migration because it
would install database extensions, change privileges, and save a full private
recovery snapshot containing member credentials. Do not retry that live action
without explicit authorization. This repository contains a reviewable upgrade
script, not evidence that the upgrade is enabled.

`season-protection.sql` prepares server-controlled NFL schedule metadata,
serialized deadline/no-repeat checks through the existing function signatures,
append-only pick history, commissioner archive/restore, private recovery copies,
and scheduled schedule refreshes. It preserves all existing player IDs/tokens.
It has passed PostgreSQL syntax/PLpgSQL parsing, but has NOT been executed in
an isolated database or in production. Execution/rollback/parallel-write tests
must precede live activation after authorization. Publishing this file does
not run SQL. Do not paste it as part of routine setup or run schema.sql again
on an upgraded league: the original bootstrap would overwrite protections.

## Explicitly excluded: hidden-pick privacy cutover

Older open app pages do not authenticate their pick-read requests. Restricting
that endpoint would also hide a person's own upcoming pick. The owner forbids
that user-experience change, so this release and the staged upgrade retain the
existing endpoint/policy. Hidden future picks remain a family-trust convention,
not an API privacy guarantee. Do not change that policy without a separately
verified compatibility design. No tokens are rotated, and no links are replaced.

## Required activation checks (after permission)

1. Use an isolated Supabase project, not the family's production league. Create
   fixtures with entirely fictional names and freshly generated test tokens.
2. Apply schema.sql, then season-protection.sql. Confirm all 18 weeks load and
   every existing fixture pick matches the trusted schedule. A feed failure
   must roll back the transaction before write functions change.
3. Prove submit, replace, clear and commissioner proxy picks accept valid
   pre-kickoff choices with the exact legacy RPC argument names. Spoofed future
   client timestamps must not bypass the trusted kickoff. Same-team requests
   after kickoff must not rewrite the row. Race two writes on the same member.
4. Prove archive preserves picks, restore preserves ID/token, commissioner
   accounts cannot be archived, and invalid tokens cannot read history or
   create archives. Verify private tables, snapshots and helper functions are
   inaccessible to anon/authenticated. Run database security advisors.
5. Verify a saved old personal URL and a bare shared league link on both old
   and new client versions. Require zero new member steps and no lost picks.
6. Rehearse recovery below on the isolated fixtures, then verify exact player
   IDs/tokens and pick counts before/after. Never test recovery against live
   family rows. Record the snapshot ID without printing its payload.
7. With authorization, apply the upgrade transaction to the family project,
   verify the jobs and fresh schedule, rerun permission/aggregate read checks,
   and compare member/pick counts. Do not print or export member tokens.

## Recovery procedure and limits

Private snapshots are retained in the SAME database. They help undo accidental
row changes but are not an off-site disaster backup. Daily copies retain 90
 days; the pre-upgrade and pre-archive copies remain until deliberately reviewed.
Commissioner exports exclude credentials and cannot recreate login identities.

For recovery, a database operator first takes a new private snapshot and uses
one database transaction. Lock players and picks against concurrent writes;
compare the selected snapshot to current records by original IDs. Restore only
the explicitly affected rows using JSON record population, preserve IDs/tokens,
respect both pick uniqueness constraints, and repair identity sequences if
rows were recreated. Audit restored picks as database-maintenance. Verify counts,
IDs, kickoff values, and current rows before committing; roll back on any
unexpected difference. Never replace the entire live season with an old export.
The stored pre-upgrade function definitions and policy snapshot support a
controlled rollback of API definitions; validate them on the isolated project
first. This procedure is documented, not yet claimed as exercised.

## Next season

Keep the 2026 records; never clear players or regenerate their tokens. A new
season still requires an explicit rollover update to the JS season constant,
NFL week calendar, the private writer's season, and scheduled schedule jobs.
Test it against the preserved prior season before publishing. This release
does not pretend that automatic multi-season rollover already exists.
