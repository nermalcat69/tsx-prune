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
exports.normalizePath = normalizePath;
exports.isAbsolutePath = isAbsolutePath;
exports.resolveRelativePath = resolveRelativePath;
exports.fileExists = fileExists;
exports.readJsonFile = readJsonFile;
exports.stripExtension = stripExtension;
exports.ensureExtension = ensureExtension;
exports.formatFileSize = formatFileSize;
exports.getFileSize = getFileSize;
exports.plural = plural;
exports.deduplicateArray = deduplicateArray;
exports.sortPaths = sortPaths;
exports.relativeTo = relativeTo;
exports.isTestFile = isTestFile;
exports.isStoriesFile = isStoriesFile;
exports.isDeclarationFile = isDeclarationFile;
exports.isSafeToDelete = isSafeToDelete;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function normalizePath(filePath) {
    return filePath.replace(/\\/g, "/");
}
function isAbsolutePath(filePath) {
    return path.isAbsolute(filePath);
}
function resolveRelativePath(from, to) {
    const fromDir = path.dirname(from);
    return normalizePath(path.resolve(fromDir, to));
}
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    }
    catch {
        return false;
    }
}
function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
function stripExtension(filePath) {
    return filePath.replace(/\.(ts|tsx|js|jsx|d\.ts)$/, "");
}
function ensureExtension(filePath, extensions = [".ts", ".tsx", ".js", ".jsx"]) {
    if (fileExists(filePath))
        return filePath;
    for (const ext of extensions) {
        const withExt = filePath + ext;
        if (fileExists(withExt))
            return withExt;
    }
    // Try index files
    for (const ext of extensions) {
        const indexFile = path.join(filePath, `index${ext}`);
        if (fileExists(indexFile))
            return normalizePath(indexFile);
    }
    return null;
}
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    }
    catch {
        return 0;
    }
}
function plural(count, word) {
    return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}
function deduplicateArray(arr) {
    return [...new Set(arr)];
}
function sortPaths(paths) {
    return [...paths].sort((a, b) => a.localeCompare(b));
}
function relativeTo(filePath, cwd) {
    return normalizePath(path.relative(cwd, filePath));
}
function isTestFile(filePath) {
    return (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath) ||
        /\/__tests__\//.test(filePath) ||
        /\/tests\//.test(filePath));
}
function isStoriesFile(filePath) {
    return /\.stories\.(ts|tsx|js|jsx)$/.test(filePath);
}
function isDeclarationFile(filePath) {
    return filePath.endsWith(".d.ts");
}
function isSafeToDelete(filePath) {
    if (isTestFile(filePath))
        return false;
    if (isStoriesFile(filePath))
        return false;
    if (isDeclarationFile(filePath))
        return false;
    if (filePath.includes("/.storybook/"))
        return false;
    return true;
}
//# sourceMappingURL=utils.js.map