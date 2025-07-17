# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript source (currently `src/index.ts`).
- `test/` contains Vitest specs (e.g., `test/index.test.ts`).
- `dist/` is the generated build output and should not be edited by hand.
- Root configs include `tsconfig.json` (TypeScript) and `vitest.config.ts` (tests).

## Build, Test, and Development Commands
- `pnpm install` installs dependencies.
- `pnpm build` builds ESM/CJS bundles plus type declarations via `tsup` into `dist/`.
- `pnpm test` runs the Vitest suite once.
- `pnpm test:watch` runs Vitest in watch mode for local development.
- `pnpm lint` runs `tsc --noEmit` to type-check without emitting files.

## Coding Style & Naming Conventions
- Use 2-space indentation, double quotes, and semicolons (match existing files).
- Keep modules small and focused; prefer named exports from `src/index.ts`.
- Name tests as `*.test.ts` under `test/` (e.g., `test/foo.test.ts`).
- TypeScript is in `strict` mode; avoid `any` unless justified.

## Testing Guidelines
- Test framework: Vitest (Node environment, globals enabled).
- Place new tests under `test/` and follow the `test/**/*.test.ts` pattern.
- Run `pnpm test` before opening a PR; add coverage where behavior changes.

## Commit & Pull Request Guidelines
- Git history is minimal and does not show a formal commit convention.
- Use short, imperative commit subjects (e.g., "Add RIBLT encoder").
- PRs should include a brief description, testing notes (`pnpm test` output),
  and any relevant context or links to issues.

## Notes
- The build script references `src/doc-uuid256.ts` and `src/uuid.ts`; if you
  add or remove entrypoints, update `package.json` accordingly.
