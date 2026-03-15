const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = (() => {
  const table = new Uint8Array(128);
  table.fill(255);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export function bytesToBase64(bytes: Uint8Array): string {
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

export function base64ToBytes(base64: string, expectedLength: number): Uint8Array {
  const normalized = base64.replace(/\s+/g, "");
  if (normalized.length % 4 !== 0) {
    throw new Error("invalid base64 length");
  }
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  const outputLength = (normalized.length / 4) * 3 - padding;
  if (outputLength !== expectedLength) {
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
