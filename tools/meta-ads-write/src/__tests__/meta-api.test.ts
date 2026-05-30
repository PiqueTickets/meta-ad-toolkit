import { describe, it, expect, vi, beforeEach } from "vitest";
import { MetaApi } from "../meta-api.js";

describe("MetaApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok=true with parsed data on a 200 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "12345", name: "test" }),
    });
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const res = await api.post("/12345", { name: "test" });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual({ id: "12345", name: "test" });
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/access_token=tok/);
    expect((init as RequestInit).method).toBe("POST");
  });

  it("returns ok=false with structured error on a 400 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: "Invalid parameter",
          code: 100,
          type: "OAuthException",
          fbtrace_id: "abcXYZ",
        },
      }),
    });
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const res = await api.post("/12345", { name: "test" });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("Invalid parameter");
      expect(res.error.code).toBe(100);
      expect(res.error.fbtrace_id).toBe("abcXYZ");
      expect(res.error.retryable).toBe(false);
    }
  });

  it("flags rate-limit errors as retryable", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: "rate limit", code: 17, type: "OAuthException" },
      }),
    });
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const res = await api.post("/anything", {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.retryable).toBe(true);
  });

  it("flags HTTP 5xx errors as retryable even with no error.code", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    const api = new MetaApi({
      accessToken: "tok",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    const res = await api.post("/anything", {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.retryable).toBe(true);
  });

  it("never logs the access token", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "1" }),
    });
    const api = new MetaApi({
      accessToken: "SECRET_TOKEN_VALUE",
      accountId: "act_999",
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    await api.post("/x", {});
    const allLogs = errSpy.mock.calls.flat().join(" ");
    expect(allLogs).not.toContain("SECRET_TOKEN_VALUE");
  });
});
