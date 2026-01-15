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

const patchPackageJson = async (targetDir: string, appName: string, coreVersion: string) => {
  const packageJsonPath = path.join(targetDir, "package.json");
  const raw = await fs.readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as {
    name?: string;
    dependencies?: Record<string, string>;
  };
  pkg.name = appName;
  pkg.dependencies = { ...(pkg.dependencies ?? {}), "nomos-core": coreVersion };
  await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
};

const patchNomosConfig = async (
  targetDir: string,
  appName: string,
  authEnabled: boolean,
  hasWeb: boolean,
  database: { dialect: DatabaseChoice | null }
) => {
  const configPath = path.join(targetDir, "nomos.config.ts");
  let contents = await fs.readFile(configPath, "utf8");
  contents = contents
    .replaceAll("__APP_NAME__", appName)
    .replaceAll("__AUTH_ENABLED__", String(authEnabled))
    .replaceAll("__HAS_WEB__", String(hasWeb));

  if (database.dialect === "postgres" || database.dialect === "mysql") {
    contents = contents.replaceAll(
      "__DB_DIALECT__",
      `dialect: "${database.dialect}",`
    );
  } else {
    contents = contents.replaceAll("__DB_DIALECT__", "");
  }

  await fs.writeFile(configPath, contents);
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
        message: "DATABASE_URL"
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

  await ensureEmptyDir(targetDir);

  const packageRoot = getPackageRoot();
  const templateDir = path.join(packageRoot, "templates", "api-admin");
  await fs.cp(templateDir, targetDir, { recursive: true });

  const appName = path.basename(targetDir);
  const coreVersion = await readCreateNomosVersion(packageRoot);

  await patchPackageJson(targetDir, appName, coreVersion);
  await patchNomosConfig(targetDir, appName, authEnabled, hasWeb, {
    dialect: database === "sqlite" ? null : database
  });
  await writeEnvFiles(targetDir, database !== "sqlite" ? databaseUrl ?? "" : null);

  if (hasWeb) {
    const webDir = path.join(targetDir, "apps", "web");
    await fs.mkdir(webDir, { recursive: true });
    await runCreateAstro(packageManager, webDir);
  }

  if (installDeps) {
    await runInstall(packageManager, targetDir);
  }

  printNextSteps(targetDir, packageManager, installDeps, hasWeb);
};
