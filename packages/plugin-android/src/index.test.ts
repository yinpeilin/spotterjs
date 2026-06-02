import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { android, AndroidCompanionError } from "./index";

type Json = Record<string, unknown>;

describe("android companion websocket client", () => {
  let server: WebSocketServer;
  let url: string;
  let received: Json[];

  beforeEach(async () => {
    received = [];
    server = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("test websocket server did not expose a port");
    }
    url = `ws://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const client of server.clients) {
      client.terminate();
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("pairs, heartbeats, and reads status with the returned session token", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "hello", protocolVersion: 2, requires: "pair" }));
      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as Json;
        received.push(message);
        if (message.type === "pair") {
          socket.send(
            JSON.stringify({
              type: "paired",
              protocolVersion: 2,
              sessionToken: "token-1",
              state: { capabilities: { accessibilityTree: true } },
            })
          );
        }
        if (message.type === "heartbeat") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
        if (message.type === "status") {
          socket.send(JSON.stringify({ type: "status", state: { running: true } }));
        }
      });
    });

    const device = await android.pair({
      url,
      code: "123456",
      clientId: "desktop-dev",
    });

    expect(device.sessionToken).toBe("token-1");
    expect(received[0]).toEqual({
      type: "pair",
      protocolVersion: 2,
      clientId: "desktop-dev",
      code: "123456",
    });

    await device.heartbeat();
    expect(received[1]).toEqual({
      type: "heartbeat",
      sessionToken: "token-1",
    });

    const status = await device.status();
    expect(received[2]).toEqual({
      type: "status",
      sessionToken: "token-1",
    });
    expect(status).toEqual({ running: true });

    device.close();
  });

  it("sends authenticated automation commands and unwraps result payloads", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "hello", protocolVersion: 2, requires: "pair" }));
      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as Json;
        received.push(message);
        if (message.type === "pair") {
          socket.send(
            JSON.stringify({
              type: "paired",
              protocolVersion: 2,
              sessionToken: "token-2",
              state: {},
            })
          );
          return;
        }
        if (message.type === "dumpTree") {
          socket.send(
            JSON.stringify({
              type: "tree",
              tree: {
                text: "Search",
                resourceId: "id/search",
                className: "android.widget.TextView",
                packageName: "com.example",
                contentDescription: "",
                clickable: true,
                enabled: true,
                checked: false,
                selected: false,
                scrollable: false,
                focusable: true,
                bounds: { left: 10, top: 20, width: 100, height: 40 },
                center: { x: 60, y: 40 },
                children: [],
                depth: 0,
                path: "0",
              },
            })
          );
          return;
        }
        if (message.type === "displayInfo") {
          socket.send(JSON.stringify({ type: "displayInfo", width: 1080, height: 2400, density: 420 }));
          return;
        }
        if (message.type === "currentApp") {
          socket.send(JSON.stringify({ type: "currentApp", packageName: "com.example", activity: ".Main" }));
          return;
        }
        socket.send(JSON.stringify({ type: "ok" }));
      });
    });

    const device = await android.pair({ url, code: "123456" });

    await device.tap(1, 2);
    await device.swipe({ x: 1, y: 2 }, { x: 3, y: 4 }, { durationMs: 250 });
    await device.gesture([
      {
        points: [
          { x: 10, y: 20 },
          { x: 12, y: 22 },
        ],
        durationMs: 300,
      },
    ]);
    await device.text("hello");
    await device.keyevent("BACK");
    const tree = await device.dumpTree({ maxDepth: 4 });
    const display = await device.getDisplayInfo();
    const app = await device.currentApp();

    expect(received.slice(1)).toEqual([
      { type: "tap", sessionToken: "token-2", x: 1, y: 2 },
      {
        type: "swipe",
        sessionToken: "token-2",
        from: { x: 1, y: 2 },
        to: { x: 3, y: 4 },
        durationMs: 250,
      },
      {
        type: "gesture",
        sessionToken: "token-2",
        strokes: [
          {
            points: [
              { x: 10, y: 20 },
              { x: 12, y: 22 },
            ],
            durationMs: 300,
          },
        ],
      },
      { type: "text", sessionToken: "token-2", text: "hello" },
      { type: "keyevent", sessionToken: "token-2", key: "BACK" },
      { type: "dumpTree", sessionToken: "token-2", maxDepth: 4 },
      { type: "displayInfo", sessionToken: "token-2" },
      { type: "currentApp", sessionToken: "token-2" },
    ]);
    expect(tree.text).toBe("Search");
    expect(display).toEqual({ width: 1080, height: 2400, density: 420 });
    expect(app).toEqual({ packageName: "com.example", activity: ".Main" });

    device.close();
  });

  it("launches apps with the authenticated session token", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "hello", protocolVersion: 2, requires: "pair" }));
      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as Json;
        received.push(message);
        if (message.type === "pair") {
          socket.send(
            JSON.stringify({
              type: "paired",
              protocolVersion: 2,
              sessionToken: "token-launch",
              state: {},
            })
          );
          return;
        }
        if (message.type === "launchApp") {
          socket.send(
            JSON.stringify({
              type: "appLaunched",
              packageName: "com.android.settings",
              activity: "com.android.settings.Settings",
            })
          );
        }
      });
    });

    const device = await android.pair({ url, code: "123456" });
    const app = await device.launchApp("com.android.settings");

    expect(received.slice(1)).toEqual([
      {
        type: "launchApp",
        sessionToken: "token-launch",
        packageName: "com.android.settings",
      },
    ]);
    expect(app).toEqual({
      packageName: "com.android.settings",
      activity: "com.android.settings.Settings",
    });

    device.close();
  });

  it("throws structured errors for companion error frames", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "hello", protocolVersion: 2, requires: "pair" }));
      socket.on("message", () => {
        socket.send(
          JSON.stringify({
            type: "error",
            code: "PAIRING_CODE_INVALID",
            message: "pairing code is invalid",
          })
        );
      });
    });

    await expect(android.pair({ url, code: "000000" })).rejects.toMatchObject({
      name: "AndroidCompanionError",
      code: "PAIRING_CODE_INVALID",
      message: "pairing code is invalid",
    });
  });

  it("connects with an existing session token without pairing", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "hello", protocolVersion: 2, requires: "session" }));
      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as Json;
        received.push(message);
        socket.send(JSON.stringify({ type: "pong" }));
      });
    });

    const device = await android.connect({
      url,
      sessionToken: "existing-token",
    });

    await device.heartbeat();

    expect(received).toEqual([
      { type: "heartbeat", sessionToken: "existing-token" },
    ]);

    device.close();
  });

  it("rejects non-object JSON companion frames as invalid messages", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify(["hello"]));
    });

    await expect(android.pair({ url, code: "123456" })).rejects.toMatchObject({
      name: "AndroidCompanionError",
      code: "ANDROID_COMPANION_INVALID_MESSAGE",
    });
  });

  it("rejects unexpected response types during queued commands", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "hello", protocolVersion: 2, requires: "pair" }));
      socket.on("message", (raw) => {
        const message = JSON.parse(String(raw)) as Json;
        received.push(message);
        if (message.type === "pair") {
          socket.send(
            JSON.stringify({
              type: "paired",
              protocolVersion: 2,
              sessionToken: "token-3",
              state: {},
            })
          );
          return;
        }
        socket.send(JSON.stringify({ type: "status", state: {} }));
      });
    });

    const device = await android.pair({ url, code: "123456" });

    await expect(device.heartbeat()).rejects.toMatchObject({
      name: "AndroidCompanionError",
      code: "ANDROID_COMPANION_INVALID_MESSAGE",
      context: { responseType: "status" },
    });

    device.close();
  });

  it("times out when a response does not arrive", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "hello", protocolVersion: 2, requires: "pair" }));
    });

    await expect(
      android.pair({ url, code: "123456", timeoutMs: 25 })
    ).rejects.toMatchObject({
      name: "AndroidCompanionError",
      code: "ANDROID_COMPANION_TIMEOUT",
    });
  });

  it("rejects v1 hello frames as unsupported protocol", async () => {
    server.on("connection", (socket) => {
      socket.send(JSON.stringify({ type: "hello", protocolVersion: 1, requires: "pair" }));
    });

    await expect(android.pair({ url, code: "123456" })).rejects.toMatchObject({
      name: "AndroidCompanionError",
      code: "ANDROID_COMPANION_INVALID_MESSAGE",
    });
  });
});
