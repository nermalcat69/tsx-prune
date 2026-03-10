"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyze = analyze;
const graph_1 = require("./graph");
const utils_1 = require("./utils");
function analyze(graph, fileInfos, options) {
    const { entryPoints } = options;
    // Step 1: Find reachable files via DFS/BFS from entry points
    const reachableFiles = (0, graph_1.getReachableFiles)(graph, entryPoints);
    // Step 2: Find unused files
    const unusedFiles = findUnusedFiles(graph, reachableFiles, options);
    // Step 3: Find unused exports (exports never imported anywhere)
    const unusedExports = findUnusedExports(fileInfos, reachableFiles);
    // Step 4: Find unused imports (imports not used in the file body)
    const unusedImports = findUnusedImports(fileInfos);
    // Step 5: Find unused React components
    const unusedComponents = findUnusedComponents(fileInfos, unusedExports);
    let totalExports = 0;
    let totalImports = 0;
    for (const info of fileInfos.values()) {
        totalExports += info.exports.length;
        totalImports += info.imports.length;
    }
    return {
        unusedFiles,
        unusedExports,
        unusedImports,
        unusedComponents,
        totalFiles: fileInfos.size,
        totalExports,
        totalImports,
        reachableFiles,
    };
}
function findUnusedFiles(graph, reachableFiles, options) {
    const unusedFiles = [];
    for (const filePath of graph.files) {
        if (reachableFiles.has(filePath))
            continue;
        // Safety: never mark test/story files as unused
        if (!(0, utils_1.isSafeToDelete)(filePath))
            continue;
        // Check ignore patterns
        if (matchesIgnorePatterns(filePath, options.ignorePatterns))
            continue;
        unusedFiles.push(filePath);
    }
    return unusedFiles.sort();
}
function findUnusedExports(fileInfos, reachableFiles) {
    // Collect all imported names per file
    const importedNames = buildImportedNamesMap(fileInfos);
    const unusedExports = [];
    for (const [filePath, info] of fileInfos) {
        // Skip unreachable files (they'll show up as unused files)
        if (!reachableFiles.has(filePath))
            continue;
        for (const exp of info.exports) {
            // Skip re-exports — they forward exports and shouldn't be flagged
            if (exp.isReExport)
                continue;
            // Skip wildcard exports
            if (exp.name === "*")
                continue;
            const importedInFiles = importedNames.get(filePath);
            const isUsed = importedInFiles !== undefined && importedInFiles.has(exp.name);
            // Default exports: check if the file is imported as default anywhere
            const isDefaultUsed = exp.isDefault &&
                importedInFiles !== undefined &&
                importedInFiles.has("default");
            if (!isUsed && !isDefaultUsed) {
                unusedExports.push({
                    file: filePath,
                    name: exp.name,
                    isComponent: exp.isComponent,
                });
            }
        }
    }
    return unusedExports.sort((a, b) => a.file !== b.file ? a.file.localeCompare(b.file) : a.name.localeCompare(b.name));
}
/**
 * Builds a map: importedFile → Set of import names used from that file
 */
function buildImportedNamesMap(fileInfos) {
    const map = new Map();
    for (const info of fileInfos.values()) {
        for (const imp of info.imports) {
            if (!imp.resolvedPath || imp.isDynamic)
                continue;
            if (!map.has(imp.resolvedPath)) {
                map.set(imp.resolvedPath, new Set());
            }
            const names = map.get(imp.resolvedPath);
            for (const name of imp.namedImports) {
                names.add(name);
            }
            if (imp.defaultImport !== null) {
                names.add("default");
            }
            if (imp.namespaceImport !== null) {
                // namespace import means everything is used
                names.add("*");
            }
        }
    }
    return map;
}
function findUnusedImports(_fileInfos) {
    // Accurate unused-import detection requires full AST identifier analysis,
    // which is done by cleanImportsInFile() in cleaner.ts when --fix-imports is
    // passed. The previous heuristic (checking against jsxUsages only) produced
    // massive false positives for any non-JSX usage of a named import.
    // Return an empty list here; the cleaner handles the real removal.
    return [];
}
function findUnusedComponents(fileInfos, unusedExports) {
    // Collect every component name used in JSX across all files.
    const allJsxUsages = new Set();
    for (const info of fileInfos.values()) {
        for (const usage of info.jsxUsages) {
            allJsxUsages.add(usage);
        }
    }
    const unusedComponents = [];
    // Only report a component as unused when ALL of the following are true:
    //  1. Its export is already flagged as an unused export (not imported anywhere).
    //  2. Its name does not appear in JSX anywhere in the codebase.
    // This avoids false positives on exported utility classes or components that
    // are used via JSX even if their direct import chain looks broken.
    for (const exp of unusedExports) {
        if (!exp.isComponent)
            continue;
        if (allJsxUsages.has(exp.name))
            continue;
        unusedComponents.push({
            file: exp.file,
            name: exp.name,
        });
    }
    return unusedComponents.sort((a, b) => a.file !== b.file ? a.file.localeCompare(b.file) : a.name.localeCompare(b.name));
}
function matchesIgnorePatterns(filePath, patterns) {
    for (const pattern of patterns) {
        // Simple glob matching: convert to regex
        const regex = globToRegex(pattern);
        if (regex.test(filePath))
            return true;
    }
    return false;
}
function globToRegex(pattern) {
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]");
    return new RegExp(escaped);
}
//# sourceMappingURL=analyzer.js.map