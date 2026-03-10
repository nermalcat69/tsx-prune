export interface ResolverOptions {
    root: string;
    tsconfig: string;
    extensions: string[];
}
export declare class ImportResolver {
    private baseUrl;
    private paths;
    private extensions;
    private root;
    private cache;
    constructor(options: ResolverOptions);
    private loadTsConfig;
    resolve(importSpecifier: string, fromFile: string): string | null;
    private isExternalModule;
    private resolveRelative;
    private resolveAlias;
    private matchesPathAlias;
    private resolvePathAlias;
    private tryResolveFromBase;
    private pathPatternToRegex;
    private tryWithExtensions;
}
//# sourceMappingURL=resolver.d.ts.map