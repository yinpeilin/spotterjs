# Keep the companion service classes reachable from Android manifests and
# foreground/accessibility service lifecycle entry points.
-keep class com.spotterjs.mobilecompanion.MainActivity { *; }
-keep class com.spotterjs.mobilecompanion.MobileCompanionService { *; }
-keep class com.spotterjs.mobilecompanion.SpotterAccessibilityService { *; }

# Java-WebSocket is driven through its public API from Kotlin. R8 can shrink
# unused internals, but the public endpoint classes should keep stable names for
# stack traces and reflection-safe callbacks.
-keep class org.java_websocket.server.WebSocketServer { *; }
-keep class org.java_websocket.WebSocket { *; }
-keep class org.java_websocket.handshake.** { *; }
