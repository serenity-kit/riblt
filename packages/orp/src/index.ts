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

export interface OrpEndpointSessionOptions extends OrpSessionOptions {
  role: "initiator" | "responder";
}

export type OrpEndpointPhase =
  | "idle"
  | "awaiting-hello"
  | "inventory"
  | "document"
  | "complete"
  | "failed";

export type OrpEndpointDocumentPhase =
  | "status"
  | "snapshot"
  | "chunk"
  | "ops"
  | "done";

export interface OrpEndpointState {
  role: "initiator" | "responder";
  phase: OrpEndpointPhase;
  documentPhase?: OrpEndpointDocumentPhase;
  currentDoc?: DocHandle;
  pendingDocs: DocHandle[];
  completedDocs: DocHandle[];
  transcriptLength: number;
  failedReason?: string;
}

export type OrpEndpointEvent =
  | {
      type: "phase-changed";
      phase: OrpEndpointPhase;
      currentDoc?: DocHandle;
    }
  | {
      type: "inventory-ready";
      differingDocs: InventoryDiffEntry[];
    }
  | {
      type: "document-started";
      docHandle: DocHandle;
    }
  | {
      type: "document-complete";
      docHandle: DocHandle;
      strategy: OrpDocumentStrategy;
    }
  | {
      type: "complete";
    }
  | {
      type: "failed";
      reason: string;
    };

export interface OrpEndpointStepResult {
  messages: OrpMessage[];
  events: OrpEndpointEvent[];
  state: OrpEndpointState;
}

export interface OrpEndpointSnapshot {
  options: OrpEndpointSessionOptions;
  state: OrpEndpointState;
  transcript: OrpTranscriptEvent[];
  inventory?: SerializedInventoryState;
  document?: SerializedDocumentState;
}

interface SnapshotPlan {
  provider: "initiator" | "responder";
  requester: "initiator" | "responder";
  snapshotId: SnapshotId;
}

interface SerializedRibltReplayState {
  framesSent: number;
  receivedFrames: RibltMessage[];
}

interface SerializedInventoryState {
  replay: SerializedRibltReplayState;
  localDoneSent: boolean;
  remoteDoneReceived: boolean;
  localDiffs: InventoryDiffEntry[];
  remoteDiffs: InventoryDiffEntry[];
}

interface SerializedChunkState {
  replay: SerializedRibltReplayState;
  localDoneSent: boolean;
  remoteDoneReceived: boolean;
  localDiffs: ChunkDiffEntry[];
  remoteDiffs: ChunkDiffEntry[];
  localRequestComplete: boolean;
  remoteRequestComplete: boolean;
  remoteNeedsLocalChunks: boolean;
}

interface SerializedOperationState {
  replay: SerializedRibltReplayState;
  localDoneSent: boolean;
  remoteDoneReceived: boolean;
  localMissingOpIds: OpId[];
  remoteMissingOpIds?: OpId[];
  localRequestComplete: boolean;
  remoteRequestComplete: boolean;
  remoteBlobServed: boolean;
}

interface SerializedDocumentState {
  docHandle: DocHandle;
  localStatusSent: boolean;
  remoteView?: OrpPeerDocumentView;
  snapshotRequested: boolean;
  snapshotApplied: boolean;
  snapshotProvided: boolean;
  strategy?: OrpDocumentStrategy;
  chunk?: SerializedChunkState;
  ops?: SerializedOperationState;
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

interface InventoryContext {
  session: OrpRibltSessionApi;
  localEntries: OrpInventoryEntry[];
  localById: Map<string, OrpInventoryEntry>;
  replay: SerializedRibltReplayState;
  localDoneSent: boolean;
  remoteDoneReceived: boolean;
  localDiffs: Map<DocHandle, InventoryDiffEntry>;
  remoteDiffs: Map<DocHandle, InventoryDiffEntry>;
}

interface ChunkContext {
  session: OrpRibltSessionApi;
  localEntries: OrpChunkEntry[];
  localById: Map<string, OrpChunkEntry>;
  replay: SerializedRibltReplayState;
  localDoneSent: boolean;
  remoteDoneReceived: boolean;
  localDiffs: Map<ChunkId, ChunkDiffEntry>;
  remoteDiffs: Map<ChunkId, ChunkDiffEntry>;
  localRequestComplete: boolean;
  remoteRequestComplete: boolean;
  remoteNeedsLocalChunks: boolean;
}

interface OperationContext {
  session: OrpRibltSessionApi;
  localOpIds: OpId[];
  replay: SerializedRibltReplayState;
  localDoneSent: boolean;
  remoteDoneReceived: boolean;
  localMissingOpIds: OpId[];
  remoteMissingOpIds?: OpId[];
  localRequestComplete: boolean;
  remoteRequestComplete: boolean;
  remoteBlobServed: boolean;
}

interface DocumentContext {
  docHandle: DocHandle;
  localStatusSent: boolean;
  remoteView?: OrpPeerDocumentView;
  snapshotRequested: boolean;
  snapshotApplied: boolean;
  snapshotProvided: boolean;
  strategy?: OrpDocumentStrategy;
  chunk?: ChunkContext;
  ops?: OperationContext;
}

export function createOrpEndpointSession(
  adapter: OrpPeerAdapter,
  options: OrpEndpointSessionOptions
): OrpEndpointSession {
  return new OrpEndpointSession(adapter, options);
}

export class OrpEndpointSession {
  private readonly adapter: OrpPeerAdapter;
  private readonly options: Required<OrpEndpointSessionOptions>;
  private readonly transcript: OrpTranscriptEvent[] = [];
  private readonly state: OrpEndpointState;
  private inventory?: InventoryContext;
  private document?: DocumentContext;

