import { join } from "path";
import { findConfigPath, readConfig, CONFIG_DIR } from "../lib/config.js";
import { readCheckpoint } from "../lib/checkpoint.js";

export function list(cwd: string, opts: { json?: boolean } = {}): void {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    console.error("No session-sync config found.");
    process.exit(1);
  }

  const config = readConfig(configPath);
  const cp = readCheckpoint(join(config.project_root, CONFIG_DIR, "checkpoint.json"));
  const sessions = Object.entries(cp.sessions);

  if (opts.json) {
    console.log(JSON.stringify(cp.sessions, null, 2));
    return;
  }

  if (sessions.length === 0) {
    console.log("No sessions.");
    return;
  }

  const sorted = sessions.sort(
    ([, a], [, b]) =>
      new Date(b.source_timestamp).getTime() - new Date(a.source_timestamp).getTime()
  );

  console.log(
    "CLAUDE SESSION           AGENT        RECORDS  BRANCH               SYNCED"
  );
  console.log("─".repeat(82));

  for (const [sessionId, session] of sorted) {
    for (const [agent, mirror] of Object.entries(session.mirrors)) {
      const branch = (session.git_branch ?? "—").slice(0, 20).padEnd(20);
      const ts = new Date(mirror.last_synced_ts).toISOString().slice(0, 16);
      console.log(
        `${sessionId.slice(0, 24).padEnd(25)} ${agent.padEnd(12)} ${String(mirror.record_count).padStart(7)}  ${branch} ${ts}`
      );
    }
  }
}
