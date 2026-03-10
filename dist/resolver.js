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
exports.ImportResolver = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
class ImportResolver {
    constructor(options) {
        this.baseUrl = null;
        this.paths = {};
        this.cache = new Map();
        this.root = options.root;
        this.extensions = options.extensions;
        this.loadTsConfig(options.tsconfig);
    }
    loadTsConfig(tsconfigPath) {
        try {
            const content = fs.readFileSync(tsconfigPath, "utf-8");
            // Strip JSON comments before parsing
            const stripped = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
            const tsconfig = JSON.parse(stripped);
            const opts = tsconfig.compilerOptions;
            if (!opts)
                return;
            if (opts.baseUrl) {
                this.baseUrl = (0, utils_1.normalizePath)(path.resolve(path.dirname(tsconfigPath), opts.baseUrl));
            }
            if (opts.paths) {
                this.paths = opts.paths;
            }
        }
        catch {
            // tsconfig not found or invalid — continue without it
        }
    }
    resolve(importSpecifier, fromFile) {
        // Skip node_modules and built-in modules
        if (this.isExternalModule(importSpecifier))
            return null;
        const cacheKey = `${fromFile}:::${importSpecifier}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) ?? null;
        }
        let resolved = null;
        if (importSpecifier.startsWith(".")) {
            resolved = this.resolveRelative(importSpecifier, fromFile);
        }
        else {
            resolved = this.resolveAlias(importSpecifier, fromFile);
        }
        this.cache.set(cacheKey, resolved);
        return resolved;
    }
    isExternalModule(specifier) {
        // Relative paths start with . or ..
        if (specifier.startsWith("."))
            return false;
        // Absolute paths
        if (path.isAbsolute(specifier))
            return false;
        // Check if it matches a tsconfig path alias
        if (this.matchesPathAlias(specifier))
            return false;
        // Check if it could be a baseUrl-relative path
        if (this.baseUrl) {
            const baseResolved = this.tryResolveFromBase(specifier);
            if (baseResolved)
                return false;
        }
        // Check if it resolves to a local file relative to root
        const rootResolved = this.tryResolveFromRoot(specifier);
        if (rootResolved)
            return false;
        // Otherwise it's an external (node_modules) module
        return true;
    }
    resolveRelative(specifier, fromFile) {
        const fromDir = path.dirname(fromFile);
        const rawResolved = (0, utils_1.normalizePath)(path.resolve(fromDir, specifier));
        return this.tryWithExtensions(rawResolved);
    }
    resolveAlias(specifier, _fromFile) {
        // Try tsconfig path aliases first
        const aliasResolved = this.resolvePathAlias(specifier);
        if (aliasResolved)
            return aliasResolved;
        // Try baseUrl resolution
        if (this.baseUrl) {
            const baseResolved = this.tryResolveFromBase(specifier);
            if (baseResolved)
                return baseResolved;
        }
        // Fall back to root-relative resolution (e.g. "ui/button" → "<root>/ui/button.tsx")
        return this.tryResolveFromRoot(specifier);
    }
    matchesPathAlias(specifier) {
        for (const pattern of Object.keys(this.paths)) {
            const regex = this.pathPatternToRegex(pattern);
            if (regex.test(specifier))
                return true;
        }
        return false;
    }
    resolvePathAlias(specifier) {
        for (const [pattern, targets] of Object.entries(this.paths)) {
            const regex = this.pathPatternToRegex(pattern);
            const match = specifier.match(regex);
            if (!match)
                continue;
            for (const target of targets) {
                const wildcard = match[1] ?? "";
                const resolvedTarget = target.replace("*", wildcard);
                const baseDir = this.baseUrl ?? this.root;
                const absPath = (0, utils_1.normalizePath)(path.resolve(baseDir, resolvedTarget));
                const resolved = this.tryWithExtensions(absPath);
                if (resolved)
                    return resolved;
            }
        }
        return null;
    }
    tryResolveFromBase(specifier) {
        if (!this.baseUrl)
            return null;
        const absPath = (0, utils_1.normalizePath)(path.resolve(this.baseUrl, specifier));
        return this.tryWithExtensions(absPath);
    }
    tryResolveFromRoot(specifier) {
        const absPath = (0, utils_1.normalizePath)(path.resolve(this.root, specifier));
        return this.tryWithExtensions(absPath);
    }
    pathPatternToRegex(pattern) {
        const escaped = pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, "(.*)");
        return new RegExp(`^${escaped}$`);
    }
    tryWithExtensions(basePath) {
        // Direct file match
        if ((0, utils_1.fileExists)(basePath) && !fs.statSync(basePath).isDirectory()) {
            return basePath;
        }
        // Try adding extensions
        for (const ext of this.extensions) {
            const withExt = basePath + ext;
            if ((0, utils_1.fileExists)(withExt))
                return withExt;
        }
        // Try index files
        for (const ext of this.extensions) {
            const indexFile = (0, utils_1.normalizePath)(path.join(basePath, `index${ext}`));
            if ((0, utils_1.fileExists)(indexFile))
                return indexFile;
        }
        return null;
    }
}
exports.ImportResolver = ImportResolver;
//# sourceMappingURL=resolver.js.map