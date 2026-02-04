import { createRequire } from "node:module";
import { Buffer } from "node:buffer";

const require = createRequire(import.meta.url);
const { XXH3_128: XXH3_128Impl } = require("xxh3-ts") as {
  XXH3_128: (data: Buffer, seed?: bigint) => bigint;
};

export const XXH3_128 = XXH3_128Impl;