  constructor(adapter: OrpPeerAdapter, options: OrpEndpointSessionOptions) {
    this.adapter = adapter;
    this.options = {
      ...options,
      chunkTransferThreshold: options.chunkTransferThreshold ?? ORP_DEFAULT_CHUNK_TRANSFER_THRESHOLD,
      snapshotTailCountThreshold:
        options.snapshotTailCountThreshold ?? ORP_DEFAULT_SNAPSHOT_TAIL_COUNT_THRESHOLD,
      roundLimit: options.roundLimit ?? ORP_DEFAULT_ROUND_LIMIT,
    };
    this.state = {
      role: this.options.role,
      phase: "idle",
      pendingDocs: [],
      completedDocs: [],
      transcriptLength: 0,
    };
  }

  static restore(adapter: OrpPeerAdapter, snapshot: OrpEndpointSnapshot): OrpEndpointSession {
    const session = new OrpEndpointSession(adapter, snapshot.options);
    session.transcript.push(...snapshot.transcript);
    session.state.phase = snapshot.state.phase;
    session.state.documentPhase = snapshot.state.documentPhase;
    session.state.currentDoc = snapshot.state.currentDoc;
    session.state.pendingDocs = [...snapshot.state.pendingDocs];
    session.state.completedDocs = [...snapshot.state.completedDocs];
    session.state.transcriptLength = snapshot.state.transcriptLength;
    session.state.failedReason = snapshot.state.failedReason;

    if (snapshot.inventory) {
      session.inventory = session.restoreInventory(snapshot.inventory);
    }
    if (snapshot.document) {
      session.document = session.restoreDocument(snapshot.document);
    }

    return session;
  }

  start(): OrpMessage[] {
    if (this.state.phase !== "idle" && this.state.phase !== "awaiting-hello") {
      throw new Error("session has already started");
    }

    if (this.options.role === "responder") {
      this.setPhase("awaiting-hello");
      return [];
    }

    this.ensureInventory();
    this.setPhase("inventory");
    const outputs: OrpMessage[] = [
      {
        type: "orp/hello",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        scopeId: this.options.scopeId,
        inventoryParams: this.options.inventoryParams,
        operationParams: this.options.operationParams,
      },
      this.createInventoryFrame(),
    ];
    this.recordOutgoing(outputs, "Start transport-facing ORP reconciliation.");
    return outputs;
  }

  receive(message: OrpMessage): OrpEndpointStepResult {
    assertValidOrpMessage(message);
    if (message.sessionId !== this.options.sessionId) {
      return this.fail(`sessionId mismatch: expected ${this.options.sessionId}`);
    }

    this.recordIncoming(message, "Receive ORP transport message.");

    const messages: OrpMessage[] = [];
    const events: OrpEndpointEvent[] = [];

    try {
      switch (message.type) {
        case "orp/hello":
          this.handleHello(message, messages, events);
          break;
        case "orp/inventory-frame":
          this.handleInventoryFrame(message, messages, events);
          break;
        case "orp/inventory-done":
          this.handleInventoryDone(message, messages, events);
          break;
        case "orp/doc-open":
          this.handleDocOpen(message, messages, events);
          break;
        case "orp/doc-status":
          this.handleDocStatus(message, messages, events);
          break;
        case "orp/chunk-frame":
          this.handleChunkFrame(message, messages, events);
          break;
        case "orp/chunk-done":
          this.handleChunkDone(message, messages, events);
          break;
        case "orp/chunk-get":
          this.handleChunkGet(message, messages, events);
          break;
        case "orp/chunk-put":
          this.handleChunkPut(message, messages, events);
          break;
        case "orp/doc-frame":
          this.handleDocFrame(message, messages, events);
          break;
        case "orp/doc-done":
          this.handleDocDone(message, messages, events);
          break;
        case "orp/blob-get":
          this.handleBlobGet(message, messages, events);
          break;
        case "orp/blob-put":
          this.handleBlobPut(message, messages, events);
          break;
        case "orp/snapshot-get":
          this.handleSnapshotGet(message, messages, events);
          break;
        case "orp/snapshot-put":
          this.handleSnapshotPut(message, messages, events);
          break;
      }
    } catch (error) {
      return this.fail(error instanceof Error ? error.message : String(error));
    }

    this.recordOutgoing(messages, "Emit ORP transport messages.");
    return {
      messages,
      events,
      state: this.getState(),
    };
  }

  getState(): OrpEndpointState {
    return {
      role: this.state.role,
      phase: this.state.phase,
      documentPhase: this.state.documentPhase,
      currentDoc: this.state.currentDoc,
      pendingDocs: [...this.state.pendingDocs],
      completedDocs: [...this.state.completedDocs],
      transcriptLength: this.transcript.length,
      failedReason: this.state.failedReason,
    };
  }

  getTranscript(): OrpTranscriptEvent[] {
    return [...this.transcript];
  }

