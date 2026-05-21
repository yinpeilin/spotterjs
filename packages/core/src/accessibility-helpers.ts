import { centerOf, type Region } from "@spotter/base";
import { loadNative } from "./native";
import type {
  A11yConfig,
  A11yQuery,
  AttachReport,
  TreeHealth,
} from "./accessibility";

export type A11yApi = {
  enable(config?: A11yConfig): void;
  disable(): void;
  isEnabled(): boolean;
  attachWindow(windowId: string): string;
  attachWindowReport(windowId: string, maxDepth?: number): AttachReport;
  attachActive(): string;
  find(rootId: string, query: A11yQuery, maxDepth?: number): string;
  waitFor(
    rootId: string,
    query: A11yQuery,
    timeoutMs: number,
    opts?: { maxDepth?: number; pollMs?: number }
  ): string;
  getBounds(elementId: string): Region;
  invoke(elementId: string): void;
  setValue(elementId: string, text: string): void;
  dumpTree(rootId: string, maxDepth?: number): string;
  treeHealth(rootId: string, maxDepth?: number): TreeHealth;
  checkTreeHealth(
    rootId: string,
    minListItems: number,
    maxDepth?: number
  ): TreeHealth;
};

export function extendAccessibility(base: A11yApi): A11yApi & {
  tapElement(elementId: string): Region;
  typeInto(elementId: string, text: string): void;
  findAndInvoke(rootId: string, query: A11yQuery, maxDepth?: number): string;
  attachAndFind(
    windowId: string,
    query: A11yQuery,
    maxDepth?: number
  ): { rootId: string; elementId: string };
} {
  return Object.assign(base, {
    tapElement(elementId: string): Region {
      const region = base.getBounds(elementId);
      const { x, y } = centerOf(region);
      loadNative().tapAt(x, y);
      return region;
    },

    typeInto(elementId: string, text: string): void {
      base.setValue(elementId, text);
    },

    findAndInvoke(rootId: string, query: A11yQuery, maxDepth = 12): string {
      const id = base.find(rootId, query, maxDepth);
      base.invoke(id);
      return id;
    },

    attachAndFind(
      windowId: string,
      query: A11yQuery,
      maxDepth = 12
    ): { rootId: string; elementId: string } {
      const report = base.attachWindowReport(windowId, maxDepth);
      const elementId = base.find(report.elementId, query, maxDepth);
      return { rootId: report.elementId, elementId };
    },
  });
}
