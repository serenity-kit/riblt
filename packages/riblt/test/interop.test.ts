import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { createRiblt } from "../src/index";

interface InteropFixture {
  format: string;
  reference: string;
  source: string;
  cases: Array<
    | {
        name: "object-and-binary-frame";
        options: { symbolSize: number; batchSize: number; hashSeed: string };
        ids: string[];
        count: number;
        binaryHex: string;
        objectFrame: unknown;
      }
    | {
        name: "streamed-reconciliation";
        options: { symbolSize: number; batchSize: number; hashSeed: string };
        aliceIds: string[];
        bobIds: string[];
        count: number;
        framesHex: string[];
        rounds: number;
        result: {
          status: string;
          missing: string[];
          extra: string[];
        };
      }
  >;
}

function loadFixture(): InteropFixture {
  const dir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(dir, "fixtures", "interop-v1.json"), "utf8");
  return JSON.parse(raw) as InteropFixture;
}

function toOptions(options: { symbolSize: number; batchSize: number; hashSeed: string }) {
  return {
    symbolSize: options.symbolSize,
    batchSize: options.batchSize,
    hashSeed: BigInt(`0x${options.hashSeed}`),
  };
}

describe("riblt interoperability fixtures", () => {
  const fixture = loadFixture();
  const frameCase = fixture.cases.find((entry) => entry.name === "object-and-binary-frame");
  const reconcileCase = fixture.cases.find((entry) => entry.name === "streamed-reconciliation");

  if (!frameCase || !reconcileCase) {
    throw new Error("interop fixtures are incomplete");
  }

  it("matches the golden binary and object frame vectors", () => {
    const riblt = createRiblt(toOptions(frameCase.options));
    riblt.add(frameCase.ids);

    const binary = riblt.encode({ count: frameCase.count }) as Uint8Array;
    expect(Buffer.from(binary).toString("hex")).toBe(frameCase.binaryHex);

    riblt.reset();
    riblt.add(frameCase.ids);
    const objectFrame = riblt.encode({ count: frameCase.count, format: "object" });
    expect(objectFrame).toEqual(frameCase.objectFrame);
  });

  it("matches the streamed reconciliation fixture", () => {
    const alice = createRiblt(toOptions(reconcileCase.options));
    const bob = createRiblt(toOptions(reconcileCase.options));
    alice.add(reconcileCase.aliceIds);
    bob.add(reconcileCase.bobIds);

    let rounds = 0;
    let result = bob.decode();
    const frames: string[] = [];
    while (result.status !== "complete" && rounds < reconcileCase.rounds + 2) {
      const frame = alice.encode({ count: reconcileCase.count }) as Uint8Array;
      frames.push(Buffer.from(frame).toString("hex"));
      bob.merge(frame);
      result = bob.decode();
      rounds += 1;
    }

    expect(frames).toEqual(reconcileCase.framesHex);
    expect(rounds).toBe(reconcileCase.rounds);
    expect(result).toEqual(reconcileCase.result);
  });
});
