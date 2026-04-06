# ORP Implementation Plan

Date: 2026-04-04

## Status

Implemented on 2026-04-04.

This document remains useful as a roadmap record, but the listed milestones are now represented in the repository:

- `OrpSession` owns inventory, chunk, snapshot, and op-repair orchestration in `packages/orp`
- the demo consumes the shared session layer
- ORP and `riblt` input limits are enforced and tested
- a Python harness verifies `interop-v1.json` from a second runtime
- CI covers tests, lint, build, docs, and cross-runtime verification
- benchmark coverage and a checked-in baseline report now exist
- release workflow and release checklist are in place

## Goal

Move the repository from a good reference implementation to a reusable protocol package.

This plan focuses on the work that will make `@riblt/orp` usable as an application-facing package rather than mainly a spec, validator, and demo support layer.

## Current Baseline

Already implemented:

- `riblt` core encoder/decoder with deterministic binary and object wire formats
- ORP message types, validators, and example transcripts
- reusable object-frame exchange helpers in `@riblt/orp`
- chunk-aware ORP demo
- fixture-based interoperability vectors for the TypeScript implementation
- workspace build, test, lint, and docs checks

Main current gap:

- reusable ORP orchestration still lives mostly in `examples/orp-demo`, not in a first-class session API in `@riblt/orp`

## Highest Priority

### 1. ORP Session State Machine

Objective:

- Build a real ORP session API in `@riblt/orp` that owns the protocol phases instead of leaving orchestration logic in the demo.

Why this is first:

- This is the single biggest step from “reference implementation” to “reusable package”.

Scope:

- Introduce a session abstraction for:
  - `hello`
  - inventory reconciliation
  - per-document open/status flow
  - optional chunk reconciliation
  - operation repair
  - blob transfer
  - snapshot fast path hooks
- Make the session transport-neutral:
  - input: local inventory/document accessors plus received ORP messages
  - output: next ORP messages to send plus state transitions/events
- Extract reusable orchestration from `examples/orp-demo/src/demo.ts` into `packages/orp`
- Keep the demo as a thin consumer of the new session API

Deliverables:

- `OrpSession` or equivalent exported from `packages/orp`
- typed session state/events API
- tests for happy-path inventory, chunk, and per-document repair flows
- demo migrated to use the session API

Validation:

- existing demo integration tests still pass
- new package-level tests cover multi-phase session flow
- API docs updated with a session example

Risks / decisions:

- keep the session transport-neutral; do not bake in HTTP, WebSocket, or storage assumptions
- keep application data access behind callbacks/adapters rather than embedding a document store

### 2. Snapshot Fast Path

Objective:

- Implement the `snapshot-get` / `snapshot-put` branch described in the RFC.

Why this is second:

- The protocol already defines snapshot messages, but the repo does not yet implement the main “large divergence” recovery path.

Scope:

- Define snapshot selection behavior:
  - when to prefer snapshot transfer over per-op repair
  - how to represent the chosen basis snapshot in session state
- Implement snapshot request/response handling in the new ORP session layer
- Extend the demo to simulate snapshot transfer and tail-op application
- Add tests for:
  - snapshot chosen because divergence is large
  - snapshot rejected because direct repair is cheaper
  - snapshot plus tail-ops convergence

Deliverables:

- snapshot branch in the session state machine
- demo scenario that exercises snapshot repair
- RFC/docs update showing snapshot decision logic

Validation:

- new end-to-end tests converge via `snapshot-get` / `snapshot-put`
- transcript clearly shows snapshot path when threshold is exceeded

Open design questions to resolve during implementation:

- whether snapshots are represented as opaque blobs only or include summary metadata
- what cost heuristic decides snapshot vs chunk/op repair

### 3. True Cross-Language Verification

Objective:

- Verify that another implementation can consume the committed interoperability vectors and match the TypeScript wire behavior.

Why this is third:

- The current fixture work proves determinism inside TypeScript, but not actual interoperability with a second runtime.

Scope:

- Choose one second implementation target:
  - Go preferred if a suitable reference exists
  - otherwise create a small compatibility harness in a second language/runtime
- Write a verifier that consumes `packages/riblt/test/fixtures/interop-v1.json`
- Validate:
  - binary frame encoding
  - object frame encoding
  - streamed reconciliation result
- Document exactly what is being verified and what is not

Deliverables:

- second-runtime verifier checked into the repo or linked as a sibling verification tool
- documented interop procedure
- CI step or manual script for running the verifier

Validation:

- second implementation passes the committed vectors
- any divergence produces actionable output at the field/frame level

## Second Priority

### 4. Input Limits And Hardening

Objective:

- Add explicit safety limits and adversarial-input coverage at the transport and parser boundaries.

Scope:

- Define maximum accepted values for:
  - coded symbol count per frame
  - symbol size
  - object-frame array lengths
  - transcript/message nesting where relevant
- Fail explicitly on oversized or malformed inputs
- Add negative tests for:
  - oversized binary frames
  - oversized object frames
  - invalid counts and lengths
  - malformed base64/hash payloads
  - pathological round-limit cases

Deliverables:

- explicit limits documented in code and docs
- new failure-path tests in `riblt` and `orp`

Validation:

- malformed input transitions are deterministic and tested
- failure mode is clear to callers

### 5. Benchmarks And Default Tuning

Objective:

- Replace “reasonable defaults” with measured defaults.

Scope:

- Expand benchmark coverage for:
  - varying diff sizes
  - varying `batchSize`
  - chunked vs non-chunked repair
  - snapshot threshold candidates
- Record benchmark baselines in docs or checked-in reports
- Tune:
  - `riblt` default batch sizing heuristic
  - demo chunk transfer threshold
  - future snapshot threshold heuristic

Deliverables:

- expanded benchmark suite
- baseline benchmark report
- updated default values or heuristics with rationale

Validation:

- benchmark runs are reproducible
- changed defaults are justified by measured results

### 6. CI And Release Automation

Objective:

- Turn the current workspace scripts into enforced automation.

Scope:

- Add GitHub Actions for:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm build`
  - docs checks/build
- Define release flow:
  - versioning approach
  - changelog policy
  - npm publish workflow for `riblt` and `@riblt/orp`
- Add release readiness checklist

Deliverables:

- CI workflow files
- release documentation
- publish automation or dry-run workflow

Validation:

- PRs run the full quality gate
- release steps are documented and reproducible

## Nice To Have

### 7. Low-Level Observability In `riblt`

Objective:

- Expose more operational insight without forcing users to instrument internals.

Scope:

- Consider exposing:
  - rounds used
  - coded symbols emitted/received
  - current decode progress
  - failure reason/category
- Keep the public API small and stable

Deliverables:

- small observability surface or debug snapshot API
- tests for exposed metrics/state

### 8. Production Guidance In Docs

Objective:

- Improve operator-facing guidance so users know how to apply the library in production.

Scope:

- Document:
  - when to use binary vs object frames
  - when to switch from op repair to chunk repair
  - when to switch to snapshots
  - how to choose thresholds and defaults
  - what interoperability guarantees exist

Deliverables:

- expanded docs pages and examples
- “production guidance” section in `riblt` and `orp` docs

### 9. Docs Warning Cleanup

Objective:

- Remove the persistent Next.js warning during docs build.

Scope:

- Set `metadataBase` in the docs app
- confirm docs builds are warning-free or reduced to known acceptable warnings

Deliverables:

- docs app metadata configuration updated

Validation:

- `pnpm build` no longer emits the current `metadataBase` warning

## Recommended Execution Order

1. ORP session state machine
2. Snapshot fast path
3. True cross-language verification
4. CI and release automation
5. Benchmark-driven tuning
6. Input limits and hardening
7. Low-level observability
8. Production guidance docs
9. Docs warning cleanup

## Milestone Plan

### Milestone A: Reusable Protocol Core

- ORP session state machine
- demo migration to package session API

Exit criteria:

- demo orchestration logic is thin
- package-level tests cover the protocol phases

### Milestone B: Large-Divergence Support

- snapshot fast path
- snapshot-based demo/test scenario

Exit criteria:

- large-divergence path is implemented and tested

### Milestone C: Interoperability And Safety

- cross-language verification
- input limits and hardening

Exit criteria:

- second implementation consumes fixtures successfully
- malformed and oversized input handling is clearly specified and tested

### Milestone D: Operational Readiness

- CI and release automation
- benchmark-driven tuning
- docs guidance
- docs warning cleanup

Exit criteria:

- PR quality gates run automatically
- defaults are benchmark-backed
- docs are production-oriented

## Out Of Scope For This Plan

- transport-specific integrations
- cryptographic identity/authentication
- real-time subscription semantics
- storage-engine-specific document models
