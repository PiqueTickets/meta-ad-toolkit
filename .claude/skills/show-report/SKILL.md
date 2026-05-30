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

- Call any `mcp__meta-ads__create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`, `create_ad_set`, `create_ad_creative`, `create_custom_audience`, or `create_lookalike_audience` tool.
- Call any `mcp__meta-ads-write__*` tool (`create_ad`, `update_ad`, `pause_ad`, `resume_ad`, `pause_adset`, `resume_adset`, `update_adset`, `upload_video`, `upload_image`, `delete_ad`).
- Recommend creating new campaigns / ad sets / ads / creatives. (See `prompts/recommendation-rubric.md` anti-rule #3.)
- Recommend "use /build-ads to do X" as the recommendation. The operator decides when to mutate. (Anti-rule #5.)
- Round inconsistently or invent numbers.
- Never assume a show date.
