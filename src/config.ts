import * as path from "path";
import * as fs from "fs";
import { TsxPruneConfig } from "./types";
import { normalizePath } from "./utils";
import { DEFAULT_ENTRY_PATTERNS, DEFAULT_EXTENSIONS } from "./scanner";

const DEFAULT_IGNORE_PATTERNS = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.stories.tsx",
  "**/*.stories.ts",
  "**/tests/**",
  "**/__tests__/**",
  "**/.storybook/**",
];

export function getDefaultConfig(cwd: string): TsxPruneConfig {
  return {
    entry: DEFAULT_ENTRY_PATTERNS,
    ignore: DEFAULT_IGNORE_PATTERNS,
    root: cwd,
    extensions: DEFAULT_EXTENSIONS,
    tsconfig: path.join(cwd, "tsconfig.json"),
    json: false,
    silent: false,
  };
}

export interface ConfigFileShape {
  entry?: string[];
  ignore?: string[];
  root?: string;
  extensions?: string[];
  tsconfig?: string;
}

const CONFIG_FILE_NAMES = [
  "tsx-prune.config.ts",
  "tsx-prune.config.js",
  "tsx-prune.config.mjs",
  "tsx-prune.config.cjs",
  "tsx-prune.config.json",
  ".tsx-prunerc",
  ".tsx-prunerc.json",
];

export function loadConfigFile(cwd: string): ConfigFileShape | null {
  for (const name of CONFIG_FILE_NAMES) {
    const configPath = path.join(cwd, name);

    if (!fs.existsSync(configPath)) continue;

    try {
      if (name.endsWith(".json") || name.startsWith(".tsx-prunerc")) {
        const content = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(content) as ConfigFileShape;
      }

      // For .ts/.js config files, require them (they must be pre-compiled or use ts-node)
      // We try to load them via require — works for .js/.cjs
      if (name.endsWith(".js") || name.endsWith(".cjs") || name.endsWith(".mjs")) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(configPath) as unknown;
        return extractConfig(mod);
      }

      // For .ts config files, try to transpile on the fly using ts-node if available
      if (name.endsWith(".ts")) {
        try {
          require("ts-node/register");
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const mod = require(configPath) as unknown;
          return extractConfig(mod);
        } catch {
          // ts-node not available, skip .ts config
        }
      }
    } catch (err) {
      console.warn(`Warning: could not load config file ${configPath}: ${err}`);
    }
  }

  return null;
}

function extractConfig(mod: unknown): ConfigFileShape | null {
  if (!mod || typeof mod !== "object") return null;
  const obj = mod as Record<string, unknown>;
  if ("default" in obj && obj["default"] && typeof obj["default"] === "object") {
    return obj["default"] as ConfigFileShape;
  }
  return mod as ConfigFileShape;
}

export function mergeConfig(
  base: TsxPruneConfig,
  fileConfig: ConfigFileShape | null,
  cliOverrides: Partial<TsxPruneConfig>
): TsxPruneConfig {
  const merged = { ...base };

  if (fileConfig) {
    if (fileConfig.entry) merged.entry = fileConfig.entry;
    if (fileConfig.ignore) merged.ignore = [...base.ignore, ...fileConfig.ignore];
    if (fileConfig.root) merged.root = normalizePath(path.resolve(fileConfig.root));
    if (fileConfig.extensions) merged.extensions = fileConfig.extensions;
    if (fileConfig.tsconfig) {
      merged.tsconfig = path.isAbsolute(fileConfig.tsconfig)
        ? fileConfig.tsconfig
        : path.resolve(merged.root, fileConfig.tsconfig);
    }
  }

  // CLI overrides take highest priority
  if (cliOverrides.entry) merged.entry = cliOverrides.entry;
  if (cliOverrides.ignore) merged.ignore = [...merged.ignore, ...cliOverrides.ignore];
  if (cliOverrides.json !== undefined) merged.json = cliOverrides.json;
  if (cliOverrides.silent !== undefined) merged.silent = cliOverrides.silent;

  return merged;
}
