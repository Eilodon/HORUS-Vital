package com.horus

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HorusCameraViewModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("HorusCameraView")
        View(HorusCameraView::class) {
            // Events are delivered through HorusSdkModule's "onMetrics" event bus.
            // No per-view props needed for M2 demo.
        }
    }
}
