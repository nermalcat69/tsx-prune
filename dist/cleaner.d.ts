import { Project } from "ts-morph";
import { AnalysisResult, CleanResult } from "./types";
export interface CleanOptions {
    dryRun: boolean;
    fixImports: boolean;
    fixExports: boolean;
    ignorePatterns: string[];
}
export declare function clean(result: AnalysisResult, project: Project, options: CleanOptions): Promise<CleanResult>;
export declare function removeEmptyDirectories(dir: string): void;
//# sourceMappingURL=cleaner.d.ts.map