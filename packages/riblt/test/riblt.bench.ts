import { afterAll, bench, describe } from "vitest";
import { createRiblt } from "../src/index";

const cases = [
  { name: "d=10", diff: 10 },
  { name: "d=20", diff: 20 },
  { name: "d=40", diff: 40 },
  { name: "d=100", diff: 100 },
  { name: "d=1000", diff: 1000 },
];

const ratios = new Map<string, number>();

function buildIds(prefix: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(`${prefix}-${i}`);
  }
  return ids;
}

function runOnce(diff: number) {
  const nLocal = Math.floor(diff / 2);
  const nRemote = diff - nLocal;
  const nCommon = diff;

  const alice = createRiblt({ symbolSize: 64, hashSeed: 0n, batchSize: 1 });
  const bob = createRiblt({ symbolSize: 64, hashSeed: 0n, batchSize: 1 });

  const local = buildIds("local", nLocal);
  const remote = buildIds("remote", nRemote);
  const common = buildIds("common", nCommon);

  alice.add([...remote, ...common]);
  bob.add([...local, ...common]);

  let coded = 0;
  let result = bob.decode();
  const maxSymbols = diff * 10;
  while (result.status !== "complete") {
    bob.merge(alice.encode({ count: 1 }));
    coded += 1;
    result = bob.decode();
    if (coded > maxSymbols) {
      throw new Error(`decode did not converge after ${coded} symbols`);
    }
  }

  return coded / diff;
}

describe("riblt overhead", () => {
  for (const tc of cases) {
    bench(tc.name, () => {
      const ratio = runOnce(tc.diff);
      ratios.set(tc.name, ratio);
    }, { iterations: tc.diff >= 1000 ? 5 : 10 });
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
