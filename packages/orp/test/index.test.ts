import { describe, expect, it } from "vitest";
import {
  ORP_PROTOCOL_VERSION,
  ORP_EXAMPLE_TRANSCRIPTS,
  OrpValidationError,
  assertValidChunkSummary,
  assertValidOrpMessage,
  createOrpRibltSession,
  exchangeOrpRibltFrames,
  validateChunkSummary,
  validateDocSummary,
  validateOrpMessage,
  validateOrpTranscript,
} from "../src/index";

describe("orp validators", () => {
  it("accepts the bundled example transcripts", () => {
    for (const transcript of ORP_EXAMPLE_TRANSCRIPTS) {
      expect(validateOrpTranscript(transcript)).toEqual([]);
    }
  });

  it("rejects invalid hello messages", () => {
    const issues = validateOrpMessage({
      type: "orp/hello",
      version: 99,
      sessionId: "",
      scopeId: "",
      inventoryParams: {
        symbolSize: 0,
        batchSize: 0,
        hashSeed: "XYZ",
      },
      operationParams: {
        symbolSize: 64,
        batchSize: 4,
        hashSeed: "0000000000000007",
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.version" }),
        expect.objectContaining({ path: "$.sessionId" }),
        expect.objectContaining({ path: "$.scopeId" }),
        expect.objectContaining({ path: "$.inventoryParams.symbolSize" }),
        expect.objectContaining({ path: "$.inventoryParams.hashSeed" }),
      ])
    );
  });

  it("rejects invalid document summaries", () => {
    const issues = validateDocSummary({
      docHandle: "",
      tailCount: -1,
      xorA: "",
      xorB: "x",
      sumA: "y",
      sumB: "z",
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.docHandle" }),
        expect.objectContaining({ path: "$.tailCount" }),
        expect.objectContaining({ path: "$.xorA" }),
      ])
    );
  });

  it("accepts valid chunk summaries and rejects invalid ones", () => {
    expect(() =>
      assertValidChunkSummary({
        chunkId: "bucket-0",
        opCount: 3,
        xorA: "a",
        xorB: "b",
        sumA: "c",
        sumB: "d",
      })
    ).not.toThrow();

    const issues = validateChunkSummary({
      chunkId: "",
      opCount: -1,
      xorA: "",
      xorB: "b",
      sumA: "c",
      sumB: "d",
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.chunkId" }),
        expect.objectContaining({ path: "$.opCount" }),
        expect.objectContaining({ path: "$.xorA" }),
      ])
    );
  });

  it("throws a structured validation error when assertions fail", () => {
    expect(() =>
      assertValidOrpMessage({
        type: "orp/blob-get",
        version: 1,
        sessionId: "session-1",
        docHandle: "doc-1",
        opIds: [""],
      })
    ).toThrow(OrpValidationError);
  });

  it("rejects malformed chunking metadata on doc status messages", () => {
    const issues = validateOrpMessage({
      type: "orp/doc-status",
      version: 1,
      sessionId: "session-1",
      docHandle: "doc-1",
      summary: {
        docHandle: "doc-1",
        tailCount: 1,
        xorA: "a",
        xorB: "b",
        sumA: "c",
        sumB: "d",
      },
      recentSnapshots: [],
      chunking: {
        algorithm: "bad-algorithm",
        bucketCount: 0,
        summaries: [
          {
            chunkId: "",
            opCount: -1,
            xorA: "",
            xorB: "b",
            sumA: "c",
            sumB: "d",
          },
        ],
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.chunking.algorithm" }),
        expect.objectContaining({ path: "$.chunking.bucketCount" }),
        expect.objectContaining({ path: "$.chunking.summaries[0].chunkId" }),
        expect.objectContaining({ path: "$.chunking.summaries[0].opCount" }),
      ])
    );
  });
});

describe("orp riblt helpers", () => {
  const params = {
    symbolSize: 64,
    batchSize: 2,
    hashSeed: "0000000000000007",
  } as const;

  it("wraps riblt with object-frame sessions", () => {
    const alice = createOrpRibltSession(params);
    const bob = createOrpRibltSession(params);
    alice.add(["id-1", "id-2", "alice-only"]);
    bob.add(["id-1", "id-2", "bob-only"]);

    let result = bob.decode();
    let rounds = 0;
    while (result.status !== "complete" && rounds < 32) {
      const frame = alice.createFrame();
      bob.mergeFrame(frame);
      result = bob.decode();
      rounds += 1;
    }

    expect(result.status).toBe("complete");
    expect(result.missing).toEqual(["alice-only"]);
    expect(result.extra).toEqual(["bob-only"]);
  });

  it("exchanges ORP frame messages symmetrically", () => {
    const sentTypes: string[] = [];

    const { leftResult, rightResult, rounds } = exchangeOrpRibltFrames({
      leftIds: ["id-1", "id-2", "left-only"],
      rightIds: ["id-1", "id-2", "right-only"],
      params,
      makeLeftFrame: (frame) => ({
        type: "orp/doc-frame",
        version: ORP_PROTOCOL_VERSION,
        sessionId: "session-1",
        docHandle: "doc-1",
        frame,
      }),
      makeRightFrame: (frame) => ({
        type: "orp/doc-frame",
        version: ORP_PROTOCOL_VERSION,
        sessionId: "session-1",
        docHandle: "doc-1",
        frame,
      }),
      onLeftFrame: (message) => {
        sentTypes.push(message.type);
      },
      onRightFrame: (message) => {
        sentTypes.push(message.type);
      },
    });

    expect(rounds).toBeGreaterThan(0);
    expect(leftResult.status).toBe("complete");
    expect(rightResult.status).toBe("complete");
    expect(leftResult.missing).toEqual(["right-only"]);
    expect(leftResult.extra).toEqual(["left-only"]);
    expect(rightResult.missing).toEqual(["left-only"]);
    expect(rightResult.extra).toEqual(["right-only"]);
    expect(sentTypes.every((type) => type === "orp/doc-frame")).toBe(true);
  });
});
