/* eslint-disable @typescript-eslint/no-var-requires */
export type NativeSpotter = {
  version(): string;
  getScreenSize(): { width: number; height: number };
  getScreenWidth(): number;
  getScreenHeight(): number;
  captureScreen(region?: {
    left: number;
    top: number;
    width: number;
    height: number;
  }): { data: Buffer; width: number; height: number };
  captureWindow(id: string): { data: Buffer; width: number; height: number };
  findTemplate(path: string, opts?: unknown): {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  findTemplateInWindow(
    windowId: string,
    path: string,
    opts?: unknown
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  findAllTemplatesInWindow(
    windowId: string,
    path: string,
    opts?: unknown
  ): Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
  findAllTemplates(path: string, opts?: unknown): Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
  waitForTemplate(
    path: string,
    timeoutMs: number,
    opts?: unknown,
    intervalMs?: number
  ): { left: number; top: number; width: number; height: number };
  listWindows(): Array<{
    id: string;
    idHex: string;
    title: string;
    region: { left: number; top: number; width: number; height: number };
  }>;
  getActiveWindow(): {
    id: string;
    idHex: string;
    title: string;
    region: { left: number; top: number; width: number; height: number };
  };
  focusWindow(id: string): boolean;
  getWindowRegion(id: string): {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  getWindowClientOrigin(id: string): { x: number; y: number };
  restoreWindow(id: string): void;
  getPosition(): { x: number; y: number };
  mouseMove(x: number, y: number): void;
  mouseClick(button?: string): void;
  tapAt(x: number, y: number, button?: string): void;
  keyboardTypeText(text: string): void;
  keyboardPressKeys(keys: string[]): void;
  keyboardShortcut(keys: string[]): void;
  clipboardSet(text: string): void;
  clipboardGet(): string;
  accessibilityEnable(config?: {
    attachDelayMs?: number;
    eventSubscription?: boolean;
    treeWaitTimeoutMs?: number;
    treeWaitPollMs?: number;
    minListItemCount?: number;
  }): void;
  accessibilityDisable(): void;
  accessibilityIsEnabled(): boolean;
  accessibilityAttachWindow(windowId: string): string;
  accessibilityAttachWindowReport(
    windowId: string,
    maxDepth?: number
  ): {
    elementId: string;
    clientMode: boolean;
    eventHandlerRegistered: boolean;
    structureChangedEvents: number;
    healthInitial: {
      maxDepth: number;
      totalNodes: number;
      listItemCount: number;
      editCount: number;
      buttonCount: number;
      controlTypeCounts: Record<string, number>;
    };
    healthFinal: {
      maxDepth: number;
      totalNodes: number;
      listItemCount: number;
      editCount: number;
      buttonCount: number;
      controlTypeCounts: Record<string, number>;
    };
    treeWaitMs: number;
  };
  accessibilityAttachActive(): string;
  accessibilityFind(
    rootId: string,
    query: {
      name?: string;
      nameContains?: string;
      controlType?: string;
      automationId?: string;
      matchMode?: string;
    },
    maxDepth?: number
  ): string;
  accessibilityWaitFor(
    rootId: string,
    query: {
      name?: string;
      nameContains?: string;
      controlType?: string;
      automationId?: string;
      matchMode?: string;
    },
    timeoutMs: number,
    maxDepth?: number,
    pollMs?: number
  ): string;
  accessibilityGetBounds(elementId: string): {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  accessibilityInvoke(elementId: string): void;
  accessibilitySetValue(elementId: string, text: string): void;
  accessibilityDumpTree(rootId: string, maxDepth?: number): string;
  accessibilityTreeHealth(
    rootId: string,
    maxDepth?: number
  ): {
    maxDepth: number;
    totalNodes: number;
    listItemCount: number;
    editCount: number;
    buttonCount: number;
    controlTypeCounts: Record<string, number>;
  };
  accessibilityCheckTreeHealth(
    rootId: string,
    maxDepth: number | undefined,
    minListItems: number
  ): {
    maxDepth: number;
    totalNodes: number;
    listItemCount: number;
    editCount: number;
    buttonCount: number;
    controlTypeCounts: Record<string, number>;
  };
};

let _native: NativeSpotter | null = null;

export function loadNative(): NativeSpotter {
  if (!_native) {
    _native = require("@spotter-rs/node") as NativeSpotter;
  }
  return _native;
}
