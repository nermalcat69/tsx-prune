import { DependencyGraph, FileInfo, AnalysisResult } from "./types";
export interface AnalyzerOptions {
    entryPoints: string[];
    ignorePatterns: string[];
}
export declare function analyze(graph: DependencyGraph, fileInfos: Map<string, FileInfo>, options: AnalyzerOptions): AnalysisResult;
//# sourceMappingURL=analyzer.d.ts.map