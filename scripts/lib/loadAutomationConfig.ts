import * as fs from "fs";
import * as path from "path";

export type A11yStep = {
  query: {
    controlType?: string;
    name?: string;
    nameContains?: string;
    automationId?: string;
    match?: string;
  };
  action: "invoke" | "setValue";
  value?: string;
  timeoutMs?: number;
  pollMs?: number;
};

export type WechatAutomationConfig = {
  app: {
    windowTitleContains: string;
    focusDelayMs?: number;
  };
  accessibility: {
    enabled: boolean;
    treeDepth?: number;
    attachDelayMs?: number;
    eventSubscription?: boolean;
    minListItemCount?: number;
  };
  flow: {
    contact: string;
    message: string;
    steps: Record<string, A11yStep>;
  };
  diagnostics?: {
    dumpOnFailure?: boolean;
    outputDir?: string;
  };
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

export function loadAutomationConfig(
  configPath?: string
): WechatAutomationConfig {
  const envPath = process.env.SPOTTERJS_CONFIG;
  const resolved =
    configPath ??
    envPath ??
    path.resolve(process.cwd(), "wechat.automation.json");

  if (!fs.existsSync(resolved)) {
    const example = path.resolve(
      process.cwd(),
      "config/wechat.automation.example.json"
    );
    throw new Error(
      `Config not found: ${resolved}. Copy ${example} to wechat.automation.json`
    );
  }

  const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as WechatAutomationConfig;

  const vars: Record<string, string> = {
    WECHAT_CONTACT: process.env.WECHAT_CONTACT ?? raw.flow.contact,
    WECHAT_MESSAGE: process.env.WECHAT_MESSAGE ?? raw.flow.message,
    contact: process.env.WECHAT_CONTACT ?? raw.flow.contact,
    message: process.env.WECHAT_MESSAGE ?? raw.flow.message,
  };

  raw.flow.contact = interpolate(raw.flow.contact, vars);
  raw.flow.message = interpolate(raw.flow.message, vars);

  for (const step of Object.values(raw.flow.steps)) {
    if (step.query.name) {
      step.query.name = interpolate(step.query.name, vars);
    }
    if (step.value) {
      step.value = interpolate(step.value, vars);
    }
  }

  if (process.env.SPOTTERJS_ACCESSIBILITY === "1") {
    raw.accessibility.enabled = true;
  }
  if (process.env.SPOTTERJS_ACCESSIBILITY === "0") {
    raw.accessibility.enabled = false;
  }

  return raw;
}
