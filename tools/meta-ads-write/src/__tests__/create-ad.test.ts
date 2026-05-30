import { describe, it, expect, vi } from "vitest";
import { createAdTool } from "../tools/create-ad.js";
import { MetaApi } from "../meta-api.js";

function api(mockFetch: ReturnType<typeof vi.fn>) {
  return new MetaApi({
    accessToken: "tok",
    accountId: "act_999",
    fetchImpl: mockFetch as unknown as typeof fetch,
  });
}

describe("create_ad tool", () => {
  it("posts to /act_<id>/ads with the right fields and PAUSED default", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "ad_555" }),
    });

    const result = await createAdTool.handler(
      createAdTool.inputSchema.parse({
        adset_id: "adset_111",
        creative_id: "creative_222",
        name: "Test Ad",
      }),
      api(mockFetch),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ id: "ad_555" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/act_999\/ads\?/);
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("name")).toBe("Test Ad");
    expect(body.get("adset_id")).toBe("adset_111");
    expect(body.get("status")).toBe("PAUSED");
    expect(body.get("creative")).toBe(JSON.stringify({ creative_id: "creative_222" }));
  });

  it("respects an explicit ACTIVE status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "ad_777" }),
    });

    await createAdTool.handler(
      createAdTool.inputSchema.parse({
        adset_id: "adset_111",
        creative_id: "creative_222",
        name: "Live",
        status: "ACTIVE",
      }),
      api(mockFetch),
    );

    const [, init] = mockFetch.mock.calls[0];
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("status")).toBe("ACTIVE");
  });

  it("rejects an invalid status via zod schema", () => {
    const parsed = createAdTool.inputSchema.safeParse({
      adset_id: "x",
      creative_id: "y",
      name: "z",
      status: "DRAFT",
    });
    expect(parsed.success).toBe(false);
  });
});
