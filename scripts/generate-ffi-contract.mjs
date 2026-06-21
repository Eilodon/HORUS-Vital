#!/usr/bin/env node
// Generates TypeScript + Kotlin contract types from
// modules/horus-sdk/ffi-contract.json — the synced copy of HORUS core's
// bindings/ffi-contract.json (see scripts/sync-horus-sdk.sh).
//
// Usage: node scripts/generate-ffi-contract.mjs   (or: npm run generate:ffi-contract)
//
// scripts/check-generated.sh re-runs this and diffs the output against what's
// committed — so editing the generated files by hand, or bumping the JSON
// without regenerating, fails CI.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const CONTRACT_PATH = join(REPO_ROOT, 'modules/horus-sdk/ffi-contract.json');
const TS_OUT = join(REPO_ROOT, 'modules/horus-sdk/src/HorusSdk.contract.generated.ts');
const KT_OUT = join(
  REPO_ROOT,
  'modules/horus-sdk/android/src/main/java/com/horus/HorusFfiContract.kt',
);

const HEADER_LINES = [
  'GENERATED FILE — do not edit by hand.',
  'Source: modules/horus-sdk/ffi-contract.json (synced from HORUS core via scripts/sync-horus-sdk.sh)',
  'Regenerate: npm run generate:ffi-contract',
  'scripts/check-generated.sh fails CI if this drifts from the source JSON.',
];

const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));

function generateTs() {
  const header = HEADER_LINES.map((l) => `// ${l}`).join('\n');
  const pixelFormatEntries = Object.entries(contract.pixelFormats)
    .map(([name, code]) => `  ${name}: ${code},`)
    .join('\n');
  const metricPackFields = contract.metricPack
    .map((f) => {
      const naNote = f.naWhen ? ` NaN when: ${f.naWhen}.` : '';
      return `  /** ${f.unit}.${naNote} */\n  ${f.name}: number,`;
    })
    .join('\n');

  return `${header}

/**
 * FFI contract version baked into the synced \`libhorus.so\`. Checked against
 * \`Horus.ffiContractVersion()\` at runtime — see HorusSdkModule.kt.
 */
export const FFI_CONTRACT_VERSION = ${contract.version};

/** Mirrors \`PixelFormat\` in HORUS core. */
export const PixelFormat = {
${pixelFormatEntries}
} as const;

export type PixelFormat = (typeof PixelFormat)[keyof typeof PixelFormat];

/**
 * \`float[13]\` metric pack — mirrors \`pipeline_result_to_jarray\` in
 * \`src/ffi/android.rs\` (HORUS core). Unavailable metrics are \`NaN\` (see
 * per-field comments) — handle \`NaN\` explicitly, don't assume array-index
 * lookups on it will throw.
 */
export type PipelineMetricPack = [
${metricPackFields}
];
`;
}

function generateKt() {
  const header = HEADER_LINES.map((l) => `// ${l}`).join('\n');
  const pixelFormatConsts = Object.entries(contract.pixelFormats)
    .map(([name, code]) => `        const val ${name} = ${code}`)
    .join('\n');

  return `package com.horus

${header}

/** Versioned FFI contract synced from HORUS core. See [Horus] and [HorusSdkModule]. */
object HorusFfiContract {
    /** Expected \`libhorus.so\` contract version — checked via [Horus.ffiContractVersion]. */
    const val EXPECTED_FFI_CONTRACT_VERSION = ${contract.version}

    /** Mirrors \`PixelFormat\` in HORUS core (bindings/ffi-contract.json). */
    object PixelFormat {
${pixelFormatConsts}
    }
}
`;
}

writeFileSync(TS_OUT, generateTs());
writeFileSync(KT_OUT, generateKt());

console.log(`Generated:\n  ${TS_OUT}\n  ${KT_OUT}`);
