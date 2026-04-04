# @riblt/orp

`@riblt/orp` defines the wire messages, validation helpers, object-frame RIBLT session helpers, and example transcripts for the Operation Reconciliation Protocol.

## Installation

```sh
pnpm add @riblt/orp
```

## Overview

ORP is a document-scoped anti-entropy protocol for reconciling opaque operations. It uses `riblt` frames for:

- inventory reconciliation across document summaries
- optional chunk reconciliation across deterministic chunk summaries
- per-document reconciliation across operation ids

The package exports:

- TypeScript interfaces for all protocol messages
- runtime validators and assertion helpers
- object-frame `riblt` session helpers for ORP transports
- reusable example transcripts

## Why Chunking Exists

Deterministic chunking gives ORP an intermediate layer between:

- whole-document inventory
- single-operation repair

That is useful when a document contains many operations but only some regions differ. A chunk phase can:

- reduce round trips by narrowing repair before op-by-op descent
- bound work to the mismatching chunks
- allow larger chunk blob transfers when they are cheaper than many tiny op blobs
- improve caching and deduplication across reconnects

ORP uses unordered-op chunking via stable hash buckets. It does not require a causal history DAG or a per-server sequence order.

## Example

```ts
import {
  createOrpRibltSession,
  exchangeOrpRibltFrames,
  type OrpParameters,
} from "@riblt/orp";

const params: OrpParameters = {
  symbolSize: 64,
  batchSize: 4,
  hashSeed: "0000000000000007",
};

const alice = createOrpRibltSession(params);
const bob = createOrpRibltSession(params);
alice.add(["id-1", "id-2", "alice-only"]);
bob.add(["id-1", "id-2", "bob-only"]);

const result = exchangeOrpRibltFrames({
  leftIds: ["id-1", "id-2", "alice-only"],
  rightIds: ["id-1", "id-2", "bob-only"],
  params,
  makeLeftFrame: (frame) => ({
    type: "orp/inventory-frame",
    version: 1,
    sessionId: "session-1",
    frame,
  }),
});

console.log(result.rightResult.missing); // ["alice-only"]
```
