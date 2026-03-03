import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import {
  appendRecords,
  initSessionFile,
  buildSessionPath,
} from "../../src/lib/writers/codex.js";
import type { CodexRolloutItem } from "@interchange/core";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), "session-sync-test-" + randomBytes(4).toString("hex"));
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("initSessionFile", () => {
  it("creates file with system message", () => {
    const path = join(testDir, "rollout.jsonl");
    initSessionFile(path, "Test session");
    const record = JSON.parse(readFileSync(path, "utf8").trim()) as Record<string, unknown>;
    expect(record.type).toBe("message");
    expect(record.role).toBe("system");
    expect(record.content).toContain("Test session");
  });

  it("does not overwrite existing file", () => {
    const path = join(testDir, "rollout.jsonl");
    initSessionFile(path, "First");
    initSessionFile(path, "Second");
    expect(readFileSync(path, "utf8")).toContain("First");
    expect(readFileSync(path, "utf8")).not.toContain("Second");
  });
});

describe("appendRecords", () => {
  it("appends records as JSONL", async () => {
    const path = join(testDir, "rollout.jsonl");
    const records: CodexRolloutItem[] = [
      { type: "message", id: "item_001", role: "assistant", content: "hello", status: "completed" },
      { type: "function_call", id: "item_002", call_id: "call_001", name: "shell", arguments: '{"cmd":"ls"}', status: "completed" },
    ];

    const result = await appendRecords(path, records, []);
    expect(result.recordsWritten).toBe(2);

    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect((JSON.parse(lines[0] ?? "{}") as Record<string, unknown>).type).toBe("message");
    expect((JSON.parse(lines[1] ?? "{}") as Record<string, unknown>).type).toBe("function_call");
  });

  it("logs dropped items alongside session file", async () => {
    const path = join(testDir, "rollout.jsonl");
    await appendRecords(path, [], [
      { source_uuid: "u1", reason: "thinking_block", summary: "3 tokens" },
    ]);
    const droppedPath = path + ".dropped.jsonl";
    expect(existsSync(droppedPath)).toBe(true);
    const record = JSON.parse(readFileSync(droppedPath, "utf8").trim()) as Record<string, unknown>;
    expect(record.reason).toBe("thinking_block");
  });

  it("returns zero when nothing to write", async () => {
    const path = join(testDir, "rollout.jsonl");
    const result = await appendRecords(path, [], []);
    expect(result.recordsWritten).toBe(0);
    expect(existsSync(path)).toBe(false);
  });

  it("creates parent directories automatically", async () => {
    const path = join(testDir, "deep", "nested", "rollout.jsonl");
    await appendRecords(path, [
      { type: "function_call_output", call_id: "c1", output: "ok" },
    ], []);
    expect(existsSync(path)).toBe(true);
  });
});

describe("buildSessionPath", () => {
  it("builds dated path under sessions dir", () => {
    const path = buildSessionPath("~/.codex/sessions", "abc123", new Date("2026-03-03T10:00:00Z"));
    expect(path).toContain("2026");
    expect(path).toContain("03");
    expect(path).toContain("rollout-abc123.jsonl");
  });
});
