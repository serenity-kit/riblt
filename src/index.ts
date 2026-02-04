import { XXH3_128 } from "./utils/xxh3.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const LENGTH_BYTES = 4;
const DEFAULT_SYMBOL_SIZE = 64;
const DEFAULT_BATCH_SIZE = 1;
const HASH_ID = "xxh3-128" as const;
const VERSION = 1 as const;
const MASK_64 = (1n << 64n) - 1n;
const MASK_128 = (1n << 128n) - 1n;
const UINT32_FLOAT = 2 ** 32;
const RANDOM_MAPPING_MULTIPLIER = 0xda942042e4dd58b5n;

export type RibltStatus = "complete" | "incomplete" | "failed";

export interface RibltDecodeResult {
  status: RibltStatus;
  missing: string[];
  extra: string[];
}

export interface RibltOptions {
  symbolSize?: number;
  expectedDiff?: number;
  errorRate?: number;
  batchSize?: number;
  hashSeed?: bigint;
}

export interface RibltMessage {
  v: typeof VERSION;
  hash: typeof HASH_ID;
  symbolSize: number;
  seed: string;
  coded: RibltCodedSymbolMessage[];
}

export interface RibltCodedSymbolMessage {
  count: number;
  hash: string;
  symbol: string;
}

interface HashedSymbol {
  symbol: Uint8Array;
  hash: bigint;
}

interface CodedSymbol {
  symbol: Uint8Array;
  hash: bigint;
  count: number;
}

interface SymbolMapping {
  sourceIdx: number;
  codedIdx: number;
}

class RandomMapping {
  prng: bigint;
  lastIndex: number;

  constructor(seed: bigint, lastIndex: number) {
    this.prng = seed & MASK_64;
    this.lastIndex = lastIndex;
  }

  nextIndex(): number {
    this.prng = (this.prng * RANDOM_MAPPING_MULTIPLIER) & MASK_64;
    const prngFloat = Number(this.prng);
    const diff = Math.ceil(
      (this.lastIndex + 1.5) * (UINT32_FLOAT / Math.sqrt(prngFloat + 1) - 1)
    );
    this.lastIndex += diff;
    return this.lastIndex;
  }
}

class CodingWindow {
  symbols: HashedSymbol[] = [];
  mappings: RandomMapping[] = [];
  queue: SymbolMapping[] = [];
  nextIdx = 0;

  addSymbol(symbol: Uint8Array, hash: bigint): void {
    this.addHashedSymbol({ symbol, hash });
  }

  addHashedSymbol(symbol: HashedSymbol): void {
    this.addHashedSymbolWithMapping(symbol, new RandomMapping(seedFromHash(symbol.hash), 0));
  }

  addHashedSymbolWithMapping(symbol: HashedSymbol, mapping: RandomMapping): void {
    this.symbols.push(symbol);
    this.mappings.push(mapping);
    this.queue.push({ sourceIdx: this.symbols.length - 1, codedIdx: mapping.lastIndex });
    heapFixTail(this.queue);
  }

  applyWindow(coded: CodedSymbol, direction: number): CodedSymbol {
    if (this.queue.length === 0) {
      this.nextIdx += 1;
      return coded;
    }
    while (this.queue[0].codedIdx === this.nextIdx) {
      const mapping = this.queue[0];
      coded = applySymbol(coded, this.symbols[mapping.sourceIdx], direction);
      const nextMap = this.mappings[mapping.sourceIdx].nextIndex();
      this.queue[0].codedIdx = nextMap;
      heapFixHead(this.queue);
    }
    this.nextIdx += 1;
    return coded;
  }

  reset(): void {
    if (this.symbols.length !== 0) {
      this.symbols.length = 0;
    }
    if (this.mappings.length !== 0) {
      this.mappings.length = 0;
    }
    if (this.queue.length !== 0) {
      this.queue.length = 0;
    }
    this.nextIdx = 0;
  }
}

class Encoder {
  private window = new CodingWindow();
  private symbolSize: number;

  constructor(symbolSize: number) {
    this.symbolSize = symbolSize;
  }

  addHashedSymbol(symbol: HashedSymbol): void {
    this.window.addHashedSymbol(symbol);
  }

