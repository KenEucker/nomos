import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PAGE_EXTENSIONS = new Set([".astro"]);
const SKIP_DIRS = new Set(["node_modules", ".git", ".astro", "dist", "build"]);

const toPosixPath = (value) => value.split(path.sep).join(path.posix.sep);

const resolveAdminUiPaths = (adminUiRoot) => {
  const pluginBaseDir = path.resolve(adminUiRoot, "../plugins");
  const corePagesDir = path.resolve(adminUiRoot, "src/pages");

  return { adminUiRoot, pluginBaseDir, corePagesDir };
};

const walkDirectories = async (root, onDir) => {
  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(root, entry.name);
    const shouldSkip = await onDir(fullPath, entry.name);
    if (shouldSkip) continue;
    await walkDirectories(fullPath, onDir);
  }
};

const walkFiles = async (root, onFile) => {
  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkFiles(path.join(root, entry.name), onFile);
      continue;
    }

    if (!entry.isFile()) continue;
    await onFile(path.join(root, entry.name));
  }
};

const findPagesDirectories = async (pluginRoot) => {
  const pagesDirs = [];

  await walkDirectories(pluginRoot, async (fullPath, name) => {
    if (name === "pages") {
      pagesDirs.push(fullPath);
      return true;
    }
  });

  return pagesDirs;
};

const isPageFile = (filePath) => PAGE_EXTENSIONS.has(path.extname(filePath));

const routeFromFile = (pagesDir, filePath) => {
  const relativePath = toPosixPath(path.relative(pagesDir, filePath));
  const extension = path.extname(relativePath);
  const withoutExtension = extension ? relativePath.slice(0, -extension.length) : relativePath;
  const segments = withoutExtension.split("/").filter(Boolean);

  if (segments[segments.length - 1] === "index") {
    segments.pop();
  }

  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
};

const collectPageRoutes = async ({ pagesDir, sourceLabel }) => {
  const routes = [];

  await walkFiles(pagesDir, async (filePath) => {
    if (!isPageFile(filePath)) return;

    routes.push({
      route: routeFromFile(pagesDir, filePath),
      entrypoint: filePath,
      sourceLabel,
      filePath
    });
  });

  return routes;
};

const collectPluginPages = async ({ pluginBaseDir }) => {
  const pluginEntries = await fs.readdir(pluginBaseDir, { withFileTypes: true });
  const pluginPages = [];

  for (const entry of pluginEntries) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const pluginRoot = path.join(pluginBaseDir, entry.name);
    const pagesDirs = await findPagesDirectories(pluginRoot);

    for (const pagesDir of pagesDirs) {
      pluginPages.push({
        pluginName: entry.name,
        pagesDir
      });
    }
  }

  return pluginPages;
};

const detectRouteCollisions = (routes) => {
  const byRoute = new Map();
  const collisions = [];

  for (const routeEntry of routes) {
    const existing = byRoute.get(routeEntry.route);

    if (existing) {
      collisions.push({ route: routeEntry.route, first: existing, second: routeEntry });
      continue;
    }

    byRoute.set(routeEntry.route, routeEntry);
  }

  return collisions;
};

export const getPluginPageRoutes = async ({ adminUiRoot } = {}) => {
  const root = adminUiRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const { pluginBaseDir } = resolveAdminUiPaths(root);
  const pluginPages = await collectPluginPages({ pluginBaseDir });
  const routes = [];

  for (const { pluginName, pagesDir } of pluginPages) {
    const sourceLabel = `plugin:${pluginName}`;
    const pageRoutes = await collectPageRoutes({ pagesDir, sourceLabel });

    routes.push(
      ...pageRoutes.map((route) => ({
        ...route,
        pagesDir,
        pluginName
      }))
    );
  }

  return { routes, pluginPages, pluginBaseDir, adminUiRoot: root };
};

export const getCorePageRoutes = async ({ adminUiRoot } = {}) => {
  const root = adminUiRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const { corePagesDir } = resolveAdminUiPaths(root);

  try {
    await fs.access(corePagesDir);
  } catch (error) {
    return { routes: [], corePagesDir, adminUiRoot: root };
  }

  const sourceLabel = "core";
  const routes = await collectPageRoutes({ pagesDir: corePagesDir, sourceLabel });

  return { routes, corePagesDir, adminUiRoot: root };
};

export const pluginPages = () => ({
  name: "nomos-plugin-pages",
  hooks: {
    "astro:config:setup": async ({ config, injectRoute, addWatchFile, logger }) => {
      const adminUiRoot = fileURLToPath(config.root);
      const { pluginBaseDir, corePagesDir } = resolveAdminUiPaths(adminUiRoot);

      let pluginPages;
      try {
        pluginPages = await collectPluginPages({ pluginBaseDir });
      } catch (error) {
        logger.warn("nomos-plugin-pages", `Plugins directory not found at ${pluginBaseDir}.`);
        return;
      }

      const coreRoutes = await collectPageRoutes({
        pagesDir: corePagesDir,
        sourceLabel: "core"
      });

      const pluginRoutes = [];

      for (const { pluginName, pagesDir } of pluginPages) {
        addWatchFile(pagesDir);
        const sourceLabel = `plugin:${pluginName}`;
        const pageRoutes = await collectPageRoutes({ pagesDir, sourceLabel });

        pluginRoutes.push(
          ...pageRoutes.map((routeEntry) => ({
            ...routeEntry,
            pagesDir,
            pluginName
          }))
        );
      }

      const collisions = detectRouteCollisions([...coreRoutes, ...pluginRoutes]);

      if (collisions.length > 0) {
        const formatted = collisions
          .map(({ route, first, second }) => {
            const firstSource = `${first.sourceLabel} (${path.relative(adminUiRoot, first.filePath)})`;
            const secondSource = `${second.sourceLabel} (${path.relative(adminUiRoot, second.filePath)})`;
            return `- ${route}\n  - ${firstSource}\n  - ${secondSource}`;
          })
          .join("\n");

        throw new Error(
          [
            "Plugin page routes conflict with existing routes:",
            formatted,
            "Resolve the duplicate route paths to continue."
          ].join("\n")
        );
      }

      for (const routeEntry of pluginRoutes) {
        injectRoute({
          pattern: routeEntry.route,
          entrypoint: routeEntry.entrypoint
        });
      }

      if (pluginRoutes.length > 0) {
        logger.info(
          "nomos-plugin-pages",
          `Injected ${pluginRoutes.length} plugin page route${pluginRoutes.length === 1 ? "" : "s"}.`
        );
      }
    }
  }
});

export { resolveAdminUiPaths };
