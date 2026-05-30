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
