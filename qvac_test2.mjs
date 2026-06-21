import { modelRegistrySearch, modelRegistryList } from "@qvac/sdk";
for (const f of ["med", "Med", "1.7B", "psy", "tether"]) {
  const r = await modelRegistrySearch({ filter: f });
  console.log(`filter="${f}" -> ${r.length} results`, r.map(m => m.name ?? m.id ?? JSON.stringify(m).slice(0,80)));
}
const all = await modelRegistryList();
console.log("TOTAL registry entries:", all.length);
console.log("sample entry:", JSON.stringify(all[0], null, 2));
