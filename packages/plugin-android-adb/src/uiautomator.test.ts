import { describe, expect, it } from "vitest";
import { findAndroidElements, parseUiautomatorXml } from "./uiautomator";

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
});
