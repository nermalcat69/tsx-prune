import {
  Project,
  SourceFile,
  SyntaxKind,
  Node,
  ImportDeclaration,
  FunctionDeclaration,
  VariableStatement,
  ArrowFunction,
  FunctionExpression,
} from "ts-morph";
import * as path from "path";
import { normalizePath } from "./utils";
import { FileInfo, ImportInfo, ExportInfo } from "./types";
import { ImportResolver } from "./resolver";

export interface ParserOptions {
  tsconfig: string;
  root: string;
  extensions: string[];
}

export class Parser {
  private project: Project;
  private resolver: ImportResolver;
  private fileCache = new Map<string, FileInfo>();

  constructor(options: ParserOptions) {
    this.project = new Project({
      tsConfigFilePath: options.tsconfig,
      skipAddingFilesFromTsConfig: true,
    });

    this.resolver = new ImportResolver({
      root: options.root,
      tsconfig: options.tsconfig,
      extensions: options.extensions,
    });
  }

  addFiles(filePaths: string[]): void {
    // Add files in bulk for performance
    this.project.addSourceFilesAtPaths(filePaths);
  }

  parseFile(filePath: string): FileInfo {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    let sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) {
      sourceFile = this.project.addSourceFileAtPath(filePath);
    }

    const info = this.extractFileInfo(sourceFile, filePath);
    this.fileCache.set(filePath, info);
    return info;
  }

  private extractFileInfo(sourceFile: SourceFile, filePath: string): FileInfo {
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
      isComponentFile:
        filePath.endsWith(".tsx") || filePath.endsWith(".jsx"),
    };
  }

  private extractImports(
    sourceFile: SourceFile,
    fromFile: string
  ): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // Static imports
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const info = this.processImportDeclaration(importDecl, fromFile);
      if (info) imports.push(info);
    }

    // Dynamic imports: import("...")
    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpr = node.asKind(SyntaxKind.CallExpression);
        if (!callExpr) return;

        const expr = callExpr.getExpression();
        if (expr.getKind() !== SyntaxKind.ImportKeyword) return;

        const args = callExpr.getArguments();
        if (args.length === 0) return;

        const firstArg = args[0];
        if (firstArg.getKind() !== SyntaxKind.StringLiteral) return;

        const specifier = firstArg
          .asKind(SyntaxKind.StringLiteral)!
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

  private processImportDeclaration(
    importDecl: ImportDeclaration,
    fromFile: string
  ): ImportInfo | null {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    const resolvedPath = this.resolver.resolve(moduleSpecifier, fromFile);

    const namedImports = importDecl
      .getNamedImports()
      .map((n) => n.getName());

    const defaultImportNode = importDecl.getDefaultImport();
    const defaultImport = defaultImportNode?.getText() ?? null;

    const namespaceNode = importDecl.getNamespaceImport();
    const namespaceImport = namespaceNode?.getText() ?? null;

    const isSideEffect =
      namedImports.length === 0 &&
      defaultImport === null &&
      namespaceImport === null;

    return {
      moduleSpecifier,
      resolvedPath: resolvedPath ? normalizePath(resolvedPath) : null,
      namedImports,
      defaultImport,
      namespaceImport,
      isDynamic: false,
      isSideEffect,
    };
  }

  private extractExports(sourceFile: SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = [];

    // Named export declarations: export { Foo, Bar }
    // Re-export declarations: export { Foo } from "./foo"
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const reExportSource =
        exportDecl.getModuleSpecifierValue() ?? null;

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
      if (exported) exports.push(...exported);
    }

    return exports;
  }

  private extractExportedDeclaration(
    statement: Node
  ): ExportInfo[] | null {
    const results: ExportInfo[] = [];

    // export function Foo() {}
    if (statement.getKind() === SyntaxKind.FunctionDeclaration) {
      const fn = statement as FunctionDeclaration;
      if (!fn.isExported()) return null;
      const name = fn.getName();
      if (!name) return null;
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
    if (statement.getKind() === SyntaxKind.VariableStatement) {
      const varStmt = statement as VariableStatement;
      const mods = varStmt.getModifiers?.();
      const isExported = mods?.some(
        (m) => m.getKind() === SyntaxKind.ExportKeyword
      );
      if (!isExported) return null;

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
    if (statement.getKind() === SyntaxKind.ClassDeclaration) {
      const cls = statement.asKind(SyntaxKind.ClassDeclaration);
      if (!cls?.isExported()) return null;
      const name = cls.getName();
      if (!name) return null;
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
    if (
      statement.getKind() === SyntaxKind.InterfaceDeclaration ||
      statement.getKind() === SyntaxKind.TypeAliasDeclaration ||
      statement.getKind() === SyntaxKind.EnumDeclaration
    ) {
      const decl = statement as Node & {
        isExported?: () => boolean;
        getName?: () => string | undefined;
        isDefaultExport?: () => boolean;
      };
      if (!decl.isExported?.()) return null;
      const name = decl.getName?.();
      if (!name) return null;
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

  private extractJsxUsages(sourceFile: SourceFile): string[] {
    const usages = new Set<string>();

    sourceFile.forEachDescendant((node) => {
      const kind = node.getKind();

      // JSX opening element: <Button>
      if (
        kind === SyntaxKind.JsxOpeningElement ||
        kind === SyntaxKind.JsxSelfClosingElement
      ) {
        const jsxNode = node as Node & { getTagNameNode?: () => Node };
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

  private detectComponents(sourceFile: SourceFile): boolean {
    let found = false;

    sourceFile.forEachDescendant((node) => {
      if (found) return;
      const kind = node.getKind();
      if (
        kind === SyntaxKind.JsxElement ||
        kind === SyntaxKind.JsxSelfClosingElement ||
        kind === SyntaxKind.JsxFragment
      ) {
        found = true;
      }
    });

    return found;
  }

  private isComponentName(name: string): boolean {
    return /^[A-Z]/.test(name);
  }

  private functionReturnsJsx(fn: FunctionDeclaration): boolean {
    let returnsJsx = false;
    fn.forEachDescendant((node) => {
      const kind = node.getKind();
      if (
        kind === SyntaxKind.JsxElement ||
        kind === SyntaxKind.JsxSelfClosingElement ||
        kind === SyntaxKind.JsxFragment
      ) {
        returnsJsx = true;
      }
    });
    return returnsJsx;
  }

  private initializerReturnsJsx(
    initializer: Node
  ): boolean {
    const kind = initializer.getKind();

    if (
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.FunctionExpression
    ) {
      const fn = initializer as ArrowFunction | FunctionExpression;
      let hasJsx = false;
      fn.forEachDescendant((node) => {
        const nk = node.getKind();
        if (
          nk === SyntaxKind.JsxElement ||
          nk === SyntaxKind.JsxSelfClosingElement ||
          nk === SyntaxKind.JsxFragment
        ) {
          hasJsx = true;
        }
      });
      return hasJsx;
    }

    return false;
  }

  getResolvedImportPaths(fileInfo: FileInfo): string[] {
    return fileInfo.imports
      .filter((i) => !i.isDynamic && i.resolvedPath !== null)
      .map((i) => i.resolvedPath!);
  }

  getCachedFile(filePath: string): FileInfo | undefined {
    return this.fileCache.get(filePath);
  }

  clearCache(): void {
    this.fileCache.clear();
  }
}

export function getUsedIdentifiers(sourceFile: SourceFile): Set<string> {
  const used = new Set<string>();

  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.Identifier) {
      used.add(node.getText());
    }
  });

  return used;
}

export function isComponentFile(filePath: string): boolean {
  return (
    filePath.endsWith(".tsx") ||
    filePath.endsWith(".jsx") ||
    /components?/.test(path.dirname(filePath))
  );
}
