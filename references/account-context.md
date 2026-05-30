# Account context for Meta ads

Operator-curated context the report skills use when interpreting performance and ranking recommendations. Update this doc as the business changes.

## Product

`<your brand>` sells tickets to live events (comedy, music, theater, etc.). Each campaign typically promotes one event with a fixed date. Replace this paragraph with a short description of your business and how your campaigns map to events.

## Target metrics

| Metric | Target | Notes |
|---|---|---|
| ROAS | **3.0×** | Average target. Premium-priced touring acts may target 4×; cheaper local shows may run profitably at 2×. |
| CPA (purchase) | **$8–$15** | Varies by ticket price. Refine per campaign once enough data exists. |
| CTR | **≥ 1.0%** | Below 0.5% on a show campaign with 7+ days of delivery is a creative signal. |
| Frequency | **≤ 4** | Above 4 with declining CTR is a refresh trigger. |

(**Placeholders — replace before relying on recommendations.** These are illustrative defaults; set them from your own finance / historical data. Every report skill reads this file at run time, so edits take effect on the next run with no rebuild.)

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
