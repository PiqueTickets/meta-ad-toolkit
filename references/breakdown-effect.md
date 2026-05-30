# The Breakdown Effect

When you look at performance broken down by an attribute (placement, age, gender, region), the segment with the worst headline metric (e.g. highest CPA) is often *not* the one to pause. This is the breakdown effect.

## Why it happens

Meta's auction allocates budget across segments to maximize the campaign's *total* outcome, not each segment's own efficiency. A "bad" segment may be:
- Cheap impressions that the algorithm uses to gather signal
- A segment that yields purchases the model attributes back to a "good" segment via downstream conversion paths
- A segment whose users were going to convert anyway via cheaper placements; pausing it shifts those conversions to higher-cost placements that compete more aggressively

## Implication for recommendations

- A breakdown showing one segment 3× the campaign average **is not** automatic justification to exclude that segment.
- Excluding the "worst" segment commonly *worsens* the campaign's overall CPA, because the model loses cheap signal-gathering placements.
- The strongest evidence for excluding a segment is a sustained pattern across many campaigns *and* a plausible product-side reason (e.g. an audience never converts because the offer doesn't match).

## When to cite this

Cite this doc when declining to recommend a segment exclusion that looks tempting on the surface, or when explaining why a "bad" placement should stay on.
