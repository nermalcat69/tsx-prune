import { TsxPruneConfig } from "./types";
export declare function getDefaultConfig(cwd: string): TsxPruneConfig;
export interface ConfigFileShape {
    entry?: string[];
    ignore?: string[];
    root?: string;
    extensions?: string[];
    tsconfig?: string;
}
export declare function loadConfigFile(cwd: string): ConfigFileShape | null;
export declare function mergeConfig(base: TsxPruneConfig, fileConfig: ConfigFileShape | null, cliOverrides: Partial<TsxPruneConfig>): TsxPruneConfig;
//# sourceMappingURL=config.d.ts.map