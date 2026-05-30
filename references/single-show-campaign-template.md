# Single-show campaign template

A reusable skeleton for promoting one comedy show, derived from the highest-ROAS campaign in the account: **SAMPLE COMEDIAN - METRO CITY - 2026-03-07** (4.13× ROAS on $361 spend, 35 purchases, $42.58 AOV).

Operators (or the `/build-ads` skill) should copy this skeleton verbatim per show, swapping only the per-show variables marked `<<…>>`. Anything not marked is a fixed setting that the source campaign won out with — don't change it without an explicit hypothesis.

**Companion YAML:** `specs/templates/single-show.yml` — parameterized build spec for the 5 video ads. Copy to `specs/builds/<date>-<slug>.yml`, replace the `<<…>>` tokens, and run via `/build-ads`. (Campaign + ad set + dynamic poster creative still need manual setup — see the YAML header for the upstream Ads Manager checklist.)

## When to use

- A single ticketed event with a fixed date and venue
- Local market (one metro), with at least one nearby competing metro to exclude
- The artist has organic clip content on Instagram or TikTok we can re-cut as ad reels
- Lead time ≥ 7 days

For festivals, multi-date residencies, or pre-sale waitlists, this template is wrong — start from a different baseline.

## Campaign

| Field | Value |
|---|---|
| Objective | `OUTCOME_SALES` |
| Buying type | `AUCTION` |
| Special ad categories | `[]` |
| Budget level | Ad-set (ABO). **No** campaign-level budget. |
| Name | `<<show name>> | <<venue>> | <<YYYY-MM-DD>>` |
| Start | T−10 days from show |
| Stop | Day after show (catches late conversions) |

## Ad sets

Run **one** ad set unless you have a fresh creative angle for an urgency push. The "URGENCY-72H" set in the source campaign spent $30 on 0 purchases — same audience, same creative as the main set. Replicating it without a new angle is waste.

### Main ad set (always)

| Field | Value |
|---|---|
| Name | `SALES - <<show name>> - <<venue>> - <<YYYY-MM-DD>>` |
| Lifetime budget | `<<budget>>` (source ran $330 over 10 days for a ~150-seat theater; scale linearly by capacity) |
| Schedule | T−10 → day after show |
| Optimization goal | `OFFSITE_CONVERSIONS` |
| Promoted object | pixel `1000000000000001`, `custom_event_type: PURCHASE` |
| Bid strategy | `LOWEST_COST_WITHOUT_CAP` |
| Billing event | `IMPRESSIONS` |
| Attribution | 7-day click + 1-day view + 1-day engaged-video-view |
| Destination type | `UNDEFINED` |

**Targeting:**

| Field | Value |
|---|---|
| Geo include | 25-mile radius around venue lat/lon (`location_types: ["home", "recent"]`) |
| Geo exclude | Adjacent metro within ~50mi: 19-mile radius around its downtown (`location_types: ["home", "recent"]`). Exclude any `<adjacent metro>` whose audience overlaps the `<event city>` radius; if the nearest large metro is far enough away that there's no overlap, no exclusion is needed. |
| Age | 21–55 (with `targeting_automation.advantage_audience: 1` so Meta may expand to 18–65) |
| Custom audiences | `120000000000000001` (Acme Events - Instagram Followers), `120000000000000002` (Acme Events - Facebook Likes & Follows), `120000000000000003` (Acme Events - Engagement - Instagram) |
| Detailed interests | **None.** The custom-audience seeds + Advantage Audience expansion outperformed interest targeting in every Acme Events campaign that's tried both. |

### Urgency ad set (only if you have a unique creative for it)

Skip by default. If you do run it: distinct creative (a 72-hour countdown video, a low-inventory frame, an artist-direct call-to-action), distinct audience exclusion (exclude purchasers from the main set), and a budget no smaller than $50 — anything below burns out before exiting learning.

## Ads

Run **6 ads** in the main set: 5 video reels + 1 dynamic-creative poster. The source campaign's 4 lowest-spending creatives drove $0; the algorithm needs variance to find the winner, then concentrates spend.

### Creative 1 — Dynamic poster (always include)

This was the workhorse of the source campaign: 22% of spend, 54% of revenue.

