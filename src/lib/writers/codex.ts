/**
 * Writes translated records directly to Codex's native sessions directory.
 * No intermediate mirror — the session file IS the Codex session.
 *
 * Path: <sessions_dir>/YYYY/MM/DD/rollout-<session-id>.jsonl
 * Resume: codex --continue <session-id>
 */
import { appendFileSync, mkdirSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { withLock } from "../lock.js";
import type { CodexRolloutItem, DroppedItem } from "@npow/interchange-core";

const DROPPED_SUFFIX = ".dropped.jsonl";
const MAX_OUTPUT_BYTES = 100_000;

export interface WriteResult {
  recordsWritten: number;
  droppedLogged: number;
}

export function buildSessionPath(
  sessionsDir: string,
  sessionId: string,
  date: Date = new Date()
): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return join(sessionsDir, String(y), m, d, `rollout-${sessionId}.jsonl`);
}

/** Create the session file with an initial system message. Idempotent. */
export function initSessionFile(sessionPath: string, note: string): void {
  if (existsSync(sessionPath)) return;
  mkdirSync(dirname(sessionPath), { recursive: true });

  const systemMsg: CodexRolloutItem = {
    type: "message",
    id: "item_000000000000",
    role: "system",
    content: note,
    status: "completed",
  };
  writeFileSync(sessionPath, JSON.stringify(systemMsg) + "\n", "utf8");
}

/** Append translated records. File-locked for concurrent hook safety. */
export async function appendRecords(
  sessionPath: string,
  records: CodexRolloutItem[],
  dropped: DroppedItem[]
): Promise<WriteResult> {
  if (records.length === 0 && dropped.length === 0) {
    return { recordsWritten: 0, droppedLogged: 0 };
  }

  mkdirSync(dirname(sessionPath), { recursive: true });

  await withLock(sessionPath, async () => {
    if (records.length > 0) {
      const lines = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
      appendFileSync(sessionPath, lines, "utf8");
    }
  });

  if (dropped.length > 0) {
    const droppedPath = sessionPath + DROPPED_SUFFIX;
    const lines = dropped.map((d) => JSON.stringify(d)).join("\n") + "\n";
    appendFileSync(droppedPath, lines, "utf8");
  }

  return { recordsWritten: records.length, droppedLogged: dropped.length };
}

// Re-export for tests
export { MAX_OUTPUT_BYTES };
