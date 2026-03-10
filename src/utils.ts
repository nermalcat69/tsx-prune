import * as path from "path";
import * as fs from "fs";

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

export function resolveRelativePath(from: string, to: string): string {
  const fromDir = path.dirname(from);
  return normalizePath(path.resolve(fromDir, to));
}

export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function readJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function stripExtension(filePath: string): string {
  return filePath.replace(/\.(ts|tsx|js|jsx|d\.ts)$/, "");
}

export function ensureExtension(
  filePath: string,
  extensions: string[] = [".ts", ".tsx", ".js", ".jsx"]
): string | null {
  if (fileExists(filePath)) return filePath;

  for (const ext of extensions) {
    const withExt = filePath + ext;
    if (fileExists(withExt)) return withExt;
  }

  // Try index files
  for (const ext of extensions) {
    const indexFile = path.join(filePath, `index${ext}`);
    if (fileExists(indexFile)) return normalizePath(indexFile);
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

export function plural(count: number, word: string): string {
  return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}

export function deduplicateArray<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function sortPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export function relativeTo(filePath: string, cwd: string): string {
  return normalizePath(path.relative(cwd, filePath));
}

export function isTestFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath) ||
    /\/__tests__\//.test(filePath) ||
    /\/tests\//.test(filePath)
  );
}

export function isStoriesFile(filePath: string): boolean {
  return /\.stories\.(ts|tsx|js|jsx)$/.test(filePath);
}

export function isDeclarationFile(filePath: string): boolean {
  return filePath.endsWith(".d.ts");
}

/**
 * Next.js framework entry-point files that must never be treated as unused.
 * These are loaded by the framework, not imported by user code.
 */
const NEXTJS_PROTECTED_PATTERNS = [
  // Configuration
  /next\.config\.(js|ts|mjs|cjs)$/,
  // Middleware
  /middleware\.(ts|js)$/,
  // App Router layouts / pages / special files
  /app\/layout\.(tsx|ts|jsx|js)$/,
  /app\/page\.(tsx|ts|jsx|js)$/,
  /app\/loading\.(tsx|ts|jsx|js)$/,
  /app\/error\.(tsx|ts|jsx|js)$/,
  /app\/not-found\.(tsx|ts|jsx|js)$/,
  /app\/template\.(tsx|ts|jsx|js)$/,
  /app\/global-error\.(tsx|ts|jsx|js)$/,
  // Pages Router special files
  /pages\/_app\.(tsx|ts|jsx|js)$/,
  /pages\/_document\.(tsx|ts|jsx|js)$/,
  /pages\/_error\.(tsx|ts|jsx|js)$/,
  // API routes (all files under pages/api/)
  /pages\/api\//,
];

export function isNextjsFrameworkFile(filePath: string): boolean {
  return NEXTJS_PROTECTED_PATTERNS.some((pattern) => pattern.test(filePath));
}

export function isSafeToDelete(filePath: string): boolean {
  if (isTestFile(filePath)) return false;
  if (isStoriesFile(filePath)) return false;
  if (isDeclarationFile(filePath)) return false;
  if (filePath.includes("/.storybook/")) return false;
  if (isNextjsFrameworkFile(filePath)) return false;
  return true;
}
