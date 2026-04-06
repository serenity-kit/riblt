import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  OrpEndpointSession,
  createOrpEndpointSession,
  type BlobUnit,
  type ChunkSummary,
  type ChunkUnit,
  type DocSummary,
  type OrpChunkingDescriptor,
  type OrpEndpointSessionOptions,
  type OrpMessage,
  type OrpParameters,
  type OrpPeerAdapter,
  type OrpPeerDocumentView,
  type OrpSnapshotPayload,
} from "../src/index";

type TestOp = {
  opId: string;
  value: string;
};

type TestSeed = Array<{ docHandle: string; values: string[] }>;

type TestDoc = {
  ops: Map<string, TestOp>;
  values: Set<string>;
};

type Envelope = {
  target: "initiator" | "responder";
  message: OrpMessage;
};

const DIGEST_MASK = (1n << 128n) - 1n;
const CHUNK_BUCKET_COUNT = 4;
const PARAMS: OrpParameters = {
  symbolSize: 64,
  batchSize: 3,
  hashSeed: "0000000000000007",
};

class TestPeer implements OrpPeerAdapter {
  private readonly documents = new Map<string, TestDoc>();
  private readonly snapshotThreshold: number;

  constructor(seed: TestSeed, snapshotThreshold: number) {
    this.snapshotThreshold = snapshotThreshold;
    for (const entry of seed) {
      for (const value of entry.values) {
        this.applyValue(entry.docHandle, value);
      }
    }
  }

  listInventoryEntries() {
    return [...this.documents.keys()]
      .sort()
      .map((docHandle) => {
        const summaryHash = docSummaryHash(this.createDocSummary(docHandle));
        return {
          docHandle,
          summaryHash,
          entryId: hashHex([docHandle, summaryHash]),
        };
      });
  }

  getDocumentView(docHandle: string): OrpPeerDocumentView {
    return {
      summary: this.createDocSummary(docHandle),
      recentSnapshots: this.getRecentSnapshots(docHandle),
      chunking: this.createChunkingDescriptor(docHandle),
    };
  }

  listChunkEntries(docHandle: string) {
    return this.getChunkSummaries(docHandle).map((summary) => {
      const summaryHash = chunkSummaryHash(summary);
      return {
        chunkId: summary.chunkId,
        summaryHash,
        entryId: hashHex([docHandle, summary.chunkId, summaryHash]),
      };
    });
  }

  listOperationIds(docHandle: string): string[] {
    const doc = this.documents.get(docHandle);
    return doc ? [...doc.ops.keys()].sort() : [];
  }

  getBlobUnits(docHandle: string, opIds: string[]): BlobUnit[] {
    const doc = this.getOrCreateDoc(docHandle);
    return opIds.map((opId) => {
      const op = doc.ops.get(opId);
      if (!op) {
        throw new Error(`missing operation ${opId}`);
      }
      return {
        opId,
        blob: JSON.stringify(op),
      };
    });
  }

  applyBlobUnits(docHandle: string, ops: BlobUnit[]): void {
    for (const unit of ops) {
      this.applyOp(docHandle, JSON.parse(unit.blob) as TestOp);
    }
  }

  getChunkUnits(docHandle: string, chunkIds: string[]): ChunkUnit[] {
    return chunkIds.map((chunkId) => {
      const ops = this.getChunkOperations(docHandle, chunkId);
      return {
        chunkId,
        opIds: ops.map((op) => op.opId),
        blob: JSON.stringify(ops),
      };
    });
  }

  applyChunkUnits(docHandle: string, chunks: ChunkUnit[]): void {
    for (const chunk of chunks) {
      for (const op of JSON.parse(chunk.blob) as TestOp[]) {
        this.applyOp(docHandle, op);
      }
    }
  }

  getSnapshotPayload(docHandle: string, snapshotId: string): OrpSnapshotPayload | undefined {
    const doc = this.documents.get(docHandle);
    if (!doc || snapshotId !== snapshotIdForDoc(docHandle)) {
      return undefined;
    }
    const ops = [...doc.ops.values()].sort((a, b) => a.opId.localeCompare(b.opId));
    if (ops.length < this.snapshotThreshold) {
      return undefined;
    }
    const pivot = Math.max(1, Math.floor(ops.length / 2));
    return {
      snapshot: {
        snapshotId,
        blob: JSON.stringify(ops.slice(0, pivot)),
      },
      tailOps: ops.slice(pivot).map((op) => ({
        opId: op.opId,
        blob: JSON.stringify(op),
      })),
    };
  }

