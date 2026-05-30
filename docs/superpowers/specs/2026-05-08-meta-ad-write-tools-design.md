# Meta ad write tools — design spec

_Date: 2026-05-08. Author: brainstormed in-session. Status: approved, ready for implementation plan._

## Goal

Add a controlled mutation surface to the meta-ad-automation project so the operator can build Meta ads through a Claude Code skill (`/build-ads`) instead of in Ads Manager, while preserving the existing read skills' suggest-only contract.

## Non-goals

- Replacing Ads Manager. Ads Manager remains the source of truth and the place complex troubleshooting happens.
- Autonomous campaign management. Every mutation requires operator-typed slash command, spec review, and dry-run confirmation.
- Cross-platform (Google, TikTok). Same scope as the rest of the project — Meta only.
- Idempotency / rollback. v1 documents the no-rollback stance in `references/build-safety.md`. Re-running a partially executed spec creates duplicates.
- Live integration tests. v1 tests writes via mocks; live mutations are tested by the operator running the skill against a real account during initial validation.

## Background and context

The project is currently suggest-only by deliberate architectural choice. Three independent layers enforce that contract:

1. `.claude/settings.json` denies every Meta write tool.
2. Each `SKILL.md` ends with a "What this skill must NOT do" section.
3. `prompts/recommendation-rubric.md` anti-rule #3 forbids recommending creation.

The architecture doc says, verbatim: _"That friction is the point."_ This spec deliberately rewrites that contract to add a controlled write path. The read skills (`/weekly-report`, `/monthly-report`, `/show-report`, `/pacing-check`) remain suggest-only; mutations are confined to a new `/build-ads` skill, gated by a `PreToolUse` hook scoped to that skill.

The immediate motivating use case is splitting a Meta video carousel into N single-video ads, but the design is general (full create surface for campaigns, ad sets, ads, creatives, audiences).

## Decisions (resolved during brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Write surface | A new dedicated `/build-ads` skill only. Read skills stay suggest-only. |
| 2 | Tool scope | Full create surface (campaigns, ad sets, ads, creatives, audiences). |
| 3 | Operator input | Conversational → YAML spec on disk → review → dry-run → execute. |
| 4 | Execution gate | Spec approval **and** dry-run preview before any mutation. |
| 5 | MCP architecture | Approach A — sibling MCP server in this repo for gap tools; keep upstream `meta-ads-mcp` as-is for everything it already does. |
| 6 | Defense layer for the deny-list | 4b — `PreToolUse` hook gated on a marker file `.build-ads-active` (gitignored) created by the `/build-ads` skill at start, deleted at end. Hook also checks marker mtime is within 1 hour to avoid stale-marker false positives. |
| 7 | Default new-ad status | `PAUSED`. Operator must explicitly set `ACTIVE` in spec. |
| 8 | Spec interpolation | Support `{{copy_from: <ad_id>}}` for body/headline/CTA reuse. No other interpolation in v1. |
| 9 | No-rollback / no-idempotency stance | Documented in `references/build-safety.md`. Re-runs create duplicates; partial failures halt and report state. |

## Architecture

### Repo layout

**New entries:**

```
meta-ad-automation/
├── .claude/skills/build-ads/SKILL.md
├── prompts/build-spec-schema.md
├── references/build-safety.md
├── specs/builds/                       (new dir, gitkeep)
├── reports/builds/                     (new dir, gitkeep)
└── tools/meta-ads-write/
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    ├── scripts/smoke.ts
    ├── src/
    │   ├── index.ts                    (server bootstrap, tool registration)
    │   ├── meta-api.ts                 (thin Graph API client)
    │   └── tools/
    │       ├── create-ad.ts
    │       ├── update-ad.ts
    │       ├── pause-resume.ts         (pause_ad, resume_ad, pause_adset, resume_adset)
    │       ├── update-adset.ts
    │       ├── upload-asset.ts         (upload_video, upload_image)
    │       └── delete-ad.ts
    └── src/__tests__/
        ├── create-ad.test.ts
        ├── pause-resume.test.ts
        ├── upload-asset.test.ts
        ├── meta-api.test.ts
        └── safety-gates.test.ts
```

**Modified files:**

- `.mcp.json` — adds the second server entry pointing at `./tools/meta-ads-write/dist/index.js`. Same `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` env source.
- `.claude/settings.json` — moves write tools from `deny` to `allow`, adds the `PreToolUse` hook (decision 6).
- `prompts/recommendation-rubric.md` — anti-rule #3 rescoped; new anti-rule #5 added (see Safety section).
- All existing read `SKILL.md` files — explicit "must NOT call" enumeration of write tools added.
- `docs/architecture.md` — "Suggest-only enforcement" section rewritten to describe the read/write split.
- `README.md` — adds "Building ads with /build-ads" section.

