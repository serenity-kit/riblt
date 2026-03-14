const n = (value: number | string | bigint) => BigInt(value);

const PRIME32_1 = n("0x9E3779B1");
const PRIME32_2 = n("0x85EBCA77");
const PRIME32_3 = n("0xC2B2AE3D");
const PRIME64_1 = n("0x9E3779B185EBCA87");
const PRIME64_2 = n("0xC2B2AE3D27D4EB4F");
const PRIME64_3 = n("0x165667B19E3779F9");
const PRIME64_4 = n("0x85EBCA77C2B2AE63");
const PRIME64_5 = n("0x27D4EB2F165667C5");
const PRIME_MX1 = n("0x165667919E3779F9");
const PRIME_MX2 = n("0x9FB21C651E98DF25");

const SECRET_HEX =
  "b8fe6c3923a44bbe7c01812cf721ad1cded46de9839097db7240a4a4b7b3671f" +
  "cb79e64eccc0e578825ad07dccff7221b8084674f743248ee03590e6813a264c" +
  "3c2852bb91c300cb88d0658b1b532ea371644897a20df94e3819ef46a9deacd8" +
  "a8fa763fe39c343ff9dcbbc7c70b4f1d8a51e04bcdb45931c89f7ec9d9787364" +
  "eac5ac8334d3ebc3c581a0fffa1363eb170ddd51b7f0da49d316552629d4689e" +
  "2b16be587d47a1fc8ff8b8d17ad031ce45cb3a8f95160428afd7fbcabb4b407e";

const kkey = hexToBytes(SECRET_HEX);

const mask128 = (n(1) << n(128)) - n(1);
const mask64 = (n(1) << n(64)) - n(1);
const mask32 = (n(1) << n(32)) - n(1);
const STRIPE_LEN = 64;
const ACC_NB = STRIPE_LEN / 8;
const _U64 = 8;
const _U32 = 4;
type Accumulator = BigUint64Array<ArrayBufferLike>;

function getView(buf: Uint8Array, offset = 0): Uint8Array {
  return buf.subarray(offset);
}

