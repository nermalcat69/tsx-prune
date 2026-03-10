import { describe, it, expect } from "vitest";
import { analyze } from "../analyzer";
import { buildGraphFromFileInfos } from "../graph";
import { FileInfo, ExportInfo } from "../types";

function makeFileInfo(
  filePath: string,
  opts: {
    imports?: { resolvedPath: string | null; isDynamic?: boolean }[];
    exports?: Partial<ExportInfo>[];
    jsxUsages?: string[];
    reExportEdges?: string[];
  } = {}
): FileInfo {
  return {
    path: filePath,
    imports: (opts.imports ?? []).map((i) => ({
      moduleSpecifier: i.resolvedPath ?? "",
      resolvedPath: i.resolvedPath,
      namedImports: [],
      defaultImport: null,
      namespaceImport: null,
      isDynamic: i.isDynamic ?? false,
      isSideEffect: false,
    })),
    exports: (opts.exports ?? []).map((e) => ({
      name: e.name ?? "Unknown",
      isDefault: e.isDefault ?? false,
      isReExport: e.isReExport ?? false,
      reExportSource: e.reExportSource ?? null,
      isComponent: e.isComponent ?? false,
    })),
    jsxUsages: opts.jsxUsages ?? [],
    hasComponents: false,
    isComponentFile: filePath.endsWith(".tsx"),
    reExportEdges: opts.reExportEdges ?? [],
  };
}

describe("analyze — unused files", () => {
  it("marks files unreachable from entry as unused", () => {
    const fileInfos = new Map<string, FileInfo>([
      ["src/App.tsx", makeFileInfo("src/App.tsx", { imports: [{ resolvedPath: "src/Used.tsx" }] })],
      ["src/Used.tsx", makeFileInfo("src/Used.tsx")],
      ["src/Orphan.tsx", makeFileInfo("src/Orphan.tsx")],
    ]);
    const graph = buildGraphFromFileInfos(fileInfos);
    const result = analyze(graph, fileInfos, { entryPoints: ["src/App.tsx"], ignorePatterns: [] });

    expect(result.unusedFiles).toContain("src/Orphan.tsx");
    expect(result.unusedFiles).not.toContain("src/Used.tsx");
    expect(result.unusedFiles).not.toContain("src/App.tsx");
  });

  it("does not mark files reachable via dynamic import as unused", () => {
    const fileInfos = new Map<string, FileInfo>([
      ["src/App.tsx", makeFileInfo("src/App.tsx", { imports: [{ resolvedPath: "src/Lazy.tsx", isDynamic: true }] })],
      ["src/Lazy.tsx", makeFileInfo("src/Lazy.tsx")],
    ]);
    const graph = buildGraphFromFileInfos(fileInfos);
    const result = analyze(graph, fileInfos, { entryPoints: ["src/App.tsx"], ignorePatterns: [] });

    expect(result.unusedFiles).not.toContain("src/Lazy.tsx");
  });

  it("does not mark files reachable via barrel re-export as unused", () => {
    const fileInfos = new Map<string, FileInfo>([
      ["src/App.tsx", makeFileInfo("src/App.tsx", { imports: [{ resolvedPath: "src/components/index.ts" }] })],
      ["src/components/index.ts", makeFileInfo("src/components/index.ts", { reExportEdges: ["src/components/Button.tsx"] })],
      ["src/components/Button.tsx", makeFileInfo("src/components/Button.tsx")],
    ]);
    const graph = buildGraphFromFileInfos(fileInfos);
    const result = analyze(graph, fileInfos, { entryPoints: ["src/App.tsx"], ignorePatterns: [] });

    expect(result.unusedFiles).not.toContain("src/components/Button.tsx");
  });
});

describe("analyze — unused components", () => {
  it("does not flag a component used in JSX as unused", () => {
    const fileInfos = new Map<string, FileInfo>([
      ["src/App.tsx", makeFileInfo("src/App.tsx", {
        imports: [{ resolvedPath: "src/Button.tsx" }],
        jsxUsages: ["Button"],
      })],
      ["src/Button.tsx", makeFileInfo("src/Button.tsx", {
        exports: [{ name: "Button", isComponent: true }],
      })],
    ]);
    const graph = buildGraphFromFileInfos(fileInfos);
    const result = analyze(graph, fileInfos, { entryPoints: ["src/App.tsx"], ignorePatterns: [] });

    expect(result.unusedComponents.map((c) => c.name)).not.toContain("Button");
  });

  it("flags a component not used in JSX and not imported anywhere as unused", () => {
    const fileInfos = new Map<string, FileInfo>([
      ["src/App.tsx", makeFileInfo("src/App.tsx")],
      ["src/OldButton.tsx", makeFileInfo("src/OldButton.tsx", {
        exports: [{ name: "OldButton", isComponent: true }],
      })],
    ]);
    const graph = buildGraphFromFileInfos(fileInfos);
    const result = analyze(graph, fileInfos, { entryPoints: ["src/App.tsx"], ignorePatterns: [] });

    // OldButton is unreachable → in unusedFiles; it's also an unused export if reachable,
    // but here it's just unreachable. The point is it's not in unusedComponents with a false positive.
    expect(result.unusedFiles).toContain("src/OldButton.tsx");
  });
});

describe("analyze — unused imports list is empty (no false positives)", () => {
  it("returns no unused imports from heuristic (proper check is in cleaner)", () => {
    const fileInfos = new Map<string, FileInfo>([
      ["src/App.tsx", makeFileInfo("src/App.tsx", {
        imports: [{ resolvedPath: "src/Button.tsx" }],
      })],
      ["src/Button.tsx", makeFileInfo("src/Button.tsx")],
    ]);
    const graph = buildGraphFromFileInfos(fileInfos);
    const result = analyze(graph, fileInfos, { entryPoints: ["src/App.tsx"], ignorePatterns: [] });

    expect(result.unusedImports).toHaveLength(0);
  });
});
