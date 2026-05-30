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

```
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
```

If everything is healthy, output one line: `All campaigns pacing within tolerance, no learning anomalies, no frequency drift. ✅`

## Outputs

Chat only. No file written.

## What this skill must NOT do

- Call any `mcp__meta-ads__create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`, `create_ad_set`, `create_ad_creative`, `create_custom_audience`, or `create_lookalike_audience` tool.
- Call any `mcp__meta-ads-write__*` tool (`create_ad`, `update_ad`, `pause_ad`, `resume_ad`, `pause_adset`, `resume_adset`, `update_adset`, `upload_video`, `upload_image`, `delete_ad`).
- Recommend creating new campaigns / ad sets / ads / creatives. (See `prompts/recommendation-rubric.md` anti-rule #3.)
- Recommend "use /build-ads to do X" as the recommendation. The operator decides when to mutate. (Anti-rule #5.)
- Round inconsistently or invent numbers.
