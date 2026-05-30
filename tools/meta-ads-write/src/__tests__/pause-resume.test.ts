import { describe, it, expect, vi } from "vitest";
import {
  pauseAdTool,
  resumeAdTool,
  pauseAdsetTool,
  resumeAdsetTool,
} from "../tools/pause-resume.js";
import { MetaApi } from "../meta-api.js";

function api(mockFetch: ReturnType<typeof vi.fn>) {
  return new MetaApi({
    accessToken: "tok",
    accountId: "act_999",
    fetchImpl: mockFetch as unknown as typeof fetch,
  });
}

describe("pause/resume tools", () => {
  it("pause_ad posts status=PAUSED to the ad", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const result = await pauseAdTool.handler({ ad_id: "ad_42" }, api(mockFetch));
    expect(result.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/ad_42\?/);
    expect((init as RequestInit & { body: URLSearchParams }).body.get("status")).toBe("PAUSED");
  });

  it("resume_ad posts status=ACTIVE to the ad", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    await resumeAdTool.handler({ ad_id: "ad_42" }, api(mockFetch));
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit & { body: URLSearchParams }).body.get("status")).toBe("ACTIVE");
  });

  it("pause_adset posts status=PAUSED to the ad set", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    await pauseAdsetTool.handler({ adset_id: "adset_99" }, api(mockFetch));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/adset_99\?/);
    expect((init as RequestInit & { body: URLSearchParams }).body.get("status")).toBe("PAUSED");
  });

  it("resume_adset posts status=ACTIVE to the ad set", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    await resumeAdsetTool.handler({ adset_id: "adset_99" }, api(mockFetch));
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit & { body: URLSearchParams }).body.get("status")).toBe("ACTIVE");
  });
});
