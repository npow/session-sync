import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { detectInstalledAgents } from "./agents.js";
import type { ProjectConfig, TargetConfig } from "../types.js";

export const CONFIG_DIR = ".session-sync";
export const CONFIG_FILE = "config.json";

export function buildConfig(
  projectRoot: string,
  detected: ReturnType<typeof detectInstalledAgents>
): ProjectConfig {
  return {
    version: 1,
    project_root: projectRoot,
    targets: detected.map(({ def, sessions_dir }) => ({
      agent: def.agent,
      enabled: true,
      sessions_dir,
    })),
    git: {
      auto_associate: true,
      warn_on_divergence: true,
    },
  };
}

/** Walk up from `startDir` looking for `.session-sync/config.json`. */
export function findConfigPath(startDir: string): string | null {
  let dir = resolve(startDir);
  const root = resolve("/");

  while (dir !== root) {
    const candidate = join(dir, CONFIG_DIR, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return null;
}

export function readConfig(configPath: string): ProjectConfig {
  const raw = readFileSync(configPath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as Record<string, unknown>)["version"] !== 1
  ) {
    throw new Error(`Invalid config at ${configPath}`);
  }

  return parsed as ProjectConfig;
}

export function writeConfig(configPath: string, config: ProjectConfig): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function getTargetConfig(
  config: ProjectConfig,
  agent: string
): TargetConfig | undefined {
  return config.targets.find((t) => t.agent === agent && t.enabled);
}
