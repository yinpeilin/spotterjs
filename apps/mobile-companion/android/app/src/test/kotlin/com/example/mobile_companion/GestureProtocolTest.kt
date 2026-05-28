package com.spotterjs.mobilecompanion

import org.junit.Assert.assertEquals
import org.junit.Test

class GestureProtocolTest {
    @Test
    fun timeoutCoversLatestStrokeEndWithBuffer() {
        val timeout = gestureDispatchTimeoutMs(
            listOf(
                GestureStrokeSpec(
                    points = listOf(GesturePointSpec(10, 20)),
                    durationMs = 300,
                    startDelayMs = 0
                ),
                GestureStrokeSpec(
                    points = listOf(GesturePointSpec(30, 40)),
                    durationMs = 1_500,
                    startDelayMs = 500
                )
            )
        )

        assertEquals(4_000, timeout)
    }

    @Test
    fun timeoutAddsBufferForShortGestures() {
        val timeout = gestureDispatchTimeoutMs(
            listOf(
                GestureStrokeSpec(
                    points = listOf(GesturePointSpec(10, 20)),
                    durationMs = 1,
                    startDelayMs = 0
                )
            )
        )

        assertEquals(2_001, timeout)
    }
}
