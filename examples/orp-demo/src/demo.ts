import { createHash } from "node:crypto";
import {
  ORP_PROTOCOL_VERSION,
  assertValidOrpMessage,
  exchangeOrpRibltFrames,
  type BlobUnit,
  type ChunkSummary,
  type ChunkUnit,
  type DocSummary,
  type OrpBlobGetMessage,
  type OrpBlobPutMessage,
  type OrpChunkDoneMessage,
  type OrpChunkGetMessage,
  type OrpChunkPutMessage,
  type OrpFrameMessage,
  type OrpChunkingDescriptor,
  type OrpDocDoneMessage,
  type OrpDocOpenMessage,
  type OrpDocStatusMessage,
  type OrpHelloMessage,
  type OrpInventoryDoneMessage,
  type OrpMessage,
  type OrpParameters,
} from "@riblt/orp";

export type TranscriptEntry = {
  from: string;
  to: string;
  note: string;
  message: OrpMessage;
};

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

type DiffPair = {
  localSummaryHash?: string;
  remoteSummaryHash?: string;
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
export const CHUNK_TRANSFER_THRESHOLD = 2;
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

class DemoPeer {
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

  createHello(): OrpHelloMessage {
    return {
      type: "orp/hello",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      scopeId: SCOPE_ID,
      inventoryParams: PARAMS,
      operationParams: PARAMS,
    };
  }

  createDocOpen(docHandle: string): OrpDocOpenMessage {
    return {
      type: "orp/doc-open",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
    };
  }

  createDocStatus(docHandle: string): OrpDocStatusMessage {
    return {
      type: "orp/doc-status",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      summary: this.createDocSummary(docHandle),
      recentSnapshots: [],
      chunking: this.createChunkingDescriptor(docHandle),
    };
  }

  createBlobPut(docHandle: string, opIds: string[]): OrpBlobPutMessage {
    const doc = this.getOrCreateDoc(docHandle);
    const ops: BlobUnit[] = opIds.map((opId) => {
      const op = doc.ops.get(opId);
      if (!op) {
        throw new Error(`missing operation ${opId} in ${docHandle}`);
      }
      return {
        opId,
        blob: JSON.stringify(op),
      };
    });

    return {
      type: "orp/blob-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      ops,
    };
  }

  createChunkPut(docHandle: string, chunkIds: string[]): OrpChunkPutMessage {
    const chunks: ChunkUnit[] = chunkIds.map((chunkId) => {
      const ops = this.getChunkOperations(docHandle, chunkId);
      return {
        chunkId,
        opIds: ops.map((op) => op.opId),
        blob: JSON.stringify(ops),
      };
    });

    return {
      type: "orp/chunk-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      chunks,
    };
  }

  applyBlobPut(message: OrpBlobPutMessage): void {
    for (const unit of message.ops) {
      const parsed = JSON.parse(unit.blob) as DemoOp;
      this.applyOp(message.docHandle, parsed);
    }
  }

  applyChunkPut(message: OrpChunkPutMessage): void {
    for (const chunk of message.chunks) {
      const parsed = JSON.parse(chunk.blob) as DemoOp[];
      for (const op of parsed) {
        this.applyOp(message.docHandle, op);
      }
    }
  }

  createBlobGet(docHandle: string, opIds: string[]): OrpBlobGetMessage {
    return {
      type: "orp/blob-get",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      opIds,
    };
  }

  createChunkGet(docHandle: string, chunkIds: string[]): OrpChunkGetMessage {
    return {
      type: "orp/chunk-get",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      chunkIds,
    };
  }

  createInventoryEntries(): InventoryEntry[] {
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

  createChunkInventoryEntries(docHandle: string): ChunkInventoryEntry[] {
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

  getOperationIds(docHandle: string): string[] {
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
}

export function runDemoScenario(
  initiatorSeed: DemoSeed = DEFAULT_INITIATOR_SEED,
  responderSeed: DemoSeed = DEFAULT_RESPONDER_SEED
): DemoScenarioResult {
  const initiator = new DemoPeer("initiator", initiatorSeed);
  const responder = new DemoPeer("responder", responderSeed);
  const transcript: TranscriptEntry[] = [];

  record(transcript, initiator.name, responder.name, "Start the ORP session.", initiator.createHello());

  const differingDocs = reconcileInventory(initiator, responder, transcript);

  for (const docHandle of differingDocs) {
    repairDocument(initiator, responder, transcript, docHandle);
  }

  return {
    initiator: initiator.materialize(),
    responder: responder.materialize(),
    transcript,
  };
}

function reconcileInventory(
  initiator: DemoPeer,
  responder: DemoPeer,
  transcript: TranscriptEntry[]
): string[] {
  const initiatorEntries = initiator.createInventoryEntries();
  const responderEntries = responder.createInventoryEntries();

  const initiatorById = new Map(initiatorEntries.map((entry) => [entry.entryId, entry]));
  const responderById = new Map(responderEntries.map((entry) => [entry.entryId, entry]));

  const { leftResult } = exchangeRibltSets(
    {
      leftIds: initiatorEntries.map((entry) => entry.entryId),
      rightIds: responderEntries.map((entry) => entry.entryId),
      params: PARAMS,
      makeLeftFrame: (frame) => ({
        type: "orp/inventory-frame",
        version: ORP_PROTOCOL_VERSION,
        sessionId: SESSION_ID,
        frame,
      }),
      makeRightFrame: (frame) => ({
        type: "orp/inventory-frame",
        version: ORP_PROTOCOL_VERSION,
        sessionId: SESSION_ID,
        frame,
      }),
      onLeftFrame: (message) => {
        record(transcript, initiator.name, responder.name, "Exchange inventory frames.", message);
      },
      onRightFrame: (message) => {
        record(transcript, responder.name, initiator.name, "Exchange inventory frames.", message);
      },
    }
  );

  const diffByDoc = new Map<string, DiffPair>();

  for (const entryId of leftResult.extra) {
    const entry = initiatorById.get(entryId);
    if (entry) {
      diffByDoc.set(entry.docHandle, {
        ...(diffByDoc.get(entry.docHandle) ?? {}),
        localSummaryHash: entry.summaryHash,
      });
    }
  }

  for (const entryId of leftResult.missing) {
    const entry = responderById.get(entryId);
    if (entry) {
      diffByDoc.set(entry.docHandle, {
        ...(diffByDoc.get(entry.docHandle) ?? {}),
        remoteSummaryHash: entry.summaryHash,
      });
    }
  }

  const done: OrpInventoryDoneMessage = {
    type: "orp/inventory-done",
    version: ORP_PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    differingDocs: [...diffByDoc.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([docHandle, diff]) => ({
        docHandle,
        localSummaryHash: diff.localSummaryHash,
        remoteSummaryHash: diff.remoteSummaryHash,
      })),
  };
  record(
    transcript,
    initiator.name,
    responder.name,
    "Report the exact inventory mismatches once RIBLT decoding completes.",
    done
  );

  return done.differingDocs.map((entry) => entry.docHandle);
}

function repairDocument(
  initiator: DemoPeer,
  responder: DemoPeer,
  transcript: TranscriptEntry[],
  docHandle: string
): void {
  record(
    transcript,
    initiator.name,
    responder.name,
    `Open repair for ${docHandle}.`,
    initiator.createDocOpen(docHandle)
  );
  record(
    transcript,
    responder.name,
    initiator.name,
    `Advertise the responder summary and chunk summaries for ${docHandle}.`,
    responder.createDocStatus(docHandle)
  );
  record(
    transcript,
    initiator.name,
    responder.name,
    `Advertise the initiator summary and chunk summaries for ${docHandle}.`,
    initiator.createDocStatus(docHandle)
  );

  const differingChunks = reconcileChunks(initiator, responder, transcript, docHandle);
  if (differingChunks.length === 0) {
    return;
  }

  const initiatorMissingTotal = getMissingOperationsForChunks(initiator, responder, docHandle, differingChunks).length;
  const responderMissingTotal = getMissingOperationsForChunks(responder, initiator, docHandle, differingChunks).length;

  if (Math.max(initiatorMissingTotal, responderMissingTotal) >= CHUNK_TRANSFER_THRESHOLD) {
    transferChunksIfNeeded(initiator, responder, transcript, docHandle, differingChunks);
    transferChunksIfNeeded(responder, initiator, transcript, docHandle, differingChunks);
    return;
  }

  repairOperations(initiator, responder, transcript, docHandle);
}

function reconcileChunks(
  initiator: DemoPeer,
  responder: DemoPeer,
  transcript: TranscriptEntry[],
  docHandle: string
): string[] {
  const initiatorEntries = initiator.createChunkInventoryEntries(docHandle);
  const responderEntries = responder.createChunkInventoryEntries(docHandle);
  const initiatorById = new Map(initiatorEntries.map((entry) => [entry.entryId, entry]));
  const responderById = new Map(responderEntries.map((entry) => [entry.entryId, entry]));

  const { leftResult } = exchangeRibltSets({
    leftIds: initiatorEntries.map((entry) => entry.entryId),
    rightIds: responderEntries.map((entry) => entry.entryId),
    params: PARAMS,
    makeLeftFrame: (frame) => ({
      type: "orp/chunk-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      frame,
    }),
    makeRightFrame: (frame) => ({
      type: "orp/chunk-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      frame,
    }),
    onLeftFrame: (message) => {
      record(transcript, initiator.name, responder.name, `Exchange chunk frames for ${docHandle}.`, message);
    },
    onRightFrame: (message) => {
      record(transcript, responder.name, initiator.name, `Exchange chunk frames for ${docHandle}.`, message);
    },
  });

  const diffByChunk = new Map<string, DiffPair>();

  for (const entryId of leftResult.extra) {
    const entry = initiatorById.get(entryId);
    if (entry) {
      diffByChunk.set(entry.chunkId, {
        ...(diffByChunk.get(entry.chunkId) ?? {}),
        localSummaryHash: entry.summaryHash,
      });
    }
  }

  for (const entryId of leftResult.missing) {
    const entry = responderById.get(entryId);
    if (entry) {
      diffByChunk.set(entry.chunkId, {
        ...(diffByChunk.get(entry.chunkId) ?? {}),
        remoteSummaryHash: entry.summaryHash,
      });
    }
  }

  const done: OrpChunkDoneMessage = {
    type: "orp/chunk-done",
    version: ORP_PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    docHandle,
    differingChunks: [...diffByChunk.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chunkId, diff]) => ({
        chunkId,
        localSummaryHash: diff.localSummaryHash,
        remoteSummaryHash: diff.remoteSummaryHash,
      })),
  };

  record(
    transcript,
    initiator.name,
    responder.name,
    `List the deterministic chunk mismatches for ${docHandle}.`,
    done
  );

  return done.differingChunks.map((entry) => entry.chunkId);
}

function transferChunksIfNeeded(
  receiver: DemoPeer,
  sender: DemoPeer,
  transcript: TranscriptEntry[],
  docHandle: string,
  differingChunks: string[]
): void {
  const neededChunkIds = differingChunks.filter(
    (chunkId) => getMissingChunkOperations(receiver, sender, docHandle, chunkId).length > 0
  );

  if (neededChunkIds.length === 0) {
    return;
  }

  const get = receiver.createChunkGet(docHandle, neededChunkIds);
  record(
    transcript,
    receiver.name,
    sender.name,
    `Request deterministic chunk blobs for ${docHandle}.`,
    get
  );

  const put = sender.createChunkPut(docHandle, get.chunkIds);
  record(
    transcript,
    sender.name,
    receiver.name,
    `Transfer chunk blobs for ${docHandle} instead of many individual operations.`,
    put
  );
  receiver.applyChunkPut(put);
}

function repairOperations(
  initiator: DemoPeer,
  responder: DemoPeer,
  transcript: TranscriptEntry[],
  docHandle: string
): void {
  const { leftResult, rightResult } = exchangeRibltSets({
    leftIds: initiator.getOperationIds(docHandle),
    rightIds: responder.getOperationIds(docHandle),
    params: PARAMS,
    makeLeftFrame: (frame) => ({
      type: "orp/doc-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      frame,
    }),
    makeRightFrame: (frame) => ({
      type: "orp/doc-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      frame,
    }),
    onLeftFrame: (message) => {
      record(transcript, initiator.name, responder.name, `Exchange operation frames for ${docHandle}.`, message);
    },
    onRightFrame: (message) => {
      record(transcript, responder.name, initiator.name, `Exchange operation frames for ${docHandle}.`, message);
    },
  });

  const initiatorDone: OrpDocDoneMessage = {
    type: "orp/doc-done",
    version: ORP_PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    docHandle,
    missingOpIds: leftResult.missing.sort(),
  };
  const responderDone: OrpDocDoneMessage = {
    type: "orp/doc-done",
    version: ORP_PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    docHandle,
    missingOpIds: rightResult.missing.sort(),
  };

  record(
    transcript,
    initiator.name,
    responder.name,
    `List operations the initiator is missing for ${docHandle}.`,
    initiatorDone
  );
  record(
    transcript,
    responder.name,
    initiator.name,
    `List operations the responder is missing for ${docHandle}.`,
    responderDone
  );

  if (initiatorDone.missingOpIds.length > 0) {
    transferMissingOps(initiator, responder, transcript, docHandle, initiatorDone.missingOpIds);
  }
  if (responderDone.missingOpIds.length > 0) {
    transferMissingOps(responder, initiator, transcript, docHandle, responderDone.missingOpIds);
  }
}

function transferMissingOps(
  receiver: DemoPeer,
  sender: DemoPeer,
  transcript: TranscriptEntry[],
  docHandle: string,
  missingOpIds: string[]
): void {
  const get = receiver.createBlobGet(docHandle, missingOpIds);
  record(
    transcript,
    receiver.name,
    sender.name,
    `Request missing operation blobs for ${docHandle}.`,
    get
  );

  const put = sender.createBlobPut(docHandle, get.opIds);
  record(
    transcript,
    sender.name,
    receiver.name,
    `Send opaque operation blobs for ${docHandle}.`,
    put
  );
  receiver.applyBlobPut(put);
}

function exchangeRibltSets<TMessage extends OrpFrameMessage>(
  options: Parameters<typeof exchangeOrpRibltFrames<TMessage>>[0]
) {
  return exchangeOrpRibltFrames(options);
}

function record(
  transcript: TranscriptEntry[],
  from: string,
  to: string,
  note: string,
  message: OrpMessage
): void {
  assertValidOrpMessage(message);
  transcript.push({ from, to, note, message });
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

function getMissingChunkOperations(
  receiver: DemoPeer,
  sender: DemoPeer,
  docHandle: string,
  chunkId: string
): DemoOp[] {
  const receiverIds = new Set(receiver.getChunkOperations(docHandle, chunkId).map((op) => op.opId));
  return sender.getChunkOperations(docHandle, chunkId).filter((op) => !receiverIds.has(op.opId));
}

function getMissingOperationsForChunks(
  receiver: DemoPeer,
  sender: DemoPeer,
  docHandle: string,
  chunkIds: string[]
): DemoOp[] {
  return chunkIds.flatMap((chunkId) => getMissingChunkOperations(receiver, sender, docHandle, chunkId));
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
