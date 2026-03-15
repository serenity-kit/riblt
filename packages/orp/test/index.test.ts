import { describe, expect, it } from "vitest";
import {
  ORP_EXAMPLE_TRANSCRIPTS,
  OrpValidationError,
  assertValidOrpMessage,
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
});
