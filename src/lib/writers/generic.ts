/**
 * Generic OpenAI chat JSONL writer for agents that use standard
 * {role, content} message format (Amp, Gemini CLI, etc.).
 *
 * Emits each CodexRolloutItem translated to a simple chat message so
 * these agents at minimum understand the conversation narrative.
 */
import { appendFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { withLock } from "../lock.js";
import type { CodexRolloutItem, DroppedItem } from "@npow/interchange-core";

export interface WriteResult {
  recordsWritten: number;
  droppedLogged: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

function toChat(item: CodexRolloutItem): ChatMessage | null {
  switch (item.type) {
    case "message":
      return { role: item.role, content: item.content };
    case "function_call":
      return {
        role: "assistant",
        content: `[tool: ${item.name}]\n${item.arguments}`,
      };
    case "function_call_output":
      return { role: "tool", content: item.output };
  }
}

export function initSessionFile(sessionPath: string, note: string): void {
  if (existsSync(sessionPath)) return;
  mkdirSync(dirname(sessionPath), { recursive: true });
  const msg: ChatMessage = { role: "system", content: note };
  writeFileSync(sessionPath, JSON.stringify(msg) + "\n", "utf8");
}

export async function appendRecords(
  sessionPath: string,
  records: CodexRolloutItem[],
  dropped: DroppedItem[]
): Promise<WriteResult> {
  if (records.length === 0 && dropped.length === 0) {
    return { recordsWritten: 0, droppedLogged: 0 };
  }

  mkdirSync(dirname(sessionPath), { recursive: true });

  const chatMessages = records.map(toChat).filter((m): m is ChatMessage => m !== null);

  await withLock(sessionPath, async () => {
    if (chatMessages.length > 0) {
      const lines = chatMessages.map((m) => JSON.stringify(m)).join("\n") + "\n";
      appendFileSync(sessionPath, lines, "utf8");
    }
  });

  if (dropped.length > 0) {
    const droppedPath = sessionPath + ".dropped.jsonl";
    appendFileSync(
      droppedPath,
      dropped.map((d) => JSON.stringify(d)).join("\n") + "\n",
      "utf8"
    );
  }

  return { recordsWritten: chatMessages.length, droppedLogged: dropped.length };
}
