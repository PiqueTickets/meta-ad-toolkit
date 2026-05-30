import { describe, it, expect, vi } from "vitest";
import { updateAdsetTool } from "../tools/update-adset.js";
import { MetaApi } from "../meta-api.js";

describe("update_adset tool", () => {
  it("posts the supplied fields to /<adset_id>", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const result = await updateAdsetTool.handler(
      updateAdsetTool.inputSchema.parse({
        adset_id: "adset_99",
        daily_budget_cents: 5000,
        end_time: "2026-05-23T00:00:00+0000",
      }),
      api,
    );

    expect(result.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/adset_99\?/);
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("daily_budget")).toBe("5000");
    expect(body.get("end_time")).toBe("2026-05-23T00:00:00+0000");
  });

  it("rejects calls with no updatable fields", () => {
    const parsed = updateAdsetTool.inputSchema.safeParse({ adset_id: "x" });
    expect(parsed.success).toBe(false);
  });
});
