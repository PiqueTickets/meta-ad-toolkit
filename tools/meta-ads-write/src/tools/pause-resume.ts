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
