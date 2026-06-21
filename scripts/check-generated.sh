#!/usr/bin/env bash
# Regenerates the contract-derived TS/Kotlin files from
# modules/horus-sdk/ffi-contract.json and fails if the committed output
# doesn't match — i.e. someone hand-edited a generated file, or bumped the
# contract JSON without regenerating.
#
# Usage: scripts/check-generated.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

GENERATED_FILES=(
  "modules/horus-sdk/src/HorusSdk.contract.generated.ts"
  "modules/horus-sdk/android/src/main/java/com/horus/HorusFfiContract.kt"
)

node scripts/generate-ffi-contract.mjs

if ! git diff --quiet -- "${GENERATED_FILES[@]}"; then
  echo "ERROR: generated FFI contract files are out of date with modules/horus-sdk/ffi-contract.json:" >&2
  git diff -- "${GENERATED_FILES[@]}" >&2
  echo "" >&2
  echo "Run 'npm run generate:ffi-contract' and commit the result." >&2
  exit 1
fi

echo "OK: generated FFI contract files match modules/horus-sdk/ffi-contract.json"