  snapshot(): OrpEndpointSnapshot {
    return {
      options: {
        role: this.options.role,
        sessionId: this.options.sessionId,
        scopeId: this.options.scopeId,
        inventoryParams: this.options.inventoryParams,
        operationParams: this.options.operationParams,
        chunkTransferThreshold: this.options.chunkTransferThreshold,
        snapshotTailCountThreshold: this.options.snapshotTailCountThreshold,
        roundLimit: this.options.roundLimit,
      },
      state: this.getState(),
      transcript: [...this.transcript],
      inventory: this.inventory
        ? {
            replay: {
              framesSent: this.inventory.replay.framesSent,
              receivedFrames: [...this.inventory.replay.receivedFrames],
            },
            localDoneSent: this.inventory.localDoneSent,
            remoteDoneReceived: this.inventory.remoteDoneReceived,
            localDiffs: [...this.inventory.localDiffs.values()],
            remoteDiffs: [...this.inventory.remoteDiffs.values()],
          }
        : undefined,
      document: this.document
        ? {
            docHandle: this.document.docHandle,
            localStatusSent: this.document.localStatusSent,
            remoteView: this.document.remoteView,
            snapshotRequested: this.document.snapshotRequested,
            snapshotApplied: this.document.snapshotApplied,
            snapshotProvided: this.document.snapshotProvided,
            strategy: this.document.strategy,
            chunk: this.document.chunk
              ? {
                  replay: {
                    framesSent: this.document.chunk.replay.framesSent,
                    receivedFrames: [...this.document.chunk.replay.receivedFrames],
                  },
                  localDoneSent: this.document.chunk.localDoneSent,
                  remoteDoneReceived: this.document.chunk.remoteDoneReceived,
                  localDiffs: [...this.document.chunk.localDiffs.values()],
                  remoteDiffs: [...this.document.chunk.remoteDiffs.values()],
                  localRequestComplete: this.document.chunk.localRequestComplete,
                  remoteRequestComplete: this.document.chunk.remoteRequestComplete,
                  remoteNeedsLocalChunks: this.document.chunk.remoteNeedsLocalChunks,
                }
              : undefined,
            ops: this.document.ops
              ? {
                  replay: {
                    framesSent: this.document.ops.replay.framesSent,
                    receivedFrames: [...this.document.ops.replay.receivedFrames],
                  },
                  localDoneSent: this.document.ops.localDoneSent,
                  remoteDoneReceived: this.document.ops.remoteDoneReceived,
                  localMissingOpIds: [...this.document.ops.localMissingOpIds],
                  remoteMissingOpIds: this.document.ops.remoteMissingOpIds
                    ? [...this.document.ops.remoteMissingOpIds]
                    : undefined,
                  localRequestComplete: this.document.ops.localRequestComplete,
                  remoteRequestComplete: this.document.ops.remoteRequestComplete,
                  remoteBlobServed: this.document.ops.remoteBlobServed,
                }
              : undefined,
          }
        : undefined,
    };
  }

  private restoreInventory(snapshot: SerializedInventoryState): InventoryContext {
    const localEntries = this.adapter.listInventoryEntries();
    const session = replayRibltSession(
      this.options.inventoryParams,
      localEntries.map((entry) => entry.entryId),
      snapshot.replay
    );
    return {
      session,
      localEntries,
      localById: new Map(localEntries.map((entry) => [entry.entryId, entry])),
      replay: {
        framesSent: snapshot.replay.framesSent,
        receivedFrames: [...snapshot.replay.receivedFrames],
      },
      localDoneSent: snapshot.localDoneSent,
      remoteDoneReceived: snapshot.remoteDoneReceived,
      localDiffs: new Map(snapshot.localDiffs.map((entry) => [entry.docHandle, entry])),
      remoteDiffs: new Map(snapshot.remoteDiffs.map((entry) => [entry.docHandle, entry])),
    };
  }

  private restoreDocument(snapshot: SerializedDocumentState): DocumentContext {
    const document: DocumentContext = {
      docHandle: snapshot.docHandle,
      localStatusSent: snapshot.localStatusSent,
      remoteView: snapshot.remoteView,
      snapshotRequested: snapshot.snapshotRequested,
      snapshotApplied: snapshot.snapshotApplied,
      snapshotProvided: snapshot.snapshotProvided,
      strategy: snapshot.strategy,
    };

    if (snapshot.chunk) {
      const localEntries = this.adapter.listChunkEntries(snapshot.docHandle);
      document.chunk = {
        session: replayRibltSession(
          this.options.operationParams,
          localEntries.map((entry) => entry.entryId),
          snapshot.chunk.replay
        ),
        localEntries,
        localById: new Map(localEntries.map((entry) => [entry.entryId, entry])),
        replay: {
          framesSent: snapshot.chunk.replay.framesSent,
          receivedFrames: [...snapshot.chunk.replay.receivedFrames],
        },
        localDoneSent: snapshot.chunk.localDoneSent,
        remoteDoneReceived: snapshot.chunk.remoteDoneReceived,
        localDiffs: new Map(snapshot.chunk.localDiffs.map((entry) => [entry.chunkId, entry])),
        remoteDiffs: new Map(snapshot.chunk.remoteDiffs.map((entry) => [entry.chunkId, entry])),
        localRequestComplete: snapshot.chunk.localRequestComplete,
        remoteRequestComplete: snapshot.chunk.remoteRequestComplete,
        remoteNeedsLocalChunks: snapshot.chunk.remoteNeedsLocalChunks,
      };
    }

    if (snapshot.ops) {
      const localOpIds = this.adapter.listOperationIds(snapshot.docHandle);
      document.ops = {
        session: replayRibltSession(this.options.operationParams, localOpIds, snapshot.ops.replay),
        localOpIds,
        replay: {
          framesSent: snapshot.ops.replay.framesSent,
          receivedFrames: [...snapshot.ops.replay.receivedFrames],
        },
        localDoneSent: snapshot.ops.localDoneSent,
        remoteDoneReceived: snapshot.ops.remoteDoneReceived,
        localMissingOpIds: [...snapshot.ops.localMissingOpIds],
        remoteMissingOpIds: snapshot.ops.remoteMissingOpIds
          ? [...snapshot.ops.remoteMissingOpIds]
          : undefined,
        localRequestComplete: snapshot.ops.localRequestComplete,
        remoteRequestComplete: snapshot.ops.remoteRequestComplete,
        remoteBlobServed: snapshot.ops.remoteBlobServed,
      };
    }

    return document;
  }

