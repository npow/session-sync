import { join } from "path";
import { rmSync, existsSync } from "fs";
import { findConfigPath, readConfig, writeConfig, CONFIG_DIR } from "../lib/config.js";
import { readCheckpoint, writeCheckpoint } from "../lib/checkpoint.js";

export interface CleanOptions {
  olderThanDays?: number;
  dryRun?: boolean;
}

export function clean(cwd: string, opts: CleanOptions = {}): void {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    console.error("No session-sync config found.");
    process.exit(1);
  }

  const config = readConfig(configPath);
  const projectRoot = config.project_root;
  const checkpointPath = join(projectRoot, CONFIG_DIR, "checkpoint.json");
  const cp = readCheckpoint(checkpointPath);

  const cutoffMs = opts.olderThanDays !== undefined
    ? Date.now() - opts.olderThanDays * 86_400_000
    : 0;

  let removed = 0;
  const toRemove: string[] = [];

  for (const [sessionId, session] of Object.entries(cp.sessions)) {
    const ts = new Date(session.source_timestamp).getTime();
    if (cutoffMs > 0 && ts > cutoffMs) continue;

    for (const mirror of Object.values(session.mirrors)) {
      if (existsSync(mirror.session_path)) {
        toRemove.push(mirror.session_path);
      }
    }
    toRemove.push(sessionId);
  }

  if (toRemove.length === 0) {
    console.log("Nothing to clean.");
    return;
  }

  for (const item of toRemove) {
    if (item === item.slice(0, 36)) {
      // It's a session ID key — remove from checkpoint
      if (!opts.dryRun) delete cp.sessions[item];
      removed++;
      console.log(`${opts.dryRun ? "[dry-run] would remove" : "Removed"} session ${item.slice(0, 16)}...`);
    } else {
      // It's a file path
      if (!opts.dryRun) {
        try {
          rmSync(item, { force: true });
        } catch {
          // ignore
        }
      }
    }
  }

  if (!opts.dryRun) {
    writeCheckpoint(checkpointPath, cp);
  }

  console.log(`\n${opts.dryRun ? "Would remove" : "Removed"} ${removed} session(s).`);
}
