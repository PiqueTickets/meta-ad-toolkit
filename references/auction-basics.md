# Meta auction basics

Meta serves the ad with the highest **total value** per impression, not the highest bid. Total value combines:

1. **Advertiser bid** — what the advertiser is willing to pay (or what the optimization goal implies)
2. **Estimated action rate** — Meta's prediction that this user will take the optimized action
3. **Ad quality** — engagement signals, post-click experience, user feedback (negative ratings, hide-ad rates)

Two ads with the same bid can have very different effective costs because (2) and (3) compound.

## Implication for recommendations

- **Cheap CPMs aren't always good.** A creative with high estimated action rate wins auctions cheaply *because Meta expects it to convert*. A cheap CPM with a low conversion rate signals weak quality, not a bargain.
- **Improving creative is the most leveraged action.** Bid changes affect (1); creative changes affect (2) and (3) together.
- **Frequency matters because of (3).** As frequency rises, ad fatigue lowers estimated action rate and quality, raising effective cost.

## When to cite this

Cite this doc when explaining why a creative refresh is the recommended action over a budget tweak, or when explaining why high frequency is a HIGH-tier concern.
