"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultConfig = getDefaultConfig;
exports.loadConfigFile = loadConfigFile;
exports.mergeConfig = mergeConfig;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
const scanner_1 = require("./scanner");
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
function getDefaultConfig(cwd) {
    return {
        entry: scanner_1.DEFAULT_ENTRY_PATTERNS,
        ignore: DEFAULT_IGNORE_PATTERNS,
        root: cwd,
        extensions: scanner_1.DEFAULT_EXTENSIONS,
        tsconfig: path.join(cwd, "tsconfig.json"),
        json: false,
        silent: false,
    };
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
function loadConfigFile(cwd) {
    for (const name of CONFIG_FILE_NAMES) {
        const configPath = path.join(cwd, name);
        if (!fs.existsSync(configPath))
            continue;
        try {
            if (name.endsWith(".json") || name.startsWith(".tsx-prunerc")) {
                const content = fs.readFileSync(configPath, "utf-8");
                return JSON.parse(content);
            }
            // For .ts/.js config files, require them (they must be pre-compiled or use ts-node)
            // We try to load them via require — works for .js/.cjs
            if (name.endsWith(".js") || name.endsWith(".cjs") || name.endsWith(".mjs")) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const mod = require(configPath);
                return extractConfig(mod);
            }
            // For .ts config files, try to transpile on the fly using ts-node if available
            if (name.endsWith(".ts")) {
                try {
                    require("ts-node/register");
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const mod = require(configPath);
                    return extractConfig(mod);
                }
                catch {
                    // ts-node not available, skip .ts config
                }
            }
        }
        catch (err) {
            console.warn(`Warning: could not load config file ${configPath}: ${err}`);
        }
    }
    return null;
}
function extractConfig(mod) {
    if (!mod || typeof mod !== "object")
        return null;
    const obj = mod;
    if ("default" in obj && obj["default"] && typeof obj["default"] === "object") {
        return obj["default"];
    }
    return mod;
}
function mergeConfig(base, fileConfig, cliOverrides) {
    const merged = { ...base };
    if (fileConfig) {
        if (fileConfig.entry)
            merged.entry = fileConfig.entry;
        if (fileConfig.ignore)
            merged.ignore = [...base.ignore, ...fileConfig.ignore];
        if (fileConfig.root)
            merged.root = (0, utils_1.normalizePath)(path.resolve(fileConfig.root));
        if (fileConfig.extensions)
            merged.extensions = fileConfig.extensions;
        if (fileConfig.tsconfig) {
            merged.tsconfig = path.isAbsolute(fileConfig.tsconfig)
                ? fileConfig.tsconfig
                : path.resolve(merged.root, fileConfig.tsconfig);
        }
    }
    // CLI overrides take highest priority
    if (cliOverrides.entry)
        merged.entry = cliOverrides.entry;
    if (cliOverrides.ignore)
        merged.ignore = [...merged.ignore, ...cliOverrides.ignore];
    if (cliOverrides.json !== undefined)
        merged.json = cliOverrides.json;
    if (cliOverrides.silent !== undefined)
        merged.silent = cliOverrides.silent;
    return merged;
}
//# sourceMappingURL=config.js.map