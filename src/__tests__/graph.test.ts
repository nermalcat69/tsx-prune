import { describe, it, expect } from "vitest";
import {
  createGraph,
  addEdge,
  addFile,
  getReachableFiles,
  buildGraphFromFileInfos,
} from "../graph";
import { FileInfo } from "../types";

function makeFileInfo(
  filePath: string,
  imports: { resolvedPath: string | null; isDynamic?: boolean }[] = [],
  reExportEdges: string[] = []
): FileInfo {
  return {
    path: filePath,
    imports: imports.map((i) => ({
      moduleSpecifier: i.resolvedPath ?? "",
      resolvedPath: i.resolvedPath,
      namedImports: [],
      defaultImport: null,
      namespaceImport: null,
      isDynamic: i.isDynamic ?? false,
      isSideEffect: false,
    })),
    exports: [],
    jsxUsages: [],
    hasComponents: false,
    isComponentFile: false,
    reExportEdges,
  };
}

describe("createGraph / addEdge / getReachableFiles", () => {
  it("returns only reachable files via BFS", () => {
    const graph = createGraph();
    addEdge(graph, "A.ts", "B.ts");
    addEdge(graph, "B.ts", "C.ts");
    addFile(graph, "D.ts"); // orphan

    const reachable = getReachableFiles(graph, ["A.ts"]);
    expect(reachable.has("A.ts")).toBe(true);
    expect(reachable.has("B.ts")).toBe(true);
    expect(reachable.has("C.ts")).toBe(true);
    expect(reachable.has("D.ts")).toBe(false);
  });
});

describe("buildGraphFromFileInfos", () => {
  it("includes dynamic imports in graph edges", () => {
    const fileInfos = new Map<string, FileInfo>([
      ["App.tsx", makeFileInfo("App.tsx", [{ resolvedPath: "Lazy.tsx", isDynamic: true }])],
      ["Lazy.tsx", makeFileInfo("Lazy.tsx")],
    ]);

    const graph = buildGraphFromFileInfos(fileInfos);
    const reachable = getReachableFiles(graph, ["App.tsx"]);
    expect(reachable.has("Lazy.tsx")).toBe(true);
  });

  it("includes re-export edges in graph (barrel files)", () => {
    // index.ts re-exports Button.tsx; App.tsx imports index.ts
    const fileInfos = new Map<string, FileInfo>([
      ["App.tsx", makeFileInfo("App.tsx", [{ resolvedPath: "index.ts" }])],
      ["index.ts", makeFileInfo("index.ts", [], ["Button.tsx", "Card.tsx"])],
      ["Button.tsx", makeFileInfo("Button.tsx")],
      ["Card.tsx", makeFileInfo("Card.tsx")],
    ]);

    const graph = buildGraphFromFileInfos(fileInfos);
    const reachable = getReachableFiles(graph, ["App.tsx"]);
    expect(reachable.has("index.ts")).toBe(true);
    expect(reachable.has("Button.tsx")).toBe(true);
    expect(reachable.has("Card.tsx")).toBe(true);
  });

  it("skips unresolved import paths", () => {
    const fileInfos = new Map<string, FileInfo>([
      ["App.tsx", makeFileInfo("App.tsx", [{ resolvedPath: null }])],
    ]);

    const graph = buildGraphFromFileInfos(fileInfos);
    expect(graph.files.size).toBe(1);
    expect(graph.dependencies.get("App.tsx")!.size).toBe(0);
  });
});
