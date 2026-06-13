import { z } from "zod";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

// Read-only identity/pixel lookups. These help resolve the page_id,
// instagram_user_id, and pixel_id needed to build a campaign — values that
// aren't otherwise discoverable through the toolkit.

export const listPagesInputSchema = z.object({}).strict();
export type ListPagesInput = z.infer<typeof listPagesInputSchema>;

export const listPagesTool = {
  name: "list_pages",
  description:
    "List Facebook Pages the access token can manage, including any linked Instagram " +
    "account (id + username). Read-only — use to resolve page_id / instagram_user_id.",
  inputSchema: listPagesInputSchema,

  async handler(_input: ListPagesInput, api: MetaApi): Promise<MetaApiResult<unknown>> {
    return api.get(`/me/accounts`, [
      "id",
      "name",
      "instagram_business_account{id,username}",
    ]);
  },
};

export const listPixelsInputSchema = z.object({}).strict();
export type ListPixelsInput = z.infer<typeof listPixelsInputSchema>;

export const listPixelsTool = {
  name: "list_pixels",
  description:
    "List Meta Pixels on the configured ad account (id + name + last-fired time). " +
    "Read-only — use to resolve the pixel_id for an ad set's promoted_object.",
  inputSchema: listPixelsInputSchema,

  async handler(_input: ListPixelsInput, api: MetaApi): Promise<MetaApiResult<unknown>> {
    return api.get(`/${api.accountPath}/adspixels`, [
      "id",
      "name",
      "last_fired_time",
    ]);
  },
};
