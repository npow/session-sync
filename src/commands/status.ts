import { join } from "path";
import { statSync, existsSync } from "fs";
import { findConfigPath, readConfig, CONFIG_DIR } from "../lib/config.js";
import { readCheckpoint } from "../lib/checkpoint.js";
import { getAgentDef } from "../lib/agents.js";
import { getGitState, hasGitDiverged } from "../lib/git.js";

export function status(cwd: string): void {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    console.error("Not initialized. Run: session-sync init");
    process.exit(1);
  }

  const config = readConfig(configPath);
  const projectRoot = config.project_root;
  const checkpointPath = join(projectRoot, CONFIG_DIR, "checkpoint.json");
  const cp = readCheckpoint(checkpointPath);
  const sessionCount = Object.keys(cp.sessions).length;
  const gitState = getGitState(projectRoot);

  console.log(`project:  ${projectRoot}`);
  console.log(`status:   ${config.paused ? "PAUSED" : "active"}`);
  console.log(
    `targets:  ${config.targets.length === 0 ? "none detected" : config.targets.map((t) => t.agent).join(", ")}`
  );
  if (sessionCount > 0) console.log(`sessions: ${sessionCount}`);
  console.log();

  if (sessionCount === 0) {
    console.log("No sessions yet — start a Claude Code session to begin syncing.");
    return;
  }

  const sorted = Object.entries(cp.sessions).sort(
    ([, a], [, b]) =>
      new Date(b.source_timestamp).getTime() - new Date(a.source_timestamp).getTime()
  );

  for (const [claudeSessionId, session] of sorted) {
    const age = formatAge(new Date(session.source_timestamp));
    const gitLine = session.git_branch
      ? `${session.git_branch} @ ${session.git_head ?? "?"}`
      : "—";

    const diverged =
      gitState &&
      hasGitDiverged(gitState, {
        ...(session.git_head !== undefined && { git_head: session.git_head }),
      });

    console.log(
      `session ${claudeSessionId.slice(0, 16)}  ${gitLine}  (${age})`
    );
    if (diverged) {
      console.log(
        `  ! git has moved on since this session (${session.git_head} → ${gitState.head})`
      );
    }

    if (Object.keys(session.mirrors).length === 0) {
      console.log("  no mirrors yet");
    }

    for (const [agent, mirror] of Object.entries(session.mirrors)) {
      const def = getAgentDef(agent);
      const fileOk = existsSync(mirror.session_path);
      const size = fileOk ? formatBytes(statSync(mirror.session_path).size) : "missing";
      const resumeCmd = def?.resume_cmd(mirror.session_id) ?? `${agent} --continue ${mirror.session_id}`;

      console.log(`  ${agent.padEnd(12)} ${mirror.record_count} records  ${size.padStart(7)}  → ${resumeCmd}`);
      if (!fileOk) {
        console.log(`               ! session file missing: ${mirror.session_path}`);
      }
    }
    console.log();
  }
}

function formatAge(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1048576).toFixed(1)}MB`;
}
