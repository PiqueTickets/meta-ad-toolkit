# Architecture overview

How the pieces fit, what runs where, and why the system is shaped this way. Audience: a future maintainer (likely a different LLM or a human extending the project), not the day-to-day operator.

## What this system is

A Claude Code project that turns natural-language requests like "run the weekly report" into Markdown performance reports for Acme Events' Meta ad campaigns. Reports include ranked, justified recommendations. The read skills are **suggest-only** — they never write back to the ad account. A separate, guarded `/build-ads` path can mutate the account, but only behind an explicit, time-boxed authorization gate (see Read/write surface split below).

## What this system is not

- Not an application. There is no Python, Node, or service runtime to deploy. The repo is configuration, prompts, and references — Claude Code is the runtime.
- Not a dashboard. There is no UI; output is Markdown in chat and on disk.
- Not autonomous. Every run is operator-initiated via a slash command.
- Not multi-platform. Only Meta. Google Ads / TikTok / etc. are deferred (see "Out of scope" below).

## Runtime topology

```
┌──────────────────────────┐       stdio        ┌──────────────────────────┐
│ Claude Code              │ ◀──────────────▶   │ meta-ads-mcp (Node)      │
│  - skill + prompt files  │                    │  - npx-launched per       │
│  - permission gates      │                    │    session                │
│  - file I/O (Read/Write) │                    │  - reads .env             │
└──────────┬───────────────┘                    └────────────┬─────────────┘
           │                                                 │ HTTPS
           │                                                 ▼
           │                                     ┌────────────────────────┐
           │                                     │ Meta Marketing API     │
           │                                     │ (Graph API endpoints)  │
           │                                     └────────────────────────┘
           ▼
┌──────────────────────────┐
│ Filesystem (this repo)   │
│  - reports/ (committed)  │
│  - fixtures/ (gitignored)│
└──────────────────────────┘
```

The MCP server is launched by Claude Code on session start (per `.mcp.json`). It speaks JSON-RPC over stdio to Claude Code and HTTPS to Meta. There is no local persistence in the MCP — every call hits the Graph API.

## Why pure skills + Markdown (no helper code)

The brainstorming session considered three architectures:

1. Pure skills + Markdown (chosen)
2. Skills + thin Python helpers for math
3. Skills + a small CLI wrapper around the MCP

Option 1 won because:

- **The MCP already does the API work.** Adding helper code only re-implements aggregation that the LLM can do well from raw insights JSON, while introducing a runtime dependency, a build step, and a second place for bugs to hide.
- **Tuning the system means editing prose.** Targets, rubric tiers, and Meta-mechanics explanations are all things that change as the operator learns. Markdown is the right surface for those edits — no PR review needed, no rebuild, no test rerun.
- **One source of truth per concern.** Each skill is one file. Each tuning lever (targets, rubric, references) is one file. Locality beats abstraction at this scale.

The cost is correctness risk in arithmetic. The mitigation is the Methodology section in every report — it forces the skill to spell out its date windows, exclusions, and tools used, which is exactly what an operator needs to sanity-check numbers against Ads Manager.

## Component inventory

| Path | Purpose | Edited when |
|---|---|---|
| `.mcp.json` | Wires `meta-ads-mcp` into Claude Code | Switching MCP servers, changing env vars |
| `.claude/settings.json` | Permission allow list and `PreToolUse` hook gating writes on `.build-ads-active` | Adding a new tool to the allow list, or modifying the hook scope |
| `.claude/skills/<name>/SKILL.md` | One slash command, one procedure | Tuning a skill's procedure |
| `prompts/report-structure.md` | Canonical Markdown skeleton every report follows | Adding a section across all reports |
| `prompts/recommendation-rubric.md` | HIGH/MED/LOW criteria + anti-rules | Retuning what counts as urgent |
| `references/breakdown-effect.md` | Meta-mechanics: why "worst" segments aren't always to pause | Rarely (the mechanics don't change) |
| `references/learning-phase.md` | Meta-mechanics: noise during ad-set Learning | Rarely |
| `references/auction-basics.md` | Meta-mechanics: bid × action rate × quality | Rarely |
| `references/account-context.md` | Operator-tuned targets, urgency tiers, naming | Frequently — this is the tuning surface |
| `reports/{weekly,monthly,shows}/` | Generated reports, committed to git | Every skill run |
| `fixtures/*.json` | Captured MCP responses for dry-runs | When the MCP shape changes |
| `.env` (gitignored) | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Token refresh (~every 60 days) |
| `tools/meta-ads-write/` | Bundled MCP server providing the 11 gap tools `meta-ads-mcp` doesn't expose | New write tool, schema change, or rate-limit tuning |
| `.claude/skills/build-ads/SKILL.md` | The mutation surface skill | Tuning the build-ads procedure |
| `prompts/build-spec-schema.md` | Canonical YAML build-spec format | Adding a new `kind` or creative shape |
| `references/build-safety.md` | Operator-facing safety rules and recovery scenarios | Updating recovery procedures |
| `specs/builds/` | Generated build specs (committed) | Every `/build-ads` run |
| `reports/builds/` | Generated build logs (committed) | Every `/build-ads` run |
| `.build-ads-active` (gitignored) | Marker file that authorizes writes; created by `/build-ads`, removed at end | Never edited by hand |

