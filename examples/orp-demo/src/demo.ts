import { createHash } from "node:crypto";
import {
  OrpSession,
  type BlobUnit,
  type ChunkSummary,
  type ChunkUnit,
  type DocSummary,
  type OrpChunkingDescriptor,
  type OrpParameters,
  type OrpPeerAdapter,
  type OrpPeerDocumentView,
  type OrpSnapshotPayload,
  type OrpTranscriptEvent,
} from "@riblt/orp";

export type TranscriptEntry = OrpTranscriptEvent;

export type DemoOp = {
  opId: string;
  value: string;
};

export type DemoSeed = Array<{ docHandle: string; values: string[] }>;

type InventoryEntry = {
  entryId: string;
  docHandle: string;
  summaryHash: string;
};

type ChunkInventoryEntry = {
  entryId: string;
  chunkId: string;
  summaryHash: string;
};

type DemoDoc = {
  docHandle: string;
  ops: Map<string, DemoOp>;
  values: Set<string>;
};

export interface DemoScenarioResult {
  initiator: Record<string, string[]>;
  responder: Record<string, string[]>;
  transcript: TranscriptEntry[];
}

const DIGEST_MASK = (1n << 128n) - 1n;
export const SESSION_ID = "orp-demo-session";
export const SCOPE_ID = "tenant-demo";
export const CHUNK_BUCKET_COUNT = 4;
export const CHUNK_TRANSFER_THRESHOLD = 4;
export const SNAPSHOT_TAIL_COUNT_THRESHOLD = 6;
export const PARAMS: OrpParameters = {
  symbolSize: 64,
  batchSize: 3,
  hashSeed: "0000000000000007",
};

export const DEFAULT_INITIATOR_SEED: DemoSeed = [
  { docHandle: "doc-notes", values: ["agenda", "draft", "owner:alice"] },
  { docHandle: "doc-roadmap", values: ["milestone-a", "milestone-c", "milestone-d", "milestone-e"] },
  { docHandle: "doc-shopping", values: ["apples", "olive-oil", "tea"] },
];

export const DEFAULT_RESPONDER_SEED: DemoSeed = [
  { docHandle: "doc-notes", values: ["agenda", "draft"] },
  { docHandle: "doc-roadmap", values: ["milestone-a", "milestone-b"] },
  { docHandle: "doc-shopping", values: ["apples", "tea"] },
];

class DemoPeer implements OrpPeerAdapter {
  readonly name: string;
  readonly documents = new Map<string, DemoDoc>();

  constructor(name: string, seed: DemoSeed) {
    this.name = name;
    for (const docSeed of seed) {
      for (const value of docSeed.values) {
        this.applyValue(docSeed.docHandle, value);
      }
    }
  }

  getDocumentView(docHandle: string): OrpPeerDocumentView {
    return {
      summary: this.createDocSummary(docHandle),
      recentSnapshots: this.getRecentSnapshots(docHandle),
      chunking: this.createChunkingDescriptor(docHandle),
    };
  }

