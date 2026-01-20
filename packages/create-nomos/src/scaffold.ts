import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import prompts from "prompts";
import { execa } from "execa";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

type ProjectType = "api-admin" | "api-admin-web";

type DatabaseChoice = "sqlite" | "postgres" | "mysql";

type ScaffoldOptions = {
  targetDir?: string;
};

type WebTemplate = {
  id: string;
  name: string;
  description: string;
  dir: string;
};

const DEFAULT_TARGET = "nomos-app";

const packageManagerChoices: { title: string; value: PackageManager }[] = [
  { title: "npm", value: "npm" },
  { title: "pnpm", value: "pnpm" },
  { title: "yarn", value: "yarn" },
  { title: "bun", value: "bun" }
];

const projectTypeChoices: { title: string; value: ProjectType }[] = [
  { title: "API & Admin", value: "api-admin" },
  { title: "API & Admin + Web", value: "api-admin-web" }
];

const authChoices = [
  { title: "auth", value: true },
  { title: "no auth", value: false }
];

const databaseChoices: { title: string; value: DatabaseChoice }[] = [
  { title: "SQLite", value: "sqlite" },
  { title: "Postgres", value: "postgres" },
  { title: "MySQL", value: "mysql" }
];

const astroCommands: Record<PackageManager, { command: string; args: string[] }> = {
  npm: { command: "npm", args: ["create", "astro@latest"] },
  pnpm: { command: "pnpm", args: ["create", "astro@latest"] },
  yarn: { command: "yarn", args: ["create", "astro"] },
  bun: { command: "bunx", args: ["create-astro@latest"] }
};

const installCommands: Record<PackageManager, { command: string; args: string[] }> = {
  npm: { command: "npm", args: ["install"] },
  pnpm: { command: "pnpm", args: ["install"] },
  yarn: { command: "yarn", args: ["install"] },
  bun: { command: "bun", args: ["install"] }
};

const getPackageRoot = () => {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..");
};

const getRepoRoot = (packageRoot: string) => {
  return path.resolve(packageRoot, "../..");
};

const onPromptCancel = () => {
  console.log("\nOperation cancelled.");
  process.exit(1);
};

