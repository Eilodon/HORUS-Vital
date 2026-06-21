# HORUS-Vital — Submission Evidence Bundle

**Date:** 2026-06-21
**Target:** QVAC Hackathon I — Track 3 (Mobile/Android) + Track 4 (Psy Models)
**Deadline:** 2026-06-21 23:59 UTC

---

## Build evidence

### TypeScript (zero errors)
```
$ npx tsc --noEmit
(no output — exit 0)
```

### Android APK build
```
$ cd android && ./gradlew assembleDebug
...
BUILD SUCCESSFUL in 20s
210 actionable tasks: 48 executed, 162 up-to-date
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### APK contents verification
- `libhorus.so` bundled in `lib/arm64-v8a/` (ARM64 ELF, Rust, ~972 KB stripped)
- `libmediapipe_tasks_vision_jni.so` bundled (MediaPipe 0.10.14)
- `libcamera2.so`, `libjpeg.so` (CameraX runtime)
- `classes.dex` includes `com.horus.HorusCameraView`,
  `com.horus.HorusSdkModule`, `com.horus.Horus`

---

## M0 — Native link gate

**What:** `pipelineCreate(30, 640, 480, 150)` → `pipelineDestroy(handle)` with no
`UnsatisfiedLinkError`. Verifies `libhorus.so` loads and the JNI symbol table is
correct (`Java_com_horus_Horus_pipelineCreate`, etc.).

**Build-time evidence:** `nm -D libhorus.so` shows all 4 JNI symbols:
```
Java_com_horus_Horus_pipelineCreate
Java_com_horus_Horus_pipelineProcessBbox
Java_com_horus_Horus_pipelineReset
Java_com_horus_Horus_pipelineDestroy
```

**Device gate:** ⏳ Requires physical Xiaomi device (ADB). Run:
```bash
npx expo run:android
```
Expected: App shows "✅ pipelineCreate → pipelineDestroy OK"

---

## M1 — MedPsy-1.7B QVAC integration

**Model:** `medpsy-1.7b-q4_k_m-imat.gguf`
**Source:** `https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf`
**Size:** 1.28 GB (imatrix-calibrated Q4_K_M)

**Flow:**
1. `loadModel({ modelSrc: MEDPSY_URL, modelType: "llm", onProgress })` → modelId
2. `completion({ modelId, history: [system+user], stream: true })` → streaming tokens
3. `profiler.enable/disable` wraps the call; TTFT tracked from first `textDelta` event

**Device gate:** ⏳ Expected TTFT < 5 s on Xiaomi 8GB with Q4_K_M quantization.

---

## M2 — Camera + MediaPipe FaceLandmarker + live vitals

**Pipeline:**
```
CameraX ImageAnalysis (480×640, front cam, 15 fps analysis cap)
  → ImageProxy.toBitmap() (YUV_420_888 → ARGB_8888)
  → FaceLandmarker.detect() → 478 normalized landmarks
  → min/max → pixel bbox (x, y, w, h)
  → RGB888 byte array (3 × w × h bytes)
  → Horus.pipelineProcessBbox(handle, rgb, 0, w, h, bbox..., tsUs)
  → float[13] pack
  → HorusSdkModule.emitMetrics() → JS EventEmitter → useLiveMetrics()
  → UI overlay update
```

**Face Landmarker model:** `face_landmarker.task` (~5 MB)
Downloaded on first launch from MediaPipe CDN to `filesDir/`.

**Device gate:** ⏳ Expected: bbox drawn over face in camera preview, all 7 vitals updating.

---

## M3 — Live metrics → MedPsy seam

`interpret(livePack(), userQuery)` in `App.tsx` passes the live `float[13]` pack
as a structured system prompt to MedPsy. The system prompt includes:
- HR + confidence
- HRV SDNN + RMSSD
- Respiration rate
- Fatigue/stress scores and levels
- Recovery readiness + cognitive load

MedPsy responds with ≤3 sentences of evidence-based guidance grounded in the
current biometric state.

---

## M4 — Voice closed-loop biofeedback

**STT:** Whisper-base-Q8_0 (~57 MB) via `@qvac/sdk transcribe()`
**Model URL:** `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base-q8_0.bin`

**TTS:** `expo-speech` (device Android TTS engine — no model download required)

**Voice flow:**
1. Tap 🎤 → `Audio.Recording.createAsync(HIGH_QUALITY)` starts
2. Tap ⏹ → `stopAndUnloadAsync()` → wav/m4a → `transcribe({ modelId, audioChunk: path })`
3. Transcribed text → `interpretVitals(modelId, livePack, text)` → MedPsy response
4. `Speech.speak(response.text)` → spoken aloud

**Device gate:** ⏳ Requires device mic + speaker.

---

## M5 — Submission hardening

- [x] README.md with architecture diagram + milestone table + setup instructions
- [x] DISCLAIMER.md (not a medical device)
- [x] Evidence bundle (this file)
- [ ] Demo video — requires physical device session

---

## M6 — FFI contract hardening (post-submission)

Closes a silent-drift gap found during cross-repo review: the `float[13]`
pack layout and `PixelFormat` codes were hand-mirrored across HORUS core
(Rust), `Horus.kt` (Kotlin), and `HorusSdk.types.ts` with no enforcement.

- [x] HORUS core: `FFI_CONTRACT_VERSION` + `bindings/ffi-contract.json` as the
  single source of truth; `cargo test` fails if the JSON drifts from the
  Rust constants (3 new tests, `Java_com_horus_Horus_ffiContractVersion` JNI export)
- [x] HORUS-Vital: `Horus.ffiContractVersion()` checked against
  `Horus.EXPECTED_FFI_CONTRACT_VERSION` on every `pipelineCreate()` — throws
  immediately on mismatch instead of silently misreading the pack
- [x] `horus-sdk.lock` pins the synced `.so` to a HORUS core commit + sha256
  (`scripts/sync-horus-sdk.sh`), replacing the untracked manual copy
- [x] `npm run verify:ffi` (`scripts/check-jni-symbols.sh`) diffs `nm -D
  libhorus.so` against `ffi-contract.json`'s `jniSymbols` — re-ran after
  rebuilding `libhorus.so`, 5/5 expected symbols present
- [x] `App.tsx`'s `lvl()` now handles `NaN` fatigue/stress levels explicitly
  (previously relied on `Math.round(NaN)` → array-miss → fallback, which
  worked by accident, not by design)
- [x] Re-verified after the change: `tsc --noEmit` 0 errors, `assembleDebug`
  BUILD SUCCESSFUL

---

## Git log (HORUS-Vital)

```
7238fc0  feat(m4): voice loop — Whisper STT + expo-speech TTS + closed-loop biofeedback
be1c29f  feat(m2): camera + MediaPipe FaceLandmarker + live vitals overlay
39f6bc6  feat(m1): QVAC MedPsy-1.7B integration + M0/M1 gate UI
d5db1e6  feat(m0): Expo 54 skeleton + @horus/sdk local module native link
```
