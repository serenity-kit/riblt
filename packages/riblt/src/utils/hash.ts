import { MASK_128, MASK_64 } from "../constants.js";
import { XXH3_128 } from "./xxh3.js";

export function hashSymbol(symbol: Uint8Array, seed: bigint): bigint {
  return XXH3_128(symbol, seed) & MASK_128;
}

export function seedFromHash(hash: bigint): bigint {
  return hash & MASK_64;
}

export function hashToHex(hash: bigint): string {
  return (hash & MASK_128).toString(16).padStart(32, "0");
}

export function hashFromHex(hash: string): bigint {
  const normalized = hash.startsWith("0x") ? hash.slice(2) : hash;
  if (normalized.length > 32) {
    throw new Error("invalid hash length");
  }
  return BigInt("0x" + normalized);
}

export function seedToHex(seed: bigint): string {
  return (seed & MASK_64).toString(16).padStart(16, "0");
}

export function seedFromHex(seed: string): bigint {
  const normalized = seed.startsWith("0x") ? seed.slice(2) : seed;
  if (normalized.length > 16) {
    throw new Error("invalid seed length");
  }
  return BigInt("0x" + normalized);
}

export function hashToBytesLE(hash: bigint): Uint8Array {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  writeUint64LE(view, 0, hash & MASK_64);
  writeUint64LE(view, 8, (hash >> 64n) & MASK_64);
  return bytes;
}

export function hashFromBytesLE(bytes: Uint8Array): bigint {
  if (bytes.length !== 16) {
    throw new Error("invalid hash length");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const low = readUint64LE(view, 0);
  const high = readUint64LE(view, 8);
  return (high << 64n) | low;
}

export function writeUint64LE(view: DataView, offset: number, value: bigint): void {
  const low = Number(value & 0xffffffffn);
  const high = Number((value >> 32n) & 0xffffffffn);
  view.setUint32(offset, low, true);
  view.setUint32(offset + 4, high, true);
}

export function readUint64LE(view: DataView, offset: number): bigint {
  const low = BigInt(view.getUint32(offset, true));
  const high = BigInt(view.getUint32(offset + 4, true));
  return (high << 32n) | low;
}
