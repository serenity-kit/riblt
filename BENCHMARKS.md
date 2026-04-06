# Benchmarks

Date: 2026-04-04

These baselines are intended to keep default choices tied to measured behavior instead of guesswork.

## How To Run

```sh
pnpm bench
```

That runs:

- `pnpm --filter riblt bench`
- `pnpm --filter orp-demo-example bench`

## Current Baseline

### `riblt` symbols per diff

Lower is better. The large-diff target from the RIBLT paper is roughly `~1.35x`.

| Diff | Batch | Symbols / Diff |
| --- | --- | --- |
| 10 | 1 | 2.300 |
| 10 | 2 | 2.400 |
| 10 | 4 | 2.400 |
| 40 | 1 | 1.625 |
| 40 | 2 | 1.650 |
| 40 | 4 | 1.700 |
| 100 | 1 | 1.620 |
| 100 | 2 | 1.620 |
| 100 | 4 | 1.640 |
| 1000 | 1 | 1.435 |
| 1000 | 2 | 1.436 |
| 1000 | 4 | 1.436 |

Observations:

- overhead converges toward the expected large-diff range as `d` grows
- larger batch sizes improve wall-clock throughput more than they improve symbol overhead
- the current `expectedDiff`-based batch heuristic is still reasonable; callers that know they are in a high-throughput path can raise `batchSize`

### ORP demo scenarios

| Scenario | Transcript Events | Mean Time |
| --- | --- | --- |
| ops-repair | 18 | 0.4365 ms |
| chunk-repair | 11 | 1.0756 ms |
| snapshot-repair | 15 | 0.5928 ms |

Observations:

- chunk transfer reduces protocol chatter for localized multi-op diffs, which supports keeping the chunk threshold low
- snapshot repair costs more than direct small-op repair but remains cheaper than replaying large divergence operation-by-operation
- the demo keeps `CHUNK_TRANSFER_THRESHOLD = 4` and `SNAPSHOT_TAIL_COUNT_THRESHOLD = 6` to make those branches easy to trigger in examples
- the package default `ORP_DEFAULT_SNAPSHOT_TAIL_COUNT_THRESHOLD = 12` stays more conservative for real integrations

## Tuning Guidance

- Keep `riblt` `batchSize` near `1` when minimizing overshoot matters more than throughput.
- Raise `batchSize` when `expectedDiff` is large and the transport favors fewer round trips.
- Lower ORP chunk thresholds when operation payloads are large or chunk materialization is cheap.
- Prefer snapshots once tail divergence is already large enough that sending many individual blobs is the expensive path.
