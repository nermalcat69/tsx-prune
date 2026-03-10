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
exports.Parser = void 0;
exports.getUsedIdentifiers = getUsedIdentifiers;
exports.isComponentFile = isComponentFile;
const ts_morph_1 = require("ts-morph");
const path = __importStar(require("path"));
const utils_1 = require("./utils");
const resolver_1 = require("./resolver");
class Parser {
    constructor(options) {
        this.fileCache = new Map();
        this.project = new ts_morph_1.Project({
            tsConfigFilePath: options.tsconfig,
            skipAddingFilesFromTsConfig: true,
        });
        this.resolver = new resolver_1.ImportResolver({
            root: options.root,
            tsconfig: options.tsconfig,
            extensions: options.extensions,
        });
    }
    addFiles(filePaths) {
        // Add files in bulk for performance
        this.project.addSourceFilesAtPaths(filePaths);
    }
    parseFile(filePath) {
        if (this.fileCache.has(filePath)) {
            return this.fileCache.get(filePath);
        }
        let sourceFile = this.project.getSourceFile(filePath);
        if (!sourceFile) {
            sourceFile = this.project.addSourceFileAtPath(filePath);
        }
        const info = this.extractFileInfo(sourceFile, filePath);
        this.fileCache.set(filePath, info);
        return info;
    }
    extractFileInfo(sourceFile, filePath) {
        const imports = this.extractImports(sourceFile, filePath);
        const exports = this.extractExports(sourceFile);
        const jsxUsages = this.extractJsxUsages(sourceFile);
        const hasComponents = this.detectComponents(sourceFile);
        return {
            path: filePath,
            imports,
            exports,
            jsxUsages,
            hasComponents,
            isComponentFile: filePath.endsWith(".tsx") || filePath.endsWith(".jsx"),
        };
    }
    extractImports(sourceFile, fromFile) {
        const imports = [];
        // Static imports
        for (const importDecl of sourceFile.getImportDeclarations()) {
            const info = this.processImportDeclaration(importDecl, fromFile);
            if (info)
                imports.push(info);
        }
        // Dynamic imports: import("...")
        sourceFile.forEachDescendant((node) => {
            if (node.getKind() === ts_morph_1.SyntaxKind.CallExpression) {
                const callExpr = node.asKind(ts_morph_1.SyntaxKind.CallExpression);
                if (!callExpr)
                    return;
                const expr = callExpr.getExpression();
                if (expr.getKind() !== ts_morph_1.SyntaxKind.ImportKeyword)
                    return;
                const args = callExpr.getArguments();
                if (args.length === 0)
                    return;
                const firstArg = args[0];
                if (firstArg.getKind() !== ts_morph_1.SyntaxKind.StringLiteral)
                    return;
                const specifier = firstArg
                    .asKind(ts_morph_1.SyntaxKind.StringLiteral)
                    .getLiteralValue();
                imports.push({
                    moduleSpecifier: specifier,
                    resolvedPath: null, // Don't resolve dynamic imports
                    namedImports: [],
                    defaultImport: null,
                    namespaceImport: null,
                    isDynamic: true,
                    isSideEffect: false,
                });
            }
        });
        return imports;
    }
    processImportDeclaration(importDecl, fromFile) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        const resolvedPath = this.resolver.resolve(moduleSpecifier, fromFile);
        const namedImports = importDecl
            .getNamedImports()
            .map((n) => n.getName());
        const defaultImportNode = importDecl.getDefaultImport();
        const defaultImport = defaultImportNode?.getText() ?? null;
        const namespaceNode = importDecl.getNamespaceImport();
        const namespaceImport = namespaceNode?.getText() ?? null;
        const isSideEffect = namedImports.length === 0 &&
            defaultImport === null &&
            namespaceImport === null;
        return {
            moduleSpecifier,
            resolvedPath: resolvedPath ? (0, utils_1.normalizePath)(resolvedPath) : null,
            namedImports,
            defaultImport,
            namespaceImport,
            isDynamic: false,
            isSideEffect,
        };
    }
    extractExports(sourceFile) {
        const exports = [];
        // Named export declarations: export { Foo, Bar }
        // Re-export declarations: export { Foo } from "./foo"
        for (const exportDecl of sourceFile.getExportDeclarations()) {
            const reExportSource = exportDecl.getModuleSpecifierValue() ?? null;
            if (exportDecl.isNamespaceExport()) {
                exports.push({
                    name: "*",
                    isDefault: false,
                    isReExport: reExportSource !== null,
                    reExportSource,
                    isComponent: false,
                });
                continue;
            }
            for (const namedExport of exportDecl.getNamedExports()) {
                const name = namedExport.getAliasNode()?.getText() ?? namedExport.getName();
                exports.push({
                    name,
                    isDefault: false,
                    isReExport: reExportSource !== null,
                    reExportSource,
                    isComponent: this.isComponentName(name),
                });
            }
        }
        // Export assignments: export default Foo
        const exportAssignments = sourceFile.getExportAssignments();
        for (const assignment of exportAssignments) {
            if (!assignment.isExportEquals()) {
                exports.push({
                    name: "default",
                    isDefault: true,
                    isReExport: false,
                    reExportSource: null,
                    isComponent: false,
                });
            }
        }
        // Exported declarations (export function, export const, export class, etc.)
        for (const statement of sourceFile.getStatements()) {
            const exported = this.extractExportedDeclaration(statement);
            if (exported)
                exports.push(...exported);
        }
        return exports;
    }
    extractExportedDeclaration(statement) {
        const results = [];
        // export function Foo() {}
        if (statement.getKind() === ts_morph_1.SyntaxKind.FunctionDeclaration) {
            const fn = statement;
            if (!fn.isExported())
                return null;
            const name = fn.getName();
            if (!name)
                return null;
            const isDefault = fn.isDefaultExport();
            results.push({
                name: isDefault ? "default" : name,
                isDefault,
                isReExport: false,
                reExportSource: null,
                isComponent: this.isComponentName(name) || this.functionReturnsJsx(fn),
            });
            return results;
        }
        // export const Foo = ...
        if (statement.getKind() === ts_morph_1.SyntaxKind.VariableStatement) {
            const varStmt = statement;
            const mods = varStmt.getModifiers?.();
            const isExported = mods?.some((m) => m.getKind() === ts_morph_1.SyntaxKind.ExportKeyword);
            if (!isExported)
                return null;
            for (const decl of varStmt.getDeclarationList().getDeclarations()) {
                const name = decl.getName();
                const initializer = decl.getInitializer();
                const returnsJsx = initializer
                    ? this.initializerReturnsJsx(initializer)
                    : false;
                results.push({
                    name,
                    isDefault: false,
                    isReExport: false,
                    reExportSource: null,
                    isComponent: this.isComponentName(name) || returnsJsx,
                });
            }
            return results.length > 0 ? results : null;
        }
        // export class Foo {}
        if (statement.getKind() === ts_morph_1.SyntaxKind.ClassDeclaration) {
            const cls = statement.asKind(ts_morph_1.SyntaxKind.ClassDeclaration);
            if (!cls?.isExported())
                return null;
            const name = cls.getName();
            if (!name)
                return null;
            results.push({
                name,
                isDefault: cls.isDefaultExport(),
                isReExport: false,
                reExportSource: null,
                isComponent: this.isComponentName(name),
            });
            return results;
        }
        // export interface / export type
        if (statement.getKind() === ts_morph_1.SyntaxKind.InterfaceDeclaration ||
            statement.getKind() === ts_morph_1.SyntaxKind.TypeAliasDeclaration ||
            statement.getKind() === ts_morph_1.SyntaxKind.EnumDeclaration) {
            const decl = statement;
            if (!decl.isExported?.())
                return null;
            const name = decl.getName?.();
            if (!name)
                return null;
            results.push({
                name,
                isDefault: decl.isDefaultExport?.() ?? false,
                isReExport: false,
                reExportSource: null,
                isComponent: false,
            });
            return results;
        }
        return null;
    }
    extractJsxUsages(sourceFile) {
        const usages = new Set();
        sourceFile.forEachDescendant((node) => {
            const kind = node.getKind();
            // JSX opening element: <Button>
            if (kind === ts_morph_1.SyntaxKind.JsxOpeningElement ||
                kind === ts_morph_1.SyntaxKind.JsxSelfClosingElement) {
                const jsxNode = node;
                const tagNode = jsxNode.getTagNameNode?.();
                if (tagNode) {
                    const tagName = tagNode.getText();
                    // Only track component names (PascalCase or namespaced like Foo.Bar)
                    if (/^[A-Z]/.test(tagName) || tagName.includes(".")) {
                        usages.add(tagName.split(".")[0]);
                    }
                }
            }
        });
        return [...usages];
    }
    detectComponents(sourceFile) {
        let found = false;
        sourceFile.forEachDescendant((node) => {
            if (found)
                return;
            const kind = node.getKind();
            if (kind === ts_morph_1.SyntaxKind.JsxElement ||
                kind === ts_morph_1.SyntaxKind.JsxSelfClosingElement ||
                kind === ts_morph_1.SyntaxKind.JsxFragment) {
                found = true;
            }
        });
        return found;
    }
    isComponentName(name) {
        return /^[A-Z]/.test(name);
    }
    functionReturnsJsx(fn) {
        let returnsJsx = false;
        fn.forEachDescendant((node) => {
            const kind = node.getKind();
            if (kind === ts_morph_1.SyntaxKind.JsxElement ||
                kind === ts_morph_1.SyntaxKind.JsxSelfClosingElement ||
                kind === ts_morph_1.SyntaxKind.JsxFragment) {
                returnsJsx = true;
            }
        });
        return returnsJsx;
    }
    initializerReturnsJsx(initializer) {
        const kind = initializer.getKind();
        if (kind === ts_morph_1.SyntaxKind.ArrowFunction ||
            kind === ts_morph_1.SyntaxKind.FunctionExpression) {
            const fn = initializer;
            let hasJsx = false;
            fn.forEachDescendant((node) => {
                const nk = node.getKind();
                if (nk === ts_morph_1.SyntaxKind.JsxElement ||
                    nk === ts_morph_1.SyntaxKind.JsxSelfClosingElement ||
                    nk === ts_morph_1.SyntaxKind.JsxFragment) {
                    hasJsx = true;
                }
            });
            return hasJsx;
        }
        return false;
    }
    getResolvedImportPaths(fileInfo) {
        return fileInfo.imports
            .filter((i) => !i.isDynamic && i.resolvedPath !== null)
            .map((i) => i.resolvedPath);
    }
    getCachedFile(filePath) {
        return this.fileCache.get(filePath);
    }
    clearCache() {
        this.fileCache.clear();
    }
}
exports.Parser = Parser;
function getUsedIdentifiers(sourceFile) {
    const used = new Set();
    sourceFile.forEachDescendant((node) => {
        if (node.getKind() === ts_morph_1.SyntaxKind.Identifier) {
            used.add(node.getText());
        }
    });
    return used;
}
function isComponentFile(filePath) {
    return (filePath.endsWith(".tsx") ||
        filePath.endsWith(".jsx") ||
        /components?/.test(path.dirname(filePath)));
}
//# sourceMappingURL=parser.js.map