import {
  loadNative,
  type NativeAttachReport,
  type NativeElementInfo,
  type NativeTreeHealth,
  type NativeTreeNodeDump,
} from "./native";
import { centerOf, type Region } from "@spotterjs/base";
import { callNative } from "./errors";

/** Accessibility tree view mode. */
export type TreeViewMode = "auto" | "raw" | "control" | "content";

/**
 * Query fields for accessibility tree elements.
 *
 * Windows uses UIA and Linux uses AT-SPI. Fields are combined with AND logic.
 */
export type A11yQuery = {
  /** Accessible name. Matching behavior is controlled by `match`. */
  name?: string;
  /** Convenience substring query for accessible name. */
  nameContains?: string;
  /** Platform control type, such as `"Button"` or `"ListItem"`. */
  controlType?: string;
  /** UIA AutomationId or platform-equivalent stable identifier. */
  automationId?: string;
  /** Name matching mode. Defaults to `"exact"`. */
  match?: "exact" | "contains";
};

/**
 * Accessibility subsystem options.
 *
 * Applied by {@link accessibility.enable}. These settings affect attach
 * timing and tree expansion behavior.
 */
export type A11yConfig = {
  /** Fixed delay after attaching, in milliseconds. */
  attachDelayMs?: number;
  /** Subscribe to structure-change events where supported. */
  eventSubscription?: boolean;
  /** Maximum wait for tree expansion, in milliseconds. */
  treeWaitTimeoutMs?: number;
  treeWaitPollMs?: number;
  /** Minimum `ListItem` count used by tree health checks. */
  minListItemCount?: number;
  /** Tree walker mode. `auto` lets the native layer pick a platform default. */
  treeView?: TreeViewMode;
};

export type TreeDumpOptions = {
  maxDepth?: number;
  treeView?: TreeViewMode;
};

/** Accessibility tree health report from the native layer. */
export type TreeHealth = NativeTreeHealth;

/** Attach report with candidate window and tree diagnostics. */
export type AttachReport = NativeAttachReport;

/** Metadata for a single accessibility element. */
export type ElementInfo = NativeElementInfo;

/** Structured accessibility tree node. */
export type TreeNodeDump = NativeTreeNodeDump;

function queryToNative(q: A11yQuery) {
  return {
    name: q.name,
    nameContains: q.nameContains,
    controlType: q.controlType,
    automationId: q.automationId,
    matchMode: q.match ?? "exact",
  };
}

function configToNative(config?: A11yConfig) {
  if (!config) return undefined;
  return {
    attachDelayMs: config.attachDelayMs,
    eventSubscription: config.eventSubscription,
    treeWaitTimeoutMs: config.treeWaitTimeoutMs,
    treeWaitPollMs: config.treeWaitPollMs,
    minListItemCount: config.minListItemCount,
    treeView: config.treeView,
  };
}

function healthFromNative(h: NativeTreeHealth): TreeHealth {
  return h;
}

function attachReportFromNative(r: NativeAttachReport): AttachReport {
  return r;
}

