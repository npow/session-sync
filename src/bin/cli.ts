#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf8")
) as { version: string };

const program = new Command();

program
  .name("session-sync")
  .description(
    "Continuous cross-agent session sync — code in Claude, switch to any agent seamlessly"
  )
  .version(pkg.version);

// ─── init ─────────────────────────────────────────────────────────────────────
program
  .command("init")
  .description(
    "One-time setup: detect installed agents, register hooks in .claude/settings.json"
  )
  .option("--force", "Re-initialize even if already configured")
  .action(async (opts: { force?: boolean }) => {
    const { init } = await import("../commands/init.js");
    init(process.cwd(), { ...(opts.force !== undefined && { force: opts.force }) });
  });

// ─── status ───────────────────────────────────────────────────────────────────
program
  .command("status")
  .description("Show active sessions and resume commands for each synced agent")
  .action(async () => {
    const { status } = await import("../commands/status.js");
    status(process.cwd());
  });

// ─── list ─────────────────────────────────────────────────────────────────────
program
  .command("list")
  .description("List all synced sessions")
  .option("--json", "Output as JSON")
  .action(async (opts: { json?: boolean }) => {
    const { list } = await import("../commands/list.js");
    list(process.cwd(), { ...(opts.json !== undefined && { json: opts.json }) });
  });

// ─── pause / resume ───────────────────────────────────────────────────────────
program
  .command("pause")
  .description("Pause hook sync (hooks stay registered but do nothing)")
  .action(async () => {
    const { pause } = await import("../commands/pause.js");
    pause(process.cwd());
  });

program
  .command("resume")
  .description("Resume hook sync after pause")
  .action(async () => {
    const { resumeSync } = await import("../commands/pause.js");
    resumeSync(process.cwd());
  });

// ─── clean ────────────────────────────────────────────────────────────────────
program
  .command("clean")
  .description("Remove old session files and checkpoint entries")
  .option("--older-than <days>", "Remove sessions older than N days", parseInt)
  .option("--dry-run", "Show what would be removed without deleting")
  .action(async (opts: { olderThan?: number; dryRun?: boolean }) => {
    const { clean } = await import("../commands/clean.js");
    clean(process.cwd(), {
      ...(opts.olderThan !== undefined && { olderThanDays: opts.olderThan }),
      ...(opts.dryRun !== undefined && { dryRun: opts.dryRun }),
    });
  });

program.parse();
