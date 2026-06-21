import { modelRegistrySearch } from "@qvac/sdk";
console.error("starting search...");
const results = await modelRegistrySearch({ filter: "medpsy" });
console.log(JSON.stringify(results, null, 2));
