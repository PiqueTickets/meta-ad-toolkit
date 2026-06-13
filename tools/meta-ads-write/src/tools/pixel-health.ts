import { z } from "zod";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

// Read-only pixel health summary: metadata + per-event-type counts over a
// recent window. Use to confirm a pixel is actually firing the events a
// campaign optimizes against (e.g. Purchase) before spending on it.

const PIXEL_FIELDS = [
  "id",
  "name",
  "last_fired_time",
  "is_unavailable",
  "enable_automatic_matching",
  "data_use_setting",
  "creation_time",
];

export const pixelHealthInputSchema = z
  .object({
    pixel_id: z.string().min(1),
    days: z.number().int().positive().max(90).default(7),
  })
  .strict();

export type PixelHealthInput = z.infer<typeof pixelHealthInputSchema>;

interface StatsBucket {
  start_time?: string;
  aggregation?: string;
  data?: { value: string; count: number }[];
}

export interface PixelHealth {
  pixel: Record<string, unknown>;
  window_days: number;
  event_totals: Record<string, number>;
  total_events: number;
  buckets: number;
  fires_purchase: boolean;
}

export const pixelHealthTool = {
  name: "pixel_health",
  description:
    "Summarize a Meta Pixel's health: metadata (last fired, availability, automatic " +
    "matching) plus per-event-type counts over the last N days (default 7). Read-only. " +
    "Use to confirm a pixel is firing Purchase / ViewContent before optimizing a " +
    "campaign against it.",
  inputSchema: pixelHealthInputSchema,

  async handler(input: PixelHealthInput, api: MetaApi): Promise<MetaApiResult<PixelHealth>> {
    const meta = await api.get<Record<string, unknown>>(`/${input.pixel_id}`, PIXEL_FIELDS);
    if (!meta.ok) return meta;

    const startTime = nowSeconds() - input.days * 86400;
    const stats = await api.get<{ data?: StatsBucket[] }>(
      `/${input.pixel_id}/stats?aggregation=event&start_time=${startTime}`,
    );
    if (!stats.ok) return stats;

    const buckets = stats.data.data ?? [];
    const eventTotals: Record<string, number> = {};
    for (const bucket of buckets) {
      for (const entry of bucket.data ?? []) {
        eventTotals[entry.value] = (eventTotals[entry.value] ?? 0) + entry.count;
      }
    }
    const totalEvents = Object.values(eventTotals).reduce((sum, n) => sum + n, 0);

    return {
      ok: true,
      data: {
        pixel: meta.data,
        window_days: input.days,
        event_totals: eventTotals,
        total_events: totalEvents,
        buckets: buckets.length,
        fires_purchase: (eventTotals.Purchase ?? 0) > 0,
      },
    };
  },
};

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
