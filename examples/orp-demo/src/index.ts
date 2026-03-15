import { createHash } from "node:crypto";
import { createRiblt, type RibltMessage, type RibltOptions } from "riblt";
import {
  ORP_PROTOCOL_VERSION,
  assertValidOrpMessage,
  type BlobUnit,
  type DocSummary,
  type OrpBlobGetMessage,
  type OrpBlobPutMessage,
  type OrpDocDoneMessage,
  type OrpDocFrameMessage,
  type OrpDocOpenMessage,
  type OrpDocStatusMessage,
  type OrpHelloMessage,
  type OrpInventoryDoneMessage,
  type OrpInventoryFrameMessage,
  type OrpMessage,
  type OrpParameters,
} from "@riblt/orp";

type TranscriptEntry = {
  from: string;
  to: string;
  note: string;
  message: OrpMessage;
};

type DemoOp = {
  opId: string;
  value: string;
};

type InventoryEntry = {
  entryId: string;
  docHandle: string;
  summaryHash: string;
};

type DemoDoc = {
  docHandle: string;
  ops: Map<string, DemoOp>;
  values: Set<string>;
};

const DIGEST_MASK = (1n << 128n) - 1n;
const SESSION_ID = "orp-demo-session";
const SCOPE_ID = "tenant-demo";
const PARAMS: OrpParameters = {
  symbolSize: 64,
  batchSize: 3,
  hashSeed: "0000000000000007",
};

class DemoPeer {
  readonly name: string;
  readonly documents = new Map<string, DemoDoc>();

  constructor(name: string, seed: Array<{ docHandle: string; values: string[] }>) {
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

  applyBlobPut(message: OrpBlobPutMessage): void {
    for (const unit of message.ops) {
      const parsed = JSON.parse(unit.blob) as DemoOp;
      this.applyOp(message.docHandle, parsed);
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

  createInventoryEntries(): InventoryEntry[] {
    const entries: InventoryEntry[] = [];
    for (const docHandle of [...this.documents.keys()].sort()) {
      const summary = this.createDocSummary(docHandle);
      const summaryHash = hashHex([
        docHandle,
        summary.basisSnapshotId ?? "",
        String(summary.tailCount),
        summary.xorA,
        summary.xorB,
        summary.sumA,
        summary.sumB,
      ]);
      entries.push({
        docHandle,
        summaryHash,
        entryId: hashHex([docHandle, summaryHash]),
      });
    }
    return entries;
  }

  createDocSummary(docHandle: string): DocSummary {
    const doc = this.documents.get(docHandle);
    if (!doc) {
      return emptySummary(docHandle);
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

  getOperationIds(docHandle: string): string[] {
    const doc = this.documents.get(docHandle);
    return doc ? [...doc.ops.keys()].sort() : [];
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

function main(): void {
  const initiator = new DemoPeer("initiator", [
    { docHandle: "doc-notes", values: ["agenda", "draft", "owner:alice"] },
    { docHandle: "doc-roadmap", values: ["milestone-a", "milestone-c"] },
    { docHandle: "doc-shopping", values: ["apples", "olive-oil", "tea"] },
  ]);

  const responder = new DemoPeer("responder", [
    { docHandle: "doc-notes", values: ["agenda", "draft"] },
    { docHandle: "doc-roadmap", values: ["milestone-a", "milestone-b", "milestone-c"] },
    { docHandle: "doc-shopping", values: ["apples", "tea"] },
  ]);

  const transcript: TranscriptEntry[] = [];

  record(transcript, initiator.name, responder.name, "Start the ORP session.", initiator.createHello());

  const differingDocs = reconcileInventory(initiator, responder, transcript);

  for (const docHandle of differingDocs) {
    repairDocument(initiator, responder, transcript, docHandle);
  }

  console.log("Initial documents were reconciled through ORP.\n");
  console.log("Final initiator state:");
  console.log(JSON.stringify(initiator.materialize(), null, 2));
  console.log("\nFinal responder state:");
  console.log(JSON.stringify(responder.materialize(), null, 2));
  console.log("\nTranscript:");
  console.log(JSON.stringify(transcript, null, 2));
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
    initiator.name,
    responder.name,
    initiatorEntries.map((entry) => entry.entryId),
    responderEntries.map((entry) => entry.entryId),
    PARAMS,
    (frame) => ({
      type: "orp/inventory-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      frame,
    }),
    transcript,
    "Exchange inventory frames."
  );

  const diffByDoc = new Map<string, { localSummaryHash?: string; remoteSummaryHash?: string }>();

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
    `Advertise the responder summary for ${docHandle}.`,
    responder.createDocStatus(docHandle)
  );
  record(
    transcript,
    initiator.name,
    responder.name,
    `Advertise the initiator summary for ${docHandle}.`,
    initiator.createDocStatus(docHandle)
  );

  const { leftResult, rightResult } = exchangeRibltSets(
    initiator.name,
    responder.name,
    initiator.getOperationIds(docHandle),
    responder.getOperationIds(docHandle),
    PARAMS,
    (frame) => ({
      type: "orp/doc-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      docHandle,
      frame,
    }),
    transcript,
    `Exchange operation frames for ${docHandle}.`
  );

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

function exchangeRibltSets<TMessage extends OrpInventoryFrameMessage | OrpDocFrameMessage>(
  leftName: string,
  rightName: string,
  leftIds: string[],
  rightIds: string[],
  params: OrpParameters,
  createMessage: (frame: RibltMessage) => TMessage,
  transcript: TranscriptEntry[],
  note: string
): {
  leftResult: { status: string; missing: string[]; extra: string[] };
  rightResult: { status: string; missing: string[]; extra: string[] };
} {
  const left = createRiblt(toRibltOptions(params));
  const right = createRiblt(toRibltOptions(params));
  left.add(leftIds);
  right.add(rightIds);

  let leftResult = left.decode();
  let rightResult = right.decode();
  let rounds = 0;

  while ((leftResult.status !== "complete" || rightResult.status !== "complete") && rounds < 128) {
    if (rightResult.status !== "complete") {
      const frame = left.encode({ count: params.batchSize, format: "object" }) as RibltMessage;
      const message = createMessage(frame);
      record(transcript, leftName, rightName, note, message);
      right.merge(message.frame);
      rightResult = right.decode();
    }

    if (leftResult.status !== "complete") {
      const frame = right.encode({ count: params.batchSize, format: "object" }) as RibltMessage;
      const message = createMessage(frame);
      record(transcript, rightName, leftName, note, message);
      left.merge(message.frame);
      leftResult = left.decode();
    }

    rounds += 1;
  }

  if (leftResult.status !== "complete" || rightResult.status !== "complete") {
    throw new Error("RIBLT reconciliation did not complete within the round limit");
  }

  return { leftResult, rightResult };
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

function emptySummary(docHandle: string): DocSummary {
  return {
    docHandle,
    tailCount: 0,
    xorA: bigIntToDigest(0n),
    xorB: bigIntToDigest(0n),
    sumA: bigIntToDigest(0n),
    sumB: bigIntToDigest(0n),
  };
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

function toRibltOptions(params: OrpParameters): RibltOptions {
  return {
    symbolSize: params.symbolSize,
    batchSize: params.batchSize,
    hashSeed: BigInt(`0x${params.hashSeed}`),
  };
}

main();
