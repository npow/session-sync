import { execSync } from "child_process";

export interface GitState {
  branch: string;
  head: string;
  dirty: string[];
}

export function getGitState(cwd: string): GitState | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();

    const head = execSync("git rev-parse --short HEAD", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();

    const dirty = execSync("git diff --name-only HEAD", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);

    return { branch, head, dirty };
  } catch {
    return null;
  }
}

export function hasGitDiverged(
  current: GitState,
  recorded: { git_head?: string; git_branch?: string }
): boolean {
  if (!recorded.git_head) return false;
  return current.head !== recorded.git_head;
}
