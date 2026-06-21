#!/usr/bin/env bash
# Verifies the bundled libhorus.so exports exactly the JNI symbols this app
# depends on (modules/horus-sdk/ffi-contract.json's "jniSymbols" list).
#
# Catches symbol mismatches (renamed/removed Rust export, or a Kotlin
# `external fun` added without a matching Rust export) at build/CI time
# instead of as a runtime UnsatisfiedLinkError on a user's device.
#
# Usage: scripts/check-jni-symbols.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SO_PATH="${REPO_ROOT}/modules/horus-sdk/android/src/main/jniLibs/arm64-v8a/libhorus.so"
CONTRACT_PATH="${REPO_ROOT}/modules/horus-sdk/ffi-contract.json"

command -v nm >/dev/null 2>&1 || { echo "ERROR: 'nm' not found (install binutils)." >&2; exit 1; }
[[ -f "${SO_PATH}" ]] || { echo "ERROR: ${SO_PATH} not found." >&2; exit 1; }
[[ -f "${CONTRACT_PATH}" ]] || { echo "ERROR: ${CONTRACT_PATH} not found." >&2; exit 1; }

mapfile -t expected < <(
  grep -A 20 '"jniSymbols"' "${CONTRACT_PATH}" \
    | grep -oE '"Java_[A-Za-z0-9_]+"' \
    | tr -d '"'
)

if [[ ${#expected[@]} -eq 0 ]]; then
  echo "ERROR: could not parse jniSymbols from ${CONTRACT_PATH}" >&2
  exit 1
fi

actual_symbols="$(nm -D "${SO_PATH}" 2>/dev/null | awk '{print $NF}')"

missing=()
for sym in "${expected[@]}"; do
  if ! grep -qx "${sym}" <<< "${actual_symbols}"; then
    missing+=("${sym}")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: libhorus.so is missing ${#missing[@]} expected JNI symbol(s):" >&2
  printf '  %s\n' "${missing[@]}" >&2
  echo "" >&2
  echo "The bundled .so is out of sync with modules/horus-sdk/ffi-contract.json." >&2
  echo "Re-run scripts/sync-horus-sdk.sh against a matching HORUS core build." >&2
  exit 1
fi

echo "OK: all ${#expected[@]} expected JNI symbols present in libhorus.so"
