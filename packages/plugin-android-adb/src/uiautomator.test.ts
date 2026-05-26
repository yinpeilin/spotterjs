import { describe, expect, it } from "vitest";
import { findAndroidElements, parseUiautomatorXml } from "./uiautomator";
import type { AndroidElementNode } from "./types";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.example" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" selected="false" bounds="[0,0][1080,2400]">
    <node index="0" text="Login" resource-id="com.example:id/login" class="android.widget.Button" package="com.example" content-desc="Sign in" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" selected="false" bounds="[100,200][300,260]" />
    <node index="1" text="Search messages" resource-id="com.example:id/search" class="android.widget.EditText" package="com.example" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" selected="true" bounds="[40,300][1040,380]" />
  </node>
</hierarchy>`;

describe("parseUiautomatorXml", () => {
  it("normalizes Android UIAutomator nodes into a structured tree", () => {
    const tree = parseUiautomatorXml(xml);

    expect(tree).toMatchObject({
      text: "",
      className: "android.widget.FrameLayout",
      packageName: "com.example",
      enabled: true,
      clickable: false,
      bounds: { left: 0, top: 0, width: 1080, height: 2400 },
      center: { x: 540, y: 1200 },
      depth: 0,
      path: "0",
    });
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0]).toMatchObject({
      text: "Login",
      resourceId: "com.example:id/login",
      className: "android.widget.Button",
      contentDescription: "Sign in",
      clickable: true,
      focusable: true,
      bounds: { left: 100, top: 200, width: 200, height: 60 },
      center: { x: 200, y: 230 },
      depth: 1,
      path: "0.0",
    });
  });

  it("finds elements by exact, contains, boolean, and maxDepth filters", () => {
    const tree = parseUiautomatorXml(xml);

    expect(findAndroidElements(tree, { text: "Login" }).map((n) => n.path)).toEqual([
      "0.0",
    ]);
    expect(
      findAndroidElements(tree, {
        resourceIdContains: "search",
        classNameContains: "EditText",
        selected: true,
      }).map((n) => n.text)
    ).toEqual(["Search messages"]);
    expect(findAndroidElements(tree, { textContains: "Login" }, { maxDepth: 0 })).toEqual([]);
  });

  it("rejects empty hierarchies", () => {
    expect(() => parseUiautomatorXml("<hierarchy />")).toThrow(/empty/i);
  });

  it("normalizes multiple root nodes under a synthetic hierarchy root", () => {
    const tree = parseUiautomatorXml(`
      <hierarchy>
        <node text="A" bounds="[0,0][10,10]" enabled="true" />
        <node text="B" bounds="[20,0][30,10]" enabled="true" />
      </hierarchy>
    `);

    expect(tree).toMatchObject({
      className: "hierarchy",
      path: "0",
      depth: 0,
    });
    expect(tree.children.map((child) => child.path)).toEqual(["0.0", "0.1"]);
  });

  it("handles malformed and negative bounds without throwing", () => {
    const malformed = parseUiautomatorXml(`
      <hierarchy>
        <node text="Broken" bounds="not-bounds" enabled="true" />
      </hierarchy>
    `);
    const negative = parseUiautomatorXml(`
      <hierarchy>
        <node text="Negative" bounds="[-10,-5][20,15]" enabled="true" />
      </hierarchy>
    `);

    expect(malformed.bounds).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(negative.bounds).toEqual({ left: -10, top: -5, width: 30, height: 20 });
  });

  it("does not visit children once maxDepth is exceeded", () => {
    const tree = parseUiautomatorXml(`
      <hierarchy>
        <node text="Root" bounds="[0,0][100,100]" enabled="true">
          <node text="Branch" bounds="[0,0][80,80]" enabled="true">
            <node text="Leaf" bounds="[0,0][20,20]" enabled="true" />
          </node>
        </node>
      </hierarchy>
    `);

    expect(findAndroidElements(tree, { text: "Leaf" }, { maxDepth: 1 })).toEqual([]);
  });

  it("does not read child collections below maxDepth", () => {
    const root = {
      text: "Root",
      resourceId: "",
      className: "",
      packageName: "",
      contentDescription: "",
      clickable: false,
      enabled: true,
      checked: false,
      selected: false,
      scrollable: false,
      focusable: false,
      bounds: { left: 0, top: 0, width: 1, height: 1 },
      center: { x: 0, y: 0 },
      depth: 0,
      path: "0",
      get children() {
        throw new Error("children should not be read");
      },
    } as AndroidElementNode;

    expect(findAndroidElements(root, { text: "Root" }, { maxDepth: 0 })).toHaveLength(1);
  });
});
