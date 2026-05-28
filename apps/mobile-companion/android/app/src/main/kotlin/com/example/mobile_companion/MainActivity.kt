package com.spotterjs.mobilecompanion

import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.format.Formatter
import android.view.inputmethod.InputMethodManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.net.Inet4Address
import java.net.NetworkInterface
import java.security.SecureRandom
import java.time.LocalTime
import java.time.format.DateTimeFormatter

class MainActivity : FlutterActivity() {
    private lateinit var bridge: CompanionBridge

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        bridge = CompanionBridge(this)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "spotter.mobile_companion/native"
        ).setMethodCallHandler { call, result -> handle(call, result) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!::bridge.isInitialized) {
            bridge = CompanionBridge(this)
        }
        requestNotificationPermissionIfNeeded()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == SCREEN_CAPTURE_REQUEST) {
            bridge.screenCaptureReady = resultCode == Activity.RESULT_OK && data != null
            bridge.addEvent(
                if (bridge.screenCaptureReady) {
                    "screen capture permission granted"
                } else {
                    "screen capture permission denied"
                }
            )
        }
    }

    private fun handle(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "getState" -> result.success(bridge.state())
                "startPairingServer" -> {
                    requestNotificationPermissionIfNeeded()
                    bridge.start()
                    result.success(null)
                }
                "stopPairingServer" -> {
                    bridge.stop()
                    result.success(null)
                }
                "regeneratePairingCode" -> {
                    bridge.regeneratePairingCode()
                    result.success(null)
                }
                "openAccessibilitySettings" -> {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                    bridge.addEvent("opened accessibility settings")
                    result.success(null)
                }
                "openInputMethodSettings" -> {
                    if (bridge.isSpotterInputMethodEnabled()) {
                        val manager = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                        manager.showInputMethodPicker()
                        bridge.addEvent("opened input method picker")
                    } else {
                        startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
                        bridge.addEvent("opened input method settings")
                    }
                    result.success(null)
                }
                "requestScreenCapture" -> {
                    val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                    startActivityForResult(manager.createScreenCaptureIntent(), SCREEN_CAPTURE_REQUEST)
                    bridge.addEvent("requested screen capture permission")
                    result.success(null)
                }
                "requestStartupPermissions" -> {
                    requestNotificationPermissionIfNeeded()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        } catch (error: Throwable) {
            result.error("MOBILE_COMPANION_NATIVE_ERROR", error.message, null)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        requestPermissions(
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            NOTIFICATION_PERMISSION_REQUEST
        )
        if (::bridge.isInitialized) {
            bridge.addEvent("requested notification permission")
        }
    }

    companion object {
        private const val SCREEN_CAPTURE_REQUEST = 4101
        private const val NOTIFICATION_PERMISSION_REQUEST = 4102
    }
}

private class CompanionBridge(private val context: Context) {
    private val random = SecureRandom()
    private val formatter = DateTimeFormatter.ofPattern("HH:mm:ss")
    private val events = ArrayDeque<String>()

    private var running = false
    private var pairingCode = nextPairingCode()
    private var server: PairingWebSocketServer? = null
    var screenCaptureReady: Boolean = false
    private var connectedClient: String? = null

