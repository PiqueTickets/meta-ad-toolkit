import { describe, it, expect, vi } from "vitest";
import { listToolNames, dispatchToolCall } from "../index.js";
import { MetaApi } from "../meta-api.js";

function makeApi(mockFetch: ReturnType<typeof vi.fn>): MetaApi {
  return new MetaApi({
    accessToken: "tok",
    accountId: "act_999",
    fetchImpl: mockFetch as unknown as typeof fetch,
  });
}

describe("server tool registration", () => {
  it("registers exactly the 11 expected tools", () => {
    const names = listToolNames().sort();
    expect(names).toEqual([
      "create_ad",
      "create_ad_creative",
      "delete_ad",
      "pause_ad",
      "pause_adset",
      "resume_ad",
      "resume_adset",
      "update_ad",
      "update_adset",
      "upload_image",
      "upload_video",
    ]);
  });
});

describe("dispatchToolCall", () => {
  it("returns isError for an unknown tool name without calling fetch", async () => {
    const mockFetch = vi.fn();
    const res = await dispatchToolCall("nonexistent_tool", {}, makeApi(mockFetch));

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Unknown tool/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns isError for invalid input without calling fetch", async () => {
    const mockFetch = vi.fn();
    const res = await dispatchToolCall("create_ad", { adset_id: "" }, makeApi(mockFetch));

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/Invalid input/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns isError=false when the tool returns ok:true", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "ad_42" }),
    });
    const res = await dispatchToolCall(
      "create_ad",
      { adset_id: "as_1", creative_id: "cr_1", name: "Test" },
      makeApi(mockFetch),
    );

    expect(res.isError).toBe(false);
    expect(res.content[0].text).toContain("ad_42");
  });

  it("returns isError=true when the tool returns ok:false", async () => {
    const res = await dispatchToolCall(
      "upload_video",
      { file_path: "/nonexistent/file.mp4" },
      makeApi(vi.fn()),
    );

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("FileNotFound");
  });
});