### Runtime topology

```
┌──────────────────────────┐       stdio         ┌──────────────────────────┐
│ Claude Code              │ ◀──────────────▶    │ meta-ads-mcp (npx)       │
│  - skill files           │                     │ (read + existing creates)│
│  - PreToolUse hook       │                     └──────────────────────────┘
│  - file I/O              │
│                          │       stdio         ┌──────────────────────────┐
│                          │ ◀──────────────▶    │ meta-ads-write (local)   │
│                          │                     │ (create_ad, update_ad,   │
│                          │                     │  pause/resume, uploads,  │
│                          │                     │  delete_ad)              │
│                          │                     └────────────┬─────────────┘
└──────────┬───────────────┘                                  │ HTTPS
           ▼                                                  ▼
       Filesystem                                    Meta Marketing API
       (specs/, reports/)
```

The hook intercepts every `mcp__meta-ads__*` and `mcp__meta-ads-write__*` write-tool call before it dispatches. If `.build-ads-active` is missing or older than 1 hour, the call is rejected with a clear error pointing at `/build-ads`.

## Workflow

```
1. Operator runs `/build-ads` (with or without intent in chat).

2. Conversational drafting:
   - Claude asks for intent if not provided.
   - Resolves IDs, fetches existing-ad copy if {{copy_from: <id>}} interpolation
     is implied.
   - Drafts a YAML spec at specs/builds/<date>-<slug>.yml.

3. Spec review:
   - Operator edits the file directly or instructs changes in chat.
   - Claude re-renders the spec until "looks good" / "execute".

4. Dry-run preview (read-only):
   - Validates spec against zod schema.
   - Confirms parent objects exist (campaign / ad set IDs resolvable).
   - Confirms local assets exist on disk.
   - Resolves all {{copy_from}} interpolations.
   - Prints summary: "Will upload N videos, create M creatives, create K ads
     in ad set X. Status defaults to PAUSED. New live ads: 0."
   - Asks: "Execute? (yes / no / edit-spec)"

5. Execution:
   - Creates `.build-ads-active` marker file (touch) at start.
   - Calls tools in spec order. Each call is logged to reports/builds/<date>-<slug>.md
     with the request, the response (IDs), and timing.
   - On any tool error: halt, report what's been created, delete the marker.
     The operator resumes by editing the spec to remove completed items and
     re-invoking /build-ads (which re-creates the marker).
   - On success: deletes the marker, writes a summary line to the build log,
     echoes summary to chat with the new ad/creative/ad-set IDs.
   - On unexpected interrupt (operator kills session): the marker is left
     behind; the 1-hour mtime freshness check makes it self-expire. Operator
     can also delete it manually (the skill's failure-mode docs say so).

6. Build log committed alongside the report.
```

## YAML spec format

Defined canonically in `prompts/build-spec-schema.md`. Validated by zod schema co-defined in `tools/meta-ads-write/src/spec-schema.ts` so the runtime validator and the docs share a source of truth (zod schema is the source; the markdown doc is generated or manually mirrored).

```yaml
version: 1
intent: "Split SAMPLE Video #1 into 3 separate single-video ads"
account_id: act_0000000000000000

creates:
  - kind: ad
    parent_adset_id: "120000000000000010"
    name: "SAMPLE - SALES - VIDEO #2"
    creative:
      kind: video
      video_file: "./assets/video2.mp4"
      thumbnail_file: "./assets/video2-thumb.jpg"
      headline: "Sample Comedian Live in Metro City"
      body: "{{copy_from: 120000000000000011}}"
      cta_type: "GET_TICKETS"
      link_url: "https://acmeevents.com/sample-event-2026"
    status: "PAUSED"

preflight:
  - parent_adset_must_exist: "120000000000000010"
  - parent_adset_must_be_active: true
  - assets_must_exist: true
```

**Rules:**

- `kind ∈ {campaign, ad_set, ad, creative, audience}`. Each kind has its own required/optional fields.
- `creates` is processed in document order.
- `status` defaults to `PAUSED`.
- `{{copy_from: <ad_id>}}` is the only interpolation; copies headline/body/CTA from an existing ad. Resolved at dry-run.
- File paths are relative to the spec file directory.

## The sibling MCP server (`tools/meta-ads-write`)

### Tool surface

