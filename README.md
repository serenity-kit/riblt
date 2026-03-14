# riblt workspace

This repository is now a pnpm workspace with three parts:

- `packages/riblt`: the core Rateless IBLT implementation.
- `packages/setsync`: a client/server reconciliation protocol built on top of `riblt`.
- `examples/browser-server`: a runnable browser + Node example that demonstrates the protocol.

## Commands

```sh
pnpm build
pnpm test
pnpm lint
pnpm example
```

## Workspace Layout

- `packages/riblt` publishes the `riblt` package.
- `packages/setsync` publishes the `@riblt/setsync` package.
- `examples/browser-server` builds a small demo server and browser client.
