package com.horus

/**
 * JNI bridge to the HORUS Rust biometric core (`libhorus.so`).
 *
 * Class name and method signatures are hard-bound to the native symbols
 * `Java_com_horus_Horus_*` exported by `src/ffi/android.rs` in the (private)
 * HORUS core repo — do not rename this class or change a signature without
 * updating the Rust side first.
 *
 * Scope: the bbox-only spine (`pipelineCreate` / `pipelineProcessBbox` /
 * `pipelineReset` / `pipelineDestroy`). Other JNI entries exist on the Rust
 * side (rPPG/PRISM/beauty/full-frame+landmarks) but are out of scope until a
 * later milestone needs them.
 */
object Horus {
    init {
        System.loadLibrary("horus")
    }

    /** Creates a VideoPipeline. Returns an opaque handle (0 means failure). */
    @JvmStatic
    external fun pipelineCreate(fps: Float, width: Int, height: Int, bufferSize: Int): Long

    /**
     * FFI contract version baked into the loaded `libhorus.so`. Compare
     * against [HorusFfiContract.EXPECTED_FFI_CONTRACT_VERSION] before
     * trusting the metric pack.
     */
    @JvmStatic
    external fun ffiContractVersion(): Int

    /**
     * Feeds one camera frame + face bbox, no landmarks required.
     * `format`: 0=RGB888, 1=RGBA8888, 2=NV21.
     * Returns the float[13] metric pack (see PixelFormat/PipelineResult docs in
     * android.rs) or null on error.
     */
    @JvmStatic
    external fun pipelineProcessBbox(
        handle: Long,
        frame: ByteArray,
        format: Int,
        width: Int,
        height: Int,
        x: Int,
        y: Int,
        bboxW: Int,
        bboxH: Int,
        timestampUs: Long,
    ): FloatArray?

    /** Resets pipeline state (call on face-lost). */
    @JvmStatic
    external fun pipelineReset(handle: Long)

    /** Frees the pipeline. Must be called exactly once per `pipelineCreate`. */
    @JvmStatic
    external fun pipelineDestroy(handle: Long)
}
