import { DependencyGraph } from "./types";

export function createGraph(): DependencyGraph {
  return {
    dependencies: new Map(),
    dependents: new Map(),
    files: new Set(),
  };
}

export function addFile(graph: DependencyGraph, filePath: string): void {
  graph.files.add(filePath);
  if (!graph.dependencies.has(filePath)) {
    graph.dependencies.set(filePath, new Set());
  }
  if (!graph.dependents.has(filePath)) {
    graph.dependents.set(filePath, new Set());
  }
}

export function addEdge(
  graph: DependencyGraph,
  from: string,
  to: string
): void {
  addFile(graph, from);
  addFile(graph, to);

  graph.dependencies.get(from)!.add(to);
  graph.dependents.get(to)!.add(from);
}

export function getReachableFiles(
  graph: DependencyGraph,
  entryPoints: string[]
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  // Seed with entry points that exist in the graph
  for (const entry of entryPoints) {
    if (graph.files.has(entry)) {
      queue.push(entry);
      reachable.add(entry);
    }
  }

  // BFS
  while (queue.length > 0) {
    const current = queue.shift()!;
    const deps = graph.dependencies.get(current);

    if (!deps) continue;

    for (const dep of deps) {
      if (!reachable.has(dep)) {
        reachable.add(dep);
        queue.push(dep);
      }
    }
  }

  return reachable;
}

export function getUnreachableFiles(
  graph: DependencyGraph,
  entryPoints: string[]
): string[] {
  const reachable = getReachableFiles(graph, entryPoints);
  const unreachable: string[] = [];

  for (const file of graph.files) {
    if (!reachable.has(file)) {
      unreachable.push(file);
    }
  }

  return unreachable.sort();
}

export function getFileDependencies(
  graph: DependencyGraph,
  filePath: string
): string[] {
  return [...(graph.dependencies.get(filePath) ?? [])];
}

export function getFileDependents(
  graph: DependencyGraph,
  filePath: string
): string[] {
  return [...(graph.dependents.get(filePath) ?? [])];
}

export function getGraphStats(graph: DependencyGraph): {
  totalFiles: number;
  totalEdges: number;
  orphanFiles: number;
} {
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

export function buildGraphFromFileInfos(
  fileInfos: Map<
    string,
    {
      path: string;
      imports: { resolvedPath: string | null; isDynamic: boolean }[];
      reExportEdges?: string[];
    }
  >
): DependencyGraph {
  const graph = createGraph();

  for (const [filePath, info] of fileInfos) {
    addFile(graph, filePath);

    // Static and dynamic imports
    for (const imp of info.imports) {
      if (!imp.resolvedPath) continue;
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
