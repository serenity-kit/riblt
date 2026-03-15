# orp-demo example

Run the demonstration:

```sh
pnpm build
pnpm --filter orp-demo-example start
```

The example performs:

- inventory reconciliation across document summaries
- deterministic chunk reconciliation across unordered operation sets
- per-document repair across operation ids
- chunk or blob transfer for missing data, depending on diff size

It uses a simple grow-only set CRDT and deterministic hash buckets to show why chunking can be useful without introducing a causal commit DAG.