const accessibilityBase = {
  /**
   * Enable the accessibility bridge.
   *
   * Calling this again updates the configuration.
   */
  enable(config?: A11yConfig): void {
    callNative("accessibility.enable", { config }, () =>
      loadNative().accessibilityEnable(configToNative(config))
    );
  },

  /** Release accessibility resources. */
  disable(): void {
    callNative("accessibility.disable", {}, () =>
      loadNative().accessibilityDisable()
    );
  },

  isEnabled(): boolean {
    return callNative("accessibility.isEnabled", {}, () =>
      loadNative().accessibilityIsEnabled()
    );
  },

  /**
   * Attach a window and return the root element ID.
   * @param windowId {@link WindowInfo.id}
   */
  attachWindow(windowId: string): string {
    return callNative("accessibility.attachWindow", { windowId }, () =>
      loadNative().accessibilityAttachWindow(windowId)
    );
  },

  /**
   * Attach a window and return diagnostics for tree expansion and candidates.
   * @returns Tree health, selected element ID, and diagnostic metadata.
   */
  attachWindowReport(windowId: string, maxDepth = 12): AttachReport {
    const r = callNative(
      "accessibility.attachWindowReport",
      { windowId, maxDepth },
      () => loadNative().accessibilityAttachWindowReport(windowId, maxDepth)
    );
    return attachReportFromNative(r);
  },

  /** Attach the current foreground window and return the root element ID. */
  attachActive(): string {
    return callNative("accessibility.attachActive", {}, () =>
      loadNative().accessibilityAttachActive()
    );
  },

  /**
   * Find the first matching element inside a subtree.
   * @param rootId Root element ID, usually returned by an attach call.
   * @returns Element ID.
   * @throws When no element matches the query.
   */
  find(rootId: string, query: A11yQuery, maxDepth = 12): string {
    return callNative("accessibility.find", { rootId, query, maxDepth }, () =>
      loadNative().accessibilityFind(rootId, queryToNative(query), maxDepth)
    );
  },

  /**
   * Poll until a matching element appears.
   * @throws When the timeout expires.
   */
  waitFor(
    rootId: string,
    query: A11yQuery,
    timeoutMs: number,
    opts?: { maxDepth?: number; pollMs?: number }
  ): string {
    return callNative(
      "accessibility.waitFor",
      { rootId, query, timeoutMs, ...opts },
      () =>
        loadNative().accessibilityWaitFor(
          rootId,
          queryToNative(query),
          timeoutMs,
          opts?.maxDepth ?? 12,
          opts?.pollMs ?? 200
        )
    );
  },

  /** Return element bounds in screen coordinates. */
  getBounds(elementId: string): Region {
    return callNative("accessibility.getBounds", { elementId }, () =>
      loadNative().accessibilityGetBounds(elementId)
    );
  },

  /** Return metadata for one element without dumping the whole tree. */
  getElementInfo(elementId: string): ElementInfo {
    return callNative("accessibility.getElementInfo", { elementId }, () =>
      loadNative().accessibilityGetElementInfo(elementId)
    );
  },

  /** Refresh the root reference after UI changes. */
  refreshRoot(elementId: string): void {
    callNative("accessibility.refreshRoot", { elementId }, () =>
      loadNative().accessibilityRefreshRoot(elementId)
    );
  },

  /** Invoke the element, typically for buttons and menu items. */
  invoke(elementId: string): void {
    callNative("accessibility.invoke", { elementId }, () =>
      loadNative().accessibilityInvoke(elementId)
    );
  },

  /** Set element value text where the native accessibility provider supports it. */
  setValue(elementId: string, text: string): void {
    callNative("accessibility.setValue", { elementId }, () =>
      loadNative().accessibilitySetValue(elementId, text)
    );
  },

  /** Dump a subtree as a JSON string for diagnostics. */
  dumpTree(rootId: string, maxDepthOrOpts: number | TreeDumpOptions = 12): string {
    const opts =
      typeof maxDepthOrOpts === "number"
        ? { maxDepth: maxDepthOrOpts }
        : maxDepthOrOpts;
    return callNative(
      "accessibility.dumpTree",
      { rootId, maxDepth: opts.maxDepth ?? 12, treeView: opts.treeView },
      () =>
        loadNative().accessibilityDumpTree(
          rootId,
          opts.maxDepth ?? 12,
          opts.treeView
        )
    );
  },

  /** Dump a subtree as a structured object. */
  dumpTreeObject(
    rootId: string,
    maxDepthOrOpts: number | TreeDumpOptions = 12
  ): TreeNodeDump {
    const opts =
      typeof maxDepthOrOpts === "number"
        ? { maxDepth: maxDepthOrOpts }
        : maxDepthOrOpts;
    return callNative(
      "accessibility.dumpTreeObject",
      { rootId, maxDepth: opts.maxDepth ?? 12, treeView: opts.treeView },
      () =>
        loadNative().accessibilityDumpTreeObject(
          rootId,
          opts.maxDepth ?? 12,
          opts.treeView
        )
    );
  },

  /** Return node counts and other tree health metrics. */
  treeHealth(
    rootId: string,
    maxDepth = 12,
    treeView?: TreeViewMode
  ): TreeHealth {
    const h = callNative(
      "accessibility.treeHealth",
      { rootId, maxDepth, treeView },
      () => loadNative().accessibilityTreeHealth(rootId, maxDepth, treeView)
    );
    return healthFromNative(h);
  },

  /**
   * Check whether a tree reaches minimum health thresholds.
   *
   * Commonly used to decide whether a UIA tree has expanded enough for queries.
   */
  checkTreeHealth(
    rootId: string,
    minListItems: number,
    maxDepth = 12
  ): TreeHealth {
    const h = callNative(
      "accessibility.checkTreeHealth",
      { rootId, minListItems, maxDepth },
      () =>
        loadNative().accessibilityCheckTreeHealth(
          rootId,
          maxDepth,
          minListItems
        )
    );
    return healthFromNative(h);
  },
};

