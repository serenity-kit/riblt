# riblt workspace

This repository is now a pnpm workspace with four main parts:

- `packages/riblt`: the core Rateless IBLT implementation.
- `packages/setsync`: a client/server reconciliation protocol built on top of `riblt`.
- `packages/orp`: the Operation Reconciliation Protocol interfaces and validators.
- `examples/browser-server`: a runnable browser + Node example that demonstrates the protocol.
- `examples/orp-demo`: a runnable ORP demonstration with a simple CRDT.

## Commands

```sh
pnpm build
pnpm test
pnpm lint
pnpm example
pnpm example:orp
```

## Workspace Layout

- `packages/riblt` publishes the `riblt` package.
- `packages/setsync` publishes the `@riblt/setsync` package.
- `packages/orp` publishes the `@riblt/orp` package.
- `examples/browser-server` builds a small demo server and browser client.
- `examples/orp-demo` builds a standalone ORP demonstration.
