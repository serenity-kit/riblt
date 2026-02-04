# RIBLT Implementation Plan (TypeScript)

Date: 2026-02-03

## Goals
- Implement RIBLT set reconciliation in TypeScript for string IDs.
- Provide a clear, transport-agnostic API for multi-round exchanges.
- Ensure deterministic interoperability and test coverage.

## Proposed Public API (Draft)
- `createRiblt(options)`
- `add(ids: Iterable<string>)`
- `encode(): Uint8Array | RibltMessage`
- `merge(msg: Uint8Array | RibltMessage)`
- `decode(): { status: "complete" | "incomplete" | "failed"; missing: string[]; extra: string[] }`

## Tasks
1) **Read & Extract Algorithm Details**
   - Summarize the paper’s core algorithm, parameters, and decoding steps.
   - Identify required hashing and finite-field operations.
   - Extract serialization format requirements from the Go implementation.

2) **Define Types & Message Format**
   - Decide on a canonical message schema (binary or JSON-friendly).
   - Specify versioning, endianness, and limits.
   - Define TypeScript types for internal cells and messages.

3) **Hashing & Encoding Utilities**
   - Vendor a local XXH3-128 implementation (ported from `xxh3-ts`) to avoid external runtime deps.
   - Implement string->bytes encoding (UTF-8).
   - Implement field ops / XOR ops needed by RIBLT.

4) **Core Data Structure**
   - Implement RIBLT table/cell structure.
   - Implement insert/delete/add operations.
   - Implement merge (XOR) with remote sketch.

5) **Decoder**
   - Implement peel/resolve logic with failure detection.
   - Track missing/extra IDs deterministically.
   - Return status: complete/incomplete/failed.

6) **API Layer**
   - Provide ergonomic wrapper around core.
   - Ensure multi-round usage is supported.
   - Provide stable deterministic behavior for test fixtures.

7) **Tests**
   - Unit tests for hashing/encoding.
   - Round-trip tests for small sets.
   - Fuzz-ish tests with random sets and bounded diff.
   - Tests for incomplete/failed scenarios.

8) **Docs & Examples**
   - Update README with usage snippet and limitations.
   - Document parameter choices (expected diff, error rate).

## Open Questions
Resolved decisions:
- **Default hash:** Vendor a local XXH3-128 implementation (ported from `xxh3-ts`) under `src/utils/xxh3.ts` and use it by default; expose `hash` override for portability. Deterministic output is required for cross-language interop.
- **Serialization:** Default to compact binary (`Uint8Array`) for transport efficiency; also expose a JSON-friendly POJO format for easy debugging and non-binary transports.
- **Parameter tuning:** Expose `expectedDiff` and `errorRate` in `createRiblt(options)` with sensible defaults; also allow advanced users to pass explicit `cells`, `hashes`, and `seed` to match other implementations.
