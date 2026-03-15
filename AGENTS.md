# Repository Guidelines

## Project Structure & Module Organization
- `packages/riblt` contains the core TypeScript RIBLT library.
- `packages/orp` contains the Operation Reconciliation Protocol interfaces and validators.
- `examples/orp-demo` contains the runnable ORP demonstration app.
- Package-local `dist/` folders are generated build output and should not be edited by hand.
- Root config files provide shared workspace defaults; each package owns its local build and test config.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies.
- `pnpm build` builds the workspace packages and the ORP demo example.
- `pnpm test` runs the Vitest suites in workspace packages.
- `pnpm lint` runs `tsc --noEmit` across packages and the example app.
- `pnpm example` starts the built ORP demo from `examples/orp-demo`.

## Coding Style & Naming Conventions
- Use 2-space indentation, double quotes, and semicolons (match existing files).
- Keep modules small and focused; prefer named exports from each package `src/index.ts`.
- Name tests as `*.test.ts` under each package's `test/` directory.
- TypeScript is in `strict` mode; avoid `any` unless justified.

## Testing Guidelines
- Test framework: Vitest (Node environment, globals enabled).
- Place new tests under the relevant package `test/` directory and follow the `test/**/*.test.ts` pattern.
- Run `pnpm test` before opening a PR; add coverage where behavior changes.

## Commit & Pull Request Guidelines
- Git history is minimal and does not show a formal commit convention.
- Use short, imperative commit subjects (e.g., "Add RIBLT encoder").
- PRs should include a brief description, testing notes (`pnpm test` output),
  and any relevant context or links to issues.

## Notes
- `riblt` is the low-level reconciliation engine; `orp` is a higher-level document and operation reconciliation protocol.
- Keep the demo in `examples/orp-demo` thin and focused on showing the protocol flow.
