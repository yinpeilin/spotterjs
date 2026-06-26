import { callNative } from "./errors";
import { loadNative } from "./native";

export type InputEvent =
  | { type: "mouseMove"; x: number; y: number; tMs: number }
  | {
      type: "mouseButton";
      button: string;
      pressed: boolean;
      x: number;
      y: number;
      tMs: number;
    }
  | { type: "wheel"; dx: number; dy: number; tMs: number }
  | { type: "key"; key: string; pressed: boolean; tMs: number };

export type EventSubscription = {
  stop(): void;
};

export type HotkeyRegistration = {
  unregister(): void;
};

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const events = {
  on(handler: (event: InputEvent) => void): EventSubscription {
    callNative("events.on", {}, () =>
      loadNative().startInputListener((json: string) => {
        handler(JSON.parse(json) as InputEvent);
      })
    );
    return {
      stop() {
        callNative("events.stop", {}, () => loadNative().stopInputListener());
      },
    };
  },

  registerHotkey(keys: string[], handler: () => void): HotkeyRegistration {
    const id = randomId("hotkey");
    callNative("events.registerHotkey", { id, keys }, () =>
      loadNative().registerHotkey(id, keys, () => handler())
    );
    return {
      unregister() {
        callNative("events.unregisterHotkey", { id }, () =>
          loadNative().unregisterHotkey(id)
        );
      },
    };
  },
};
