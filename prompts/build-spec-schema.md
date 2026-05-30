# /build-ads spec format

Canonical YAML schema for build specs consumed by `/build-ads`. The runtime validator is `tools/meta-ads-write/src/spec-schema.ts` (zod). This doc mirrors the schema in human-readable form; the zod schema is the source of truth.

## Top-level shape

```yaml
version: 1                              # required, must be 1
intent: "Short human description"       # required
account_id: act_<numeric>               # required, must match env META_AD_ACCOUNT_ID
page_id: "100000000000001"              # optional; default Facebook Page ID for new creatives
instagram_user_id: "17000000000000001"  # optional; default Instagram identity for new creatives
creates: [...]                          # required; ordered list of creates
preflight: [...]                        # optional; dry-run-time assertions
```

`page_id` is required at the API level for any creative that posts to a Page (i.e. all video and link creatives). Set it once at the top level rather than repeating per creative.

## Create kinds

Every entry in `creates` has a `kind` discriminator. The five supported kinds:

### kind: campaign

```yaml
- kind: campaign
  name: "SALES - <show> - <venue> - <YYYY-MM-DD>"
  objective: OUTCOME_SALES                # required
  status: PAUSED                          # default PAUSED
```

### kind: ad_set

```yaml
- kind: ad_set
  parent_campaign_id: "<campaign_id>"     # required
  name: "<adset name>"
  daily_budget_cents: 5000                # one of daily/lifetime required
  lifetime_budget_cents: 20000
  start_time: "2026-05-06T07:00:00+0000"
  end_time:   "2026-05-23T00:00:00+0000"
  optimization_goal: OFFSITE_CONVERSIONS
  status: PAUSED                          # default PAUSED
```

### kind: ad

```yaml
- kind: ad
  parent_adset_id: "<adset_id>"           # required
  name: "<ad name>"
  creative:                               # required, see below
    kind: video                           # video | image
    ...
  status: PAUSED                          # default PAUSED
```

### kind: creative (standalone, when reused across ads)

```yaml
- kind: creative
  name: "<creative name>"
  creative: { ... }
```

### kind: audience

```yaml
- kind: audience
  name: "<audience name>"
  audience_type: custom                   # custom | lookalike
```

## Creative shapes

### Video creative

A video creative must set **exactly one** of `video_file` (upload from local path) or `video_id` (reference an existing Meta video already on the account — useful for splitting a carousel ad without re-uploading). Discover existing video IDs with `npm run inspect-creative <creative_id>` from `tools/meta-ads-write/`.

```yaml
creative:
  kind: video
  video_file: "./assets/foo.mp4"          # path relative to spec file (XOR with video_id)
  # video_id: "1234567890"                # already-uploaded Meta video (XOR with video_file)
  thumbnail_file: "./assets/foo-thumb.jpg" # optional, only valid with video_file
  headline: "<headline text>"             # maps to video_data.title
  body: "<body text or {{copy_from: <ad_id>}}>" # maps to video_data.message
  link_description: "Doors 7 PM | $25"    # optional; maps to video_data.link_description
  cta_type: GET_TICKETS                   # one of: GET_TICKETS, LEARN_MORE, SHOP_NOW, SIGN_UP, BOOK_TRAVEL, DOWNLOAD
  link_url: "https://acmeevents.com/..."
```

### Image creative

```yaml
creative:
  kind: image
  image_file: "./assets/foo.jpg"
  headline: "<headline text>"
  body: "<body text>"
  cta_type: LEARN_MORE
  link_url: "https://example.com"
```

## Interpolation: `{{copy_from: <ad_id>}}`

Within `creative.body`, `creative.headline`, or `creative.cta_type`, the operator may write `{{copy_from: <ad_id>}}` to copy the corresponding field from an existing ad. Resolved by `/build-ads` at dry-run time via a read-only API call. No other interpolations are supported in v1.

## Preflight

The `preflight` array contains assertions the dry-run preview enforces before any mutation. Supported entries:

- `parent_adset_must_exist: <adset_id>` — the dry-run will resolve this ID; missing → halt.
- `parent_adset_must_be_active: true` — the resolved ad set's `effective_status` must be ACTIVE.
- `assets_must_exist: true` — every `video_file` / `image_file` / `thumbnail_file` must be readable on the local filesystem.

## Status defaults

All `status` fields default to `PAUSED`. The dry-run preview will surface "New live ads: N" prominently if any create has `status: ACTIVE`.

## Example: split a video carousel into 3 ads

```yaml
version: 1
intent: "Split SAMPLE Video #1 into 3 separate single-video ads"
account_id: act_0000000000000000
page_id: "100000000000001"
instagram_user_id: "17000000000000001"

creates:
  - kind: ad
    parent_adset_id: "120000000000000010"
    name: "SAMPLE - SALES - VIDEO #2"
    creative:
      kind: video
      video_file: "./assets/video2.mp4"
      headline: "Sample Comedian Live in Metro City"
      body: "{{copy_from: 120000000000000011}}"
      cta_type: GET_TICKETS
      link_url: "https://acmeevents.com/sample-event-2026"
    status: PAUSED

  - kind: ad
    parent_adset_id: "120000000000000010"
    name: "SAMPLE - SALES - VIDEO #3"
    creative:
      kind: video
      video_file: "./assets/video3.mp4"
      headline: "Sample Comedian Live in Metro City"
      body: "{{copy_from: 120000000000000011}}"
      cta_type: GET_TICKETS
      link_url: "https://acmeevents.com/sample-event-2026"
    status: PAUSED

  - kind: ad
    parent_adset_id: "120000000000000010"
    name: "SAMPLE - SALES - VIDEO #4"
    creative:
      kind: video
      video_file: "./assets/video4.mp4"
      headline: "Sample Comedian Live in Metro City"
      body: "{{copy_from: 120000000000000011}}"
      cta_type: GET_TICKETS
      link_url: "https://acmeevents.com/sample-event-2026"
    status: PAUSED

preflight:
  - parent_adset_must_exist: "120000000000000010"
  - parent_adset_must_be_active: true
  - assets_must_exist: true
```