```yaml
object_type: SHARE
object_story_spec:
  page_id: "100000000000001"
  instagram_user_id: "17000000000000001"
asset_feed_spec:
  images:
    - hash: <<vertical_9x16_hash>>     # for Stories, Reels (placement_asset rule with positions: story, reels)
    - hash: <<square_or_4x5_hash>>     # default (Feed)
  bodies:
    - text: <<body copy — see template below>>
  call_to_action_types: [LEARN_MORE]
  link_urls:
    - website_url: <<your ticketing URL>>
  ad_formats: [AUTOMATIC_FORMAT]
  optimization_type: PLACEMENT
```

Two image hashes uploaded as separate assets, with `asset_customization_rules` tagging the vertical for `facebook_positions: [facebook_reels, story]` + `instagram_positions: [story, reels]`. Meta auto-serves the right aspect ratio per placement.

### Creatives 2–6 — Video reels (5 ads, one per source clip)

Cut from the artist's organic Instagram/TikTok content — actual standup clips, not produced ads. The two best performers in the source campaign were both crowd-clips repurposed verbatim from the comedian's IG.

```yaml
object_type: VIDEO
object_story_spec:
  page_id: "100000000000001"
  instagram_user_id: "17000000000000001"
  video_data:
    video_id: <<reused video_id from Media Library>>
    image_url: <<thumbnail URL — fetch via /<video_id>?fields=picture>>
    title: <<headline>>
    message: <<body copy — same template as poster>>
    link_description: <<single-line scarcity line, e.g. "Doors 7 PM | Show 8 PM\n21+ | Tickets $25">>
    call_to_action:
      type: LEARN_MORE
      value:
        link: <<your ticketing URL>>
```

Status `PAUSED` on creation; flip the campaign to `ACTIVE` only after spec review.

## Body copy template

This exact structure ran on every winning ad in the source campaign. Replace the bracketed text per show; keep the structure, the emoji bullets, and the CTA verbatim.

```
<<MARKET>> - <<MONTH ABBR DAY>>

<<Artist>>'s [one-sentence stylistic description — pull from a real publication if available, e.g. "conversational style had the audience in the palm of her hand according to The Oregonian"], and [one social-proof datapoint — a viral clip view count, a famous appearance, an awards mention].

[One-sentence credit list — comics they've opened for, decades of experience, festivals played].

📍 <<Venue>>

📅 <<Day, Mon DD at H:MM PM>>

🎟️ Tickets from $<<floor price>>

⏰ One night only

Tap the link to get your tickets now
```

Notes:

- The all-caps geo+date header at the top is doing real work — it's a placement-agnostic hook that survives feed crops.
- Two distinct social-proof beats are required (publication quote *and* a number/famous-name). One isn't enough.
- The four emoji bullets are the same four every time, in the same order. Don't reorder or substitute emoji.
- "One night only" is the scarcity line — keep it even on multi-night runs (each *show* is one night for that audience).
- "Tap the link" is a placement-aware CTA (works on mobile feed and reels). Don't change to "click."

## Per-show fill-in checklist

Before launching, confirm every value below is filled:

- [ ] `<<show name>>`, `<<venue>>`, `<<YYYY-MM-DD>>` — campaign + ad-set names
- [ ] `<<budget>>` — total lifetime, scaled to venue capacity
- [ ] Venue lat/lon — copy from Google Maps, paste into `geo_locations.custom_locations`
- [ ] Excluded metro lat/lon — only if a major metro is within ~50mi
- [ ] `<<your ticketing URL>>` — the ticketing landing page
- [ ] `<<floor price>>` — cheapest ticket tier
- [ ] `<<vertical_9x16_hash>>` + `<<square_or_4x5_hash>>` — uploaded poster images
- [ ] 5 video IDs — cut from artist's IG/TikTok, uploaded via `mcp__meta-ads-write__upload_video` or reused from Media Library
- [ ] Body copy — slot artist-specific lines into the template

## What this template is *not*

- Not a CBO playbook. The source campaign used ABO (ad-set-level budgets) and that's intentional — it lets you fund the urgency push (when warranted) on a separate timeline.
- Not optimized for cold prospecting at scale. The first-party custom audiences are the seed. For shows where the artist has zero local awareness, supplement with a separate prospecting campaign (different template, not this one).
- Not for shows priced under $15. AOV math doesn't carry the CPA. Talk to the operator about whether to run paid at all.
