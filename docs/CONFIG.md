# Nomos Configuration (nomos.config.ts)

Nomos supports a first-class project configuration file at the project root.

## Resolution order

Nomos resolves configuration in this priority order and loads the first file it finds:

1. `nomos.config.ts`
2. `nomos.config.mjs`
3. `nomos.config.js`

If none exist, Nomos uses defaults.

## Boolean shorthand for built-in modules

Built-in modules accept a boolean shorthand:

```ts
modules: {
  auth: true,
  admin: false,
  docs: { enabled: true }
}
```

Each boolean value is normalized to `{ enabled: boolean }`.

## Database provider inference

If `database.provider` is omitted, Nomos infers it:

* `url` if `database.url` or `DATABASE_URL` is set
* `sqlite` otherwise (default SQLite file: `prisma/dev.db`)

## pluginManager defaults in production

`modules.pluginManager` defaults to **off** in production unless explicitly enabled.
In development and test, it defaults to **on**.
