import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ImportResolver } from "../resolver";

// ─── helper: create a temp project tree ─────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsx-prune-test-"));

  // Project structure:
  //   src/
  //     components/
  //       Button.tsx
  //       index.ts
  //     utils/
  //       helpers.ts
  //   tsconfig.json

  fs.mkdirSync(path.join(tmpDir, "src", "components"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "src", "utils"), { recursive: true });

  fs.writeFileSync(path.join(tmpDir, "src", "components", "Button.tsx"), "export const Button = () => null;");
  fs.writeFileSync(path.join(tmpDir, "src", "components", "index.ts"), 'export * from "./Button";');
  fs.writeFileSync(path.join(tmpDir, "src", "utils", "helpers.ts"), "export const noop = () => {};");

  const tsconfig = {
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@/*": ["src/*"],
        "@components/*": ["src/components/*"],
      },
    },
  };
  fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), JSON.stringify(tsconfig));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("ImportResolver — relative imports", () => {
  it("resolves ./Button from src/components/index.ts", () => {
    const resolver = new ImportResolver({
      root: tmpDir,
      tsconfig: path.join(tmpDir, "tsconfig.json"),
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    });

    const from = path.join(tmpDir, "src", "components", "index.ts");
    const resolved = resolver.resolve("./Button", from);
    expect(resolved).toBe(path.join(tmpDir, "src", "components", "Button.tsx").replace(/\\/g, "/"));
  });

  it("resolves ../utils/helpers from src/components/Button.tsx", () => {
    const resolver = new ImportResolver({
      root: tmpDir,
      tsconfig: path.join(tmpDir, "tsconfig.json"),
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    });

    const from = path.join(tmpDir, "src", "components", "Button.tsx");
    const resolved = resolver.resolve("../utils/helpers", from);
    expect(resolved).toBe(path.join(tmpDir, "src", "utils", "helpers.ts").replace(/\\/g, "/"));
  });
});

describe("ImportResolver — path aliases", () => {
  it("resolves @/components/Button to src/components/Button.tsx", () => {
    const resolver = new ImportResolver({
      root: tmpDir,
      tsconfig: path.join(tmpDir, "tsconfig.json"),
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    });

    const from = path.join(tmpDir, "src", "App.tsx");
    const resolved = resolver.resolve("@/components/Button", from);
    expect(resolved).toBe(path.join(tmpDir, "src", "components", "Button.tsx").replace(/\\/g, "/"));
  });

  it("resolves @components/Button via @components/* alias", () => {
    const resolver = new ImportResolver({
      root: tmpDir,
      tsconfig: path.join(tmpDir, "tsconfig.json"),
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    });

    const from = path.join(tmpDir, "src", "App.tsx");
    const resolved = resolver.resolve("@components/Button", from);
    expect(resolved).toBe(path.join(tmpDir, "src", "components", "Button.tsx").replace(/\\/g, "/"));
  });

  it("resolves @/components (barrel/index) to src/components/index.ts", () => {
    const resolver = new ImportResolver({
      root: tmpDir,
      tsconfig: path.join(tmpDir, "tsconfig.json"),
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    });

    const from = path.join(tmpDir, "src", "App.tsx");
    const resolved = resolver.resolve("@/components", from);
    expect(resolved).toBe(path.join(tmpDir, "src", "components", "index.ts").replace(/\\/g, "/"));
  });

  it("returns null for external node_modules", () => {
    const resolver = new ImportResolver({
      root: tmpDir,
      tsconfig: path.join(tmpDir, "tsconfig.json"),
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    });

    const from = path.join(tmpDir, "src", "App.tsx");
    expect(resolver.resolve("react", from)).toBeNull();
    expect(resolver.resolve("lodash", from)).toBeNull();
  });
});
