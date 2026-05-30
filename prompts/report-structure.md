# Report structure

Every file-producing skill in this repo emits Markdown that follows this skeleton. Skills may add sections, but must not remove these or change the section order.

```markdown
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
```

## Rules

1. **Never invent numbers.** If a metric is unavailable in the MCP response, write `n/a` and explain in Methodology.
2. **Round consistently.** Currency to 2dp, percentages to 2dp, ROAS to 2dp, frequency to 2dp.
3. **Trend arrows** in Spend-by-campaign use ↑ for ≥+10% spend or purchases vs prior period, ↓ for ≤−10%, → otherwise.
4. **TL;DR is human-skimmable.** No metric soup; every bullet should make sense to someone who reads only that section.
5. **Methodology is non-negotiable.** It exists so the operator can sanity-check the numbers.
