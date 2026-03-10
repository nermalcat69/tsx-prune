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
exports.clean = clean;
exports.removeEmptyDirectories = removeEmptyDirectories;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ts_morph_1 = require("ts-morph");
const utils_1 = require("./utils");
async function clean(result, project, options) {
    const { dryRun, fixImports, fixExports, ignorePatterns, } = options;
    const deletedFiles = [];
    const wouldDeleteFiles = [];
    const skippedFiles = [];
    let removedImports = [];
    let removedExports = [];
    // Handle unused files
    for (const filePath of result.unusedFiles) {
        if (!(0, utils_1.isSafeToDelete)(filePath)) {
            skippedFiles.push(filePath);
            continue;
        }
        if (matchesIgnorePatterns(filePath, ignorePatterns)) {
            skippedFiles.push(filePath);
            continue;
        }
        if (dryRun) {
            wouldDeleteFiles.push(filePath);
        }
        else {
            try {
                fs.unlinkSync(filePath);
                deletedFiles.push(filePath);
            }
            catch (err) {
                console.error(`Failed to delete ${filePath}: ${err}`);
            }
        }
    }
    // Handle unused imports
    if (fixImports) {
        const importResults = await cleanUnusedImports(project, dryRun);
        removedImports = importResults;
    }
    // Handle unused exports
    if (fixExports) {
        const exportResults = await cleanUnusedExports(result.unusedExports, project, dryRun);
        removedExports = exportResults;
    }
    return {
        deletedFiles,
        wouldDeleteFiles,
        removedImports,
        removedExports,
        skippedFiles,
    };
}
async function cleanUnusedImports(project, dryRun) {
    const removed = [];
    for (const sourceFile of project.getSourceFiles()) {
        const filePath = (0, utils_1.normalizePath)(sourceFile.getFilePath());
        const fileRemoved = cleanImportsInFile(sourceFile, filePath);
        removed.push(...fileRemoved);
    }
    if (!dryRun) {
        await project.save();
    }
    return removed;
}
function cleanImportsInFile(sourceFile, filePath) {
    const removed = [];
    // Collect all identifiers used in the file (excluding import declarations themselves)
    const usedIdentifiers = getUsedIdentifiers(sourceFile);
    for (const importDecl of sourceFile.getImportDeclarations()) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        // Remove unused named imports
        const namedImports = importDecl.getNamedImports();
        const toRemove = [];
        for (const namedImport of namedImports) {
            const localName = namedImport.getAliasNode()?.getText() ?? namedImport.getName();
            if (!usedIdentifiers.has(localName)) {
                toRemove.push(namedImport.getName());
            }
        }
        if (toRemove.length > 0 && toRemove.length === namedImports.length) {
            // Check if there's also a default import in use
            const defaultImport = importDecl.getDefaultImport();
            const hasUsedDefault = defaultImport && usedIdentifiers.has(defaultImport.getText());
            if (!hasUsedDefault) {
                // Remove the entire import declaration
                removed.push(...toRemove.map((name) => ({
                    file: filePath,
                    name,
                    moduleSpecifier,
                })));
                importDecl.remove();
                continue;
            }
        }
        // Remove individual named imports
        for (const namedImport of importDecl.getNamedImports()) {
            const localName = namedImport.getAliasNode()?.getText() ?? namedImport.getName();
            if (!usedIdentifiers.has(localName)) {
                removed.push({
                    file: filePath,
                    name: namedImport.getName(),
                    moduleSpecifier,
                });
                namedImport.remove();
            }
        }
        // If after removal there's nothing left, remove the whole declaration
        const remainingNamed = importDecl.getNamedImports().length;
        const defaultImp = importDecl.getDefaultImport();
        const namespaceImp = importDecl.getNamespaceImport();
        const hasDefault = defaultImp && usedIdentifiers.has(defaultImp.getText());
        const hasNamespace = namespaceImp && usedIdentifiers.has(namespaceImp.getText());
        if (remainingNamed === 0 && !hasDefault && !hasNamespace) {
            // Side-effect-only imports — keep them
            const isSideEffect = !defaultImp && !namespaceImp;
            if (!isSideEffect) {
                importDecl.remove();
            }
        }
    }
    return removed;
}
async function cleanUnusedExports(unusedExports, project, dryRun) {
    const removed = [];
    // Group by file
    const byFile = new Map();
    for (const exp of unusedExports) {
        if (!byFile.has(exp.file))
            byFile.set(exp.file, []);
        byFile.get(exp.file).push(exp);
    }
    for (const [filePath, exports] of byFile) {
        const sourceFile = project.getSourceFile(filePath);
        if (!sourceFile)
            continue;
        for (const exp of exports) {
            const cleaned = removeExportModifier(sourceFile, exp);
            if (cleaned)
                removed.push(exp);
        }
    }
    if (!dryRun) {
        await project.save();
    }
    return removed;
}
function removeExportModifier(sourceFile, exp) {
    for (const statement of sourceFile.getStatements()) {
        // Check export declarations
        if (statement.getKind() === ts_morph_1.SyntaxKind.ExportDeclaration) {
            const exportDecl = statement.asKind(ts_morph_1.SyntaxKind.ExportDeclaration);
            if (!exportDecl)
                continue;
            for (const namedExport of exportDecl.getNamedExports()) {
                const name = namedExport.getAliasNode()?.getText() ?? namedExport.getName();
                if (name === exp.name) {
                    namedExport.remove();
                    if (exportDecl.getNamedExports().length === 0) {
                        exportDecl.remove();
                    }
                    return true;
                }
            }
        }
        // Check exported function declarations
        if (statement.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration) {
            const fn = statement.asKind(ts_morph_1.SyntaxKind.FunctionDeclaration);
            if (!fn || fn.getName() !== exp.name)
                continue;
            if (!fn.isExported())
                continue;
            // Remove the export keyword but keep the function
            fn.toggleModifier("export", false);
            return true;
        }
        // Check exported variable statements
        if (statement.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
            const varStmt = statement.asKind(ts_morph_1.SyntaxKind.VariableStatement);
            if (!varStmt)
                continue;
            const hasExport = varStmt
                .getModifiers()
                .some((m) => m.getKind() === ts_morph_1.SyntaxKind.ExportKeyword);
            if (!hasExport)
                continue;
            const matchingDecl = varStmt
                .getDeclarationList()
                .getDeclarations()
                .find((d) => d.getName() === exp.name);
            if (!matchingDecl)
                continue;
            varStmt.toggleModifier("export", false);
            return true;
        }
    }
    return false;
}
function getUsedIdentifiers(sourceFile) {
    const used = new Set();
    sourceFile.forEachDescendant((node) => {
        // Skip import declarations — we don't want to count the imported names themselves
        if (node.getKind() === ts_morph_1.SyntaxKind.ImportDeclaration ||
            node.getKind() === ts_morph_1.SyntaxKind.ImportSpecifier) {
            return;
        }
        if (node.getKind() === ts_morph_1.SyntaxKind.Identifier) {
            used.add(node.getText());
        }
    });
    return used;
}
function matchesIgnorePatterns(filePath, patterns) {
    for (const pattern of patterns) {
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
function removeEmptyDirectories(dir) {
    try {
        const entries = fs.readdirSync(dir);
        if (entries.length > 0) {
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                if (fs.statSync(fullPath).isDirectory()) {
                    removeEmptyDirectories(fullPath);
                }
            }
        }
        const remaining = fs.readdirSync(dir);
        if (remaining.length === 0) {
            fs.rmdirSync(dir);
        }
    }
    catch {
        // Ignore errors
    }
}
//# sourceMappingURL=cleaner.js.map