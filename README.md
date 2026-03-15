# riblt workspace

This repository is now a pnpm workspace with three main parts:

- `packages/riblt`: the core Rateless IBLT implementation.
- `packages/orp`: the Operation Reconciliation Protocol interfaces, validators, and chunk-aware repair surface.
- `examples/orp-demo`: a runnable ORP demonstration with a simple CRDT.

## Commands

```sh
pnpm build
pnpm test
pnpm lint
pnpm example
```

## Workspace Layout

- `packages/riblt` publishes the `riblt` package.
- `packages/orp` publishes the `@riblt/orp` package.
- `examples/orp-demo` builds a standalone ORP demonstration.
