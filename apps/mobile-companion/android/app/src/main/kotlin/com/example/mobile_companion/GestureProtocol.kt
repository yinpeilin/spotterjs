package com.spotterjs.mobilecompanion

data class GesturePointSpec(
    val x: Int,
    val y: Int
)

data class GestureStrokeSpec(
    val points: List<GesturePointSpec>,
    val durationMs: Long,
    val startDelayMs: Long = 0L
)

const val COMPANION_PROTOCOL_VERSION = 2

private const val GESTURE_TIMEOUT_BUFFER_MS = 2_000L
private const val GESTURE_TIMEOUT_MINIMUM_MS = 2_000L

fun gestureDispatchTimeoutMs(strokes: List<GestureStrokeSpec>): Long {
    val latestEndMs = strokes.maxOfOrNull { it.startDelayMs + it.durationMs } ?: 0L
    return (latestEndMs + GESTURE_TIMEOUT_BUFFER_MS).coerceAtLeast(GESTURE_TIMEOUT_MINIMUM_MS)
}
