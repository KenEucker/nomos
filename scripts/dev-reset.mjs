#!/usr/bin/env node
/**
 * dev:reset — from repo root (/):
 * - Deletes apps/app/prisma/migrations
 * - Deletes apps/app/prisma/dev.db
 * - Copies core-schema.prisma → schema.prisma
 * - Runs prisma generate from apps/app
 * - Runs npm run migrate (from root)
 * - Runs npm run seed (from root)
 */

import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const appDir = path.join(root, "apps", "app");
const prismaDir = path.join(appDir, "prisma");

// 1. Delete migrations folder
const migrationsPath = path.join(prismaDir, "migrations");
if (fs.existsSync(migrationsPath)) {
  fs.rmSync(migrationsPath, { recursive: true });
  console.log("[dev:reset] Deleted migrations folder");
}

// 2. Delete dev.db
const devDbPath = path.join(prismaDir, "dev.db");
if (fs.existsSync(devDbPath)) {
  fs.unlinkSync(devDbPath);
  console.log("[dev:reset] Deleted dev.db");
}

// 3. Reset schema.prisma from core-schema.prisma
const coreSchemaPath = path.join(prismaDir, "core-schema.prisma");
const schemaPath = path.join(prismaDir, "schema.prisma");
if (!fs.existsSync(coreSchemaPath)) {
  console.error("[dev:reset] core-schema.prisma not found at", coreSchemaPath);
  process.exit(1);
}
fs.copyFileSync(coreSchemaPath, schemaPath);
console.log("[dev:reset] Reset schema.prisma from core-schema.prisma");

// 4. Prisma generate from apps/app
console.log("[dev:reset] Running prisma generate...");
execSync("npx prisma generate", { cwd: appDir, stdio: "inherit" });

// 5. Migrate (from root)
console.log("[dev:reset] Running npm run migrate...");
execSync("npm run migrate", { cwd: root, stdio: "inherit" });

// 6. Seed (from root)
console.log("[dev:reset] Running npm run seed...");
execSync("npm run seed", { cwd: root, stdio: "inherit" });

console.log("[dev:reset] Done.");
