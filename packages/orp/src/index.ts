import {
  RIBLT_MAX_CODED_SYMBOLS,
  RIBLT_MAX_SYMBOL_SIZE,
  createRiblt,
  type RibltDecodeResult,
  type RibltMessage,
  type RibltOptions,
  type RibltSessionApi,
} from "riblt";

export const ORP_PROTOCOL_VERSION = 1 as const;
export const ORP_RIBLT_MESSAGE_VERSION = 1 as const;
export const ORP_RIBLT_HASH_ID = "xxh3-128" as const;

export type Digest = string;
export type DocHandle = string;
export type OpId = string;
export type ScopeId = string;
export type SessionId = string;
export type SnapshotId = string;
export type ChunkId = string;
export type OrpChunkingAlgorithm = "hash-bucket/v1";

export interface OrpParameters {
  symbolSize: number;
  batchSize: number;
  hashSeed: string;
}

export interface OrpRibltSessionApi {
  add(ids: Iterable<string>): void;
  createFrame(options?: { count?: number }): RibltMessage;
  mergeFrame(frame: RibltMessage): void;
  decode(): RibltDecodeResult;
  reset(): void;
}

export interface DocSummary {
  docHandle: DocHandle;
  basisSnapshotId?: SnapshotId;
  tailCount: number;
  xorA: Digest;
  xorB: Digest;
  sumA: Digest;
  sumB: Digest;
}

export interface ChunkSummary {
  chunkId: ChunkId;
  opCount: number;
  xorA: Digest;
  xorB: Digest;
  sumA: Digest;
  sumB: Digest;
}

export interface InventoryDiffEntry {
  docHandle: DocHandle;
  localSummaryHash?: Digest;
  remoteSummaryHash?: Digest;
}

export interface ChunkDiffEntry {
  chunkId: ChunkId;
  localSummaryHash?: Digest;
  remoteSummaryHash?: Digest;
}

export interface BlobUnit {
  opId: OpId;
  blob: string;
}

export interface ChunkUnit {
  chunkId: ChunkId;
  opIds: OpId[];
  blob: string;
}

export interface SnapshotUnit {
  snapshotId: SnapshotId;
  blob: string;
}

export interface OrpChunkingDescriptor {
  algorithm: OrpChunkingAlgorithm;
  bucketCount: number;
  summaries: ChunkSummary[];
}

export interface OrpHelloMessage {
  type: "orp/hello";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  scopeId: ScopeId;
  inventoryParams: OrpParameters;
  operationParams: OrpParameters;
}

export interface OrpInventoryFrameMessage {
  type: "orp/inventory-frame";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  frame: RibltMessage;
}

export interface OrpInventoryDoneMessage {
  type: "orp/inventory-done";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  differingDocs: InventoryDiffEntry[];
}

export interface OrpDocOpenMessage {
  type: "orp/doc-open";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
}

export interface OrpDocStatusMessage {
  type: "orp/doc-status";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  summary: DocSummary;
  recentSnapshots: SnapshotId[];
  chunking?: OrpChunkingDescriptor;
}

export interface OrpChunkFrameMessage {
  type: "orp/chunk-frame";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  frame: RibltMessage;
}

export interface OrpChunkDoneMessage {
  type: "orp/chunk-done";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  differingChunks: ChunkDiffEntry[];
}

export interface OrpChunkGetMessage {
  type: "orp/chunk-get";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  chunkIds: ChunkId[];
}

export interface OrpChunkPutMessage {
  type: "orp/chunk-put";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  chunks: ChunkUnit[];
}

export interface OrpDocFrameMessage {
  type: "orp/doc-frame";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  basisSnapshotId?: SnapshotId;
  frame: RibltMessage;
}

export interface OrpDocDoneMessage {
  type: "orp/doc-done";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  basisSnapshotId?: SnapshotId;
  missingOpIds: OpId[];
}

export interface OrpBlobGetMessage {
  type: "orp/blob-get";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  opIds: OpId[];
}

export interface OrpBlobPutMessage {
  type: "orp/blob-put";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  ops: BlobUnit[];
}

export interface OrpSnapshotGetMessage {
  type: "orp/snapshot-get";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  snapshotId: SnapshotId;
}

export interface OrpSnapshotPutMessage {
  type: "orp/snapshot-put";
  version: typeof ORP_PROTOCOL_VERSION;
  sessionId: SessionId;
  docHandle: DocHandle;
  snapshot: SnapshotUnit;
  tailOps: BlobUnit[];
}

export type OrpMessage =
  | OrpHelloMessage
  | OrpInventoryFrameMessage
  | OrpInventoryDoneMessage
  | OrpDocOpenMessage
  | OrpDocStatusMessage
  | OrpChunkFrameMessage
  | OrpChunkDoneMessage
  | OrpChunkGetMessage
  | OrpChunkPutMessage
  | OrpDocFrameMessage
  | OrpDocDoneMessage
  | OrpBlobGetMessage
  | OrpBlobPutMessage
  | OrpSnapshotGetMessage
  | OrpSnapshotPutMessage;

export type OrpFrameMessage =
  | OrpInventoryFrameMessage
  | OrpChunkFrameMessage
  | OrpDocFrameMessage;

export interface OrpRibltExchangeOptions<TFrame extends OrpFrameMessage> {
  leftIds: Iterable<string>;
  rightIds: Iterable<string>;
  params: OrpParameters;
  makeLeftFrame: (frame: RibltMessage) => TFrame;
  makeRightFrame?: (frame: RibltMessage) => TFrame;
  onLeftFrame?: (message: TFrame) => void;
  onRightFrame?: (message: TFrame) => void;
  roundLimit?: number;
}

export interface OrpRibltExchangeResult {
  leftResult: RibltDecodeResult;
  rightResult: RibltDecodeResult;
  rounds: number;
}

export interface OrpValidationIssue {
  path: string;
  message: string;
}

export class OrpValidationError extends Error {
  readonly issues: OrpValidationIssue[];

  constructor(issues: OrpValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
    this.name = "OrpValidationError";
    this.issues = issues;
  }
}

export interface OrpTranscriptEvent {
  from: "initiator" | "responder";
  to: "initiator" | "responder";
  note: string;
  message: OrpMessage;
}

