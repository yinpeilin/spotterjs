import * as path from "path";

/**
 * Agent / MCP 工作区宿主 I/O 配置。
 *
 * 默认从环境变量读取；可用 {@link configureHost} 覆盖。
 */
export type HostConfig = {
  /** 工作区根目录，所有相对路径均解析到此目录下 */
  workspaceRoot: string;
  /** 是否允许 {@link host.exec} 执行 shell */
  allowShell: boolean;
  /** 单次读/写最大字节数 */
  maxBytes: number;
  /** shell 命令默认超时（毫秒） */
  execTimeoutMs: number;
  /** 禁止写入的文件名（相对路径 basename 匹配） */
  writeDenylist: string[];
};

let _config: HostConfig | null = null;

function envRoot(): string {
  return (
    process.env.SPOTTERJS_WORKSPACE_ROOT?.trim() ||
    process.cwd()
  );
}

function envBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

/** 获取当前宿主配置（懒初始化） */
export function getHostConfig(): HostConfig {
  if (_config) return _config;
  _config = {
    workspaceRoot: path.resolve(envRoot()),
    allowShell: envBool("SPOTTERJS_ALLOW_SHELL", false),
    maxBytes: Number(process.env.SPOTTERJS_FS_MAX_BYTES || 1048576),
    execTimeoutMs: Number(process.env.SPOTTERJS_EXEC_TIMEOUT_MS || 60000),
    writeDenylist: [".env", ".env.local", "credentials.json", "secrets.json"],
  };
  return _config;
}

/** 合并更新宿主配置（`workspaceRoot` 会 resolve 为绝对路径） */
export function configureHost(partial: Partial<HostConfig>): void {
  _config = { ...getHostConfig(), ...partial };
  _config.workspaceRoot = path.resolve(_config.workspaceRoot);
}