function readU8(data: Uint8Array, offset: number): number {
  return data[offset] ?? 0;
}

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] ?? 0) |
    ((data[offset + 1] ?? 0) << 8) |
    ((data[offset + 2] ?? 0) << 16) |
    ((data[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function readU64LE(data: Uint8Array, offset = 0): bigint {
  const low = BigInt(readU32LE(data, offset));
  const high = BigInt(readU32LE(data, offset + 4));
  return (high << 32n) | low;
}

function bswap64(a: bigint): bigint {
  return (
    ((a & 0xffn) << 56n) |
    ((a & 0xff00n) << 40n) |
    ((a & 0xff0000n) << 24n) |
    ((a & 0xff000000n) << 8n) |
    ((a >> 8n) & 0xff000000n) |
    ((a >> 24n) & 0xff0000n) |
    ((a >> 40n) & 0xff00n) |
    ((a >> 56n) & 0xffn)
  );
}

function bswap32(a: bigint): bigint {
  a = ((a & n(0x0000ffff)) << n(16)) | ((a & n(0xffff0000)) >> n(16));
  a = ((a & n(0x00ff00ff)) << n(8)) | ((a & n(0xff00ff00)) >> n(8));
  return a;
}

const XXH_mult32to64 = (a: bigint, b: bigint) => ((a & mask32) * (b & mask32)) & mask64;
const assert = (value: boolean) => {
  if (!value) {
    throw new Error("Assert failed");
  }
};

function rotl64(a: bigint, b: bigint) {
  return ((a << b) | (a >> (n(64) - b))) & mask64;
}

function rotl32(a: bigint, b: bigint) {
  return ((a << b) | (a >> (n(32) - b))) & mask32;
}

function XXH3_accumulate_512(acc: Accumulator, data: Uint8Array, key: Uint8Array) {
  for (let i = 0; i < ACC_NB; i += 1) {
    const dataVal = readU64LE(data, i * 8);
    const dataKey = dataVal ^ readU64LE(key, i * 8);
    acc[i ^ 1] += dataVal;
    acc[i] += XXH_mult32to64(dataKey, dataKey >> n(32));
  }
  return acc;
}

function XXH3_accumulate(acc: Accumulator, data: Uint8Array, key: Uint8Array, nbStripes: number) {
  for (let i = 0; i < nbStripes; i += 1) {
    XXH3_accumulate_512(acc, getView(data, i * STRIPE_LEN), getView(key, i * 8));
  }
  return acc;
}

function XXH3_scrambleAcc(acc: Accumulator, key: Uint8Array) {
  for (let i = 0; i < ACC_NB; i += 1) {
    const key64 = readU64LE(key, i * 8);
    let acc64 = acc[i];
    acc64 = xorshift64(acc64, n(47));
    acc64 ^= key64;
    acc64 *= PRIME32_1;
    acc[i] = acc64 & mask64;
  }
  return acc;
}

function XXH3_mix2Accs(acc: Accumulator, offset: number, key: Uint8Array) {
  return XXH3_mul128_fold64(
    acc[offset] ^ readU64LE(key, 0),
    acc[offset + 1] ^ readU64LE(key, _U64)
  );
}

function XXH3_mergeAccs(acc: Accumulator, key: Uint8Array, start: bigint) {
  let result64 = start;

  result64 += XXH3_mix2Accs(acc, 0, getView(key, 0 * _U32));
  result64 += XXH3_mix2Accs(acc, 2, getView(key, 4 * _U32));
  result64 += XXH3_mix2Accs(acc, 4, getView(key, 8 * _U32));
  result64 += XXH3_mix2Accs(acc, 6, getView(key, 12 * _U32));

  return XXH3_avalanche(result64 & mask64);
}

function XXH3_hashLong(
  acc: Accumulator,
  data: Uint8Array,
  secret: Uint8Array,
  fAcc: (acc: Accumulator, data: Uint8Array, key: Uint8Array) => Accumulator,
  fScramble: (acc: Accumulator, key: Uint8Array) => Accumulator
) {
  const nbStripesPerBlock = Math.floor((secret.byteLength - STRIPE_LEN) / 8);
  const blockLen = STRIPE_LEN * nbStripesPerBlock;
  const nbBlocks = Math.floor((data.byteLength - 1) / blockLen);

  for (let i = 0; i < nbBlocks; i += 1) {
    acc = XXH3_accumulate(acc, getView(data, i * blockLen), secret, nbStripesPerBlock);
    acc = fScramble(acc, getView(secret, secret.byteLength - STRIPE_LEN));
  }

  {
    const nbStripes = Math.floor(((data.byteLength - 1) - blockLen * nbBlocks) / STRIPE_LEN);
    acc = XXH3_accumulate(acc, getView(data, nbBlocks * blockLen), secret, nbStripes);
    acc = fAcc(acc, getView(data, data.byteLength - STRIPE_LEN), getView(secret, secret.byteLength - STRIPE_LEN - 7));
  }

  return acc;
}

function XXH3_hashLong_128b(data: Uint8Array, secret: Uint8Array, seed: bigint) {
  let acc: Accumulator = new BigUint64Array([
    PRIME32_3,
    PRIME64_1,
    PRIME64_2,
    PRIME64_3,
    PRIME64_4,
    PRIME32_2,
    PRIME64_5,
    PRIME32_1,
  ]);
  assert(data.length > 128);

  acc = XXH3_hashLong(acc, data, secret, XXH3_accumulate_512, XXH3_scrambleAcc);

  assert(acc.length * 8 === 64);
  {
    const low64 = XXH3_mergeAccs(acc, getView(secret, 11), (n(data.byteLength) * PRIME64_1) & mask64);
    const high64 = XXH3_mergeAccs(
      acc,
      getView(secret, secret.byteLength - STRIPE_LEN - 11),
      ~(n(data.byteLength) * PRIME64_2) & mask64
    );
    return (high64 << n(64)) | low64;
  }
}

function XXH3_mul128(a: bigint, b: bigint) {
  const lll = (a * b) & mask128;
  return (lll + (lll >> n(64))) & mask64;
}

function XXH3_mul128_fold64(a: bigint, b: bigint) {
  const lll = (a * b) & mask128;
  return (lll & mask64) ^ (lll >> n(64));
}

function XXH3_mix16B(data: Uint8Array, key: Uint8Array, seed: bigint) {
  return XXH3_mul128_fold64(
    (readU64LE(data, 0) ^ (readU64LE(key, 0) + seed)) & mask64,
    (readU64LE(data, 8) ^ (readU64LE(key, 8) - seed)) & mask64
  );
}

function XXH3_mix32B(acc: bigint, data1: Uint8Array, data2: Uint8Array, key: Uint8Array, seed: bigint) {
  let accl = acc & mask64;
  let acch = (acc >> n(64)) & mask64;
  accl += XXH3_mix16B(data1, key, seed);
  accl ^= readU64LE(data2, 0) + readU64LE(data2, 8);
  accl &= mask64;
  acch += XXH3_mix16B(data2, getView(key, 16), seed);
  acch ^= readU64LE(data1, 0) + readU64LE(data1, 8);
  acch &= mask64;
  return (acch << n(64)) | accl;
}

function XXH3_avalanche(h64: bigint) {
  h64 ^= h64 >> n(37);
  h64 *= PRIME_MX1;
  h64 &= mask64;
  h64 ^= h64 >> n(32);
  return h64;
}

function XXH3_avalanche64(h64: bigint) {
  h64 ^= h64 >> n(33);
  h64 *= PRIME64_2;
  h64 &= mask64;
  h64 ^= h64 >> n(29);
  h64 *= PRIME64_3;
  h64 &= mask64;
  h64 ^= h64 >> n(32);
  return h64;
}

function XXH3_len_1to3_128b(data: Uint8Array, key32: Uint8Array, seed: bigint) {
  const len = data.byteLength;
  assert(len > 0 && len <= 3);

  const combined =
    n(readU8(data, len - 1)) |
    n(len << 8) |
    n(readU8(data, 0) << 16) |
    n(readU8(data, len >> 1) << 24);
  const blow = (n(readU32LE(key32, 0)) ^ n(readU32LE(key32, 4))) + seed;
  const low = (combined ^ blow) & mask64;
  const bhigh = (n(readU32LE(key32, 8)) ^ n(readU32LE(key32, 12))) - seed;
  const high = (rotl32(bswap32(combined), n(13)) ^ bhigh) & mask64;

  return ((XXH3_avalanche64(high) & mask64) << n(64)) | XXH3_avalanche64(low);
}

function xorshift64(b: bigint, shift: bigint) {
  return b ^ (b >> shift);
}

function XXH3_len_4to8_128b(data: Uint8Array, key32: Uint8Array, seed: bigint) {
  const len = data.byteLength;
  assert(len >= 4 && len <= 8);
  {
    const l1 = readU32LE(data, 0);
    const l2 = readU32LE(data, len - 4);
    const l64 = n(l1) | (n(l2) << n(32));
    const bitflip = (readU64LE(key32, 16) ^ readU64LE(key32, 24)) + seed;
    const keyed = l64 ^ (bitflip & mask64);
    let m128 = (keyed * (PRIME64_1 + (n(len) << n(2)))) & mask128;
    m128 += (m128 & mask64) << n(65);
    m128 &= mask128;
    m128 ^= m128 >> n(67);

    return (
      xorshift64((xorshift64(m128 & mask64, n(35)) * PRIME_MX2) & mask64, n(28)) |
      (XXH3_avalanche(m128 >> n(64)) << n(64))
    );
  }
}

function XXH3_len_9to16_128b(data: Uint8Array, key64: Uint8Array, seed: bigint) {
  const len = data.byteLength;
  assert(len >= 9 && len <= 16);
  {
    const bitflipl = (readU64LE(key64, 32) ^ readU64LE(key64, 40)) + seed;
    const bitfliph = (readU64LE(key64, 48) ^ readU64LE(key64, 56)) - seed;
    const ll1 = readU64LE(data, 0);
    let ll2 = readU64LE(data, len - 8);

    let m128 = (ll1 ^ ll2 ^ (bitflipl & mask64)) * PRIME64_1;

    const m128_l = (m128 & mask64) + (n(len - 1) << n(54));
    m128 = (m128 & (mask128 ^ mask64)) | m128_l;
    ll2 ^= bitfliph & mask64;

    m128 += (ll2 + (ll2 & mask32) * (PRIME32_2 - n(1))) << n(64);
    m128 &= mask128;
    m128 ^= bswap64(m128 >> n(64));
    let h128 = (m128 & mask64) * PRIME64_2;
    h128 += ((m128 >> n(64)) * PRIME64_2) << n(64);
    h128 &= mask128;

    return XXH3_avalanche(h128 & mask64) | (XXH3_avalanche(h128 >> n(64)) << n(64));
  }
}

function XXH3_len_0to16_128b(data: Uint8Array, seed: bigint) {
  const len = data.byteLength;
  assert(len <= 16);
  if (len > 8) {
    return XXH3_len_9to16_128b(data, kkey, seed);
  }
  if (len >= 4) {
    return XXH3_len_4to8_128b(data, kkey, seed);
  }
  if (len > 0) {
    return XXH3_len_1to3_128b(data, kkey, seed);
  }
  return (
    XXH3_avalanche64(seed ^ readU64LE(kkey, 64) ^ readU64LE(kkey, 72)) |
    (XXH3_avalanche64(seed ^ readU64LE(kkey, 80) ^ readU64LE(kkey, 88)) << n(64))
  );
}

function inv64(x: bigint) {
  return (~x + n(1)) & mask64;
}

function XXH3_len_17to128_128b(data: Uint8Array, secret: Uint8Array, seed: bigint) {
  let acc = (n(data.byteLength) * PRIME64_1) & mask64;
  let i = n(data.byteLength - 1) / n(32);
  while (i >= 0) {
    const ni = Number(i);
    acc = XXH3_mix32B(
      acc,
      getView(data, 16 * ni),
      getView(data, data.byteLength - 16 * (ni + 1)),
      getView(secret, 32 * ni),
      seed
    );
    i -= n(1);
  }

  let h128l = (acc + (acc >> n(64))) & mask64;
  h128l = XXH3_avalanche(h128l);
  let h128h = (acc & mask64) * PRIME64_1 + (acc >> n(64)) * PRIME64_4 + ((n(data.byteLength) - seed) & mask64) * PRIME64_2;
  h128h &= mask64;

  h128h = inv64(XXH3_avalanche(h128h));
  return h128l | (h128h << n(64));
}

function XXH3_len_129to240_128b(data: Uint8Array, secret: Uint8Array, seed: bigint) {
  let acc = (n(data.byteLength) * PRIME64_1) & mask64;
  for (let i = 32; i < 160; i += 32) {
    acc = XXH3_mix32B(acc, getView(data, i - 32), getView(data, i - 16), getView(secret, i - 32), seed);
  }
  acc = XXH3_avalanche(acc & mask64) | (XXH3_avalanche(acc >> n(64)) << n(64));
  for (let i = 160; i <= data.byteLength; i += 32) {
    acc = XXH3_mix32B(acc, getView(data, i - 32), getView(data, i - 16), getView(secret, 3 + i - 160), seed);
  }
  acc = XXH3_mix32B(
    acc,
    getView(data, data.byteLength - 16),
    getView(data, data.byteLength - 32),
    getView(secret, 136 - 17 - 16),
    inv64(seed)
  );

  let h128l = (acc + (acc >> n(64))) & mask64;
  h128l = XXH3_avalanche(h128l);
  let h128h = (acc & mask64) * PRIME64_1 + (acc >> n(64)) * PRIME64_4 + ((n(data.byteLength) - seed) & mask64) * PRIME64_2;
  h128h &= mask64;

  h128h = inv64(XXH3_avalanche(h128h));
  return h128l | (h128h << n(64));
}

export function XXH3_128(data: Uint8Array, seed: bigint = n(0)) {
  const len = data.byteLength;
  if (len <= 16) {
    return XXH3_len_0to16_128b(data, seed);
  }
  if (len <= 128) {
    return XXH3_len_17to128_128b(data, kkey, seed);
  }
  if (len <= 240) {
    return XXH3_len_129to240_128b(data, kkey, seed);
  }

  return XXH3_hashLong_128b(data, kkey, seed);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("invalid hex length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("invalid hex value");
    }
    out[i] = byte;
  }
  return out;
}