  applySnapshotPayload(docHandle: string, payload: OrpSnapshotPayload): void {
    for (const op of JSON.parse(payload.snapshot.blob) as TestOp[]) {
      this.applyOp(docHandle, op);
    }
    this.applyBlobUnits(docHandle, payload.tailOps);
  }

  materialize(): Record<string, string[]> {
    return Object.fromEntries(
      [...this.documents.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([docHandle, doc]) => [docHandle, [...doc.values].sort()])
    );
  }

  private applyValue(docHandle: string, value: string): void {
    this.applyOp(docHandle, {
      opId: hashHex([docHandle, value, "op"]),
      value,
    });
  }

  private applyOp(docHandle: string, op: TestOp): void {
    const doc = this.getOrCreateDoc(docHandle);
    if (doc.ops.has(op.opId)) {
      return;
    }
    doc.ops.set(op.opId, op);
    doc.values.add(op.value);
  }

  private getOrCreateDoc(docHandle: string): TestDoc {
    let doc = this.documents.get(docHandle);
    if (!doc) {
      doc = { ops: new Map(), values: new Set() };
      this.documents.set(docHandle, doc);
    }
    return doc;
  }

  private createDocSummary(docHandle: string): DocSummary {
    const doc = this.documents.get(docHandle);
    if (!doc) {
      return {
        docHandle,
        tailCount: 0,
        xorA: zeroDigest(),
        xorB: zeroDigest(),
        sumA: zeroDigest(),
        sumB: zeroDigest(),
      };
    }

    let xorA = 0n;
    let xorB = 0n;
    let sumA = 0n;
    let sumB = 0n;
    const opIds = [...doc.ops.keys()].sort();
    for (const opId of opIds) {
      xorA ^= digestToBigInt(hashHex([docHandle, opId, "xorA"]));
      xorB ^= digestToBigInt(hashHex([docHandle, opId, "xorB"]));
      sumA = (sumA + digestToBigInt(hashHex([docHandle, opId, "sumA"]))) & DIGEST_MASK;
      sumB = (sumB + digestToBigInt(hashHex([docHandle, opId, "sumB"]))) & DIGEST_MASK;
    }

    return {
      docHandle,
      tailCount: opIds.length,
      xorA: bigIntToDigest(xorA),
      xorB: bigIntToDigest(xorB),
      sumA: bigIntToDigest(sumA),
      sumB: bigIntToDigest(sumB),
    };
  }

  private getRecentSnapshots(docHandle: string): string[] {
    const doc = this.documents.get(docHandle);
    if (!doc || doc.ops.size < this.snapshotThreshold) {
      return [];
    }
    return [snapshotIdForDoc(docHandle)];
  }

  private createChunkingDescriptor(docHandle: string): OrpChunkingDescriptor {
    return {
      algorithm: "hash-bucket/v1",
      bucketCount: CHUNK_BUCKET_COUNT,
      summaries: this.getChunkSummaries(docHandle),
    };
  }

  private getChunkSummaries(docHandle: string): ChunkSummary[] {
    const doc = this.documents.get(docHandle);
    if (!doc) {
      return [];
    }
    const grouped = new Map<string, string[]>();
    for (const opId of [...doc.ops.keys()].sort()) {
      const chunkId = chunkIdForOperation(opId);
      grouped.set(chunkId, [...(grouped.get(chunkId) ?? []), opId]);
    }
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([chunkId, opIds]) => createChunkSummary(chunkId, opIds));
  }

  private getChunkOperations(docHandle: string, chunkId: string): TestOp[] {
    const doc = this.documents.get(docHandle);
    if (!doc) {
      return [];
    }
    return [...doc.ops.values()]
      .filter((op) => chunkIdForOperation(op.opId) === chunkId)
      .sort((left, right) => left.opId.localeCompare(right.opId));
  }
}

