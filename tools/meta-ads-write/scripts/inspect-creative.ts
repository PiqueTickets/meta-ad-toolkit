import { MetaApi } from "../src/meta-api.js";

interface VideoData {
  video_id?: string;
  title?: string;
  message?: string;
  call_to_action?: { type?: string; value?: { link?: string } };
}

interface ChildAttachment extends VideoData {
  link?: string;
  name?: string;
  description?: string;
}

interface ObjectStorySpec {
  page_id?: string;
  video_data?: VideoData;
  link_data?: {
    link?: string;
    message?: string;
    name?: string;
    description?: string;
    child_attachments?: ChildAttachment[];
    call_to_action?: { type?: string };
  };
}

interface AssetFeedSpec {
  videos?: Array<{ video_id?: string; thumbnail_url?: string; thumbnail_hash?: string }>;
  bodies?: Array<{ text?: string }>;
  titles?: Array<{ text?: string }>;
  link_urls?: Array<{ website_url?: string; display_url?: string }>;
  call_to_action_types?: string[];
}

interface CreativeResponse {
  id: string;
  name?: string;
  object_story_spec?: ObjectStorySpec;
  asset_feed_spec?: AssetFeedSpec;
}

async function main(): Promise<void> {
  const creativeId = process.argv[2];
  if (!creativeId) {
    console.error("Usage: npm run inspect-creative <creative_id>");
    process.exit(2);
  }
  const accessToken = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken || !accountId) {
    console.error("META_ACCESS_TOKEN and META_AD_ACCOUNT_ID must be set in the environment");
    process.exit(2);
  }

  const api = new MetaApi({ accessToken, accountId });
  const result = await api.get<CreativeResponse>(`/${creativeId}`, [
    "id",
    "name",
    "object_story_spec",
    "asset_feed_spec",
  ]);

  if (!result.ok) {
    console.error(`Graph API error: ${result.error.message} (code ${result.error.code})`);
    process.exit(1);
  }

  const c = result.data;
  console.log(`Creative: ${c.id}${c.name ? ` — ${c.name}` : ""}`);
  console.log("");

  const videos: Array<{ source: string; video_id: string; title?: string; message?: string }> = [];

  const single = c.object_story_spec?.video_data;
  if (single?.video_id) {
    videos.push({
      source: "object_story_spec.video_data",
      video_id: single.video_id,
      title: single.title,
      message: single.message,
    });
  }

  const children = c.object_story_spec?.link_data?.child_attachments ?? [];
  children.forEach((child, i) => {
    if (child.video_id) {
      videos.push({
        source: `object_story_spec.link_data.child_attachments[${i}]`,
        video_id: child.video_id,
        title: child.name,
        message: child.description,
      });
    }
  });

  const feedVideos = c.asset_feed_spec?.videos ?? [];
  feedVideos.forEach((v, i) => {
    if (v.video_id) {
      videos.push({
        source: `asset_feed_spec.videos[${i}]`,
        video_id: v.video_id,
      });
    }
  });

  if (videos.length === 0) {
    console.log("No video IDs found in this creative.");
    console.log("Raw response:");
    console.log(JSON.stringify(c, null, 2));
    return;
  }

  console.log(`Found ${videos.length} video reference(s):`);
  videos.forEach((v, i) => {
    console.log("");
    console.log(`  [${i + 1}] ${v.video_id}`);
    console.log(`      source: ${v.source}`);
    if (v.title) console.log(`      title:  ${v.title}`);
    if (v.message) console.log(`      message: ${v.message.slice(0, 120)}${v.message.length > 120 ? "..." : ""}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
