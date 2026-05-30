import { describe, it, expect, vi } from "vitest";
import { deleteAdTool } from "../tools/delete-ad.js";
import { MetaApi } from "../meta-api.js";

describe("delete_ad tool", () => {
  it("issues DELETE on /<ad_id>", async () => {
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

    const res = await deleteAdTool.handler({ ad_id: "ad_42", confirm: true }, api);
    expect(res.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/ad_42\?/);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("refuses to call fetch when confirm is not true", async () => {
    const mockFetch = vi.fn();
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const res = await deleteAdTool.handler(
      { ad_id: "ad_42", confirm: false as unknown as true },
      api,
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.type).toBe("ConfirmationRequired");
      expect(res.error.retryable).toBe(false);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
