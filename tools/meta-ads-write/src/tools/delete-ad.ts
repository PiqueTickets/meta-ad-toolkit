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
    if (input.confirm !== true) {
      return {
        ok: false,
        error: {
          message: "delete_ad refused: confirm must be true",
          code: -3,
          type: "ConfirmationRequired",
          retryable: false,
        },
      };
    }
    return api.delete(`/${input.ad_id}`);
  },
};
