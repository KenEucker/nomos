import { createHash } from "node:crypto";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

const NOMOS_UI_REPO = "keneucker/nomos-ui";
const NOMOS_UI_BRANCH = "production";
const TARBALL_URL = `https://codeload.github.com/${NOMOS_UI_REPO}/tar.gz/refs/heads/${NOMOS_UI_BRANCH}`;
const DEST_RELATIVE_ROOT = "apps/app/src/admin-ui/src";
const ALLOWLIST = ["src/components", "src/islands", "src/lib", "src/styles"];
const EXCLUDE = ["src/pages", "src/shadcn-svelte", "astro.config.*"];

function logInfo(message) {
  console.log(`[nomos sync] ${message}`);
}

function logWarn(message) {
  console.warn(`[nomos sync] ${message}`);
}

function logError(message) {
  console.error(`[nomos sync] ${message}`);
}

function ensureInsideRoot(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`) && resolvedTarget !== resolvedRoot) {
    throw new Error(`Refusing to write outside destination root: ${resolvedTarget}`);
  }
}

async function downloadTarball(tempDir) {
  const tarPath = path.join(tempDir, "nomos-ui.tar.gz");
  await new Promise((resolve, reject) => {
    const request = https.get(TARBALL_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download tarball: ${response.statusCode}`));
        response.resume();
        return;
      }
      const fileStream = fs.createWriteStream(tarPath);
      pipeline(response, fileStream).then(resolve).catch(reject);
    });
    request.on("error", reject);
  });
  return tarPath;
}

