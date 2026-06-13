# meta-ads-write

Write-side MCP server for the `meta-ad-toolkit` project. Exposes 14 Meta Marketing API tools that the upstream `meta-ads-mcp` package does not provide: 11 mutating write tools plus 3 read-only identity/pixel lookups. The write tools are used exclusively by the `/build-ads` Claude Code skill and are gated by a `PreToolUse` hook on a `.build-ads-active` marker file. The read-only lookups (`list_pages`, `list_pixels`, `pixel_health`) are *not* gated — they can be called any time to resolve `page_id` / `instagram_user_id` / `pixel_id` and to check pixel health before building a campaign.

## Build

```bash
npm install
npm run build
```

## Test

```bash
npm test
```

## Tools provided

**Write (gated by the `.build-ads-active` marker):** create_ad, create_ad_creative, update_ad, pause_ad, resume_ad, pause_adset, resume_adset, update_adset, upload_video, upload_image, delete_ad.

**Read-only (ungated):** list_pages (Facebook Pages the token manages + linked Instagram account → resolves `page_id` / `instagram_user_id`), list_pixels (Meta Pixels on the account → resolves `pixel_id`), pixel_health (per-event-type counts over the last N days; confirms a pixel is firing Purchase / ViewContent before optimizing against it).

See `../../docs/superpowers/specs/2026-05-08-meta-ad-write-tools-design.md` for design rationale.
