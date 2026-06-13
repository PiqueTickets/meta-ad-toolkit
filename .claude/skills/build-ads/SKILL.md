---
name: build-ads
description: Use when the operator runs `/build-ads`, asks to create or modify ads/ad sets/campaigns/creatives/audiences, or wants to split a creative carousel into separate ads. The only skill in this project that mutates the Meta ad account. Drafts a YAML spec, reviews it, dry-runs it, then executes.
---

# /build-ads

The mutation surface for meta-ad-toolkit. Drafts a YAML build spec from a conversational request, asks the operator to review, runs a read-only dry-run preview, and only then executes against the Meta Marketing API.

## Inputs

- Optional natural-language intent in chat (e.g., "split the Sample video carousel into 3 ads"). If absent, the skill asks.
- Optional path to an existing spec file (e.g., `/build-ads specs/builds/2026-05-08-video-split.yml`). If provided, the skill skips drafting and goes straight to dry-run.

## Procedure

Follow these steps in order. Stop and surface the issue if any step fails.

### 1. Sanity-check

- Call `mcp__meta-ads__health_check`. If unhealthy, stop.
- Call `mcp__meta-ads__get_token_info`. If the token expires within 7 days, prepend a warning.

### 2. Resolve input

- If the operator provided a spec path: read the file. Skip to step 4.
- Otherwise: ask the operator for intent if not yet provided. Resolve any campaign / ad-set / ad IDs they mention via `mcp__meta-ads__get_campaign`, `list_ad_sets`, `list_ads`. If `{{copy_from: <ad_id>}}` is implied, fetch that ad's body / headline / CTA via `list_ads` to confirm it exists (don't resolve the placeholder yet).
- If the spec will need a `page_id`, `instagram_user_id`, or `pixel_id` the operator hasn't supplied, resolve them with the read-only lookups: `mcp__meta-ads-write__list_pages` (Pages + linked Instagram account) and `mcp__meta-ads-write__list_pixels` (account pixels). These are ungated — safe to call before the marker exists. Optionally run `mcp__meta-ads-write__pixel_health` to confirm the pixel is firing `Purchase` before optimizing a conversion campaign against it.

### 3. Draft the spec

- Generate a YAML build spec following `prompts/build-spec-schema.md`.
- Write to `specs/builds/<today>-<slug>.yml` where `<slug>` is a kebab-cased summary of the intent.
- Echo the spec content to chat.
- Ask: "Review the spec at `<path>`. Reply 'execute' to proceed, 'edit' to make changes, or describe the changes."

### 4. Dry-run preview (read-only — no mutations)

- Validate the spec file against the zod schema in `tools/meta-ads-write/src/spec-schema.ts`. (Run via `node -e` or via the smoke command. If invalid, surface the zod error and stop.)
- For each `creates` entry that references a parent ID: call the appropriate `mcp__meta-ads__get_*` / `list_*` tool to confirm the parent exists.
- Resolve every `{{copy_from: <ad_id>}}` interpolation by reading the source ad. Echo the resolved values to chat.
- For every `video_file` / `image_file` / `thumbnail_file`: confirm the file is readable on the local filesystem. (Creatives that reference `video_id` instead of `video_file` skip this check — they reuse an already-uploaded Meta video.)
- Print a summary block:

```
Dry-run preview:
  Will upload N videos, M images.
  Will create K creatives, L ads.
  Will create P ad sets, Q campaigns, R audiences.
  New live ads (status: ACTIVE): X     # surface prominently if > 0
  Account: act_<id>
  Total estimated rate-limit cost: ~Y units
```

- Ask: "Execute this plan? (yes / no / edit-spec)"

### 5. Execute

If the operator says yes:

- Run `Bash(touch .build-ads-active)` to authorize writes.
- For each create in spec order:
  1. Call the corresponding MCP tool (`mcp__meta-ads__create_campaign` for `kind: campaign`, `mcp__meta-ads__create_ad_set` for `kind: ad_set`, **`mcp__meta-ads-write__create_ad_creative`** for creative, `mcp__meta-ads-write__create_ad` for `kind: ad`, etc.). Use `mcp__meta-ads-write__upload_video` / `upload_image` to upload local assets first, capturing the returned `video_id` / `image_hash` for use in the creative spec. **If a video creative sets `video_id` (instead of `video_file`), skip the upload step and pass the operator-supplied ID straight through to `create_ad_creative`.** Pass top-level `page_id` and (optional) `instagram_user_id` from the spec to `create_ad_creative` for parity with the source ad.
  2. Append the call's request and response (full IDs) to `reports/builds/<today>-<slug>.md`.
  3. On error: stop. Run `Bash(rm -f .build-ads-active)`. Tell the operator what was created so far and which item failed.
- On full success: run `Bash(rm -f .build-ads-active)`. Append a final "✅ All N items created" summary to the build log. Echo summary to chat with the new IDs.

### 6. Build log shape

The build log at `reports/builds/<today>-<slug>.md` follows this shape:

```markdown
# Build — <intent> — <YYYY-MM-DD HH:MM>

Spec: <path>

## Creates

### 1. <kind>: <name>
- Tool: `mcp__meta-ads-write__create_ad`
- Request: { ... }
- Response: { id: "<new_id>", ... }
- Duration: <ms>ms

### 2. ...

## Summary

- Total creates: N
- Successful: M
- Failed: K
- Total duration: <s>s
```

## Outputs

- `specs/builds/<today>-<slug>.yml` — the spec (committed)
- `reports/builds/<today>-<slug>.md` — the execution log (committed)

## Failure modes

- **Spec invalid (zod fails):** surface the error path; ask the operator to fix the spec or describe a different change.
- **Parent ID not found in dry-run:** halt before any mutation. Tell the operator the missing ID; suggest they check Ads Manager.
- **Local asset missing:** halt before any mutation. List the missing file paths.
- **Mid-execution Graph API error:** halt. Delete the marker. Report what was created. The operator edits the spec to remove completed entries and re-runs.
- **Operator killed the skill mid-run:** the marker is left behind. Self-expires in 1 hour, or operator runs `rm .build-ads-active` to clean up sooner. Ads Manager is the source of truth for partial state.
- **Token expires <7 days:** warn but proceed (the operator may want to refresh first).

## What this skill must NOT do

- Execute mutations without the marker file (the `PreToolUse` hook would block anyway, but the skill should never try).
- Skip the dry-run preview, even on a "small" spec.
- Auto-set `status: ACTIVE` on creates. Default is PAUSED; the operator must explicitly opt in via the spec.
- Roll back a partial run. v1 is operator-cleanup-only.
- Leave the `.build-ads-active` marker behind on a successful or failed run. (The "killed mid-run" case is the only way it persists.)
- Make recommendations. This skill *executes* what the operator approves; it does not suggest.
