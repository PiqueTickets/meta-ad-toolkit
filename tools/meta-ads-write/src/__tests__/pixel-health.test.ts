import { describe, it, expect, vi } from "vitest";
import { pixelHealthTool } from "../tools/pixel-health.js";
import { MetaApi } from "../meta-api.js";

function makeApi(mockFetch: ReturnType<typeof vi.fn>): MetaApi {
  return new MetaApi({
    accessToken: "tok",
    accountId: "act_999",
    fetchImpl: mockFetch as unknown as typeof fetch,
  });
}

describe("pixel_health tool", () => {
  it("fetches pixel meta + stats and aggregates event totals across buckets", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: "px_1",
          name: "PiqueTickets",
          last_fired_time: "2026-06-12T23:57:23+0000",
          is_unavailable: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              start_time: "2026-06-12T13:00:00+0000",
              aggregation: "event",
              data: [
                { value: "PageView", count: 10 },
                { value: "Purchase", count: 2 },
              ],
            },
            {
              start_time: "2026-06-12T14:00:00+0000",
              aggregation: "event",
              data: [{ value: "PageView", count: 5 }],
            },
          ],
        }),
      });

    const res = await pixelHealthTool.handler({ pixel_id: "px_1", days: 7 }, makeApi(mockFetch));

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.event_totals).toEqual({ PageView: 15, Purchase: 2 });
      expect(res.data.total_events).toBe(17);
      expect(res.data.fires_purchase).toBe(true);
      expect(res.data.buckets).toBe(2);
      expect((res.data.pixel as { name: string }).name).toBe("PiqueTickets");
    }

    // first call hits the pixel object, second hits the /stats edge
    expect(mockFetch.mock.calls[0][0]).toContain("/px_1?");
    expect(mockFetch.mock.calls[1][0]).toContain("/px_1/stats");
    expect(mockFetch.mock.calls[1][0]).toContain("aggregation=event");
    expect(mockFetch.mock.calls[1][0]).toMatch(/start_time=\d+/);
  });

  it("reports fires_purchase=false when no Purchase events fired", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "px_1", name: "PiqueTickets" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { aggregation: "event", data: [{ value: "PageView", count: 48 }] },
          ],
        }),
      });

    const res = await pixelHealthTool.handler({ pixel_id: "px_1", days: 7 }, makeApi(mockFetch));

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.fires_purchase).toBe(false);
      expect(res.data.event_totals).toEqual({ PageView: 48 });
    }
  });

  it("returns the error and skips the stats call when the pixel fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "bad pixel", code: 100, type: "OAuthException" } }),
    });

    const res = await pixelHealthTool.handler({ pixel_id: "nope", days: 7 }, makeApi(mockFetch));

    expect(res.ok).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
