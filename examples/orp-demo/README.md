# orp-demo example

Run the demonstration:

```sh
pnpm build
pnpm --filter orp-demo-example start
```

The example performs:

- inventory reconciliation across document summaries
- per-document repair across operation ids
- blob transfer for missing operations

It uses a simple grow-only set CRDT and leaves snapshots disabled to keep the flow small.