| Tool | Purpose | Graph API call |
|---|---|---|
| `create_ad` | Creates an ad linking creative + ad set | `POST /act_<id>/ads` |
| `update_ad` | Swap creative on an existing ad | `POST /<ad_id>` |
| `pause_ad` | Set ad status PAUSED | `POST /<ad_id>` |
| `resume_ad` | Set ad status ACTIVE | `POST /<ad_id>` |
| `pause_adset` | Set ad set status PAUSED | `POST /<adset_id>` |
| `resume_adset` | Set ad set status ACTIVE | `POST /<adset_id>` |
| `update_adset` | Budget / schedule edits | `POST /<adset_id>` |
| `upload_video` | Upload video bytes, return `video_id` | `POST /act_<id>/advideos` (multipart) |
| `upload_image` | Upload image bytes, return `image_hash` | `POST /act_<id>/adimages` (multipart) |
| `delete_ad` | Hard-delete an ad | `DELETE /<ad_id>` |

Each tool is a single file under `src/tools/`, ~30–60 LOC, exporting `{name, description, inputSchema (zod), handler}`.

### Internals

- **Graph API client** (`src/meta-api.ts`) — thin `fetch` wrapper. Injects access token, handles multipart bodies for uploads, returns `{ok: true, data} | {ok: false, error: {message, code, type, fbtrace_id, retryable}}`. Token is never logged.
- **Auth** — reads `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID` from env at startup. Validates on first call via `GET /me`. Boot fails loud if invalid.
- **Rate limiting** — serial dispatch (no parallel writes). On error code 17 (User request limit) or 4 (App rate limit): retry once after 60s. Beyond that: surface error and stop.
- **Logging** — one `stderr` line per tool call: `{tool, args_redacted, status, duration_ms, fbtrace_id}`.
- **No idempotency, no rollback** — documented in `references/build-safety.md`.

### Build / dev workflow

- TypeScript, compiled via `tsc` to `dist/`. Triggered by `npm run build`.
- `.mcp.json` references the built `dist/index.js`. The README's setup section is updated to include `cd tools/meta-ads-write && npm install && npm run build` as a one-time setup step.
- Dependencies pinned: `@modelcontextprotocol/sdk` (matches the version range used by upstream meta-ads-mcp), `zod`, `node-fetch` (Node ≥18 has fetch global, but pinning for predictability).
- Vitest for tests; Prettier + ESLint with the standard TypeScript preset.

This is the first Node/TS runtime in the project. The architecture doc currently states there is no service runtime to deploy. That statement gets a footnote: the new MCP runs in-process under Claude Code (no separate service; stdio child-process launched per session), so the deployment story doesn't change — just the build step.

## Safety / defense-in-depth updates

### `.claude/settings.json`

Move from `deny` to `allow`:

- `mcp__meta-ads__create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`
- `mcp__meta-ads__create_ad_set`, `create_ad_creative`
- `mcp__meta-ads__create_custom_audience`, `create_lookalike_audience`

Add to `allow` (new MCP):

- `mcp__meta-ads-write__*` (the 10 tools above)

Add `PreToolUse` hook block:

```jsonc
"hooks": {
  "PreToolUse": [
    {
      "matcher": "mcp__meta-ads__(create|update|pause|resume)_.*|mcp__meta-ads-write__.*",
      "command": "find .build-ads-active -mmin -60 2>/dev/null | grep -q . || { echo 'Write tool blocked: /build-ads not active. Run /build-ads to authorize writes.' >&2; exit 1; }"
    }
  ]
}
```

The `/build-ads` skill creates `.build-ads-active` at start (`Bash(touch .build-ads-active)`) and deletes it at end (`Bash(rm -f .build-ads-active)`). Read skills never create the marker; their write-tool calls fail at the hook layer with a clear message. The 1-hour mtime check (via `find -mmin -60`) means a stale marker from a crashed skill self-expires within an hour, limiting blast radius.

`.gitignore` adds `.build-ads-active` so the marker is never committed.

**Why marker file, not env var:** Claude Code Bash tool calls run in fresh subshells, so `export FOO=1` in one call doesn't reach the next call or the hook subprocess. The marker file approach uses the filesystem as the persistence layer, which all subprocesses can read.

### `prompts/recommendation-rubric.md`

Anti-rule #3 rewrites:

> _"Report skills are suggest-only. Mutations only happen through `/build-ads`. Report skills must not call any `mcp__meta-ads__create_*`/`update_*`/`pause_*`/`resume_*` tool, nor any `mcp__meta-ads-write__*` tool."_

New anti-rule #5:

> _"Report skills must not include 'use /build-ads to do X' as a recommendation. Keep the read and write surfaces independent so the operator decides when to mutate."_

### Each existing read `SKILL.md`

`/weekly-report`, `/monthly-report`, `/show-report`, `/pacing-check` — the "What this skill must NOT do" section gets a verbatim list of forbidden tools instead of patterns. Belt-and-suspenders.

