# Meta Ad Automation — Design

**Date:** 2026-05-07
**Status:** Spec, awaiting implementation plan
**Owner:** the operator team

## Goal

A Claude Code project that lets the operator manage, review, and improve Acme Events Meta (Facebook/Instagram) ad performance through a small, well-bounded library of slash-command skills. The skills wrap the open-source Meta Ads MCP server `brijr/meta-mcp` and produce dated, archivable Markdown reports with ranked, justified recommendations.

The primary outcome these ads drive is **ticket sales for upcoming Acme Events comedy shows**. Conversion data (purchases, value) reaches Meta via the Pixel and Conversions API, so reports can be built on Meta insights alone in v1.

## Non-goals

- Not a web app or dashboard. No frontend.
- Not a content generator. Ad creative drafting lives elsewhere.
- Not autonomous. v1 is **suggest-only** — skills never call write tools.
- Not a multi-platform tool. Meta only. No Google, TikTok, etc.
- Not a replacement for any sibling project in the workspace.

## Approach

Pure Claude Code skills. All v1 logic lives in `SKILL.md` prompts, reference docs, and a shared report template. No Python helpers, no analyzer library — those are deferred. If a skill produces wrong numbers more than once, that skill graduates to a thin helper script in a future `scripts/` directory; the v1 layout is set up so promotion is friction-free.

## MCP server: brijr/meta-mcp

Selected because it is MIT-licensed, requires no third-party membership (just a Meta access token the operator mints themselves), and exposes 25 tools covering account info, campaigns, ad sets, ads, audiences, creatives, and insights. Read-only operation is enforced by the project's permission settings (see Permissions below), so the write tools the MCP exposes are never callable by the skills.

### Auth

`.env` (gitignored) holds:

- `META_ACCESS_TOKEN` — long-lived user token with `ads_read` permission, minted via Meta Graph API Explorer
- `META_AD_ACCOUNT_ID` — the Acme Events ad account ID (`act_…`)

`.env.example` documents these. README documents the token-mint procedure and 60-day refresh cadence.

### Wiring

`.mcp.json`:

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

The exact npm package name will be verified during implementation against the `brijr/meta-mcp` README; the entry above is a placeholder if it differs.

## Repository layout

```
meta-ad-automation/
├── README.md
├── .env.example
├── .gitignore                      # ignores .env, reports/ (optional)
├── .mcp.json
├── .claude/
│   ├── settings.json               # permissions: deny all write tools
│   └── skills/
│       ├── weekly-report/SKILL.md
│       ├── monthly-report/SKILL.md
│       ├── show-report/SKILL.md
│       └── pacing-check/SKILL.md
├── references/                     # cited by skills when explaining recs
│   ├── breakdown-effect.md
│   ├── learning-phase.md
│   ├── auction-basics.md
│   └── account-context.md
├── prompts/
│   ├── report-structure.md         # shared report template
│   └── recommendation-rubric.md    # HIGH/MED/LOW criteria
├── docs/
│   └── superpowers/specs/          # this spec lives here
├── fixtures/                       # captured MCP responses for dry-run testing
└── reports/
    ├── weekly/
    ├── monthly/
    └── shows/
```

## v1 skills

Four skills. Each `SKILL.md` follows the same shape:

1. **frontmatter** — `name`, `description`, when-to-invoke
2. **inputs** — optional date range, optional show identifier
3. **procedure** — ordered steps the skill follows: which MCP tools to call, what fields to extract, how to aggregate
4. **output template** — the exact Markdown skeleton (references `prompts/report-structure.md`)
5. **recommendation rubric** — references `prompts/recommendation-rubric.md`

| Skill | Trigger | Window | Output |
|---|---|---|---|
| `/weekly-report` | weekly review | trailing 7 days | `reports/weekly/<date>-weekly.md` + chat |
| `/monthly-report` | monthly review | trailing calendar month | `reports/monthly/<YYYY-MM>-monthly.md` + chat |
| `/show-report <show>` | ad-hoc per-show | per-campaign window since first delivery | `reports/shows/<date>-<slug>.md` + chat |
| `/pacing-check` | mid-week pulse | trailing 24–72h | chat only |

### `/weekly-report`

Trailing 7 days. Account-level KPIs, per-show pacing, top movers, ranked recommendations.

**Procedure:**
1. Resolve date window (today − 7 days … today, in account timezone)
2. List active campaigns
3. For each campaign, fetch insights with breakdown by day and by ad set
4. Identify the prior 7-day window for week-over-week comparison
5. Aggregate: account totals, per-campaign totals, deltas
6. Rank issues using the recommendation rubric
7. Render report from template; write to `reports/weekly/<today>-weekly.md`

**KPIs reported:** spend, purchases, ROAS, CPA, CTR, frequency, reach.

### `/monthly-report`

Trailing calendar month. Higher-level: trend lines, MoM deltas, strategy notes for next month.

**Procedure:** same shape as weekly but the comparison window is the previous calendar month, and the recommendations skew strategic ("audience X is consistently your highest-ROAS — consider expanding") rather than tactical ("pause ad 123").

### `/show-report <show>`

Single-show deep dive. The argument can be a show name fragment or a campaign/ad-set ID.

**Procedure:**
1. Resolve `<show>` → matching campaigns / ad sets (search by name)
2. Fetch insights for the matched objects across their entire delivery window
3. Compute time-to-show urgency tier (>30d, 7–30d, <7d, <72h) — pulls show date from campaign name convention or asks the user
4. If urgency tier is high and pacing is weak, that becomes the top HIGH recommendation
5. Render report; write to `reports/shows/<today>-<slug>.md`

