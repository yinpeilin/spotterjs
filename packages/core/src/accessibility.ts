import {
  loadNative,
  type NativeAttachReport,
  type NativeElementInfo,
  type NativeTreeHealth,
  type NativeTreeNodeDump,
} from "./native";
import type { Region } from "@spotter/base";

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
 * 调用 {@link accessibility.enable} 后生效，影响 attach 与树展开行为。
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

/** 无障碍树健康检查结果，形状来自 `@spotter-rs/node` */
export type TreeHealth = NativeTreeHealth;

/** attach 报告（attach 前后树状态对比），形状来自 `@spotter-rs/node` */
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

import { extendAccessibility } from "./accessibility-helpers";

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
 * 无障碍自动化 API（UIA / AT-SPI）。
 *
 * 典型流程：`enable` → `attachWindowReport` → `dumpTree` / `find` → `invoke` / `tapElement`。
 * 扩展方法见 {@link extendAccessibility}。
 */
export const accessibility = extendAccessibility(accessibilityBase);
