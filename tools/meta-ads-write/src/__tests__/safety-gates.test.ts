import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { buildSpecSchema } from "../spec-schema.js";

const REPO_ROOT = resolve(__dirname, "../../../..");

function readRepo(relpath: string): string {
  return readFileSync(join(REPO_ROOT, relpath), "utf-8");
}

describe("safety gates", () => {
  it("settings.json PreToolUse hook matches write tools and checks the marker file", () => {
    const settings = JSON.parse(readRepo(".claude/settings.json"));
    const hook = settings.hooks?.PreToolUse?.[0];
    expect(hook).toBeDefined();
    expect(hook.matcher).toMatch(/mcp__meta-ads__\(create\|update\|pause\|resume\)_/);
    expect(hook.matcher).toMatch(/mcp__meta-ads-write__/);
    const command = hook.hooks?.[0]?.command;
    expect(command).toContain(".build-ads-active");
    expect(command).toMatch(/-mmin -60/);
  });

  it("read skills never reference write tools", () => {
    const readSkills = [
      ".claude/skills/weekly-report/SKILL.md",
      ".claude/skills/monthly-report/SKILL.md",
      ".claude/skills/show-report/SKILL.md",
      ".claude/skills/pacing-check/SKILL.md",
    ];
    for (const path of readSkills) {
      const content = readRepo(path);
      const procedureSection = content.split(/^## What this skill must NOT do/m)[0];
      expect(
        procedureSection,
        `${path} must not reference write tools in its procedure section`,
      ).not.toMatch(/mcp__meta-ads-write__|mcp__meta-ads__create_|mcp__meta-ads__update_|mcp__meta-ads__pause_|mcp__meta-ads__resume_/);
    }
  });

  it("the example spec in prompts/build-spec-schema.md round-trips through the schema", () => {
    const md = readRepo("prompts/build-spec-schema.md");
    const blocks = [...md.matchAll(/```yaml\n([\s\S]*?)```/g)];
    expect(blocks.length).toBeGreaterThan(0);
    const lastYaml = blocks[blocks.length - 1][1];
    const parsed = parseYaml(lastYaml);
    const validated = buildSpecSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Example spec failed validation: ${validated.error.message}`);
    }
  });
});
