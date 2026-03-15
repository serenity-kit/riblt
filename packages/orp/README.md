# @riblt/orp

`@riblt/orp` defines the wire messages, validation helpers, and example transcripts for the Operation Reconciliation Protocol.

## Installation

```sh
pnpm add @riblt/orp
```

## Overview

ORP is a document-scoped anti-entropy protocol for reconciling opaque operations. It uses `riblt` frames for:

- inventory reconciliation across document summaries
- per-document reconciliation across operation ids

The package exports:

- TypeScript interfaces for all protocol messages
- runtime validators and assertion helpers
- reusable example transcripts

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
