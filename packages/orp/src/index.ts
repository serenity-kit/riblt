import type { RibltMessage } from "riblt";

export const ORP_PROTOCOL_VERSION = 1 as const;
export const ORP_RIBLT_MESSAGE_VERSION = 1 as const;
export const ORP_RIBLT_HASH_ID = "xxh3-128" as const;

export type Digest = string;
export type DocHandle = string;
export type OpId = string;
export type ScopeId = string;
export type SessionId = string;
export type SnapshotId = string;

export interface OrpParameters {
  symbolSize: number;
  batchSize: number;
  hashSeed: string;
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

export interface InventoryDiffEntry {
  docHandle: DocHandle;
  localSummaryHash?: Digest;
  remoteSummaryHash?: Digest;
}

export interface BlobUnit {
  opId: OpId;
  blob: string;
}

export interface SnapshotUnit {
  snapshotId: SnapshotId;
  blob: string;
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
  | OrpDocFrameMessage
  | OrpDocDoneMessage
  | OrpBlobGetMessage
  | OrpBlobPutMessage
  | OrpSnapshotGetMessage
  | OrpSnapshotPutMessage;

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

const HEX_16 = /^[0-9a-f]{16}$/;

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
        validateOptionalString(entry.localSummaryHash, `${path}.localSummaryHash`, issues);
        validateOptionalString(entry.remoteSummaryHash, `${path}.remoteSummaryHash`, issues);
      });
      break;
    case "orp/doc-open":
      validateString(value.docHandle, "$.docHandle", issues);
      break;
    case "orp/doc-status":
      validateString(value.docHandle, "$.docHandle", issues);
      validateDocSummaryInto(value.summary, "$.summary", issues);
      validateArray(value.recentSnapshots, "$.recentSnapshots", issues, (snapshotId, path) => {
        validateString(snapshotId, path, issues);
      });
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
      });
      break;
    case "orp/blob-get":
      validateString(value.docHandle, "$.docHandle", issues);
      validateArray(value.opIds, "$.opIds", issues, (opId, path) => {
        validateString(opId, path, issues);
      });
      break;
    case "orp/blob-put":
      validateString(value.docHandle, "$.docHandle", issues);
      validateArray(value.ops, "$.ops", issues, (op, path) => {
        validateBlobUnit(op, path, issues);
      });
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
      });
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
  });

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
  validateString(value.seed, `${path}.seed`, issues);
  validateArray(value.coded, `${path}.coded`, issues, (coded, codedPath) => {
    if (!isRecord(coded)) {
      issues.push({ path: codedPath, message: "must be an object" });
      return;
    }
    validateInteger(coded.count, `${codedPath}.count`, issues);
    validateString(coded.hash, `${codedPath}.hash`, issues);
    validateString(coded.symbol, `${codedPath}.symbol`, issues);
  });
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
  validateString(value.xorA, `${path}.xorA`, issues);
  validateString(value.xorB, `${path}.xorB`, issues);
  validateString(value.sumA, `${path}.sumA`, issues);
  validateString(value.sumB, `${path}.sumB`, issues);
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
  validateItem: (item: T, path: string) => void
): void {
  if (!Array.isArray(value)) {
    issues.push({ path, message: "must be an array" });
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
