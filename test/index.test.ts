import { describe, expect, it } from "vitest";
import { createRiblt } from "../src/index";
import { Buffer } from "node:buffer";

const aliceOnly = ["alice-only-1", "alice-only-2"];
const bobOnly = ["bob-only-1", "bob-only-2", "bob-only-3"];
const common = ["id-1", "id-2", "id-3", "id-4", "id-5", "id-6"];

function sorted(values: string[]) {
  return [...values].sort();
}

function reconcile(
  aliceIds: string[],
  bobIds: string[],
  options: { symbolSize?: number; hashSeed?: bigint; batchSize?: number; expectedDiff?: number; errorRate?: number } = {},
  format: "binary" | "object" = "binary",
  count = 2,
  maxRounds = 500
) {
  const alice = createRiblt(options);
  const bob = createRiblt(options);
  alice.add(aliceIds);
  bob.add(bobIds);

  let result = bob.decode();
  let rounds = 0;
  while (result.status !== "complete" && rounds < maxRounds) {
    const msg = alice.encode({ count, format: format === "object" ? "object" : undefined });
    bob.merge(msg);
    result = bob.decode();
    rounds += 1;
  }

  return { result, rounds };
}

function parseBinaryHeader(message: Uint8Array) {
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  return {
    version: view.getUint8(0),
    symbolSize: view.getUint16(2, true),
    count: view.getUint32(4, true),
  };
}

function toHex(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("hex");
}

