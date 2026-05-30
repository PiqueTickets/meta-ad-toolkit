import { z } from "zod";

const ctaTypeSchema = z.enum([
  "GET_TICKETS",
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "BOOK_TRAVEL",
  "DOWNLOAD",
]);

const videoCreativeSchema = z
  .object({
    kind: z.literal("video"),
    video_file: z.string().min(1).optional(),
    video_id: z.string().min(1).optional(),
    thumbnail_file: z.string().optional(),
    headline: z.string().min(1),
    body: z.string().min(1),
    link_description: z.string().min(1).optional(),
    cta_type: ctaTypeSchema,
    link_url: z.string().url(),
  })
  .strict();

const imageCreativeSchema = z
  .object({
    kind: z.literal("image"),
    image_file: z.string().min(1),
    headline: z.string().min(1),
    body: z.string().min(1),
    cta_type: ctaTypeSchema,
    link_url: z.string().url(),
  })
  .strict();

const creativeSchema = z.discriminatedUnion("kind", [videoCreativeSchema, imageCreativeSchema]);

const adCreateSchema = z
  .object({
    kind: z.literal("ad"),
    parent_adset_id: z.string().min(1),
    name: z.string().min(1),
    creative: creativeSchema,
    status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
  })
  .strict();

const adsetCreateSchema = z
  .object({
    kind: z.literal("ad_set"),
    parent_campaign_id: z.string().min(1),
    name: z.string().min(1),
    daily_budget_cents: z.number().int().positive().optional(),
    lifetime_budget_cents: z.number().int().positive().optional(),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    optimization_goal: z.string().min(1),
    status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
  })
  .strict();

const campaignCreateSchema = z
  .object({
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
  })
  .strict();

const audienceCreateSchema = z
  .object({
    kind: z.literal("audience"),
    name: z.string().min(1),
    audience_type: z.enum(["custom", "lookalike"]),
  })
  .strict();

const creativeOnlyCreateSchema = z
  .object({
    kind: z.literal("creative"),
    name: z.string().min(1),
    creative: creativeSchema,
  })
  .strict();

const createItemSchema = z
  .discriminatedUnion("kind", [
    campaignCreateSchema,
    adsetCreateSchema,
    adCreateSchema,
    creativeOnlyCreateSchema,
    audienceCreateSchema,
  ])
  .superRefine((item, ctx) => {
    if (item.kind === "ad_set") {
      const hasDaily = item.daily_budget_cents !== undefined;
      const hasLifetime = item.lifetime_budget_cents !== undefined;
      if (hasDaily === hasLifetime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ad_set must set exactly one of daily_budget_cents or lifetime_budget_cents",
        });
      }
    }
    if (item.kind === "ad" || item.kind === "creative") {
      const c = item.creative;
      if (c.kind === "video") {
        const hasFile = c.video_file !== undefined;
        const hasId = c.video_id !== undefined;
        if (hasFile === hasId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["creative"],
            message: "video creative must set exactly one of video_file or video_id",
          });
        }
      }
    }
  });

const preflightSchema = z.array(
  z.union([
    z.object({ parent_adset_must_exist: z.string().min(1) }).strict(),
    z.object({ parent_adset_must_be_active: z.boolean() }).strict(),
    z.object({ assets_must_exist: z.boolean() }).strict(),
  ]),
);

export const buildSpecSchema = z
  .object({
    version: z.literal(1),
    intent: z.string().min(1),
    account_id: z.string().regex(/^act_\d+$/),
    page_id: z.string().min(1).optional(),
    instagram_user_id: z.string().min(1).optional(),
    creates: z.array(createItemSchema),
    preflight: preflightSchema.optional(),
  })
  .strict();

export type BuildSpec = z.infer<typeof buildSpecSchema>;
