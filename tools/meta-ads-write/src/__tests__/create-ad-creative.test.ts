import { describe, it, expect, vi } from "vitest";
import { createAdCreativeTool } from "../tools/create-ad-creative.js";
import { MetaApi } from "../meta-api.js";

function api(mockFetch: ReturnType<typeof vi.fn>) {
  return new MetaApi({
    accessToken: "tok",
    accountId: "act_999",
    fetchImpl: mockFetch as unknown as typeof fetch,
  });
}

describe("create_ad_creative tool (video)", () => {
  it("posts to /act_<id>/adcreatives with full object_story_spec", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "creative_123" }),
    });

    const result = await createAdCreativeTool.handler(
      createAdCreativeTool.inputSchema.parse({
        name: "SAMPLE - Video #2",
        page_id: "100000000000001",
        instagram_user_id: "17000000000000001",
        video_id: "1500000000000001",
        headline: "Catch the radio host live",
        body: "Sample Comedian is coming to Metro City!",
        link_description: "Doors 7 PM | Show 8 PM\n21+ | Tickets $25",
        cta_type: "LEARN_MORE",
        link_url: "https://acmeevents.com/shows/sample-event",
      }),
      api(mockFetch),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ id: "creative_123" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/act_999\/adcreatives\?/);
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("name")).toBe("SAMPLE - Video #2");

    const oss = JSON.parse(body.get("object_story_spec") ?? "{}");
    expect(oss.page_id).toBe("100000000000001");
    expect(oss.instagram_user_id).toBe("17000000000000001");
    expect(oss.video_data.video_id).toBe("1500000000000001");
    expect(oss.video_data.title).toBe("Catch the radio host live");
    expect(oss.video_data.message).toBe("Sample Comedian is coming to Metro City!");
    expect(oss.video_data.link_description).toBe("Doors 7 PM | Show 8 PM\n21+ | Tickets $25");
    expect(oss.video_data.call_to_action.type).toBe("LEARN_MORE");
    expect(oss.video_data.call_to_action.value.link).toBe("https://acmeevents.com/shows/sample-event");
  });

  it("omits instagram_user_id and link_description when not provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "creative_456" }),
    });

    await createAdCreativeTool.handler(
      createAdCreativeTool.inputSchema.parse({
        name: "Minimal",
        page_id: "p",
        video_id: "v",
        headline: "h",
        body: "b",
        cta_type: "GET_TICKETS",
        link_url: "https://example.com",
      }),
      api(mockFetch),
    );

    const [, init] = mockFetch.mock.calls[0];
    const body = (init as RequestInit).body as URLSearchParams;
    const oss = JSON.parse(body.get("object_story_spec") ?? "{}");
    expect(oss.instagram_user_id).toBeUndefined();
    expect(oss.video_data.link_description).toBeUndefined();
  });

  it("passes image_url through to video_data when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "creative_789" }),
    });

    await createAdCreativeTool.handler(
      createAdCreativeTool.inputSchema.parse({
        name: "Thumb",
        page_id: "p",
        video_id: "v",
        image_url: "https://cdn.example.com/thumb.jpg",
        headline: "h",
        body: "b",
        cta_type: "GET_TICKETS",
        link_url: "https://example.com",
      }),
      api(mockFetch),
    );

    const [, init] = mockFetch.mock.calls[0];
    const body = (init as RequestInit).body as URLSearchParams;
    const oss = JSON.parse(body.get("object_story_spec") ?? "{}");
    expect(oss.video_data.image_url).toBe("https://cdn.example.com/thumb.jpg");
  });

  it("rejects missing required fields", () => {
    const parsed = createAdCreativeTool.inputSchema.safeParse({
      name: "x",
      page_id: "p",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid CTA type", () => {
    const parsed = createAdCreativeTool.inputSchema.safeParse({
      name: "x",
      page_id: "p",
      video_id: "v",
      headline: "h",
      body: "b",
      cta_type: "WIGGLE",
      link_url: "https://example.com",
    });
    expect(parsed.success).toBe(false);
  });
});
