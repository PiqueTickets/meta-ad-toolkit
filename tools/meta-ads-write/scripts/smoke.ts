import { listToolNames } from "../src/index.js";

const expected = [
  "create_ad",
  "delete_ad",
  "pause_ad",
  "pause_adset",
  "resume_ad",
  "resume_adset",
  "update_ad",
  "update_adset",
  "upload_image",
  "upload_video",
];

const actual = listToolNames().sort();
const missing = expected.filter((n) => !actual.includes(n));
if (missing.length > 0) {
  console.error(`SMOKE FAIL — missing tools: ${missing.join(", ")}`);
  process.exit(1);
}
console.error(`SMOKE OK — ${actual.length} tools registered`);
