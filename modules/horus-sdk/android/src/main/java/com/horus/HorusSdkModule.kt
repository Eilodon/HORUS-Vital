package com.horus

import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** Bbox + frame geometry, bundled to stay under the Expo Function 8-arg limit. */
class BboxFrame : Record {
  @Field val format: Int = 0
  @Field val width: Int = 0
  @Field val height: Int = 0
  @Field val x: Int = 0
  @Field val y: Int = 0
  @Field val bboxW: Int = 0
  @Field val bboxH: Int = 0
}

/**
 * Expo-facing wrapper over the [Horus] JNI bridge. Keeps marshaling
 * (Double<->Float, JS array<->ByteArray, Record<->positional args) out of the
 * native bridge class so [Horus]'s signatures stay an exact mirror of the
 * Rust `Java_com_horus_Horus_*` exports.
 *
 * Also declares the "onMetrics" event so [HorusCameraView] can emit live
 * biometric data through the standard Expo event bus.
 */
class HorusSdkModule : Module() {

  companion object {
    @Volatile private var instance: HorusSdkModule? = null

    fun emitMetrics(data: Bundle) {
      instance?.sendEvent("onMetrics", data)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("HorusSdk")

    Events("onMetrics")

    OnCreate { instance = this@HorusSdkModule }
    OnDestroy { if (instance === this@HorusSdkModule) instance = null }

    Function("pipelineCreate") { fps: Double, width: Int, height: Int, bufferSize: Int ->
      val actual = Horus.ffiContractVersion()
      check(actual == HorusFfiContract.EXPECTED_FFI_CONTRACT_VERSION) {
        "libhorus.so FFI contract version mismatch: expected " +
          "${HorusFfiContract.EXPECTED_FFI_CONTRACT_VERSION}, got $actual. The bundled .so is " +
          "out of sync with this JS/Kotlin layer — re-run scripts/sync-horus-sdk.sh against a " +
          "matching HORUS core release before trusting the metric pack."
      }
      Horus.pipelineCreate(fps.toFloat(), width, height, bufferSize)
    }

    Function("pipelineProcessBbox") { handle: Long, frame: ByteArray, frameInfo: BboxFrame, timestampUs: Long ->
      Horus.pipelineProcessBbox(
        handle,
        frame,
        frameInfo.format,
        frameInfo.width,
        frameInfo.height,
        frameInfo.x,
        frameInfo.y,
        frameInfo.bboxW,
        frameInfo.bboxH,
        timestampUs,
      )?.toList()
    }

    Function("pipelineReset") { handle: Long ->
      Horus.pipelineReset(handle)
    }

    Function("pipelineDestroy") { handle: Long ->
      Horus.pipelineDestroy(handle)
    }
  }
}
