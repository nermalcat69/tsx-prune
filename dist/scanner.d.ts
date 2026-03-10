export interface ScanOptions {
    root: string;
    extensions: string[];
    ignore: string[];
    entry: string[];
}
export declare function scanFiles(options: ScanOptions): Promise<string[]>;
export declare function resolveEntryPoints(entry: string[], root: string): Promise<string[]>;
export declare const DEFAULT_EXTENSIONS: string[];
export declare const DEFAULT_ENTRY_PATTERNS: string[];
//# sourceMappingURL=scanner.d.ts.map