export interface OrpTranscript {
  name: string;
  description: string;
  events: OrpTranscriptEvent[];
}

export const ORP_DEFAULT_ROUND_LIMIT = 128;
export const ORP_DEFAULT_CHUNK_TRANSFER_THRESHOLD = 4;
export const ORP_DEFAULT_SNAPSHOT_TAIL_COUNT_THRESHOLD = 12;
export const ORP_MAX_ITEMS = 65536;

const HEX_16 = /^[0-9a-f]{16}$/;
const HEX_32 = /^[0-9a-f]{32}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;

export function orpParametersToRibltOptions(params: OrpParameters): RibltOptions {
  return {
    symbolSize: params.symbolSize,
    batchSize: params.batchSize,
    hashSeed: BigInt(`0x${params.hashSeed}`),
  };
}

export function createOrpRibltSession(params: OrpParameters): OrpRibltSessionApi {
  return new OrpRibltSession(params);
}

export function exchangeOrpRibltFrames<TFrame extends OrpFrameMessage>(
  options: OrpRibltExchangeOptions<TFrame>
): OrpRibltExchangeResult {
  const left = createOrpRibltSession(options.params);
  const right = createOrpRibltSession(options.params);
  left.add(options.leftIds);
  right.add(options.rightIds);

  let leftResult = left.decode();
  let rightResult = right.decode();
  let rounds = 0;
  const roundLimit = options.roundLimit ?? ORP_DEFAULT_ROUND_LIMIT;
  const makeRightFrame = options.makeRightFrame ?? options.makeLeftFrame;

  while (rounds < roundLimit) {
    if (leftResult.status === "complete" && rightResult.status === "complete") {
      return { leftResult, rightResult, rounds };
    }
    if (leftResult.status === "failed" || rightResult.status === "failed") {
      throw new Error("ORP RIBLT exchange failed");
    }

    if (rightResult.status !== "complete") {
      const message = options.makeLeftFrame(left.createFrame({ count: options.params.batchSize }));
      options.onLeftFrame?.(message);
      right.mergeFrame(message.frame);
      rightResult = right.decode();
    }

    if (leftResult.status !== "complete") {
      const message = makeRightFrame(right.createFrame({ count: options.params.batchSize }));
      options.onRightFrame?.(message);
      left.mergeFrame(message.frame);
      leftResult = left.decode();
    }

    rounds += 1;
  }

  throw new Error("ORP RIBLT exchange did not complete within the round limit");
}

export interface OrpInventoryEntry {
  entryId: string;
  docHandle: DocHandle;
  summaryHash: string;
}

export interface OrpChunkEntry {
  entryId: string;
  chunkId: ChunkId;
  summaryHash: string;
}

export interface OrpSnapshotPayload {
  snapshot: SnapshotUnit;
  tailOps: BlobUnit[];
}

export interface OrpPeerDocumentView {
  summary: DocSummary;
  recentSnapshots: SnapshotId[];
  chunking?: OrpChunkingDescriptor;
}

export interface OrpPeerAdapter {
  listInventoryEntries(): OrpInventoryEntry[];
  getDocumentView(docHandle: DocHandle): OrpPeerDocumentView;
  listChunkEntries(docHandle: DocHandle): OrpChunkEntry[];
  listOperationIds(docHandle: DocHandle, basisSnapshotId?: SnapshotId): OpId[];
  getBlobUnits(docHandle: DocHandle, opIds: OpId[]): BlobUnit[];
  applyBlobUnits(docHandle: DocHandle, ops: BlobUnit[]): void;
  getChunkUnits(docHandle: DocHandle, chunkIds: ChunkId[]): ChunkUnit[];
  applyChunkUnits(docHandle: DocHandle, chunks: ChunkUnit[]): void;
  getSnapshotPayload(docHandle: DocHandle, snapshotId: SnapshotId): OrpSnapshotPayload | undefined;
  applySnapshotPayload(docHandle: DocHandle, payload: OrpSnapshotPayload): void;
}

export interface OrpSessionOptions {
  sessionId: SessionId;
  scopeId: ScopeId;
  inventoryParams: OrpParameters;
  operationParams: OrpParameters;
  chunkTransferThreshold?: number;
  snapshotTailCountThreshold?: number;
  roundLimit?: number;
}

export type OrpSessionPhase = "idle" | "inventory" | "document" | "complete";

export type OrpDocumentStrategy =
  | "noop"
  | "snapshot"
  | "snapshot+chunk"
  | "snapshot+ops"
  | "chunk"
  | "ops";

export interface OrpSessionState {
  phase: OrpSessionPhase;
  currentDoc?: DocHandle;
  completedDocs: DocHandle[];
  transcriptLength: number;
}

export interface OrpDocumentSyncResult {
  docHandle: DocHandle;
  strategy: OrpDocumentStrategy;
  differingChunks: ChunkDiffEntry[];
  initiatorMissingOpIds: OpId[];
  responderMissingOpIds: OpId[];
  snapshotProvider?: "initiator" | "responder";
  snapshotId?: SnapshotId;
}

export interface OrpSessionResult {
  transcript: OrpTranscriptEvent[];
  differingDocs: InventoryDiffEntry[];
  documents: OrpDocumentSyncResult[];
}

interface SnapshotPlan {
  provider: "initiator" | "responder";
  requester: "initiator" | "responder";
  snapshotId: SnapshotId;
}

export class OrpSession {
  private readonly initiator: OrpPeerAdapter;
  private readonly responder: OrpPeerAdapter;
  private readonly options: Required<OrpSessionOptions>;
  private readonly transcript: OrpTranscriptEvent[] = [];
  private readonly state: OrpSessionState = {
    phase: "idle",
    completedDocs: [],
    transcriptLength: 0,
  };

  constructor(
    initiator: OrpPeerAdapter,
    responder: OrpPeerAdapter,
    options: OrpSessionOptions
  ) {
    this.initiator = initiator;
    this.responder = responder;
    this.options = {
      ...options,
      chunkTransferThreshold: options.chunkTransferThreshold ?? ORP_DEFAULT_CHUNK_TRANSFER_THRESHOLD,
      snapshotTailCountThreshold:
        options.snapshotTailCountThreshold ?? ORP_DEFAULT_SNAPSHOT_TAIL_COUNT_THRESHOLD,
      roundLimit: options.roundLimit ?? ORP_DEFAULT_ROUND_LIMIT,
    };
  }

