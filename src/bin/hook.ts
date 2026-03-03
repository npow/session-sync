#!/usr/bin/env node
/**
 * session-sync-hook — Claude Code PostToolUse/Stop hook handler.
 *
 * Fires after every tool call and on session stop.
 * Translates tool calls to each detected target agent's format and writes
 * directly to that agent's native sessions directory.
 *
 * Protocol:
 *   - Reads JSON hook event from stdin
 *   - Never writes to stdout/stderr
 *   - Always exits 0 — never blocks Claude Code
 *   - p99 target: <50ms per tool call
 */
import { readFileSync } from "fs";
import { dirname } from "path";
import { join } from "path";
import { randomBytes } from "crypto";
import { log } from "../lib/logger.js";
import { findConfigPath, readConfig, CONFIG_DIR } from "../lib/config.js";
import { readCheckpoint, writeCheckpoint, getSessionCheckpoint } from "../lib/checkpoint.js";
import { readTranscriptFrom } from "../lib/transcript.js";
import { translateToolExchange, translateRecord } from "@npow/interchange-core";
import { initSessionFile, appendRecords } from "../lib/writers/index.js";
import { getAgentDef } from "../lib/agents.js";
import { withLock } from "../lib/lock.js";
import { getGitState } from "../lib/git.js";
import type { HookEvent, PostToolUseEvent, SessionCheckpoint, MirrorCheckpoint } from "../types.js";

async function main(): Promise<void> {
  let eventRaw: string;
  try {
    eventRaw = readFileSync("/dev/stdin", "utf8");
  } catch {
    return;
  }

  let event: HookEvent;
  try {
    event = JSON.parse(eventRaw) as HookEvent;
  } catch {
    log.error("Failed to parse hook event", { raw: eventRaw.slice(0, 200) });
    return;
  }

  const { session_id: sessionId, transcript_path: transcriptPath } = event;

  const configPath = findConfigPath(dirname(transcriptPath));
  if (!configPath) return; // not an initialized project

  let config;
  try {
    config = readConfig(configPath);
  } catch (err) {
    log.error("Failed to read config", { configPath, err: String(err) });
    return;
  }

  if (config.paused) return;
  if (config.targets.length === 0) return;

  const projectRoot = config.project_root;
  const checkpointPath = join(projectRoot, CONFIG_DIR, "checkpoint.json");

  // Sync to all enabled targets in parallel
  await Promise.all(
    config.targets
      .filter((t) => t.enabled)
      .map((target) =>
        syncToTarget({
          event,
          sessionId,
          transcriptPath,
          target,
          projectRoot,
          checkpointPath,
        }).catch((err) => {
          log.error("Sync failed", { agent: target.agent, sessionId, err: String(err) });
        })
      )
  );
}

interface SyncContext {
  event: HookEvent;
  sessionId: string;
  transcriptPath: string;
  target: { agent: string; enabled: boolean; sessions_dir: string };
  projectRoot: string;
  checkpointPath: string;
}

async function syncToTarget(ctx: SyncContext): Promise<void> {
  const { event, sessionId, transcriptPath, target, projectRoot, checkpointPath } = ctx;
  const agentDef = getAgentDef(target.agent);

  await withLock(checkpointPath, async () => {
    const cp = readCheckpoint(checkpointPath);
    let session = getSessionCheckpoint(cp, sessionId);

    // First time we see this session — initialize session file in target agent's dir
    if (!session) {
      const gitState = getGitState(projectRoot);
      const mirrorId = randomBytes(8).toString("hex");
      const now = new Date();
      const sessionPath = agentDef
        ? agentDef.session_path(target.sessions_dir, mirrorId, now)
        : join(target.sessions_dir, `${mirrorId}.jsonl`);

      const note =
        `Session synced from Claude Code (${sessionId.slice(0, 8)})` +
        (gitState ? ` · ${gitState.branch} @ ${gitState.head}` : "");

      initSessionFile(target.agent, sessionPath, note);

      const mirror: MirrorCheckpoint = {
        session_id: mirrorId,
        session_path: sessionPath,
        last_synced_uuid: "",
        last_synced_ts: now.toISOString(),
        record_count: 1, // system message
        created_date: now.toISOString().slice(0, 10),
      };

      const newSession: SessionCheckpoint = {
        source_agent: "claude-code",
        source_last_uuid: "",
        source_file_offset: 0,
        source_timestamp: now.toISOString(),
        mirrors: { [target.agent]: mirror },
        ...(gitState?.branch !== undefined && { git_branch: gitState.branch }),
        ...(gitState?.head !== undefined && { git_head: gitState.head }),
        ...(gitState?.dirty !== undefined && { git_dirty: gitState.dirty }),
      };

      cp.sessions[sessionId] = newSession;
      session = newSession;
    }

    const mirror = session.mirrors[target.agent];
    if (!mirror) return;

    if (event.hook_event_name === "PostToolUse") {
      const e = event as PostToolUseEvent;
      const { records, dropped } = translateToolExchange(
        e.tool_name,
        e.tool_input,
        e.tool_response,
        e.tool_use_id
      );

      const { recordsWritten } = await appendRecords(
        target.agent,
        mirror.session_path,
        records,
        dropped
      );

      mirror.last_synced_uuid = e.tool_use_id;
      mirror.last_synced_ts = new Date().toISOString();
      mirror.record_count += recordsWritten;
    }

    // On Stop: sweep transcript for text-only turns missed by PostToolUse
    if (event.hook_event_name === "Stop") {
      const { records: newRecords, newOffset } = readTranscriptFrom(
        transcriptPath,
        session.source_file_offset
      );

      const textRecords = [];
      const textDropped = [];

      for (const record of newRecords) {
        const blocks = Array.isArray(record.message.content)
          ? record.message.content
          : [record.message.content];
        const hasOnlyText = blocks.every(
          (b) => b.type === "text" || b.type === "thinking"
        );
        if (hasOnlyText) {
          const { records, dropped } = translateRecord(record);
          textRecords.push(...records);
          textDropped.push(...dropped);
        }
        session.source_last_uuid = record.uuid;
      }

      if (textRecords.length > 0) {
        const { recordsWritten } = await appendRecords(
          target.agent,
          mirror.session_path,
          textRecords,
          textDropped
        );
        mirror.record_count += recordsWritten;
      }

      session.source_file_offset = newOffset;
      session.source_timestamp = new Date().toISOString();
    }

    writeCheckpoint(checkpointPath, cp);
  });
}

main().catch((err) => {
  log.error("Hook handler fatal error", { err: String(err) });
  process.exit(0);
});
