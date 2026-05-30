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
