# create-nomos

Scaffold a new Nomos project powered by `nomos-core`.

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

If you choose the web option, the CLI shells out to the official Astro initializer and lets you answer its prompts.

## Auth option

- **auth** (default)
- **no auth**

The selection is written into `nomos.config.ts` with the module toggle (`modules.auth`).

## Database option

- **SQLite** (default)
- **Postgres**
- **MySQL**

SQLite skips a database URL prompt. Postgres/MySQL prompt for `DATABASE_URL` and write it to `.env`. An `.env.example` file is always created with a commented example.

## Local development in this repo

```bash
npm run create:nomos -- my-app
```

Build the CLI first if you want to run the compiled entry directly:

```bash
npm --prefix packages/create-nomos run build
node packages/create-nomos/dist/index.js my-app
```
