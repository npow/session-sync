import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { withLock } from "./lock.js";
import type { Checkpoint, SessionCheckpoint, MirrorCheckpoint } from "../types.js";

const EMPTY_CHECKPOINT: Checkpoint = { sessions: {} };

export function readCheckpoint(checkpointPath: string): Checkpoint {
  if (!existsSync(checkpointPath)) return structuredClone(EMPTY_CHECKPOINT);
  try {
    return JSON.parse(readFileSync(checkpointPath, "utf8")) as Checkpoint;
  } catch {
    return structuredClone(EMPTY_CHECKPOINT);
  }
}

export function writeCheckpoint(
  checkpointPath: string,
  checkpoint: Checkpoint
): void {
  mkdirSync(dirname(checkpointPath), { recursive: true });
  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2) + "\n");
}

/** Atomically update a single session's checkpoint. */
export async function updateSessionCheckpoint(
  checkpointPath: string,
  sessionId: string,
  updater: (current: SessionCheckpoint | undefined) => SessionCheckpoint
): Promise<void> {
  await withLock(checkpointPath, async () => {
    const cp = readCheckpoint(checkpointPath);
    cp.sessions[sessionId] = updater(cp.sessions[sessionId]);
    writeCheckpoint(checkpointPath, cp);
  });
}

/** Atomically update a single mirror's checkpoint. */
export async function updateMirrorCheckpoint(
  checkpointPath: string,
  sessionId: string,
  agent: string,
  updater: (current: MirrorCheckpoint | undefined) => MirrorCheckpoint
): Promise<void> {
  await withLock(checkpointPath, async () => {
    const cp = readCheckpoint(checkpointPath);
    const session = cp.sessions[sessionId];
    if (!session) return;
    session.mirrors[agent] = updater(session.mirrors[agent]);
    writeCheckpoint(checkpointPath, cp);
  });
}

export function getSessionCheckpoint(
  cp: Checkpoint,
  sessionId: string
): SessionCheckpoint | undefined {
  return cp.sessions[sessionId];
}

export function getMirrorCheckpoint(
  cp: Checkpoint,
  sessionId: string,
  agent: string
): MirrorCheckpoint | undefined {
  return cp.sessions[sessionId]?.mirrors[agent];
}
