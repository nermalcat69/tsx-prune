export interface TsxPruneConfig {
  /** Entry point files or globs. Default: src/main.tsx, src/index.tsx, etc. */
  entry: string[];
  /** Glob patterns to ignore */
  ignore: string[];
  /** Root directory to scan */
  root: string;
  /** File extensions to include */
  extensions: string[];
  /** Path to tsconfig.json */
  tsconfig: string;
  /** Whether to output JSON */
  json: boolean;
  /** Suppress all output */
  silent: boolean;
}

export interface FileInfo {
  /** Absolute file path */
  path: string;
  /** Imports extracted from this file */
  imports: ImportInfo[];
  /** Exports extracted from this file */
  exports: ExportInfo[];
  /** JSX component usages in this file */
  jsxUsages: string[];
  /** Whether this file contains React components */
  hasComponents: boolean;
  /** Whether this file is a React component file */
  isComponentFile: boolean;
  /**
   * Resolved absolute paths of re-export sources.
   * e.g. `export * from "./Button"` adds Button's resolved path here.
   * Used to build graph edges so barrel files don't cut the reachability chain.
   */
  reExportEdges: string[];
}

export interface ImportInfo {
  /** The module specifier (e.g. "./Button", "react") */
  moduleSpecifier: string;
  /** Resolved absolute path (null for node_modules) */
  resolvedPath: string | null;
  /** Named imports */
  namedImports: string[];
  /** Default import name */
  defaultImport: string | null;
  /** Namespace import name (import * as X) */
  namespaceImport: string | null;
  /** Whether this is a dynamic import */
  isDynamic: boolean;
  /** Whether this is a side-effect-only import */
  isSideEffect: boolean;
}

export interface ExportInfo {
  /** Export name ("default" for default exports) */
  name: string;
  /** Whether this is a default export */
  isDefault: boolean;
  /** Whether this is a re-export */
  isReExport: boolean;
  /** Source file for re-exports */
  reExportSource: string | null;
  /** Whether this export is a React component */
  isComponent: boolean;
}

export interface DependencyGraph {
  /** file path → set of file paths it imports */
  dependencies: Map<string, Set<string>>;
  /** file path → set of file paths that import it */
  dependents: Map<string, Set<string>>;
  /** All file paths in the graph */
  files: Set<string>;
}

export interface AnalysisResult {
  /** Files not reachable from any entry point */
  unusedFiles: string[];
  /** Exports never imported anywhere */
  unusedExports: UnusedExport[];
  /** Imports not used in the file body */
  unusedImports: UnusedImport[];
  /** React components never referenced in JSX */
  unusedComponents: UnusedComponent[];
  /** Total files scanned */
  totalFiles: number;
  /** Total exports found */
  totalExports: number;
  /** Total imports found */
  totalImports: number;
  /** Reachable files from entry points */
  reachableFiles: Set<string>;
}

export interface UnusedExport {
  /** File containing the export */
  file: string;
  /** Export name */
  name: string;
  /** Whether it's a React component */
  isComponent: boolean;
}

export interface UnusedImport {
  /** File containing the unused import */
  file: string;
  /** Import name */
  name: string;
  /** Module it was imported from */
  moduleSpecifier: string;
}

export interface UnusedComponent {
  /** File defining the component */
  file: string;
  /** Component name */
  name: string;
}

export interface CleanResult {
  /** Files deleted */
  deletedFiles: string[];
  /** Files that would be deleted (dry run) */
  wouldDeleteFiles: string[];
  /** Import statements removed */
  removedImports: UnusedImport[];
  /** Export statements removed */
  removedExports: UnusedExport[];
  /** Files skipped (safety rules) */
  skippedFiles: string[];
}

export interface ReportOptions {
  json: boolean;
  silent: boolean;
  cwd: string;
}
