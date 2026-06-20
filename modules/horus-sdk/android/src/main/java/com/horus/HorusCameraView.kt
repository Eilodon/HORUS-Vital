package com.horus

import android.content.Context
import android.os.Bundle
import android.util.Log
import android.widget.FrameLayout
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.net.URL
import java.util.concurrent.Executors

class HorusCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

    companion object {
        private const val TAG = "HorusCameraView"
        private const val MODEL_FILE = "face_landmarker.task"
        private const val MODEL_URL =
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    }

    private val previewView = PreviewView(context)
    private val analysisExecutor = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var faceLandmarker: FaceLandmarker? = null
    private var pipelineHandle: Long = 0L

    init {
        addView(previewView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))
        pipelineHandle = Horus.pipelineCreate(15f, 480, 640, 150)
        Thread(::initModel).start()
    }

    private fun initModel() {
        try {
            val modelFile = File(context.filesDir, MODEL_FILE)
            if (!modelFile.exists()) {
                Log.i(TAG, "Downloading FaceLandmarker model…")
                URL(MODEL_URL).openStream().use { src ->
                    modelFile.outputStream().use { dst -> src.copyTo(dst) }
                }
                Log.i(TAG, "Model downloaded: ${modelFile.length()} bytes")
            }
            val options = FaceLandmarker.FaceLandmarkerOptions.builder()
                .setBaseOptions(
                    BaseOptions.builder().setModelAssetPath(modelFile.absolutePath).build()
                )
                .setRunningMode(RunningMode.IMAGE)
                .setNumFaces(1)
                .build()
            faceLandmarker = FaceLandmarker.createFromOptions(context, options)
            Log.i(TAG, "FaceLandmarker ready")
            post(::bindCamera)
        } catch (e: Exception) {
            Log.e(TAG, "Model init error: ${e.message}", e)
        }
    }

    private fun bindCamera() {
        val lifecycleOwner = appContext.currentActivity as? LifecycleOwner ?: return
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            cameraProvider = future.get()
            val preview = Preview.Builder().build()
                .also { it.setSurfaceProvider(previewView.surfaceProvider) }

            val analysis = ImageAnalysis.Builder()
                .setTargetResolution(android.util.Size(480, 640))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(analysisExecutor) { proxy -> analyzeFrame(proxy) }

            try {
                cameraProvider?.unbindAll()
                cameraProvider?.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_FRONT_CAMERA,
                    preview,
                    analysis,
                )
            } catch (e: Exception) {
                Log.e(TAG, "Camera bind error: ${e.message}", e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun analyzeFrame(proxy: ImageProxy) {
        val lm = faceLandmarker
        val handle = pipelineHandle
        if (lm == null || handle == 0L) { proxy.close(); return }

        val bitmap = proxy.toBitmap()
        val w = bitmap.width
        val h = bitmap.height
        val tsUs = System.nanoTime() / 1_000L

        // Face bbox from MediaPipe landmarks (normalized → pixel coords)
        val result = lm.detect(BitmapImageBuilder(bitmap).build())
        val face = result.faceLandmarks().firstOrNull()

        val bboxX: Int; val bboxY: Int; val bboxW: Int; val bboxH: Int
        if (face != null) {
            val xs = face.map { it.x() * w }
            val ys = face.map { it.y() * h }
            bboxX = xs.min().toInt().coerceAtLeast(0)
            bboxY = ys.min().toInt().coerceAtLeast(0)
            bboxW = (xs.max() - xs.min()).toInt().coerceAtLeast(1)
            bboxH = (ys.max() - ys.min()).toInt().coerceAtLeast(1)
        } else {
            bboxX = 0; bboxY = 0; bboxW = 0; bboxH = 0
        }

        // Convert ARGB_8888 bitmap → RGB888 ByteArray (PixelFormat 0)
        val pixels = IntArray(w * h)
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
        val rgb = ByteArray(w * h * 3)
        for (i in pixels.indices) {
            val p = pixels[i]
            rgb[i * 3]     = ((p shr 16) and 0xFF).toByte()
            rgb[i * 3 + 1] = ((p shr 8) and 0xFF).toByte()
            rgb[i * 3 + 2] = (p and 0xFF).toByte()
        }

        proxy.close()

        val pack = Horus.pipelineProcessBbox(handle, rgb, 0, w, h, bboxX, bboxY, bboxW, bboxH, tsUs)
        if (pack != null && pack.size >= 13) {
            HorusSdkModule.emitMetrics(Bundle().apply {
                putDouble("hr",               pack[0].toDouble())
                putDouble("conf",             pack[1].toDouble())
                putDouble("faceDetected",     pack[2].toDouble())
                putDouble("bufferFill",       pack[3].toDouble())
                putDouble("sdnnMs",           pack[4].toDouble())
                putDouble("rmssdMs",          pack[5].toDouble())
                putDouble("respBpm",          pack[6].toDouble())
                putDouble("fatigueScore",     pack[7].toDouble())
                putDouble("stressScore",      pack[8].toDouble())
                putDouble("fatigueLevel",     pack[9].toDouble())
                putDouble("stressLevel",      pack[10].toDouble())
                putDouble("recoveryReadiness",pack[11].toDouble())
                putDouble("cognitiveLoad",    pack[12].toDouble())
                putInt("bboxX", bboxX); putInt("bboxY", bboxY)
                putInt("bboxW", bboxW); putInt("bboxH", bboxH)
            })
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cameraProvider?.unbindAll()
        analysisExecutor.shutdown()
        faceLandmarker?.close()
        val h = pipelineHandle
        if (h != 0L) { Horus.pipelineDestroy(h); pipelineHandle = 0L }
    }
}
