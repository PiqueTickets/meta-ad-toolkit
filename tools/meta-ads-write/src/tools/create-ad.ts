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
