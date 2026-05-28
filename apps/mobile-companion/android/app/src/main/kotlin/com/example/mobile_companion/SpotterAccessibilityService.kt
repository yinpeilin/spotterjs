package com.spotterjs.mobilecompanion

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class SpotterAccessibilityService : AccessibilityService() {
    override fun onServiceConnected() {
        instance = this
        isEnabled = true
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        lastEventPackage = event?.packageName?.toString()
    }

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        if (instance === this) instance = null
        isEnabled = false
        super.onDestroy()
    }

    private fun dumpTree(maxDepth: Int?): Map<String, Any?> {
        val root = rootInActiveWindow ?: throw IllegalStateException(
            "accessibility root is unavailable"
        )
        return nodeToMap(root, 0, "0", maxDepth)
    }

    private fun tap(x: Int, y: Int) {
        gesture(listOf(GestureStrokeSpec(listOf(GesturePointSpec(x, y)), 1)))
    }

    private fun swipe(fromX: Int, fromY: Int, toX: Int, toY: Int, durationMs: Int?) {
        gesture(
            listOf(
                GestureStrokeSpec(
                    points = listOf(
                        GesturePointSpec(fromX, fromY),
                        GesturePointSpec(toX, toY)
                    ),
                    durationMs = (durationMs ?: 300).coerceAtLeast(1).toLong()
                )
            )
        )
    }

    private fun typeText(text: String) {
        val focus = findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            ?: rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            ?: throw IllegalStateException("focused input node is unavailable")
        val args = Bundle().apply {
            putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                text
            )
        }
        if (!focus.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) {
            throw IllegalStateException("focused input node rejected ACTION_SET_TEXT")
        }
    }

    private fun keyevent(key: String) {
        when (key.uppercase()) {
            "BACK" -> back()
            "HOME" -> home()
            else -> throw IllegalArgumentException("unsupported keyevent: $key")
        }
    }

    private fun back() {
        performGlobalAction(GLOBAL_ACTION_BACK)
    }

    private fun home() {
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    private fun gesture(strokes: List<GestureStrokeSpec>) {
        val timeoutMs = gestureDispatchTimeoutMs(strokes)
        val latch = CountDownLatch(1)
        val callback = object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                latch.countDown()
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                latch.countDown()
            }
        }
        val gesture = buildGesture(strokes)
        if (!dispatchGesture(gesture, callback, null)) {
            throw IllegalStateException("gesture dispatch failed")
        }
        if (!latch.await(timeoutMs, TimeUnit.MILLISECONDS)) {
            throw IllegalStateException("gesture dispatch timed out")
        }
    }

    private fun buildGesture(strokes: List<GestureStrokeSpec>): GestureDescription {
        val builder = GestureDescription.Builder()
        for (stroke in strokes) {
            if (stroke.points.isEmpty()) {
                throw IllegalArgumentException("gesture stroke must contain at least one point")
            }
            val first = stroke.points.first()
            val path = Path().apply {
                moveTo(first.x.toFloat(), first.y.toFloat())
                for (point in stroke.points.drop(1)) {
                    lineTo(point.x.toFloat(), point.y.toFloat())
                }
            }
            builder.addStroke(
                GestureDescription.StrokeDescription(
                    path,
                    stroke.startDelayMs.coerceAtLeast(0L),
                    stroke.durationMs.coerceAtLeast(1L)
                )
            )
        }
        return builder.build()
    }

    companion object {
        @Volatile
        var isEnabled: Boolean = false
            private set

        @Volatile
        var lastEventPackage: String? = null
            private set

        @Volatile
        private var instance: SpotterAccessibilityService? = null

        fun dumpTree(maxDepth: Int?): Map<String, Any?> {
            return requireService().dumpTree(maxDepth)
        }

        fun tap(x: Int, y: Int) {
            requireService().tap(x, y)
        }

        fun swipe(fromX: Int, fromY: Int, toX: Int, toY: Int, durationMs: Int?) {
            requireService().swipe(fromX, fromY, toX, toY, durationMs)
        }

        fun gesture(strokes: List<GestureStrokeSpec>) {
            requireService().gesture(strokes)
        }

        fun text(text: String) {
            requireService().typeText(text)
        }

        fun keyevent(key: String) {
            requireService().keyevent(key)
        }

        fun back() {
            requireService().back()
        }

        fun home() {
            requireService().home()
        }

        private fun requireService(): SpotterAccessibilityService {
            return instance ?: throw IllegalStateException(
                "Spotter accessibility service is not enabled"
            )
        }
    }
}

private fun nodeToMap(
    node: AccessibilityNodeInfo,
    depth: Int,
    path: String,
    maxDepth: Int?
): Map<String, Any?> {
    val bounds = Rect()
    node.getBoundsInScreen(bounds)
    val children = if (maxDepth != null && depth >= maxDepth) {
        emptyList()
    } else {
        (0 until node.childCount).mapNotNull { index ->
            node.getChild(index)?.let { child ->
                nodeToMap(child, depth + 1, "$path.$index", maxDepth)
            }
        }
    }
    val width = (bounds.right - bounds.left).coerceAtLeast(0)
    val height = (bounds.bottom - bounds.top).coerceAtLeast(0)
    return mapOf(
        "text" to (node.text?.toString() ?: ""),
        "resourceId" to (node.viewIdResourceName ?: ""),
        "className" to (node.className?.toString() ?: ""),
        "packageName" to (node.packageName?.toString() ?: ""),
        "contentDescription" to (node.contentDescription?.toString() ?: ""),
        "clickable" to node.isClickable,
        "enabled" to node.isEnabled,
        "checked" to node.isChecked,
        "selected" to node.isSelected,
        "scrollable" to node.isScrollable,
        "focusable" to node.isFocusable,
        "bounds" to mapOf(
            "left" to bounds.left,
            "top" to bounds.top,
            "width" to width,
            "height" to height
        ),
        "center" to mapOf(
            "x" to bounds.left + width / 2,
            "y" to bounds.top + height / 2
        ),
        "children" to children,
        "depth" to depth,
        "path" to path
    )
}
