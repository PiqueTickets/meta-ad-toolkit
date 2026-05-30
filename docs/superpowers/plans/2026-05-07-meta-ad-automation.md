# Meta Ad Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Claude Code skills project that produces dated, archivable Markdown reports and ranked recommendations for Acme Events Meta ad performance, using the open-source `brijr/meta-mcp` MCP server in suggest-only mode.

**Architecture:** Greenfield repo at `meta-ad-toolkit/`. All v1 logic lives in `.claude/skills/<name>/SKILL.md` files plus shared `prompts/` (report template, recommendation rubric) and `references/` (Meta concept docs + Acme Events context). MCP wired via `.mcp.json`. Suggest-only enforced by `.claude/settings.json` denying every `create_*`, `update_*`, `pause_*`, `resume_*` tool. Reports written to `reports/{weekly,monthly,shows}/<date>-*.md`.

**Tech Stack:** Claude Code skills (Markdown + YAML frontmatter), `brijr/meta-mcp` MCP server (Node, run via `npx`), Meta Marketing API access token. No application runtime, no test framework — fixtures captured from live MCP responses for dry-run verification.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-07-meta-ad-automation-design.md`
- MCP source: `https://github.com/brijr/meta-mcp`

---

## File Structure

Files created by this plan, grouped by responsibility:

**Repo root:**
- `README.md` — setup, token-mint, skill usage
- `.gitignore` — ignores `.env`, `fixtures/`, optionally `reports/`
- `.env.example` — `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`
- `.mcp.json` — wires `brijr/meta-mcp`

**Claude Code config:**
- `.claude/settings.json` — permissions: deny all write tools, allow read tools
- `.claude/skills/weekly-report/SKILL.md`
- `.claude/skills/monthly-report/SKILL.md`
- `.claude/skills/pacing-check/SKILL.md`
- `.claude/skills/show-report/SKILL.md`

**Shared prompts (loaded by every report skill):**
- `prompts/report-structure.md` — Markdown template every report follows
- `prompts/recommendation-rubric.md` — HIGH/MED/LOW criteria

**Reference content (cited by skills when explaining recommendations):**
- `references/breakdown-effect.md`
- `references/learning-phase.md`
- `references/auction-basics.md`
- `references/account-context.md`

**Captured fixtures (manual, gitignored):**
- `fixtures/get_ad_accounts.json`
- `fixtures/get_campaigns.json`
- `fixtures/get_insights_weekly.json`
- `fixtures/get_token_info.json`

**Output directories (kept in git via `.gitkeep`):**
- `reports/weekly/.gitkeep`
- `reports/monthly/.gitkeep`
- `reports/shows/.gitkeep`

Decomposition rationale: each skill is a single file consuming shared prompt fragments and reference docs. No cross-skill imports; if a skill needs new shared content, it's added to `prompts/` or `references/` and other skills can reference it. This keeps each `SKILL.md` focused and changes localized.

---

## Pre-flight: Operator inputs needed

Before starting, the implementing operator must have:

- A Meta long-lived user access token with `ads_read` permission (Graph API Explorer → "Get Token" → "Get User Access Token" → select `ads_read` → "Generate Access Token" → exchange for long-lived via the documented flow)
- The Acme Events Meta ad account ID (format `act_<numeric>`)
- Node.js installed (for `npx` to run the MCP server)

If any are missing, stop and ask the user before proceeding.

---

## Task 1: Initialize repository skeleton

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `reports/weekly/.gitkeep`
- Create: `reports/monthly/.gitkeep`
- Create: `reports/shows/.gitkeep`
- Create: `fixtures/.gitkeep`

- [ ] **Step 1: Create `.gitignore`**

```
.env
.env.local
fixtures/*.json
node_modules/
.DS_Store
```

(Note: `reports/` is intentionally tracked — week-over-week skills compare against prior reports. Fixtures are gitignored because they contain real account data.)

- [ ] **Step 2: Create `.env.example`**

```
# Meta long-lived user access token with ads_read permission.
# Mint via Graph API Explorer; refresh every ~60 days.
META_ACCESS_TOKEN=

# Acme Events Meta ad account ID, format act_<numeric>
META_AD_ACCOUNT_ID=
```

- [ ] **Step 3: Create stub `README.md`**

```markdown
# meta-ad-automation

Claude Code skills for reviewing Acme Events Meta (Facebook/Instagram) ad performance and producing ranked recommendations. Suggest-only — never writes back to your ad account.

## Setup

1. `cp .env.example .env` and fill in `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID`.
2. Open this directory in Claude Code. The MCP server (`brijr/meta-mcp`) auto-loads from `.mcp.json` and is allow/deny-listed for read-only access in `.claude/settings.json`.
3. Run a slash command:
   - `/weekly-report` — trailing 7-day account review
   - `/monthly-report` — trailing calendar month
   - `/show-report <show name or campaign id>` — single-show deep dive
   - `/pacing-check` — quick mid-week health check (chat only)

Reports are written to `reports/`.

## Token refresh

Meta long-lived tokens expire after ~60 days. `/pacing-check` includes a token health check and will warn when expiry is near. To refresh, regenerate via Graph API Explorer.

## What the skills will and won't do

- Will: read campaigns, ad sets, ads, creatives, audiences, and insights; write Markdown reports under `reports/`.
- Will not: create, update, pause, resume, or otherwise modify anything in your ad account. The deny list in `.claude/settings.json` enforces this.
```

- [ ] **Step 4: Create empty `.gitkeep` files**

Run:
```bash
mkdir -p reports/weekly reports/monthly reports/shows fixtures
touch reports/weekly/.gitkeep reports/monthly/.gitkeep reports/shows/.gitkeep fixtures/.gitkeep
```

- [ ] **Step 5: Initialize git and make the initial commit**

Run:
```bash
git init -b main
git add .gitignore .env.example README.md reports fixtures
git commit -m "chore: initialize meta-ad-automation skeleton"
```

Expected: clean commit with the 4 tracked files plus 4 `.gitkeep` files.

- [ ] **Step 6: Add the spec to git history**