async function extractTarball(tarPath, extractDir) {
  await new Promise((resolve, reject) => {
    const child = spawn("tar", ["-xzf", tarPath, "-C", extractDir], {
      stdio: "inherit"
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error("The 'tar' utility is required but was not found on PATH."));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Tar extraction failed with exit code ${code}.`));
        return;
      }
      resolve();
    });
  });
}

async function findExtractedRoot(extractDir) {
  const entries = await fsp.readdir(extractDir, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (folders.length !== 1) {
    throw new Error(`Expected a single extracted folder, found ${folders.length}.`);
  }
  const folder = folders[0];
  const dashIndex = folder.lastIndexOf("-");
  if (dashIndex === -1 || dashIndex === folder.length - 1) {
    throw new Error(`Unable to parse SHA from folder name: ${folder}`);
  }
  const sha = folder.slice(dashIndex + 1);
  return { root: path.join(extractDir, folder), sha };
}

async function computeHash(filePath) {
  const hash = createHash("sha256");
  const data = await fsp.readFile(filePath);
  hash.update(data);
  return hash.digest("hex");
}

async function filesDiffer(sourcePath, destPath) {
  try {
    const [sourceStat, destStat] = await Promise.all([fsp.stat(sourcePath), fsp.stat(destPath)]);
    if (sourceStat.size !== destStat.size) {
      return true;
    }
    const [sourceHash, destHash] = await Promise.all([
      computeHash(sourcePath),
      computeHash(destPath)
    ]);
    return sourceHash !== destHash;
  } catch (error) {
    if (error.code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

async function copyFileIfChanged(sourcePath, destPath, changed) {
  if (await filesDiffer(sourcePath, destPath)) {
    await fsp.mkdir(path.dirname(destPath), { recursive: true });
    await fsp.copyFile(sourcePath, destPath);
    changed.push(destPath);
    return true;
  }
  return false;
}

async function copyDirectory({ sourceRoot, destRoot, relativeRoot, changed, stats }) {
  const entries = await fsp.readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const relativePath = path.join(relativeRoot, entry.name);
    const destPath = path.join(destRoot, relativePath);
    ensureInsideRoot(destRoot, destPath);

    if (entry.isDirectory()) {
      await copyDirectory({
        sourceRoot: sourcePath,
        destRoot,
        relativeRoot: relativePath,
        changed,
        stats
      });
      continue;
    }

    if (entry.isFile()) {
      stats.scanned += 1;
      await copyFileIfChanged(sourcePath, destPath, changed);
    }
  }
}

async function ensureAllowlistExists(extractedRoot) {
  for (const entry of ALLOWLIST) {
    const sourcePath = path.join(extractedRoot, entry);
    try {
      const stat = await fsp.stat(sourcePath);
      if (!stat.isDirectory()) {
        throw new Error();
      }
    } catch {
      throw new Error(`Required source directory missing: ${entry}`);
    }
  }

  const srcRoot = path.join(extractedRoot, "src");
  const entries = await fsp.readdir(srcRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const relPath = path.join("src", entry.name);
    if (!ALLOWLIST.includes(relPath) && !EXCLUDE.includes(relPath)) {
      logWarn(`Source path ${relPath} is not in allowlist and will not be imported.`);
    }
  }
}

async function writeVendorState(repoRoot, sha) {
  const vendorDir = path.join(repoRoot, ".vendor");
  await fsp.mkdir(vendorDir, { recursive: true });
  const payload = {
    source: "github-tarball",
    repo: NOMOS_UI_REPO,
    branch: NOMOS_UI_BRANCH,
    sha,
    importedAt: new Date().toISOString(),
    include: [...ALLOWLIST],
    exclude: [...EXCLUDE]
  };
  const statePath = path.join(vendorDir, "nomos-ui.json");
  await fsp.writeFile(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return statePath;
}

function formatChangedList(changed, limit = 50) {
  if (changed.length === 0) {
    return "(none)";
  }
  const lines = changed.slice(0, limit);
  const remainder = changed.length - lines.length;
  const formatted = lines.map((item) => `- ${item}`).join("\n");
  if (remainder > 0) {
    return `${formatted}\n+${remainder} more`;
  }
  return formatted;
}

export async function syncAdminUiFromNomosUi({ repoRoot, noPrompt } = {}) {
  if (!repoRoot) {
    throw new Error("repoRoot is required.");
  }

  const destinationRoot = path.join(repoRoot, DEST_RELATIVE_ROOT);
  try {
    const stat = await fsp.stat(destinationRoot);
    if (!stat.isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(`Destination root does not exist: ${DEST_RELATIVE_ROOT}`);
  }

  if (!noPrompt) {
    logInfo("Syncing admin UI runtime from nomos-ui.");
  }

  const tempBase = await fsp.mkdtemp(path.join(os.tmpdir(), "nomos-ui-sync-"));
  const extractDir = path.join(tempBase, "extract");
  await fsp.mkdir(extractDir, { recursive: true });

  let sha = "";
  const changed = [];
  const stats = { scanned: 0 };

  try {
    const tarPath = await downloadTarball(tempBase);
    await extractTarball(tarPath, extractDir);
    const extracted = await findExtractedRoot(extractDir);
    sha = extracted.sha;

    await ensureAllowlistExists(extracted.root);

    for (const includePath of ALLOWLIST) {
      const sourceRoot = path.join(extracted.root, includePath);
      const relativeRoot = path.relative("src", includePath);
      await copyDirectory({
        sourceRoot,
        destRoot: destinationRoot,
        relativeRoot,
        changed,
        stats
      });
    }

    await writeVendorState(repoRoot, sha);
  } finally {
    await fsp.rm(tempBase, { recursive: true, force: true });
  }

  const changedRelative = changed
    .map((item) => path.relative(destinationRoot, item))
    .map((item) => item.split(path.sep).join("/"));

  logInfo(`Imported SHA: ${sha}`);
  logInfo(`Files scanned: ${stats.scanned}`);
  logInfo(`Files changed: ${changedRelative.length}`);
  logInfo(`Changed files:\n${formatChangedList(changedRelative)}`);

  return { sha, changed: changedRelative };
}

export function getNomosUiSyncConfig() {
  return {
    repo: NOMOS_UI_REPO,
    branch: NOMOS_UI_BRANCH,
    include: [...ALLOWLIST],
    exclude: [...EXCLUDE],
    dest: DEST_RELATIVE_ROOT
  };
}