  produceNextCodedSymbol(): CodedSymbol {
    const coded = createEmptyCodedSymbol(this.symbolSize);
    return this.window.applyWindow(coded, 1);
  }

  reset(): void {
    this.window.reset();
  }
}

class Decoder {
  cs: CodedSymbol[] = [];
  local = new CodingWindow();
  window = new CodingWindow();
  remote = new CodingWindow();
  decodable: number[] = [];
  decoded = 0;
  private symbolSize: number;
  private hashSeed: bigint;

  constructor(symbolSize: number, hashSeed: bigint) {
    this.symbolSize = symbolSize;
    this.hashSeed = hashSeed;
  }

  decodedAll(): boolean {
    return this.decoded === this.cs.length;
  }

  addHashedSymbol(symbol: HashedSymbol): void {
    this.window.addHashedSymbol(symbol);
  }

  addCodedSymbol(coded: CodedSymbol): void {
    let c = coded;
    c = this.window.applyWindow(c, -1);
    c = this.remote.applyWindow(c, -1);
    c = this.local.applyWindow(c, 1);
    this.cs.push(c);
    const idx = this.cs.length - 1;
    if ((c.count === 1 || c.count === -1) && c.hash === hashSymbol(c.symbol, this.hashSeed)) {
      this.decodable.push(idx);
    } else if (c.count === 0 && c.hash === 0n) {
      this.decodable.push(idx);
    }
  }

  tryDecode(): void {
    for (let idx = 0; idx < this.decodable.length; idx += 1) {
      const cidx = this.decodable[idx];
      const c = this.cs[cidx];
      switch (c.count) {
        case 1: {
          const ns: HashedSymbol = { symbol: c.symbol.slice(), hash: c.hash };
          const mapping = this.applyNewSymbol(ns, -1);
          this.remote.addHashedSymbolWithMapping(ns, mapping);
          this.decoded += 1;
          break;
        }
        case -1: {
          const ns: HashedSymbol = { symbol: c.symbol.slice(), hash: c.hash };
          const mapping = this.applyNewSymbol(ns, 1);
          this.local.addHashedSymbolWithMapping(ns, mapping);
          this.decoded += 1;
          break;
        }
        case 0:
          this.decoded += 1;
          break;
        default:
          throw new Error("invalid degree for decodable coded symbol");
      }
    }
    this.decodable.length = 0;
  }

  reset(): void {
    if (this.cs.length !== 0) {
      this.cs.length = 0;
    }
    if (this.decodable.length !== 0) {
      this.decodable.length = 0;
    }
    this.local.reset();
    this.remote.reset();
    this.window.reset();
    this.decoded = 0;
  }

  private applyNewSymbol(symbol: HashedSymbol, direction: number): RandomMapping {
    const mapping = new RandomMapping(seedFromHash(symbol.hash), 0);
    while (mapping.lastIndex < this.cs.length) {
      const cidx = mapping.lastIndex;
      this.cs[cidx] = applySymbol(this.cs[cidx], symbol, direction);
      if (
        (this.cs[cidx].count === 1 || this.cs[cidx].count === -1) &&
        this.cs[cidx].hash === hashSymbol(this.cs[cidx].symbol, this.hashSeed)
      ) {
        this.decodable.push(cidx);
      }
      mapping.nextIndex();
    }
    return mapping;
  }
}

export function createRiblt(options: RibltOptions = {}) {
  return new RibltSession(options);
}

class RibltSession {
  private symbolSize: number;
  private hashSeed: bigint;
  private encoder: Encoder;
  private decoder: Decoder;
  private batchSize: number;
  private started = false;
  private failed = false;
  private received = 0;

  constructor(options: RibltOptions) {
    this.symbolSize = options.symbolSize ?? DEFAULT_SYMBOL_SIZE;
    if (this.symbolSize <= LENGTH_BYTES) {
      throw new Error("symbolSize must be larger than the length prefix");
    }
    this.hashSeed = options.hashSeed ?? 0n;
    this.batchSize = options.batchSize ?? estimateBatchSize(options.expectedDiff, options.errorRate);
    this.encoder = new Encoder(this.symbolSize);
    this.decoder = new Decoder(this.symbolSize, this.hashSeed);
  }