  getState(): OrpSessionState {
    return {
      phase: this.state.phase,
      currentDoc: this.state.currentDoc,
      completedDocs: [...this.state.completedDocs],
      transcriptLength: this.transcript.length,
    };
  }

  run(): OrpSessionResult {
    this.state.phase = "inventory";
    this.record(
      "initiator",
      "responder",
      "Negotiate the scope and RIBLT parameters.",
      {
        type: "orp/hello",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        scopeId: this.options.scopeId,
        inventoryParams: this.options.inventoryParams,
        operationParams: this.options.operationParams,
      }
    );

    const differingDocs = this.reconcileInventory();
    const documents = differingDocs.map((entry) => {
      this.state.phase = "document";
      this.state.currentDoc = entry.docHandle;
      const result = this.repairDocument(entry.docHandle);
      this.state.completedDocs.push(entry.docHandle);
      this.state.currentDoc = undefined;
      return result;
    });

    this.state.phase = "complete";
    return {
      transcript: [...this.transcript],
      differingDocs,
      documents,
    };
  }

  private reconcileInventory(): InventoryDiffEntry[] {
    const initiatorEntries = this.initiator.listInventoryEntries();
    const responderEntries = this.responder.listInventoryEntries();
    const initiatorById = new Map(initiatorEntries.map((entry) => [entry.entryId, entry]));
    const responderById = new Map(responderEntries.map((entry) => [entry.entryId, entry]));

    const { leftResult } = exchangeOrpRibltFrames({
      leftIds: initiatorEntries.map((entry) => entry.entryId),
      rightIds: responderEntries.map((entry) => entry.entryId),
      params: this.options.inventoryParams,
      roundLimit: this.options.roundLimit,
      makeLeftFrame: (frame) => ({
        type: "orp/inventory-frame",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        frame,
      }),
      onLeftFrame: (message) => {
        this.record("initiator", "responder", "Exchange inventory frames.", message);
      },
      onRightFrame: (message) => {
        this.record("responder", "initiator", "Exchange inventory frames.", message);
      },
    });

    const diffByDoc = new Map<string, InventoryDiffEntry>();
    for (const entryId of leftResult.extra) {
      const entry = initiatorById.get(entryId);
      if (entry) {
        diffByDoc.set(entry.docHandle, {
          ...(diffByDoc.get(entry.docHandle) ?? { docHandle: entry.docHandle }),
          localSummaryHash: entry.summaryHash,
        });
      }
    }
    for (const entryId of leftResult.missing) {
      const entry = responderById.get(entryId);
      if (entry) {
        diffByDoc.set(entry.docHandle, {
          ...(diffByDoc.get(entry.docHandle) ?? { docHandle: entry.docHandle }),
          remoteSummaryHash: entry.summaryHash,
        });
      }
    }

    const differingDocs = [...diffByDoc.values()].sort((a, b) => a.docHandle.localeCompare(b.docHandle));
    this.record("initiator", "responder", "Report the exact inventory mismatches once RIBLT decoding completes.", {
      type: "orp/inventory-done",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      differingDocs,
    });
    return differingDocs;
  }

  private repairDocument(docHandle: DocHandle): OrpDocumentSyncResult {
    this.record("initiator", "responder", `Open repair for ${docHandle}.`, {
      type: "orp/doc-open",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
    });

    this.recordDocumentStatus("responder", "initiator", docHandle, `Advertise the responder summary and chunk summaries for ${docHandle}.`);
    this.recordDocumentStatus("initiator", "responder", docHandle, `Advertise the initiator summary and chunk summaries for ${docHandle}.`);

    let initiatorView = this.initiator.getDocumentView(docHandle);
    let responderView = this.responder.getDocumentView(docHandle);
    let snapshotPlan = this.chooseSnapshotPlan(initiatorView, responderView);
    let snapshotProvider: "initiator" | "responder" | undefined;
    let snapshotId: SnapshotId | undefined;

    if (snapshotPlan) {
      this.transferSnapshot(docHandle, snapshotPlan);
      snapshotProvider = snapshotPlan.provider;
      snapshotId = snapshotPlan.snapshotId;
      initiatorView = this.initiator.getDocumentView(docHandle);
      responderView = this.responder.getDocumentView(docHandle);
    }

    if (sameDocSummary(initiatorView.summary, responderView.summary)) {
      return {
        docHandle,
        strategy: snapshotPlan ? "snapshot" : "noop",
        differingChunks: [],
        initiatorMissingOpIds: [],
        responderMissingOpIds: [],
        snapshotProvider,
        snapshotId,
      };
    }

    const differingChunks =
      initiatorView.chunking && responderView.chunking
        ? this.reconcileChunks(docHandle, initiatorView, responderView)
        : [];

    if (
      differingChunks.length > 0 &&
      this.shouldTransferChunks(differingChunks, initiatorView, responderView)
    ) {
      this.transferChunks(docHandle, differingChunks.map((entry) => entry.chunkId));
      initiatorView = this.initiator.getDocumentView(docHandle);
      responderView = this.responder.getDocumentView(docHandle);
      if (sameDocSummary(initiatorView.summary, responderView.summary)) {
        return {
          docHandle,
          strategy: snapshotPlan ? "snapshot+chunk" : "chunk",
          differingChunks,
          initiatorMissingOpIds: [],
          responderMissingOpIds: [],
          snapshotProvider,
          snapshotId,
        };
      }
    }

    const { initiatorMissingOpIds, responderMissingOpIds } = this.repairOperations(docHandle);
    return {
      docHandle,
      strategy: snapshotPlan ? "snapshot+ops" : "ops",
      differingChunks,
      initiatorMissingOpIds,
      responderMissingOpIds,
      snapshotProvider,
      snapshotId,
    };
  }

