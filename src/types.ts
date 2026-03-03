// ─── Re-exports from @npow/interchange-core ───────────────────────────────────────
// Shared types (Claude format, Codex format, hooks, translation) now live in
// @npow/interchange-core. Re-export them here for any remaining internal references.
export type {
  ClaudeRecord,
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeToolUse,
  ClaudeToolResult,
  ClaudeUsage,
  BashInput,
  ReadInput,
  EditInput,
  MultiEditOperation,
  MultiEditInput,
  WriteInput,
  GlobInput,
  GrepInput,
  CodexMessage,
  CodexFunctionCall,
  CodexFunctionCallOutput,
  CodexRolloutItem,
  PostToolUseEvent,
  StopEvent,
  HookEvent,
  TranslationResult,
  DroppedItem,
} from "@npow/interchange-core";

// ─── Config types ─────────────────────────────────────────────────────────────

export type SupportedAgent = string;

export interface ProjectConfig {
  version: 1;
  project_root: string;
  targets: TargetConfig[];
  git: GitConfig;
  paused?: boolean;
}

export interface TargetConfig {
  agent: SupportedAgent;
  enabled: boolean;
  /** Absolute path where target agent looks for sessions (overrides agent default) */
  sessions_dir: string;
}

export interface GitConfig {
  auto_associate: boolean;
  warn_on_divergence: boolean;
}

// ─── Checkpoint types ─────────────────────────────────────────────────────────

export interface Checkpoint {
  sessions: Record<string, SessionCheckpoint>;
}

export interface SessionCheckpoint {
  source_agent: "claude-code";
  source_last_uuid: string;
  /** Byte offset in transcript JSONL — for O(new) reads */
  source_file_offset: number;
  source_timestamp: string;
  git_branch?: string;
  git_head?: string;
  git_dirty?: string[];
  mirrors: Record<string, MirrorCheckpoint>;
}

export interface MirrorCheckpoint {
  /** ID used to resume in the target agent (e.g. codex --continue <id>) */
  session_id: string;
  /** Absolute path to the session file written into the target agent's dir */
  session_path: string;
  last_synced_uuid: string;
  last_synced_ts: string;
  record_count: number;
  /** Date the session file was created (for path reconstruction) */
  created_date: string; // ISO date YYYY-MM-DD
}