The skill must handle the case where multiple campaigns map to one show, and where the show date isn't encoded in the campaign name (ask the operator).

### `/pacing-check`

Quick health check, chat-only output. Three sections: **over/under-pacing budgets**, **learning-phase status**, **frequency drift**. No file written. Designed to be runnable any time without cluttering `reports/`.

## Report format

All file-producing skills emit reports following this template (defined in `prompts/report-structure.md`):

```markdown
# <Period> Meta Ads Report — YYYY-MM-DD

## TL;DR
- 3–5 bullets covering the most important changes and the top recommendation.

## KPIs at a glance
| Metric | Value | vs prev period | vs target |
| Spend, Purchases, ROAS, CPA, CTR, Frequency | … | … | … |

## Spend by campaign
| Campaign | Status | Spend | Purchases | ROAS | Trend (↑↓→) |

## Top movers
**Wins:** named campaigns/ad sets that improved meaningfully, with the metric that improved.
**Concerns:** named campaigns/ad sets that regressed, with the metric that regressed.

## Recommendations (ranked)
1. **[HIGH]** <Action> — <Why, citing a `references/` doc> — <Expected impact>
2. **[MED]** …
3. **[LOW]** …

## Methodology
- Date range, ad account, anything excluded (e.g. paused campaigns dropped from delta math).
```

Targets in "vs target" come from `references/account-context.md` (e.g. target ROAS).

## Recommendation rubric

Defined in `prompts/recommendation-rubric.md`:

- **HIGH** — clear, time-sensitive waste or sellout risk. Example: an ad set with 4× target CPA on a show <7 days out, or a campaign under-pacing budget on a show <72h out.
- **MED** — fixable inefficiency without urgency. Example: rising frequency above 4 with falling CTR; a placement consistently underperforming.
- **LOW** — experimentation. Example: a creative refresh worth testing; a small audience expansion.

Every recommendation must be:
1. **Specific** — names the campaign / ad set / ad
2. **Actionable** — one concrete change the operator can make in Ads Manager
3. **Justified** — cites a metric threshold and, where relevant, a `references/` doc that explains why

## References

`references/` contains short, concrete docs the skills cite when explaining recommendations. Drafted from public Meta documentation; we may borrow text patterns from the MIT-licensed `mathiaschu/meta-ads-analyzer` repo as inspiration.

- `breakdown-effect.md` — why Meta sometimes allocates budget to seemingly worse segments and what that implies for human-driven reallocation
- `learning-phase.md` — when to leave a campaign alone, what signals indicate exit
- `auction-basics.md` — bid, estimated action rate, ad quality
- `account-context.md` — Acme Events-specific: typical ticket prices, target ROAS, time-to-show urgency tiers, naming conventions used in campaigns

## Permissions (suggest-only enforcement)

`.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__meta-ads__get_*",
      "mcp__meta-ads__list_*",
      "mcp__meta-ads__health_check",
      "mcp__meta-ads__compare_performance",
      "mcp__meta-ads__export_insights",
      "mcp__meta-ads__diagnose_campaign_readiness",
      "mcp__meta-ads__check_account_setup",
      "Read",
      "Write",
      "Edit",
      "Bash(mkdir:*)",
      "Bash(date:*)"
    ],
    "deny": [
      "mcp__meta-ads__create_*",
      "mcp__meta-ads__update_*",
      "mcp__meta-ads__pause_*",
      "mcp__meta-ads__resume_*"
    ]
  }
}
```

Exact tool names will be verified against `brijr/meta-mcp`'s tool surface during implementation; the wildcard `deny` list is the safety net.

## Testing approach (v1)

Lightweight; promote to a real test framework only when reports regress.

- Capture sample MCP responses (insights for one campaign, list of campaigns, etc.) to `fixtures/` manually, once
- Each skill is exercised twice during initial implementation: once against fixtures (dry run), once against the live account
- Eyeball the report output for accuracy on totals, rankings, and rec citations

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM math drift on totals or week-over-week deltas | Reports always show the methodology section so the operator can spot-check; if drift recurs, promote that skill to a `scripts/` helper that does the math in code. |
| Token expiry breaking all skills silently | README documents the 60-day refresh; `/pacing-check` includes a token health check via `mcp__meta-ads__get_token_info` and surfaces expiry. |
| Recommendations ignore Learning Phase and propose pausing a campaign too early | Recommendation rubric requires citing `references/learning-phase.md` before recommending a pause; skills must check the campaign's learning status first. |
| Permissions list drifts out of sync with the MCP's tool names | Wildcard deny patterns (`create_*`, `update_*`, `pause_*`, `resume_*`) catch new write tools the MCP might add later. |

## Out of scope (deferred)

- Diagnostic skills (`/diagnose-campaign`, `/creative-fatigue`, `/audience-overlap`)
- Pre-launch review (`/pre-flight`)
- Recommendation application (write actions through the MCP)
- Cross-period trend visualization beyond simple deltas in tables
- Cross-platform (Google, TikTok)
- Joining external sales data (Acme Events backend) — not needed because Meta has purchase events
- Scheduling / cron — operator runs skills manually for v1; can layer `/schedule` on top later

## Open implementation questions

These are answered during implementation, not now:

1. Exact `brijr/meta-mcp` tool names (`get_insights` vs `get_campaign_insights`, etc.) — verify against the README before writing each skill's procedure
2. Whether `reports/` should be gitignored or committed (probably committed for week-over-week skill access; depends on whether anything sensitive lands in tables)
3. Show-date convention in Acme Events campaign names (the operator will tell us when implementing `/show-report`)