  private reconcileChunks(
    docHandle: DocHandle,
    initiatorView: OrpPeerDocumentView,
    responderView: OrpPeerDocumentView
  ): ChunkDiffEntry[] {
    const initiatorEntries = this.initiator.listChunkEntries(docHandle);
    const responderEntries = this.responder.listChunkEntries(docHandle);
    const initiatorById = new Map(initiatorEntries.map((entry) => [entry.entryId, entry]));
    const responderById = new Map(responderEntries.map((entry) => [entry.entryId, entry]));

    const { leftResult } = exchangeOrpRibltFrames({
      leftIds: initiatorEntries.map((entry) => entry.entryId),
      rightIds: responderEntries.map((entry) => entry.entryId),
      params: this.options.operationParams,
      roundLimit: this.options.roundLimit,
      makeLeftFrame: (frame) => ({
        type: "orp/chunk-frame",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        docHandle,
        frame,
      }),
      onLeftFrame: (message) => {
        this.record("initiator", "responder", `Exchange chunk frames for ${docHandle}.`, message);
      },
      onRightFrame: (message) => {
        this.record("responder", "initiator", `Exchange chunk frames for ${docHandle}.`, message);
      },
    });

    const diffByChunk = new Map<string, ChunkDiffEntry>();
    for (const entryId of leftResult.extra) {
      const entry = initiatorById.get(entryId);
      if (entry) {
        diffByChunk.set(entry.chunkId, {
          ...(diffByChunk.get(entry.chunkId) ?? { chunkId: entry.chunkId }),
          localSummaryHash: entry.summaryHash,
        });
      }
    }
    for (const entryId of leftResult.missing) {
      const entry = responderById.get(entryId);
      if (entry) {
        diffByChunk.set(entry.chunkId, {
          ...(diffByChunk.get(entry.chunkId) ?? { chunkId: entry.chunkId }),
          remoteSummaryHash: entry.summaryHash,
        });
      }
    }

    const differingChunks = [...diffByChunk.values()].sort((a, b) => a.chunkId.localeCompare(b.chunkId));
    this.record("initiator", "responder", `List the deterministic chunk mismatches for ${docHandle}.`, {
      type: "orp/chunk-done",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      differingChunks,
    });

    void initiatorView;
    void responderView;
    return differingChunks;
  }

  private transferChunks(docHandle: DocHandle, chunkIds: ChunkId[]): void {
    this.record("initiator", "responder", `Request deterministic chunk blobs for ${docHandle}.`, {
      type: "orp/chunk-get",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      chunkIds,
    });
    const responderChunks = this.responder.getChunkUnits(docHandle, chunkIds);
    this.record("responder", "initiator", `Transfer chunk blobs for ${docHandle} instead of many individual operations.`, {
      type: "orp/chunk-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      chunks: responderChunks,
    });
    this.initiator.applyChunkUnits(docHandle, responderChunks);

    this.record("responder", "initiator", `Request deterministic chunk blobs for ${docHandle}.`, {
      type: "orp/chunk-get",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      chunkIds,
    });
    const initiatorChunks = this.initiator.getChunkUnits(docHandle, chunkIds);
    this.record("initiator", "responder", `Transfer chunk blobs for ${docHandle} instead of many individual operations.`, {
      type: "orp/chunk-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      chunks: initiatorChunks,
    });
    this.responder.applyChunkUnits(docHandle, initiatorChunks);
  }

  private repairOperations(docHandle: DocHandle): {
    initiatorMissingOpIds: OpId[];
    responderMissingOpIds: OpId[];
  } {
    const { leftResult, rightResult } = exchangeOrpRibltFrames({
      leftIds: this.initiator.listOperationIds(docHandle),
      rightIds: this.responder.listOperationIds(docHandle),
      params: this.options.operationParams,
      roundLimit: this.options.roundLimit,
      makeLeftFrame: (frame) => ({
        type: "orp/doc-frame",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        docHandle,
        frame,
      }),
      onLeftFrame: (message) => {
        this.record("initiator", "responder", `Exchange operation frames for ${docHandle}.`, message);
      },
      onRightFrame: (message) => {
        this.record("responder", "initiator", `Exchange operation frames for ${docHandle}.`, message);
      },
    });

    const initiatorMissingOpIds = [...leftResult.missing].sort();
    const responderMissingOpIds = [...rightResult.missing].sort();
    this.record("initiator", "responder", `List operations the initiator is missing for ${docHandle}.`, {
      type: "orp/doc-done",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      missingOpIds: initiatorMissingOpIds,
    });
    this.record("responder", "initiator", `List operations the responder is missing for ${docHandle}.`, {
      type: "orp/doc-done",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      missingOpIds: responderMissingOpIds,
    });

    if (initiatorMissingOpIds.length > 0) {
      this.transferMissingOps("initiator", "responder", docHandle, initiatorMissingOpIds);
    }
    if (responderMissingOpIds.length > 0) {
      this.transferMissingOps("responder", "initiator", docHandle, responderMissingOpIds);
    }

    return { initiatorMissingOpIds, responderMissingOpIds };
  }

  private transferMissingOps(
    requester: "initiator" | "responder",
    provider: "initiator" | "responder",
    docHandle: DocHandle,
    opIds: OpId[]
  ): void {
    this.record(requester, provider, `Request missing operation blobs for ${docHandle}.`, {
      type: "orp/blob-get",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      opIds,
    });
    const providerAdapter = provider === "initiator" ? this.initiator : this.responder;
    const requesterAdapter = requester === "initiator" ? this.initiator : this.responder;
    const ops = providerAdapter.getBlobUnits(docHandle, opIds);
    this.record(provider, requester, `Send opaque operation blobs for ${docHandle}.`, {
      type: "orp/blob-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      ops,
    });
    requesterAdapter.applyBlobUnits(docHandle, ops);
  }

  private transferSnapshot(docHandle: DocHandle, plan: SnapshotPlan): void {
    this.record(plan.requester, plan.provider, `Request snapshot ${plan.snapshotId} for ${docHandle}.`, {
      type: "orp/snapshot-get",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      snapshotId: plan.snapshotId,
    });

    const providerAdapter = plan.provider === "initiator" ? this.initiator : this.responder;
    const requesterAdapter = plan.requester === "initiator" ? this.initiator : this.responder;
    const payload = providerAdapter.getSnapshotPayload(docHandle, plan.snapshotId);
    if (!payload) {
      throw new Error(`missing snapshot ${plan.snapshotId} for ${docHandle}`);
    }

    this.record(plan.provider, plan.requester, `Transfer snapshot ${plan.snapshotId} for ${docHandle}.`, {
      type: "orp/snapshot-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      snapshot: payload.snapshot,
      tailOps: payload.tailOps,
    });
    requesterAdapter.applySnapshotPayload(docHandle, payload);
  }

