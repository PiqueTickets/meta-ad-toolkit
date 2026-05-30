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

  it("rejects unknown keys on a create item (catches operator typos)", () => {
    const spec = {
      version: 1,
      intent: "x",
      account_id: "act_1",
      creates: [
        {
          kind: "ad",
          parent_adset_id: "a",
          name: "n",
          headlne: "typo here",
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
    expect(buildSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("rejects an ad_set with neither budget set", () => {
    const spec = {
      version: 1,
      intent: "x",
      account_id: "act_1",
      creates: [
        {
          kind: "ad_set",
          parent_campaign_id: "c",
          name: "n",
          start_time: "2026-05-10",
          end_time: "2026-05-20",
          optimization_goal: "OFFSITE_CONVERSIONS",
        },
      ],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("rejects an ad_set with both budgets set", () => {
    const spec = {
      version: 1,
      intent: "x",
      account_id: "act_1",
      creates: [
        {
          kind: "ad_set",
          parent_campaign_id: "c",
          name: "n",
          daily_budget_cents: 1000,
          lifetime_budget_cents: 50000,
          start_time: "2026-05-10",
          end_time: "2026-05-20",
          optimization_goal: "OFFSITE_CONVERSIONS",
        },
      ],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("accepts a video creative referenced by video_id (no upload needed)", () => {
    const spec = {
      version: 1,
      intent: "Reuse existing carousel video",
      account_id: "act_0000000000000000",
      creates: [
        {
          kind: "ad",
          parent_adset_id: "adset_1",
          name: "SAMPLE - Video #2",
          creative: {
            kind: "video",
            video_id: "987654321",
            headline: "Sample Live",
            body: "Plain body",
            cta_type: "GET_TICKETS",
            link_url: "https://example.com/sample",
          },
          status: "PAUSED",
        },
      ],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(true);
  });

  it("rejects a video creative with both video_file and video_id", () => {
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
            kind: "video",
            video_file: "./v.mp4",
            video_id: "987654321",
            headline: "h",
            body: "b",
            cta_type: "GET_TICKETS",
            link_url: "https://example.com",
          },
        },
      ],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("rejects a video creative with neither video_file nor video_id", () => {
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
            kind: "video",
            headline: "h",
            body: "b",
            cta_type: "GET_TICKETS",
            link_url: "https://example.com",
          },
        },
      ],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("accepts top-level page_id and instagram_user_id", () => {
    const spec = {
      version: 1,
      intent: "x",
      account_id: "act_0000000000000000",
      page_id: "100000000000001",
      instagram_user_id: "17000000000000001",
      creates: [],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(true);
  });

  it("accepts a video creative with link_description", () => {
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
            kind: "video",
            video_id: "1",
            headline: "h",
            body: "b",
            link_description: "Doors 7 PM | Show 8 PM",
            cta_type: "LEARN_MORE",
            link_url: "https://example.com",
          },
        },
      ],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(true);
  });

  it("rejects a preflight item with unknown keys", () => {
    const spec = {
      version: 1,
      intent: "x",
      account_id: "act_1",
      creates: [],
      preflight: [{ parent_adset_must_exist: "adset_1", garbage: 1 }],
    };
    expect(buildSpecSchema.safeParse(spec).success).toBe(false);
  });
});