### `docs/architecture.md`

"Suggest-only enforcement (defense in depth)" section rewritten to describe:
- Read skills' three-layer protection (settings.json `allow` excludes writes for them via the hook, skill instructions, rubric).
- `/build-ads`'s three-layer protection (operator-typed slash command, mandatory spec review, mandatory dry-run confirmation).

### `README.md`

- New "Building ads with /build-ads" section: purpose, workflow summary, link to `references/build-safety.md`.
- The "Won't" bullet rewrites: read skills won't mutate; `/build-ads` will, only after operator review.
- Setup section gains the `tools/meta-ads-write` build step.

## Testing strategy

`tools/meta-ads-write/` ships with:

1. **Unit tests** for each tool handler (Vitest, mocked `fetch`). Target ~80% line coverage on the new code.
2. **Smoke script** at `scripts/smoke.ts`: spins the server, sends `tools/list`, asserts all 10 tools register with valid schemas.
3. **Hook-config sanity test** (`safety-gates.test.ts`): parses `.claude/settings.json`, asserts the `PreToolUse` matcher covers the right tool prefixes and the command checks the right env var.
4. **Read-skill regression test** (same file): greps every read `SKILL.md` for `mcp__meta-ads__create_`/`mcp__meta-ads-write__` references, fails if found.
5. **Spec-schema sample test**: round-trips `prompts/build-spec-schema.md`'s example specs through YAML parser + zod schema. Catches docs/schema drift.

`npm test` from `tools/meta-ads-write/` runs all of the above.

Live integration tests are explicitly out of scope for v1 — they'd mutate a real ad account. Initial validation is operator-driven: run `/build-ads` against the real Metro City Sample account with a small spec (e.g. one paused ad), verify in Ads Manager, then expand.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Operator approves a spec with the wrong ad set ID | Dry-run validates parent IDs before any mutation; surfaces in the preview |
| Spec half-runs on rate-limit / network error | Build log records what got created with IDs; operator edits spec to remove completed items and re-runs |
| Hook marker-file defense bypassed (e.g., user manually `touch .build-ads-active`) | Two more layers remain: skill instructions enumerate forbidden tools; rubric anti-rule reinforces. The marker only authorizes writes; it does not call them — every write call still has to come from a skill that lists the tool in its allowed set. |
| Stale marker file from crashed skill leaves writes authorized | Hook checks marker mtime is within 1 hour; stale markers self-expire. Skill failure-mode docs instruct operators to `rm .build-ads-active` if they kill the skill |
| Token expires mid-run | Same `get_token_info` check at `/build-ads` entry as in read skills; warn at <7 days |
| New-ad status defaults to `ACTIVE` by mistake | Default is `PAUSED`; the dry-run preview surfaces `New live ads: 0` prominently; operator must edit spec to launch live |
| Two MCP servers confuse the model about which tool to use | Tool prefixes are namespaced (`mcp__meta-ads__` vs `mcp__meta-ads-write__`); the build-ads SKILL.md enumerates which tool comes from where |
| Upstream `meta-ads-mcp` adds a `create_ad` tool later that conflicts with ours | Documented in `tools/meta-ads-write/README.md`; if upstream gets it, we delete our `create_ad` and update the SKILL.md to use the upstream one |
| Build step (TS compile) becomes a friction point | Single `npm run build` step, documented in README; CI not required because the project is operator-run, not deployed |

## Out of scope (intentional)

- **Idempotency / rollback** — re-runs create duplicates; documented loud and clear.
- **Live integration tests** — operator validates manually on first runs.
- **Audience build flows beyond create_custom_audience** — file uploads, hashing, CSV imports are deferred to v2 if the operator needs them.
- **Carousel ad creation** — the spec schema models single-image / single-video creatives only in v1. Carousels are deferred.
- **Bulk-edit existing ads** — `update_ad` in v1 is single-ad-only. No batch updates.
- **Cross-account moves** — every spec is scoped to one `account_id`.

## Reference docs (existing, this spec extends)

- `docs/architecture.md` — gets the "Suggest-only enforcement" rewrite.
- `prompts/recommendation-rubric.md` — gets anti-rule #3 rewrite + new #5.
- `prompts/report-structure.md` — unchanged (build reports use a different template, defined by the new skill).
- `references/learning-phase.md`, `references/breakdown-effect.md`, `references/auction-basics.md` — unchanged. The read skills still cite these; the new skill does not need to.

## Implementation entry point

The next step after this spec is approved is to invoke `superpowers:writing-plans` to break this into a task-by-task implementation plan, in the same shape as `docs/superpowers/plans/2026-05-07-meta-ad-automation.md`.
