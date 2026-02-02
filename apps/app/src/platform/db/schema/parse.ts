/**
 * Prisma schema parser for the schema merger.
 * Extracts datasource, generator, and model blocks; parses model fields for merging.
 */

import type { ParsedBlock, ParsedField, ParsedModel, ParsedSchema } from "./types.js";

const BLOCK_START = /^\s*(datasource|generator|model)\s+(\w+)\s*\{/gm;

/**
 * Find the end of a block by matching braces. Assumes startIndex is at the opening `{`.
 */
function findBlockEnd(content: string, startIndex: number): number {
  let depth = 0;
  for (let i = startIndex; i < content.length; i++) {
    const c = content[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Extract the next top-level block (datasource, generator, or model).
 */
function extractBlock(content: string, lastEnd: number): { block: ParsedBlock; endIndex: number } | null {
  const match = BLOCK_START.exec(content);
  if (!match || match.index < lastEnd) return null;

  const kind = match[1] as "datasource" | "generator" | "model";
  const name = match[2];
  const openBrace = content.indexOf("{", match.index + match[0].length - 1);
  const closeBrace = findBlockEnd(content, openBrace);
  if (closeBrace === -1) throw new Error(`Unclosed block: ${kind} ${name}`);

  const raw = content.slice(match.index, closeBrace + 1);
  const block: ParsedBlock = { kind, name, raw };

  if (kind === "model") {
    const inner = content.slice(openBrace + 1, closeBrace);
    block.model = parseModelInner(name, inner);
  }

  return { block, endIndex: closeBrace + 1 };
}

/**
 * Parse model body (content between braces) into fields.
 * Each field is one or more lines; we preserve raw text for emission.
 */
function parseModelInner(modelName: string, inner: string): ParsedModel {
  const lines = inner.split("\n");
  const fields: ParsedField[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("//")) {
      i++;
      continue;
    }

    // @@ directive (single line)
    if (trimmed.startsWith("@@")) {
      fields.push({ name: "", raw: trimmed });
      i++;
      continue;
    }

    // Field: name Type @attrs (may span multiple lines)
    const fieldMatch = trimmed.match(/^(\w+)\s+/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1];
      const rawLines: string[] = [lines[i]];
      i++;
      while (i < lines.length) {
        const current = lines[i];
        const t = current.trim();
        if (!t || t.startsWith("//")) {
          rawLines.push(current);
          i++;
          continue;
        }
        // Next field or @@ directive
        if (t.startsWith("@@") || /^\w+\s+/.test(t)) break;
        rawLines.push(current);
        i++;
      }
      fields.push({ name: fieldName, raw: rawLines.join("\n").trim() });
      continue;
    }

    i++;
  }

  return { name: modelName, fields };
}

/**
 * Parse full Prisma schema content into structured data.
 */
export function parseSchema(content: string): ParsedSchema {
  const result: ParsedSchema = {
    datasource: null,
    generator: null,
    models: new Map(),
  };

  let lastEnd = 0;

  for (;;) {
    BLOCK_START.lastIndex = lastEnd;
    const next = extractBlock(content, lastEnd);
    if (!next) break;

    const { block } = next;
    lastEnd = next.endIndex;

    if (block.kind === "datasource") result.datasource = block;
    else if (block.kind === "generator") result.generator = block;
    else if (block.kind === "model" && block.model) result.models.set(block.model.name, block.model);
  }

  return result;
}

/**
 * Parse plugin schema content (models only; no datasource/generator).
 */
export function parsePluginSchema(content: string): Map<string, ParsedModel> {
  const full = parseSchema(content);
  return full.models;
}
