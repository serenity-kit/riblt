import { afterAll, bench, describe } from "vitest";
import { runDemoScenario, type DemoSeed } from "../src/demo";

const transcriptLengths = new Map<string, number>();

const cases: Array<{ name: string; initiator: DemoSeed; responder: DemoSeed }> = [
  {
    name: "ops-repair",
    initiator: [{ docHandle: "doc-small", values: ["alpha", "beta"] }],
    responder: [{ docHandle: "doc-small", values: ["alpha"] }],
  },
  {
    name: "chunk-repair",
    initiator: [{ docHandle: "doc-bulk", values: ["a-1", "a-2", "a-3", "a-4", "a-5", "a-6"] }],
    responder: [{ docHandle: "doc-bulk", values: ["a-1"] }],
  },
  {
    name: "snapshot-repair",
    initiator: [{ docHandle: "doc-snapshot", values: ["v-1"] }],
    responder: [{ docHandle: "doc-snapshot", values: ["v-1", "v-2", "v-3", "v-4", "v-5", "v-6", "v-7"] }],
  },
];

describe("orp demo scenarios", () => {
  for (const tc of cases) {
    bench(tc.name, () => {
      const result = runDemoScenario(tc.initiator, tc.responder);
      transcriptLengths.set(tc.name, result.transcript.length);
    });
  }
});

afterAll(() => {
  if (transcriptLengths.size === 0) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log("ORP scenario transcript lengths:");
  for (const [name, length] of transcriptLengths) {
    // eslint-disable-next-line no-console
    console.log(`${name}: ${length}`);
  }
});