  add(ids: Iterable<string>): void {
    if (this.started) {
      throw new Error("cannot add symbols after encoding or merging has started");
    }
    for (const id of ids) {
      const symbol = encodeStringSymbol(id, this.symbolSize);
      const hash = hashSymbol(symbol, this.hashSeed);
      this.encoder.addHashedSymbol({ symbol, hash });
      this.decoder.addHashedSymbol({ symbol, hash });
    }
  }

  encode(options: { count?: number; format?: "binary" | "object" } = {}): Uint8Array | RibltMessage {
    this.started = true;
    const count = options.count ?? this.batchSize;
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("count must be a positive integer");
    }
    const codedSymbols: CodedSymbol[] = [];
    for (let i = 0; i < count; i += 1) {
      codedSymbols.push(this.encoder.produceNextCodedSymbol());
    }
    if (options.format === "object") {
      return encodeMessageObject(this.symbolSize, this.hashSeed, codedSymbols);
    }
    return encodeMessageBinary(this.symbolSize, this.hashSeed, codedSymbols);
  }

  merge(message: Uint8Array | RibltMessage): void {
    this.started = true;
    if (message instanceof Uint8Array) {
      this.mergeBinary(message);
      return;
    }
    this.mergeObject(message);
  }

  decode(): RibltDecodeResult {
    if (this.failed) {
      return { status: "failed", missing: [], extra: [] };
    }
    if (this.received === 0) {
      return { status: "incomplete", missing: [], extra: [] };
    }
    this.decoder.tryDecode();
    const missing = this.decoder.remote.symbols.map((symbol) => decodeStringSymbol(symbol.symbol));
    const extra = this.decoder.local.symbols.map((symbol) => decodeStringSymbol(symbol.symbol));
    if (this.decoder.decodedAll()) {
      return { status: "complete", missing, extra };
    }
    return { status: "incomplete", missing, extra };
  }

  reset(): void {
    this.encoder.reset();
    this.decoder.reset();
    this.started = false;
    this.failed = false;
    this.received = 0;
  }

  private mergeBinary(message: Uint8Array): void {
    const decoded = decodeMessageBinary(message);
    this.ensureCompatible(decoded.symbolSize, decoded.seed);
    for (const coded of decoded.codedSymbols) {
      this.decoder.addCodedSymbol(coded);
    }
    this.received += decoded.codedSymbols.length;
  }

  private mergeObject(message: RibltMessage): void {
    if (message.v !== VERSION || message.hash !== HASH_ID) {
      throw new Error("unsupported message format");
    }
    const seed = seedFromHex(message.seed);
    this.ensureCompatible(message.symbolSize, seed);
    for (const coded of message.coded) {
      this.decoder.addCodedSymbol({
        symbol: base64ToBytes(coded.symbol, message.symbolSize),
        hash: hashFromHex(coded.hash),
        count: coded.count,
      });
    }
    this.received += message.coded.length;
  }

  private ensureCompatible(symbolSize: number, seed: bigint): void {
    if (symbolSize !== this.symbolSize) {
      this.failed = true;
      throw new Error("symbolSize mismatch between peers");
    }
    if ((seed & MASK_64) !== (this.hashSeed & MASK_64)) {
      this.failed = true;
      throw new Error("hash seed mismatch between peers");
    }
  }
}

