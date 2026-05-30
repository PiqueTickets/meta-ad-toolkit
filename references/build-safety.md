# /build-ads safety rules

Operator-facing rules the `/build-ads` skill cites when explaining why it asks for confirmation or refuses to proceed.

## Three-layer protection

Mutations only go through when **all three** are true:

1. **Skill explicitly invoked.** The operator types `/build-ads`. Read skills (`/weekly-report`, `/monthly-report`, `/show-report`, `/pacing-check`) cannot mutate because they don't create the marker file.
2. **Spec on disk and approved.** Every run produces a YAML spec at `specs/builds/<date>-<slug>.yml`. The operator approves by saying "execute" or by responding to the dry-run prompt. No spec, no execution.
3. **Dry-run preview cleared.** Before any mutation, `/build-ads` resolves all parent IDs, validates assets, resolves interpolations, and shows a summary. The operator must confirm.

## What `/build-ads` will do without asking

- Read `mcp__meta-ads__*` data (campaigns, ad sets, ads, insights) to validate the spec.
- Write the spec file under `specs/builds/`.
- Write the build log under `reports/builds/`.
- `touch .build-ads-active` at start, `rm -f .build-ads-active` at end.

## What `/build-ads` will always ask before doing

- Calling any `mcp__meta-ads__create_*`, `update_*`, `pause_*`, `resume_*` tool.
- Calling any `mcp__meta-ads-write__*` tool.

## What `/build-ads` will not do (ever)

- Roll back a partial spec. If a build halts mid-way, the operator cleans up manually in Ads Manager. Re-running the spec creates duplicates of any items that already succeeded.
- Mutate without the marker file. The `PreToolUse` hook in `.claude/settings.json` blocks any write tool when `.build-ads-active` is missing or older than 1 hour.
- Launch ads as ACTIVE by default. New creates default to `PAUSED`. The operator must edit the spec to set `status: ACTIVE`.

## Recovery scenarios

### "I killed the skill mid-run."

Two cases:

1. **A build was in progress** — the `.build-ads-active` marker is left behind. It self-expires after 1 hour. To clean up sooner: `rm .build-ads-active`. Check `reports/builds/<date>-<slug>.md` to see what was created; clean up the partial state in Ads Manager or by editing the spec to remove completed entries and re-running.
2. **No build was actually in progress** — same: `rm .build-ads-active`.

### "The spec half-ran because of a Graph API error."

Read the build log to see what got created (with IDs). Edit the spec to remove the completed creates. Re-run `/build-ads` against the edited spec.

### "I want to delete an ad I just created."

Use the `delete_ad` tool from `meta-ads-write` (the new MCP) — but it requires `confirm: true`. Or delete in Ads Manager.

## Costs to be aware of

- Every Meta write call costs 3× the rate-limit budget of a read call. A 9-ad spec costs roughly 27× a `/show-report` run.
- Uploaded video bytes count against the account's media storage quota (rarely a concern, but visible in Ads Manager).
- Status: ACTIVE ads start spending immediately.

## When `/build-ads` is the wrong tool

Do not use `/build-ads` for:

- **Mass campaign restructures.** Build the campaign in Ads Manager once, copy/duplicate from there. `/build-ads` is for repeatable, narrow operations like creative testing.
- **Audience hygiene.** Custom audience uploads (CSV / hashed email) are deferred to v2.
- **Carousel-format ads.** v1 supports single-video and single-image creatives only. Build carousels in Ads Manager.
