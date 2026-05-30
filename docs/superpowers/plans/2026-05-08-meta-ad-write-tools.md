# /build-ads write tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled mutation surface (`/build-ads` skill + sibling MCP server `tools/meta-ads-write`) so the operator can build Meta ads via Claude Code, while preserving the existing read skills' suggest-only contract through a marker-file `PreToolUse` hook.

**Architecture:** New TypeScript MCP server `tools/meta-ads-write` exposes 10 gap tools (create_ad, update_ad, pause/resume ad/adset, update_adset, upload_video/image, delete_ad). Existing `meta-ads-mcp` (npm) keeps its read tools and gets its existing create_* tools allow-listed. A `PreToolUse` hook gates all write tools on the existence (and freshness) of a `.build-ads-active` marker file that only the new `/build-ads` skill creates and removes.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod`, Vitest. Node ≥20 (uses global `fetch`).

**Spec reference:** `docs/superpowers/specs/2026-05-08-meta-ad-write-tools-design.md`

---

## Task ordering rationale

Foundation (skeleton + API client) before tools. Tools before server bootstrap (so the server has things to register). Schema + skill files before settings.json/`.mcp.json` wiring (so we have something to wire). Safety-gates tests last (so they have all the files to validate).

---

## Task 1: Package skeleton and .gitignore for marker file

**Files:**
- Create: `tools/meta-ads-write/package.json`
- Create: `tools/meta-ads-write/tsconfig.json`
- Create: `tools/meta-ads-write/vitest.config.ts`
- Create: `tools/meta-ads-write/README.md`
- Create: `tools/meta-ads-write/src/index.ts` (placeholder; real implementation in Task 10)
- Create: `tools/meta-ads-write/src/__tests__/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Create the package.json**

```json
{
  "name": "meta-ads-write",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "smoke": "node dist/scripts/smoke.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/__tests__/**", "node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts"],
    },
  },
});
```

- [ ] **Step 4: Create the placeholder index.ts**

```typescript
// Real bootstrap lives here after Task 10. This placeholder lets the package
// install and the test runner discover its directory.
export {};
```

- [ ] **Step 5: Create the README**

```markdown
# meta-ads-write

Sibling MCP server for the meta-ad-automation project. Exposes 10 Meta Marketing API write tools that the upstream `meta-ads-mcp` package does not provide. Used exclusively by the `/build-ads` Claude Code skill, gated by a `PreToolUse` hook on a `.build-ads-active` marker file.

## Build

\`\`\`
npm install
npm run build
\`\`\`

## Test

\`\`\`
npm test
\`\`\`

## Tools provided

create_ad, update_ad, pause_ad, resume_ad, pause_adset, resume_adset, update_adset, upload_video, upload_image, delete_ad.

See `docs/superpowers/specs/2026-05-08-meta-ad-write-tools-design.md` for design rationale.
```

- [ ] **Step 6: Create the test directory placeholder**

```
# Empty file at tools/meta-ads-write/src/__tests__/.gitkeep
```

- [ ] **Step 7: Add `.build-ads-active` to `.gitignore`**

Modify `.gitignore` — append:

```
.build-ads-active
tools/meta-ads-write/node_modules/
tools/meta-ads-write/dist/
```

- [ ] **Step 8: Install dependencies and verify build runs (will succeed with the placeholder)**

Run: `cd tools/meta-ads-write && npm install && npm run build`
Expected: `npm install` succeeds (creates `node_modules/`, `package-lock.json`); `npm run build` succeeds (creates `dist/index.js` containing `export {};`).

- [ ] **Step 9: Verify Vitest reports no tests yet**

Run: `cd tools/meta-ads-write && npm test`
Expected: `No test files found` and exit 0 (Vitest treats this as success when no `*.test.ts` files exist; if it fails, add `--passWithNoTests` to the `test` script).

- [ ] **Step 10: Commit**

