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

- Call any `mcp__meta-ads__create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`, `create_ad_set`, `create_ad_creative`, `create_custom_audience`, or `create_lookalike_audience` tool.
- Call any `mcp__meta-ads-write__*` tool (`create_ad`, `update_ad`, `pause_ad`, `resume_ad`, `pause_adset`, `resume_adset`, `update_adset`, `upload_video`, `upload_image`, `delete_ad`).
- Recommend creating new campaigns / ad sets / ads / creatives. (See `prompts/recommendation-rubric.md` anti-rule #3.)
- Recommend "use /build-ads to do X" as the recommendation. The operator decides when to mutate. (Anti-rule #5.)
- Round inconsistently or invent numbers.