function estimateBatchSize(expectedDiff?: number, errorRate?: number): number {
  if (!expectedDiff || expectedDiff <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  const base = Math.ceil(expectedDiff * 1.5);
  if (!errorRate || errorRate <= 0) {
    return Math.max(DEFAULT_BATCH_SIZE, base);
  }
  const safety = Math.ceil(Math.log(1 / errorRate));
  return Math.max(DEFAULT_BATCH_SIZE, base + safety);
}

function encodeStringSymbol(value: string, symbolSize: number): Uint8Array {
  const bytes = textEncoder.encode(value);
  if (bytes.length > symbolSize - LENGTH_BYTES) {
    throw new Error("symbolSize too small for id");
  }
  const buffer = new Uint8Array(symbolSize);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.setUint32(0, bytes.length, true);
  buffer.set(bytes, LENGTH_BYTES);
  return buffer;
}

function decodeStringSymbol(symbol: Uint8Array): string {
  if (symbol.length < LENGTH_BYTES) {
    throw new Error("symbol too small to decode");
  }
  const view = new DataView(symbol.buffer, symbol.byteOffset, symbol.byteLength);
  const length = view.getUint32(0, true);
  if (length > symbol.length - LENGTH_BYTES) {
    throw new Error("invalid symbol length prefix");
  }
  return textDecoder.decode(symbol.slice(LENGTH_BYTES, LENGTH_BYTES + length));
}

function hashSymbol(symbol: Uint8Array, seed: bigint): bigint {
  return XXH3_128(symbol, seed) & MASK_128;
}

function seedFromHash(hash: bigint): bigint {
  return hash & MASK_64;
}

function createEmptyCodedSymbol(symbolSize: number): CodedSymbol {
  return { symbol: new Uint8Array(symbolSize), hash: 0n, count: 0 };
}

function applySymbol(coded: CodedSymbol, symbol: HashedSymbol, direction: number): CodedSymbol {
  xorInto(coded.symbol, symbol.symbol);
  coded.hash ^= symbol.hash;
  coded.count += direction;
  return coded;
}

function xorInto(target: Uint8Array, source: Uint8Array): void {
  for (let i = 0; i < target.length; i += 1) {
    target[i] ^= source[i];
  }
}

function heapFixHead(queue: SymbolMapping[]): void {
  let curr = 0;
  while (true) {
    let child = curr * 2 + 1;
    if (child >= queue.length) {
      break;
    }
    const rightChild = child + 1;
    if (rightChild < queue.length && queue[rightChild].codedIdx < queue[child].codedIdx) {
      child = rightChild;
    }
    if (queue[curr].codedIdx <= queue[child].codedIdx) {
      break;
    }
    [queue[curr], queue[child]] = [queue[child], queue[curr]];
    curr = child;
  }
}

function heapFixTail(queue: SymbolMapping[]): void {
  let curr = queue.length - 1;
  while (curr > 0) {
    const parent = Math.floor((curr - 1) / 2);
    if (queue[parent].codedIdx <= queue[curr].codedIdx) {
      break;
    }
    [queue[parent], queue[curr]] = [queue[curr], queue[parent]];
    curr = parent;
  }
}

function encodeMessageObject(symbolSize: number, seed: bigint, codedSymbols: CodedSymbol[]): RibltMessage {
  return {
    v: VERSION,
    hash: HASH_ID,
    symbolSize,
    seed: seedToHex(seed),
    coded: codedSymbols.map((coded) => ({
      count: coded.count,
      hash: hashToHex(coded.hash),
      symbol: bytesToBase64(coded.symbol),
    })),
  };
}

function encodeMessageBinary(symbolSize: number, seed: bigint, codedSymbols: CodedSymbol[]): Uint8Array {
  const headerSize = 16;
  const codedSize = 4 + 16 + symbolSize;
  const totalSize = headerSize + codedSymbols.length * codedSize;
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.setUint8(0, VERSION);
  view.setUint8(1, 0);
  view.setUint16(2, symbolSize, true);
  view.setUint32(4, codedSymbols.length, true);
  writeUint64LE(view, 8, seed);

  let offset = headerSize;
  for (const coded of codedSymbols) {
    view.setInt32(offset, coded.count, true);
    offset += 4;
    const hashBytes = hashToBytesLE(coded.hash);
    buffer.set(hashBytes, offset);
    offset += 16;
    buffer.set(coded.symbol, offset);
    offset += symbolSize;
  }

  return buffer;
}

function decodeMessageBinary(message: Uint8Array): {
  symbolSize: number;
  seed: bigint;
  codedSymbols: CodedSymbol[];
} {
  const headerSize = 16;
  if (message.length < headerSize) {
    throw new Error("message too short");
  }
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  const version = view.getUint8(0);
  if (version !== VERSION) {
    throw new Error("unsupported message version");
  }
  const symbolSize = view.getUint16(2, true);
  const count = view.getUint32(4, true);
  const seed = readUint64LE(view, 8);
  const codedSize = 4 + 16 + symbolSize;
  const expectedSize = headerSize + count * codedSize;
  if (message.length !== expectedSize) {
    throw new Error("message length mismatch");
  }

  const codedSymbols: CodedSymbol[] = [];
  let offset = headerSize;
  for (let i = 0; i < count; i += 1) {
    const codedCount = view.getInt32(offset, true);
    offset += 4;
    const hashBytes = message.slice(offset, offset + 16);
    offset += 16;
    const symbol = message.slice(offset, offset + symbolSize);
    offset += symbolSize;
    codedSymbols.push({
      symbol,
      hash: hashFromBytesLE(hashBytes),
      count: codedCount,
    });
  }

  return { symbolSize, seed, codedSymbols };
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = (() => {
  const table = new Uint8Array(128);
  table.fill(255);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    output += BASE64_ALPHABET[(triplet >> 18) & 63];
    output += BASE64_ALPHABET[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(triplet >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? BASE64_ALPHABET[triplet & 63] : "=";
  }
  return output;
}

function base64ToBytes(base64: string, symbolSize: number): Uint8Array {
  const normalized = base64.replace(/\s+/g, "");
  if (normalized.length % 4 !== 0) {
    throw new Error("invalid base64 length");
  }
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  const outputLength = (normalized.length / 4) * 3 - padding;
  if (outputLength !== symbolSize) {
    throw new Error("symbol size mismatch");
  }

  const output = new Uint8Array(outputLength);
  let outIndex = 0;
  for (let i = 0; i < normalized.length; i += 4) {
    const c0 = normalized.charCodeAt(i);
    const c1 = normalized.charCodeAt(i + 1);
    const c2 = normalized.charCodeAt(i + 2);
    const c3 = normalized.charCodeAt(i + 3);

    const v0 = BASE64_LOOKUP[c0] ?? 255;
    const v1 = BASE64_LOOKUP[c1] ?? 255;
    const v2 = c2 === 61 ? 0 : BASE64_LOOKUP[c2] ?? 255;
    const v3 = c3 === 61 ? 0 : BASE64_LOOKUP[c3] ?? 255;

    if (v0 === 255 || v1 === 255 || (c2 !== 61 && v2 === 255) || (c3 !== 61 && v3 === 255)) {
      throw new Error("invalid base64 value");
    }

    const triplet = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
    if (outIndex < outputLength) {
      output[outIndex] = (triplet >> 16) & 255;
      outIndex += 1;
    }
    if (outIndex < outputLength) {
      output[outIndex] = (triplet >> 8) & 255;
      outIndex += 1;
    }
    if (outIndex < outputLength) {
      output[outIndex] = triplet & 255;
      outIndex += 1;
    }
  }

  return output;
}

function hashToHex(hash: bigint): string {
  return (hash & MASK_128).toString(16).padStart(32, "0");
}

function hashFromHex(hash: string): bigint {
  const normalized = hash.startsWith("0x") ? hash.slice(2) : hash;
  if (normalized.length > 32) {
    throw new Error("invalid hash length");
  }
  return BigInt("0x" + normalized);
}

function seedToHex(seed: bigint): string {
  return (seed & MASK_64).toString(16).padStart(16, "0");
}

function seedFromHex(seed: string): bigint {
  const normalized = seed.startsWith("0x") ? seed.slice(2) : seed;
  if (normalized.length > 16) {
    throw new Error("invalid seed length");
  }
  return BigInt("0x" + normalized);
}

function hashToBytesLE(hash: bigint): Uint8Array {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  writeUint64LE(view, 0, hash & MASK_64);
  writeUint64LE(view, 8, (hash >> 64n) & MASK_64);
  return bytes;
}

function hashFromBytesLE(bytes: Uint8Array): bigint {
  if (bytes.length !== 16) {
    throw new Error("invalid hash length");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const low = readUint64LE(view, 0);
  const high = readUint64LE(view, 8);
  return (high << 64n) | low;
}

function writeUint64LE(view: DataView, offset: number, value: bigint): void {
  const low = Number(value & 0xffffffffn);
  const high = Number((value >> 32n) & 0xffffffffn);
  view.setUint32(offset, low, true);
  view.setUint32(offset + 4, high, true);
}

function readUint64LE(view: DataView, offset: number): bigint {
  const low = BigInt(view.getUint32(offset, true));
  const high = BigInt(view.getUint32(offset + 4, true));
  return (high << 32n) | low;
}
