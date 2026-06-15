package com.spotterjs.mobilecompanion

import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.ServerSocket
import java.net.URI
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

class PairingWebSocketServerTest {
    @Test
    fun acceptsCurrentPairingCodeWithoutTimerExpiry() {
        withServer(isPairingCodeValid = { it == "123456" }) { port, pairedClients, _ ->
            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))

                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )

                val paired = client.nextJson()
                assertEquals("paired", paired.getString("type"))
                assertEquals(2, paired.getInt("protocolVersion"))
                assertNotNull(paired.getString("sessionToken"))
                assertEquals("desktop-dev", pairedClients.poll(2, TimeUnit.SECONDS))
            }
        }
    }

    @Test
    fun pairedResponseIncludesDeviceIdentity() {
        withServer(
            isPairingCodeValid = { it == "123456" },
            snapshot = {
                mapOf(
                    "running" to true,
                    "manufacturer" to "Google",
                    "model" to "Pixel 8",
                    "nickname" to "lab-1",
                    "capabilities" to mapOf("displayInfo" to true)
                )
            }
        ) { port, _, _ ->
            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )

                val state = client.nextJson().getJSONObject("state")
                assertEquals("Google", state.getString("manufacturer"))
                assertEquals("Pixel 8", state.getString("model"))
                assertEquals("lab-1", state.getString("nickname"))
            }
        }
    }

    @Test
    fun rejectsOnlyInvalidPairingCodes() {
        withServer(isPairingCodeValid = { it == "123456" }) { port, _, _ ->
            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))

                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "000000"
                )

                val error = client.nextJson()
                assertEquals("error", error.getString("type"))
                assertEquals("PAIRING_CODE_INVALID", error.getString("code"))
                assertEquals("pairing code is invalid", error.getString("message"))
            }
        }
    }

    @Test
    fun routesAuthenticatedAutomationCommands() {
        val textCommands = LinkedBlockingQueue<String>()
        val gestures = CopyOnWriteArrayList<List<GestureStrokeSpec>>()
        withServer(
            isPairingCodeValid = { it == "123456" },
            text = { textCommands.add(it) },
            gesture = { gestures.add(it) }
        ) { port, _, _ ->
            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )
                val token = client.nextJson().getString("sessionToken")

                client.sendJson(
                    "type" to "displayInfo",
                    "sessionToken" to token
                )
                val display = client.nextJson()
                assertEquals("displayInfo", display.getString("type"))
                assertEquals(1080, display.getInt("width"))

                client.sendJson(
                    "type" to "tap",
                    "sessionToken" to token,
                    "x" to 10,
                    "y" to 20
                )
                assertEquals("ok", client.nextJson().getString("type"))

                client.sendJson(
                    "type" to "dumpTree",
                    "sessionToken" to token,
                    "maxDepth" to 3
                )
                val tree = client.nextJson()
                assertEquals("tree", tree.getString("type"))
                assertEquals("Root", tree.getJSONObject("tree").getString("text"))

                client.sendJson(
                    "type" to "text",
                    "sessionToken" to token,
                    "text" to "hello IME"
                )
                assertEquals("ok", client.nextJson().getString("type"))
                assertEquals("hello IME", textCommands.poll(2, TimeUnit.SECONDS))

                client.sendJson(
                    "type" to "gesture",
                    "sessionToken" to token,
                    "strokes" to listOf(
                        mapOf(
                            "points" to listOf(
                                mapOf("x" to 100, "y" to 200),
                                mapOf("x" to 120, "y" to 220)
                            ),
                            "durationMs" to 300,
                            "startDelayMs" to 0
                        ),
                        mapOf(
                            "points" to listOf(
                                mapOf("x" to 300, "y" to 400),
                                mapOf("x" to 320, "y" to 420)
                            ),
                            "durationMs" to 300,
                            "startDelayMs" to 0
                        )
                    )
                )
                assertEquals("ok", client.nextJson().getString("type"))
                assertEquals(1, gestures.size)
                assertEquals(2, gestures.first().size)
            }
        }
    }

    @Test
    fun reusesSessionTokenOnNewWebSocketConnection() {
        withServer(isPairingCodeValid = { it == "123456" }) { port, _, _ ->
            val token = TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )
                client.nextJson().getString("sessionToken")
            }

            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "heartbeat",
                    "sessionToken" to token
                )
                assertEquals("pong", client.nextJson().getString("type"))
            }
        }
    }

    @Test
    fun invalidatesSessionTokensOnRequest() {
        withServer(isPairingCodeValid = { it == "123456" }) { port, _, server ->
            val token = TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )
                client.nextJson().getString("sessionToken")
            }

            server.invalidateSessions("test invalidation")

            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "heartbeat",
                    "sessionToken" to token
                )
                val error = client.nextJson()
                assertEquals("error", error.getString("type"))
                assertEquals("SESSION_UNAUTHORIZED", error.getString("code"))
            }
        }
    }

    @Test
    fun routesLaunchAppCommand() {
        val launchedPackages = LinkedBlockingQueue<String>()
        withServer(
            isPairingCodeValid = { it == "123456" },
            launchApp = { packageName ->
                launchedPackages.add(packageName)
                mapOf(
                    "packageName" to packageName,
                    "activity" to "com.android.settings.Settings"
                )
            }
        ) { port, _, _ ->
            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )
                val token = client.nextJson().getString("sessionToken")

                client.sendJson(
                    "type" to "launchApp",
                    "sessionToken" to token,
                    "packageName" to "com.android.settings"
                )
                val launched = client.nextJson()
                assertEquals("appLaunched", launched.getString("type"))
                assertEquals("com.android.settings", launched.getString("packageName"))
                assertEquals("com.android.settings", launchedPackages.poll(2, TimeUnit.SECONDS))
            }
        }
    }

    @Test
    fun routesCaptureScreenCommand() {
        withServer(
            isPairingCodeValid = { it == "123456" },
            captureScreen = {
                mapOf(
                    "mimeType" to "image/png",
                    "width" to 1080,
                    "height" to 2400,
                    "density" to 420,
                    "base64" to "cG5n"
                )
            }
        ) { port, _, _ ->
            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )
                val token = client.nextJson().getString("sessionToken")

                client.sendJson(
                    "type" to "captureScreen",
                    "sessionToken" to token
                )

                val captured = client.nextJson()
                assertEquals("screenCaptured", captured.getString("type"))
                assertEquals("image/png", captured.getString("mimeType"))
                assertEquals(1080, captured.getInt("width"))
                assertEquals("cG5n", captured.getString("base64"))
            }
        }
    }

    @Test
    fun reportsCaptureScreenErrors() {
        withServer(
            isPairingCodeValid = { it == "123456" },
            captureScreen = {
                throw IllegalStateException("screen capture permission is not granted")
            }
        ) { port, _, _ ->
            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 2,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )
                val token = client.nextJson().getString("sessionToken")

                client.sendJson(
                    "type" to "captureScreen",
                    "sessionToken" to token
                )

                val error = client.nextJson()
                assertEquals("error", error.getString("type"))
                assertEquals("SCREEN_CAPTURE_UNAVAILABLE", error.getString("code"))
                assertEquals(
                    "screen capture permission is not granted",
                    error.getString("message")
                )
            }
        }
    }

    @Test
    fun rejectsUnsupportedProtocolVersion() {
        withServer(isPairingCodeValid = { it == "123456" }) { port, _, _ ->
            TestClient(URI("ws://127.0.0.1:$port")).use { client ->
                assertTrue(client.connectBlocking(2, TimeUnit.SECONDS))
                assertEquals("hello", client.nextJson().getString("type"))
                client.sendJson(
                    "type" to "pair",
                    "protocolVersion" to 1,
                    "clientId" to "desktop-dev",
                    "code" to "123456"
                )
                val error = client.nextJson()
                assertEquals("error", error.getString("type"))
                assertEquals("PROTOCOL_VERSION_UNSUPPORTED", error.getString("code"))
            }
        }
    }

    private fun withServer(
        isPairingCodeValid: (String) -> Boolean,
        test: (Int, LinkedBlockingQueue<String>, PairingWebSocketServer) -> Unit,
        snapshot: () -> Map<String, Any?> = {
            mapOf(
                "running" to true,
                "capabilities" to mapOf("displayInfo" to true)
            )
        },
        text: (String) -> Unit = {},
        gesture: (List<GestureStrokeSpec>) -> Unit = {},
        launchApp: (String) -> Map<String, Any?> = { mapOf("packageName" to it) },
        captureScreen: () -> Map<String, Any?> = {
            mapOf(
                "mimeType" to "image/png",
                "width" to 1,
                "height" to 1,
                "base64" to "AA=="
            )
        }
    ) {
        val port = freePort()
        val pairedClients = LinkedBlockingQueue<String>()
        val events = LinkedBlockingQueue<String>()
        val server = PairingWebSocketServer(
            port,
            isPairingCodeValid,
            snapshot,
            { pairedClients.add(it) },
            { events.add(it) },
            { mapOf("width" to 1080, "height" to 2400, "density" to 420) },
            { mapOf("packageName" to "com.example", "activity" to ".Main") },
            { maxDepth -> mapOf("text" to "Root", "maxDepth" to maxDepth) },
            { _, _ -> },
            { _, _, _, _, _ -> },
            gesture,
            text,
            { _ -> },
            {},
            {},
            launchApp,
            captureScreen
        )

        try {
            server.start()
            waitForServer(events)
            test(port, pairedClients, server)
        } finally {
            server.stop(1000)
        }
    }

    private fun waitForServer(events: LinkedBlockingQueue<String>) {
        val event = events.poll(2, TimeUnit.SECONDS)
            ?: error("server did not start")
        assertTrue(event.contains("websocket server listening"))
    }

    private fun freePort(): Int {
        ServerSocket(0).use { socket ->
            return socket.localPort
        }
    }
}

private class TestClient(uri: URI) : WebSocketClient(uri), AutoCloseable {
    private val messages = LinkedBlockingQueue<String>()

    override fun onOpen(handshakedata: ServerHandshake?) = Unit

    override fun onMessage(message: String) {
        messages.add(message)
    }

    override fun onClose(code: Int, reason: String?, remote: Boolean) = Unit

    override fun onError(ex: Exception?) = Unit

    fun nextJson(): JSONObject {
        val message = messages.poll(2, TimeUnit.SECONDS)
            ?: error("timed out waiting for websocket message")
        return JSONObject(message)
    }

    fun sendJson(vararg entries: Pair<String, Any>) {
        val json = JSONObject()
        for ((key, value) in entries) {
            json.put(key, value)
        }
        send(json.toString())
    }

    override fun close() {
        if (isOpen) closeBlocking()
    }
}
