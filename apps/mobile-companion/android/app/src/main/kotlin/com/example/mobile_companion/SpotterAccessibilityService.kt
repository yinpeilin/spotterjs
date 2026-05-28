package com.example.mobile_companion

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class SpotterAccessibilityService : AccessibilityService() {
    override fun onServiceConnected() {
        isEnabled = true
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        lastEventPackage = event?.packageName?.toString()
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        isEnabled = false
        super.onDestroy()
    }

    companion object {
        @Volatile
        var isEnabled: Boolean = false
            private set

        @Volatile
        var lastEventPackage: String? = null
            private set
    }
}
