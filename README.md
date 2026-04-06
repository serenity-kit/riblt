# riblt workspace

This repository is now a pnpm workspace with three main parts:

- `packages/riblt`: the core Rateless IBLT implementation.
- `packages/orp`: the Operation Reconciliation Protocol surface, validators, and object-frame reconciliation helpers.
- `examples/orp-demo`: a runnable ORP demonstration with a simple CRDT.
- `docs`: the documentation site for both packages.

## Commands

```sh
pnpm build
pnpm test
pnpm lint
pnpm docs:check
pnpm example
```

## Workspace Layout

- `packages/riblt` publishes the `riblt` package.
- `packages/orp` publishes the `@riblt/orp` package, including ORP message types and object-frame RIBLT helpers.
- `examples/orp-demo` builds a standalone ORP demonstration.
- `docs` contains the Next.js/Fumadocs site.
