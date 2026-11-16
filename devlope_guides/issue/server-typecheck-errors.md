# Server Type Check Fails After Database Refactor

- Status: Open
- Severity: Medium
- Scope: Current `dev` branch
- Primary gate: Gate 1, implementation completeness and required verification
- Related review: [pending-dev-review](../review/pending-dev-review.md)

## Problem

`tsconfig.server.json` includes all files under `src/`, `tests/`, and `scripts/`.

Run:

```text
bunx tsc -p tsconfig.server.json --noEmit
```

The command reports 13 TypeScript errors in 7 files.

Six errors are in test files. Seven errors are in source files.

The test errors include:

- Four possible `null` errors in `src/core/database.integration.test.ts`.
- One missing `SQL.TransactionSQL` type in the same file.
- One `never` type error in `src/server/routes/subscription.test.ts`.

The source errors include:

- One missing `override` modifier in `src/core/database.ts`.
- One database environment type error in the same file.
- One possibly undefined migration version in `src/core/databaseMigrations.ts`.
- Two `unknown` value errors in `src/core/postgresPresetStorage.ts`.
- One `unknown` schema error in `src/deposit/presets.ts`.
- One duplicate `merchant_ref` property in `src/domains/deposit.ts:773`.

## Impact

The server TypeScript check fails.

The branch does not pass the TypeScript verification gate.

The API build passes, but the build does not report these type errors.

The test scope explains six errors only. It does not explain the seven source errors.

## Branch ownership

This issue is related to the current branch changes.

The branch adds database adapter code and integration test code.

The issue is separate from the import-boundary repair in the three feature services.

The tracking file does not make the TypeScript check pass.

## Required action

1. Fix the seven source errors.
2. Fix the six test errors.
3. Check the Bun runtime version and the locked `@types/bun` version for compatibility.
4. Run the server TypeScript check again.

Do not exclude tests only to reduce the error count.

## Risk → Test → Test layer

Risk: The branch can merge without a passing server TypeScript check.

Test: `bunx tsc -p tsconfig.server.json --noEmit`

Test layer: TypeScript compiler check.
