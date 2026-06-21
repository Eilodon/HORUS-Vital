#!/usr/bin/env bash
# Syncs libhorus.so + bindings/ffi-contract.json from HORUS core into this
# repo, replacing manual copy-paste with a checksummed, reviewable step.
#
# Writes horus-sdk.lock recording the source commit/tag, ABI, and sha256 of
# the .so — review the diff of that file on every sync to catch drift before
# it reaches a device.
#
# Usage:
#   scripts/sync-horus-sdk.sh --local ../HORUS        # build from a local checkout (dev)
#   scripts/sync-horus-sdk.sh --tag v0.1.0            # download a published GitHub release (prod)
#
# --local is the default (sibling ../HORUS) since no HORUS release has been
# published yet. Switch to --tag once HORUS core ships tagged releases with
# libhorus-arm64-v8a.so + ffi-contract.json as release assets.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ABI="arm64-v8a"
JNI_LIBS_DIR="${REPO_ROOT}/modules/horus-sdk/android/src/main/jniLibs/${ABI}"
CONTRACT_DEST="${REPO_ROOT}/modules/horus-sdk/ffi-contract.json"
LOCK_FILE="${REPO_ROOT}/horus-sdk.lock"

MODE="local"
LOCAL_PATH="${REPO_ROOT}/../HORUS"
TAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local) MODE="local"; LOCAL_PATH="${2:?--local requires a path}"; shift 2 ;;
    --tag)   MODE="tag";   TAG="${2:?--tag requires a tag name}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

sync_from_local() {
  local horus_dir="$1"
  if [[ ! -f "${horus_dir}/Cargo.toml" ]]; then
    echo "ERROR: ${horus_dir} doesn't look like a HORUS core checkout (no Cargo.toml)." >&2
    exit 1
  fi

  echo "==> Building libhorus.so (${ABI}) from ${horus_dir}"
  ( cd "${horus_dir}" && cargo ndk --target aarch64-linux-android --platform 21 \
      --output-dir dist/android -- build --release --features ffi-android )

  local built_so="${horus_dir}/dist/android/${ABI}/libhorus.so"
  local contract_src="${horus_dir}/bindings/ffi-contract.json"
  [[ -f "${built_so}" ]] || { echo "ERROR: build did not produce ${built_so}" >&2; exit 1; }
  [[ -f "${contract_src}" ]] || { echo "ERROR: missing ${contract_src}" >&2; exit 1; }

  mkdir -p "${JNI_LIBS_DIR}"
  cp "${built_so}" "${JNI_LIBS_DIR}/libhorus.so"
  cp "${contract_src}" "${CONTRACT_DEST}"

  local commit
  commit="$(cd "${horus_dir}" && git rev-parse HEAD)"
  local contract_version
  contract_version="$(grep -o '"version": *[0-9]*' "${contract_src}" | grep -o '[0-9]*$')"
  write_lock "local:${commit}" "${contract_version}"
}

sync_from_tag() {
  local tag="$1"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' EXIT

  echo "==> Downloading release ${tag} from Eilodon/HORUS"
  gh release download "${tag}" -R Eilodon/HORUS \
    -p "libhorus-${ABI}.so" -p "ffi-contract.json" -D "${tmp}"

  mkdir -p "${JNI_LIBS_DIR}"
  cp "${tmp}/libhorus-${ABI}.so" "${JNI_LIBS_DIR}/libhorus.so"
  cp "${tmp}/ffi-contract.json" "${CONTRACT_DEST}"

  local contract_version
  contract_version="$(grep -o '"version": *[0-9]*' "${CONTRACT_DEST}" | grep -o '[0-9]*$')"
  write_lock "tag:${tag}" "${contract_version}"
}

write_lock() {
  local source="$1"
  local contract_version="$2"
  local checksum
  checksum="$(sha256sum "${JNI_LIBS_DIR}/libhorus.so" | cut -d' ' -f1)"

  cat > "${LOCK_FILE}" <<EOF
{
  "horusCoreRepo": "https://github.com/Eilodon/HORUS",
  "source": "${source}",
  "ffiContractVersion": ${contract_version},
  "abi": "${ABI}",
  "libhorusSha256": "${checksum}",
  "syncedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

  echo "==> Wrote ${LOCK_FILE}:"
  cat "${LOCK_FILE}"

  echo ""
  echo "==> Regenerating TS/Kotlin contract types from the synced ffi-contract.json"
  ( cd "${REPO_ROOT}" && node scripts/generate-ffi-contract.mjs )

  echo ""
  echo "Review the diff (horus-sdk.lock, modules/horus-sdk/ffi-contract.json, and the"
  echo "regenerated HorusSdk.contract.generated.ts / HorusFfiContract.kt), then run:"
  echo "  npm run verify:ffi"
}

case "${MODE}" in
  local) sync_from_local "${LOCAL_PATH}" ;;
  tag)   sync_from_tag "${TAG}" ;;
esac
