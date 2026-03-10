export declare function normalizePath(filePath: string): string;
export declare function isAbsolutePath(filePath: string): boolean;
export declare function resolveRelativePath(from: string, to: string): string;
export declare function fileExists(filePath: string): boolean;
export declare function readJsonFile<T>(filePath: string): T | null;
export declare function stripExtension(filePath: string): string;
export declare function ensureExtension(filePath: string, extensions?: string[]): string | null;
export declare function formatFileSize(bytes: number): string;
export declare function getFileSize(filePath: string): number;
export declare function plural(count: number, word: string): string;
export declare function deduplicateArray<T>(arr: T[]): T[];
export declare function sortPaths(paths: string[]): string[];
export declare function relativeTo(filePath: string, cwd: string): string;
export declare function isTestFile(filePath: string): boolean;
export declare function isStoriesFile(filePath: string): boolean;
export declare function isDeclarationFile(filePath: string): boolean;
export declare function isNextjsFrameworkFile(filePath: string): boolean;
export declare function isSafeToDelete(filePath: string): boolean;
//# sourceMappingURL=utils.d.ts.map