"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraph = createGraph;
exports.addFile = addFile;
exports.addEdge = addEdge;
exports.getReachableFiles = getReachableFiles;
exports.getUnreachableFiles = getUnreachableFiles;
exports.getFileDependencies = getFileDependencies;
exports.getFileDependents = getFileDependents;
exports.getGraphStats = getGraphStats;
exports.buildGraphFromFileInfos = buildGraphFromFileInfos;
function createGraph() {
    return {
        dependencies: new Map(),
        dependents: new Map(),
        files: new Set(),
    };
}
function addFile(graph, filePath) {
    graph.files.add(filePath);
    if (!graph.dependencies.has(filePath)) {
        graph.dependencies.set(filePath, new Set());
    }
    if (!graph.dependents.has(filePath)) {
        graph.dependents.set(filePath, new Set());
    }
}
function addEdge(graph, from, to) {
    addFile(graph, from);
    addFile(graph, to);
    graph.dependencies.get(from).add(to);
    graph.dependents.get(to).add(from);
}
function getReachableFiles(graph, entryPoints) {
    const reachable = new Set();
    const queue = [];
    // Seed with entry points that exist in the graph
    for (const entry of entryPoints) {
        if (graph.files.has(entry)) {
            queue.push(entry);
            reachable.add(entry);
        }
    }
    // BFS
    while (queue.length > 0) {
        const current = queue.shift();
        const deps = graph.dependencies.get(current);
        if (!deps)
            continue;
        for (const dep of deps) {
            if (!reachable.has(dep)) {
                reachable.add(dep);
                queue.push(dep);
            }
        }
    }
    return reachable;
}
function getUnreachableFiles(graph, entryPoints) {
    const reachable = getReachableFiles(graph, entryPoints);
    const unreachable = [];
    for (const file of graph.files) {
        if (!reachable.has(file)) {
            unreachable.push(file);
        }
    }
    return unreachable.sort();
}
function getFileDependencies(graph, filePath) {
    return [...(graph.dependencies.get(filePath) ?? [])];
}
function getFileDependents(graph, filePath) {
    return [...(graph.dependents.get(filePath) ?? [])];
}
function getGraphStats(graph) {
    let totalEdges = 0;
    let orphanFiles = 0;
    for (const [file, deps] of graph.dependencies) {
        totalEdges += deps.size;
        const dependents = graph.dependents.get(file);
        if (!dependents || dependents.size === 0) {
            orphanFiles++;
        }
    }
    return {
        totalFiles: graph.files.size,
        totalEdges,
        orphanFiles,
    };
}
function buildGraphFromFileInfos(fileInfos) {
    const graph = createGraph();
    for (const [filePath, info] of fileInfos) {
        addFile(graph, filePath);
        // Static and dynamic imports
        for (const imp of info.imports) {
            if (!imp.resolvedPath)
                continue;
            addEdge(graph, filePath, imp.resolvedPath);
        }
        // Re-export edges: `export * from "./Button"` / `export { X } from "./Button"`
        // These make barrel files transparently propagate reachability.
        for (const reExportPath of info.reExportEdges ?? []) {
            addEdge(graph, filePath, reExportPath);
        }
    }
    return graph;
}
//# sourceMappingURL=graph.js.map