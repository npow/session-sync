import * as codex from "./codex.js";
import * as generic from "./generic.js";
import { getAgentDef } from "../agents.js";
import type { CodexRolloutItem, DroppedItem } from "@npow/interchange-core";

export interface WriteResult {
  recordsWritten: number;
  droppedLogged: number;
}

export function initSessionFile(
  agent: string,
  sessionPath: string,
  note: string
): void {
  const def = getAgentDef(agent);
  if (def?.format === "codex-jsonl") {
    codex.initSessionFile(sessionPath, note);
  } else {
    generic.initSessionFile(sessionPath, note);
  }
}

export async function appendRecords(
  agent: string,
  sessionPath: string,
  records: CodexRolloutItem[],
  dropped: DroppedItem[]
): Promise<WriteResult> {
  const def = getAgentDef(agent);
  if (def?.format === "codex-jsonl") {
    return codex.appendRecords(sessionPath, records, dropped);
  }
  return generic.appendRecords(sessionPath, records, dropped);
}