  private handleHello(
    message: OrpHelloMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (this.options.role !== "responder") {
      throw new Error("only the responder may receive orp/hello");
    }
    if (message.scopeId !== this.options.scopeId) {
      throw new Error(`scopeId mismatch: expected ${this.options.scopeId}`);
    }
    assertSameParameters(message.inventoryParams, this.options.inventoryParams, "inventoryParams");
    assertSameParameters(message.operationParams, this.options.operationParams, "operationParams");
    this.ensureInventory();
    this.setPhase("inventory", events);
    if (this.inventory!.replay.framesSent === 0) {
      messages.push(this.createInventoryFrame());
    }
  }

  private handleInventoryFrame(
    message: OrpInventoryFrameMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    this.ensureInventory();
    this.setPhase("inventory", events);
    this.inventory!.session.mergeFrame(message.frame);
    this.inventory!.replay.receivedFrames.push(message.frame);
    this.syncInventory(messages, events, true);
  }

  private handleInventoryDone(
    message: OrpInventoryDoneMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    this.ensureInventory();
    for (const entry of message.differingDocs) {
      this.inventory!.remoteDiffs.set(entry.docHandle, {
        ...(this.inventory!.remoteDiffs.get(entry.docHandle) ?? { docHandle: entry.docHandle }),
        ...entry,
      });
    }
    this.inventory!.remoteDoneReceived = true;
    this.syncInventory(messages, events, false);
  }

  private handleDocOpen(
    message: OrpDocOpenMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (this.options.role !== "responder") {
      throw new Error("only the responder may receive orp/doc-open");
    }
    this.openDocument(message.docHandle, events);
    if (!this.document!.localStatusSent) {
      messages.push(this.createDocStatusMessage(message.docHandle));
      this.document!.localStatusSent = true;
    }
    this.progressDocument(messages, events);
  }

  private handleDocStatus(
    message: OrpDocStatusMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    this.document!.remoteView = {
      summary: message.summary,
      recentSnapshots: [...message.recentSnapshots],
      chunking: message.chunking,
    };
    this.progressDocument(messages, events);
  }

  private handleChunkFrame(
    message: OrpChunkFrameMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const chunk = this.ensureChunkContext();
    this.setDocumentPhase("chunk");
    chunk.session.mergeFrame(message.frame);
    chunk.replay.receivedFrames.push(message.frame);
    this.syncChunk(messages, events, true);
  }

  private handleChunkDone(
    message: OrpChunkDoneMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const chunk = this.ensureChunkContext();
    for (const entry of message.differingChunks) {
      chunk.remoteDiffs.set(entry.chunkId, {
        ...(chunk.remoteDiffs.get(entry.chunkId) ?? { chunkId: entry.chunkId }),
        ...entry,
      });
    }
    chunk.remoteDoneReceived = true;
    this.syncChunk(messages, events, false);
  }

  private handleChunkGet(
    message: OrpChunkGetMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const chunk = this.ensureChunkContext();
    messages.push({
      type: "orp/chunk-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle: message.docHandle,
      chunks: this.adapter.getChunkUnits(message.docHandle, message.chunkIds),
    });
    chunk.remoteRequestComplete = true;
    this.maybeFinishDocument(messages, events);
  }

  private handleChunkPut(
    message: OrpChunkPutMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const chunk = this.ensureChunkContext();
    this.adapter.applyChunkUnits(message.docHandle, message.chunks);
    chunk.localRequestComplete = true;
    this.maybeFinishDocument(messages, events);
  }

  private handleDocFrame(
    message: OrpDocFrameMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const ops = this.ensureOperationContext();
    this.setDocumentPhase("ops");
    ops.session.mergeFrame(message.frame);
    ops.replay.receivedFrames.push(message.frame);
    this.syncOperations(messages, events, true);
  }

  private handleDocDone(
    message: OrpDocDoneMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const ops = this.ensureOperationContext();
    ops.remoteDoneReceived = true;
    ops.remoteMissingOpIds = [...message.missingOpIds];
    if (message.missingOpIds.length === 0) {
      ops.remoteRequestComplete = true;
    }
    this.maybeRequestMissingOps(messages);
    this.maybeFinishDocument(messages, events);
  }

