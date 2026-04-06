import { afterAll, bench, describe } from "vitest";
import { createRiblt } from "../src/index";

const cases = [
  { name: "d=10,b=1", diff: 10, batchSize: 1 },
  { name: "d=10,b=2", diff: 10, batchSize: 2 },
  { name: "d=10,b=4", diff: 10, batchSize: 4 },
  { name: "d=40,b=1", diff: 40, batchSize: 1 },
  { name: "d=40,b=2", diff: 40, batchSize: 2 },
  { name: "d=40,b=4", diff: 40, batchSize: 4 },
  { name: "d=100,b=1", diff: 100, batchSize: 1 },
  { name: "d=100,b=2", diff: 100, batchSize: 2 },
  { name: "d=100,b=4", diff: 100, batchSize: 4 },
  { name: "d=1000,b=1", diff: 1000, batchSize: 1 },
  { name: "d=1000,b=2", diff: 1000, batchSize: 2 },
  { name: "d=1000,b=4", diff: 1000, batchSize: 4 },
];

const ratios = new Map<string, number>();

function buildIds(prefix: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(`${prefix}-${i}`);
  }
  return ids;
}

function runOnce(diff: number, batchSize: number) {
  const nLocal = Math.floor(diff / 2);
  const nRemote = diff - nLocal;
  const nCommon = diff;

  const alice = createRiblt({ symbolSize: 64, hashSeed: 0n, batchSize });
  const bob = createRiblt({ symbolSize: 64, hashSeed: 0n, batchSize });

  const local = buildIds("local", nLocal);
  const remote = buildIds("remote", nRemote);
  const common = buildIds("common", nCommon);

  alice.add([...remote, ...common]);
  bob.add([...local, ...common]);

  let coded = 0;
  let result = bob.decode();
  const maxSymbols = diff * 12;
  while (result.status !== "complete") {
    bob.merge(alice.encode({ count: batchSize }));
    coded += batchSize;
    result = bob.decode();
    if (coded > maxSymbols) {
      throw new Error(`decode did not converge after ${coded} symbols`);
    }
  }

  return coded / diff;
}

describe("riblt overhead", () => {
  for (const tc of cases) {
    bench(
      tc.name,
      () => {
        const ratio = runOnce(tc.diff, tc.batchSize);
        ratios.set(tc.name, ratio);
      },
      { iterations: tc.diff >= 1000 ? 5 : 10 }
    );
  }
});

afterAll(() => {
  // The paper reports ~1.35x overhead as diff grows; this is a sanity check report.
  const lines = Array.from(ratios.entries()).map(
    ([name, ratio]) => `${name} symbols/diff: ${ratio.toFixed(3)}`
  );
  if (lines.length > 0) {
    // eslint-disable-next-line no-console
    console.log("RIBLT overhead results (target ~1.35 for large diff):");
    for (const line of lines) {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  }
});
