import { SourceFile } from "ts-morph";
import { FileInfo } from "./types";
export interface ParserOptions {
    tsconfig: string;
    root: string;
    extensions: string[];
}
export declare class Parser {
    private project;
    private resolver;
    private fileCache;
    constructor(options: ParserOptions);
    addFiles(filePaths: string[]): void;
    parseFile(filePath: string): FileInfo;
    private extractFileInfo;
    private extractImports;
    private processImportDeclaration;
    private extractExports;
    private extractExportedDeclaration;
    private extractJsxUsages;
    private detectComponents;
    private isComponentName;
    private functionReturnsJsx;
    private initializerReturnsJsx;
    getResolvedImportPaths(fileInfo: FileInfo): string[];
    getCachedFile(filePath: string): FileInfo | undefined;
    clearCache(): void;
}
export declare function getUsedIdentifiers(sourceFile: SourceFile): Set<string>;
export declare function isComponentFile(filePath: string): boolean;
//# sourceMappingURL=parser.d.ts.map