  private handleBlobGet(
    message: OrpBlobGetMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const ops = this.ensureOperationContext();
    messages.push({
      type: "orp/blob-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle: message.docHandle,
      ops: this.adapter.getBlobUnits(message.docHandle, message.opIds),
    });
    ops.remoteBlobServed = true;
    if (ops.remoteMissingOpIds && ops.remoteMissingOpIds.length > 0) {
      ops.remoteRequestComplete = true;
    }
    this.maybeFinishDocument(messages, events);
  }

  private handleBlobPut(
    message: OrpBlobPutMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const ops = this.ensureOperationContext();
    this.adapter.applyBlobUnits(message.docHandle, message.ops);
    ops.localRequestComplete = true;
    this.maybeFinishDocument(messages, events);
  }

  private handleSnapshotGet(
    message: OrpSnapshotGetMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    const payload = this.adapter.getSnapshotPayload(message.docHandle, message.snapshotId);
    if (!payload) {
      throw new Error(`missing snapshot ${message.snapshotId} for ${message.docHandle}`);
    }
    messages.push({
      type: "orp/snapshot-put",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle: message.docHandle,
      snapshot: payload.snapshot,
      tailOps: payload.tailOps,
    });
    this.document!.snapshotProvided = true;
    if (this.options.role === "responder") {
      this.finishDocument("snapshot", messages, events);
    }
  }

  private handleSnapshotPut(
    message: OrpSnapshotPutMessage,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    if (!this.ensureCurrentDocument(message.docHandle)) {
      return;
    }
    this.adapter.applySnapshotPayload(message.docHandle, {
      snapshot: message.snapshot,
      tailOps: message.tailOps,
    });
    this.document!.snapshotApplied = true;
    this.progressDocument(messages, events);
  }

  private ensureInventory(): InventoryContext {
    if (!this.inventory) {
      const localEntries = this.adapter.listInventoryEntries();
      const session = createOrpRibltSession(this.options.inventoryParams);
      session.add(localEntries.map((entry) => entry.entryId));
      this.inventory = {
        session,
        localEntries,
        localById: new Map(localEntries.map((entry) => [entry.entryId, entry])),
        replay: {
          framesSent: 0,
          receivedFrames: [],
        },
        localDoneSent: false,
        remoteDoneReceived: false,
        localDiffs: new Map(),
        remoteDiffs: new Map(),
      };
    }
    return this.inventory;
  }

  private createInventoryFrame(): OrpInventoryFrameMessage {
    const inventory = this.ensureInventory();
    inventory.replay.framesSent += 1;
    return {
      type: "orp/inventory-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      frame: inventory.session.createFrame({ count: this.options.inventoryParams.batchSize }),
    };
  }

  private syncInventory(
    messages: OrpMessage[],
    events: OrpEndpointEvent[],
    replyWithFrame: boolean
  ): void {
    const inventory = this.ensureInventory();
    const result = inventory.session.decode();
    if (result.status === "failed") {
      throw new Error("inventory RIBLT decode failed");
    }

    if (result.status === "complete" && !inventory.localDoneSent) {
      inventory.localDoneSent = true;
      inventory.localDiffs = new Map(this.buildInventoryDiffs(result.extra).map((entry) => [entry.docHandle, entry]));
      messages.push({
        type: "orp/inventory-done",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        differingDocs: [...inventory.localDiffs.values()],
      });
    }

    if (replyWithFrame && !(inventory.localDoneSent && inventory.remoteDoneReceived)) {
      messages.push(this.createInventoryFrame());
    }

    if (inventory.localDoneSent && inventory.remoteDoneReceived) {
      const differingDocs = this.combineInventoryDiffs();
      this.state.pendingDocs = differingDocs.map((entry) => entry.docHandle);
      if (this.state.phase !== "document" && this.state.phase !== "complete") {
        this.setPhase("document", events);
        events.push({ type: "inventory-ready", differingDocs });
      }

      if (this.options.role === "initiator" && !this.state.currentDoc) {
        this.openNextDocument(messages, events);
      }
    }
  }

  private combineInventoryDiffs(): InventoryDiffEntry[] {
    const inventory = this.ensureInventory();
    const combined = new Map<DocHandle, InventoryDiffEntry>();
    for (const entry of [...inventory.localDiffs.values(), ...inventory.remoteDiffs.values()]) {
      combined.set(entry.docHandle, {
        ...(combined.get(entry.docHandle) ?? { docHandle: entry.docHandle }),
        ...entry,
      });
    }
    return [...combined.values()].sort((left, right) => left.docHandle.localeCompare(right.docHandle));
  }

  private buildInventoryDiffs(entryIds: string[]): InventoryDiffEntry[] {
    const inventory = this.ensureInventory();
    const docs = new Map<DocHandle, InventoryDiffEntry>();
    for (const entryId of entryIds) {
      const entry = inventory.localById.get(entryId);
      if (!entry) {
        continue;
      }
      docs.set(entry.docHandle, {
        ...(docs.get(entry.docHandle) ?? { docHandle: entry.docHandle }),
        ...(this.options.role === "initiator"
          ? { localSummaryHash: entry.summaryHash }
          : { remoteSummaryHash: entry.summaryHash }),
      });
    }
    return [...docs.values()].sort((left, right) => left.docHandle.localeCompare(right.docHandle));
  }

