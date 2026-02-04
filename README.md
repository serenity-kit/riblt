# riblt - Rateless Invertible Bloom Lookup Tables

RIBLT is a library for performing set reconciliation between two parties.

## Usage

```ts
import { createRiblt } from "riblt";

const alice = createRiblt({ symbolSize: 64, hashSeed: 0n, batchSize: 4 });
const bob = createRiblt({ symbolSize: 64, hashSeed: 0n, batchSize: 4 });

alice.add(["id-1", "id-2", "id-3", "alice-only"]);
bob.add(["id-1", "id-2", "id-3", "bob-only"]);

let result = bob.decode();
while (result.status !== "complete") {
  const msg = alice.encode({ count: 2 });
  bob.merge(msg);
  result = bob.decode();
}

console.log("missing", result.missing); // => ["alice-only"]
console.log("extra", result.extra);     // => ["bob-only"]
```

## Notes

- IDs are encoded into a fixed-size symbol buffer (`symbolSize`). The first 4 bytes store the UTF-8 length.
- The default `symbolSize` is 64 bytes, so IDs longer than 60 bytes will throw.
- `encode()` returns a binary `Uint8Array` by default; use `encode({ format: "object" })` for JSON-friendly payloads.
- Both peers must use the same `symbolSize` and `hashSeed`.
- The package is ESM-only and isomorphic (Node + browser) with a vendored XXH3-128 implementation.