describe("OrpEndpointSession", () => {
  it("reconciles a small diff over an in-memory transport", () => {
    const { initiator, responder, initiatorSession, responderSession } = createHarness(
      [{ docHandle: "doc-small", values: ["alpha", "beta"] }],
      [{ docHandle: "doc-small", values: ["alpha"] }],
      { snapshotTailCountThreshold: 6, chunkTransferThreshold: 8 }
    );

    driveSessions(initiatorSession, responderSession);

    expect(initiator.materialize()).toEqual(responder.materialize());
    expect(initiatorSession.getState().phase).toBe("complete");
    expect(responderSession.getState().phase).toBe("complete");
    expect(initiatorSession.getTranscript().map((entry) => entry.message.type)).toEqual(
      expect.arrayContaining(["orp/hello", "orp/doc-frame", "orp/blob-get", "orp/blob-put"])
    );
  });

  it("uses chunk and snapshot branches over the incremental API", () => {
    const chunkHarness = createHarness(
      [{ docHandle: "doc-bulk", values: ["a-1", "a-2", "a-3", "a-4", "a-5", "a-6"] }],
      [{ docHandle: "doc-bulk", values: ["a-1"] }],
      { snapshotTailCountThreshold: 10, chunkTransferThreshold: 2 }
    );

    driveSessions(chunkHarness.initiatorSession, chunkHarness.responderSession);
    expect(chunkHarness.initiator.materialize()).toEqual(chunkHarness.responder.materialize());
    expect(chunkHarness.initiatorSession.getTranscript().map((entry) => entry.message.type)).toEqual(
      expect.arrayContaining(["orp/chunk-frame", "orp/chunk-done", "orp/chunk-get", "orp/chunk-put"])
    );

    const snapshotHarness = createHarness(
      [{ docHandle: "doc-snapshot", values: ["v-1"] }],
      [{ docHandle: "doc-snapshot", values: ["v-1", "v-2", "v-3", "v-4", "v-5", "v-6", "v-7"] }],
      { snapshotTailCountThreshold: 4, chunkTransferThreshold: 99 }
    );

    driveSessions(snapshotHarness.initiatorSession, snapshotHarness.responderSession);
    expect(snapshotHarness.initiator.materialize()).toEqual(snapshotHarness.responder.materialize());
    expect(snapshotHarness.initiatorSession.getTranscript().map((entry) => entry.message.type)).toEqual(
      expect.arrayContaining(["orp/snapshot-get", "orp/snapshot-put"])
    );
  });

  it("can restore mid-session from a serialized snapshot", () => {
    const harness = createHarness(
      [{ docHandle: "doc-restore", values: ["alpha", "beta"] }],
      [{ docHandle: "doc-restore", values: ["alpha"] }],
      { snapshotTailCountThreshold: 6, chunkTransferThreshold: 8 }
    );

    let queue = bootstrap(harness.initiatorSession, harness.responderSession);
    queue = deliverOne(queue, harness.initiatorSession, harness.responderSession);
    queue = deliverOne(queue, harness.initiatorSession, harness.responderSession);

    const restoredInitiator = OrpEndpointSession.restore(
      harness.initiator,
      harness.initiatorSession.snapshot()
    );
    const restoredResponder = OrpEndpointSession.restore(
      harness.responder,
      harness.responderSession.snapshot()
    );

    drainQueue(queue, restoredInitiator, restoredResponder);

    expect(harness.initiator.materialize()).toEqual(harness.responder.materialize());
    expect(restoredInitiator.getState().phase).toBe("complete");
    expect(restoredResponder.getState().phase).toBe("complete");
  });

  it("fails on invalid message ordering", () => {
    const { responderSession } = createHarness(
      [{ docHandle: "doc-invalid", values: ["alpha"] }],
      [{ docHandle: "doc-invalid", values: ["alpha"] }],
      { snapshotTailCountThreshold: 6, chunkTransferThreshold: 8 }
    );

    responderSession.start();
    const result = responderSession.receive({
      type: "orp/doc-frame",
      version: 1,
      sessionId: "session-endpoint",
      docHandle: "doc-invalid",
      frame: {
        v: 1,
        hash: "xxh3-128",
        symbolSize: 64,
        seed: "0000000000000007",
        coded: [],
      },
    });

    expect(result.state.phase).toBe("failed");
  });
});

