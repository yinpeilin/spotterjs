package com.example.mobile_companion

import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import android.util.Base64
import java.net.InetSocketAddress
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

class PairingWebSocketServer(
    port: Int,
    private val isPairingCodeValid: (String) -> Boolean,
    private val snapshot: () -> Map<String, Any?>,
    private val onPaired: (String) -> Unit,
    private val onEvent: (String) -> Unit
) : WebSocketServer(InetSocketAddress("0.0.0.0", port)) {
    private val random = SecureRandom()
    private val sessions = ConcurrentHashMap<WebSocket, String>()

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        conn.send(
            json(
                "type" to "hello",
                "protocolVersion" to 1,
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
            else -> conn.send(error("UNKNOWN_MESSAGE", "unsupported message type").toString())
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        onEvent("websocket error: ${ex.message ?: ex.javaClass.simpleName}")
    }

    override fun onStart() {
        onEvent("websocket server listening on $address")
    }

    private fun pair(conn: WebSocket, request: JSONObject) {
        val code = request.optString("code")
        if (!isPairingCodeValid(code)) {
            conn.send(error("PAIRING_CODE_INVALID", "pairing code is invalid or expired").toString())
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
                "protocolVersion" to 1,
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
