import { readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { parse } from "yaml";
import { MetaApi } from "../src/meta-api.js";
import { buildSpecSchema } from "../src/spec-schema.js";
import { createAdCreativeTool } from "../src/tools/create-ad-creative.js";
import { createAdTool } from "../src/tools/create-ad.js";
import { pauseAdTool } from "../src/tools/pause-resume.js";

interface Args {
  specPath: string;
  pauseAdId?: string;
  reportPath: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    throw new Error("Usage: run-spec <spec.yml> <report.md> [--pause-ad <ad_id>]");
  }
  const args: Args = { specPath: argv[0], reportPath: argv[1] };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--pause-ad" && argv[i + 1]) {
      args.pauseAdId = argv[i + 1];
      i++;
    }
  }
  return args;
}

function appendLog(reportPath: string, text: string): void {
  appendFileSync(reportPath, text + "\n");
}

async function main(): Promise<void> {
  const { specPath, pauseAdId, reportPath } = parseArgs();

  const accessToken = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken || !accountId) {
    throw new Error("META_ACCESS_TOKEN and META_AD_ACCOUNT_ID must be set");
  }
  const api = new MetaApi({ accessToken, accountId });

  const raw = readFileSync(resolve(specPath), "utf-8");
  const parsed = parse(raw);
  const validated = buildSpecSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Spec invalid: ${validated.error.message}`);
  }
  const spec = validated.data;

  const now = new Date().toISOString().replace(/\..*/, "Z");
  writeFileSync(reportPath, `# Build — ${spec.intent} — ${now}\n\nSpec: ${specPath}\n\n## Creates\n\n`);

  let stepNum = 0;
  let success = 0;
  let failed = 0;
  const startedAll = Date.now();

  for (const item of spec.creates) {
    if (item.kind !== "ad") {
      throw new Error(`Unsupported kind in this run: ${item.kind}`);
    }
    if (item.creative.kind !== "video") {
      throw new Error(`Only video creatives supported in this run`);
    }
    if (!item.creative.video_id) {
      throw new Error(`Creative for ${item.name} missing video_id (this run requires reused IDs)`);
    }
    if (!spec.page_id) {
      throw new Error(`spec.page_id is required for video creatives`);
    }

    const thumbRes = await api.get<{ id: string; picture?: string }>(
      `/${item.creative.video_id}`,
      ["id", "picture"],
    );
    if (!thumbRes.ok) {
      throw new Error(`Could not fetch thumbnail for video ${item.creative.video_id}: ${thumbRes.error.message}`);
    }
    const imageUrl = thumbRes.data.picture;
    if (!imageUrl) {
      throw new Error(`Video ${item.creative.video_id} has no picture (thumbnail) — Meta requires one`);
    }

    stepNum++;
    appendLog(reportPath, `### ${stepNum}. creative for ${item.name}`);
    const creativeStart = Date.now();
    const creativeReq = {
      name: item.name,
      page_id: spec.page_id,
      instagram_user_id: spec.instagram_user_id,
      video_id: item.creative.video_id,
      image_url: imageUrl,
      headline: item.creative.headline,
      body: item.creative.body,
      link_description: item.creative.link_description,
      cta_type: item.creative.cta_type,
      link_url: item.creative.link_url,
    };
    appendLog(reportPath, `- Tool: \`mcp__meta-ads-write__create_ad_creative\``);
    appendLog(reportPath, `- Request: \`\`\`json\n${JSON.stringify(creativeReq, null, 2)}\n\`\`\``);
    const creativeRes = await createAdCreativeTool.handler(
      createAdCreativeTool.inputSchema.parse(creativeReq),
      api,
    );
    appendLog(reportPath, `- Response: \`\`\`json\n${JSON.stringify(creativeRes, null, 2)}\n\`\`\``);
    appendLog(reportPath, `- Duration: ${Date.now() - creativeStart}ms\n`);
    if (!creativeRes.ok) {
      failed++;
      appendLog(reportPath, `\n❌ HALT — creative failed for ${item.name}`);
      console.error(`HALT — creative failed for ${item.name}: ${creativeRes.error.message}`);
      process.exit(1);
    }
    const creativeId = creativeRes.data.id;
    success++;

    stepNum++;
    appendLog(reportPath, `### ${stepNum}. ad: ${item.name}`);
    const adStart = Date.now();
    const adReq = {
      adset_id: item.parent_adset_id,
      creative_id: creativeId,
      name: item.name,
      status: item.status,
    };
    appendLog(reportPath, `- Tool: \`mcp__meta-ads-write__create_ad\``);
    appendLog(reportPath, `- Request: \`\`\`json\n${JSON.stringify(adReq, null, 2)}\n\`\`\``);
    const adRes = await createAdTool.handler(createAdTool.inputSchema.parse(adReq), api);
    appendLog(reportPath, `- Response: \`\`\`json\n${JSON.stringify(adRes, null, 2)}\n\`\`\``);
    appendLog(reportPath, `- Duration: ${Date.now() - adStart}ms\n`);
    if (!adRes.ok) {
      failed++;
      appendLog(reportPath, `\n❌ HALT — ad creation failed for ${item.name}`);
      console.error(`HALT — ad creation failed for ${item.name}: ${adRes.error.message}`);
      process.exit(1);
    }
    success++;
    console.log(`  ✓ ${item.name} → creative ${creativeId}, ad ${adRes.data.id}`);
  }

  if (pauseAdId) {
    stepNum++;
    appendLog(reportPath, `### ${stepNum}. side action: pause source ad`);
    const pauseStart = Date.now();
    const pauseReq = { ad_id: pauseAdId };
    appendLog(reportPath, `- Tool: \`mcp__meta-ads-write__pause_ad\``);
    appendLog(reportPath, `- Request: \`\`\`json\n${JSON.stringify(pauseReq, null, 2)}\n\`\`\``);
    const pauseRes = await pauseAdTool.handler(pauseAdTool.inputSchema.parse(pauseReq), api);
    appendLog(reportPath, `- Response: \`\`\`json\n${JSON.stringify(pauseRes, null, 2)}\n\`\`\``);
    appendLog(reportPath, `- Duration: ${Date.now() - pauseStart}ms\n`);
    if (!pauseRes.ok) {
      failed++;
      appendLog(reportPath, `\n⚠️ pause_ad failed (creates already succeeded — manual cleanup OK)`);
      console.error(`pause_ad failed: ${pauseRes.error.message}`);
    } else {
      success++;
      console.log(`  ✓ paused ${pauseAdId}`);
    }
  }

  const totalSec = ((Date.now() - startedAll) / 1000).toFixed(2);
  appendLog(reportPath, `## Summary\n`);
  appendLog(reportPath, `- Total operations: ${stepNum}`);
  appendLog(reportPath, `- Successful: ${success}`);
  appendLog(reportPath, `- Failed: ${failed}`);
  appendLog(reportPath, `- Total duration: ${totalSec}s`);
  if (failed === 0) appendLog(reportPath, `\n✅ All ${stepNum} operations succeeded`);

  console.log(`\nDone. ${success}/${stepNum} ops succeeded in ${totalSec}s. Report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