  private chooseSnapshotPlan(
    initiatorView: OrpPeerDocumentView,
    responderView: OrpPeerDocumentView
  ): SnapshotPlan | undefined {
    if (
      responderView.recentSnapshots.length > 0 &&
      responderView.summary.tailCount >= this.options.snapshotTailCountThreshold &&
      responderView.summary.tailCount >= initiatorView.summary.tailCount
    ) {
      return {
        provider: "responder",
        requester: "initiator",
        snapshotId: responderView.recentSnapshots[0],
      };
    }

    if (
      initiatorView.recentSnapshots.length > 0 &&
      initiatorView.summary.tailCount >= this.options.snapshotTailCountThreshold &&
      initiatorView.summary.tailCount > responderView.summary.tailCount
    ) {
      return {
        provider: "initiator",
        requester: "responder",
        snapshotId: initiatorView.recentSnapshots[0],
      };
    }

    return undefined;
  }

  private shouldTransferChunks(
    differingChunks: ChunkDiffEntry[],
    initiatorView: OrpPeerDocumentView,
    responderView: OrpPeerDocumentView
  ): boolean {
    const initiatorCounts = new Map(
      (initiatorView.chunking?.summaries ?? []).map((summary) => [summary.chunkId, summary.opCount])
    );
    const responderCounts = new Map(
      (responderView.chunking?.summaries ?? []).map((summary) => [summary.chunkId, summary.opCount])
    );
    const estimatedOps = differingChunks.reduce((total, chunk) => {
      return total + Math.max(initiatorCounts.get(chunk.chunkId) ?? 0, responderCounts.get(chunk.chunkId) ?? 0);
    }, 0);
    return estimatedOps >= this.options.chunkTransferThreshold;
  }

  private recordDocumentStatus(
    from: "initiator" | "responder",
    to: "initiator" | "responder",
    docHandle: DocHandle,
    note: string
  ): void {
    const adapter = from === "initiator" ? this.initiator : this.responder;
    const view = adapter.getDocumentView(docHandle);
    this.record(from, to, note, {
      type: "orp/doc-status",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      summary: view.summary,
      recentSnapshots: view.recentSnapshots,
      chunking: view.chunking,
    });
  }

  private record(
    from: "initiator" | "responder",
    to: "initiator" | "responder",
    note: string,
    message: OrpMessage
  ): void {
    assertValidOrpMessage(message);
    this.transcript.push({ from, to, note, message });
    this.state.transcriptLength = this.transcript.length;
  }
}

function sameDocSummary(left: DocSummary, right: DocSummary): boolean {
  return (
    left.docHandle === right.docHandle &&
    left.basisSnapshotId === right.basisSnapshotId &&
    left.tailCount === right.tailCount &&
    left.xorA === right.xorA &&
    left.xorB === right.xorB &&
    left.sumA === right.sumA &&
    left.sumB === right.sumB
  );
}

class OrpRibltSession implements OrpRibltSessionApi {
  private readonly riblt: RibltSessionApi;

  constructor(params: OrpParameters) {
    this.riblt = createRiblt(orpParametersToRibltOptions(params));
  }

  add(ids: Iterable<string>): void {
    this.riblt.add(ids);
  }

  createFrame(options: { count?: number } = {}): RibltMessage {
    return this.riblt.encode({ count: options.count, format: "object" }) as RibltMessage;
  }

  mergeFrame(frame: RibltMessage): void {
    this.riblt.merge(frame);
  }

  decode(): RibltDecodeResult {
    return this.riblt.decode();
  }

  reset(): void {
    this.riblt.reset();
  }
}

function exampleFrame(seed: string): RibltMessage {
  return {
    v: ORP_RIBLT_MESSAGE_VERSION,
    hash: ORP_RIBLT_HASH_ID,
    symbolSize: 64,
    seed,
    coded: [],
  };
}

