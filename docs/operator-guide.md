# Operator guide

Day-to-day usage of the meta-ad-toolkit skills. Setup lives in the [README](../README.md); this doc covers what to run, how to read the output, and how to tune the system.

## At a glance

| Skill | Cadence | Output | Purpose |
|---|---|---|---|
| `/pacing-check` | Daily / mid-week | Chat only | Quick pulse: pacing, learning, frequency drift |
| `/weekly-report` | Weekly | `reports/weekly/<date>-weekly.md` + chat | Trailing 7-day account review, tactical recs |
| `/monthly-report` | Monthly | `reports/monthly/<YYYY-MM>-monthly.md` + chat | Calendar-month review, strategic recs |
| `/show-report <name>` | Per-show | `reports/shows/<date>-<slug>.md` + chat | Single-show deep dive, urgency-weighted |

## Suggested operating cadence

- **Daily (under a minute):** `/pacing-check`. Catches budget exhaustion, ad sets stuck in Learning, and creative fatigue before they bite.
- **Weekly (Monday-ish):** `/weekly-report`. Read the TL;DR and act on every HIGH the same day. Triage MEDs into the week's adjustment list.
- **Monthly (first week of the new month):** `/monthly-report` against the previous calendar month. Use the strategic recs to retune `references/account-context.md` — month-level patterns are the right granularity for changing targets.
- **Show milestones:** `/show-report <name>` at three points — 7 days out, 24 hours out, and as a post-mortem after the show. The 7-day run shapes pacing decisions; the 24-hour run is sellout-urgency mode; the post-mortem feeds your next similar show.

## When NOT to run a skill

- **Within 24 hours of a major edit** (budget, optimization goal, audience, creative): the affected ad sets re-enter Learning and any report will look like a regression. See `references/learning-phase.md`.
- **No active campaigns:** `/weekly-report` will produce a stub with `"No active spend during <window>"` — informational only. Skip until you're delivering again.

## Reading a report

Every file-producing skill emits the same skeleton (defined in `prompts/report-structure.md`):

1. **TL;DR** — 3–5 bullets. If you read nothing else, read this. The single highest-priority recommendation is in here.
2. **KPIs at a glance** — Spend, Purchases, ROAS, CPA, CTR, Frequency, with deltas vs prior period and against your targets.
3. **Spend by campaign** — Per-campaign table with trend arrows. ↑ = ≥+10% spend or purchases vs prior; ↓ = ≤−10%; → otherwise.
4. **Top movers** — Wins (ROAS up ≥0.5×) and Concerns (ROAS down ≥0.5× or CPA above target by ≥50%), filtered to non-trivial spend.
5. **Recommendations (ranked)** — Up to 7, each tagged HIGH / MED / LOW, each citing either a metric threshold or a `references/` doc.
6. **Methodology** — Date range, account, exclusions, tools used. The audit trail. Sanity-check numbers here when something looks off — the most common culprit is a timezone mismatch between the MCP and Ads Manager.

## Acting on recommendations

The rubric in `prompts/recommendation-rubric.md` defines what each tier means. Translated to operator action:

| Tier | What it means | When to act |
|---|---|---|
| **HIGH** | Time-sensitive waste or sellout risk; data is unambiguous; reversible | Same day. Skipping a HIGH means accepting the loss. |
| **MED** | Fixable inefficiency; signal is consistent ≥3 days | This week. Bundle MEDs into one Ads Manager session. |
| **LOW** | Worth queuing as an experiment | When you next have testing budget. |

### When to override a recommendation

Recommendations are suggestions — the operator decides. Override if:

- The justification doesn't match what you see in Ads Manager. (Recheck the report's Methodology — if numbers diverge, raise it; the skill is wrong, not you.)
- The recommendation pauses or budget-cuts an ad set whose Learning status the report didn't verify. The anti-rules in the rubric forbid this, but if it slips through, ignore the rec.
- The recommendation moves budget away from a show with sellout urgency (Hot or Critical tier). Pacing usually wins over efficiency in those tiers.