  private openNextDocument(messages: OrpMessage[], events: OrpEndpointEvent[]): void {
    const nextDoc = this.state.pendingDocs.find((docHandle) => !this.state.completedDocs.includes(docHandle));
    if (!nextDoc) {
      this.setPhase("complete", events);
      events.push({ type: "complete" });
      return;
    }
    this.openDocument(nextDoc, events);
    messages.push({
      type: "orp/doc-open",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle: nextDoc,
    });
    messages.push(this.createDocStatusMessage(nextDoc));
    this.document!.localStatusSent = true;
  }

  private openDocument(docHandle: DocHandle, events: OrpEndpointEvent[]): void {
    this.document = {
      docHandle,
      localStatusSent: false,
      snapshotRequested: false,
      snapshotApplied: false,
      snapshotProvided: false,
    };
    this.state.currentDoc = docHandle;
    this.setDocumentPhase("status");
    events.push({ type: "document-started", docHandle });
  }

  private createDocStatusMessage(docHandle: DocHandle): OrpDocStatusMessage {
    const view = this.adapter.getDocumentView(docHandle);
    return {
      type: "orp/doc-status",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle,
      summary: view.summary,
      recentSnapshots: view.recentSnapshots,
      chunking: view.chunking,
    };
  }

  private progressDocument(messages: OrpMessage[], events: OrpEndpointEvent[]): void {
    const document = this.requireDocument();
    if (!document.remoteView) {
      return;
    }

    const localView = this.adapter.getDocumentView(document.docHandle);
    if (sameDocSummary(localView.summary, document.remoteView.summary)) {
      this.finishDocument(document.snapshotApplied ? "snapshot" : "noop", messages, events);
      return;
    }

    if (shouldRequestResponderSnapshot(localView, document.remoteView, this.options.snapshotTailCountThreshold)) {
      this.setDocumentPhase("snapshot");
      if (this.options.role === "initiator" && !document.snapshotRequested && !document.snapshotApplied) {
        document.snapshotRequested = true;
        document.strategy = "snapshot";
        messages.push({
          type: "orp/snapshot-get",
          version: ORP_PROTOCOL_VERSION,
          sessionId: this.options.sessionId,
          docHandle: document.docHandle,
          snapshotId: document.remoteView.recentSnapshots[0],
        });
      }
      return;
    }

    if (localView.chunking && document.remoteView.chunking) {
      const differingTransferIsWorthIt = shouldTransferChunksForViews(
        localView,
        document.remoteView,
        this.options.chunkTransferThreshold
      );
      if (differingTransferIsWorthIt) {
        const chunk = this.ensureChunkContext();
        this.setDocumentPhase("chunk");
        document.strategy = document.snapshotApplied ? "snapshot+chunk" : "chunk";
        if (chunk.replay.framesSent === 0) {
          messages.push(this.createChunkFrame());
        }
        return;
      }
    }

    const ops = this.ensureOperationContext();
    this.setDocumentPhase("ops");
    document.strategy = document.snapshotApplied ? "snapshot+ops" : "ops";
    if (ops.replay.framesSent === 0) {
      messages.push(this.createDocFrame());
    }
  }

  private ensureChunkContext(): ChunkContext {
    const document = this.requireDocument();
    if (!document.chunk) {
      const localEntries = this.adapter.listChunkEntries(document.docHandle);
      const session = createOrpRibltSession(this.options.operationParams);
      session.add(localEntries.map((entry) => entry.entryId));
      document.chunk = {
        session,
        localEntries,
        localById: new Map(localEntries.map((entry) => [entry.entryId, entry])),
        replay: {
          framesSent: 0,
          receivedFrames: [],
        },
        localDoneSent: false,
        remoteDoneReceived: false,
        localDiffs: new Map(),
        remoteDiffs: new Map(),
        localRequestComplete: false,
        remoteRequestComplete: false,
        remoteNeedsLocalChunks: false,
      };
    }
    return document.chunk;
  }

  private createChunkFrame(): OrpChunkFrameMessage {
    const document = this.requireDocument();
    const chunk = this.ensureChunkContext();
    chunk.replay.framesSent += 1;
    return {
      type: "orp/chunk-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle: document.docHandle,
      frame: chunk.session.createFrame({ count: this.options.operationParams.batchSize }),
    };
  }

  private syncChunk(
    messages: OrpMessage[],
    events: OrpEndpointEvent[],
    replyWithFrame: boolean
  ): void {
    const document = this.requireDocument();
    const chunk = this.ensureChunkContext();
    const result = chunk.session.decode();
    if (result.status === "failed") {
      throw new Error("chunk RIBLT decode failed");
    }

    if (result.status === "complete" && !chunk.localDoneSent) {
      chunk.localDoneSent = true;
      chunk.localDiffs = new Map(this.buildChunkDiffs(result.extra).map((entry) => [entry.chunkId, entry]));
      messages.push({
        type: "orp/chunk-done",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        docHandle: document.docHandle,
        differingChunks: [...chunk.localDiffs.values()],
      });
    }

    if (replyWithFrame && !(chunk.localDoneSent && chunk.remoteDoneReceived)) {
      messages.push(this.createChunkFrame());
    }

    if (chunk.localDoneSent && chunk.remoteDoneReceived) {
      const combined = this.combineChunkDiffs();
      const localChunkIds = combined
        .filter((entry) => entry.localSummaryHash && !entry.remoteSummaryHash)
        .map((entry) => entry.chunkId);
      const remoteChunkIds = combined
        .filter((entry) => entry.remoteSummaryHash && !entry.localSummaryHash)
        .map((entry) => entry.chunkId);
      const mismatchedChunkIds = combined
        .filter((entry) => entry.localSummaryHash && entry.remoteSummaryHash)
        .map((entry) => entry.chunkId);
      const needFromRemote = this.options.role === "initiator"
        ? [...remoteChunkIds, ...mismatchedChunkIds]
        : [...localChunkIds, ...mismatchedChunkIds];
      chunk.remoteNeedsLocalChunks = this.options.role === "initiator"
        ? localChunkIds.length > 0 || mismatchedChunkIds.length > 0
        : remoteChunkIds.length > 0 || mismatchedChunkIds.length > 0;

      if (needFromRemote.length > 0 && !chunk.localRequestComplete) {
        messages.push({
          type: "orp/chunk-get",
          version: ORP_PROTOCOL_VERSION,
          sessionId: this.options.sessionId,
          docHandle: document.docHandle,
          chunkIds: needFromRemote,
        });
      } else {
        chunk.localRequestComplete = true;
      }

      if (!chunk.remoteNeedsLocalChunks) {
        chunk.remoteRequestComplete = true;
      }
    }

    this.maybeFinishDocument(messages, events);
  }

