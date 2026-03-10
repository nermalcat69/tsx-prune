import { AnalysisResult, CleanResult, ReportOptions } from "./types";
export declare function reportAnalysis(result: AnalysisResult, options: ReportOptions): void;
export declare function reportCleanResult(cleanResult: CleanResult, options: ReportOptions): void;
export declare function printBanner(silent: boolean, json?: boolean): void;
export declare function printScanningMessage(fileCount: number, silent: boolean, json?: boolean): void;
export declare function printDone(dryRun: boolean, silent: boolean, json?: boolean): void;
//# sourceMappingURL=reporter.d.ts.map