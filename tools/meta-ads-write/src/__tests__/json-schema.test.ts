import { describe, it, expect } from "vitest";
import { toInputSchema } from "../index.js";
import { createAdInputSchema } from "../tools/create-ad.js";

describe("toInputSchema", () => {
  it("emits real properties for the create_ad schema", () => {
    const js = toInputSchema(createAdInputSchema) as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(js.type).toBe("object");
    expect(js.properties).toBeDefined();
    expect(Object.keys(js.properties ?? {})).toEqual(
      expect.arrayContaining(["adset_id", "creative_id", "name", "status"]),
    );
    expect(js.required ?? []).toEqual(
      expect.arrayContaining(["adset_id", "creative_id", "name"]),
    );
  });
});
