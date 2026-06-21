package com.horus

// GENERATED FILE — do not edit by hand.
// Source: modules/horus-sdk/ffi-contract.json (synced from HORUS core via scripts/sync-horus-sdk.sh)
// Regenerate: npm run generate:ffi-contract
// scripts/check-generated.sh fails CI if this drifts from the source JSON.

/** Versioned FFI contract synced from HORUS core. See [Horus] and [HorusSdkModule]. */
object HorusFfiContract {
    /** Expected `libhorus.so` contract version — checked via [Horus.ffiContractVersion]. */
    const val EXPECTED_FFI_CONTRACT_VERSION = 1

    /** Mirrors `PixelFormat` in HORUS core (bindings/ffi-contract.json). */
    object PixelFormat {
        const val RGB888 = 0
        const val RGBA8888 = 1
        const val NV21 = 2
    }
}
