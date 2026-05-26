import { XMLParser } from "fast-xml-parser";
import { centerOf } from "@spotterjs/base";
import type {
  AndroidElementNode,
  AndroidElementQuery,
  AndroidElementQueryOptions,
} from "./types";

type ParsedNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  trimValues: false,
  isArray: (_name, _jpath, _isLeaf, isAttribute) => !isAttribute && _name === "node",
});

/** Parse UIAutomator XML into normalized nodes with bounds and center points. */
export function parseUiautomatorXml(xml: string): AndroidElementNode {
  const parsed = parser.parse(xml) as ParsedNode;
  const hierarchy = parsed.hierarchy as ParsedNode | undefined;
  const nodes = toArray(hierarchy?.node);
  if (nodes.length === 0) {
    throw new Error("Android UI hierarchy is empty");
  }
  if (nodes.length === 1) {
    return normalizeNode(nodes[0], 0, "0");
  }
  return normalizeSyntheticRoot(nodes);
}

/** Return all Android UIAutomator nodes that satisfy the provided query fields. */
export function findAndroidElements(
  root: AndroidElementNode,
  query: AndroidElementQuery,
  options?: Pick<AndroidElementQueryOptions, "maxDepth">
): AndroidElementNode[] {
  const matches: AndroidElementNode[] = [];
  const maxDepth = options?.maxDepth;
  visit(root, maxDepth, (node) => {
    if (matchesQuery(node, query)) matches.push(node);
  });
  return matches;
}

/** Runtime guard for values that already look like normalized Android nodes. */
export function isAndroidElementNode(value: unknown): value is AndroidElementNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "bounds" in value &&
    "center" in value &&
    "children" in value &&
    "path" in value
  );
}

function normalizeSyntheticRoot(nodes: ParsedNode[]): AndroidElementNode {
  const children = nodes.map((node, index) => normalizeNode(node, 1, `0.${index}`));
  const bounds = children[0]?.bounds ?? { left: 0, top: 0, width: 0, height: 0 };
  return {
    text: "",
    resourceId: "",
    className: "hierarchy",
    packageName: "",
    contentDescription: "",
    clickable: false,
    enabled: true,
    checked: false,
    selected: false,
    scrollable: false,
    focusable: false,
    bounds,
    center: centerOf(bounds),
    children,
    depth: 0,
    path: "0",
  };
}

function normalizeNode(node: ParsedNode, depth: number, path: string): AndroidElementNode {
  const bounds = parseBounds(readString(node, "bounds"));
  const children = toArray(node.node).map((child, index) =>
    normalizeNode(child, depth + 1, `${path}.${index}`)
  );
  return {
    text: readString(node, "text"),
    resourceId: readString(node, "resource-id"),
    className: readString(node, "class"),
    packageName: readString(node, "package"),
    contentDescription: readString(node, "content-desc"),
    clickable: readBoolean(node, "clickable"),
    enabled: readBoolean(node, "enabled"),
    checked: readBoolean(node, "checked"),
    selected: readBoolean(node, "selected"),
    scrollable: readBoolean(node, "scrollable"),
    focusable: readBoolean(node, "focusable"),
    bounds,
    center: centerOf(bounds),
    children,
    depth,
    path,
  };
}

function matchesQuery(
  node: AndroidElementNode,
  query: AndroidElementQuery
): boolean {
  return (
    matchesExact(node.text, query.text) &&
    matchesContains(node.text, query.textContains) &&
    matchesExact(node.resourceId, query.resourceId) &&
    matchesContains(node.resourceId, query.resourceIdContains) &&
    matchesExact(node.className, query.className) &&
    matchesContains(node.className, query.classNameContains) &&
    matchesExact(node.contentDescription, query.contentDescription) &&
    matchesContains(
      node.contentDescription,
      query.contentDescriptionContains
    ) &&
    matchesExact(node.packageName, query.packageName) &&
    matchesBoolean(node.clickable, query.clickable) &&
    matchesBoolean(node.enabled, query.enabled) &&
    matchesBoolean(node.checked, query.checked) &&
    matchesBoolean(node.selected, query.selected) &&
    matchesBoolean(node.scrollable, query.scrollable) &&
    matchesBoolean(node.focusable, query.focusable)
  );
}

function visit(
  node: AndroidElementNode,
  maxDepth: number | undefined,
  fn: (node: AndroidElementNode) => void
): void {
  if (maxDepth !== undefined && node.depth > maxDepth) return;
  fn(node);
  if (maxDepth !== undefined && node.depth >= maxDepth) return;
  for (const child of node.children) visit(child, maxDepth, fn);
}

function matchesExact(value: string, expected: string | undefined): boolean {
  return expected === undefined || value === expected;
}

function matchesContains(value: string, expected: string | undefined): boolean {
  return expected === undefined || value.includes(expected);
}

function matchesBoolean(value: boolean, expected: boolean | undefined): boolean {
  return expected === undefined || value === expected;
}

function readString(node: ParsedNode, key: string): string {
  const value = node[key];
  return typeof value === "string" ? value : "";
}

function readBoolean(node: ParsedNode, key: string): boolean {
  return readString(node, key) === "true";
}

function parseBounds(input: string) {
  const match = /^\[(\-?\d+),(\-?\d+)\]\[(\-?\d+),(\-?\d+)\]$/.exec(input);
  if (!match) return { left: 0, top: 0, width: 0, height: 0 };
  const left = Number(match[1]);
  const top = Number(match[2]);
  const right = Number(match[3]);
  const bottom = Number(match[4]);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function toArray(value: unknown): ParsedNode[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(
    (item): item is ParsedNode => typeof item === "object" && item !== null
  );
}
