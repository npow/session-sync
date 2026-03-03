import { join } from "path";
import { findConfigPath, readConfig, writeConfig, CONFIG_DIR, CONFIG_FILE } from "../lib/config.js";

export function pause(cwd: string): void {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    console.error("No session-sync config found.");
    process.exit(1);
  }
  const config = readConfig(configPath);
  config.paused = true;
  writeConfig(configPath, config);
  console.log("Sync paused. Run 'session-sync resume-sync' to re-enable.");
}

export function resumeSync(cwd: string): void {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    console.error("No session-sync config found.");
    process.exit(1);
  }
  const config = readConfig(configPath);
  config.paused = false;
  writeConfig(configPath, config);
  console.log("Sync resumed.");
}