  getBlobUnits(docHandle: string, opIds: string[]): BlobUnit[] {
    const doc = this.getOrCreateDoc(docHandle);
    return opIds.map((opId) => {
      const op = doc.ops.get(opId);
      if (!op) {
        throw new Error(`missing operation ${opId} in ${docHandle}`);
      }
      return {
        opId,
        blob: JSON.stringify(op),
      };
    });
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

  applyBlobUnits(messageDocHandle: string, ops: BlobUnit[]): void {
    for (const unit of ops) {
      const parsed = JSON.parse(unit.blob) as DemoOp;
      this.applyOp(messageDocHandle, parsed);
    }
  }

  applyChunkUnits(messageDocHandle: string, chunks: ChunkUnit[]): void {
    for (const chunk of chunks) {
      const parsed = JSON.parse(chunk.blob) as DemoOp[];
      for (const op of parsed) {
        this.applyOp(messageDocHandle, op);
      }
    }
  }

  listInventoryEntries(): InventoryEntry[] {
    const entries: InventoryEntry[] = [];
    for (const docHandle of [...this.documents.keys()].sort()) {
      const summaryHash = this.createDocSummaryHash(docHandle);
      entries.push({
        docHandle,
        summaryHash,
        entryId: hashHex([docHandle, summaryHash]),
      });
    }
    return entries;
  }

  listChunkEntries(docHandle: string): ChunkInventoryEntry[] {
    const entries: ChunkInventoryEntry[] = [];
    for (const summary of this.getChunkSummaries(docHandle)) {
      const summaryHash = chunkSummaryHash(summary);
      entries.push({
        chunkId: summary.chunkId,
        summaryHash,
        entryId: hashHex([docHandle, summary.chunkId, summaryHash]),
      });
    }
    return entries;
  }

  createChunkingDescriptor(docHandle: string): OrpChunkingDescriptor {
    return {
      algorithm: "hash-bucket/v1",
      bucketCount: CHUNK_BUCKET_COUNT,
      summaries: this.getChunkSummaries(docHandle),
    };
  }

  createDocSummary(docHandle: string): DocSummary {
    const doc = this.documents.get(docHandle);
    if (!doc) {
      return emptyDocSummary(docHandle);
    }

    const opIds = [...doc.ops.keys()].sort();
    let xorA = 0n;
    let xorB = 0n;
    let sumA = 0n;
    let sumB = 0n;

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

  createDocSummaryHash(docHandle: string): string {
    return docSummaryHash(this.createDocSummary(docHandle));
  }

  getChunkSummaries(docHandle: string): ChunkSummary[] {
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
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chunkId, opIds]) => createChunkSummary(chunkId, opIds));
  }

  listOperationIds(docHandle: string): string[] {
    const doc = this.documents.get(docHandle);
    return doc ? [...doc.ops.keys()].sort() : [];
  }

  getChunkOperations(docHandle: string, chunkId: string): DemoOp[] {
    const doc = this.documents.get(docHandle);
    if (!doc) {
      return [];
    }

    return [...doc.ops.values()]
      .filter((op) => chunkIdForOperation(op.opId) === chunkId)
      .sort((a, b) => a.opId.localeCompare(b.opId));
  }

  materialize(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [docHandle, doc] of [...this.documents.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      out[docHandle] = [...doc.values].sort();
    }
    return out;
  }

  getSnapshotPayload(docHandle: string, snapshotId: string): OrpSnapshotPayload | undefined {
    const doc = this.documents.get(docHandle);
    if (!doc) {
      return undefined;
    }
    if (snapshotId !== snapshotIdForDoc(docHandle)) {
      return undefined;
    }

    const ops = [...doc.ops.values()].sort((a, b) => a.opId.localeCompare(b.opId));
    if (ops.length < SNAPSHOT_TAIL_COUNT_THRESHOLD) {
      return undefined;
    }

    const pivot = Math.max(1, Math.floor(ops.length / 2));
    const snapshotOps = ops.slice(0, pivot);
    const tailOps = ops.slice(pivot).map((op) => ({
      opId: op.opId,
      blob: JSON.stringify(op),
    }));

    return {
      snapshot: {
        snapshotId,
        blob: JSON.stringify(snapshotOps),
      },
      tailOps,
    };
  }

  applySnapshotPayload(docHandle: string, payload: OrpSnapshotPayload): void {
    const snapshotOps = JSON.parse(payload.snapshot.blob) as DemoOp[];
    for (const op of snapshotOps) {
      this.applyOp(docHandle, op);
    }
    this.applyBlobUnits(docHandle, payload.tailOps);
  }

  private applyValue(docHandle: string, value: string): void {
    const opId = hashHex([docHandle, value, "op"]);
    this.applyOp(docHandle, { opId, value });
  }

  private applyOp(docHandle: string, op: DemoOp): void {
    const doc = this.getOrCreateDoc(docHandle);
    if (doc.ops.has(op.opId)) {
      return;
    }
    doc.ops.set(op.opId, op);
    doc.values.add(op.value);
  }

  private getOrCreateDoc(docHandle: string): DemoDoc {
    let doc = this.documents.get(docHandle);
    if (!doc) {
      doc = {
        docHandle,
        ops: new Map(),
        values: new Set(),
      };
      this.documents.set(docHandle, doc);
    }
    return doc;
  }

  private getRecentSnapshots(docHandle: string): string[] {
    const doc = this.documents.get(docHandle);
    if (!doc || doc.ops.size < SNAPSHOT_TAIL_COUNT_THRESHOLD) {
      return [];
    }
    return [snapshotIdForDoc(docHandle)];
  }
}

export function runDemoScenario(
  initiatorSeed: DemoSeed = DEFAULT_INITIATOR_SEED,
  responderSeed: DemoSeed = DEFAULT_RESPONDER_SEED
): DemoScenarioResult {
  const initiator = new DemoPeer("initiator", initiatorSeed);
  const responder = new DemoPeer("responder", responderSeed);
  const session = new OrpSession(initiator, responder, {
    sessionId: SESSION_ID,
    scopeId: SCOPE_ID,
    inventoryParams: PARAMS,
    operationParams: PARAMS,
    chunkTransferThreshold: CHUNK_TRANSFER_THRESHOLD,
    snapshotTailCountThreshold: SNAPSHOT_TAIL_COUNT_THRESHOLD,
  });
  const result = session.run();

  return {
    initiator: initiator.materialize(),
    responder: responder.materialize(),
    transcript: result.transcript,
  };
}

function emptyDocSummary(docHandle: string): DocSummary {
  return {
    docHandle,
    tailCount: 0,
    xorA: bigIntToDigest(0n),
    xorB: bigIntToDigest(0n),
    sumA: bigIntToDigest(0n),
    sumB: bigIntToDigest(0n),
  };
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

function chunkIdForOperation(opId: string): string {
  const bucket = Number(digestToBigInt(hashHex([opId, "bucket"])) % BigInt(CHUNK_BUCKET_COUNT));
  return `bucket-${bucket}`;
}

function snapshotIdForDoc(docHandle: string): string {
  return `snapshot-${hashHex([docHandle, "snapshot"]).slice(0, 12)}`;
}

function hashHex(parts: string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 32);
}

function digestToBigInt(digest: string): bigint {
  return BigInt(`0x${digest}`);
}

function bigIntToDigest(value: bigint): string {
  return (value & DIGEST_MASK).toString(16).padStart(32, "0");
}