## MCP server choice

The MCP is `brijr/meta-mcp`, distributed on npm as `meta-ads-mcp`. The selection criteria:

- **MIT-licensed** — no commercial gating
- **No membership / no third-party SaaS** — direct Meta Graph API client; user provides their own token
- **Comprehensive read coverage** — enumerates accounts, campaigns, ad sets, ads, creatives, audiences, insights, plus health/diagnostic tools
- **Low operational footprint** — single npx invocation, no service to host

`pipeboard-co/meta-ads-mcp` was the initial candidate but routes through Pipeboard's hosted infrastructure and gates some functionality behind a membership. `brijr/meta-mcp` was a like-for-like alternative without that constraint.

If the npm name `meta-ads-mcp` is ever reassigned or the brijr package is abandoned, the fallback path documented in the plan is to clone `https://github.com/brijr/meta-mcp` directly and point `.mcp.json` at the local build.

**Allow-list / tool-name drift:** the `mcp__meta-ads__*` entries in
`.claude/settings.json` are version-sensitive — `meta-ads-mcp` has renamed tools
across releases (e.g. `get_campaigns` vs `list_campaigns`). Treat the allow-list
as a starting point to verify against your installed version, not a guarantee.

## Read/write surface split

The project has two surfaces:

**Read skills** — `/weekly-report`, `/monthly-report`, `/show-report`, `/pacing-check`. Suggest-only by construction. Three independent layers enforce this:

1. The `PreToolUse` hook in `.claude/settings.json` blocks every `mcp__meta-ads__create_*` / `update_*` / `pause_*` / `resume_*` tool and every `mcp__meta-ads-write__*` tool unless the marker file `.build-ads-active` exists and is younger than 1 hour. Read skills never create the marker.
2. Each read SKILL.md ends with a "What this skill must NOT do" section that enumerates every forbidden write tool by name.
3. `prompts/recommendation-rubric.md` anti-rule #3 forbids recommending creation of new campaigns/ad sets/ads/creatives; anti-rule #5 forbids recommending "use /build-ads to do X."

**Write skill** — `/build-ads`. The only skill that mutates the ad account. Three independent layers enforce safe execution:

1. The operator must explicitly invoke `/build-ads`. The skill creates `.build-ads-active` at start (`Bash(touch .build-ads-active)`) and deletes it at end (`Bash(rm -f .build-ads-active)`). The marker self-expires after 1 hour to limit blast radius if the skill is killed mid-run.
2. Every run produces a YAML spec at `specs/builds/<date>-<slug>.yml` that the operator must approve before execution.
3. A read-only dry-run preview resolves all parent IDs, validates assets, and asks for one final confirmation before any mutation.

Removing any one layer of either surface weakens but does not break the guarantee. Adding new write tools to either surface is a deliberate, multi-step change documented in `tools/meta-ads-write/README.md` and `references/build-safety.md`.

## Data flow: a `/weekly-report` run

1. Operator types `/weekly-report` (or any natural-language equivalent that matches the skill description).
2. Claude Code loads `.claude/skills/weekly-report/SKILL.md` and follows the procedure.
3. Step 1: `mcp__meta-ads__health_check` and `mcp__meta-ads__get_token_info` — environment sanity.
4. Step 2: resolve the trailing-7-day window in account timezone.
5. Step 3: `mcp__meta-ads__get_campaigns`, then `get_insights` for current and prior windows.
6. Step 4–5: aggregate totals and identify movers (LLM does this from the JSON).
7. Step 6: generate ≤7 recommendations, each conforming to `prompts/recommendation-rubric.md`. Recommendations that touch ad sets in Learning cite `references/learning-phase.md`; those that propose breakdown-based exclusions cite `references/breakdown-effect.md`.
8. Step 7: render using `prompts/report-structure.md`, write to `reports/weekly/<end-date>-weekly.md`, echo to chat.
9. Step 8: read last week's report (if present) and note in the TL;DR whether previous HIGH recs appear acted on.

The other skills follow the same shape, varying in date windows, output path, and the recommendation flavor (tactical vs strategic vs urgency-weighted).

