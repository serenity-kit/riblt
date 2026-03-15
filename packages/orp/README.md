# @riblt/orp

`@riblt/orp` defines the wire messages, validation helpers, and example transcripts for the Operation Reconciliation Protocol.

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
  assertValidOrpMessage,
  ORP_EXAMPLE_TRANSCRIPTS,
  type OrpHelloMessage,
} from "@riblt/orp";

const hello: OrpHelloMessage = {
  type: "orp/hello",
  version: 1,
  sessionId: "orp-demo-session",
  scopeId: "tenant-42",
  inventoryParams: {
    symbolSize: 64,
    batchSize: 4,
    hashSeed: "0000000000000007",
  },
  operationParams: {
    symbolSize: 64,
    batchSize: 4,
    hashSeed: "0000000000000007",
  },
};

assertValidOrpMessage(hello);
console.log(ORP_EXAMPLE_TRANSCRIPTS[0].name);
```
