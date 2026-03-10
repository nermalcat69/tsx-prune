import { AnalysisResult, CleanResult, DependencyGraph, ReportOptions } from "./types";
export declare function reportAnalysis(result: AnalysisResult, options: ReportOptions): void;
export declare function reportCleanResult(cleanResult: CleanResult, options: ReportOptions): void;
export declare function printBanner(silent: boolean, json?: boolean): void;
export declare function printScanningMessage(fileCount: number, silent: boolean, json?: boolean): void;
export declare function printDone(dryRun: boolean, silent: boolean, json?: boolean): void;
/**
 * Prints a tree-style dependency graph starting from each entry point.
 * Used by --debug and the `graph` subcommand.
 */
export declare function printDependencyGraph(graph: DependencyGraph, entryPoints: string[], root: string, silent: boolean, json?: boolean): void;
//# sourceMappingURL=reporter.d.ts.map