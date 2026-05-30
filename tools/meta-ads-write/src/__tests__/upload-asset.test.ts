import { describe, it, expect, vi } from "vitest";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { uploadVideoTool, uploadImageTool } from "../tools/upload-asset.js";
import { MetaApi } from "../meta-api.js";

function makeTempFile(name: string, bytes = "fake-bytes"): string {
  const dir = mkdtempSync(join(tmpdir(), "uat-"));
  const p = join(dir, name);
  writeFileSync(p, bytes);
  return p;
}

describe("upload_video / upload_image tools", () => {
  it("upload_video posts multipart to /act_<id>/advideos and returns id", async () => {
    const path = makeTempFile("test.mp4");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "video_42" }),
    });
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const res = await uploadVideoTool.handler({ file_path: path }, api);

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual({ id: "video_42" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/act_999\/advideos\?/);
    const body = (init as RequestInit).body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("source")).toBeInstanceOf(Blob);

    unlinkSync(path);
  });

  it("upload_image posts multipart to /act_<id>/adimages and returns hash", async () => {
    const path = makeTempFile("test.jpg");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ images: { "test.jpg": { hash: "abc123" } } }),
    });
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const res = await uploadImageTool.handler({ file_path: path }, api);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.images["test.jpg"].hash).toBe("abc123");
    const [, init] = mockFetch.mock.calls[0];
    const body = (init as RequestInit).body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("filename")).toBeInstanceOf(Blob);

    unlinkSync(path);
  });

  it("returns a structured error if the file does not exist", async () => {
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    const res = await uploadVideoTool.handler({ file_path: "/nonexistent/file.mp4" }, api);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.type).toBe("FileNotFound");
      expect(res.error.code).toBe(-1);
      expect(res.error.retryable).toBe(false);
    }
  });

  it("returns a FileReadError for non-ENOENT fs failures", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", () => ({
      readFile: vi.fn().mockRejectedValue(
        Object.assign(new Error("permission denied"), { code: "EACCES" }),
      ),
    }));
    const { uploadVideoTool: tool } = await import("../tools/upload-asset.js");
    const { MetaApi: Api } = await import("../meta-api.js");
    const api = new Api({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    const res = await tool.handler({ file_path: "/some/protected/file.mp4" }, api);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.type).toBe("FileReadError");
      expect(res.error.code).toBe(-2);
      expect(res.error.retryable).toBe(false);
      expect(res.error.message).toContain("permission denied");
    }
    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });
});
