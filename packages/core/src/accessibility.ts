import {
  loadNative,
  type NativeAttachReport,
  type NativeElementInfo,
  type NativeTreeHealth,
  type NativeTreeNodeDump,
} from "./native";
import { centerOf, type Region } from "@spotterjs/base";

/** UIA 树遍历视图（Windows） */
export type TreeViewMode = "auto" | "raw" | "control" | "content";

/**
 * 无障碍树元素查询条件。
 *
 * Windows 使用 UIA；Linux 使用 AT-SPI。字段组合为 AND 关系。
 */
export type A11yQuery = {
  /** 精确或包含匹配的名称（由 `match` 决定） */
  name?: string;
  /** 名称包含子串（便捷字段，等价于 name + match:contains） */
  nameContains?: string;
  /** 控件类型，如 `"Button"`、`"ListItem"`（平台命名） */
  controlType?: string;
  /** UIA AutomationId / AT-SPI 等价标识 */
  automationId?: string;
  /** 名称匹配模式，默认 `"exact"` */
  match?: "exact" | "contains";
};

/**
 * 无障碍子系统初始化选项。
 *
 * 调用 {@link accessibility.quick.enable} 后生效，影响 attach 与树展开行为。
 */
export type A11yConfig = {
  /** attach 后的固定等待（毫秒） */
  attachDelayMs?: number;
  /** 注册 StructureChanged 事件（WeChat 4.1+ UIA client 模式） */
  eventSubscription?: boolean;
  /** 等待树展开的最长时间 */
  treeWaitTimeoutMs?: number;
  treeWaitPollMs?: number;
  /** 树健康检查：最少 ListItem 数量 */
  minListItemCount?: number;
  /** UIA walker：`auto` 在 client 模式用 control，否则 raw */
  treeView?: TreeViewMode;
};

export type TreeDumpOptions = {
  maxDepth?: number;
  treeView?: TreeViewMode;
};

/** 无障碍树健康检查结果，形状来自 `@spotterjs/node` */
export type TreeHealth = NativeTreeHealth;

/** attach 报告（attach 前后树状态对比），形状来自 `@spotterjs/node` */
export type AttachReport = NativeAttachReport;

/** 单节点 UIA 元数据 */
export type ElementInfo = NativeElementInfo;

/** UIA 树节点（结构化） */
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
   * 启用无障碍桥接（UIA / AT-SPI）。
   * 重复调用会更新配置。
   */
  enable(config?: A11yConfig): void {
    loadNative().accessibilityEnable(configToNative(config));
  },

  /** 释放无障碍资源 */
  disable(): void {
    loadNative().accessibilityDisable();
  },

  isEnabled(): boolean {
    return loadNative().accessibilityIsEnabled();
  },

  /**
   * 将窗口 attach 到无障碍树，返回根元素 ID。
   * @param windowId {@link WindowInfo.id}
   */
  attachWindow(windowId: string): string {
    return loadNative().accessibilityAttachWindow(windowId);
  },

  /**
   * 带 UIA client 模式与树展开等待的 attach。
   * @returns attach 前后树健康对比、HWND 候选与诊断建议
   */
  attachWindowReport(windowId: string, maxDepth = 12): AttachReport {
    const r = loadNative().accessibilityAttachWindowReport(windowId, maxDepth);
    return attachReportFromNative(r);
  },

  /** attach 当前前台窗口，返回根元素 ID */
  attachActive(): string {
    return loadNative().accessibilityAttachActive();
  },

  /**
   * 在子树中查找第一个匹配元素。
   * @param rootId 根元素 ID（通常来自 attach）
   * @returns 元素 ID
   * @throws 未找到
   */
  find(rootId: string, query: A11yQuery, maxDepth = 12): string {
    return loadNative().accessibilityFind(rootId, queryToNative(query), maxDepth);
  },

  /**
   * 轮询等待元素出现。
   * @throws 超时
   */
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

  /** 元素边界（屏幕坐标 {@link Region}） */
  getBounds(elementId: string): Region {
    return loadNative().accessibilityGetBounds(elementId);
  },

  /** 单节点 UIA 元数据（无需 dump 整树） */
  getElementInfo(elementId: string): ElementInfo {
    return loadNative().accessibilityGetElementInfo(elementId);
  },

  /** UI 变化后从原 HWND 刷新根元素 COM 引用 */
  refreshRoot(elementId: string): void {
    loadNative().accessibilityRefreshRoot(elementId);
  },

  /** 触发 Invoke 模式（按钮等） */
  invoke(elementId: string): void {
    loadNative().accessibilityInvoke(elementId);
  },

  /** 设置 Value 模式文本（输入框等） */
  setValue(elementId: string, text: string): void {
    loadNative().accessibilitySetValue(elementId, text);
  },

  /** 导出子树为 JSON 字符串（调试） */
  dumpTree(rootId: string, maxDepthOrOpts: number | TreeDumpOptions = 12): string {
    const opts =
      typeof maxDepthOrOpts === "number"
        ? { maxDepth: maxDepthOrOpts }
        : maxDepthOrOpts;
    return loadNative().accessibilityDumpTree(
      rootId,
      opts.maxDepth ?? 12,
      opts.treeView
    );
  },

  /** 导出子树为结构化对象 */
  dumpTreeObject(
    rootId: string,
    maxDepthOrOpts: number | TreeDumpOptions = 12
  ): TreeNodeDump {
    const opts =
      typeof maxDepthOrOpts === "number"
        ? { maxDepth: maxDepthOrOpts }
        : maxDepthOrOpts;
    return loadNative().accessibilityDumpTreeObject(
      rootId,
      opts.maxDepth ?? 12,
      opts.treeView
    );
  },

  /** 统计子树节点数等指标 */
  treeHealth(
    rootId: string,
    maxDepth = 12,
    treeView?: TreeViewMode
  ): TreeHealth {
    const h = loadNative().accessibilityTreeHealth(rootId, maxDepth, treeView);
    return healthFromNative(h);
  },

  /**
   * 检查树是否达到最小 ListItem 数量等指标。
   * 常用于判断 UIA 树是否已充分展开。
   */
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

/**
 * 日常无障碍自动化 API。
 *
 * 典型流程：`quick.enable()` → `quick.attach()` → `quick.find()` → `quick.click()` / `quick.invoke()`。
 */
export type A11yQuickApi = {
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
};

/**
 * 无障碍诊断 API。
 *
 * 当 `quick.find()` 找不到元素，或 UIA / AT-SPI 树不完整时，用这里的树导出、
 * 健康检查和元素元数据方法排查。
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
  loadNative().tapAt(x, y);
  return region;
}

export const accessibility: {
  quick: A11yQuickApi;
  debug: A11yDebugApi;
} = {
  quick: {
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
