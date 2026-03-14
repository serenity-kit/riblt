import {
  createRiblt,
  resolveRibltOptions,
  type ResolvedRibltOptions,
  type RibltDecodeResult,
  type RibltMessage,
  type RibltOptions,
  type RibltSessionApi,
} from "riblt";

export const SETSYNC_PROTOCOL_VERSION = 1 as const;

export interface SetSyncParameters {
  symbolSize: number;
  batchSize: number;
  hashSeed: string;
}

export interface SetSyncHelloMessage {
  type: "setsync/hello";
  version: typeof SETSYNC_PROTOCOL_VERSION;
  sessionId: string;
  parameters: SetSyncParameters;
}

export interface SetSyncHelloAckMessage {
  type: "setsync/hello-ack";
  version: typeof SETSYNC_PROTOCOL_VERSION;
  sessionId: string;
  accepted: true;
  parameters: SetSyncParameters;
}

export interface SetSyncSyncMessage {
  type: "setsync/sync";
  version: typeof SETSYNC_PROTOCOL_VERSION;
  sessionId: string;
  frame: RibltMessage;
}

export interface SetSyncSyncResponseMessage {
  type: "setsync/sync-response";
  version: typeof SETSYNC_PROTOCOL_VERSION;
  sessionId: string;
  frame: RibltMessage;
  result: RibltDecodeResult;
  done: boolean;
  rounds: number;
}

export interface SetSyncErrorMessage {
  type: "setsync/error";
  version: typeof SETSYNC_PROTOCOL_VERSION;
  sessionId: string;
  code: "invalid_message" | "session_mismatch" | "parameter_mismatch";
  message: string;
}

export type SetSyncMessage =
  | SetSyncHelloMessage
  | SetSyncHelloAckMessage
  | SetSyncSyncMessage
  | SetSyncSyncResponseMessage
  | SetSyncErrorMessage;

export interface SetSyncPeerOptions {
  ids: Iterable<string>;
  sessionId?: string;
  parameters?: RibltOptions;
}

export interface SetSyncPeerFromHelloOptions {
  ids: Iterable<string>;
  hello: SetSyncHelloMessage;
}

export interface SetSyncResponseState {
  local: RibltDecodeResult;
  remote: RibltDecodeResult;
  done: boolean;
}

export function createSetSyncSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `setsync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSetSyncParameters(options: RibltOptions = {}): SetSyncParameters {
  return resolvedOptionsToParameters(resolveRibltOptions(options));
}

export function setSyncParametersToRibltOptions(parameters: SetSyncParameters): RibltOptions {
  return {
    symbolSize: parameters.symbolSize,
    batchSize: parameters.batchSize,
    hashSeed: parseHashSeed(parameters.hashSeed),
  };
}

export function createSetSyncPeer(options: SetSyncPeerOptions): SetSyncPeer {
  return new SetSyncPeer(options);
}

export function createSetSyncPeerFromHello(options: SetSyncPeerFromHelloOptions): SetSyncPeer {
  return new SetSyncPeer({
    ids: options.ids,
    sessionId: options.hello.sessionId,
    parameters: setSyncParametersToRibltOptions(options.hello.parameters),
  });
}

export class SetSyncPeer {
  private readonly sessionId: string;
  private readonly parameters: SetSyncParameters;
  private readonly riblt: RibltSessionApi;
  private handshaken = false;
  private rounds = 0;

  constructor(options: SetSyncPeerOptions) {
    const resolved = resolveRibltOptions(options.parameters);
    this.sessionId = options.sessionId ?? createSetSyncSessionId();
    this.parameters = resolvedOptionsToParameters(resolved);
    this.riblt = createRiblt(resolved);
    this.riblt.add(options.ids);
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getParameters(): SetSyncParameters {
    return { ...this.parameters };
  }

  getResult(): RibltDecodeResult {
    return this.riblt.decode();
  }

  createHello(): SetSyncHelloMessage {
    return {
      type: "setsync/hello",
      version: SETSYNC_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      parameters: this.getParameters(),
    };
  }

  receiveHello(message: SetSyncHelloMessage): SetSyncHelloAckMessage {
    validateProtocolVersion(message.version);
    this.ensureSession(message.sessionId);
    this.ensureParameters(message.parameters);
    this.handshaken = true;

    return {
      type: "setsync/hello-ack",
      version: SETSYNC_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      accepted: true,
      parameters: this.getParameters(),
    };
  }

  receiveHelloAck(message: SetSyncHelloAckMessage): void {
    validateProtocolVersion(message.version);
    this.ensureSession(message.sessionId);
    if (!message.accepted) {
      throw new Error("setsync handshake was rejected");
    }
    this.ensureParameters(message.parameters);
    this.handshaken = true;
  }

  createSyncMessage(options: { count?: number } = {}): SetSyncSyncMessage {
    this.ensureHandshaken();
    return {
      type: "setsync/sync",
      version: SETSYNC_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      frame: this.riblt.encode({
        count: options.count,
        format: "object",
      }) as RibltMessage,
    };
  }

  receiveSyncMessage(message: SetSyncSyncMessage): RibltDecodeResult {
    this.ensureHandshaken();
    validateProtocolVersion(message.version);
    this.ensureSession(message.sessionId);
    this.riblt.merge(message.frame);
    this.rounds += 1;
    return this.riblt.decode();
  }

  respondToSync(message: SetSyncSyncMessage, options: { count?: number } = {}): SetSyncSyncResponseMessage {
    const result = this.receiveSyncMessage(message);

    return {
      type: "setsync/sync-response",
      version: SETSYNC_PROTOCOL_VERSION,
      sessionId: this.sessionId,
      frame: this.riblt.encode({
        count: options.count,
        format: "object",
      }) as RibltMessage,
      result,
      done: result.status === "complete",
      rounds: this.rounds,
    };
  }

  receiveSyncResponse(message: SetSyncSyncResponseMessage): SetSyncResponseState {
    this.ensureHandshaken();
    validateProtocolVersion(message.version);
    this.ensureSession(message.sessionId);
    const local = this.receiveSyncMessage({
      type: "setsync/sync",
      version: message.version,
      sessionId: message.sessionId,
      frame: message.frame,
    });

    return {
      local,
      remote: message.result,
      done: local.status === "complete" && message.done,
    };
  }

  private ensureHandshaken(): void {
    if (!this.handshaken) {
      throw new Error("setsync handshake has not completed");
    }
  }

  private ensureSession(sessionId: string): void {
    if (sessionId !== this.sessionId) {
      throw new Error("setsync session mismatch");
    }
  }

  private ensureParameters(parameters: SetSyncParameters): void {
    const expected = JSON.stringify(this.parameters);
    const received = JSON.stringify(parameters);
    if (expected !== received) {
      throw new Error("setsync parameter mismatch");
    }
  }
}

function resolvedOptionsToParameters(options: ResolvedRibltOptions): SetSyncParameters {
  return {
    symbolSize: options.symbolSize,
    batchSize: options.batchSize,
    hashSeed: formatHashSeed(options.hashSeed),
  };
}

function formatHashSeed(hashSeed: bigint): string {
  return (hashSeed & ((1n << 64n) - 1n)).toString(16).padStart(16, "0");
}

function parseHashSeed(hashSeed: string): bigint {
  return BigInt(`0x${hashSeed}`);
}

function validateProtocolVersion(version: number): void {
  if (version !== SETSYNC_PROTOCOL_VERSION) {
    throw new Error(`unsupported setsync protocol version: ${version}`);
  }
}
