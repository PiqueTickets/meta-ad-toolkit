# meta-ad-toolkit

`meta-ad-toolkit` — Claude Code skills for **event & ticketing marketers** to review Meta (Facebook/Instagram) ad performance and produce ranked, justified recommendations, plus a guarded `/build-ads` path that can mutate the ad account. Apache-2.0. The read skills are suggest-only; only `/build-ads` writes, and only behind an explicit, time-boxed authorization gate. Examples use a fictional brand, `Acme Events` — replace with your own in `references/account-context.md`.

## What's in here

- `.mcp.json` wires the open-source [`brijr/meta-mcp`](https://github.com/brijr/meta-mcp) MCP server (MIT, no third-party membership required).
- `.claude/settings.json` allow-lists the read tools and puts every Meta **write** tool (`create_*`, `update_*`, `pause_*`, `resume_*`) behind a `PreToolUse` hook — so the read skills can't touch your account, and `/build-ads` only writes after you explicitly arm it (see below).
- Four read-only skills under `.claude/skills/`:
  - `/weekly-report` — trailing 7-day account review → `reports/weekly/<date>-weekly.md`
  - `/monthly-report` — trailing calendar month → `reports/monthly/<YYYY-MM>-monthly.md`
  - `/show-report <name-or-id>` — single-show deep dive → `reports/shows/<date>-<slug>.md`
  - `/pacing-check` — quick mid-week health pulse (chat only)
- `/build-ads` — the only skill that mutates your ad account. Drafts a YAML build spec, dry-runs it, then executes after explicit operator approval. Backed by a bundled MCP server at `tools/meta-ads-write/`.
- `prompts/` — shared report template, recommendation rubric, and `build-spec-schema.md` for `/build-ads`.
- `references/` — Meta-mechanics explainers (Breakdown Effect, Learning Phase, auction basics), Acme Events-specific context, and `build-safety.md` covering `/build-ads` rules and recovery.

## Setup

1. **Mint a Meta access token.** In [Graph API Explorer](https://developers.facebook.com/tools/explorer/), select your app, click "Get Token" → "Get User Access Token" → check `ads_read` → "Generate Access Token". Exchange for a long-lived token via the documented [token-extension flow](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived). Long-lived user tokens last ~60 days.

2. **Create `.env`:**

   ```bash
   cp .env.example .env
   # then edit .env and fill in:
   # META_ACCESS_TOKEN=<your long-lived token>
   # META_AD_ACCOUNT_ID=act_<numeric>
   ```

3. **Install Node.js** (for `npx` to run the MCP server).

4. **Build the local write MCP:**

   ```bash
   cd tools/meta-ads-write
   npm install
   npm run build
   cd -
   ```

   > **Note on the read MCP:** `.mcp.json.example` wires the third-party
   > [`meta-ads-mcp`](https://github.com/brijr/meta-mcp) read server. Tool names vary
   > between versions of that package, so the allow-list in `.claude/settings.json`
   > may not match your installed version exactly. After first launch, if a read
   > skill reports a missing tool, reconcile the `mcp__meta-ads__*` entries in the
   > allow-list against the tools your `meta-ads-mcp` version actually exposes.

5. **Open this directory in Claude Code.** The MCP server auto-loads from `.mcp.json` on first use. Restart Claude Code if it was running before you populated `.env`.

6. **Run a skill:**

   ```
   /weekly-report
   /monthly-report
   /show-report "Sample Comedian"
   /pacing-check
   /build-ads        # the only mutating skill — see "Building ads with /build-ads" below
   ```

## Token refresh

Long-lived Meta tokens expire after ~60 days. `/pacing-check` includes a token health check and warns when expiry is near. To refresh, regenerate via Graph API Explorer and update `.env`.

## What the skills will and won't do

- **Read skills will:** read campaigns, ad sets, ads, creatives, audiences, and insights; write Markdown reports under `reports/`. They cannot mutate.
- **`/build-ads` will:** create campaigns / ad sets / ads / creatives / audiences, and pause/resume/update existing ones — but only after drafting a YAML spec, getting your approval, and showing a dry-run preview. See `references/build-safety.md` for the full rules.
- **Suggest-only enforcement** for read skills is layered: a `PreToolUse` hook on a marker file, explicit forbidden-tool lists in each `SKILL.md`, and rubric anti-rules. See `docs/architecture.md` for how the layers compose.

## Building ads with `/build-ads`

`/build-ads` is the project's mutation surface. It works in four phases:

1. **Conversational draft.** You describe what you want; the skill drafts a YAML spec at `specs/builds/<date>-<slug>.yml`.
2. **Spec review.** You read the spec (in chat or by opening the file) and either say "execute" or describe changes.
3. **Dry-run preview.** The skill resolves parent IDs, validates assets, and shows what will be created — including a prominent "New live ads: N" line if any creates have `status: ACTIVE`. New ads default to `PAUSED`.
4. **Execution.** Tools are called in spec order. Each call is logged to `reports/builds/<date>-<slug>.md`. On any error, the run halts and reports partial state — there's no automatic rollback.

For the full spec format, see `prompts/build-spec-schema.md`. For safety rules and recovery scenarios, see `references/build-safety.md`.

## Editing the recommendation logic

- Edit `prompts/recommendation-rubric.md` to retune what counts as HIGH/MED/LOW.
- Edit `references/account-context.md` to update target ROAS/CPA/CTR/frequency or the time-to-show urgency tiers.
- The skills consume both files at run time — no rebuild step.

## Adding a new skill

1. Create `.claude/skills/<name>/SKILL.md`.
2. Copy the structure of an existing skill (`weekly-report` is the canonical reference).
3. Reference `prompts/report-structure.md` and `prompts/recommendation-rubric.md` if it produces a report.
4. Add any new MCP tools it needs to the `allow` list in `.claude/settings.json`.

## Documentation

- **[Operator guide](docs/operator-guide.md)** — day-to-day usage: cadence, reading reports, acting on recommendations, tuning targets.
- **[Architecture overview](docs/architecture.md)** — runtime topology, component inventory, suggest-only enforcement layers, extension points.
- Design spec: [`docs/superpowers/specs/2026-05-07-meta-ad-automation-design.md`](docs/superpowers/specs/2026-05-07-meta-ad-automation-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-07-meta-ad-automation.md`](docs/superpowers/plans/2026-05-07-meta-ad-automation.md)
- Fixture-capture handoff: [`docs/superpowers/notes/capture-fixtures.md`](docs/superpowers/notes/capture-fixtures.md)
