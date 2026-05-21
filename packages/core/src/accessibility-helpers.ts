import { centerOf, type Region } from "@spotter/base";
import { loadNative } from "./native";
import type {
  A11yConfig,
  A11yQuery,
  AttachReport,
  ElementInfo,
  TreeDumpOptions,
  TreeHealth,
  TreeNodeDump,
  TreeViewMode,
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
  getElementInfo(elementId: string): ElementInfo;
  refreshRoot(elementId: string): void;
  invoke(elementId: string): void;
  setValue(elementId: string, text: string): void;
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
};

/** 在基础 {@link A11yApi} 上挂载常用组合操作 */
export function extendAccessibility(base: A11yApi): A11yApi & {
  /** 获取元素边界并点击其中心（屏幕坐标） */
  tapElement(elementId: string): Region;
  /** 向元素写入文本（`setValue` 别名） */
  typeInto(elementId: string, text: string): void;
  /** 查找并 invoke，返回元素 ID */
  findAndInvoke(rootId: string, query: A11yQuery, maxDepth?: number): string;
  /** attach 窗口并查找元素，返回 `{ rootId, elementId }` */
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
