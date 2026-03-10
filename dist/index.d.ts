export { analyze } from "./analyzer";
export { Parser } from "./parser";
export { scanFiles, resolveEntryPoints } from "./scanner";
export { ImportResolver } from "./resolver";
export { createGraph, addEdge, getReachableFiles, getUnreachableFiles, buildGraphFromFileInfos, } from "./graph";
export { clean } from "./cleaner";
export { reportAnalysis, reportCleanResult } from "./reporter";
export { getDefaultConfig, loadConfigFile, mergeConfig } from "./config";
export type { TsxPruneConfig, FileInfo, ImportInfo, ExportInfo, DependencyGraph, AnalysisResult, UnusedExport, UnusedImport, UnusedComponent, CleanResult, } from "./types";
//# sourceMappingURL=index.d.ts.map