export const ORP_EXAMPLE_TRANSCRIPTS: OrpTranscript[] = [
  {
    name: "inventory-difference",
    description: "The initiator and responder discover one out-of-date document summary.",
    events: [
      {
        from: "initiator",
        to: "responder",
        note: "Negotiate the scope and RIBLT parameters.",
        message: {
          type: "orp/hello",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-1",
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
        },
      },
      {
        from: "initiator",
        to: "responder",
        note: "Send the first inventory frame.",
        message: {
          type: "orp/inventory-frame",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-1",
          frame: exampleFrame("0000000000000007"),
        },
      },
      {
        from: "responder",
        to: "initiator",
        note: "Return a matching inventory frame from the responder side.",
        message: {
          type: "orp/inventory-frame",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-1",
          frame: exampleFrame("0000000000000007"),
        },
      },
      {
        from: "initiator",
        to: "responder",
        note: "Report the exact document summary mismatch once decoding completes.",
        message: {
          type: "orp/inventory-done",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-1",
          differingDocs: [
            {
              docHandle: "doc-roadmap",
              localSummaryHash: "f0b9b2e31bfce7a6f99379f5ead7fefa",
              remoteSummaryHash: "4c89153f14f51fec07a4ba6d2d583600",
            },
          ],
        },
      },
    ],
  },
  {
    name: "document-repair",
    description: "The responder transfers two missing operations for a differing document.",
    events: [
      {
        from: "initiator",
        to: "responder",
        note: "Open repair for the document selected during inventory reconciliation.",
        message: {
          type: "orp/doc-open",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-2",
          docHandle: "doc-roadmap",
        },
      },
      {
        from: "responder",
        to: "initiator",
        note: "Advertise the responder summary and available snapshots for the document.",
        message: {
          type: "orp/doc-status",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-2",
          docHandle: "doc-roadmap",
          summary: {
            docHandle: "doc-roadmap",
            tailCount: 3,
            xorA: "b1b7792d6c18ff0d3e4bbfa4d322c6b1",
            xorB: "ba8ef3fd9c51df1f4b728b17f737253d",
            sumA: "80d86c15472727522253c173281b39af",
            sumB: "6a7f5332b830fae2792af0d679c249d0",
          },
          recentSnapshots: [],
        },
      },
      {
        from: "initiator",
        to: "responder",
        note: "Send a per-document RIBLT frame over operation ids.",
        message: {
          type: "orp/doc-frame",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-2",
          docHandle: "doc-roadmap",
          frame: exampleFrame("0000000000000007"),
        },
      },
      {
        from: "responder",
        to: "initiator",
        note: "Return the decoded missing operation ids.",
        message: {
          type: "orp/doc-done",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-2",
          docHandle: "doc-roadmap",
          missingOpIds: ["op-roadmap-7", "op-roadmap-8"],
        },
      },
      {
        from: "initiator",
        to: "responder",
        note: "Request the missing operation blobs by id.",
        message: {
          type: "orp/blob-get",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-2",
          docHandle: "doc-roadmap",
          opIds: ["op-roadmap-7", "op-roadmap-8"],
        },
      },
      {
        from: "responder",
        to: "initiator",
        note: "Transfer the opaque operation payloads.",
        message: {
          type: "orp/blob-put",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-2",
          docHandle: "doc-roadmap",
          ops: [
            { opId: "op-roadmap-7", blob: "base64:AAAAB3JvYWRtYXAtNw==" },
            { opId: "op-roadmap-8", blob: "base64:AAAAB3JvYWRtYXAtOA==" },
          ],
        },
      },
    ],
  },
  {
    name: "chunked-repair",
    description: "The peers compare deterministic hash buckets before choosing a larger chunk transfer.",
    events: [
      {
        from: "initiator",
        to: "responder",
        note: "Advertise the document summary plus deterministic chunk summaries.",
        message: {
          type: "orp/doc-status",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-3",
          docHandle: "doc-archive",
          summary: {
            docHandle: "doc-archive",
            tailCount: 8,
            xorA: "155efb8f8a66bc40d768ea4b5965fefd",
            xorB: "7e51d546684ee4e61c7f49ff07bf2f6f",
            sumA: "83484dcae3d6fc6bad846ea3d69434b7",
            sumB: "6c480635f0f0ec5df5d67ae6d23c0d6a",
          },
          recentSnapshots: [],
          chunking: {
            algorithm: "hash-bucket/v1",
            bucketCount: 4,
            summaries: [
              {
                chunkId: "bucket-0",
                opCount: 3,
                xorA: "845913ef0d3df52cb17bd5cd1cb7896c",
                xorB: "25a2bd5f20f192548dfb4f4fb603d8ec",
                sumA: "9878ef92d05f1ac28a4bc5b44d091559",
                sumB: "756889f57e5ff94b7ff4bf2af8d4d8df",
              },
              {
                chunkId: "bucket-1",
                opCount: 2,
                xorA: "454ac9afe7f8940bd4ec7cc0252d801c",
                xorB: "a34f19579a204bf2db18f1cc621469c0",
                sumA: "129894738eb95f2120bc3190c52dc921",
                sumB: "18f0834f72ec20155d3f8a34957a4c10",
              },
            ],
          },
        },
      },
      {
        from: "initiator",
        to: "responder",
        note: "Send a chunk-summary RIBLT frame over `(chunkId, chunkSummaryHash)` entries.",
        message: {
          type: "orp/chunk-frame",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-3",
          docHandle: "doc-archive",
          frame: exampleFrame("0000000000000007"),
        },
      },
      {
        from: "initiator",
        to: "responder",
        note: "Report the exact chunk mismatch before descending to per-op repair.",
        message: {
          type: "orp/chunk-done",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-3",
          docHandle: "doc-archive",
          differingChunks: [
            {
              chunkId: "bucket-0",
              localSummaryHash: "6a65b0a49bfb73e58b8bd46cde4cf3eb",
              remoteSummaryHash: "08ab6d3fe6ca1fc8074dc778ebfbaae4",
            },
          ],
        },
      },
      {
        from: "initiator",
        to: "responder",
        note: "Request the larger chunk blob instead of many individual operation blobs.",
        message: {
          type: "orp/chunk-get",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-3",
          docHandle: "doc-archive",
          chunkIds: ["bucket-0"],
        },
      },
      {
        from: "responder",
        to: "initiator",
        note: "Transfer the deterministic chunk as one blob plus its member operation ids.",
        message: {
          type: "orp/chunk-put",
          version: ORP_PROTOCOL_VERSION,
          sessionId: "orp-example-3",
          docHandle: "doc-archive",
          chunks: [
            {
              chunkId: "bucket-0",
              opIds: ["op-archive-3", "op-archive-4", "op-archive-5"],
              blob: "base64:AAAABmNodW5rLTA=",
            },
          ],
        },
      },
    ],
  },
];