  private combineChunkDiffs(): ChunkDiffEntry[] {
    const chunk = this.ensureChunkContext();
    const combined = new Map<ChunkId, ChunkDiffEntry>();
    for (const entry of [...chunk.localDiffs.values(), ...chunk.remoteDiffs.values()]) {
      combined.set(entry.chunkId, {
        ...(combined.get(entry.chunkId) ?? { chunkId: entry.chunkId }),
        ...entry,
      });
    }
    return [...combined.values()].sort((left, right) => left.chunkId.localeCompare(right.chunkId));
  }

  private buildChunkDiffs(entryIds: string[]): ChunkDiffEntry[] {
    const chunk = this.ensureChunkContext();
    const diffs = new Map<ChunkId, ChunkDiffEntry>();
    for (const entryId of entryIds) {
      const entry = chunk.localById.get(entryId);
      if (!entry) {
        continue;
      }
      diffs.set(entry.chunkId, {
        ...(diffs.get(entry.chunkId) ?? { chunkId: entry.chunkId }),
        ...(this.options.role === "initiator"
          ? { localSummaryHash: entry.summaryHash }
          : { remoteSummaryHash: entry.summaryHash }),
      });
    }
    return [...diffs.values()].sort((left, right) => left.chunkId.localeCompare(right.chunkId));
  }

  private ensureOperationContext(): OperationContext {
    const document = this.requireDocument();
    if (!document.ops) {
      const localOpIds = this.adapter.listOperationIds(document.docHandle);
      const session = createOrpRibltSession(this.options.operationParams);
      session.add(localOpIds);
      document.ops = {
        session,
        localOpIds,
        replay: {
          framesSent: 0,
          receivedFrames: [],
        },
        localDoneSent: false,
        remoteDoneReceived: false,
        localMissingOpIds: [],
        localRequestComplete: false,
        remoteRequestComplete: false,
        remoteBlobServed: false,
      };
    }
    return document.ops;
  }

  private createDocFrame(): OrpDocFrameMessage {
    const document = this.requireDocument();
    const ops = this.ensureOperationContext();
    ops.replay.framesSent += 1;
    return {
      type: "orp/doc-frame",
      version: ORP_PROTOCOL_VERSION,
      sessionId: this.options.sessionId,
      docHandle: document.docHandle,
      frame: ops.session.createFrame({ count: this.options.operationParams.batchSize }),
    };
  }

  private syncOperations(
    messages: OrpMessage[],
    events: OrpEndpointEvent[],
    replyWithFrame: boolean
  ): void {
    const document = this.requireDocument();
    const ops = this.ensureOperationContext();
    const result = ops.session.decode();
    if (result.status === "failed") {
      throw new Error("operation RIBLT decode failed");
    }

    if (result.status === "complete" && !ops.localDoneSent) {
      ops.localDoneSent = true;
      ops.localMissingOpIds = [...result.missing].sort();
      ops.localRequestComplete = ops.localMissingOpIds.length === 0;
      messages.push({
        type: "orp/doc-done",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        docHandle: document.docHandle,
        missingOpIds: ops.localMissingOpIds,
      });
      this.maybeRequestMissingOps(messages);
    }

    if (replyWithFrame && !(ops.localDoneSent && ops.remoteDoneReceived)) {
      messages.push(this.createDocFrame());
    }

    this.maybeFinishDocument(messages, events);
  }

  private maybeRequestMissingOps(messages: OrpMessage[]): void {
    const document = this.requireDocument();
    const ops = this.ensureOperationContext();
    if (ops.localDoneSent && !ops.localRequestComplete && ops.localMissingOpIds.length > 0) {
      messages.push({
        type: "orp/blob-get",
        version: ORP_PROTOCOL_VERSION,
        sessionId: this.options.sessionId,
        docHandle: document.docHandle,
        opIds: ops.localMissingOpIds,
      });
    }
  }

  private maybeFinishDocument(messages: OrpMessage[], events: OrpEndpointEvent[]): void {
    const document = this.requireDocument();
    if (document.chunk) {
      if (document.chunk.localRequestComplete && document.chunk.remoteRequestComplete) {
        this.finishDocument(document.strategy ?? "chunk", messages, events);
      }
      return;
    }

    if (document.ops) {
      const localReady = document.ops.localDoneSent && document.ops.localRequestComplete;
      const remoteReady = document.ops.remoteDoneReceived && document.ops.remoteRequestComplete;
      if (localReady && remoteReady) {
        this.finishDocument(document.strategy ?? "ops", messages, events);
      }
    }
  }

