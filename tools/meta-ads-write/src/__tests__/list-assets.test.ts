import { describe, it, expect, vi } from "vitest";
import { listPagesTool, listPixelsTool } from "../tools/list-assets.js";
import { MetaApi } from "../meta-api.js";

function makeApi(mockFetch: ReturnType<typeof vi.fn>): MetaApi {
  return new MetaApi({
    accessToken: "tok",
    accountId: "act_999",
    fetchImpl: mockFetch as unknown as typeof fetch,
  });
}

describe("list_pages tool", () => {
  it("GETs /me/accounts with page + linked IG fields", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: "page_1",
            name: "Old Pueblo Comedy Co.",
            instagram_business_account: { id: "ig_1", username: "oldpueblocomedy" },
          },
        ],
      }),
    });
    const res = await listPagesTool.handler({}, makeApi(mockFetch));

    expect(res.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).method).toBe("GET");
    expect(url).toContain("/me/accounts");
    // field expansion is percent-encoded by MetaApi.get
    expect(decodeURIComponent(url as string)).toContain("instagram_business_account{id,username}");
  });
});

describe("list_pixels tool", () => {
  it("GETs /<account>/adspixels with id + name fields", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "px_1", name: "PiqueTickets Pixel" }] }),
    });
    const res = await listPixelsTool.handler({}, makeApi(mockFetch));

    expect(res.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).method).toBe("GET");
    expect(url).toContain("/act_999/adspixels");
    expect(decodeURIComponent(url as string)).toContain("last_fired_time");
  });
});
