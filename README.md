# HORUS-Vital

[![CI](https://github.com/Eilodon/HORUS-Vital/actions/workflows/ci.yml/badge.svg)](https://github.com/Eilodon/HORUS-Vital/actions/workflows/ci.yml)

**Sovereign on-device biofeedback coach — QVAC Hackathon I submission**
Track 3 (Mobile/Android) + Track 4 (Psy Models)

> ⚠ **Not a medical device.** See [DISCLAIMER.md](DISCLAIMER.md).

---

## What it does

HORUS-Vital turns a standard Android phone camera into a real-time physiological
monitor and feeds the live data to an on-device language model (MedPsy-1.7B) to
deliver grounded, biometrically-aware health guidance — entirely offline after
the first model download.

```
Front camera (30 fps)
  └─ MediaPipe FaceLandmarker          ← face bbox (no landmarks stored)
       └─ libhorus.so (rPPG engine)    ← Rust, arm64, zero telemetry
            └─ float[13] metric pack   ← HR, HRV SDNN/RMSSD, Resp, Fatigue,
                 └─ MedPsy-1.7B-Q4_K_M    Stress, Recovery, Cog-load
                      └─ Response text
                           └─ expo-speech TTS  ← speaks the answer
                 ↑
           Whisper-base STT  ← user's spoken query
```

**Fully on-device. No network after first run. No cloud API calls. No data leaves the phone.**

---

## Tech stack

| Layer | Library / Tool |
|---|---|
| Runtime | Expo SDK 54 / React Native 0.81.5 |
| rPPG core | `libhorus.so` (Rust, arm64-v8a) via JNI |
| Face detection | MediaPipe Face Landmarker 0.10.14 |
| Camera | CameraX 1.3.4 (front camera, 480×640) |
| LLM | MedPsy-1.7B-Q4_K_M (GGUF) via `@qvac/sdk` |
| STT | Whisper-base-Q8_0 via `@qvac/sdk` |
| TTS | `expo-speech` (device native) |
| Target | Android arm64 (Xiaomi, 8 GB RAM) |

---

## Milestone status

| Milestone | Description | Status |
|---|---|---|
| M0 | Expo skeleton + `libhorus.so` native link | ✅ |
| M1 | MedPsy-1.7B QVAC integration + demo completion | ✅ |
| M2 | CameraX + MediaPipe FaceLandmarker + live vitals overlay | ✅ |
| M3 | Live metrics → MedPsy seam (grounded answers) | ✅ |
| M4 | Whisper STT + expo-speech TTS + closed-loop biofeedback | ✅ |
| M5 | Submission hardening | ✅ |

---

## Device gate results

| Gate | Expected | Actual |
|---|---|---|
| `tsc --noEmit` | 0 errors | ✅ 0 errors |
| `assembleDebug` | BUILD SUCCESSFUL | ✅ 210 tasks |
| M0: `pipelineCreate` → `pipelineDestroy` | No UnsatisfiedLinkError | ⏳ requires physical device |
| M1: MedPsy completion | TTFT < 5 s, response non-empty | ⏳ requires physical device |
| M2: Face bbox visible | bbox overlaid on live feed | ⏳ requires physical device |

---

## Setup

```bash
git clone <this repo>
cd HORUS-Vital
npm install
npx expo prebuild --platform android
npx expo run:android          # requires ADB-connected Android device
```

The app downloads `face_landmarker.task` (~5 MB), `MedPsy-1.7B-Q4_K_M` (1.28 GB),
and `Whisper-base-Q8_0` (~57 MB) on first launch. Subsequent runs are fully offline.

---

## Repository layout

```
HORUS-Vital/
├── App.tsx                        # Root: camera + vitals overlay + voice UI
├── app.json                       # Expo config (package: com.horus.vital)
├── modules/
│   └── horus-sdk/                 # Local Expo module (autolin ked, no npm publish)
│       ├── android/
│       │   ├── build.gradle       # CameraX + MediaPipe deps
│       │   ├── jniLibs/arm64-v8a/libhorus.so
│       │   └── src/main/java/com/horus/
│       │       ├── Horus.kt                  # JNI bridge (+ ffiContractVersion check)
│       │       ├── HorusSdkModule.kt         # Expo module + event bus
│       │       ├── HorusCameraView.kt        # CameraX + MediaPipe + Horus view
│       │       └── HorusCameraViewModule.kt  # View module registration
│       ├── ffi-contract.json      # synced from HORUS core — see "FFI contract" below
│       └── src/
│           ├── HorusSdk.types.ts
│           ├── HorusSdkModule.ts
│           ├── HorusCameraView.tsx
│           └── useHorus.ts
├── src/
│   ├── qvac/
│   │   ├── medpsy.ts              # loadMedPsy + interpretVitals + profiler
│   │   └── useMedPsy.ts
│   └── voice/
│       ├── voice.ts               # ensureWhisper + transcribeAudio + speakResponse
│       └── useVoice.ts
├── scripts/
│   ├── sync-horus-sdk.sh          # pin libhorus.so + ffi-contract.json to a HORUS source
│   └── check-jni-symbols.sh       # nm -D diff against ffi-contract.json's jniSymbols
├── horus-sdk.lock                 # records the synced HORUS commit/tag + .so sha256
└── DISCLAIMER.md
```

---

## FFI contract — keeping `libhorus.so` in sync with HORUS core

The `float[13]` metric pack, `PixelFormat` codes, and JNI symbol surface are a
versioned contract owned by HORUS core (`src/ffi_contract.rs` /
`bindings/ffi-contract.json`), not something to hand-copy. This repo:

- Pins the synced `.so` + contract via [`horus-sdk.lock`](horus-sdk.lock)
  (source commit/tag + sha256) instead of an untracked manual copy.
- Checks `Horus.ffiContractVersion()` against `Horus.EXPECTED_FFI_CONTRACT_VERSION`
  once per `pipelineCreate()` call ([HorusSdkModule.kt](modules/horus-sdk/android/src/main/java/com/horus/HorusSdkModule.kt)) —
  a mismatch throws immediately instead of silently misreading the pack.
- Verifies the bundled `.so` exports the expected JNI symbols via
  `npm run verify:ffi` ([scripts/check-jni-symbols.sh](scripts/check-jni-symbols.sh)) —
  catches a renamed/removed Rust export or a stray Kotlin `external fun`
  before it becomes a device-only `UnsatisfiedLinkError`.

To re-sync after a HORUS core change:
```bash
npm run sync:horus-sdk -- --local ../HORUS   # dev: build + copy from a local checkout
npm run verify:ffi                            # confirm symbols still match
```
Review the `horus-sdk.lock` diff and bump `EXPECTED_FFI_CONTRACT_VERSION` in
`Horus.kt` whenever the synced contract version changes.

---

## The float[13] metric pack

Index into the array returned by `pipelineProcessBbox`:

| # | Field | Unit |
|---|---|---|
| 0 | `heartRateBpm` | bpm |
| 1 | `confidence` | 0–1 |
| 2 | `faceDetected` | 0 or 1 |
| 3 | `bufferFill` | 0–1 |
| 4 | `sdnnMs` | ms |
| 5 | `rmssdMs` | ms |
| 6 | `respBpm` | bpm |
| 7 | `fatigueScore` | 0–1 |
| 8 | `stressScore` | 0–1 |
| 9 | `fatigueLevel` | 0–4 |
| 10 | `stressLevel` | 0–4 |
| 11 | `recoveryReadiness` | 0–1 |
| 12 | `cognitiveLoad` | 0–1 |

---

## Submission evidence

See [docs/evidence/EVIDENCE.md](docs/evidence/EVIDENCE.md).