function createHarness(
  initiatorSeed: TestSeed,
  responderSeed: TestSeed,
  overrides: Partial<OrpEndpointSessionOptions>
) {
  const snapshotTailCountThreshold = overrides.snapshotTailCountThreshold ?? 6;
  const initiator = new TestPeer(initiatorSeed, snapshotTailCountThreshold);
  const responder = new TestPeer(responderSeed, snapshotTailCountThreshold);
  const baseOptions = {
    sessionId: "session-endpoint",
    scopeId: "tenant-endpoint",
    inventoryParams: PARAMS,
    operationParams: PARAMS,
    chunkTransferThreshold: overrides.chunkTransferThreshold ?? 4,
    snapshotTailCountThreshold,
    roundLimit: overrides.roundLimit ?? 64,
  };

  return {
    initiator,
    responder,
    initiatorSession: createOrpEndpointSession(initiator, {
      ...baseOptions,
      role: "initiator",
    }),
    responderSession: createOrpEndpointSession(responder, {
      ...baseOptions,
      role: "responder",
    }),
  };
}

function driveSessions(initiator: OrpEndpointSession, responder: OrpEndpointSession): void {
  const queue = bootstrap(initiator, responder);
  drainQueue(queue, initiator, responder);
}

function bootstrap(initiator: OrpEndpointSession, responder: OrpEndpointSession): Envelope[] {
  const queue: Envelope[] = [];
  for (const message of initiator.start()) {
    queue.push({ target: "responder", message });
  }
  for (const message of responder.start()) {
    queue.push({ target: "initiator", message });
  }
  return queue;
}

function deliverOne(
  queue: Envelope[],
  initiator: OrpEndpointSession,
  responder: OrpEndpointSession
): Envelope[] {
  if (queue.length === 0) {
    return queue;
  }
  const [{ target, message }, ...rest] = queue;
  const session = target === "initiator" ? initiator : responder;
  const nextTarget = target === "initiator" ? "responder" : "initiator";
  const result = session.receive(message);
  return [
    ...rest,
    ...result.messages.map((outbound): Envelope => ({
      target: nextTarget,
      message: outbound,
    })),
  ];
}

function drainQueue(
  queue: Envelope[],
  initiator: OrpEndpointSession,
  responder: OrpEndpointSession
): void {
  let current = queue;
  let safety = 0;
  while (current.length > 0 && safety < 512) {
    current = deliverOne(current, initiator, responder);
    safety += 1;
  }
  if (current.length > 0) {
    throw new Error("transport queue did not drain");
  }
}

function createChunkSummary(chunkId: string, opIds: string[]): ChunkSummary {
  let xorA = 0n;
  let xorB = 0n;
  let sumA = 0n;
  let sumB = 0n;

  for (const opId of opIds) {
    xorA ^= digestToBigInt(hashHex([chunkId, opId, "xorA"]));
    xorB ^= digestToBigInt(hashHex([chunkId, opId, "xorB"]));
    sumA = (sumA + digestToBigInt(hashHex([chunkId, opId, "sumA"]))) & DIGEST_MASK;
    sumB = (sumB + digestToBigInt(hashHex([chunkId, opId, "sumB"]))) & DIGEST_MASK;
  }

  return {
    chunkId,
    opCount: opIds.length,
    xorA: bigIntToDigest(xorA),
    xorB: bigIntToDigest(xorB),
    sumA: bigIntToDigest(sumA),
    sumB: bigIntToDigest(sumB),
  };
}

function docSummaryHash(summary: DocSummary): string {
  return hashHex([
    summary.docHandle,
    summary.basisSnapshotId ?? "",
    String(summary.tailCount),
    summary.xorA,
    summary.xorB,
    summary.sumA,
    summary.sumB,
  ]);
}

function chunkSummaryHash(summary: ChunkSummary): string {
  return hashHex([
    summary.chunkId,
    String(summary.opCount),
    summary.xorA,
    summary.xorB,
    summary.sumA,
    summary.sumB,
  ]);
}

function hashHex(parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 32);
}

function chunkIdForOperation(opId: string): string {
  const bucket = Number(digestToBigInt(hashHex([opId, "bucket"])) % BigInt(CHUNK_BUCKET_COUNT));
  return `bucket-${bucket}`;
}

function snapshotIdForDoc(docHandle: string): string {
  return `snapshot-${hashHex([docHandle, "snapshot"]).slice(0, 12)}`;
}

function zeroDigest(): string {
  return "0".repeat(32);
}

function digestToBigInt(digest: string): bigint {
  return BigInt(`0x${digest}`);
}

function bigIntToDigest(value: bigint): string {
  return (value & DIGEST_MASK).toString(16).padStart(32, "0");
}
