package com.spotterjs.mobilecompanion

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class ScreenCaptureService : Service() {
    private lateinit var workerThread: HandlerThread
    private lateinit var worker: Handler
    private var projection: MediaProjection? = null
    private var projectionCallback: MediaProjection.Callback? = null
    private var imageReader: ImageReader? = null
    private var virtualDisplay: VirtualDisplay? = null

    override fun onCreate() {
        super.onCreate()
        workerThread = HandlerThread("spotter-screen-capture")
        workerThread.start()
        worker = Handler(workerThread.looper)
        instance = this
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification())
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_START_CAPTURE) {
            val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
            val data = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(EXTRA_RESULT_DATA)
            }
            if (resultCode == Activity.RESULT_OK && data != null) {
                startProjection(resultCode, data)
            }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        if (instance === this) instance = null
        stopProjection()
        workerThread.quitSafely()
        super.onDestroy()
    }

    private fun startProjection(resultCode: Int, data: Intent) {
        stopProjection()
        val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = manager.getMediaProjection(resultCode, data)
        val callback = object : MediaProjection.Callback() {
            override fun onStop() {
                releaseCaptureResources()
            }
        }
        projection.registerCallback(callback, worker)
        val metrics = resources.displayMetrics
        val width = metrics.widthPixels.coerceAtLeast(1)
        val height = metrics.heightPixels.coerceAtLeast(1)
        val density = metrics.densityDpi
        val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        val display = projection.createVirtualDisplay(
            "SpotterScreenCapture",
            width,
            height,
            density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface,
            null,
            worker
        )
        this.projection = projection
        projectionCallback = callback
        imageReader = reader
        virtualDisplay = display
    }

    private fun stopProjection() {
        releaseCaptureResources()
        val activeProjection = projection
        val activeCallback = projectionCallback
        if (activeProjection != null && activeCallback != null) {
            try {
                activeProjection.unregisterCallback(activeCallback)
            } catch (_: IllegalArgumentException) {
                // Already unregistered by the platform after projection shutdown.
            }
        }
        activeProjection?.stop()
        projection = null
        projectionCallback = null
    }

    private fun releaseCaptureResources() {
        virtualDisplay?.release()
        virtualDisplay = null
        imageReader?.close()
        imageReader = null
    }

    private fun capture(): Map<String, Any?> {
        val reader = imageReader ?: throw IllegalStateException(
            "screen capture permission is not granted"
        )
        var image = reader.acquireLatestImage()
        if (image == null) {
            val latch = CountDownLatch(1)
            reader.setOnImageAvailableListener({ latch.countDown() }, worker)
            latch.await(1, TimeUnit.SECONDS)
            reader.setOnImageAvailableListener(null, worker)
            image = reader.acquireLatestImage()
        }
        val frame = image ?: throw IllegalStateException("screen capture frame is unavailable")
        try {
            val bytes = pngBytes(frame)
            val metrics = resources.displayMetrics
            return mapOf(
                "mimeType" to "image/png",
                "width" to frame.width,
                "height" to frame.height,
                "density" to metrics.densityDpi,
                "base64" to Base64.encodeToString(bytes, Base64.NO_WRAP)
            )
        } finally {
            frame.close()
        }
    }

    private fun notification(): Notification {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Spotter Screen Capture",
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(channel)
        }

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Spotter Screen Capture")
            .setContentText("Screen capture is available to paired Spotter clients")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val ACTION_START_CAPTURE = "com.spotterjs.mobilecompanion.START_CAPTURE"
        private const val EXTRA_RESULT_CODE = "resultCode"
        private const val EXTRA_RESULT_DATA = "resultData"
        private const val CHANNEL_ID = "spotter_screen_capture"
        private const val NOTIFICATION_ID = 17342

        @Volatile
        private var instance: ScreenCaptureService? = null

        val isReady: Boolean
            get() = instance?.imageReader != null

        fun start(context: Context, resultCode: Int, data: Intent) {
            val intent = Intent(context, ScreenCaptureService::class.java).apply {
                action = ACTION_START_CAPTURE
                putExtra(EXTRA_RESULT_CODE, resultCode)
                putExtra(EXTRA_RESULT_DATA, data)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun captureScreen(): Map<String, Any?> {
            return instance?.capture()
                ?: throw IllegalStateException("screen capture permission is not granted")
        }
    }
}

private fun pngBytes(image: Image): ByteArray {
    val plane = image.planes.first()
    val buffer = plane.buffer
    val pixelStride = plane.pixelStride
    val rowStride = plane.rowStride
    val rowPadding = rowStride - pixelStride * image.width
    val bitmapWidth = image.width + rowPadding / pixelStride
    val source = Bitmap.createBitmap(bitmapWidth, image.height, Bitmap.Config.ARGB_8888)
    source.copyPixelsFromBuffer(buffer)
    val cropped = Bitmap.createBitmap(source, 0, 0, image.width, image.height)
    source.recycle()
    val output = ByteArrayOutputStream()
    cropped.compress(Bitmap.CompressFormat.PNG, 100, output)
    cropped.recycle()
    return output.toByteArray()
}
