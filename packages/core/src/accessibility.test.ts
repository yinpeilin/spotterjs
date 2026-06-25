import { describe, it, expect, vi, beforeEach } from "vitest";

const accessibilityEnable = vi.fn();
const accessibilityAttachWindow = vi.fn();
const accessibilityAttachWindowReport = vi.fn();
const accessibilityFind = vi.fn();
const accessibilityWaitFor = vi.fn();
const accessibilityGetBounds = vi.fn();
const accessibilityInvoke = vi.fn();
const accessibilitySetValue = vi.fn();
const accessibilityDumpTree = vi.fn();
const accessibilityDumpTreeObject = vi.fn();
const accessibilityGetElementInfo = vi.fn();
const accessibilityRefreshRoot = vi.fn();
const accessibilityTreeHealth = vi.fn();
const accessibilityCheckTreeHealth = vi.fn();
const tapAt = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    accessibilityEnable,
    accessibilityAttachWindow,
    accessibilityAttachWindowReport,
    accessibilityFind,
    accessibilityWaitFor,
    accessibilityGetBounds,
    accessibilityInvoke,
    accessibilitySetValue,
    accessibilityDumpTree,
    accessibilityDumpTreeObject,
    accessibilityGetElementInfo,
    accessibilityRefreshRoot,
    accessibilityTreeHealth,
    accessibilityCheckTreeHealth,
    tapAt,
  }),
}));

import { accessibility } from "./accessibility";

beforeEach(() => {
  vi.clearAllMocks();
  accessibilityAttachWindow.mockReturnValue("root-1");
  accessibilityAttachWindowReport.mockReturnValue({
    elementId: "root-2",
    clientMode: false,
    eventHandlerRegistered: false,
    structureChangedEvents: 0,
    healthInitial: {},
    healthFinal: {},
    treeWaitMs: 0,
    attachStrategy: "window",
    attachedHwnd: "1",
    treeView: "raw",
    candidates: [],
    diagnosis: [],
  });
  accessibilityFind.mockReturnValue("element-1");
  accessibilityWaitFor.mockReturnValue("element-2");
  accessibilityGetBounds.mockReturnValue({
    left: 10,
    top: 20,
    width: 30,
    height: 40,
  });
  accessibilityDumpTree.mockReturnValue("{}");
});

describe("accessibility", () => {
  it("exposes the everyday attach/find/invoke flow", () => {
    accessibility.enable({ attachDelayMs: 100 });
    const rootId = accessibility.attach("window-1");
    const elementId = accessibility.find(rootId, { name: "OK" });
    accessibility.invoke(elementId);

    expect(accessibilityEnable).toHaveBeenCalledWith({
      attachDelayMs: 100,
      eventSubscription: undefined,
      treeWaitTimeoutMs: undefined,
      treeWaitPollMs: undefined,
      minListItemCount: undefined,
      treeView: undefined,
    });
    expect(accessibilityAttachWindow).toHaveBeenCalledWith("window-1");
    expect(accessibilityFind).toHaveBeenCalledWith(
      "root-1",
      {
        name: "OK",
        nameContains: undefined,
        controlType: undefined,
        automationId: undefined,
        matchMode: "exact",
      },
      12
    );
    expect(accessibilityInvoke).toHaveBeenCalledWith("element-1");
  });

  it("clicks an element center and returns its bounds", () => {
    const bounds = accessibility.click("element-1");

    expect(bounds).toEqual({ left: 10, top: 20, width: 30, height: 40 });
    expect(tapAt).toHaveBeenCalledWith(25, 40);
  });

  it("combines find and click for common scripts", () => {
    const elementId = accessibility.findAndClick("root-1", {
      controlType: "Button",
      name: "Send",
    });

    expect(elementId).toBe("element-1");
    expect(accessibilityGetBounds).toHaveBeenCalledWith("element-1");
    expect(tapAt).toHaveBeenCalledWith(25, 40);
  });

  it("attaches with report and finds an element", () => {
    const result = accessibility.attachAndFind("window-1", {
      nameContains: "Send",
    });

    expect(result).toEqual({ rootId: "root-2", elementId: "element-1" });
    expect(accessibilityAttachWindowReport).toHaveBeenCalledWith(
      "window-1",
      12
    );
  });
});

describe("accessibility.debug", () => {
  it("keeps diagnostic tree APIs behind debug", () => {
    const tree = accessibility.debug.dumpTree("root-1", {
      maxDepth: 4,
      treeView: "control",
    });

    expect(tree).toBe("{}");
    expect(accessibilityDumpTree).toHaveBeenCalledWith(
      "root-1",
      4,
      "control"
    );
  });

  it("exposes element metadata and health checks", () => {
    accessibility.debug.getElementInfo("element-1");
    accessibility.debug.refreshRoot("root-1");
    accessibility.debug.treeHealth("root-1", 5, "raw");
    accessibility.debug.checkTreeHealth("root-1", 2, 6);

    expect(accessibilityGetElementInfo).toHaveBeenCalledWith("element-1");
    expect(accessibilityRefreshRoot).toHaveBeenCalledWith("root-1");
    expect(accessibilityTreeHealth).toHaveBeenCalledWith("root-1", 5, "raw");
    expect(accessibilityCheckTreeHealth).toHaveBeenCalledWith("root-1", 6, 2);
  });
});
