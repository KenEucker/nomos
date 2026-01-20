# create-nomos

Scaffold a new Nomos project with the platform source code embedded in the generated app.

## Usage

```bash
npm create nomos@latest
npx create nomos@latest
npx create-nomos@latest
```

## What gets scaffolded

You can choose between two project types:

- **API & Admin**
- **API & Admin + Web** (runs Astro’s initializer inside `apps/web`)

Nomos copies the platform source into `apps/app` so you can edit it directly.

## Auth option

- **auth** (default)
- **no auth**

The selection is written into `nomos.config.ts` with the module toggle (`modules.auth`).

## Database option

- **SQLite** (default)
- **Postgres**
- **MySQL**

SQLite skips a database URL prompt. Postgres/MySQL prompt for `DATABASE_URL` and write it to `.env`. An `.env.example` file is always created with a commented example.

## Web templates

If you choose the web option, the CLI shells out to the official Astro initializer and lets you answer its prompts. After Astro finishes, you can optionally apply a Nomos web template that adds namespaced pages/components under `src/nomos` plus `/nomos/*` routes and environment wiring.

## Local development in this repo

```bash
npm run create:nomos -- my-app
```

Build the CLI first if you want to run the compiled entry directly:

```bash
npm --prefix packages/create-nomos run build
node packages/create-nomos/dist/index.js my-app
```