## Cross-session memory

Reports are committed to git on purpose — they are how the system remembers its own past output across sessions. Two consumers:

- **Cross-check step** in `/weekly-report` and `/monthly-report` reads the prior report by dated filename.
- **Operator retrospective** — git history of `reports/` and `references/account-context.md` together tell the story of what the system suggested and how the operator's targets evolved.

Fixtures are gitignored because they contain real account data; reports are committed because the recommendations are derived information, not raw account contents.

## Extension points

**Adding a new skill:**

1. Create `.claude/skills/<name>/SKILL.md` with frontmatter (`name`, `description`).
2. Copy the structure of `weekly-report/SKILL.md` — it's the canonical reference. Adapt date logic, output path, and recommendation flavor.
3. Reference `prompts/report-structure.md` and `prompts/recommendation-rubric.md` if it produces a report.
4. If the skill needs an MCP tool not yet in `.claude/settings.json`'s allow list, add it. Verify the same tool is not on the deny list.

**Adding a new reference doc:**

1. Drop a Markdown file in `references/`.
2. Cite it from any skill that should justify recommendations using its content. The cite is by relative path: ``"see `references/<doc>.md`"``.
3. The skill prompt enforces the cite — if the rubric requires the citation and the recommendation lacks it, the model self-corrects.

**Retuning the rubric:**

Edit `prompts/recommendation-rubric.md`. Every report skill consumes it at run time — no rebuild. The HIGH/MED/LOW thresholds and anti-rules are the operator's policy surface for "what should the system warn about."

**Switching MCP servers:**

1. Update `.mcp.json` to point at the new server (npm package, local path, or remote endpoint).
2. Update `.claude/settings.json` allow/deny lists if tool names differ. The naming pattern is `mcp__<server-name>__<tool-name>`.
3. Each skill file references tools by the `mcp__meta-ads__*` prefix; if the server name changes, skills need updating too. Keep the server name `meta-ads` to avoid this.
4. Recapture fixtures — JSON shapes may differ.

## Out of scope (intentional)

These were considered during design and explicitly deferred:

- **Diagnostic / pre-launch skills** that critique a campaign before it ships. Useful but premature; v1 focuses on after-the-fact review where the data exists.
- **Autonomous or bulk write actions.** `/build-ads` is the single operator-gated write path (draft → approve → dry-run → execute). Unattended budget-cutting, scheduled creative refresh, and bulk mutations stay out of scope — every write is operator-initiated and reviewed.
- **Cross-platform** (Google, TikTok, organic social). Each platform's MCP has different shape; lifting the abstraction is more work than it's worth until at least one is in production use.
- **External sales joins** (Acme Events's own ticket-sales DB joined with Meta spend). Powerful but requires a second data source the v1 doesn't have. The Pixel/CAPI conversion data Meta returns is the v1 ground truth.
- **Slack / email distribution** of reports. Reports go to chat and disk; copy-paste to Slack is fine for v1.

If any of these become priorities, each is its own design + plan cycle following the brainstorming → writing-plans → subagent-driven-development workflow.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Operator believes recommendations without sanity-checking | Every report has a Methodology section; Top 2 KPIs in TL;DR are easily spot-checked against Ads Manager |
| Skill fabricates numbers when data is missing | Skill instructions require `n/a` + Methodology note instead of inventing values |
| MCP returns shape that breaks aggregation logic | Fixtures + dry-run step in each skill catch shape changes before live runs |
| Token expires silently mid-week | `/pacing-check` and every report skill check `get_token_info` and warn at <7 days |
| Permission deny list becomes stale (new write tool released) | The deny list is a known-good list, not a wildcard; operator should periodically review against the MCP's tool list. A wildcard `mcp__meta-ads__create_*` style would be safer if the MCP supports it; current Claude Code permissions are exact-match |
| Recommendation pushes a pause during Learning Phase | Rubric anti-rule + skill instruction + `references/learning-phase.md` citation requirement; three layers must all fail to produce a bad pause |
| Breakdown-effect exclusions recommended on surface metrics | Same three-layer pattern with `references/breakdown-effect.md` |

## Reference docs and rationale

- **Spec:** `docs/superpowers/specs/2026-05-07-meta-ad-automation-design.md` — design decisions and trade-offs at the time of writing.
- **Plan:** `docs/superpowers/plans/2026-05-07-meta-ad-automation.md` — task-by-task implementation log; how the repo got built.
- **Operator guide:** `docs/operator-guide.md` — day-to-day usage; the audience-flipped twin of this doc.
- **Fixture-capture handoff:** `docs/superpowers/notes/capture-fixtures.md` — how to populate `fixtures/` for dry-runs.
