/**
 * Emit Prisma schema text from merged result.
 */

import type { MergeResult, ParsedSchema } from "./types.js";

/**
 * Emit full Prisma schema string from core (datasource, generator) and merge result (models).
 */
export function emitSchema(core: ParsedSchema, merged: MergeResult): string {
  const lines: string[] = [];

  if (core.generator?.raw) lines.push(core.generator.raw);
  if (core.datasource?.raw) lines.push(core.datasource.raw);

  lines.push("");

  // Emit models in deterministic order (alphabetical)
  const modelNames = Array.from(merged.models.keys()).sort();
  for (const name of modelNames) {
    const model = merged.models.get(name)!;
    lines.push(`model ${model.name} {`);
    for (const f of model.fields) {
      if (f.raw) lines.push("  " + f.raw.replace(/\n/g, "\n  "));
    }
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
