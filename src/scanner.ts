import fg from "fast-glob";
import * as path from "path";
import { normalizePath } from "./utils";

export interface ScanOptions {
  root: string;
  extensions: string[];
  ignore: string[];
  entry: string[];
}

const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.git/**",
  "**/.turbo/**",
  "**/.vercel/**",
  "**/.cache/**",
  "**/out/**",
];

export async function scanFiles(options: ScanOptions): Promise<string[]> {
  const { root, extensions, ignore } = options;

  const patterns = extensions.map((ext) => `**/*${ext}`);
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignore];

  const files = await fg(patterns, {
    cwd: root,
    absolute: true,
    ignore: ignorePatterns,
    followSymbolicLinks: false,
    dot: false,
  });

  return files.map(normalizePath).sort();
}

export async function resolveEntryPoints(
  entry: string[],
  root: string
): Promise<string[]> {
  const resolved: string[] = [];

  for (const pattern of entry) {
    // Check if it's a glob pattern
    if (fg.isDynamicPattern(pattern)) {
      const matches = await fg(pattern, {
        cwd: root,
        absolute: true,
        ignore: DEFAULT_IGNORE_PATTERNS,
      });
      resolved.push(...matches.map(normalizePath));
    } else {
      // Resolve as absolute path
      const absPath = path.isAbsolute(pattern)
        ? normalizePath(pattern)
        : normalizePath(path.resolve(root, pattern));

      resolved.push(absPath);
    }
  }

  return resolved;
}

export const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export const DEFAULT_ENTRY_PATTERNS = [
  "src/main.tsx",
  "src/main.ts",
  "src/index.tsx",
  "src/index.ts",
  "src/app.tsx",
  "src/app.ts",
  "src/App.tsx",
  "src/App.ts",
  "src/pages/**/*.{ts,tsx,js,jsx}",
  "src/app/**/*.{ts,tsx,js,jsx}",
  "pages/**/*.{ts,tsx,js,jsx}",
  "app/**/*.{ts,tsx,js,jsx}",
];