    fun start() {
        if (server == null) {
            server = PairingWebSocketServer(
                DEFAULT_PORT,
                ::isPairingCodeValid,
                ::state,
                { clientId ->
                    connectedClient = clientId
                    addEvent("paired client $clientId")
                },
                ::addEvent,
                ::displayInfo,
                ::currentApp,
                { maxDepth -> SpotterAccessibilityService.dumpTree(maxDepth) },
                { x, y -> SpotterAccessibilityService.tap(x, y) },
                { fromX, fromY, toX, toY, durationMs ->
                    SpotterAccessibilityService.swipe(fromX, fromY, toX, toY, durationMs)
                },
                { strokes -> SpotterAccessibilityService.gesture(strokes) },
                ::text,
                { key -> SpotterAccessibilityService.keyevent(key) },
                { SpotterAccessibilityService.back() },
                { SpotterAccessibilityService.home() }
            ).also { it.start() }
        }
        running = true
        addEvent("pairing server started")
        val intent = Intent(context, MobileCompanionService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    fun stop() {
        server?.stop(1000)
        server = null
        running = false
        connectedClient = null
        addEvent("pairing server stopped")
        context.stopService(Intent(context, MobileCompanionService::class.java))
    }

    fun regeneratePairingCode() {
        pairingCode = nextPairingCode()
        connectedClient = null
        addEvent("pairing code regenerated")
    }

    private fun isPairingCodeValid(code: String): Boolean {
        return code == pairingCode
    }

    @Synchronized
    fun addEvent(message: String) {
        if (events.size >= 24) {
            events.removeFirst()
        }
        events.addLast("${LocalTime.now().format(formatter)} $message")
    }

    @Synchronized
    fun state(): Map<String, Any?> {
        val accessibility = SpotterAccessibilityService.isEnabled
        val inputMethodEnabled = isSpotterInputMethodEnabled()
        val inputMethodSelected = isSpotterInputMethodSelected()
        val notifications = areNotificationsAllowed()
        return mapOf(
            "running" to running,
            "host" to localHost(),
            "port" to DEFAULT_PORT,
            "pairingCode" to pairingCode,
            "connectedClient" to connectedClient,
            "accessibilityEnabled" to accessibility,
            "inputMethodEnabled" to inputMethodEnabled,
            "inputMethodSelected" to inputMethodSelected,
            "screenCaptureReady" to screenCaptureReady,
            "capabilities" to mapOf(
                "screenCapture" to screenCaptureReady,
                "accessibilityTree" to accessibility,
                "accessibilityActions" to accessibility,
                "imeText" to (inputMethodSelected || accessibility),
                "spotterKeyboard" to inputMethodSelected,
                "notifications" to notifications,
                "displayInfo" to true,
                "currentApp" to true,
                "multiTouch" to accessibility,
                "tap" to accessibility,
                "swipe" to accessibility,
                "textInput" to (inputMethodSelected || accessibility),
                "keyevent" to accessibility,
                "back" to accessibility,
                "home" to accessibility
            ),
            "events" to events.toList()
        )
    }

    private fun nextPairingCode(): String {
        return random.nextInt(1_000_000).toString().padStart(6, '0')
    }

    private fun localHost(): String {
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        @Suppress("DEPRECATION")
        val wifiAddress = wifi?.connectionInfo?.ipAddress
            ?.takeIf { it != 0 }
            ?.let { Formatter.formatIpAddress(it) }
        if (!wifiAddress.isNullOrBlank()) {
            return wifiAddress
        }

        val interfaces = NetworkInterface.getNetworkInterfaces().toList()
        for (networkInterface in interfaces) {
            if (!networkInterface.isUp || networkInterface.isLoopback) continue
            val address = networkInterface.inetAddresses.toList()
                .filterIsInstance<Inet4Address>()
                .firstOrNull { !it.isLoopbackAddress }
            if (address != null) return address.hostAddress ?: "0.0.0.0"
        }
        return "0.0.0.0"
    }

    private fun displayInfo(): Map<String, Any?> {
        val metrics = context.resources.displayMetrics
        return mapOf(
            "width" to metrics.widthPixels,
            "height" to metrics.heightPixels,
            "density" to metrics.densityDpi
        )
    }

    private fun currentApp(): Map<String, Any?> {
        return mapOf(
            "packageName" to SpotterAccessibilityService.lastEventPackage
        )
    }

    private fun text(text: String) {
        if (SpotterInputMethodService.text(text)) return
        SpotterAccessibilityService.text(text)
    }

    fun isSpotterInputMethodEnabled(): Boolean {
        val manager = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        return manager.enabledInputMethodList.any { info ->
            info.serviceName == SpotterInputMethodService::class.java.name
        }
    }

    private fun isSpotterInputMethodSelected(): Boolean {
        val current = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.DEFAULT_INPUT_METHOD
        ) ?: return false
        val component = ComponentName(context, SpotterInputMethodService::class.java)
        return current == component.flattenToString() ||
            current == component.flattenToShortString()
    }

    private fun areNotificationsAllowed(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    companion object {
        private const val DEFAULT_PORT = 17341
    }
}
