import { MetaApi } from "../src/meta-api.js";

interface AdVideo {
  id: string;
  title?: string;
  description?: string;
  created_time?: string;
  length?: number;
}

interface VideosResponse {
  data: AdVideo[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

async function main(): Promise<void> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken || !accountId) {
    console.error("META_ACCESS_TOKEN and META_AD_ACCOUNT_ID must be set in the environment");
    process.exit(2);
  }

  const limitArg = process.argv[2];
  const limit = limitArg ? Number.parseInt(limitArg, 10) : 25;
  if (Number.isNaN(limit) || limit < 1 || limit > 100) {
    console.error("Usage: npm run list-videos -- [limit 1-100, default 25]");
    process.exit(2);
  }

  const api = new MetaApi({ accessToken, accountId });
  const result = await api.get<VideosResponse>(
    `/${api.accountPath}/advideos?limit=${limit}`,
    ["id", "title", "description", "created_time", "length"],
  );

  if (!result.ok) {
    console.error(`Graph API error: ${result.error.message} (code ${result.error.code})`);
    process.exit(1);
  }

  const videos = result.data.data ?? [];
  console.log(`Found ${videos.length} video(s) in account ${api.accountPath}`);
  console.log("");

  videos.forEach((v, i) => {
    console.log(`  [${i + 1}] ${v.id}`);
    if (v.title) console.log(`      title:   ${v.title}`);
    if (v.description) console.log(`      desc:    ${v.description.slice(0, 120)}${v.description.length > 120 ? "..." : ""}`);
    if (v.created_time) console.log(`      created: ${v.created_time}`);
    if (typeof v.length === "number") console.log(`      length:  ${v.length}s`);
    console.log("");
  });

  if (result.data.paging?.next) {
    console.log(`(more results available — increase limit or paginate)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
