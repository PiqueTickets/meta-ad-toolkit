#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { MetaApi, type MetaApiResult } from "./meta-api.js";
import { createAdTool } from "./tools/create-ad.js";
import { createAdCreativeTool } from "./tools/create-ad-creative.js";
import { updateAdTool } from "./tools/update-ad.js";
import {
  pauseAdTool,
  resumeAdTool,
  pauseAdsetTool,
  resumeAdsetTool,
} from "./tools/pause-resume.js";
import { updateAdsetTool } from "./tools/update-adset.js";
import { uploadVideoTool, uploadImageTool } from "./tools/upload-asset.js";
import { deleteAdTool } from "./tools/delete-ad.js";
import { listPagesTool, listPixelsTool } from "./tools/list-assets.js";
import { pixelHealthTool } from "./tools/pixel-health.js";

interface ToolDef<I> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  handler: (input: I, api: MetaApi) => Promise<MetaApiResult<unknown>>;
}

const TOOLS: ToolDef<unknown>[] = [
  createAdTool,
  createAdCreativeTool,
  updateAdTool,
  pauseAdTool,
  resumeAdTool,
  pauseAdsetTool,
  resumeAdsetTool,
  updateAdsetTool,
  uploadVideoTool,
  uploadImageTool,
  deleteAdTool,
  listPagesTool,
  listPixelsTool,
  pixelHealthTool,
] as ToolDef<unknown>[];

export function listToolNames(): string[] {
  return TOOLS.map((t) => t.name);
}

export async function dispatchToolCall(
  name: string,
  args: unknown,
  api: MetaApi,
): Promise<CallToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }
  const result = await tool.handler(parsed.data, api);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: result.ok === false,
  };
}

function buildApi(): MetaApi {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accessToken) throw new Error("META_ACCESS_TOKEN not set");
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID not set");
  return new MetaApi({ accessToken, accountId });
}

async function main(): Promise<void> {
  const api = buildApi();
  const server = new Server(
    { name: "meta-ads-write", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: toInputSchema(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, (req) =>
    dispatchToolCall(req.params.name, req.params.arguments, api),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("meta-ads-write server connected");
}

export function toInputSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  const json = zodToJsonSchema(schema, { target: "jsonSchema7", $refStrategy: "none" });
  return json as Record<string, unknown>;
}

if (process.argv[1]?.endsWith("index.js")) {
  main().catch((e) => {
    console.error("startup error:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
