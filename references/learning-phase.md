# Learning Phase

A new ad set (or one with significant edits) enters Learning Phase, during which Meta is still calibrating the auction model for that ad set. Performance during Learning is noisy and not predictive of post-Learning steady state.

## Exit criteria

An ad set typically exits Learning after ~50 optimization events within ~7 days. Below that volume, day-to-day metrics swing wildly. The MCP returns the ad set's learning status in its insights/diagnostics output (look for `learning_stage`, `delivery_status`, or similar fields).

## Implication for recommendations

- **Do not recommend pausing or budget-cutting an ad set in Learning** based on its Learning-phase metrics alone. The metrics aren't yet meaningful.
- **Do flag** when an ad set has been in Learning >7 days and isn't accumulating events — that's a signal of insufficient budget or audience for the optimization goal.
- **Do warn** when the operator's prior actions caused multiple ad sets to re-enter Learning simultaneously (e.g., from edits to budget, optimization goal, audience, or creative) — this can suppress overall account performance for a week.

## When to cite this

Cite this doc whenever a recommendation involves pausing, budget-cutting, or otherwise interfering with an ad set whose Learning status hasn't been confirmed. Also cite when explaining why a recently-edited campaign's apparent regression should be ignored for now.