function generateIds(prefix: string, start: number, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(`${prefix}-${start + i}`);
  }
  return ids;
}

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("riblt reconciliation", () => {
  it("reconciles via binary messages", () => {
    const { result } = reconcile(
      [...common, ...aliceOnly],
      [...common, ...bobOnly],
      { symbolSize: 64, batchSize: 3, hashSeed: 0n },
      "binary",
      2
    );

    expect(result.status).toBe("complete");
    expect(sorted(result.missing)).toEqual(sorted(aliceOnly));
    expect(sorted(result.extra)).toEqual(sorted(bobOnly));
  });

  it("reconciles via object messages", () => {
    const { result } = reconcile(
      [...common, ...aliceOnly],
      [...common, ...bobOnly],
      { symbolSize: 64, batchSize: 2, hashSeed: 42n },
      "object",
      3
    );

    expect(result.status).toBe("complete");
    expect(sorted(result.missing)).toEqual(sorted(aliceOnly));
    expect(sorted(result.extra)).toEqual(sorted(bobOnly));
  });

  it("returns incomplete before any messages are received", () => {
    const bob = createRiblt({ symbolSize: 64, hashSeed: 0n });
    bob.add(["id-1", "id-2"]);

    const result = bob.decode();
    expect(result.status).toBe("incomplete");
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it("reconciles identical sets", () => {
    const ids = [...common, "id-7", "id-8"];
    const { result } = reconcile(ids, ids, { symbolSize: 64, batchSize: 1, hashSeed: 0n }, "binary", 1, 10);

    expect(result.status).toBe("complete");
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it("handles multiple randomized scenarios", () => {
    const rand = lcg(123456);
    const cases = [
      { common: 20, aliceOnly: 5, bobOnly: 4 },
      { common: 50, aliceOnly: 10, bobOnly: 10 },
      { common: 5, aliceOnly: 1, bobOnly: 2 },
    ];

    for (const tc of cases) {
      const commonIds = generateIds("c", Math.floor(rand() * 1000), tc.common);
      const aliceIds = [...commonIds, ...generateIds("a", Math.floor(rand() * 1000), tc.aliceOnly)];
      const bobIds = [...commonIds, ...generateIds("b", Math.floor(rand() * 1000), tc.bobOnly)];

      const { result } = reconcile(aliceIds, bobIds, { symbolSize: 64, batchSize: 5, hashSeed: 7n }, "binary", 4);
      expect(result.status).toBe("complete");
      expect(sorted(result.missing)).toEqual(sorted(aliceIds.filter((id) => id.startsWith("a-"))));
      expect(sorted(result.extra)).toEqual(sorted(bobIds.filter((id) => id.startsWith("b-"))));
    }
  });
});

describe("riblt api behavior", () => {
  it("uses expectedDiff/errorRate to size default batch", () => {
    const riblt = createRiblt({ expectedDiff: 10, errorRate: 1e-6, symbolSize: 64, hashSeed: 0n });
    riblt.add(["id-1"]);
    const msg = riblt.encode();
    const header = parseBinaryHeader(msg as Uint8Array);
    expect(header.count).toBe(29);
  });

  it("is deterministic for the same inputs", () => {
    const ids = [...common, ...aliceOnly];
    const options = { symbolSize: 64, hashSeed: 123n };

    const a1 = createRiblt(options);
    const a2 = createRiblt(options);
    a1.add(ids);
    a2.add(ids);

    const msg1 = a1.encode({ count: 5 });
    const msg2 = a2.encode({ count: 5 });

    expect(toHex(msg1 as Uint8Array)).toBe(toHex(msg2 as Uint8Array));
  });

  it("throws when adding after encoding started", () => {
    const riblt = createRiblt({ symbolSize: 64, hashSeed: 0n });
    riblt.add(["id-1"]);
    riblt.encode({ count: 1 });
    expect(() => riblt.add(["id-2"])).toThrow(/cannot add/);
  });

  it("throws when adding after merge started", () => {
    const alice = createRiblt({ symbolSize: 64, hashSeed: 0n });
    const bob = createRiblt({ symbolSize: 64, hashSeed: 0n });
    alice.add(["id-1"]);
    bob.add(["id-2"]);

    const msg = alice.encode({ count: 1 });
    bob.merge(msg);

    expect(() => bob.add(["id-3"])).toThrow(/cannot add/);
  });

  it("throws on invalid symbol size", () => {
    const riblt = createRiblt({ symbolSize: 6, hashSeed: 0n });
    expect(() => riblt.add(["toolong-id"])).toThrow(/symbolSize too small/);
  });

  it("throws on invalid encode count", () => {
    const riblt = createRiblt({ symbolSize: 64, hashSeed: 0n });
    riblt.add(["id-1"]);
    expect(() => riblt.encode({ count: 0 })).toThrow(/count must be a positive integer/);
  });

  it("rejects incompatible symbol size", () => {
    const alice = createRiblt({ symbolSize: 64, hashSeed: 0n });
    const bob = createRiblt({ symbolSize: 32, hashSeed: 0n });
    alice.add(["id-1"]);
    bob.add(["id-2"]);

    const msg = alice.encode({ count: 1 });
    expect(() => bob.merge(msg)).toThrow(/symbolSize mismatch/);
    const result = bob.decode();
    expect(result.status).toBe("failed");
  });

  it("rejects incompatible hash seed", () => {
    const alice = createRiblt({ symbolSize: 64, hashSeed: 0n });
    const bob = createRiblt({ symbolSize: 64, hashSeed: 1n });
    alice.add(["id-1"]);
    bob.add(["id-2"]);

    const msg = alice.encode({ count: 1 });
    expect(() => bob.merge(msg)).toThrow(/hash seed mismatch/);
    const result = bob.decode();
    expect(result.status).toBe("failed");
  });

  it("rejects invalid binary messages", () => {
    const alice = createRiblt({ symbolSize: 64, hashSeed: 0n });
    const bob = createRiblt({ symbolSize: 64, hashSeed: 0n });
    alice.add(["id-1"]);
    bob.add(["id-2"]);

    const msg = alice.encode({ count: 1 }) as Uint8Array;
    const bad = msg.slice();
    bad[0] = 255;

    expect(() => bob.merge(bad)).toThrow(/unsupported message version/);
  });

  it("can reset and reuse", () => {
    const alice = createRiblt({ symbolSize: 64, hashSeed: 0n });
    const bob = createRiblt({ symbolSize: 64, hashSeed: 0n });
    alice.add(["id-1"]);
    bob.add(["id-2"]);

    let result = bob.decode();
    expect(result.status).toBe("incomplete");

    for (let i = 0; i < 50; i += 1) {
      bob.merge(alice.encode({ count: 2 }));
      result = bob.decode();
      if (result.status === "complete") {
        break;
      }
    }
    expect(result.status).toBe("complete");

    alice.reset();
    bob.reset();
    alice.add(["id-3"]);
    bob.add(["id-3", "id-4"]);

    for (let i = 0; i < 50; i += 1) {
      bob.merge(alice.encode({ count: 2 }));
      result = bob.decode();
      if (result.status === "complete") {
        break;
      }
    }
    expect(result.status).toBe("complete");
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual(["id-4"]);
  });
});