  private finishDocument(
    strategy: OrpDocumentStrategy,
    messages: OrpMessage[],
    events: OrpEndpointEvent[]
  ): void {
    const document = this.requireDocument();
    if (this.state.completedDocs.includes(document.docHandle)) {
      return;
    }
    this.state.completedDocs.push(document.docHandle);
    this.setDocumentPhase("done");
    events.push({
      type: "document-complete",
      docHandle: document.docHandle,
      strategy,
    });

    if (this.options.role === "initiator") {
      this.document = undefined;
      this.state.currentDoc = undefined;
      this.openNextDocument(messages, events);
      return;
    }

    if (this.state.completedDocs.length === this.state.pendingDocs.length && this.state.pendingDocs.length > 0) {
      this.document = undefined;
      this.state.currentDoc = undefined;
      this.setPhase("complete", events);
      events.push({ type: "complete" });
    }
  }

  private ensureCurrentDocument(docHandle: DocHandle): boolean {
    if (this.document && this.document.docHandle === docHandle) {
      return true;
    }
    if (this.state.completedDocs.includes(docHandle)) {
      return false;
    }
    if (!this.document || this.document.docHandle !== docHandle) {
      throw new Error(`unexpected document ${docHandle}`);
    }
    return true;
  }

  private requireDocument(): DocumentContext {
    if (!this.document) {
      throw new Error("no document is currently active");
    }
    return this.document;
  }

  private setPhase(phase: OrpEndpointPhase, events?: OrpEndpointEvent[]): void {
    if (this.state.phase === phase) {
      return;
    }
    this.state.phase = phase;
    this.state.transcriptLength = this.transcript.length;
    if (events) {
      events.push({
        type: "phase-changed",
        phase,
        currentDoc: this.state.currentDoc,
      });
    }
  }

  private setDocumentPhase(phase: OrpEndpointDocumentPhase): void {
    this.state.documentPhase = phase;
  }

  private recordIncoming(message: OrpMessage, note: string): void {
    this.transcript.push({
      from: otherRole(this.options.role),
      to: this.options.role,
      note,
      message,
    });
    this.state.transcriptLength = this.transcript.length;
  }

  private recordOutgoing(messages: OrpMessage[], note: string): void {
    for (const message of messages) {
      this.transcript.push({
        from: this.options.role,
        to: otherRole(this.options.role),
        note,
        message,
      });
    }
    this.state.transcriptLength = this.transcript.length;
  }

  private fail(reason: string): OrpEndpointStepResult {
    this.state.failedReason = reason;
    this.setPhase("failed");
    return {
      messages: [],
      events: [{ type: "failed", reason }],
      state: this.getState(),
    };
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

function assertSameParameters(
  actual: OrpParameters,
  expected: OrpParameters,
  label: string
): void {
  if (
    actual.symbolSize !== expected.symbolSize ||
    actual.batchSize !== expected.batchSize ||
    actual.hashSeed !== expected.hashSeed
  ) {
    throw new Error(`${label} mismatch between peers`);
  }
}

function otherRole(role: "initiator" | "responder"): "initiator" | "responder" {
  return role === "initiator" ? "responder" : "initiator";
}

function replayRibltSession(
  params: OrpParameters,
  ids: Iterable<string>,
  replay: SerializedRibltReplayState
): OrpRibltSessionApi {
  const session = createOrpRibltSession(params);
  session.add(ids);
  for (let index = 0; index < replay.framesSent; index += 1) {
    session.createFrame({ count: params.batchSize });
  }
  for (const frame of replay.receivedFrames) {
    session.mergeFrame(frame);
  }
  return session;
}

function shouldRequestResponderSnapshot(
  initiatorView: OrpPeerDocumentView,
  responderView: OrpPeerDocumentView,
  threshold: number
): boolean {
  return (
    responderView.recentSnapshots.length > 0 &&
    responderView.summary.tailCount >= threshold &&
    responderView.summary.tailCount >= initiatorView.summary.tailCount
  );
}

function shouldTransferChunksForViews(
  initiatorView: OrpPeerDocumentView,
  responderView: OrpPeerDocumentView,
  threshold: number
): boolean {
  const initiatorCounts = new Map(
    (initiatorView.chunking?.summaries ?? []).map((summary) => [summary.chunkId, summary.opCount])
  );
  const responderCounts = new Map(
    (responderView.chunking?.summaries ?? []).map((summary) => [summary.chunkId, summary.opCount])
  );
  const differingChunkIds = new Set<ChunkId>();
  for (const chunkId of initiatorCounts.keys()) {
    differingChunkIds.add(chunkId);
  }
  for (const chunkId of responderCounts.keys()) {
    differingChunkIds.add(chunkId);
  }
  let estimatedOps = 0;
  for (const chunkId of differingChunkIds) {
    const initiatorCount = initiatorCounts.get(chunkId) ?? 0;
    const responderCount = responderCounts.get(chunkId) ?? 0;
    if (initiatorCount !== responderCount) {
      estimatedOps += Math.max(initiatorCount, responderCount);
    }
  }
  return estimatedOps >= threshold;
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
