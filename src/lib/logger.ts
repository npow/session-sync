/**
 * File-based logger. Never writes to stdout/stderr — hook handlers must not
 * produce unexpected output that would corrupt Claude Code's hook protocol.
 */
import { appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

const LOG_DIR = join(homedir(), ".session-sync", "logs");
const LOG_FILE = join(LOG_DIR, "session-sync.log");

let _logFile = LOG_FILE;

export function setLogFile(path: string): void {
  _logFile = path;
}

function write(level: string, msg: string, data?: unknown): void {
  try {
    mkdirSync(dirname(_logFile), { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...(data !== undefined && { data }),
    };
    appendFileSync(_logFile, JSON.stringify(entry) + "\n");
  } catch {
    // swallow — logging must never crash the hook handler
  }
}

export const log = {
  info: (msg: string, data?: unknown) => write("INFO", msg, data),
  warn: (msg: string, data?: unknown) => write("WARN", msg, data),
  error: (msg: string, data?: unknown) => write("ERROR", msg, data),
  debug: (msg: string, data?: unknown) => write("DEBUG", msg, data),
};
