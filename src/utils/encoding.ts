import { LENGTH_BYTES } from "../constants.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeStringSymbol(value: string, symbolSize: number): Uint8Array {
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

export function decodeStringSymbol(symbol: Uint8Array): string {
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
