package com.spotterjs.mobilecompanion

import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.TextView
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class SpotterInputMethodService : InputMethodService() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onCreateInputView(): View {
        return TextView(this).apply {
            text = "Spotter Keyboard"
            gravity = Gravity.CENTER
            minHeight = 96
        }
    }

    override fun onStartInputView(info: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        isSelected = true
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        isSelected = false
        super.onFinishInputView(finishingInput)
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        isSelected = false
        super.onDestroy()
    }

    private fun commitText(text: String): Boolean {
        val connection = currentInputConnection ?: return false
        return connection.commitText(text, 1)
    }

    companion object {
        private val main = Handler(Looper.getMainLooper())

        @Volatile
        private var instance: SpotterInputMethodService? = null

        @Volatile
        var isSelected: Boolean = false
            private set

        val isRunning: Boolean
            get() = instance != null

        fun text(text: String): Boolean {
            val service = instance ?: return false
            if (Looper.myLooper() == Looper.getMainLooper()) {
                return service.commitText(text)
            }

            val completed = CountDownLatch(1)
            val committed = AtomicBoolean(false)
            main.post {
                committed.set(service.commitText(text))
                completed.countDown()
            }
            if (!completed.await(2, TimeUnit.SECONDS)) return false
            return committed.get()
        }
    }
}
