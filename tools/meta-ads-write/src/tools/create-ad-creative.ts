import { z } from "zod";
import type { MetaApi, MetaApiResult } from "../meta-api.js";

const ctaTypeSchema = z.enum([
  "GET_TICKETS",
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "BOOK_TRAVEL",
  "DOWNLOAD",
]);

export const createAdCreativeInputSchema = z.object({
  name: z.string().min(1),
  page_id: z.string().min(1),
  instagram_user_id: z.string().min(1).optional(),
  video_id: z.string().min(1),
  image_hash: z.string().min(1).optional(),
  image_url: z.string().url().optional(),
  headline: z.string().min(1),
  body: z.string().min(1),
  link_description: z.string().min(1).optional(),
  cta_type: ctaTypeSchema,
  link_url: z.string().url(),
});

export type CreateAdCreativeInput = z.infer<typeof createAdCreativeInputSchema>;

export const createAdCreativeTool = {
  name: "create_ad_creative",
  description:
    "Create a Meta video ad creative with full object_story_spec (page_id, instagram_user_id, video_data with title/message/link_description/call_to_action). Required for parity with manually-built creatives.",
  inputSchema: createAdCreativeInputSchema,

  async handler(
    input: CreateAdCreativeInput,
    api: MetaApi,
  ): Promise<MetaApiResult<{ id: string }>> {
    const videoData: Record<string, unknown> = {
      video_id: input.video_id,
      title: input.headline,
      message: input.body,
      call_to_action: {
        type: input.cta_type,
        value: { link: input.link_url },
      },
    };
    if (input.link_description) videoData.link_description = input.link_description;
    if (input.image_hash) videoData.image_hash = input.image_hash;
    if (input.image_url) videoData.image_url = input.image_url;

    const objectStorySpec: Record<string, unknown> = {
      page_id: input.page_id,
      video_data: videoData,
    };
    if (input.instagram_user_id) objectStorySpec.instagram_user_id = input.instagram_user_id;

    return api.post(`/${api.accountPath}/adcreatives`, {
      name: input.name,
      object_story_spec: objectStorySpec,
    });
  },
};