export function validateOrpMessage(value: unknown): OrpValidationIssue[] {
  const issues: OrpValidationIssue[] = [];

  if (!isRecord(value)) {
    issues.push({ path: "$", message: "expected an object" });
    return issues;
  }

  validateBaseMessage(value, issues);

  const type = value.type;
  if (typeof type !== "string") {
    issues.push({ path: "$.type", message: "must be a string" });
    return issues;
  }

  switch (type) {
    case "orp/hello":
      validateString(value.scopeId, "$.scopeId", issues);
      validateParameters(value.inventoryParams, "$.inventoryParams", issues);
      validateParameters(value.operationParams, "$.operationParams", issues);
      break;
    case "orp/inventory-frame":
      validateRibltFrame(value.frame, "$.frame", issues);
      break;
    case "orp/inventory-done":
      validateArray(value.differingDocs, "$.differingDocs", issues, (entry, path) => {
        if (!isRecord(entry)) {
          issues.push({ path, message: "must be an object" });
          return;
        }
        validateString(entry.docHandle, `${path}.docHandle`, issues);
        validateOptionalDigest(entry.localSummaryHash, `${path}.localSummaryHash`, issues);
        validateOptionalDigest(entry.remoteSummaryHash, `${path}.remoteSummaryHash`, issues);
      }, ORP_MAX_ITEMS);
      break;
    case "orp/doc-open":
      validateString(value.docHandle, "$.docHandle", issues);
      break;
    case "orp/doc-status":
      validateString(value.docHandle, "$.docHandle", issues);
      validateDocSummaryInto(value.summary, "$.summary", issues);
      validateArray(value.recentSnapshots, "$.recentSnapshots", issues, (snapshotId, path) => {
        validateString(snapshotId, path, issues);
      }, ORP_MAX_ITEMS);
      validateOptionalChunking(value.chunking, "$.chunking", issues);
      break;
    case "orp/chunk-frame":
      validateString(value.docHandle, "$.docHandle", issues);
      validateRibltFrame(value.frame, "$.frame", issues);
      break;
    case "orp/chunk-done":
      validateString(value.docHandle, "$.docHandle", issues);
      validateArray(value.differingChunks, "$.differingChunks", issues, (entry, path) => {
        if (!isRecord(entry)) {
          issues.push({ path, message: "must be an object" });
          return;
        }
        validateString(entry.chunkId, `${path}.chunkId`, issues);
        validateOptionalDigest(entry.localSummaryHash, `${path}.localSummaryHash`, issues);
        validateOptionalDigest(entry.remoteSummaryHash, `${path}.remoteSummaryHash`, issues);
      }, ORP_MAX_ITEMS);
      break;
    case "orp/chunk-get":
      validateString(value.docHandle, "$.docHandle", issues);
      validateArray(value.chunkIds, "$.chunkIds", issues, (chunkId, path) => {
        validateString(chunkId, path, issues);
      }, ORP_MAX_ITEMS);
      break;
    case "orp/chunk-put":
      validateString(value.docHandle, "$.docHandle", issues);
      validateArray(value.chunks, "$.chunks", issues, (chunk, path) => {
        validateChunkUnit(chunk, path, issues);
      }, ORP_MAX_ITEMS);
      break;
    case "orp/doc-frame":
      validateString(value.docHandle, "$.docHandle", issues);
      validateOptionalString(value.basisSnapshotId, "$.basisSnapshotId", issues);
      validateRibltFrame(value.frame, "$.frame", issues);
      break;
    case "orp/doc-done":
      validateString(value.docHandle, "$.docHandle", issues);
      validateOptionalString(value.basisSnapshotId, "$.basisSnapshotId", issues);
      validateArray(value.missingOpIds, "$.missingOpIds", issues, (opId, path) => {
        validateString(opId, path, issues);
      }, ORP_MAX_ITEMS);
      break;
    case "orp/blob-get":
      validateString(value.docHandle, "$.docHandle", issues);
      validateArray(value.opIds, "$.opIds", issues, (opId, path) => {
        validateString(opId, path, issues);
      }, ORP_MAX_ITEMS);
      break;
    case "orp/blob-put":
      validateString(value.docHandle, "$.docHandle", issues);
      validateArray(value.ops, "$.ops", issues, (op, path) => {
        validateBlobUnit(op, path, issues);
      }, ORP_MAX_ITEMS);
      break;
    case "orp/snapshot-get":
      validateString(value.docHandle, "$.docHandle", issues);
      validateString(value.snapshotId, "$.snapshotId", issues);
      break;
    case "orp/snapshot-put":
      validateString(value.docHandle, "$.docHandle", issues);
      validateSnapshotUnit(value.snapshot, "$.snapshot", issues);
      validateArray(value.tailOps, "$.tailOps", issues, (op, path) => {
        validateBlobUnit(op, path, issues);
      }, ORP_MAX_ITEMS);
      break;
    default:
      issues.push({ path: "$.type", message: `unsupported ORP message type: ${type}` });
      break;
  }

  return issues;
}

export function validateDocSummary(value: unknown): OrpValidationIssue[] {
  const issues: OrpValidationIssue[] = [];
  validateDocSummaryInto(value, "$", issues);
  return issues;
}

export function validateChunkSummary(value: unknown): OrpValidationIssue[] {
  const issues: OrpValidationIssue[] = [];
  validateChunkSummaryInto(value, "$", issues);
  return issues;
}

export function validateOrpTranscript(value: unknown): OrpValidationIssue[] {
  const issues: OrpValidationIssue[] = [];

  if (!isRecord(value)) {
    issues.push({ path: "$", message: "expected an object" });
    return issues;
  }

  validateString(value.name, "$.name", issues);
  validateString(value.description, "$.description", issues);
  validateArray(value.events, "$.events", issues, (event, path) => {
    if (!isRecord(event)) {
      issues.push({ path, message: "must be an object" });
      return;
    }
    validateEnum(event.from, `${path}.from`, ["initiator", "responder"], issues);
    validateEnum(event.to, `${path}.to`, ["initiator", "responder"], issues);
    validateString(event.note, `${path}.note`, issues);
    validateNestedIssues(validateOrpMessage(event.message), `${path}.message`, issues);
  }, ORP_MAX_ITEMS);

  return issues;
}

export function isOrpMessage(value: unknown): value is OrpMessage {
  return validateOrpMessage(value).length === 0;
}

export function assertValidOrpMessage(value: unknown): asserts value is OrpMessage {
  const issues = validateOrpMessage(value);
  if (issues.length > 0) {
    throw new OrpValidationError(issues);
  }
}

export function assertValidDocSummary(value: unknown): asserts value is DocSummary {
  const issues = validateDocSummary(value);
  if (issues.length > 0) {
    throw new OrpValidationError(issues);
  }
}

export function assertValidChunkSummary(value: unknown): asserts value is ChunkSummary {
  const issues = validateChunkSummary(value);
  if (issues.length > 0) {
    throw new OrpValidationError(issues);
  }
}

export function assertValidOrpTranscript(value: unknown): asserts value is OrpTranscript {
  const issues = validateOrpTranscript(value);
  if (issues.length > 0) {
    throw new OrpValidationError(issues);
  }
}

function validateBaseMessage(value: Record<string, unknown>, issues: OrpValidationIssue[]): void {
  validateString(value.type, "$.type", issues);

  if (value.version !== ORP_PROTOCOL_VERSION) {
    issues.push({
      path: "$.version",
      message: `must equal ${ORP_PROTOCOL_VERSION}`,
    });
  }

  validateString(value.sessionId, "$.sessionId", issues);
}

