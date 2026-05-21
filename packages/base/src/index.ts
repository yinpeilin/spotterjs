export interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface CaptureImage {
  data: Buffer;
  width: number;
  height: number;
}

export interface MatchOptions {
  confidence?: number;
  searchRegion?: Region;
  multiScale?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
}

export interface WindowInfo {
  id: string;
  idHex: string;
  title: string;
  region: Region;
  processId: number;
  processName: string;
  exePath?: string;
  isMinimized: boolean;
  isForeground: boolean;
}

export interface DesktopApp {
  processId: number;
  processName: string;
  exePath?: string;
  windows: WindowInfo[];
  isForeground: boolean;
}

export interface MatchProvider {
  find(needle: string | Buffer, options?: MatchOptions): Promise<Region>;
  findAll(needle: string | Buffer, options?: MatchOptions): Promise<Region[]>;
  waitFor(
    needle: string | Buffer,
    timeoutMs: number,
    options?: MatchOptions,
    intervalMs?: number
  ): Promise<Region>;
}

export function centerOf(region: Region): Point {
  return {
    x: region.left + Math.floor(region.width / 2),
    y: region.top + Math.floor(region.height / 2),
  };
}
