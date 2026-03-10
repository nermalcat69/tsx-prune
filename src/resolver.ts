import * as path from "path";
import * as fs from "fs";
import { normalizePath, fileExists } from "./utils";

export interface ResolverOptions {
  root: string;
  tsconfig: string;
  extensions: string[];
}

interface TsConfigPaths {
  [key: string]: string[];
}

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: TsConfigPaths;
  };
}

export class ImportResolver {
  private baseUrl: string | null = null;
  private paths: TsConfigPaths = {};
  private extensions: string[];
  private root: string;
  private cache = new Map<string, string | null>();

  constructor(options: ResolverOptions) {
    this.root = options.root;
    this.extensions = options.extensions;
    this.loadTsConfig(options.tsconfig);
  }

  private loadTsConfig(tsconfigPath: string): void {
    try {
      const content = fs.readFileSync(tsconfigPath, "utf-8");
      // Strip JSON comments before parsing
      const stripped = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const tsconfig: TsConfig = JSON.parse(stripped);
      const opts = tsconfig.compilerOptions;
      if (!opts) return;

      if (opts.baseUrl) {
        this.baseUrl = normalizePath(
          path.resolve(path.dirname(tsconfigPath), opts.baseUrl)
        );
      }

      if (opts.paths) {
        this.paths = opts.paths;
      }
    } catch {
      // tsconfig not found or invalid — continue without it
    }
  }

  resolve(importSpecifier: string, fromFile: string): string | null {
    // Skip node_modules and built-in modules
    if (this.isExternalModule(importSpecifier)) return null;

    const cacheKey = `${fromFile}:::${importSpecifier}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    let resolved: string | null = null;

    if (importSpecifier.startsWith(".")) {
      resolved = this.resolveRelative(importSpecifier, fromFile);
    } else {
      resolved = this.resolveAlias(importSpecifier, fromFile);
    }

    this.cache.set(cacheKey, resolved);
    return resolved;
  }

  private isExternalModule(specifier: string): boolean {
    // Relative paths start with . or ..
    if (specifier.startsWith(".")) return false;
    // Absolute paths
    if (path.isAbsolute(specifier)) return false;
    // Check if it matches a tsconfig path alias
    if (this.matchesPathAlias(specifier)) return false;
    // Check if it could be a baseUrl-relative path
    if (this.baseUrl) {
      const baseResolved = this.tryResolveFromBase(specifier);
      if (baseResolved) return false;
    }
    // Otherwise it's an external (node_modules) module
    return true;
  }

  private resolveRelative(specifier: string, fromFile: string): string | null {
    const fromDir = path.dirname(fromFile);
    const rawResolved = normalizePath(path.resolve(fromDir, specifier));
    return this.tryWithExtensions(rawResolved);
  }

  private resolveAlias(specifier: string, _fromFile: string): string | null {
    // Try tsconfig path aliases first
    const aliasResolved = this.resolvePathAlias(specifier);
    if (aliasResolved) return aliasResolved;

    // Try baseUrl resolution
    if (this.baseUrl) {
      const baseResolved = this.tryResolveFromBase(specifier);
      if (baseResolved) return baseResolved;
    }

    return null;
  }

  private matchesPathAlias(specifier: string): boolean {
    for (const pattern of Object.keys(this.paths)) {
      const regex = this.pathPatternToRegex(pattern);
      if (regex.test(specifier)) return true;
    }
    return false;
  }

  private resolvePathAlias(specifier: string): string | null {
    for (const [pattern, targets] of Object.entries(this.paths)) {
      const regex = this.pathPatternToRegex(pattern);
      const match = specifier.match(regex);

      if (!match) continue;

      for (const target of targets) {
        const wildcard = match[1] ?? "";
        const resolvedTarget = target.replace("*", wildcard);
        const baseDir = this.baseUrl ?? this.root;
        const absPath = normalizePath(path.resolve(baseDir, resolvedTarget));
        const resolved = this.tryWithExtensions(absPath);
        if (resolved) return resolved;
      }
    }
    return null;
  }

  private tryResolveFromBase(specifier: string): string | null {
    if (!this.baseUrl) return null;
    const absPath = normalizePath(path.resolve(this.baseUrl, specifier));
    return this.tryWithExtensions(absPath);
  }

  private pathPatternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "(.*)");
    return new RegExp(`^${escaped}$`);
  }

  private tryWithExtensions(basePath: string): string | null {
    // Direct file match
    if (fileExists(basePath) && !fs.statSync(basePath).isDirectory()) {
      return basePath;
    }

    // Try adding extensions
    for (const ext of this.extensions) {
      const withExt = basePath + ext;
      if (fileExists(withExt)) return withExt;
    }

    // Try index files
    for (const ext of this.extensions) {
      const indexFile = normalizePath(path.join(basePath, `index${ext}`));
      if (fileExists(indexFile)) return indexFile;
    }

    return null;
  }
}