function validateParameters(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  validatePositiveInteger(value.symbolSize, `${path}.symbolSize`, issues);
  validatePositiveInteger(value.batchSize, `${path}.batchSize`, issues);
  if (typeof value.symbolSize === "number" && value.symbolSize > RIBLT_MAX_SYMBOL_SIZE) {
    issues.push({
      path: `${path}.symbolSize`,
      message: `must be <= ${RIBLT_MAX_SYMBOL_SIZE}`,
    });
  }
  if (typeof value.batchSize === "number" && value.batchSize > RIBLT_MAX_CODED_SYMBOLS) {
    issues.push({
      path: `${path}.batchSize`,
      message: `must be <= ${RIBLT_MAX_CODED_SYMBOLS}`,
    });
  }

  if (typeof value.hashSeed !== "string" || !HEX_16.test(value.hashSeed)) {
    issues.push({
      path: `${path}.hashSeed`,
      message: "must be a 16-character lowercase hex string",
    });
  }
}

function validateRibltFrame(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  if (value.v !== ORP_RIBLT_MESSAGE_VERSION) {
    issues.push({
      path: `${path}.v`,
      message: `must equal ${ORP_RIBLT_MESSAGE_VERSION}`,
    });
  }

  if (value.hash !== ORP_RIBLT_HASH_ID) {
    issues.push({
      path: `${path}.hash`,
      message: `must equal ${ORP_RIBLT_HASH_ID}`,
    });
  }

  validatePositiveInteger(value.symbolSize, `${path}.symbolSize`, issues);
  if (typeof value.symbolSize === "number" && value.symbolSize > RIBLT_MAX_SYMBOL_SIZE) {
    issues.push({
      path: `${path}.symbolSize`,
      message: `must be <= ${RIBLT_MAX_SYMBOL_SIZE}`,
    });
  }
  validateSeed(value.seed, `${path}.seed`, issues);
  validateArray(value.coded, `${path}.coded`, issues, (coded, codedPath) => {
    if (!isRecord(coded)) {
      issues.push({ path: codedPath, message: "must be an object" });
      return;
    }
    validateInteger(coded.count, `${codedPath}.count`, issues);
    validateDigest(coded.hash, `${codedPath}.hash`, issues);
    validateBase64String(coded.symbol, `${codedPath}.symbol`, issues);
  }, RIBLT_MAX_CODED_SYMBOLS);
}

function validateDocSummaryInto(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  validateString(value.docHandle, `${path}.docHandle`, issues);
  validateOptionalString(value.basisSnapshotId, `${path}.basisSnapshotId`, issues);
  validateNonNegativeInteger(value.tailCount, `${path}.tailCount`, issues);
  validateDigest(value.xorA, `${path}.xorA`, issues);
  validateDigest(value.xorB, `${path}.xorB`, issues);
  validateDigest(value.sumA, `${path}.sumA`, issues);
  validateDigest(value.sumB, `${path}.sumB`, issues);
}

function validateChunkSummaryInto(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  validateString(value.chunkId, `${path}.chunkId`, issues);
  validateNonNegativeInteger(value.opCount, `${path}.opCount`, issues);
  validateDigest(value.xorA, `${path}.xorA`, issues);
  validateDigest(value.xorB, `${path}.xorB`, issues);
  validateDigest(value.sumA, `${path}.sumA`, issues);
  validateDigest(value.sumB, `${path}.sumB`, issues);
}

function validateBlobUnit(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  validateString(value.opId, `${path}.opId`, issues);
  validateString(value.blob, `${path}.blob`, issues);
}

function validateChunkUnit(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  validateString(value.chunkId, `${path}.chunkId`, issues);
  validateArray(value.opIds, `${path}.opIds`, issues, (opId, itemPath) => {
    validateString(opId, itemPath, issues);
  }, ORP_MAX_ITEMS);
  validateString(value.blob, `${path}.blob`, issues);
}

function validateSnapshotUnit(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  validateString(value.snapshotId, `${path}.snapshotId`, issues);
  validateString(value.blob, `${path}.blob`, issues);
}

function validateOptionalChunking(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value === "undefined") {
    return;
  }
  validateChunkingDescriptor(value, path, issues);
}

function validateChunkingDescriptor(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }

  validateEnum(value.algorithm, `${path}.algorithm`, ["hash-bucket/v1"], issues);
  validatePositiveInteger(value.bucketCount, `${path}.bucketCount`, issues);
  validateArray(value.summaries, `${path}.summaries`, issues, (summary, summaryPath) => {
    validateChunkSummaryInto(summary, summaryPath, issues);
  }, ORP_MAX_ITEMS);
}

function validateString(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value !== "string" || value.length === 0) {
    issues.push({ path, message: "must be a non-empty string" });
  }
}

function validateOptionalString(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value === "undefined") {
    return;
  }
  validateString(value, path, issues);
}

function validateDigest(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    issues.push({ path, message: "must be a 32-character lowercase hex string" });
  }
}

function validateOptionalDigest(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value === "undefined") {
    return;
  }
  validateDigest(value, path, issues);
}

function validateSeed(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value !== "string" || !HEX_16.test(value)) {
    issues.push({ path, message: "must be a 16-character lowercase hex string" });
  }
}

function validateBase64String(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value !== "string" || value.length === 0 || !BASE64.test(value)) {
    issues.push({ path, message: "must be a valid base64 string" });
  }
}

function validateInteger(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push({ path, message: "must be an integer" });
  }
}

function validatePositiveInteger(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    issues.push({ path, message: "must be a positive integer" });
  }
}

function validateNonNegativeInteger(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[]
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    issues.push({ path, message: "must be a non-negative integer" });
  }
}

function validateArray<T>(
  value: unknown,
  path: string,
  issues: OrpValidationIssue[],
  validateItem: (item: T, path: string) => void,
  maxLength?: number
): void {
  if (!Array.isArray(value)) {
    issues.push({ path, message: "must be an array" });
    return;
  }
  if (typeof maxLength === "number" && value.length > maxLength) {
    issues.push({ path, message: `must contain at most ${maxLength} items` });
    return;
  }

  value.forEach((item, index) => {
    validateItem(item as T, `${path}[${index}]`);
  });
}

function validateEnum(
  value: unknown,
  path: string,
  allowed: string[],
  issues: OrpValidationIssue[]
): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    issues.push({ path, message: `must be one of: ${allowed.join(", ")}` });
  }
}

function validateNestedIssues(
  nestedIssues: OrpValidationIssue[],
  path: string,
  issues: OrpValidationIssue[]
): void {
  for (const issue of nestedIssues) {
    issues.push({
      path: `${path}${issue.path === "$" ? "" : issue.path.slice(1)}`,
      message: issue.message,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
