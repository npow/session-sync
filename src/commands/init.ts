import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { detectInstalledAgents } from "../lib/agents.js";
import { buildConfig, writeConfig, CONFIG_DIR, CONFIG_FILE } from "../lib/config.js";

export interface InitOptions {
  force?: boolean;
}

export function init(projectRoot: string, opts: InitOptions = {}): void {
  const absRoot = resolve(projectRoot);
  const configPath = join(absRoot, CONFIG_DIR, CONFIG_FILE);

  if (existsSync(configPath) && !opts.force) {
    console.error(
      `Already initialized at ${configPath}\nUse --force to reinitialize.`
    );
    process.exit(1);
  }

  const detected = detectInstalledAgents();

  if (detected.length === 0) {
    console.log("No supported agents detected.");
    console.log(
      "Install one of: codex, opencode, amp, gemini-cli — then run session-sync init again."
    );
    console.log();
    console.log("Registering hooks anyway (agents can be added later).");
  }

  const config = buildConfig(absRoot, detected);
  writeConfig(configPath, config);
  registerClaudeHooks(absRoot);

  console.log("session-sync initialized.");
  console.log();

  if (detected.length > 0) {
    console.log("Detected agents:");
    for (const { def, sessions_dir } of detected) {
      console.log(`  ${def.agent.padEnd(12)} ${sessions_dir}`);
    }
    console.log();
    console.log("Sessions will sync automatically to all agents on every tool call.");
    console.log("When you want to switch agents, just open one — your session is there.");
  }

  console.log();
  console.log(`Run "session-sync status" to see live sync state.`);
}

interface ClaudeSettings {
  hooks?: {
    PostToolUse?: HookConfig[];
    Stop?: HookConfig[];
  };
  [key: string]: unknown;
}

interface HookConfig {
  matcher?: string;
  hooks: Array<{ type: string; command: string }>;
}

function registerClaudeHooks(projectRoot: string): void {
  const settingsDir = join(projectRoot, ".claude");
  const settingsPath = join(settingsDir, "settings.json");

  mkdirSync(settingsDir, { recursive: true });

  let settings: ClaudeSettings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf8")) as ClaudeSettings;
    } catch {
      settings = {};
    }
  }

  settings.hooks ??= {};

  settings.hooks.PostToolUse ??= [];
  const hasPostToolUse = settings.hooks.PostToolUse.some((h) =>
    h.hooks?.some((hh) => hh.command === "session-sync-hook")
  );
  if (!hasPostToolUse) {
    settings.hooks.PostToolUse.push({
      matcher: "*",
      hooks: [{ type: "command", command: "session-sync-hook" }],
    });
  }

  settings.hooks.Stop ??= [];
  const hasStop = settings.hooks.Stop.some((h) =>
    h.hooks?.some((hh) => hh.command === "session-sync-hook")
  );
  if (!hasStop) {
    settings.hooks.Stop.push({
      hooks: [{ type: "command", command: "session-sync-hook" }],
    });
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`Hooks registered in ${settingsPath}`);
}
