import { DependencyGraph, FileInfo, AnalysisResult, UnusedExport, UnusedImport, UnusedComponent } from "./types";
import { getReachableFiles } from "./graph";
import { isSafeToDelete } from "./utils";

export interface AnalyzerOptions {
  entryPoints: string[];
  ignorePatterns: string[];
}

export function analyze(
  graph: DependencyGraph,
  fileInfos: Map<string, FileInfo>,
  options: AnalyzerOptions
): AnalysisResult {
  const { entryPoints } = options;

  // Step 1: Find reachable files via DFS/BFS from entry points
  const reachableFiles = getReachableFiles(graph, entryPoints);

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

function findUnusedFiles(
  graph: DependencyGraph,
  reachableFiles: Set<string>,
  options: AnalyzerOptions
): string[] {
  const unusedFiles: string[] = [];

  for (const filePath of graph.files) {
    if (reachableFiles.has(filePath)) continue;

    // Safety: never mark test/story files as unused
    if (!isSafeToDelete(filePath)) continue;

    // Check ignore patterns
    if (matchesIgnorePatterns(filePath, options.ignorePatterns)) continue;

    unusedFiles.push(filePath);
  }

  return unusedFiles.sort();
}

function findUnusedExports(
  fileInfos: Map<string, FileInfo>,
  reachableFiles: Set<string>
): UnusedExport[] {
  // Collect all imported names per file
  const importedNames = buildImportedNamesMap(fileInfos);

  const unusedExports: UnusedExport[] = [];

  for (const [filePath, info] of fileInfos) {
    // Skip unreachable files (they'll show up as unused files)
    if (!reachableFiles.has(filePath)) continue;

    for (const exp of info.exports) {
      // Skip re-exports — they forward exports and shouldn't be flagged
      if (exp.isReExport) continue;
      // Skip wildcard exports
      if (exp.name === "*") continue;

      const importedInFiles = importedNames.get(filePath);
      const isUsed =
        importedInFiles !== undefined && importedInFiles.has(exp.name);

      // Default exports: check if the file is imported as default anywhere
      const isDefaultUsed =
        exp.isDefault &&
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

  return unusedExports.sort((a, b) =>
    a.file !== b.file ? a.file.localeCompare(b.file) : a.name.localeCompare(b.name)
  );
}

/**
 * Builds a map: importedFile → Set of import names used from that file
 */
function buildImportedNamesMap(
  fileInfos: Map<string, FileInfo>
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const info of fileInfos.values()) {
    for (const imp of info.imports) {
      if (!imp.resolvedPath || imp.isDynamic) continue;

      if (!map.has(imp.resolvedPath)) {
        map.set(imp.resolvedPath, new Set());
      }

      const names = map.get(imp.resolvedPath)!;

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

function findUnusedImports(fileInfos: Map<string, FileInfo>): UnusedImport[] {
  const unusedImports: UnusedImport[] = [];

  // We need per-file identifier usage sets
  // For now we collect identifier usages from jsxUsages + export names
  // A more complete approach requires the raw SourceFile — done in cleaner.ts
  // Here we do a heuristic: check named imports against JSX usages and exports
  for (const [filePath, info] of fileInfos) {
    // Build a rough set of used names in the file (via JSX usages + exports referencing names)
    // The proper check is done when --fix-imports is requested via the cleaner
    const jsxUsed = new Set(info.jsxUsages);

    for (const imp of info.imports) {
      if (imp.isDynamic || imp.isSideEffect) continue;

      for (const name of imp.namedImports) {
        // If a named import is only used as JSX and we can detect it's not used — flag it
        // This is a conservative check — we only flag names that appear in neither JSX nor exports
        // The full AST-level check is done in cleanUnusedImports
        if (!jsxUsed.has(name)) {
          unusedImports.push({
            file: filePath,
            name,
            moduleSpecifier: imp.moduleSpecifier,
          });
        }
      }
    }
  }

  return unusedImports.sort((a, b) =>
    a.file !== b.file ? a.file.localeCompare(b.file) : a.name.localeCompare(b.name)
  );
}

function findUnusedComponents(
  fileInfos: Map<string, FileInfo>,
  unusedExports: UnusedExport[]
): UnusedComponent[] {
  // React components that are exported but never used in JSX anywhere
  const allJsxUsages = new Set<string>();

  for (const info of fileInfos.values()) {
    for (const usage of info.jsxUsages) {
      allJsxUsages.add(usage);
    }
  }

  const unusedComponents: UnusedComponent[] = [];

  for (const exp of unusedExports) {
    if (!exp.isComponent) continue;
    if (allJsxUsages.has(exp.name)) continue;

    unusedComponents.push({
      file: exp.file,
      name: exp.name,
    });
  }

  // Also check component exports from reachable files not in JSX
  for (const [filePath, info] of fileInfos) {
    for (const exp of info.exports) {
      if (!exp.isComponent) continue;
      if (exp.isReExport) continue;

      if (!allJsxUsages.has(exp.name)) {
        const alreadyAdded = unusedComponents.some(
          (c) => c.file === filePath && c.name === exp.name
        );
        if (!alreadyAdded) {
          unusedComponents.push({ file: filePath, name: exp.name });
        }
      }
    }
  }

  return unusedComponents.sort((a, b) =>
    a.file !== b.file ? a.file.localeCompare(b.file) : a.name.localeCompare(b.name)
  );
}

function matchesIgnorePatterns(
  filePath: string,
  patterns: string[]
): boolean {
  for (const pattern of patterns) {
    // Simple glob matching: convert to regex
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
