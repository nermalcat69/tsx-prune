import { DependencyGraph } from "./types";
export declare function createGraph(): DependencyGraph;
export declare function addFile(graph: DependencyGraph, filePath: string): void;
export declare function addEdge(graph: DependencyGraph, from: string, to: string): void;
export declare function getReachableFiles(graph: DependencyGraph, entryPoints: string[]): Set<string>;
export declare function getUnreachableFiles(graph: DependencyGraph, entryPoints: string[]): string[];
export declare function getFileDependencies(graph: DependencyGraph, filePath: string): string[];
export declare function getFileDependents(graph: DependencyGraph, filePath: string): string[];
export declare function getGraphStats(graph: DependencyGraph): {
    totalFiles: number;
    totalEdges: number;
    orphanFiles: number;
};
export declare function buildGraphFromFileInfos(fileInfos: Map<string, {
    path: string;
    imports: {
        resolvedPath: string | null;
        isDynamic: boolean;
    }[];
}>): DependencyGraph;
//# sourceMappingURL=graph.d.ts.map