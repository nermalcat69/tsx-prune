import * as fs from "fs";
import * as path from "path";
import {
  Project,
  SyntaxKind,
  SourceFile,
} from "ts-morph";
import { AnalysisResult, CleanResult, UnusedImport, UnusedExport } from "./types";
import { isSafeToDelete, normalizePath } from "./utils";

export interface CleanOptions {
  dryRun: boolean;
  fixImports: boolean;
  fixExports: boolean;
  ignorePatterns: string[];
}

export async function clean(
  result: AnalysisResult,
  project: Project,
  options: CleanOptions
): Promise<CleanResult> {
  const {
    dryRun,
    fixImports,
    fixExports,
    ignorePatterns,
  } = options;

  const deletedFiles: string[] = [];
  const wouldDeleteFiles: string[] = [];
  const skippedFiles: string[] = [];
  let removedImports: UnusedImport[] = [];
  let removedExports: UnusedExport[] = [];

  // Handle unused files
  for (const filePath of result.unusedFiles) {
    if (!isSafeToDelete(filePath)) {
      skippedFiles.push(filePath);
      continue;
    }

    if (matchesIgnorePatterns(filePath, ignorePatterns)) {
      skippedFiles.push(filePath);
      continue;
    }

    if (dryRun) {
      wouldDeleteFiles.push(filePath);
    } else {
      try {
        fs.unlinkSync(filePath);
        deletedFiles.push(filePath);
      } catch (err) {
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
    const exportResults = await cleanUnusedExports(
      result.unusedExports,
      project,
      dryRun
    );
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

async function cleanUnusedImports(
  project: Project,
  dryRun: boolean
): Promise<UnusedImport[]> {
  const removed: UnusedImport[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = normalizePath(sourceFile.getFilePath());
    const fileRemoved = cleanImportsInFile(sourceFile, filePath);
    removed.push(...fileRemoved);
  }

  if (!dryRun) {
    await project.save();
  }

  return removed;
}

function cleanImportsInFile(
  sourceFile: SourceFile,
  filePath: string
): UnusedImport[] {
  const removed: UnusedImport[] = [];

  // Collect all identifiers used in the file (excluding import declarations themselves)
  const usedIdentifiers = getUsedIdentifiers(sourceFile);

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();

    // Remove unused named imports
    const namedImports = importDecl.getNamedImports();
    const toRemove: string[] = [];

    for (const namedImport of namedImports) {
      const localName = namedImport.getAliasNode()?.getText() ?? namedImport.getName();
      if (!usedIdentifiers.has(localName)) {
        toRemove.push(namedImport.getName());
      }
    }

    if (toRemove.length > 0 && toRemove.length === namedImports.length) {
      // Check if there's also a default import in use
      const defaultImport = importDecl.getDefaultImport();
      const hasUsedDefault =
        defaultImport && usedIdentifiers.has(defaultImport.getText());

      if (!hasUsedDefault) {
        // Remove the entire import declaration
        removed.push(
          ...toRemove.map((name) => ({
            file: filePath,
            name,
            moduleSpecifier,
          }))
        );
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

async function cleanUnusedExports(
  unusedExports: UnusedExport[],
  project: Project,
  dryRun: boolean
): Promise<UnusedExport[]> {
  const removed: UnusedExport[] = [];

  // Group by file
  const byFile = new Map<string, UnusedExport[]>();
  for (const exp of unusedExports) {
    if (!byFile.has(exp.file)) byFile.set(exp.file, []);
    byFile.get(exp.file)!.push(exp);
  }

  for (const [filePath, exports] of byFile) {
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) continue;

    for (const exp of exports) {
      const cleaned = removeExportModifier(sourceFile, exp);
      if (cleaned) removed.push(exp);
    }
  }

  if (!dryRun) {
    await project.save();
  }

  return removed;
}

function removeExportModifier(
  sourceFile: SourceFile,
  exp: UnusedExport
): boolean {
  for (const statement of sourceFile.getStatements()) {
    // Check export declarations
    if (statement.getKind() === SyntaxKind.ExportDeclaration) {
      const exportDecl = statement.asKind(SyntaxKind.ExportDeclaration);
      if (!exportDecl) continue;

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
    if (statement.getKind() === SyntaxKind.FunctionDeclaration) {
      const fn = statement.asKind(SyntaxKind.FunctionDeclaration);
      if (!fn || fn.getName() !== exp.name) continue;
      if (!fn.isExported()) continue;

      // Remove the export keyword but keep the function
      fn.toggleModifier("export", false);
      return true;
    }

    // Check exported variable statements
    if (statement.getKind() === SyntaxKind.VariableStatement) {
      const varStmt = statement.asKind(SyntaxKind.VariableStatement);
      if (!varStmt) continue;

      const hasExport = varStmt
        .getModifiers()
        .some((m) => m.getKind() === SyntaxKind.ExportKeyword);
      if (!hasExport) continue;

      const matchingDecl = varStmt
        .getDeclarationList()
        .getDeclarations()
        .find((d) => d.getName() === exp.name);

      if (!matchingDecl) continue;

      varStmt.toggleModifier("export", false);
      return true;
    }
  }

  return false;
}

function getUsedIdentifiers(sourceFile: SourceFile): Set<string> {
  const used = new Set<string>();

  sourceFile.forEachDescendant((node) => {
    // Skip import declarations — we don't want to count the imported names themselves
    if (
      node.getKind() === SyntaxKind.ImportDeclaration ||
      node.getKind() === SyntaxKind.ImportSpecifier
    ) {
      return;
    }

    if (node.getKind() === SyntaxKind.Identifier) {
      used.add(node.getText());
    }
  });

  return used;
}

function matchesIgnorePatterns(
  filePath: string,
  patterns: string[]
): boolean {
  for (const pattern of patterns) {
    const regex = globToRegex(pattern);
    if (regex.test(filePath)) return true;
  }
  return false;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");
  return new RegExp(escaped);
}

export function removeEmptyDirectories(dir: string): void {
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
  } catch {
    // Ignore errors
  }
}