const ensureEmptyDir = async (targetPath: string) => {
  if (!existsSync(targetPath)) {
    await fs.mkdir(targetPath, { recursive: true });
    return;
  }
  const entries = await fs.readdir(targetPath);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${targetPath}`);
  }
};

const readCreateNomosVersion = async (packageRoot: string) => {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const raw = await fs.readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  if (!pkg.version) {
    throw new Error("Unable to determine create-nomos version.");
  }
  return pkg.version;
};

const writeRootPackageJson = async (
  targetDir: string,
  appName: string,
  version: string,
  hasWeb: boolean
) => {
  const workspaces = ["apps/app"].concat(hasWeb ? ["apps/web"] : []);
  const scripts: Record<string, string> = {
    "dev:server": "npm --prefix apps/app run dev",
    "build:server": "npm --prefix apps/app run build",
    migrate: "npm --prefix apps/app run prisma:migrate",
    seed: "npm --prefix apps/app run prisma:seed"
  };

  if (hasWeb) {
    scripts["dev:web"] = "npm --prefix apps/web run dev";
    scripts["build:web"] = "npm --prefix apps/web run build";
    scripts.dev =
      "concurrently -k -n \"server,web\" -c \"cyan,magenta\" \"npm run dev:server\" \"npm run dev:web\"";
    scripts.build = "npm run build:server && npm run build:web";
  } else {
    scripts.dev = "npm run dev:server";
    scripts.build = "npm run build:server";
  }

  const pkg = {
    name: appName,
    version,
    private: true,
    workspaces,
    scripts,
    devDependencies: {
      concurrently: "^9.1.2"
    }
  };

  await fs.writeFile(path.join(targetDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
};

const patchNomosConfig = async (appDir: string, appName: string, authEnabled: boolean) => {
  const configPath = path.join(appDir, "nomos.config.ts");
  let contents = await fs.readFile(configPath, "utf8");
  contents = contents.replace(
    /name:\s+"[^"]+"/, 
    `name: "${appName}"`
  );
  contents = contents.replace(
    /auth:\s+(true|false)/,
    `auth: ${String(authEnabled)}`
  );
  await fs.writeFile(configPath, contents);
};

const patchAppPackageJson = async (appDir: string, version: string) => {
  const packageJsonPath = path.join(appDir, "package.json");
  const raw = await fs.readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  pkg.version = version;
  await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
};

const writeEnvFiles = async (targetDir: string, databaseUrl: string | null) => {
  const examplePath = path.join(targetDir, ".env.example");
  const exampleContents = [
    "# Copy to .env and update values for production.",
    "# DATABASE_URL is required for Postgres/MySQL (leave unset for SQLite).",
    "# DATABASE_URL=postgres://user:password@localhost:5432/nomos",
    ""
  ].join("\n");
  await fs.writeFile(examplePath, exampleContents);

  if (databaseUrl) {
    const envPath = path.join(targetDir, ".env");
    await fs.writeFile(envPath, `DATABASE_URL=${databaseUrl}\n`);
  }
};

const runCreateAstro = async (packageManager: PackageManager, webDir: string) => {
  const command = astroCommands[packageManager];
  await execa(command.command, command.args, { cwd: webDir, stdio: "inherit" });
};

const runInstall = async (packageManager: PackageManager, targetDir: string) => {
  const command = installCommands[packageManager];
  await execa(command.command, command.args, { cwd: targetDir, stdio: "inherit" });
};

const getWebTemplates = (packageRoot: string): WebTemplate[] => {
  return [
    {
      id: "web-basic",
      name: "Nomos Web Basics",
      description: "Namespaced Nomos pages + API helper",
      dir: path.join(packageRoot, "templates", "web-basic")
    }
  ];
};

const copyOverlay = async (sourceDir: string, targetDir: string) => {
  const conflicts: string[] = [];

  const copyRecursive = async (currentSource: string, currentTarget: string) => {
    const entries = await fs.readdir(currentSource, { withFileTypes: true });
    for (const entry of entries) {
      const nextSource = path.join(currentSource, entry.name);
      const nextTarget = path.join(currentTarget, entry.name);
      if (entry.isDirectory()) {
        await fs.mkdir(nextTarget, { recursive: true });
        await copyRecursive(nextSource, nextTarget);
      } else if (entry.isFile()) {
        if (existsSync(nextTarget)) {
          conflicts.push(path.relative(targetDir, nextTarget));
          continue;
        }
        await fs.copyFile(nextSource, nextTarget);
      }
    }
  };

  await copyRecursive(sourceDir, targetDir);
  return conflicts;
};

const updateWebEnvExample = async (webDir: string) => {
  const envPath = path.join(webDir, ".env.example");
  const additions = [
    "",
    "# Nomos API origin (used by SSR routes)",
    "NOMOS_API_ORIGIN=http://localhost:3001",
    "# Public API base for client-side fetches",
    "PUBLIC_NOMOS_API_BASE=http://localhost:3001"
  ].join("\n");

  if (existsSync(envPath)) {
    const current = await fs.readFile(envPath, "utf8");
    if (!current.includes("NOMOS_API_ORIGIN")) {
      await fs.writeFile(envPath, current.trimEnd() + additions + "\n");
    }
  } else {
    await fs.writeFile(envPath, additions.trimStart() + "\n");
  }
};

const applyWebTemplate = async (template: WebTemplate, webDir: string) => {
  const conflicts = await copyOverlay(template.dir, webDir);
  await updateWebEnvExample(webDir);
  if (conflicts.length > 0) {
    console.log("\nTemplate applied with skipped files:");
    for (const conflict of conflicts) {
      console.log(`  - ${conflict}`);
    }
  }
};

const printNextSteps = (
  targetDir: string,
  packageManager: PackageManager,
  installDeps: boolean,
  hasWeb: boolean
) => {
  const relPath = path.relative(process.cwd(), targetDir) || ".";
  console.log("\nNext steps:");
  console.log(`  cd ${relPath}`);
  if (!installDeps) {
    console.log(`  ${packageManager} install`);
  }
  console.log(`  ${packageManager} run dev`);
  if (hasWeb) {
    console.log("  # Web app lives in apps/web (run separately)");
  }
  console.log("");
};

export const scaffold = async (options: ScaffoldOptions) => {
  const response = await prompts(
    [
      !options.targetDir
        ? {
            type: "text",
            name: "targetDir",
            message: "Project directory",
            initial: DEFAULT_TARGET
          }
        : null,
      {
        type: "select",
        name: "packageManager",
        message: "Package manager",
        choices: packageManagerChoices,
        initial: 0
      },
      {
        type: "select",
        name: "projectType",
        message: "Project type",
        choices: projectTypeChoices,
        initial: 0
      },
      {
        type: "select",
        name: "authEnabled",
        message: "Auth",
        choices: authChoices,
        initial: 0
      },
      {
        type: "select",
        name: "database",
        message: "Database",
        choices: databaseChoices,
        initial: 0
      },
      {
        type: (_prev: unknown, values: { database?: DatabaseChoice }) =>
          values.database === "postgres" || values.database === "mysql" ? "text" : null,
        name: "databaseUrl",
        message: "DATABASE_URL",
        validate: (value: string) =>
          value && value.trim().length > 0 ? true : "DATABASE_URL is required"
      },
      {
        type: "confirm",
        name: "installDeps",
        message: "Install dependencies?",
        initial: true
      }
    ].filter(Boolean) as prompts.PromptObject[],
    { onCancel: onPromptCancel }
  );

  const targetDir = path.resolve(options.targetDir ?? response.targetDir ?? DEFAULT_TARGET);
  const packageManager = response.packageManager as PackageManager;
  const projectType = response.projectType as ProjectType;
  const authEnabled = Boolean(response.authEnabled);
  const database = response.database as DatabaseChoice;
  const databaseUrl = response.databaseUrl as string | undefined;
  const installDeps = Boolean(response.installDeps);
  const hasWeb = projectType === "api-admin-web";

  if (database !== "sqlite") {
    console.log(
      "\nNote: The embedded Nomos platform ships with a SQLite-first Prisma schema. " +
        "If you select Postgres/MySQL, you will need to update the Prisma schema and DB wiring."
    );
  }

  await ensureEmptyDir(targetDir);

  const packageRoot = getPackageRoot();
  const repoRoot = getRepoRoot(packageRoot);
  const version = await readCreateNomosVersion(packageRoot);

  const appSource = path.join(repoRoot, "apps", "app");
  const appTarget = path.join(targetDir, "apps", "app");
  await fs.mkdir(path.dirname(appTarget), { recursive: true });
  await fs.cp(appSource, appTarget, { recursive: true });

  await patchNomosConfig(appTarget, path.basename(targetDir), authEnabled);
  await patchAppPackageJson(appTarget, version);

  await writeRootPackageJson(targetDir, path.basename(targetDir), version, hasWeb);
  await writeEnvFiles(targetDir, database !== "sqlite" ? databaseUrl ?? "" : null);

  if (hasWeb) {
    const webDir = path.join(targetDir, "apps", "web");
    await fs.mkdir(webDir, { recursive: true });
    await runCreateAstro(packageManager, webDir);

    const templates = getWebTemplates(packageRoot);
    const applyResponse = await prompts(
      {
        type: "confirm",
        name: "applyTemplates",
        message: "Apply Nomos web template(s)?",
        initial: true
      },
      { onCancel: onPromptCancel }
    );

    if (applyResponse.applyTemplates) {
      const templateChoice = await prompts(
        {
          type: "select",
          name: "templateId",
          message: "Choose a web template",
          choices: templates.map((template) => ({
            title: `${template.name} - ${template.description}`,
            value: template.id
          })),
          initial: 0
        },
        { onCancel: onPromptCancel }
      );

      const selected = templates.find((template) => template.id === templateChoice.templateId);
      if (selected) {
        await applyWebTemplate(selected, webDir);
      }
    }
  }

  if (installDeps) {
    await runInstall(packageManager, targetDir);
  }

  printNextSteps(targetDir, packageManager, installDeps, hasWeb);
};