The spec was written before this repo had `.git`. Commit it now.

Run:
```bash
git add docs/superpowers/specs/2026-05-07-meta-ad-automation-design.md docs/superpowers/plans/2026-05-07-meta-ad-automation.md
git commit -m "docs: add design spec and implementation plan"
```

---

## Task 2: Wire the MCP server

**Files:**
- Create: `.mcp.json`

- [ ] **Step 1: Verify the npm package name for `brijr/meta-mcp`**

Run:
```bash
npx --yes -p meta-ads-mcp -- meta-ads-mcp --help 2>&1 | head -20
```

The package name `meta-ads-mcp` was used by both `pipeboard-co` and `brijr` based on initial research. If `--help` output references Pipeboard branding, instead clone `brijr/meta-mcp` directly:

```bash
# Fallback if npm package isn't brijr's
git clone https://github.com/brijr/meta-mcp.git ../meta-mcp
cd ../meta-mcp && npm install && npm run build
```

Note in `README.md` if the fallback path was used (so the next operator knows).

- [ ] **Step 2: Create `.mcp.json`**

If the npm package is correct:

```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "npx",
      "args": ["-y", "meta-ads-mcp"],
      "env": {
        "META_ACCESS_TOKEN": "${META_ACCESS_TOKEN}",
        "META_AD_ACCOUNT_ID": "${META_AD_ACCOUNT_ID}"
      }
    }
  }
}
```

If using the cloned-and-built fallback, replace `command`/`args` with the absolute path to the built binary as documented in `brijr/meta-mcp`'s README.

- [ ] **Step 3: Restart Claude Code to load the MCP server**

The user must restart Claude Code (or reopen the project) so `.mcp.json` is picked up. Note this in your handoff to the user.

- [ ] **Step 4: Verify the server loaded and list its tools**

Inside Claude Code, ask: "What MCP tools are available from the meta-ads server?"

Expected: a list including `health_check`, `get_ad_accounts`, `get_campaigns`, `list_ad_sets`, `list_ads`, `get_insights`, `compare_performance`, `list_audiences`, `list_ad_creatives`, `get_token_info`, `diagnose_campaign_readiness`, `check_account_setup`, plus write tools (`create_*`, `update_*`, `pause_*`, `resume_*`) we'll deny in Task 3.

If the list differs significantly from the design spec, capture the actual tool names — Task 3 (permissions) and the skill procedures will use them.

- [ ] **Step 5: Commit**

```bash
git add .mcp.json
git commit -m "feat: wire brijr/meta-mcp via .mcp.json"
```

---

## Task 3: Lock down permissions (suggest-only enforcement)

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: Create `.claude/settings.json`**

```json
{
  "permissions": {
    "allow": [
      "mcp__meta-ads__health_check",
      "mcp__meta-ads__get_ad_accounts",
      "mcp__meta-ads__get_campaigns",
      "mcp__meta-ads__get_insights",
      "mcp__meta-ads__get_audience_info",
      "mcp__meta-ads__get_token_info",
      "mcp__meta-ads__list_ad_sets",
      "mcp__meta-ads__list_ads",
      "mcp__meta-ads__list_audiences",
      "mcp__meta-ads__list_ad_creatives",
      "mcp__meta-ads__compare_performance",
      "mcp__meta-ads__export_insights",
      "mcp__meta-ads__diagnose_campaign_readiness",
      "mcp__meta-ads__check_account_setup",
      "Read",
      "Write",
      "Edit",
      "Bash(mkdir:*)",
      "Bash(date:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)"
    ],
    "deny": [
      "mcp__meta-ads__create_campaign",
      "mcp__meta-ads__update_campaign",
      "mcp__meta-ads__pause_campaign",
      "mcp__meta-ads__resume_campaign",
      "mcp__meta-ads__create_ad_set",
      "mcp__meta-ads__create_ad",
      "mcp__meta-ads__create_ad_creative",
      "mcp__meta-ads__create_custom_audience",
      "mcp__meta-ads__create_lookalike_audience"
    ]
  }
}
```

If Task 2 surfaced different tool names, edit the `allow`/`deny` lists to match. The intent is invariant: every read tool allowed, every write tool denied.

- [ ] **Step 2: Verify the deny list works**

In Claude Code, ask: "Without actually doing it, would you be able to call `mcp__meta-ads__pause_campaign`?"

