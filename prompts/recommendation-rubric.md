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
3. **Report skills are suggest-only. Mutations only happen through `/build-ads`.** Report skills must not call any `mcp__meta-ads__create_*` / `update_*` / `pause_*` / `resume_*` tool, nor any `mcp__meta-ads-write__*` tool. If a creative refresh or ad creation is the right move, recommend it as a brief — the operator runs `/build-ads` separately to execute the brief.
4. **Never recommend more than 7 actions per report.** If the report would suggest more, group them by theme in MED/LOW or move the long tail into the Methodology section as "also noticed."
5. **Report skills must not include "use /build-ads to do X" as a recommendation.** Keep the read and write surfaces independent so the operator decides when to mutate. Recommendations describe *what* to do; the operator chooses the tool.
