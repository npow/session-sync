/**
 * Efficient JSONL transcript reader. Uses byte offsets to read only new records
 * since the last sync checkpoint — O(new records) not O(total records).
 */
import { openSync, readSync, statSync, closeSync } from "fs";
import type { ClaudeRecord } from "@npow/interchange-core";

const READ_CHUNK = 65_536; // 64KB read buffer

export interface TranscriptSlice {
  records: ClaudeRecord[];
  /** New byte offset to store in checkpoint */
  newOffset: number;
}

/**
 * Read all complete JSONL lines from `path` starting at `fromOffset`.
 * Returns parsed ClaudeRecords and the new file offset.
 */
export function readTranscriptFrom(
  path: string,
  fromOffset: number
): TranscriptSlice {
  const stat = statSync(path);
  if (stat.size <= fromOffset) {
    return { records: [], newOffset: fromOffset };
  }

  const fd = openSync(path, "r");
  const records: ClaudeRecord[] = [];
  let offset = fromOffset;
  let remainder = "";

  try {
    const buf = Buffer.allocUnsafe(READ_CHUNK);

    while (offset < stat.size) {
      const bytesRead = readSync(fd, buf, 0, READ_CHUNK, offset);
      if (bytesRead === 0) break;

      offset += bytesRead;
      const chunk = remainder + buf.subarray(0, bytesRead).toString("utf8");
      const lines = chunk.split("\n");

      // last element is either empty (complete line ended with \n) or a partial line
      remainder = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const record = JSON.parse(trimmed) as ClaudeRecord;
          // Only process actual conversation messages (skip summary/system records)
          if (record.message && record.uuid) {
            records.push(record);
          }
        } catch {
          // malformed line — skip
        }
      }
    }

    // If remainder has no newline, we've read past a partial line — back up
    if (remainder.length > 0) {
      offset -= Buffer.byteLength(remainder, "utf8");
    }
  } finally {
    closeSync(fd);
  }

  return { records, newOffset: offset };
}
