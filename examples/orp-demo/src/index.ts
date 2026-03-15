import { DEFAULT_INITIATOR_SEED, DEFAULT_RESPONDER_SEED, runDemoScenario } from "./demo.js";

function main(): void {
  const result = runDemoScenario(DEFAULT_INITIATOR_SEED, DEFAULT_RESPONDER_SEED);

  console.log("Documents were reconciled through chunk-aware ORP.\n");
  console.log("Final initiator state:");
  console.log(JSON.stringify(result.initiator, null, 2));
  console.log("\nFinal responder state:");
  console.log(JSON.stringify(result.responder, null, 2));
  console.log("\nTranscript:");
  console.log(JSON.stringify(result.transcript, null, 2));
}

main();