Expected: Claude reports the tool would prompt for permission (or is denied) — confirming the deny list is in effect.

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: lock MCP to read-only via deny list on write tools"
```

---

## Task 4: Capture MCP fixtures for dry-run testing

**Files:**
- Create: `fixtures/get_ad_accounts.json`
- Create: `fixtures/get_campaigns.json`
- Create: `fixtures/get_insights_weekly.json`
- Create: `fixtures/get_token_info.json`

These are gitignored (they contain real account data). Their purpose is to let later tasks "dry-run" a skill against captured JSON instead of calling the live API on every iteration.

- [ ] **Step 1: Capture `get_ad_accounts` and `get_token_info`**

In Claude Code, run:
> "Call `mcp__meta-ads__get_ad_accounts` and write the raw JSON response to `fixtures/get_ad_accounts.json`. Then call `mcp__meta-ads__get_token_info` and write its raw JSON response to `fixtures/get_token_info.json`."

Expected: two files saved. Confirm `get_ad_accounts.json` contains an entry for `${META_AD_ACCOUNT_ID}`.

- [ ] **Step 2: Capture `get_campaigns`**

In Claude Code:
> "Call `mcp__meta-ads__get_campaigns` for the configured ad account and write the raw response to `fixtures/get_campaigns.json`."

Expected: the JSON contains at least one active campaign. If the account has zero active campaigns, note this — it will affect how `/weekly-report` is exercised.

- [ ] **Step 3: Capture a 7-day insights window**

In Claude Code:
> "Call `mcp__meta-ads__get_insights` for the configured ad account with a date range covering the last 7 days, breakdown by campaign and by day. Write the raw JSON response to `fixtures/get_insights_weekly.json`."

Expected: a JSON array with daily rows per campaign, including `spend`, `purchase_value`, `actions`, `cpm`, `ctr`, `frequency`, `reach`.

If the tool's exact parameter names differ (some MCP tools use `level` + `time_range` + `breakdowns`), adapt — the goal is one captured fixture covering a real 7-day window.

- [ ] **Step 4: Verify fixtures are gitignored**

Run:
```bash
git status --short
```

Expected: no `fixtures/*.json` files listed (only `fixtures/.gitkeep` if it shows as already tracked). If a fixture file appears, fix `.gitignore` before continuing.

---

## Task 5: Write shared report template

**Files:**
- Create: `prompts/report-structure.md`

- [ ] **Step 1: Create `prompts/report-structure.md`**

```markdown
# Report structure

Every file-producing skill in this repo emits Markdown that follows this skeleton. Skills may add sections, but must not remove these or change the section order.

\`\`\`markdown
# <Period> Meta Ads Report — YYYY-MM-DD

## TL;DR
- 3–5 bullets covering the most important changes since the prior period and the single highest-priority recommendation.

## KPIs at a glance
| Metric | Value | vs prev period | vs target |
|---|---|---|---|
| Spend | $X | ±$Y (±Z%) | — |
| Purchases | N | ±M | — |
| ROAS | X.XXx | ±Y.YYx | target Z.ZZx |
| CPA | $X | ±$Y | target $Z |
| CTR | X.XX% | ±Y.YYpp | — |
| Frequency | X.XX | ±Y.YY | — |

## Spend by campaign
| Campaign | Status | Spend | Purchases | ROAS | Trend |
|---|---|---|---|---|---|
| <name> | <ACTIVE/PAUSED> | $X | N | X.XXx | ↑/↓/→ |

## Top movers
**Wins:**
- <named campaign / ad set>: <metric> moved from X to Y (±Z%)

**Concerns:**
- <named campaign / ad set>: <metric> moved from X to Y (±Z%)

## Recommendations (ranked)
1. **[HIGH]** <Action> — <Why, citing references/<doc>.md or a metric threshold> — <Expected impact>
2. **[MED]** ...
3. **[LOW]** ...

## Methodology
- Date range: <start> to <end>, account timezone <tz>.
- Ad account: <id>.
- Excluded from delta math: <e.g. campaigns paused for >50% of either window, campaigns first delivered in this window>.
- MCP tools used: <list>.
\`\`\`

## Rules

1. **Never invent numbers.** If a metric is unavailable in the MCP response, write `n/a` and explain in Methodology.
2. **Round consistently.** Currency to 2dp, percentages to 2dp, ROAS to 2dp, frequency to 2dp.
3. **Trend arrows** in Spend-by-campaign use ↑ for ≥+10% spend or purchases vs prior period, ↓ for ≤−10%, → otherwise.
4. **TL;DR is human-skimmable.** No metric soup; every bullet should make sense to someone who reads only that section.
5. **Methodology is non-negotiable.** It exists so the operator can sanity-check the numbers.
```

- [ ] **Step 2: Commit**

```bash
git add prompts/report-structure.md
git commit -m "feat: add shared report template"
```

---

## Task 6: Write recommendation rubric

**Files:**
- Create: `prompts/recommendation-rubric.md`

- [ ] **Step 1: Create `prompts/recommendation-rubric.md`**

```markdown
# Recommendation rubric

Every recommendation produced by a report skill must satisfy three properties and be assigned exactly one priority tier.

## Required properties

1. **Specific** — names the campaign, ad set, or ad it concerns. "Recommend pausing 'NYE Comedy Showcase / Lookalike 1%'" is specific. "Pause underperforming ads" is not.
2. **Actionable** — describes one concrete change the operator can make in Ads Manager in under 5 minutes. "Reduce daily budget on ad set X from $40 to $25" is actionable. "Optimize the funnel" is not.
3. **Justified** — cites either (a) a metric threshold from the data ("CPA is 4× the show-level target of $X") or (b) a `references/` doc that explains the underlying mechanic ("see `references/learning-phase.md`").

## Priority tiers

### HIGH — clear, time-sensitive waste or sellout risk

Use when **all** of:
- The action prevents money loss or sellout failure that will materialize in days, not weeks
- The data is unambiguous (not within statistical noise)
- The fix is reversible if the operator decides differently

Examples:
- An ad set with CPA ≥ 3× the show-level target on a show <7 days out
- A campaign under-pacing budget by ≥30% on a show <72 hours out
- A duplicated ad set bidding against itself in the same campaign (audience overlap evidence)

### MED — fixable inefficiency without urgency

Use when:
- The action will modestly improve performance over weeks
- The signal is consistent over ≥3 days
- The fix doesn't require operator judgment beyond what's in the recommendation

Examples:
- Frequency drift above 4 with falling CTR on an evergreen campaign
- A placement (e.g., Audience Network) consistently underperforming across multiple ad sets
- A creative variant lagging others by ≥40% on CTR after sufficient delivery

### LOW — experimentation worth queueing

Use when:
- The action has unclear EV but is cheap to test
- It's a "next thing to try," not a fix for a known problem

Examples:
- A new lookalike percentage worth testing
- A creative refresh on an ad with declining CTR but still hitting target CPA
- A new placement worth piloting

## Anti-rules (never do these)

1. **Never recommend pausing during Learning Phase** without explicitly checking learning status and citing `references/learning-phase.md`. Learning Phase data is noisy by design.
2. **Never recommend changes based on <3 days of data** unless the action is to *pause to stop bleeding* during clear waste (HIGH-tier waste only).
3. **Never recommend creating new campaigns / ad sets / ads / creatives.** This project is suggest-only. If a creative refresh is the right move, recommend it as a brief — the operator builds it elsewhere.
4. **Never recommend more than 7 actions per report.** If the report would suggest more, group them by theme in MED/LOW or move the long tail into the Methodology section as "also noticed."
```

- [ ] **Step 2: Commit**

```bash
git add prompts/recommendation-rubric.md
git commit -m "feat: add recommendation rubric"
```

---

## Task 7: Write Meta-mechanics reference docs

**Files:**
- Create: `references/breakdown-effect.md`
- Create: `references/learning-phase.md`
- Create: `references/auction-basics.md`

These are concise, skill-cited explainers. The skills reference these by relative path when explaining *why* a recommendation is being made. The MIT-licensed `mathiaschu/meta-ads-analyzer` repo contains similar docs and may be consulted as inspiration; rewrite in our own words.

- [ ] **Step 1: Create `references/breakdown-effect.md`**

```markdown
# The Breakdown Effect

When you look at performance broken down by an attribute (placement, age, gender, region), the segment with the worst headline metric (e.g. highest CPA) is often *not* the one to pause. This is the breakdown effect.

## Why it happens

Meta's auction allocates budget across segments to maximize the campaign's *total* outcome, not each segment's own efficiency. A "bad" segment may be:
- Cheap impressions that the algorithm uses to gather signal
- A segment that yields purchases the model attributes back to a "good" segment via downstream conversion paths
- A segment whose users were going to convert anyway via cheaper placements; pausing it shifts those conversions to higher-cost placements that compete more aggressively

## Implication for recommendations

- A breakdown showing one segment 3× the campaign average **is not** automatic justification to exclude that segment.
- Excluding the "worst" segment commonly *worsens* the campaign's overall CPA, because the model loses cheap signal-gathering placements.
- The strongest evidence for excluding a segment is a sustained pattern across many campaigns *and* a plausible product-side reason (e.g. an audience never converts because the offer doesn't match).

## When to cite this

Cite this doc when declining to recommend a segment exclusion that looks tempting on the surface, or when explaining why a "bad" placement should stay on.
```

- [ ] **Step 2: Create `references/learning-phase.md`**

```markdown
# Learning Phase

A new ad set (or one with significant edits) enters Learning Phase, during which Meta is still calibrating the auction model for that ad set. Performance during Learning is noisy and not predictive of post-Learning steady state.

## Exit criteria

An ad set typically exits Learning after ~50 optimization events within ~7 days. Below that volume, day-to-day metrics swing wildly. The MCP returns the ad set's learning status in its insights/diagnostics output (look for `learning_stage`, `delivery_status`, or similar fields).

## Implication for recommendations

- **Do not recommend pausing or budget-cutting an ad set in Learning** based on its Learning-phase metrics alone. The metrics aren't yet meaningful.
- **Do flag** when an ad set has been in Learning >7 days and isn't accumulating events — that's a signal of insufficient budget or audience for the optimization goal.
- **Do warn** when the operator's prior actions caused multiple ad sets to re-enter Learning simultaneously (e.g., from edits to budget, optimization goal, audience, or creative) — this can suppress overall account performance for a week.

## When to cite this

Cite this doc whenever a recommendation involves pausing, budget-cutting, or otherwise interfering with an ad set whose Learning status hasn't been confirmed. Also cite when explaining why a recently-edited campaign's apparent regression should be ignored for now.
```

- [ ] **Step 3: Create `references/auction-basics.md`**

```markdown
# Meta auction basics

Meta serves the ad with the highest **total value** per impression, not the highest bid. Total value combines:

1. **Advertiser bid** — what the advertiser is willing to pay (or what the optimization goal implies)
2. **Estimated action rate** — Meta's prediction that this user will take the optimized action
3. **Ad quality** — engagement signals, post-click experience, user feedback (negative ratings, hide-ad rates)

Two ads with the same bid can have very different effective costs because (2) and (3) compound.

## Implication for recommendations

- **Cheap CPMs aren't always good.** A creative with high estimated action rate wins auctions cheaply *because Meta expects it to convert*. A cheap CPM with a low conversion rate signals weak quality, not a bargain.
- **Improving creative is the most leveraged action.** Bid changes affect (1); creative changes affect (2) and (3) together.
- **Frequency matters because of (3).** As frequency rises, ad fatigue lowers estimated action rate and quality, raising effective cost.

## When to cite this

Cite this doc when explaining why a creative refresh is the recommended action over a budget tweak, or when explaining why high frequency is a HIGH-tier concern.
```

- [ ] **Step 4: Commit**

```bash
git add references/breakdown-effect.md references/learning-phase.md references/auction-basics.md
git commit -m "feat: add Meta auction reference docs"
```

---

## Task 8: Write Acme Events-specific context

**Files:**
- Create: `references/account-context.md`

This doc holds business context the skills need to make sensible recommendations: target ROAS, urgency tiers, naming conventions. It will need operator input before being final — the placeholders below are seeds.

- [ ] **Step 1: Create `references/account-context.md`**

```markdown
# Acme Events context for Meta ads

Operator-curated context the report skills use when interpreting performance and ranking recommendations. Update this doc as the business changes.

## Product

Acme Events sells tickets to comedy shows. Each campaign typically promotes one show with a fixed event date.

## Target metrics

| Metric | Target | Notes |
|---|---|---|
| ROAS | **3.0×** | Average target. Premium-priced touring acts may target 4×; cheaper local shows may run profitably at 2×. |
| CPA (purchase) | **$8–$15** | Varies by ticket price. Refine per campaign once enough data exists. |
| CTR | **≥ 1.0%** | Below 0.5% on a show campaign with 7+ days of delivery is a creative signal. |
| Frequency | **≤ 4** | Above 4 with declining CTR is a refresh trigger. |

(These targets are seeded estimates. Operator: replace with values from your finance / historical data.)

## Time-to-show urgency tiers

The number of days between *now* and the show date determines how aggressive recommendations should be.

| Tier | Days to show | Tone |
|---|---|---|
| Cold | > 30 | Optimize for efficiency. Cut waste; don't chase volume. |
| Warm | 7–30 | Balance efficiency and pacing toward sellout. |
| Hot | < 7 | Prioritize pacing. Accept slightly worse ROAS to fill seats. |
| Critical | < 72 hours | Sellout urgency dominates. Recommendations skew toward "spend more" if the show isn't tracking to sell out. |

## Campaign naming convention

(Operator: confirm or correct.) Acme Events campaigns are named with the pattern:

`<show name> | <venue> | <YYYY-MM-DD>`

If the date is encoded in the name, `/show-report` extracts it directly. If not, `/show-report` asks the operator for the show date.

## Sellout pacing

(Operator: optional. If Acme Events exposes a "tickets sold / capacity" metric the skills can read, document it here. Otherwise, sellout pacing is operator-judged.)

## Things that aren't optimizations

- "Increase the budget" without a quality signal isn't a recommendation; it's a wish. Skills should only recommend budget increases on ad sets that are *capacity-limited* (high ROAS + budget consistently spent within the day).
- "Test more creatives" without a hypothesis isn't a LOW-tier recommendation; it's noise. Skip it.
```

- [ ] **Step 2: Tell the operator to review the placeholders**

Output to the user: "I've stubbed `references/account-context.md` with seeded target metrics. Please review and replace the placeholder targets (ROAS, CPA, CTR, Frequency) with your actual numbers, and confirm or edit the campaign naming convention before the skills are run for real."

This is a hand-off point — the operator can edit the file in place.

- [ ] **Step 3: Commit**

```bash
git add references/account-context.md
git commit -m "feat: add Acme Events ad context (seed values; operator to refine)"
```

---

## Task 9: Build `/weekly-report` skill

**Files:**
- Create: `.claude/skills/weekly-report/SKILL.md`

This is the most-used skill. We build it first and use it as the template for the others.

- [ ] **Step 1: Create `.claude/skills/weekly-report/SKILL.md`**

```markdown
---
name: weekly-report
description: Use when the operator asks for a weekly Meta ads review, runs `/weekly-report`, or asks "how did ads do this week". Generates a trailing-7-day account-level performance report with ranked recommendations for Acme Events shows.
---

# /weekly-report

Generate a trailing 7-day Meta ads performance report.

## Inputs

- Optional `<end-date>` argument (YYYY-MM-DD). Defaults to today.
- The window is `<end-date> minus 7 days … <end-date>`, exclusive of `<end-date>+1`.
- The prior window for comparison is `<end-date> minus 14 days … <end-date> minus 7 days`.

## Procedure

Follow these steps in order. Stop and surface the issue if any step fails.

### 1. Sanity-check the environment

- Call `mcp__meta-ads__health_check`. If unhealthy, stop and report the error.
- Call `mcp__meta-ads__get_token_info`. If the token expires within 7 days, prepend a warning banner to the final report.

### 2. Resolve the date windows

- Current window: `start = today − 7d`, `end = today`. Use the ad account's timezone, not local.
- Prior window for delta math: `start = today − 14d`, `end = today − 7d`.

### 3. Pull data

- Call `mcp__meta-ads__get_campaigns` to enumerate active and paused campaigns.
- Call `mcp__meta-ads__get_insights` for the **current** window with breakdown by campaign and by day.
- Call `mcp__meta-ads__get_insights` for the **prior** window with the same breakdown.

If the MCP supports `compare_performance` natively (a single call returning current + prior + delta), prefer it.

### 4. Aggregate and compute

- Account totals: sum spend, purchases, purchase value across all campaigns in the current window. Repeat for prior.
- Per-campaign totals: same, grouped by campaign.
- Deltas: `(current − prior) / prior` for percentage; `current − prior` for absolutes. Show "n/a" if the prior period had zero of that metric.
- Trend arrow: ↑ if spend OR purchases ≥ +10% vs prior; ↓ if ≤ −10%; → otherwise.

### 5. Identify movers

- Wins: campaigns where ROAS improved by ≥0.5× **and** spend ≥ 20% of the highest-spend campaign in the window. (The spend filter prevents tiny-spend noise from dominating "wins".)
- Concerns: campaigns where ROAS dropped by ≥0.5× under the same spend filter, or where CPA went above target by ≥50%.

### 6. Generate recommendations

For each problem detected, write a recommendation following `prompts/recommendation-rubric.md`. Apply the anti-rules strictly:

- Before recommending a pause or budget cut on any ad set, verify its learning status from the campaigns/insights data. Cite `references/learning-phase.md` if the ad set is or recently was in Learning.
- Before recommending a placement or audience exclusion based on a breakdown, cite `references/breakdown-effect.md` and explain why the exclusion is justified beyond surface-level numbers.
- Cap recommendations at 7. Group long-tail observations under "also noticed" in Methodology.

For each recommendation, fill the required properties: specific, actionable, justified.

### 7. Render and write the report

- Use the template in `prompts/report-structure.md`. Do not deviate from section names or order.
- Write to `reports/weekly/<end-date>-weekly.md`. Create the directory if missing.
- Echo the same content to chat so the operator sees it without opening the file.

### 8. Cross-check against last week's report (if it exists)

- Look for `reports/weekly/<end-date − 7d>-weekly.md`.
- If present, briefly note in the TL;DR whether last week's HIGH recommendations appear to have been acted on (e.g. a previously-recommended pause: is the ad set now paused?). One line — don't over-extrapolate.

## Outputs

- `reports/weekly/<end-date>-weekly.md` — the report file
- Same content echoed to chat

## Failure modes and what to do

- **No active campaigns in window:** still produce a report with TL;DR `"No active spend during <window>."` and an empty KPI table. Do not fabricate data.
- **MCP returns partial data (e.g. some campaigns time out):** include the affected campaigns by name in Methodology under "Excluded".
- **Token near expiry:** prepend a warning banner above TL;DR; the report still generates.
- **Prior window had zero spend:** show "n/a" in delta columns; don't invent percentages.

## What this skill must NOT do

- Call any `mcp__meta-ads__create_*`, `update_*`, `pause_*`, or `resume_*` tool. (Permissions also enforce this.)
- Recommend creating new campaigns / ad sets / ads.
- Round inconsistently or invent numbers.
```

- [ ] **Step 2: Dry-run against fixtures**

In Claude Code, ask:
> "Pretend the MCP is unavailable and use `fixtures/get_ad_accounts.json`, `fixtures/get_campaigns.json`, and `fixtures/get_insights_weekly.json` as if they were the live MCP responses. Walk through the `/weekly-report` skill procedure step by step, but do **not** write any file — just print what the report would look like."

Expected: a printed report that follows `prompts/report-structure.md` exactly, with sensible numbers from the fixture data and ≤7 recommendations conforming to the rubric. Eyeball:
- Are totals consistent across sections?
- Do recs cite metrics or reference docs?
- Is the date window correct?

If anything is off, edit `SKILL.md` and re-run. Do **not** proceed to live until dry-run output looks right.

- [ ] **Step 3: Live-run**

In Claude Code, run `/weekly-report`. Expected: a real report appears in chat AND in `reports/weekly/<today>-weekly.md`.

- [ ] **Step 4: Eyeball the live report**

Spot-check 2 numbers in the report against Meta Ads Manager:
- Total spend for the week
- ROAS for the highest-spend campaign

If either is off by more than rounding, the skill needs procedure refinement. Common issue: timezone mismatch (the MCP may default to UTC, the account may be in PT/MT). Fix by adding an explicit timezone parameter to the `get_insights` calls in the procedure.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/weekly-report/SKILL.md reports/weekly/
git commit -m "feat: add /weekly-report skill"
```

---

## Task 10: Build `/monthly-report` skill

**Files:**
- Create: `.claude/skills/monthly-report/SKILL.md`

This skill is structurally similar to `/weekly-report` but operates on calendar months and skews toward strategic recommendations rather than tactical ones.

- [ ] **Step 1: Create `.claude/skills/monthly-report/SKILL.md`**

```markdown
---
name: monthly-report
description: Use when the operator asks for a monthly Meta ads review, runs `/monthly-report`, or asks for month-over-month performance. Generates a trailing-calendar-month report with strategic-level recommendations.
---

# /monthly-report

Generate a calendar-month Meta ads performance report.

## Inputs

- Optional `<month>` argument (YYYY-MM). Defaults to the most recent complete calendar month.
- Comparison window is the immediately preceding calendar month.

## Procedure

Follow these steps in order. Stop and surface the issue if any step fails.

### 1. Sanity-check the environment

- Call `mcp__meta-ads__health_check`. If unhealthy, stop and report the error.
- Call `mcp__meta-ads__get_token_info`. If the token expires within 7 days, prepend a warning banner.

### 2. Resolve date windows

- Current window: first-day-of-`<month>` 00:00 → first-day-of-next-month 00:00, account timezone.
- Prior window: previous calendar month, same boundary rule.

### 3. Pull data

- Call `mcp__meta-ads__get_campaigns` to enumerate campaigns delivered in the current window.
- Call `mcp__meta-ads__get_insights` for the current month, breakdown by campaign (no per-day breakdown — month roll-up is enough).
- Call `mcp__meta-ads__get_insights` for the prior month, same shape.

### 4. Aggregate and compute

- Account totals: spend, purchases, purchase value, ROAS, CPA, CTR, frequency.
- Per-campaign totals.
- Month-over-month deltas (absolute and percent). "n/a" where the prior month was zero.
- Trend arrows under the same rule as `/weekly-report`.

### 5. Identify themes (not just movers)

Monthly reports should identify *patterns* not just isolated movers:

- Which audience types performed best? (lookalike percentages, custom audiences from email, broad targeting). Group campaigns by audience type if naming or tagging permits.
- Which placements performed best? Aggregate across campaigns where possible.
- Which show categories (touring acts, local, etc.) had the best ROAS? (Use `references/account-context.md` if it documents categories.)

### 6. Generate recommendations

Apply `prompts/recommendation-rubric.md`. Monthly recs should be strategic:

- "Continue investing in lookalike-1% audiences for touring shows; they delivered Xx ROAS this month vs Yx for broader audiences."
- "Stop running Audience Network placements for show campaigns; consistent 2× CPA vs other placements over the month."
- "Pre-build creative for upcoming high-priority shows next month; the lead time on N-show was insufficient."

Cap at 7 recommendations. Cite `references/breakdown-effect.md` and `references/learning-phase.md` per the anti-rules.

### 7. Render and write

- Use `prompts/report-structure.md`.
- Write to `reports/monthly/<YYYY-MM>-monthly.md`.
- Echo to chat.

### 8. Cross-check against last month

- Look for `reports/monthly/<previous-YYYY-MM>-monthly.md`.
- If present, note in TL;DR whether last month's strategic recs appear to have been acted on. One line.

## Outputs

- `reports/monthly/<YYYY-MM>-monthly.md`
- Same content in chat

## Failure modes

Same set as `/weekly-report`.

## What this skill must NOT do

Same restrictions as `/weekly-report`.
```

- [ ] **Step 2: Dry-run against fixtures**

The captured fixtures cover a 7-day window, not a month. For dry-run, ask Claude:
> "Treat `fixtures/get_insights_weekly.json` as if it were a partial month's data. Walk through `/monthly-report`'s procedure but skip the comparison step. Print what the report would look like, without writing a file."

Expected: a printed report that follows the template, with strategic-tier recommendations distinct from the tactical ones in `/weekly-report`. Eyeball that the rec language differs in tone (strategic, not "pause this ad").

- [ ] **Step 3: Live-run for the most recent complete month**

Run `/monthly-report`. Expected: a real report at `reports/monthly/<YYYY-MM>-monthly.md`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/monthly-report/SKILL.md reports/monthly/
git commit -m "feat: add /monthly-report skill"
```

---

## Task 11: Build `/pacing-check` skill

**Files:**
- Create: `.claude/skills/pacing-check/SKILL.md`

Quick mid-week health check. Chat-only — no file written. Designed to be runnable any time without cluttering `reports/`.

- [ ] **Step 1: Create `.claude/skills/pacing-check/SKILL.md`**

```markdown
---
name: pacing-check
description: Use when the operator asks "how are ads pacing right now", runs `/pacing-check`, or wants a quick mid-week sanity check. Produces a short chat-only summary of budget pacing, learning-phase status, and frequency drift.
---

# /pacing-check

Short, chat-only health pulse. No report file is written.

## Inputs

None.

## Procedure

### 1. Sanity-check

- Call `mcp__meta-ads__health_check`.
- Call `mcp__meta-ads__get_token_info`. If the token expires in <7 days, surface this prominently as the first item.

### 2. Pull yesterday + today

- Call `mcp__meta-ads__get_insights` for the trailing 24 hours, breakdown by campaign and ad set.
- Call `mcp__meta-ads__get_insights` for the trailing 72 hours, same breakdown, for context.

### 3. Compute pacing

For each active campaign with a daily budget:
- Expected spend by this hour today = (hours elapsed in account-tz day / 24) × daily budget.
- Actual spend so far today.
- Pace = actual / expected. Flag if pace < 0.7 (under-pacing) or pace > 1.2 (over-pacing or budget already exhausted).

If campaigns use lifetime budgets, swap the math: pace against `(elapsed_days / total_days) × lifetime_budget`.

### 4. Check learning-phase status

For each active ad set, surface the learning status if the MCP exposes it (`learning_stage`, `delivery_status`, etc.). Flag ad sets that are:
- Still in Learning after 7+ days (insufficient events)
- Recently re-entered Learning (within last 24h) due to edits

### 5. Check frequency drift

For each active ad set, compare today's frequency vs the trailing 72h average. Flag ad sets where frequency has risen >15% in 24h (creative-fatigue signal).

### 6. Render to chat

Output format (no file):

\`\`\`
**Pacing check — <YYYY-MM-DD HH:MM tz>**

**Token:** <ok / expires in N days>

**Pacing:**
- 🟢 <campaign>: pacing 1.05× ($X / $Y expected by now)
- 🟡 <campaign>: under-pacing 0.6×
- 🔴 <campaign>: budget exhausted at hour 14

**Learning:**
- ⚠️ <ad set>: still in Learning after 9 days (low event volume)

**Frequency:**
- ⚠️ <ad set>: 4.6 today vs 4.0 trailing 72h (+15%)
\`\`\`

If everything is healthy, output one line: `All campaigns pacing within tolerance, no learning anomalies, no frequency drift. ✅`

## Outputs

Chat only. No file written.

## What this skill must NOT do

Same restrictions as `/weekly-report`.
```

- [ ] **Step 2: Dry-run**

Ask Claude:
> "Walk through `/pacing-check` using the existing fixtures. Print the chat output without making any actual MCP calls."

Expected: a short pacing summary. The fixture is 7-day weekly data so pacing math will be approximate — that's fine for verifying format.

- [ ] **Step 3: Live-run**

Run `/pacing-check`. Expected: a chat output following the format above. No new files in the working directory.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/pacing-check/SKILL.md
git commit -m "feat: add /pacing-check skill"
```

---

## Task 12: Build `/show-report` skill

**Files:**
- Create: `.claude/skills/show-report/SKILL.md`

Single-show deep dive. The argument is a show name fragment or campaign/ad-set ID.

- [ ] **Step 1: Create `.claude/skills/show-report/SKILL.md`**

```markdown
---
name: show-report
description: Use when the operator runs `/show-report <name-or-id>` or asks "how is the <show> campaign doing". Produces a single-show performance deep-dive with time-to-show urgency analysis.
---

# /show-report

Deep dive on a single show's ad performance.

## Inputs

- Required `<show>` argument: either
  - A name fragment matching one or more campaigns by name (e.g. "Sample Comedian" matches `Sample Comedian | Downtown Theatre | 2026-06-12`), OR
  - An exact campaign ID, OR
  - An exact ad set ID

## Procedure

### 1. Resolve `<show>` to campaigns

- If the argument starts with `act_` or matches a numeric ID format, treat as an exact ID and fetch via `mcp__meta-ads__get_campaigns` filtered by ID, or `mcp__meta-ads__list_ad_sets` if it's an ad-set-shaped ID.
- Otherwise treat as a name fragment. Call `mcp__meta-ads__get_campaigns`, filter campaigns whose name contains `<show>` (case-insensitive).
- If multiple campaigns match, list them and ask the operator which to run on (or "all").
- If zero campaigns match, surface an error and stop.

### 2. Extract show date

- Parse the campaign name using the convention in `references/account-context.md` (default: `<show> | <venue> | <YYYY-MM-DD>`).
- If the date isn't in the name, ask the operator for the show date before continuing.
- Compute `days_to_show = show_date − today`. Map to urgency tier:
  - Cold: > 30 days
  - Warm: 7–30 days
  - Hot: 1–7 days
  - Critical: < 24 hours (treat negative days_to_show as "show passed; report is post-mortem")

### 3. Pull data

- Call `mcp__meta-ads__list_ad_sets` for each matched campaign.
- Call `mcp__meta-ads__list_ads` for each matched ad set.
- Call `mcp__meta-ads__list_ad_creatives` for the ads (so the report can reference creative names).
- Call `mcp__meta-ads__get_insights` for the campaign(s) over the full delivery window (campaign creation → today), breakdown by ad set and by day.

### 4. Aggregate and compute

- Per-ad-set totals: spend, purchases, purchase value, ROAS, CPA, CTR, frequency.
- Daily delivery curve (spend per day).
- If the `references/account-context.md` documents a sellout-pacing data source, apply it. Otherwise note in Methodology that sellout pacing is operator-judged.

### 5. Generate recommendations (urgency-weighted)

Apply `prompts/recommendation-rubric.md` with one extra rule: **the urgency tier raises the priority of pacing recommendations one level.** A budget-shortage rec that would normally be MED becomes HIGH on a Hot show; an under-pacing concern that would be LOW becomes MED on Warm.

### 6. Render and write

- Use `prompts/report-structure.md`. Replace `<Period>` with `Show — <show name> (<urgency tier>, <days_to_show>d to show)`.
- Add a "Show details" section right after TL;DR with: show name, venue, date, days to show, urgency tier.
- Write to `reports/shows/<today>-<slug>.md` where `<slug>` is the show name kebab-cased and lowercased.
- Echo to chat.

## Outputs

- `reports/shows/<today>-<slug>.md`
- Same content in chat

## Failure modes

- **Multiple matches and operator hasn't disambiguated:** print the matches with IDs and ask. Do not pick one arbitrarily.
- **No date in name and operator hasn't provided one:** ask. Do not guess.
- **Show date in the past:** generate the report as a post-mortem ("Show — <name> — POST-MORTEM, ran T days ago"). Recommendations skew toward "what to apply to similar future shows."

## What this skill must NOT do

Same restrictions as `/weekly-report`. Plus: never assume a show date.
```

- [ ] **Step 2: Dry-run**

Pick one campaign name from `fixtures/get_campaigns.json`. Ask Claude:
> "Walk through `/show-report <campaign name fragment>` using the existing fixtures. Print what the report would look like, without writing a file or making real MCP calls."

Expected: a single-show report with the show-details block, urgency tier computed, and recommendations weighted by urgency.

- [ ] **Step 3: Live-run**

Run `/show-report <name>` against a current campaign. Expected: a real report at `reports/shows/<today>-<slug>.md`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/show-report/SKILL.md reports/shows/
git commit -m "feat: add /show-report skill"
```

---

## Task 13: Final README polish and sanity check

**Files:**
- Modify: `README.md`

Replace the stub README with the user-facing version now that all skills exist.

- [ ] **Step 1: Replace `README.md` content**

```markdown
# meta-ad-automation

Claude Code skills for reviewing Acme Events Meta (Facebook/Instagram) ad performance and producing ranked, justified recommendations. **Suggest-only** — these skills never write back to your Meta ad account.

## What's in here

- `.mcp.json` wires the open-source [`brijr/meta-mcp`](https://github.com/brijr/meta-mcp) MCP server (MIT, no third-party membership required).
- `.claude/settings.json` denies every Meta write tool (`create_*`, `update_*`, `pause_*`, `resume_*`) so the skills are read-only by construction.
- Four skills under `.claude/skills/`:
  - `/weekly-report` — trailing 7-day account review → `reports/weekly/<date>-weekly.md`
  - `/monthly-report` — trailing calendar month → `reports/monthly/<YYYY-MM>-monthly.md`
  - `/show-report <name-or-id>` — single-show deep dive → `reports/shows/<date>-<slug>.md`
  - `/pacing-check` — quick mid-week health pulse (chat only)
- `prompts/` — shared report template and recommendation rubric.
- `references/` — Meta-mechanics explainers (Breakdown Effect, Learning Phase, auction basics) and Acme Events-specific context the skills cite when justifying recommendations.

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

4. **Open this directory in Claude Code.** The MCP server auto-loads from `.mcp.json` on first use. Restart Claude Code if it was running before you populated `.env`.

5. **Run a skill:**

   ```
   /weekly-report
   /monthly-report
   /show-report Sample Comedian
   /pacing-check
   ```

## Token refresh

Long-lived Meta tokens expire after ~60 days. `/pacing-check` includes a token health check and warns when expiry is near. To refresh, regenerate via Graph API Explorer and update `.env`.

## What the skills will and won't do

- **Will:** read campaigns, ad sets, ads, creatives, audiences, and insights; write Markdown reports under `reports/`.
- **Won't:** create, update, pause, resume, or otherwise modify anything in your ad account. `.claude/settings.json` denies the relevant tools, and every `SKILL.md` documents this restriction.

## Editing the recommendation logic

- Edit `prompts/recommendation-rubric.md` to retune what counts as HIGH/MED/LOW.
- Edit `references/account-context.md` to update target ROAS/CPA/CTR/frequency or the time-to-show urgency tiers.
- The skills consume both files at run time — no rebuild step.

## Adding a new skill

1. Create `.claude/skills/<name>/SKILL.md`.
2. Copy the structure of an existing skill (`weekly-report` is the canonical reference).
3. Reference `prompts/report-structure.md` and `prompts/recommendation-rubric.md` if it produces a report.
4. Add any new MCP tools it needs to the `allow` list in `.claude/settings.json`.

## Spec and plan

- Design spec: [`docs/superpowers/specs/2026-05-07-meta-ad-automation-design.md`](docs/superpowers/specs/2026-05-07-meta-ad-automation-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-07-meta-ad-automation.md`](docs/superpowers/plans/2026-05-07-meta-ad-automation.md)
```

- [ ] **Step 2: Sanity-check the whole repo**

Run:
```bash
git status --short
ls -la .claude/skills/
ls -la prompts/
ls -la references/
ls -la reports/
```

Expected:
- No untracked or modified files (clean tree).
- Four skill directories under `.claude/skills/`.
- Two files under `prompts/`.
- Four files under `references/`.
- Three subdirectories under `reports/` (weekly, monthly, shows), each with at least the `.gitkeep` plus any reports generated during live runs.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: replace stub README with full setup and usage"
```

- [ ] **Step 4: Final verification — run each skill once more end-to-end**

In Claude Code, in a fresh session:
1. Run `/pacing-check`. Expected: chat output, no new files.
2. Run `/weekly-report`. Expected: file at `reports/weekly/<today>-weekly.md` plus chat output.
3. Run `/show-report <a real show name>`. Expected: file at `reports/shows/<today>-<slug>.md` plus chat output.

If `/monthly-report` falls within the appropriate window for the calendar, run it; otherwise skip — the live-run was already performed in Task 10.

If any skill fails, fix the procedure in its `SKILL.md` before declaring complete.

- [ ] **Step 5: Final commit (if any reports were generated)**

```bash
git add reports/
git commit -m "chore: capture initial reports from end-to-end verification" || echo "Nothing to commit"
```

---

## Done

At this point the repo contains: a working MCP wiring, locked-down read-only permissions, four review skills (`/weekly-report`, `/monthly-report`, `/show-report`, `/pacing-check`), shared report template and recommendation rubric, four reference docs (three Meta-mechanics + one Acme Events-specific), and a user-facing README.

The deferred items from the spec (diagnostic skills, pre-launch review, write actions, cross-platform support, external sales joins) remain out of scope and intentionally not built.