/**
 * High-level accessibility automation API.
 *
 * Typical flow: `accessibility.enable()` -> `accessibility.attach()` ->
 * `accessibility.find()` -> `accessibility.click()` or `accessibility.invoke()`.
 * Diagnostics live under `accessibility.debug`.
 */
export type A11yApi = {
  enable(config?: A11yConfig): void;
  attach(windowId: string): string;
  find(rootId: string, query: A11yQuery, maxDepth?: number): string;
  waitFor(
    rootId: string,
    query: A11yQuery,
    timeoutMs: number,
    opts?: { maxDepth?: number; pollMs?: number }
  ): string;
  click(elementId: string): Region;
  typeText(elementId: string, text: string): void;
  invoke(elementId: string): void;
  findAndClick(rootId: string, query: A11yQuery, maxDepth?: number): string;
  attachAndFind(
    windowId: string,
    query: A11yQuery,
    maxDepth?: number
  ): { rootId: string; elementId: string };
  debug: A11yDebugApi;
};

/**
 * Accessibility diagnostics API.
 *
 * Use this when `accessibility.find()` misses an element or the UIA / AT-SPI
 * tree is incomplete.
 */
export type A11yDebugApi = {
  attachWindowReport(windowId: string, maxDepth?: number): AttachReport;
  dumpTree(rootId: string, maxDepthOrOpts?: number | TreeDumpOptions): string;
  dumpTreeObject(
    rootId: string,
    maxDepthOrOpts?: number | TreeDumpOptions
  ): TreeNodeDump;
  treeHealth(
    rootId: string,
    maxDepth?: number,
    treeView?: TreeViewMode
  ): TreeHealth;
  checkTreeHealth(
    rootId: string,
    minListItems: number,
    maxDepth?: number
  ): TreeHealth;
  getElementInfo(elementId: string): ElementInfo;
  refreshRoot(elementId: string): void;
};

function clickElement(elementId: string): Region {
  const region = accessibilityBase.getBounds(elementId);
  const { x, y } = centerOf(region);
  callNative("accessibility.click", { elementId, x, y }, () =>
    loadNative().tapAt(x, y)
  );
  return region;
}

export const accessibility: A11yApi = {
  enable: accessibilityBase.enable,

  attach(windowId: string): string {
    return accessibilityBase.attachWindow(windowId);
  },

  find: accessibilityBase.find,
  waitFor: accessibilityBase.waitFor,

  click(elementId: string): Region {
    return clickElement(elementId);
  },

  typeText(elementId: string, text: string): void {
    accessibilityBase.setValue(elementId, text);
  },

  invoke: accessibilityBase.invoke,

  findAndClick(rootId: string, query: A11yQuery, maxDepth = 12): string {
    const elementId = accessibilityBase.find(rootId, query, maxDepth);
    clickElement(elementId);
    return elementId;
  },

  attachAndFind(
    windowId: string,
    query: A11yQuery,
    maxDepth = 12
  ): { rootId: string; elementId: string } {
    const report = accessibilityBase.attachWindowReport(windowId, maxDepth);
    const elementId = accessibilityBase.find(report.elementId, query, maxDepth);
    return { rootId: report.elementId, elementId };
  },

  debug: {
    attachWindowReport: accessibilityBase.attachWindowReport,
    dumpTree: accessibilityBase.dumpTree,
    dumpTreeObject: accessibilityBase.dumpTreeObject,
    treeHealth: accessibilityBase.treeHealth,
    checkTreeHealth: accessibilityBase.checkTreeHealth,
    getElementInfo: accessibilityBase.getElementInfo,
    refreshRoot: accessibilityBase.refreshRoot,
  },
};
