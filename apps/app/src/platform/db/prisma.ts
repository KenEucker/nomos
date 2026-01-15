import fs from "node:fs"
import path from "node:path"

import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"

let prisma: PrismaClient | undefined

const getNonEmpty = (value: string | undefined) =>
  value && value.trim() !== "" ? value : undefined

/**
 * Gets the DATABASE_URL from process.env.
 * By the time this is called, loadNomosConfig should have already
 * loaded .env files and createApp should have set process.env.DATABASE_URL.
 */
const requireDatabaseUrl = () => {
  const url = getNonEmpty(process.env.DATABASE_URL)

  if (!url) {
    throw new Error(
      `[db] DATABASE_URL is required. Ensure loadNomosConfig() is called before getPrismaClient().`
    )
  }

  return url
}

/**
 * Normalize SQLite "file:" URLs in a portable way.
 *
 * - Keeps absolute paths as-is (file:/abs/path.db)
 * - Resolves relative paths relative to the Prisma schema directory
 *   (apps/app/prisma/schema.prisma) so `file:./dev.db` => apps/app/prisma/dev.db
 * - Ensures the parent directory exists
 */
const normalizeSqliteFileUrl = (databaseUrl: string) => {
  if (!databaseUrl.startsWith("file:")) return databaseUrl

  const raw = databaseUrl.slice("file:".length)

  // Some users may provide `file:` with no path (bad)
  if (!raw || raw.trim() === "") {
    throw new Error(`[db] Invalid DATABASE_URL "${databaseUrl}"`)
  }

  // If already absolute, just ensure directory exists.
  if (path.isAbsolute(raw)) {
    fs.mkdirSync(path.dirname(raw), { recursive: true })
    return `file:${raw}`
  }

  // Resolve RELATIVE TO PRISMA SCHEMA DIRECTORY, not process.cwd()
  // This assumes schema is at apps/app/prisma/schema.prisma (and this file is in apps/app/src/db).
  const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma")
  const schemaDir = path.dirname(schemaPath)

  // inside normalizeSqliteFileUrl, after computing schemaDir
  if (raw.startsWith("./prisma/")) {
    const corrected = `./${raw.slice("./prisma/".length)}`
    console.warn(
      `[db] DATABASE_URL "${databaseUrl}" looks schema-relative but includes "./prisma/". ` +
      `Did you mean "file:${corrected}"? Auto-correcting.`
    )
    const absolutePath = path.resolve(schemaDir, corrected)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    return `file:${absolutePath}`
  }

  const absolutePath = path.resolve(schemaDir, raw)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })

  console.log(`[db] Resolved SQLite file URL "${databaseUrl}" to "${absolutePath}"`)
  return `file:${absolutePath}`
}

export const getPrismaClient = () => {
  if (prisma) return prisma

  const databaseUrlRaw = requireDatabaseUrl()
  const databaseUrl = normalizeSqliteFileUrl(databaseUrlRaw)

  // Keep env consistent for anything else that reads it later (logging, other libs, etc.)
  process.env.DATABASE_URL = databaseUrl

  // Prisma 7 + SQLite requires an adapter
  if (databaseUrl.startsWith("file:")) {
    const adapter = new PrismaBetterSqlite3({ url: databaseUrl })
    prisma = new PrismaClient({ adapter })
    return prisma
  }

  // If/when Nomos supports other DBs, add them here (and keep schema/provider aligned).
  throw new Error(
    `[db] Unsupported DATABASE_URL "${databaseUrl}". ` +
      `This build currently expects SQLite file: URLs.`
  )
}
