package com.spotterjs.mobilecompanion

import android.util.Base64
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.InetSocketAddress
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

class PairingWebSocketServer(
    port: Int,
    private val isPairingCodeValid: (String) -> Boolean,
    private val snapshot: () -> Map<String, Any?>,
    private val onPaired: (String) -> Unit,
    private val onEvent: (String) -> Unit,
    private val displayInfo: () -> Map<String, Any?>,
    private val currentApp: () -> Map<String, Any?>,
    private val dumpTree: (Int?) -> Map<String, Any?>,
    private val tap: (Int, Int) -> Unit,
    private val swipe: (Int, Int, Int, Int, Int?) -> Unit,
    private val gesture: (List<GestureStrokeSpec>) -> Unit,
    private val text: (String) -> Unit,
    private val keyevent: (String) -> Unit,
    private val back: () -> Unit,
    private val home: () -> Unit
) : WebSocketServer(InetSocketAddress("0.0.0.0", port)) {
    private val random = SecureRandom()
    private val sessions = ConcurrentHashMap<WebSocket, String>()

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        conn.send(
            json(
                "type" to "hello",
                "protocolVersion" to COMPANION_PROTOCOL_VERSION,
                "requires" to "pair"
            ).toString()
        )
        onEvent("websocket opened from ${conn.remoteSocketAddress.hostString}")
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        sessions.remove(conn)
        onEvent("websocket closed: ${reason.ifBlank { code.toString() }}")
    }

    override fun onMessage(conn: WebSocket, message: String) {
        try {
            val request = try {
                JSONObject(message)
            } catch (error: Throwable) {
                conn.send(error("INVALID_JSON", "message must be JSON").toString())
                return
            }

            when (request.optString("type")) {
                "pair" -> pair(conn, request)
                "heartbeat" -> authenticated(conn, request) {
                    conn.send(json("type" to "pong").toString())
                }
                "status" -> authenticated(conn, request) {
                    conn.send(json("type" to "status", "state" to snapshot()).toString())
                }
                "displayInfo" -> authenticated(conn, request) {
                    conn.send(json("type" to "displayInfo", *displayInfo().toPairs()).toString())
                }
                "currentApp" -> authenticated(conn, request) {
                    conn.send(json("type" to "currentApp", *currentApp().toPairs()).toString())
                }
                "dumpTree" -> authenticated(conn, request) {
                    conn.send(
                        json(
                            "type" to "tree",
                            "tree" to dumpTree(optionalInt(request, "maxDepth"))
                        ).toString()
                    )
                }
                "tap" -> authenticated(conn, request) {
                    val point = point(request, "x", "y")
                    tap(point.first, point.second)
                    conn.send(json("type" to "ok").toString())
                }
                "swipe" -> authenticated(conn, request) {
                    val from = point(request.optJSONObject("from"), "from")
                    val to = point(request.optJSONObject("to"), "to")
                    swipe(
                        from.first,
                        from.second,
                        to.first,
                        to.second,
                        optionalInt(request, "durationMs")
                    )
                    conn.send(json("type" to "ok").toString())
                }
                "gesture" -> authenticated(conn, request) {
                    gesture(readGestures(request))
                    conn.send(json("type" to "ok").toString())
                }
                "text" -> authenticated(conn, request) {
                    text(request.optString("text"))
                    conn.send(json("type" to "ok").toString())
                }
                "keyevent" -> authenticated(conn, request) {
                    keyevent(request.optString("key"))
                    conn.send(json("type" to "ok").toString())
                }
                "back" -> authenticated(conn, request) {
                    back()
                    conn.send(json("type" to "ok").toString())
                }
                "home" -> authenticated(conn, request) {
                    home()
                    conn.send(json("type" to "ok").toString())
                }
                else -> conn.send(error("UNKNOWN_MESSAGE", "unsupported message type").toString())
            }
        } catch (error: Throwable) {
            conn.send(
                error(
                    "COMMAND_FAILED",
                    error.message ?: error.javaClass.simpleName
                ).toString()
            )
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        onEvent("websocket error: ${ex.message ?: ex.javaClass.simpleName}")
    }

    override fun onStart() {
        onEvent("websocket server listening on $address")
    }

    private fun pair(conn: WebSocket, request: JSONObject) {
        val protocolVersion = optionalInt(request, "protocolVersion")
        if (protocolVersion != COMPANION_PROTOCOL_VERSION) {
            conn.send(
                error(
                    "PROTOCOL_VERSION_UNSUPPORTED",
                    "protocol version $protocolVersion is not supported"
                ).toString()
            )
            conn.close(1002, "unsupported protocol version")
            return
        }
        val code = request.optString("code")
        if (!isPairingCodeValid(code)) {
            conn.send(error("PAIRING_CODE_INVALID", "pairing code is invalid").toString())
            conn.close(1008, "invalid pairing code")
            return
        }

        val token = sessionToken()
        sessions[conn] = token
        val clientId = request.optString("clientId", conn.remoteSocketAddress.hostString)
        onPaired(clientId)
        conn.send(
            json(
                "type" to "paired",
                "protocolVersion" to COMPANION_PROTOCOL_VERSION,
                "sessionToken" to token,
                "state" to snapshot()
            ).toString()
        )
    }

    private fun authenticated(
        conn: WebSocket,
        request: JSONObject,
        action: () -> Unit
    ) {
        val token = request.optString("sessionToken")
        if (sessions[conn] != token) {
            conn.send(error("SESSION_UNAUTHORIZED", "message requires a valid sessionToken").toString())
            return
        }
        action()
    }

    private fun sessionToken(): String {
        val bytes = ByteArray(24)
        random.nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
}

private fun error(code: String, message: String): JSONObject {
    return json("type" to "error", "code" to code, "message" to message)
}

private fun json(vararg entries: Pair<String, Any?>): JSONObject {
    val out = JSONObject()
    for ((key, value) in entries) {
        out.put(key, value.toJsonValue())
    }
    return out
}

private fun Any?.toJsonValue(): Any? {
    return when (this) {
        null -> JSONObject.NULL
        is Map<*, *> -> {
            val out = JSONObject()
            for ((key, value) in this) {
                out.put(key.toString(), value.toJsonValue())
            }
            out
        }
        is Iterable<*> -> {
            org.json.JSONArray().also { array ->
                for (item in this) array.put(item.toJsonValue())
            }
        }
        else -> this
    }
}

private fun Map<String, Any?>.toPairs(): Array<Pair<String, Any?>> {
    return entries.map { it.key to it.value }.toTypedArray()
}

private fun point(node: JSONObject?, label: String): Pair<Int, Int> {
    if (node == null) {
        throw IllegalArgumentException("$label must be an object")
    }
    return point(node, "$label.x", "$label.y")
}

private fun point(node: JSONObject, xKey: String, yKey: String): Pair<Int, Int> {
    return readInt(node, xKey) to readInt(node, yKey)
}

private fun readGestures(request: JSONObject): List<GestureStrokeSpec> {
    val strokes = request.optJSONArray("strokes")
        ?: throw IllegalArgumentException("strokes must be an array")
    if (strokes.length() == 0) {
        throw IllegalArgumentException("strokes must contain at least one stroke")
    }
    return buildList {
        for (index in 0 until strokes.length()) {
            val stroke = strokes.optJSONObject(index)
                ?: throw IllegalArgumentException("strokes[$index] must be an object")
            add(readStroke(stroke, index))
        }
    }
}

private fun readStroke(stroke: JSONObject, index: Int): GestureStrokeSpec {
    val pointsArray = stroke.optJSONArray("points")
        ?: throw IllegalArgumentException("strokes[$index].points must be an array")
    if (pointsArray.length() == 0) {
        throw IllegalArgumentException("strokes[$index].points must contain at least one point")
    }
    val points = buildList {
        for (pointIndex in 0 until pointsArray.length()) {
            val point = pointsArray.optJSONObject(pointIndex)
                ?: throw IllegalArgumentException("strokes[$index].points[$pointIndex] must be an object")
            add(
                GesturePointSpec(
                    x = readInt(point, "x"),
                    y = readInt(point, "y")
                )
            )
        }
    }
    return GestureStrokeSpec(
        points = points,
        durationMs = optionalLong(stroke, "durationMs") ?: 300L,
        startDelayMs = optionalLong(stroke, "startDelayMs") ?: 0L
    )
}

private fun optionalInt(node: JSONObject, key: String): Int? {
    if (!node.has(key) || node.isNull(key)) return null
    return readInt(node, key)
}

private fun optionalLong(node: JSONObject, key: String): Long? {
    if (!node.has(key) || node.isNull(key)) return null
    val value = node.opt(key)
    return when (value) {
        is Long -> value
        is Int -> value.toLong()
        is Double -> {
            if (value.isNaN() || value.isInfinite() || value % 1.0 != 0.0) {
                throw IllegalArgumentException("$key must be an integer")
            }
            value.toLong()
        }
        is Number -> value.toLong()
        else -> throw IllegalArgumentException("$key must be an integer")
    }
}

private fun readInt(node: JSONObject, key: String): Int {
    val value = node.opt(key)
    return when (value) {
        is Int -> value
        is Long -> value.toInt()
        is Double -> {
            if (value.isNaN() || value.isInfinite() || value % 1.0 != 0.0) {
                throw IllegalArgumentException("$key must be an integer")
            }
            value.toInt()
        }
        is Number -> value.toInt()
        else -> throw IllegalArgumentException("$key must be an integer")
    }
}