If you find yourself overriding the same kind of rec repeatedly, that's a signal to retune — see "Tuning the targets" below.

## Tuning the targets

`references/account-context.md` is the single tuning surface. Edit the file and the next skill run uses the new values — no restart, no rebuild.

What to tune, and the signal that says it's time:

- **Target ROAS (seeded at 3.0×)** — Retune when monthly reports consistently show ROAS far above (you're under-spending) or below (you're chasing a target the offer can't support) for ≥2 months.
- **Target CPA range (seeded $8–$15)** — Tighten once you have ≥30 days of post-Learning data. The seed is wide on purpose.
- **Target CTR (≥1.0%) and Frequency (≤4)** — Less likely to need retuning; revisit only if creative refresh recs feel premature or overdue.
- **Time-to-show urgency tiers** — Adjust the day-thresholds if Acme Events' typical sales curve doesn't match Cold/Warm/Hot/Critical. Comedy may have a sharper last-week spike than the seeds assume.
- **Campaign naming convention** — `/show-report` parses dates from campaign names using `<show> | <venue> | <YYYY-MM-DD>`. If your convention differs, update this section so the parser keeps working.

After editing the context file, commit it. The git history of that file is your tuning record.

## Token hygiene

Long-lived Meta tokens last ~60 days.

- `/pacing-check` checks token expiry on every run; expiry within 7 days surfaces as the first item.
- To refresh: mint a new long-lived token via Graph API Explorer (same flow as initial setup), update `META_ACCESS_TOKEN` in `.env`, restart Claude Code.
- The other skills also surface a warning banner above TL;DR when expiry is near.

## Reports are tracked in git

`reports/` is intentionally not gitignored. Two reasons:

1. The cross-check step (in `/weekly-report` and `/monthly-report`) reads the prior period's report to note whether previous HIGH recommendations appear to have been acted on.
2. Reports are a record of what the system suggested and what you did. Useful for retrospectives.

Commit reports periodically — there's no automation around this.

## Troubleshooting

**Numbers don't match Ads Manager.** First suspect: timezone. The MCP defaults to UTC; the ad account is likely in PT/ET. The skill instructions document timezone handling; if a particular run is off, check the report's Methodology — it should state which timezone was used.

**A skill cites the wrong reference doc.** The skills cite `references/breakdown-effect.md` and `references/learning-phase.md` per anti-rules in the rubric. If you see a citation that doesn't fit the recommendation, the skill is misapplying — note the rec ID and surface it; the skill prompt may need a clarification.

**MCP tools missing.** If a skill fails with "no MCP tool available," the `meta-ads` server didn't load. Check that `.env` is populated, then quit and reopen Claude Code. `.mcp.json` is only read on session start.

**Report says "Excluded" with campaign names listed.** Some `get_insights` calls timed out or returned partial data. Re-run the skill; if it persists, check Meta API status.

## What the skills will not do

By design, by permissions, and reiterated in every `SKILL.md`:

- No writes to your ad account. No `create_*`, `update_*`, `pause_*`, `resume_*`. The deny list in `.claude/settings.json` enforces this.
- No recommendations to create new campaigns / ad sets / ads / creatives. If a creative refresh is the right move, the skill recommends it as a brief — you build it elsewhere.
- No fabricated metrics. If a number is unavailable, the report writes `n/a` and explains in Methodology.

## Where things live

- Skills: `.claude/skills/<name>/SKILL.md`
- Shared report template: `prompts/report-structure.md`
- Recommendation rubric: `prompts/recommendation-rubric.md`
- Meta-mechanics references: `references/{breakdown-effect,learning-phase,auction-basics}.md`
- Operator-tuned context: `references/account-context.md`
- Design spec: `docs/superpowers/specs/2026-05-07-meta-ad-automation-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-07-meta-ad-automation.md`
- Fixture-capture handoff: `docs/superpowers/notes/capture-fixtures.md`
