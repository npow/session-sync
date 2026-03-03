import { readFileSync, existsSync } from "fs";

export function validate(agent: "codex", mirrorPath: string): void {
  if (!existsSync(mirrorPath)) {
    console.error(`File not found: ${mirrorPath}`);
    process.exit(1);
  }

  const lines = readFileSync(mirrorPath, "utf8").split("\n").filter(Boolean);
  let valid = 0;
  let invalid = 0;
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    try {
      const item = JSON.parse(line) as Record<string, unknown>;
      if (!item.type) {
        errors.push(`Line ${i + 1}: missing "type" field`);
        invalid++;
        continue;
      }
      // Basic schema check per type
      switch (item.type) {
        case "message":
          if (!item.id || !item.role || item.content === undefined) {
            errors.push(`Line ${i + 1}: message missing id/role/content`);
            invalid++;
          } else valid++;
          break;
        case "function_call":
          if (!item.id || !item.call_id || !item.name || item.arguments === undefined) {
            errors.push(`Line ${i + 1}: function_call missing id/call_id/name/arguments`);
            invalid++;
          } else valid++;
          break;
        case "function_call_output":
          if (!item.call_id || item.output === undefined) {
            errors.push(`Line ${i + 1}: function_call_output missing call_id/output`);
            invalid++;
          } else valid++;
          break;
        default:
          errors.push(`Line ${i + 1}: unknown type "${String(item.type)}"`);
          invalid++;
      }
    } catch {
      errors.push(`Line ${i + 1}: invalid JSON`);
      invalid++;
    }
  }

  console.log(`Validated ${mirrorPath}`);
  console.log(`  Valid records:   ${valid}`);
  console.log(`  Invalid records: ${invalid}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.slice(0, 20).forEach((e) => console.log(`  ${e}`));
    if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
    process.exit(1);
  } else {
    console.log("\nAll records valid.");
  }
}
