/**
 * Atomic file-based lock using O_EXCL. Prevents concurrent hook processes from
 * corrupting the mirror JSONL or checkpoint file.
 */
import { openSync, closeSync, unlinkSync } from "fs";

const LOCK_TIMEOUT_MS = 5_000;
const LOCK_RETRY_MS = 10;

function tryAcquire(lockPath: string): boolean {
  try {
    // O_WRONLY | O_CREAT | O_EXCL — fails atomically if file exists
    const fd = openSync(lockPath, "wx");
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // already gone — fine
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Acquire lock at `path + ".lock"`, run `fn`, release lock.
 * Throws if lock cannot be acquired within LOCK_TIMEOUT_MS.
 */
export async function withLock<T>(
  path: string,
  fn: () => Promise<T>
): Promise<T> {
  const lockPath = path + ".lock";
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (!tryAcquire(lockPath)) {
    if (Date.now() >= deadline) {
      throw new Error(`Lock timeout on ${lockPath}`);
    }
    await sleep(LOCK_RETRY_MS);
  }

  try {
    return await fn();
  } finally {
    releaseLock(lockPath);
  }
}
