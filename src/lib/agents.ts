/**
 * Agent registry — defines every supported target agent:
 * where to detect it, where to write sessions, and how to resume.
 *
 * Adding a new agent: add one entry here. Everything else is automatic.
 */
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type TranslationFormat =
  | "codex-jsonl"   // OpenAI Responses API rollout format (Codex CLI, OpenCode)
  | "openai-jsonl"; // Generic OpenAI chat JSONL (Amp, Gemini CLI, others)

export interface AgentDef {
  agent: string;
  name: string;
  /** Paths to check — any one existing means agent is installed */
  probe_paths: string[];
  /** Root dir where session files live */
  sessions_dir: string;
  /** Build the path for a specific session file */
  session_path: (sessionsDir: string, id: string, date: Date) => string;
  /** Command the user runs to continue the session */
  resume_cmd: (id: string) => string;
  /** Translation format to emit */
  format: TranslationFormat;
}

function home(...parts: string[]): string {
  return join(homedir(), ...parts);
}

function dated(dir: string, id: string, date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return join(dir, String(y), m, d, `rollout-${id}.jsonl`);
}

export const AGENT_REGISTRY: AgentDef[] = [
  {
    agent: "codex",
    name: "Codex CLI",
    probe_paths: [home(".codex"), home(".local/share/codex")],
    sessions_dir: home(".codex", "sessions"),
    session_path: (dir, id, date) => dated(dir, id, date),
    resume_cmd: (id) => `codex --continue ${id}`,
    format: "codex-jsonl",
  },
  {
    agent: "opencode",
    name: "OpenCode",
    probe_paths: [home(".opencode"), home(".local/share/opencode")],
    sessions_dir: home(".opencode", "sessions"),
    session_path: (dir, id, date) => dated(dir, id, date),
    resume_cmd: (id) => `opencode --continue ${id}`,
    format: "codex-jsonl",
  },
  {
    agent: "amp",
    name: "Amp",
    probe_paths: [home(".amp"), home(".config/amp")],
    sessions_dir: home(".amp", "sessions"),
    session_path: (dir, id, _date) => join(dir, `${id}.jsonl`),
    resume_cmd: (id) => `amp --session ${id}`,
    format: "openai-jsonl",
  },
  {
    agent: "gemini",
    name: "Gemini CLI",
    probe_paths: [home(".gemini"), home(".config/gemini-cli")],
    sessions_dir: home(".gemini", "sessions"),
    session_path: (dir, id, _date) => join(dir, `${id}.jsonl`),
    resume_cmd: (id) => `gemini --resume ${id}`,
    format: "openai-jsonl",
  },
];

export interface DetectedAgent {
  def: AgentDef;
  sessions_dir: string;
}

/** Return all agents that appear to be installed on this machine. */
export function detectInstalledAgents(): DetectedAgent[] {
  return AGENT_REGISTRY.filter((def) =>
    def.probe_paths.some(existsSync)
  ).map((def) => ({ def, sessions_dir: def.sessions_dir }));
}

export function getAgentDef(agent: string): AgentDef | undefined {
  return AGENT_REGISTRY.find((d) => d.agent === agent);
}
