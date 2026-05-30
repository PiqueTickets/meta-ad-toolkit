# meta-ads-write

Write-side MCP server for the `meta-ad-toolkit` project. Exposes 11 Meta Marketing API write tools that the upstream `meta-ads-mcp` package does not provide. Used exclusively by the `/build-ads` Claude Code skill, gated by a `PreToolUse` hook on a `.build-ads-active` marker file.

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

create_ad, create_ad_creative, update_ad, pause_ad, resume_ad, pause_adset, resume_adset, update_adset, upload_video, upload_image, delete_ad.

See `../../docs/superpowers/specs/2026-05-08-meta-ad-write-tools-design.md` for design rationale.
