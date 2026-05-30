import { describe, it, expect, vi } from "vitest";
import { updateAdTool } from "../tools/update-ad.js";
import { MetaApi } from "../meta-api.js";

describe("update_ad tool", () => {
  it("posts to /<ad_id> with the supplied fields", async () => {
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

    const result = await updateAdTool.handler(
      updateAdTool.inputSchema.parse({
        ad_id: "ad_555",
        name: "Renamed",
        creative_id: "new_creative",
      }),
      api,
    );

    expect(result.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/ad_555\?/);
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("name")).toBe("Renamed");
    expect(body.get("creative")).toBe(JSON.stringify({ creative_id: "new_creative" }));
  });

  it("requires at least one updatable field beyond ad_id", () => {
    const parsed = updateAdTool.inputSchema.safeParse({ ad_id: "ad_555" });
    expect(parsed.success).toBe(false);
  });
});
