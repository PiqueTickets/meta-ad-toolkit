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

- Call any `mcp__meta-ads__create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`, `create_ad_set`, `create_ad_creative`, `create_custom_audience`, or `create_lookalike_audience` tool.
- Call any `mcp__meta-ads-write__*` tool (`create_ad`, `update_ad`, `pause_ad`, `resume_ad`, `pause_adset`, `resume_adset`, `update_adset`, `upload_video`, `upload_image`, `delete_ad`).
- Recommend creating new campaigns / ad sets / ads / creatives. (See `prompts/recommendation-rubric.md` anti-rule #3.)
- Recommend "use /build-ads to do X" as the recommendation. The operator decides when to mutate. (Anti-rule #5.)
- Round inconsistently or invent numbers.