```bash
git add tools/meta-ads-write/ .gitignore
git commit -m "feat: scaffold tools/meta-ads-write package and ignore marker file

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Meta API client (`src/meta-api.ts`)

**Files:**
- Create: `tools/meta-ads-write/src/meta-api.ts`
- Create: `tools/meta-ads-write/src/__tests__/meta-api.test.ts`

The client is a thin wrapper around `fetch` that injects the access token, parses Graph API responses, and surfaces structured errors.

- [ ] **Step 1: Write the failing test**

Create `tools/meta-ads-write/src/__tests__/meta-api.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL with `Cannot find module '../meta-api.js'` (or similar — the file doesn't exist yet).

- [ ] **Step 3: Implement `meta-api.ts`**

Create `tools/meta-ads-write/src/meta-api.ts`:

```typescript
export interface MetaApiOk<T> {
  ok: true;
  data: T;
}

export interface MetaApiError {
  ok: false;
  error: {
    message: string;
    code: number;
    type: string;
    fbtrace_id?: string;
    retryable: boolean;
  };
}

export type MetaApiResult<T> = MetaApiOk<T> | MetaApiError;

const RETRYABLE_CODES = new Set([4, 17, 32, 613]);
const GRAPH_API_VERSION = "v20.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface MetaApiOptions {
  accessToken: string;
  accountId: string;
  fetchImpl?: typeof fetch;
}

export class MetaApi {
  private readonly accessToken: string;
  private readonly accountId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MetaApiOptions) {
    this.accessToken = opts.accessToken;
    this.accountId = opts.accountId;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  get accountPath(): string {
    return this.accountId.startsWith("act_") ? this.accountId : `act_${this.accountId}`;
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<MetaApiResult<T>> {
    const url = this.buildUrl(path);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      params.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    return this.dispatch<T>(url, { method: "POST", body: params });
  }

  async postMultipart<T>(path: string, form: FormData): Promise<MetaApiResult<T>> {
    const url = this.buildUrl(path);
    return this.dispatch<T>(url, { method: "POST", body: form });
  }

  async delete<T>(path: string): Promise<MetaApiResult<T>> {
    const url = this.buildUrl(path);
    return this.dispatch<T>(url, { method: "DELETE" });
  }

  private buildUrl(path: string): string {
    const sep = path.includes("?") ? "&" : "?";
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${GRAPH_API_BASE}${normalized}${sep}access_token=${this.accessToken}`;
  }

  private async dispatch<T>(url: string, init: RequestInit): Promise<MetaApiResult<T>> {
    const started = Date.now();
    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (e) {
      console.error(JSON.stringify({
        op: "fetch_failed",
        url: this.redactUrl(url),
        ms: Date.now() - started,
        message: (e as Error).message,
      }));
      return {
        ok: false,
        error: { message: (e as Error).message, code: -1, type: "NetworkError", retryable: true },
      };
    }

    const ms = Date.now() - started;
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (response.ok) {
      console.error(JSON.stringify({ op: "ok", url: this.redactUrl(url), status: response.status, ms }));
      return { ok: true, data: json as T };
    }

    const errBody = (json.error ?? {}) as Record<string, unknown>;
    const code = typeof errBody.code === "number" ? errBody.code : -1;
    const error = {
      message: typeof errBody.message === "string" ? errBody.message : `HTTP ${response.status}`,
      code,
      type: typeof errBody.type === "string" ? errBody.type : "Unknown",
      fbtrace_id: typeof errBody.fbtrace_id === "string" ? errBody.fbtrace_id : undefined,
      retryable: RETRYABLE_CODES.has(code),
    };
    console.error(JSON.stringify({
      op: "graph_error",
      url: this.redactUrl(url),
      status: response.status,
      ms,
      code,
      fbtrace_id: error.fbtrace_id,
    }));
    return { ok: false, error };
  }

  private redactUrl(url: string): string {
    return url.replace(/access_token=[^&]+/, "access_token=REDACTED");
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/meta-api.ts tools/meta-ads-write/src/__tests__/meta-api.test.ts
git commit -m "feat(meta-ads-write): add Graph API client with structured errors

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `create_ad` tool

**Files:**
- Create: `tools/meta-ads-write/src/tools/create-ad.ts`
- Create: `tools/meta-ads-write/src/__tests__/create-ad.test.ts`

This tool wraps `POST /act_<id>/ads` to create an ad linking an existing creative to an existing ad set. The `status` field defaults to PAUSED for safety.

- [ ] **Step 1: Write the failing test**

Create `tools/meta-ads-write/src/__tests__/create-ad.test.ts`:

```typescript
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
      {
        adset_id: "adset_111",
        creative_id: "creative_222",
        name: "Test Ad",
      },
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
      { adset_id: "adset_111", creative_id: "creative_222", name: "Live", status: "ACTIVE" },
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL with `Cannot find module '../tools/create-ad.js'`.

- [ ] **Step 3: Implement `create-ad.ts`**

Create `tools/meta-ads-write/src/tools/create-ad.ts`:

```typescript
import { z } from "zod";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

export const createAdInputSchema = z.object({
  adset_id: z.string().min(1),
  creative_id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
});

export type CreateAdInput = z.infer<typeof createAdInputSchema>;

export const createAdTool = {
  name: "create_ad",
  description:
    "Create a Meta ad linking an existing creative to an existing ad set. Defaults to PAUSED.",
  inputSchema: createAdInputSchema,

  async handler(input: CreateAdInput, api: MetaApi): Promise<MetaApiResult<{ id: string }>> {
    return api.post(`/${api.accountPath}/ads`, {
      name: input.name,
      adset_id: input.adset_id,
      status: input.status,
      creative: { creative_id: input.creative_id },
    });
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 7 tests pass total (4 from Task 2 + 3 from this task).

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/tools/create-ad.ts tools/meta-ads-write/src/__tests__/create-ad.test.ts
git commit -m "feat(meta-ads-write): add create_ad tool with PAUSED default

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `update_ad` tool

**Files:**
- Create: `tools/meta-ads-write/src/tools/update-ad.ts`
- Create: `tools/meta-ads-write/src/__tests__/update-ad.test.ts`

Updates an existing ad. Useful for swapping creative or renaming.

- [ ] **Step 1: Write the failing test**

```typescript
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
      { ad_id: "ad_555", name: "Renamed", creative_id: "new_creative" },
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL with `Cannot find module '../tools/update-ad.js'`.

- [ ] **Step 3: Implement `update-ad.ts`**

```typescript
import { z } from "zod";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

export const updateAdInputSchema = z
  .object({
    ad_id: z.string().min(1),
    name: z.string().min(1).optional(),
    creative_id: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.creative_id !== undefined || v.status !== undefined,
    { message: "Provide at least one of: name, creative_id, status" },
  );

export type UpdateAdInput = z.infer<typeof updateAdInputSchema>;

export const updateAdTool = {
  name: "update_ad",
  description: "Update an existing Meta ad (rename, swap creative, or change status).",
  inputSchema: updateAdInputSchema,

  async handler(input: UpdateAdInput, api: MetaApi): Promise<MetaApiResult<{ success: boolean }>> {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.status !== undefined) body.status = input.status;
    if (input.creative_id !== undefined) body.creative = { creative_id: input.creative_id };
    return api.post(`/${input.ad_id}`, body);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 9 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/tools/update-ad.ts tools/meta-ads-write/src/__tests__/update-ad.test.ts
git commit -m "feat(meta-ads-write): add update_ad tool

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: pause/resume ad and adset tools

**Files:**
- Create: `tools/meta-ads-write/src/tools/pause-resume.ts` (4 tools share this file)
- Create: `tools/meta-ads-write/src/__tests__/pause-resume.test.ts`

Four tools — `pause_ad`, `resume_ad`, `pause_adset`, `resume_adset` — share a common pattern, so they live together.

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL with `Cannot find module '../tools/pause-resume.js'`.

- [ ] **Step 3: Implement `pause-resume.ts`**

```typescript
import { z } from "zod";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

const adInputSchema = z.object({ ad_id: z.string().min(1) });
const adsetInputSchema = z.object({ adset_id: z.string().min(1) });

type AdInput = z.infer<typeof adInputSchema>;
type AdsetInput = z.infer<typeof adsetInputSchema>;
type Result = MetaApiResult<{ success: boolean }>;

export const pauseAdTool = {
  name: "pause_ad",
  description: "Pause an existing Meta ad.",
  inputSchema: adInputSchema,
  async handler(input: AdInput, api: MetaApi): Promise<Result> {
    return api.post(`/${input.ad_id}`, { status: "PAUSED" });
  },
};

export const resumeAdTool = {
  name: "resume_ad",
  description: "Resume (set ACTIVE) an existing Meta ad.",
  inputSchema: adInputSchema,
  async handler(input: AdInput, api: MetaApi): Promise<Result> {
    return api.post(`/${input.ad_id}`, { status: "ACTIVE" });
  },
};

export const pauseAdsetTool = {
  name: "pause_adset",
  description: "Pause an existing Meta ad set.",
  inputSchema: adsetInputSchema,
  async handler(input: AdsetInput, api: MetaApi): Promise<Result> {
    return api.post(`/${input.adset_id}`, { status: "PAUSED" });
  },
};

export const resumeAdsetTool = {
  name: "resume_adset",
  description: "Resume (set ACTIVE) an existing Meta ad set.",
  inputSchema: adsetInputSchema,
  async handler(input: AdsetInput, api: MetaApi): Promise<Result> {
    return api.post(`/${input.adset_id}`, { status: "ACTIVE" });
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 13 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/tools/pause-resume.ts tools/meta-ads-write/src/__tests__/pause-resume.test.ts
git commit -m "feat(meta-ads-write): add pause/resume tools for ads and ad sets

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `update_adset` tool

**Files:**
- Create: `tools/meta-ads-write/src/tools/update-adset.ts`
- Create: `tools/meta-ads-write/src/__tests__/update-adset.test.ts`

Updates ad set fields like budget or schedule.

- [ ] **Step 1: Write the failing test**

```typescript
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
      {
        adset_id: "adset_99",
        daily_budget_cents: 5000,
        end_time: "2026-05-23T00:00:00+0000",
      },
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `update-adset.ts`**

```typescript
import { z } from "zod";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

export const updateAdsetInputSchema = z
  .object({
    adset_id: z.string().min(1),
    name: z.string().min(1).optional(),
    daily_budget_cents: z.number().int().positive().optional(),
    lifetime_budget_cents: z.number().int().positive().optional(),
    start_time: z.string().min(1).optional(),
    end_time: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.daily_budget_cents !== undefined ||
      v.lifetime_budget_cents !== undefined ||
      v.start_time !== undefined ||
      v.end_time !== undefined ||
      v.status !== undefined,
    { message: "Provide at least one updatable field" },
  );

export type UpdateAdsetInput = z.infer<typeof updateAdsetInputSchema>;

export const updateAdsetTool = {
  name: "update_adset",
  description: "Update an existing Meta ad set (budget, schedule, status, name).",
  inputSchema: updateAdsetInputSchema,

  async handler(
    input: UpdateAdsetInput,
    api: MetaApi,
  ): Promise<MetaApiResult<{ success: boolean }>> {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.daily_budget_cents !== undefined) body.daily_budget = String(input.daily_budget_cents);
    if (input.lifetime_budget_cents !== undefined)
      body.lifetime_budget = String(input.lifetime_budget_cents);
    if (input.start_time !== undefined) body.start_time = input.start_time;
    if (input.end_time !== undefined) body.end_time = input.end_time;
    if (input.status !== undefined) body.status = input.status;
    return api.post(`/${input.adset_id}`, body);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 15 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/tools/update-adset.ts tools/meta-ads-write/src/__tests__/update-adset.test.ts
git commit -m "feat(meta-ads-write): add update_adset tool

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `upload_video` and `upload_image` tools

**Files:**
- Create: `tools/meta-ads-write/src/tools/upload-asset.ts`
- Create: `tools/meta-ads-write/src/__tests__/upload-asset.test.ts`

Both tools accept a local file path, read the bytes, and post via `multipart/form-data`. Video upload returns `{ id: <video_id> }`; image upload returns `{ images: { <image_hash>: { hash } } }`.

- [ ] **Step 1: Write the failing test**

```typescript
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
    expect((init as RequestInit).body).toBeInstanceOf(FormData);

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
      expect(res.error.retryable).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `upload-asset.ts`**

```typescript
import { z } from "zod";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

const fileInputSchema = z.object({ file_path: z.string().min(1) });
type FileInput = z.infer<typeof fileInputSchema>;

interface VideoUploadResponse {
  id: string;
}

interface ImageUploadResponse {
  images: Record<string, { hash: string }>;
}

function fileNotFoundError(path: string): MetaApiResult<never> {
  return {
    ok: false,
    error: {
      message: `File not found: ${path}`,
      code: -1,
      type: "FileNotFound",
      retryable: false,
    },
  };
}

function readFileSafely(path: string): { ok: true; bytes: Buffer; name: string } | MetaApiResult<never> {
  try {
    statSync(path);
    return { ok: true, bytes: readFileSync(path), name: basename(path) };
  } catch {
    return fileNotFoundError(path);
  }
}

export const uploadVideoTool = {
  name: "upload_video",
  description: "Upload a local video file to Meta and return its video_id.",
  inputSchema: fileInputSchema,

  async handler(input: FileInput, api: MetaApi): Promise<MetaApiResult<VideoUploadResponse>> {
    const read = readFileSafely(input.file_path);
    if ("ok" in read && read.ok === false) return read;
    if (!("bytes" in read)) return fileNotFoundError(input.file_path);

    const form = new FormData();
    const blob = new Blob([read.bytes]);
    form.set("source", blob, read.name);
    return api.postMultipart<VideoUploadResponse>(`/${api.accountPath}/advideos`, form);
  },
};

export const uploadImageTool = {
  name: "upload_image",
  description: "Upload a local image file to Meta and return its image hash.",
  inputSchema: fileInputSchema,

  async handler(input: FileInput, api: MetaApi): Promise<MetaApiResult<ImageUploadResponse>> {
    const read = readFileSafely(input.file_path);
    if ("ok" in read && read.ok === false) return read;
    if (!("bytes" in read)) return fileNotFoundError(input.file_path);

    const form = new FormData();
    const blob = new Blob([read.bytes]);
    form.set("filename", blob, read.name);
    return api.postMultipart<ImageUploadResponse>(`/${api.accountPath}/adimages`, form);
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 18 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/tools/upload-asset.ts tools/meta-ads-write/src/__tests__/upload-asset.test.ts
git commit -m "feat(meta-ads-write): add upload_video and upload_image tools

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `delete_ad` tool

**Files:**
- Create: `tools/meta-ads-write/src/tools/delete-ad.ts`
- Create: `tools/meta-ads-write/src/__tests__/delete-ad.test.ts`

Hard-deletes an ad (`DELETE /<ad_id>`). Used for emergency rollback; documented as destructive.

- [ ] **Step 1: Write the failing test**

```typescript
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

    const res = await deleteAdTool.handler({ ad_id: "ad_42" }, api);
    expect(res.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/ad_42\?/);
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `delete-ad.ts`**

```typescript
import { z } from "zod";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

export const deleteAdInputSchema = z.object({
  ad_id: z.string().min(1),
  confirm: z.literal(true).describe("Set to true to confirm; this is destructive"),
});

export type DeleteAdInput = z.infer<typeof deleteAdInputSchema>;

export const deleteAdTool = {
  name: "delete_ad",
  description:
    "Hard-delete a Meta ad. Destructive and irreversible. Caller must pass confirm=true.",
  inputSchema: deleteAdInputSchema,

  async handler(input: DeleteAdInput, api: MetaApi): Promise<MetaApiResult<{ success: boolean }>> {
    return api.delete(`/${input.ad_id}`);
  },
};
```

Note: the failing test does **not** pass `confirm: true` because the schema is exported separately and the handler doesn't enforce parsing. The test bypasses zod by calling `handler` directly with a non-validated object. Update the test to pass `confirm: true` so the type checks:

Update the test in Step 1 to pass `confirm: true`:

```typescript
const res = await deleteAdTool.handler({ ad_id: "ad_42", confirm: true }, api);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 19 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/tools/delete-ad.ts tools/meta-ads-write/src/__tests__/delete-ad.test.ts
git commit -m "feat(meta-ads-write): add delete_ad tool with confirmation guard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: MCP server bootstrap (`src/index.ts`) + smoke script

**Files:**
- Modify: `tools/meta-ads-write/src/index.ts`
- Create: `tools/meta-ads-write/scripts/smoke.ts`
- Create: `tools/meta-ads-write/src/__tests__/index.test.ts`

Wires all 10 tools into a `@modelcontextprotocol/sdk` server speaking JSON-RPC over stdio. The smoke script imports the registration function and asserts each tool is present.

- [ ] **Step 1: Write the failing index test**

Create `tools/meta-ads-write/src/__tests__/index.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { listToolNames } from "../index.js";

describe("server tool registration", () => {
  it("registers exactly the 10 expected tools", () => {
    const names = listToolNames().sort();
    expect(names).toEqual([
      "create_ad",
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL — `listToolNames` not exported from `../index.js`.

- [ ] **Step 3: Implement `index.ts`**

Replace the placeholder `tools/meta-ads-write/src/index.ts`:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { MetaApi } from "./meta-api.js";
import { createAdTool } from "./tools/create-ad.js";
import { updateAdTool } from "./tools/update-ad.js";
import {
  pauseAdTool,
  resumeAdTool,
  pauseAdsetTool,
  resumeAdsetTool,
} from "./tools/pause-resume.js";
import { updateAdsetTool } from "./tools/update-adset.js";
import { uploadVideoTool, uploadImageTool } from "./tools/upload-asset.js";
import { deleteAdTool } from "./tools/delete-ad.js";

interface ToolDef<I> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  handler: (input: I, api: MetaApi) => Promise<unknown>;
}

const TOOLS: ToolDef<unknown>[] = [
  createAdTool,
  updateAdTool,
  pauseAdTool,
  resumeAdTool,
  pauseAdsetTool,
  resumeAdsetTool,
  updateAdsetTool,
  uploadVideoTool,
  uploadImageTool,
  deleteAdTool,
] as ToolDef<unknown>[];

export function listToolNames(): string[] {
  return TOOLS.map((t) => t.name);
}

function buildApi(): MetaApi {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken) throw new Error("META_ACCESS_TOKEN not set");
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID not set");
  return new MetaApi({ accessToken, accountId });
}

async function main(): Promise<void> {
  const api = buildApi();
  const server = new Server(
    { name: "meta-ads-write", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    if (!tool) {
      return { content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }], isError: true };
    }
    const parsed = tool.inputSchema.safeParse(req.params.arguments);
    if (!parsed.success) {
      return {
        content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
        isError: true,
      };
    }
    const result = await tool.handler(parsed.data, api);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError: result !== null && typeof result === "object" && "ok" in result && (result as { ok: boolean }).ok === false,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("meta-ads-write server connected");
}

function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  // Minimal converter sufficient for MCP tool registration.
  // The MCP SDK accepts JSON Schema objects; we hand back the zod description.
  return { type: "object", description: schema.description ?? "" };
}

if (process.argv[1]?.endsWith("index.js")) {
  main().catch((e) => {
    console.error("startup error:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 20 tests pass total.

- [ ] **Step 5: Create the smoke script**

Create `tools/meta-ads-write/scripts/smoke.ts`:

```typescript
import { listToolNames } from "../src/index.js";

const expected = [
  "create_ad",
  "delete_ad",
  "pause_ad",
  "pause_adset",
  "resume_ad",
  "resume_adset",
  "update_ad",
  "update_adset",
  "upload_image",
  "upload_video",
];

const actual = listToolNames().sort();
const missing = expected.filter((n) => !actual.includes(n));
if (missing.length > 0) {
  console.error(`SMOKE FAIL — missing tools: ${missing.join(", ")}`);
  process.exit(1);
}
console.error(`SMOKE OK — ${actual.length} tools registered`);
```

Add the smoke script to `tsconfig.json` includes by changing:

```json
"include": ["src/**/*", "scripts/**/*"]
```

And update `package.json` `scripts.smoke` to:

```json
"smoke": "node dist/scripts/smoke.js"
```

- [ ] **Step 6: Build and run smoke**

Run: `cd tools/meta-ads-write && npm run build && npm run smoke`
Expected: `SMOKE OK — 10 tools registered` to stderr; exit 0.

- [ ] **Step 7: Commit**

```bash
git add tools/meta-ads-write/src/index.ts tools/meta-ads-write/src/__tests__/index.test.ts tools/meta-ads-write/scripts/smoke.ts tools/meta-ads-write/tsconfig.json tools/meta-ads-write/package.json
git commit -m "feat(meta-ads-write): wire MCP server bootstrap and add smoke script

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: zod spec schema (`src/spec-schema.ts`)

**Files:**
- Create: `tools/meta-ads-write/src/spec-schema.ts`
- Create: `tools/meta-ads-write/src/__tests__/spec-schema.test.ts`

This zod schema is the canonical YAML build-spec validator. It is consumed by the `/build-ads` skill at dry-run time.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { buildSpecSchema } from "../spec-schema.js";

describe("buildSpecSchema", () => {
  it("accepts a minimal valid ad-creation spec", () => {
    const spec = {
      version: 1,
      intent: "Split video carousel",
      account_id: "act_0000000000000000",
      creates: [
        {
          kind: "ad",
          parent_adset_id: "adset_1",
          name: "SAMPLE - Video #2",
          creative: {
            kind: "video",
            video_file: "./assets/v2.mp4",
            headline: "Sample Live",
            body: "Plain body",
            cta_type: "GET_TICKETS",
            link_url: "https://example.com/sample",
          },
          status: "PAUSED",
        },
      ],
    };
    const parsed = buildSpecSchema.safeParse(spec);
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown create kinds", () => {
    const spec = {
      version: 1,
      intent: "x",
      account_id: "act_1",
      creates: [{ kind: "widget" }],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("requires version === 1", () => {
    const spec = {
      version: 2,
      intent: "x",
      account_id: "act_1",
      creates: [],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("defaults status to PAUSED on ad creates", () => {
    const spec = {
      version: 1,
      intent: "x",
      account_id: "act_1",
      creates: [
        {
          kind: "ad",
          parent_adset_id: "a",
          name: "n",
          creative: {
            kind: "image",
            image_file: "./x.jpg",
            headline: "h",
            body: "b",
            cta_type: "LEARN_MORE",
            link_url: "https://example.com",
          },
        },
      ],
    };
    const parsed = buildSpecSchema.safeParse(spec);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const create = parsed.data.creates[0];
      if (create.kind === "ad") expect(create.status).toBe("PAUSED");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd tools/meta-ads-write && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `spec-schema.ts`**

```typescript
import { z } from "zod";

const ctaTypeSchema = z.enum([
  "GET_TICKETS",
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "BOOK_TRAVEL",
  "DOWNLOAD",
]);

const videoCreativeSchema = z.object({
  kind: z.literal("video"),
  video_file: z.string().min(1),
  thumbnail_file: z.string().optional(),
  headline: z.string().min(1),
  body: z.string().min(1),
  cta_type: ctaTypeSchema,
  link_url: z.string().url(),
});

const imageCreativeSchema = z.object({
  kind: z.literal("image"),
  image_file: z.string().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
  cta_type: ctaTypeSchema,
  link_url: z.string().url(),
});

const creativeSchema = z.discriminatedUnion("kind", [videoCreativeSchema, imageCreativeSchema]);

const adCreateSchema = z.object({
  kind: z.literal("ad"),
  parent_adset_id: z.string().min(1),
  name: z.string().min(1),
  creative: creativeSchema,
  status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
});

const adsetCreateSchema = z.object({
  kind: z.literal("ad_set"),
  parent_campaign_id: z.string().min(1),
  name: z.string().min(1),
  daily_budget_cents: z.number().int().positive().optional(),
  lifetime_budget_cents: z.number().int().positive().optional(),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  optimization_goal: z.string().min(1),
  status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
});

const campaignCreateSchema = z.object({
  kind: z.literal("campaign"),
  name: z.string().min(1),
  objective: z.enum([
    "OUTCOME_SALES",
    "OUTCOME_TRAFFIC",
    "OUTCOME_AWARENESS",
    "OUTCOME_ENGAGEMENT",
    "OUTCOME_LEADS",
    "OUTCOME_APP_PROMOTION",
  ]),
  status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
});

const audienceCreateSchema = z.object({
  kind: z.literal("audience"),
  name: z.string().min(1),
  audience_type: z.enum(["custom", "lookalike"]),
});

const creativeOnlyCreateSchema = z.object({
  kind: z.literal("creative"),
  name: z.string().min(1),
  creative: creativeSchema,
});

const createItemSchema = z.discriminatedUnion("kind", [
  campaignCreateSchema,
  adsetCreateSchema,
  adCreateSchema,
  creativeOnlyCreateSchema,
  audienceCreateSchema,
]);

const preflightSchema = z.array(
  z.union([
    z.object({ parent_adset_must_exist: z.string().min(1) }),
    z.object({ parent_adset_must_be_active: z.boolean() }),
    z.object({ assets_must_exist: z.boolean() }),
  ]),
);

export const buildSpecSchema = z.object({
  version: z.literal(1),
  intent: z.string().min(1),
  account_id: z.string().regex(/^act_\d+$/),
  creates: z.array(createItemSchema),
  preflight: preflightSchema.optional(),
});

export type BuildSpec = z.infer<typeof buildSpecSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd tools/meta-ads-write && npm test`
Expected: 24 tests pass total.

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/spec-schema.ts tools/meta-ads-write/src/__tests__/spec-schema.test.ts
git commit -m "feat(meta-ads-write): add zod schema for /build-ads YAML specs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Operator-facing docs (`prompts/build-spec-schema.md` and `references/build-safety.md`)

**Files:**
- Create: `prompts/build-spec-schema.md`
- Create: `references/build-safety.md`

These are read by the `/build-ads` skill (and the operator) to understand the spec format and the safety rules.

- [ ] **Step 1: Create `prompts/build-spec-schema.md`**

```markdown
# /build-ads spec format

Canonical YAML schema for build specs consumed by `/build-ads`. The runtime validator is `tools/meta-ads-write/src/spec-schema.ts` (zod). This doc mirrors the schema in human-readable form; the zod schema is the source of truth.

## Top-level shape

\`\`\`yaml
version: 1                              # required, must be 1
intent: "Short human description"       # required
account_id: act_<numeric>               # required, must match env META_AD_ACCOUNT_ID
creates: [...]                          # required; ordered list of creates
preflight: [...]                        # optional; dry-run-time assertions
\`\`\`

## Create kinds

Every entry in `creates` has a `kind` discriminator. The five supported kinds:

### kind: campaign

\`\`\`yaml
- kind: campaign
  name: "SALES - <show> - <venue> - <YYYY-MM-DD>"
  objective: OUTCOME_SALES                # required
  status: PAUSED                          # default PAUSED
\`\`\`

### kind: ad_set

\`\`\`yaml
- kind: ad_set
  parent_campaign_id: "<campaign_id>"     # required
  name: "<adset name>"
  daily_budget_cents: 5000                # one of daily/lifetime required
  lifetime_budget_cents: 20000
  start_time: "2026-05-06T07:00:00+0000"
  end_time:   "2026-05-23T00:00:00+0000"
  optimization_goal: OFFSITE_CONVERSIONS
  status: PAUSED                          # default PAUSED
\`\`\`

### kind: ad

\`\`\`yaml
- kind: ad
  parent_adset_id: "<adset_id>"           # required
  name: "<ad name>"
  creative:                               # required, see below
    kind: video                           # video | image
    ...
  status: PAUSED                          # default PAUSED
\`\`\`

### kind: creative (standalone, when reused across ads)

\`\`\`yaml
- kind: creative
  name: "<creative name>"
  creative: { ... }
\`\`\`

### kind: audience

\`\`\`yaml
- kind: audience
  name: "<audience name>"
  audience_type: custom                   # custom | lookalike
\`\`\`

## Creative shapes

### Video creative

\`\`\`yaml
creative:
  kind: video
  video_file: "./assets/foo.mp4"          # path relative to spec file
  thumbnail_file: "./assets/foo-thumb.jpg" # optional
  headline: "<headline text>"
  body: "<body text or {{copy_from: <ad_id>}}>"
  cta_type: GET_TICKETS                   # one of: GET_TICKETS, LEARN_MORE, SHOP_NOW, SIGN_UP, BOOK_TRAVEL, DOWNLOAD
  link_url: "https://acmeevents.com/..."
\`\`\`

### Image creative

\`\`\`yaml
creative:
  kind: image
  image_file: "./assets/foo.jpg"
  headline: "<headline text>"
  body: "<body text>"
  cta_type: LEARN_MORE
  link_url: "https://example.com"
\`\`\`

## Interpolation: `{{copy_from: <ad_id>}}`

Within `creative.body`, `creative.headline`, or `creative.cta_type`, the operator may write `{{copy_from: <ad_id>}}` to copy the corresponding field from an existing ad. Resolved by `/build-ads` at dry-run time via a read-only API call. No other interpolations are supported in v1.

## Preflight

The `preflight` array contains assertions the dry-run preview enforces before any mutation. Supported entries:

- `parent_adset_must_exist: <adset_id>` — the dry-run will resolve this ID; missing → halt.
- `parent_adset_must_be_active: true` — the resolved ad set's `effective_status` must be ACTIVE.
- `assets_must_exist: true` — every `video_file` / `image_file` / `thumbnail_file` must be readable on the local filesystem.

## Status defaults

All `status` fields default to `PAUSED`. The dry-run preview will surface "New live ads: N" prominently if any create has `status: ACTIVE`.

## Example: split a video carousel into 3 ads

\`\`\`yaml
version: 1
intent: "Split SAMPLE Video #1 into 3 separate single-video ads"
account_id: act_0000000000000000

creates:
  - kind: ad
    parent_adset_id: "120000000000000010"
    name: "SAMPLE - SALES - VIDEO #2"
    creative:
      kind: video
      video_file: "./assets/video2.mp4"
      headline: "Sample Comedian Live in Metro City"
      body: "{{copy_from: 120000000000000011}}"
      cta_type: GET_TICKETS
      link_url: "https://acmeevents.com/sample-event-2026"
    status: PAUSED

  - kind: ad
    parent_adset_id: "120000000000000010"
    name: "SAMPLE - SALES - VIDEO #3"
    creative:
      kind: video
      video_file: "./assets/video3.mp4"
      headline: "Sample Comedian Live in Metro City"
      body: "{{copy_from: 120000000000000011}}"
      cta_type: GET_TICKETS
      link_url: "https://acmeevents.com/sample-event-2026"
    status: PAUSED

  - kind: ad
    parent_adset_id: "120000000000000010"
    name: "SAMPLE - SALES - VIDEO #4"
    creative:
      kind: video
      video_file: "./assets/video4.mp4"
      headline: "Sample Comedian Live in Metro City"
      body: "{{copy_from: 120000000000000011}}"
      cta_type: GET_TICKETS
      link_url: "https://acmeevents.com/sample-event-2026"
    status: PAUSED

preflight:
  - parent_adset_must_exist: "120000000000000010"
  - parent_adset_must_be_active: true
  - assets_must_exist: true
\`\`\`
```

- [ ] **Step 2: Create `references/build-safety.md`**

```markdown
# /build-ads safety rules

Operator-facing rules the `/build-ads` skill cites when explaining why it asks for confirmation or refuses to proceed.

## Three-layer protection

Mutations only go through when **all three** are true:

1. **Skill explicitly invoked.** The operator types `/build-ads`. Read skills (`/weekly-report`, `/monthly-report`, `/show-report`, `/pacing-check`) cannot mutate because they don't create the marker file.
2. **Spec on disk and approved.** Every run produces a YAML spec at `specs/builds/<date>-<slug>.yml`. The operator approves by saying "execute" or by responding to the dry-run prompt. No spec, no execution.
3. **Dry-run preview cleared.** Before any mutation, `/build-ads` resolves all parent IDs, validates assets, resolves interpolations, and shows a summary. The operator must confirm.

## What `/build-ads` will do without asking

- Read `mcp__meta-ads__*` data (campaigns, ad sets, ads, insights) to validate the spec.
- Write the spec file under `specs/builds/`.
- Write the build log under `reports/builds/`.
- `touch .build-ads-active` at start, `rm -f .build-ads-active` at end.

## What `/build-ads` will always ask before doing

- Calling any `mcp__meta-ads__create_*`, `update_*`, `pause_*`, `resume_*` tool.
- Calling any `mcp__meta-ads-write__*` tool.

## What `/build-ads` will not do (ever)

- Roll back a partial spec. If a build halts mid-way, the operator cleans up manually in Ads Manager. Re-running the spec creates duplicates of any items that already succeeded.
- Mutate without the marker file. The `PreToolUse` hook in `.claude/settings.json` blocks any write tool when `.build-ads-active` is missing or older than 1 hour.
- Launch ads as ACTIVE by default. New creates default to `PAUSED`. The operator must edit the spec to set `status: ACTIVE`.

## Recovery scenarios

### "I killed the skill mid-run."

Two cases:

1. **A build was in progress** — the `.build-ads-active` marker is left behind. It self-expires after 1 hour. To clean up sooner: `rm .build-ads-active`. Check `reports/builds/<date>-<slug>.md` to see what was created; clean up the partial state in Ads Manager or by editing the spec to remove completed entries and re-running.
2. **No build was actually in progress** — same: `rm .build-ads-active`.

### "The spec half-ran because of a Graph API error."

Read the build log to see what got created (with IDs). Edit the spec to remove the completed creates. Re-run `/build-ads` against the edited spec.

### "I want to delete an ad I just created."

Use the `delete_ad` tool from `meta-ads-write` (the new MCP) — but it requires `confirm: true`. Or delete in Ads Manager.

## Costs to be aware of

- Every Meta write call costs 3× the rate-limit budget of a read call. A 9-ad spec costs roughly 27× a `/show-report` run.
- Uploaded video bytes count against the account's media storage quota (rarely a concern, but visible in Ads Manager).
- Status: ACTIVE ads start spending immediately.

## When `/build-ads` is the wrong tool

Do not use `/build-ads` for:

- **Mass campaign restructures.** Build the campaign in Ads Manager once, copy/duplicate from there. `/build-ads` is for repeatable, narrow operations like creative testing.
- **Audience hygiene.** Custom audience uploads (CSV / hashed email) are deferred to v2.
- **Carousel-format ads.** v1 supports single-video and single-image creatives only. Build carousels in Ads Manager.
```

- [ ] **Step 3: Verify the files exist and read them**

Run: `cat prompts/build-spec-schema.md | head -30 && cat references/build-safety.md | head -30`
Expected: First 30 lines of each file print without error.

- [ ] **Step 4: Commit**

```bash
git add prompts/build-spec-schema.md references/build-safety.md
git commit -m "docs: add /build-ads spec format and safety rules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Update `prompts/recommendation-rubric.md` (anti-rule #3 rewrite + new #5)

**Files:**
- Modify: `prompts/recommendation-rubric.md`

- [ ] **Step 1: Read the current anti-rules block**

Run: `sed -n '48,55p' prompts/recommendation-rubric.md`
Expected output shows the current anti-rules section.

- [ ] **Step 2: Replace anti-rule #3**

Edit `prompts/recommendation-rubric.md`. Replace:

```markdown
3. **Never recommend creating new campaigns / ad sets / ads / creatives.** This project is suggest-only. If a creative refresh is the right move, recommend it as a brief — the operator builds it elsewhere.
```

with:

```markdown
3. **Report skills are suggest-only. Mutations only happen through `/build-ads`.** Report skills must not call any `mcp__meta-ads__create_*` / `update_*` / `pause_*` / `resume_*` tool, nor any `mcp__meta-ads-write__*` tool. If a creative refresh or ad creation is the right move, recommend it as a brief — the operator runs `/build-ads` separately to execute the brief.
```

- [ ] **Step 3: Add a new anti-rule #5 after #4**

Append after the existing rule #4:

```markdown
5. **Report skills must not include "use /build-ads to do X" as a recommendation.** Keep the read and write surfaces independent so the operator decides when to mutate. Recommendations describe *what* to do; the operator chooses the tool.
```

- [ ] **Step 4: Verify the edits**

Run: `grep -n "Mutations only happen through" prompts/recommendation-rubric.md && grep -n "use /build-ads" prompts/recommendation-rubric.md`
Expected: Both grep commands return at least one matching line.

- [ ] **Step 5: Commit**

```bash
git add prompts/recommendation-rubric.md
git commit -m "docs(rubric): rescope anti-rule #3 and add #5 for /build-ads split

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Update read SKILL.md files to enumerate forbidden tools

**Files:**
- Modify: `.claude/skills/weekly-report/SKILL.md`
- Modify: `.claude/skills/monthly-report/SKILL.md`
- Modify: `.claude/skills/show-report/SKILL.md`
- Modify: `.claude/skills/pacing-check/SKILL.md`

Each gets its "What this skill must NOT do" section expanded to enumerate every forbidden write tool by name.

- [ ] **Step 1: Update `/weekly-report`**

Edit `.claude/skills/weekly-report/SKILL.md`. Replace the existing "What this skill must NOT do" section with:

```markdown
## What this skill must NOT do

- Call any `mcp__meta-ads__create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`, `create_ad_set`, `create_ad_creative`, `create_custom_audience`, or `create_lookalike_audience` tool.
- Call any `mcp__meta-ads-write__*` tool (`create_ad`, `update_ad`, `pause_ad`, `resume_ad`, `pause_adset`, `resume_adset`, `update_adset`, `upload_video`, `upload_image`, `delete_ad`).
- Recommend creating new campaigns / ad sets / ads / creatives. (See `prompts/recommendation-rubric.md` anti-rule #3.)
- Recommend "use /build-ads to do X" as the recommendation. The operator decides when to mutate. (Anti-rule #5.)
- Round inconsistently or invent numbers.
```

- [ ] **Step 2: Update `/monthly-report`**

Edit `.claude/skills/monthly-report/SKILL.md`. Apply the same replacement to its "What this skill must NOT do" section.

- [ ] **Step 3: Update `/show-report`**

Edit `.claude/skills/show-report/SKILL.md`. Currently the section says "Same restrictions as `/weekly-report`. Plus: never assume a show date." Replace the "Same restrictions as `/weekly-report`" line with the enumerated list (keep the show-date line):

```markdown
## What this skill must NOT do

- Call any `mcp__meta-ads__create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`, `create_ad_set`, `create_ad_creative`, `create_custom_audience`, or `create_lookalike_audience` tool.
- Call any `mcp__meta-ads-write__*` tool (`create_ad`, `update_ad`, `pause_ad`, `resume_ad`, `pause_adset`, `resume_adset`, `update_adset`, `upload_video`, `upload_image`, `delete_ad`).
- Recommend creating new campaigns / ad sets / ads / creatives. (See `prompts/recommendation-rubric.md` anti-rule #3.)
- Recommend "use /build-ads to do X" as the recommendation. (Anti-rule #5.)
- Assume a show date. If the date isn't in the campaign name, ask the operator.
```

- [ ] **Step 4: Update `/pacing-check`**

Edit `.claude/skills/pacing-check/SKILL.md`. Replace the existing "Same restrictions as `/weekly-report`" line with the enumerated list (no extra rule for pacing-check):

```markdown
## What this skill must NOT do

- Call any `mcp__meta-ads__create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`, `create_ad_set`, `create_ad_creative`, `create_custom_audience`, or `create_lookalike_audience` tool.
- Call any `mcp__meta-ads-write__*` tool (`create_ad`, `update_ad`, `pause_ad`, `resume_ad`, `pause_adset`, `resume_adset`, `update_adset`, `upload_video`, `upload_image`, `delete_ad`).
- Recommend creating new campaigns / ad sets / ads / creatives. (See `prompts/recommendation-rubric.md` anti-rule #3.)
- Recommend "use /build-ads to do X" as the recommendation. (Anti-rule #5.)
```

- [ ] **Step 5: Verify the edits**

Run: `grep -l "mcp__meta-ads-write__" .claude/skills/weekly-report/SKILL.md .claude/skills/monthly-report/SKILL.md .claude/skills/show-report/SKILL.md .claude/skills/pacing-check/SKILL.md`
Expected: All four file paths print.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/weekly-report/SKILL.md .claude/skills/monthly-report/SKILL.md .claude/skills/show-report/SKILL.md .claude/skills/pacing-check/SKILL.md
git commit -m "docs(skills): enumerate forbidden write tools in read skills

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Create the `/build-ads` skill

**Files:**
- Create: `.claude/skills/build-ads/SKILL.md`

This is the operator-facing skill. It walks the operator through draft → review → dry-run → execute, manages the `.build-ads-active` marker, writes the build log.

- [ ] **Step 1: Create the skill file**

```markdown
---
name: build-ads
description: Use when the operator runs `/build-ads`, asks to create or modify ads/ad sets/campaigns/creatives/audiences, or wants to split a creative carousel into separate ads. The only skill in this project that mutates the Meta ad account. Drafts a YAML spec, reviews it, dry-runs it, then executes.
---

# /build-ads

The mutation surface for meta-ad-automation. Drafts a YAML build spec from a conversational request, asks the operator to review, runs a read-only dry-run preview, and only then executes against the Meta Marketing API.

## Inputs

- Optional natural-language intent in chat (e.g., "split the Sample video carousel into 3 ads"). If absent, the skill asks.
- Optional path to an existing spec file (e.g., `/build-ads specs/builds/2026-05-08-video-split.yml`). If provided, the skill skips drafting and goes straight to dry-run.

## Procedure

Follow these steps in order. Stop and surface the issue if any step fails.

### 1. Sanity-check

- Call `mcp__meta-ads__health_check`. If unhealthy, stop.
- Call `mcp__meta-ads__get_token_info`. If the token expires within 7 days, prepend a warning.

### 2. Resolve input

- If the operator provided a spec path: read the file. Skip to step 4.
- Otherwise: ask the operator for intent if not yet provided. Resolve any campaign / ad-set / ad IDs they mention via `mcp__meta-ads__get_campaign`, `list_ad_sets`, `list_ads`. If `{{copy_from: <ad_id>}}` is implied, fetch that ad's body / headline / CTA via `list_ads` to confirm it exists (don't resolve the placeholder yet).

### 3. Draft the spec

- Generate a YAML build spec following `prompts/build-spec-schema.md`.
- Write to `specs/builds/<today>-<slug>.yml` where `<slug>` is a kebab-cased summary of the intent.
- Echo the spec content to chat.
- Ask: "Review the spec at `<path>`. Reply 'execute' to proceed, 'edit' to make changes, or describe the changes."

### 4. Dry-run preview (read-only — no mutations)

- Validate the spec file against the zod schema in `tools/meta-ads-write/src/spec-schema.ts`. (Run via `node -e` or via the smoke command. If invalid, surface the zod error and stop.)
- For each `creates` entry that references a parent ID: call the appropriate `mcp__meta-ads__get_*` / `list_*` tool to confirm the parent exists.
- Resolve every `{{copy_from: <ad_id>}}` interpolation by reading the source ad. Echo the resolved values to chat.
- For every `video_file` / `image_file` / `thumbnail_file`: confirm the file is readable on the local filesystem.
- Print a summary block:

\`\`\`
Dry-run preview:
  Will upload N videos, M images.
  Will create K creatives, L ads.
  Will create P ad sets, Q campaigns, R audiences.
  New live ads (status: ACTIVE): X     # surface prominently if > 0
  Account: act_<id>
  Total estimated rate-limit cost: ~Y units
\`\`\`

- Ask: "Execute this plan? (yes / no / edit-spec)"

### 5. Execute

If the operator says yes:

- Run `Bash(touch .build-ads-active)` to authorize writes.
- For each create in spec order:
  1. Call the corresponding MCP tool (`mcp__meta-ads__create_campaign` for `kind: campaign`, `mcp__meta-ads__create_ad_set` for `kind: ad_set`, `mcp__meta-ads__create_ad_creative` for creative, `mcp__meta-ads-write__create_ad` for `kind: ad`, etc.). Use `mcp__meta-ads-write__upload_video` / `upload_image` to upload local assets first, capturing the returned `video_id` / `image_hash` for use in the creative spec.
  2. Append the call's request and response (full IDs) to `reports/builds/<today>-<slug>.md`.
  3. On error: stop. Run `Bash(rm -f .build-ads-active)`. Tell the operator what was created so far and which item failed.
- On full success: run `Bash(rm -f .build-ads-active)`. Append a final "✅ All N items created" summary to the build log. Echo summary to chat with the new IDs.

### 6. Build log shape

The build log at `reports/builds/<today>-<slug>.md` follows this shape:

\`\`\`markdown
# Build — <intent> — <YYYY-MM-DD HH:MM>

Spec: <path>

## Creates

### 1. <kind>: <name>
- Tool: `mcp__meta-ads-write__create_ad`
- Request: { ... }
- Response: { id: "<new_id>", ... }
- Duration: <ms>ms

### 2. ...

## Summary

- Total creates: N
- Successful: M
- Failed: K
- Total duration: <s>s
\`\`\`

## Outputs

- `specs/builds/<today>-<slug>.yml` — the spec (committed)
- `reports/builds/<today>-<slug>.md` — the execution log (committed)

## Failure modes

- **Spec invalid (zod fails):** surface the error path; ask the operator to fix the spec or describe a different change.
- **Parent ID not found in dry-run:** halt before any mutation. Tell the operator the missing ID; suggest they check Ads Manager.
- **Local asset missing:** halt before any mutation. List the missing file paths.
- **Mid-execution Graph API error:** halt. Delete the marker. Report what was created. The operator edits the spec to remove completed entries and re-runs.
- **Operator killed the skill mid-run:** the marker is left behind. Self-expires in 1 hour, or operator runs `rm .build-ads-active` to clean up sooner. Ads Manager is the source of truth for partial state.
- **Token expires <7 days:** warn but proceed (the operator may want to refresh first).

## What this skill must NOT do

- Execute mutations without the marker file (the `PreToolUse` hook would block anyway, but the skill should never try).
- Skip the dry-run preview, even on a "small" spec.
- Auto-set `status: ACTIVE` on creates. Default is PAUSED; the operator must explicitly opt in via the spec.
- Roll back a partial run. v1 is operator-cleanup-only.
- Leave the `.build-ads-active` marker behind on a successful or failed run. (The "killed mid-run" case is the only way it persists.)
- Make recommendations. This skill *executes* what the operator approves; it does not suggest.
```

- [ ] **Step 2: Verify the file**

Run: `head -20 .claude/skills/build-ads/SKILL.md`
Expected: prints the frontmatter and intro.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/build-ads/SKILL.md
git commit -m "feat(skill): add /build-ads skill for controlled Meta ad mutations

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Wire the second MCP server in `.mcp.json` and create empty output directories

**Files:**
- Modify: `.mcp.json`
- Create: `specs/builds/.gitkeep`
- Create: `reports/builds/.gitkeep`

**Pre-task note:** `.mcp.json` was previously deleted from the working tree (it contained live secrets). The user will need to recreate it from `.mcp.json.example` with their real env values before this task — but this task documents what the final shape should be.

- [ ] **Step 1: Confirm `.mcp.json.example` exists and read it**

Run: `cat .mcp.json.example`
Expected: shows the example with `${META_ACCESS_TOKEN}` placeholders.

- [ ] **Step 2: Update `.mcp.json` (or `.mcp.json.example` if `.mcp.json` is gitignored) to add the second server**

The new `.mcp.json` shape (preserving env-var references; the operator's actual `.mcp.json` substitutes real values):

```json
{
  "mcpServers": {
    "meta-ads": {
      "command": "npx",
      "args": ["-y", "meta-ads-mcp"],
      "env": {
        "META_ACCESS_TOKEN": "${META_ACCESS_TOKEN}",
        "META_AD_ACCOUNT_ID": "${META_AD_ACCOUNT_ID}"
      }
    },
    "meta-ads-write": {
      "command": "node",
      "args": ["./tools/meta-ads-write/dist/index.js"],
      "env": {
        "META_ACCESS_TOKEN": "${META_ACCESS_TOKEN}",
        "META_AD_ACCOUNT_ID": "${META_AD_ACCOUNT_ID}"
      }
    }
  }
}
```

Update `.mcp.json.example` to match this shape (for the operator to copy from).

- [ ] **Step 3: Create the spec/build log directories with .gitkeep**

```bash
mkdir -p specs/builds reports/builds
touch specs/builds/.gitkeep reports/builds/.gitkeep
```

- [ ] **Step 4: Verify**

Run: `ls specs/builds/ reports/builds/ && cat .mcp.json.example`
Expected: both `.gitkeep` files visible; example shows both server entries.

- [ ] **Step 5: Commit**

```bash
git add .mcp.json.example specs/builds/.gitkeep reports/builds/.gitkeep
git commit -m "feat: register meta-ads-write server and add build output dirs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Update `.claude/settings.json` (move tools, add hook, add Bash perms)

**Files:**
- Modify: `.claude/settings.json`

This task moves write tools from `deny` to `allow`, adds `mcp__meta-ads-write__*` tools to `allow`, adds the `PreToolUse` hook, and adds Bash permissions for the marker-file operations.

- [ ] **Step 1: Replace `.claude/settings.json` with the updated content**

Replace the entire file with:

```json
{
  "permissions": {
    "allow": [
      "mcp__meta-ads__health_check",
      "mcp__meta-ads__get_ad_accounts",
      "mcp__meta-ads__get_campaigns",
      "mcp__meta-ads__get_campaign",
      "mcp__meta-ads__get_insights",
      "mcp__meta-ads__get_audience_info",
      "mcp__meta-ads__get_token_info",
      "mcp__meta-ads__list_ad_sets",
      "mcp__meta-ads__list_ads",
      "mcp__meta-ads__list_audiences",
      "mcp__meta-ads__list_ad_creatives",
      "mcp__meta-ads__list_creatives",
      "mcp__meta-ads__compare_performance",
      "mcp__meta-ads__export_insights",
      "mcp__meta-ads__diagnose_campaign_readiness",
      "mcp__meta-ads__check_account_setup",
      "mcp__meta-ads__create_campaign",
      "mcp__meta-ads__update_campaign",
      "mcp__meta-ads__pause_campaign",
      "mcp__meta-ads__resume_campaign",
      "mcp__meta-ads__create_ad_set",
      "mcp__meta-ads__create_ad_creative",
      "mcp__meta-ads__create_custom_audience",
      "mcp__meta-ads__create_lookalike_audience",
      "mcp__meta-ads-write__create_ad",
      "mcp__meta-ads-write__update_ad",
      "mcp__meta-ads-write__pause_ad",
      "mcp__meta-ads-write__resume_ad",
      "mcp__meta-ads-write__pause_adset",
      "mcp__meta-ads-write__resume_adset",
      "mcp__meta-ads-write__update_adset",
      "mcp__meta-ads-write__upload_video",
      "mcp__meta-ads-write__upload_image",
      "mcp__meta-ads-write__delete_ad",
      "Read",
      "Write",
      "Edit",
      "Bash(mkdir:*)",
      "Bash(date:*)",
      "Bash(touch:*)",
      "Bash(rm:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)"
    ],
    "deny": []
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__meta-ads__(create|update|pause|resume)_.*|mcp__meta-ads-write__.*",
        "command": "find .build-ads-active -mmin -60 2>/dev/null | grep -q . || { echo 'Write tool blocked: /build-ads not active. Run /build-ads to authorize writes.' >&2; exit 1; }"
      }
    ]
  }
}
```

- [ ] **Step 2: Validate the JSON parses**

Run: `python3 -m json.tool .claude/settings.json > /dev/null && echo "valid JSON"`
Expected: `valid JSON`.

- [ ] **Step 3: Test the hook command in isolation (marker missing — should block)**

Run: `find .build-ads-active -mmin -60 2>/dev/null | grep -q . || { echo blocked; exit 1; }; echo allowed`
Expected: prints `blocked` (because `.build-ads-active` doesn't exist).

- [ ] **Step 4: Test the hook command (marker present — should allow)**

Run: `touch .build-ads-active && find .build-ads-active -mmin -60 2>/dev/null | grep -q . && echo allowed; rm -f .build-ads-active`
Expected: prints `allowed`.

- [ ] **Step 5: Commit**

```bash
git add .claude/settings.json
git commit -m "feat(settings): allow write tools and add PreToolUse marker-file hook

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Add safety-gate regression tests

**Files:**
- Create: `tools/meta-ads-write/src/__tests__/safety-gates.test.ts`

Validates three things:
1. `.claude/settings.json` `PreToolUse` hook references the right matcher and marker file.
2. Read SKILL.md files do not reference any `mcp__meta-ads-write__` or `mcp__meta-ads__create_` tool.
3. The example spec in `prompts/build-spec-schema.md` round-trips through the zod schema.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { buildSpecSchema } from "../spec-schema.js";

const REPO_ROOT = resolve(__dirname, "../../../..");

function readRepo(relpath: string): string {
  return readFileSync(join(REPO_ROOT, relpath), "utf-8");
}

describe("safety gates", () => {
  it("settings.json PreToolUse hook matches write tools and checks the marker file", () => {
    const settings = JSON.parse(readRepo(".claude/settings.json"));
    const hook = settings.hooks?.PreToolUse?.[0];
    expect(hook).toBeDefined();
    expect(hook.matcher).toMatch(/mcp__meta-ads__\(create\|update\|pause\|resume\)_/);
    expect(hook.matcher).toMatch(/mcp__meta-ads-write__/);
    expect(hook.command).toContain(".build-ads-active");
    expect(hook.command).toMatch(/-mmin -60/);
  });

  it("read skills never reference write tools", () => {
    const readSkills = [
      ".claude/skills/weekly-report/SKILL.md",
      ".claude/skills/monthly-report/SKILL.md",
      ".claude/skills/show-report/SKILL.md",
      ".claude/skills/pacing-check/SKILL.md",
    ];
    const forbiddenInProcedure = /^[^#].*\bmcp__meta-ads-write__\w+(?!\s*tool\.)/m;
    // Allow mentions in "must NOT" lists; flag mentions in procedure sections.
    for (const path of readSkills) {
      const content = readRepo(path);
      const procedureSection = content.split(/^## What this skill must NOT do/m)[0];
      expect(
        procedureSection,
        `${path} must not reference write tools in its procedure section`,
      ).not.toMatch(/mcp__meta-ads-write__|mcp__meta-ads__create_|mcp__meta-ads__update_|mcp__meta-ads__pause_|mcp__meta-ads__resume_/);
    }
  });

  it("the example spec in prompts/build-spec-schema.md round-trips through the schema", () => {
    const md = readRepo("prompts/build-spec-schema.md");
    // Find the last fenced yaml block (the full example).
    const blocks = [...md.matchAll(/```yaml\n([\s\S]*?)```/g)];
    expect(blocks.length).toBeGreaterThan(0);
    const lastYaml = blocks[blocks.length - 1][1];
    const parsed = parseYaml(lastYaml);
    const validated = buildSpecSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Example spec failed validation: ${validated.error.message}`);
    }
  });
});
```

- [ ] **Step 2: Add `yaml` to package.json `dependencies`**

```bash
cd tools/meta-ads-write && npm install --save yaml@^2.4.0
```

- [ ] **Step 3: Run the test to verify it fails (or passes if all prior tasks are done)**

Run: `cd tools/meta-ads-write && npm test`
Expected:
- If Tasks 12, 13, 14, 16 are complete: tests pass.
- If any are missing: targeted failures pointing at what's missing.

- [ ] **Step 4: If failing because prior tasks not yet complete, complete them; otherwise proceed**

(This is the regression-test layer; if any earlier task left a gap it surfaces here.)

- [ ] **Step 5: Commit**

```bash
git add tools/meta-ads-write/src/__tests__/safety-gates.test.ts tools/meta-ads-write/package.json tools/meta-ads-write/package-lock.json
git commit -m "test(meta-ads-write): add safety-gate regression tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Update `docs/architecture.md` and `README.md`

**Files:**
- Modify: `docs/architecture.md`
- Modify: `README.md`

- [ ] **Step 1: Rewrite the "Suggest-only enforcement" section in `docs/architecture.md`**

Locate the section "Suggest-only enforcement (defense in depth)" (around line 87). Replace its content with:

```markdown
## Read/write surface split

The project has two surfaces:

**Read skills** — `/weekly-report`, `/monthly-report`, `/show-report`, `/pacing-check`. Suggest-only by construction. Three independent layers enforce this:

1. The `PreToolUse` hook in `.claude/settings.json` blocks every `mcp__meta-ads__create_*` / `update_*` / `pause_*` / `resume_*` tool and every `mcp__meta-ads-write__*` tool unless the marker file `.build-ads-active` exists and is younger than 1 hour. Read skills never create the marker.
2. Each read SKILL.md ends with a "What this skill must NOT do" section that enumerates every forbidden write tool by name.
3. `prompts/recommendation-rubric.md` anti-rule #3 forbids recommending creation of new campaigns/ad sets/ads/creatives; anti-rule #5 forbids recommending "use /build-ads to do X."

**Write skill** — `/build-ads`. The only skill that mutates the ad account. Three independent layers enforce safe execution:

1. The operator must explicitly invoke `/build-ads`. The skill creates `.build-ads-active` at start (`Bash(touch .build-ads-active)`) and deletes it at end (`Bash(rm -f .build-ads-active)`). The marker self-expires after 1 hour to limit blast radius if the skill is killed mid-run.
2. Every run produces a YAML spec at `specs/builds/<date>-<slug>.yml` that the operator must approve before execution.
3. A read-only dry-run preview resolves all parent IDs, validates assets, and asks for one final confirmation before any mutation.

Removing any one layer of either surface weakens but does not break the guarantee. Adding new write tools to either surface is a deliberate, multi-step change documented in `tools/meta-ads-write/README.md` and `references/build-safety.md`.
```

Also replace the row in the "Component inventory" table that references settings.json's deny-list with:

```markdown
| `.claude/settings.json` | Permission allow list and `PreToolUse` hook gating writes on `.build-ads-active` | Adding a new tool to the allow list, or modifying the hook scope |
```

Add new rows after the existing inventory table:

```markdown
| `tools/meta-ads-write/` | Sibling MCP server providing the 10 gap tools `meta-ads-mcp` doesn't expose | New write tool, schema change, or rate-limit tuning |
| `.claude/skills/build-ads/SKILL.md` | The mutation surface skill | Tuning the build-ads procedure |
| `prompts/build-spec-schema.md` | Canonical YAML build-spec format | Adding a new `kind` or creative shape |
| `references/build-safety.md` | Operator-facing safety rules and recovery scenarios | Updating recovery procedures |
| `specs/builds/` | Generated build specs (committed) | Every `/build-ads` run |
| `reports/builds/` | Generated build logs (committed) | Every `/build-ads` run |
| `.build-ads-active` (gitignored) | Marker file that authorizes writes; created by `/build-ads`, removed at end | Never edited by hand |
```

- [ ] **Step 2: Update `README.md`**

In `README.md`, find the bullet list that says:

```
- **Will:** read campaigns, ad sets, ads, creatives, audiences, and insights; write Markdown reports under `reports/`.
- **Won't:** create, update, pause, resume, or otherwise modify anything in your ad account. `.claude/settings.json` denies the relevant tools, and every `SKILL.md` documents this restriction.
```

Replace with:

```
- **Read skills will:** read campaigns, ad sets, ads, creatives, audiences, and insights; write Markdown reports under `reports/`. They cannot mutate.
- **`/build-ads` will:** create campaigns / ad sets / ads / creatives / audiences, and pause/resume/update existing ones — but only after drafting a YAML spec, getting your approval, and showing a dry-run preview. See `references/build-safety.md` for the full rules.
- **Suggest-only enforcement** for read skills is layered: a `PreToolUse` hook on a marker file, explicit forbidden-tool lists in each `SKILL.md`, and rubric anti-rules. See `docs/architecture.md` for how the layers compose.
```

Add a new section after "What the skills will and won't do":

```markdown
## Building ads with `/build-ads`

`/build-ads` is the project's mutation surface. It works in four phases:

1. **Conversational draft.** You describe what you want; the skill drafts a YAML spec at `specs/builds/<date>-<slug>.yml`.
2. **Spec review.** You read the spec (in chat or by opening the file) and either say "execute" or describe changes.
3. **Dry-run preview.** The skill resolves parent IDs, validates assets, and shows what will be created — including a prominent "New live ads: N" line if any creates have `status: ACTIVE`. New ads default to `PAUSED`.
4. **Execution.** Tools are called in spec order. Each call is logged to `reports/builds/<date>-<slug>.md`. On any error, the run halts and reports partial state — there's no automatic rollback.

For the full spec format, see `prompts/build-spec-schema.md`. For safety rules and recovery scenarios, see `references/build-safety.md`.
```

Update the "Setup" section to add a step for building the local MCP server:

After the "Install Node.js" bullet (currently step 3), insert:

```markdown
4. **Build the local write MCP:**

   ```bash
   cd tools/meta-ads-write
   npm install
   npm run build
   cd -
   ```
```

(And renumber the subsequent steps.)

- [ ] **Step 3: Verify the edits**

Run: `grep -c "build-ads" docs/architecture.md README.md`
Expected: at least 5 matches in each file.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md README.md
git commit -m "docs: document /build-ads surface and read/write split

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Final integration check

**Files:**
- (read-only) Run end-to-end checks against the now-complete repo.

- [ ] **Step 1: Run all tests in the new MCP package**

Run: `cd tools/meta-ads-write && npm test`
Expected: All ~28 tests pass (4 meta-api + 3 create-ad + 2 update-ad + 4 pause-resume + 2 update-adset + 3 upload-asset + 1 delete-ad + 1 index + 4 spec-schema + 3 safety-gates).

- [ ] **Step 2: Run the smoke script**

Run: `cd tools/meta-ads-write && npm run build && npm run smoke`
Expected: `SMOKE OK — 10 tools registered`.

- [ ] **Step 3: Validate the JSON files**

```bash
python3 -m json.tool .claude/settings.json > /dev/null && echo "settings.json valid"
python3 -m json.tool .mcp.json.example > /dev/null && echo "mcp.json.example valid"
```

Expected: both valid lines print.

- [ ] **Step 4: Manual hook test**

```bash
touch .build-ads-active
find .build-ads-active -mmin -60 2>/dev/null | grep -q . && echo "would allow"
rm .build-ads-active
find .build-ads-active -mmin -60 2>/dev/null | grep -q . || echo "would block"
```

Expected: `would allow` then `would block`.

- [ ] **Step 5: Verify all spec sections have task coverage**

Open `docs/superpowers/specs/2026-05-08-meta-ad-write-tools-design.md` and confirm:

- Repo layout (Section: Architecture / Repo layout) → Tasks 1, 9, 11, 14, 15
- 10-tool surface → Tasks 3–9
- Workflow → Task 14
- YAML spec format → Tasks 10, 11
- Sibling MCP server internals → Tasks 1, 2, 9
- Safety updates (settings.json, rubric, SKILL.md, architecture, README) → Tasks 12, 13, 16, 18
- Tests → Tasks 2, 3, 4, 5, 6, 7, 8, 9, 10, 17

- [ ] **Step 6: Commit (no-op if nothing changed)**

```bash
git status
# If nothing modified: skip the commit and proceed.
```

---

## Self-review (run by writer of plan)

**Spec coverage:**
- Decisions 1–9 from the spec → all map to tasks. ✓
- Repo-layout entries (new files) → all in Tasks 1, 9–17. ✓
- Modified files (mcp.json, settings.json, rubric, read SKILL.md, architecture, README) → Tasks 12, 13, 15, 16, 18. ✓
- Workflow steps in spec → Task 14 implements them. ✓
- 10-tool surface → Tasks 3–8. ✓
- Test plan from spec → Tasks 2, 17, 19. ✓
- Risks table → mitigations are baked into the workflow (status default PAUSED, dry-run, marker mtime check, build log) — Tasks 14, 16. ✓
- Out of scope items (idempotency, rollback, live integration tests, carousels, bulk edits, cross-account) → not implemented; documented in build-safety.md (Task 11). ✓

**Placeholder scan:**
- No "TBD" / "TODO" / "fill in details" anywhere. ✓
- All test code shown in full. ✓
- All implementation code shown in full. ✓

**Type consistency:**
- `MetaApi` constructor signature matches across Tasks 2, 3, 4, 5, 6, 7, 8, 9. ✓
- Tool name strings (`create_ad`, `update_ad`, etc.) match between Task 9's expected list and the per-tool tasks. ✓
- `MetaApiResult<T>` discriminated union matches across all tools. ✓
- The `accountPath` helper used in Tasks 3, 7 is defined in Task 2's `meta-api.ts`. ✓

No issues found.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-08-meta-ad-write-tools.md`.
