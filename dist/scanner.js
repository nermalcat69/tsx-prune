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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ENTRY_PATTERNS = exports.DEFAULT_EXTENSIONS = void 0;
exports.scanFiles = scanFiles;
exports.resolveEntryPoints = resolveEntryPoints;
const fast_glob_1 = __importDefault(require("fast-glob"));
const path = __importStar(require("path"));
const utils_1 = require("./utils");
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
async function scanFiles(options) {
    const { root, extensions, ignore } = options;
    const patterns = extensions.map((ext) => `**/*${ext}`);
    const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignore];
    const files = await (0, fast_glob_1.default)(patterns, {
        cwd: root,
        absolute: true,
        ignore: ignorePatterns,
        followSymbolicLinks: false,
        dot: false,
    });
    return files.map(utils_1.normalizePath).sort();
}
async function resolveEntryPoints(entry, root) {
    const resolved = [];
    for (const pattern of entry) {
        // Check if it's a glob pattern
        if (fast_glob_1.default.isDynamicPattern(pattern)) {
            const matches = await (0, fast_glob_1.default)(pattern, {
                cwd: root,
                absolute: true,
                ignore: DEFAULT_IGNORE_PATTERNS,
            });
            resolved.push(...matches.map(utils_1.normalizePath));
        }
        else {
            // Resolve as absolute path
            const absPath = path.isAbsolute(pattern)
                ? (0, utils_1.normalizePath)(pattern)
                : (0, utils_1.normalizePath)(path.resolve(root, pattern));
            resolved.push(absPath);
        }
    }
    return resolved;
}
exports.DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
exports.DEFAULT_ENTRY_PATTERNS = [
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
//# sourceMappingURL=scanner.js.map