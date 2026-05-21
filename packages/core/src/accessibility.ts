import {
  loadNative,
  type NativeAttachReport,
  type NativeTreeHealth,
} from "./native";
import type { Region } from "@spotter/base";

export type A11yQuery = {
  name?: string;
  nameContains?: string;
  controlType?: string;
  automationId?: string;
  match?: "exact" | "contains";
};

export type A11yConfig = {
  attachDelayMs?: number;
  /** Register StructureChanged handler (WeChat 4.1+ UIA client mode). */
  eventSubscription?: boolean;
  treeWaitTimeoutMs?: number;
  treeWaitPollMs?: number;
  minListItemCount?: number;
};

/** @see {@link NativeTreeHealth} — N-API shape from `@spotter-rs/node` */
export type TreeHealth = NativeTreeHealth;

/** @see {@link NativeAttachReport} — N-API shape from `@spotter-rs/node` */
export type AttachReport = NativeAttachReport;

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
  };
}

function healthFromNative(h: NativeTreeHealth): TreeHealth {
  return h;
}

function attachReportFromNative(r: NativeAttachReport): AttachReport {
  return r;
}

import { extendAccessibility } from "./accessibility-helpers";

const accessibilityBase = {
  enable(config?: A11yConfig): void {
    loadNative().accessibilityEnable(configToNative(config));
  },

  disable(): void {
    loadNative().accessibilityDisable();
  },

  isEnabled(): boolean {
    return loadNative().accessibilityIsEnabled();
  },

  attachWindow(windowId: string): string {
    return loadNative().accessibilityAttachWindow(windowId);
  },

  /** Attach with UIA client mode + tree expansion wait; returns before/after health. */
  attachWindowReport(windowId: string, maxDepth = 12): AttachReport {
    const r = loadNative().accessibilityAttachWindowReport(windowId, maxDepth);
    return attachReportFromNative(r);
  },

  attachActive(): string {
    return loadNative().accessibilityAttachActive();
  },

  find(rootId: string, query: A11yQuery, maxDepth = 12): string {
    return loadNative().accessibilityFind(rootId, queryToNative(query), maxDepth);
  },

  waitFor(
    rootId: string,
    query: A11yQuery,
    timeoutMs: number,
    opts?: { maxDepth?: number; pollMs?: number }
  ): string {
    return loadNative().accessibilityWaitFor(
      rootId,
      queryToNative(query),
      timeoutMs,
      opts?.maxDepth ?? 12,
      opts?.pollMs ?? 200
    );
  },

  getBounds(elementId: string): Region {
    return loadNative().accessibilityGetBounds(elementId);
  },

  invoke(elementId: string): void {
    loadNative().accessibilityInvoke(elementId);
  },

  setValue(elementId: string, text: string): void {
    loadNative().accessibilitySetValue(elementId, text);
  },

  dumpTree(rootId: string, maxDepth = 12): string {
    return loadNative().accessibilityDumpTree(rootId, maxDepth);
  },

  treeHealth(rootId: string, maxDepth = 12): TreeHealth {
    const h = loadNative().accessibilityTreeHealth(rootId, maxDepth);
    return healthFromNative(h);
  },

  checkTreeHealth(
    rootId: string,
    minListItems: number,
    maxDepth = 12
  ): TreeHealth {
    const h = loadNative().accessibilityCheckTreeHealth(
      rootId,
      maxDepth,
      minListItems
    );
    return healthFromNative(h);
  },
};

export const accessibility = extendAccessibility(accessibilityBase);
