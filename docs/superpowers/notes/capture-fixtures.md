# Capturing MCP fixtures (Task 4)

These steps require a live `meta-ads` MCP — they cannot run in a session that started before `.env` was populated and `.mcp.json` was registered.

## One-time prerequisites

1. Mint a long-lived Meta user access token with `ads_read`:
   - Open [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
   - Select your app → "Get Token" → "Get User Access Token" → check `ads_read` → "Generate Access Token".
   - Exchange for a long-lived token via the [token-extension flow](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived). Long-lived user tokens last ~60 days.
2. Create `.env` in the repo root (gitignored — do not commit):
   ```
   META_ACCESS_TOKEN=<your long-lived token>
   META_AD_ACCOUNT_ID=act_<numeric>
   ```
3. Quit and reopen Claude Code in this directory. `.mcp.json` is only read on session start — the `mcp__meta-ads__*` tools won't exist until you restart.

## In the fresh session, paste this prompt

> Capture MCP fixtures per Task 4 of the plan. For each call, write the raw response to the path shown:
>
> - `mcp__meta-ads__get_ad_accounts` → `fixtures/get_ad_accounts.json`
> - `mcp__meta-ads__get_token_info` → `fixtures/get_token_info.json`
> - `mcp__meta-ads__get_campaigns` for the configured ad account → `fixtures/get_campaigns.json`
> - `mcp__meta-ads__get_insights` for the last 7 days, breakdown by campaign and by day → `fixtures/get_insights_weekly.json`
>
> After saving all four, run `git status --short` to confirm none are tracked (they're gitignored).

## What to verify after capture

- `fixtures/get_ad_accounts.json` lists an entry whose ID matches `${META_AD_ACCOUNT_ID}`.
- `fixtures/get_campaigns.json` contains at least one active campaign. (If zero active campaigns, the dry-run for `/weekly-report` won't be very useful — note this and proceed.)
- `fixtures/get_insights_weekly.json` contains daily rows per campaign with `spend`, `purchase_value`, `actions`, `cpm`, `ctr`, `frequency`, `reach`. If the MCP's `get_insights` parameters differ from `time_range` + `level` + `breakdowns`, adapt — the goal is one captured fixture covering a real 7-day window.
- `git status --short` shows no `fixtures/*.json` files (only `fixtures/.gitkeep` if it ever shows). If a fixture file appears as untracked-and-stageable, fix `.gitignore` before continuing.

## Why these four

| Fixture | Used by which skill(s) | Purpose |
|---|---|---|
| `get_ad_accounts.json` | all | Verifies the configured account is visible. |
| `get_token_info.json` | all (sanity-check step) | Surfaces token expiry. Tested in dry-runs of every skill. |
| `get_campaigns.json` | weekly, monthly, show | Source of campaign list, names, statuses. |
| `get_insights_weekly.json` | weekly (primary), monthly + show + pacing (approximate dry-run only) | The only delivery-data fixture; covers a 7-day window. |

If you later need a longer window for monthly dry-runs, capture an additional fixture (e.g. `fixtures/get_insights_monthly.json`) and adapt the dry-run prompt for `/monthly-report` accordingly.
