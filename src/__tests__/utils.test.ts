import { describe, it, expect } from "vitest";
import { isNextjsFrameworkFile, isSafeToDelete, isTestFile, isStoriesFile } from "../utils";

describe("isNextjsFrameworkFile", () => {
  it("protects next.config.js", () => {
    expect(isNextjsFrameworkFile("/project/next.config.js")).toBe(true);
    expect(isNextjsFrameworkFile("/project/next.config.ts")).toBe(true);
    expect(isNextjsFrameworkFile("/project/next.config.mjs")).toBe(true);
  });

  it("protects middleware", () => {
    expect(isNextjsFrameworkFile("/project/middleware.ts")).toBe(true);
    expect(isNextjsFrameworkFile("/project/middleware.js")).toBe(true);
  });

  it("protects App Router special files", () => {
    expect(isNextjsFrameworkFile("/project/app/layout.tsx")).toBe(true);
    expect(isNextjsFrameworkFile("/project/app/page.tsx")).toBe(true);
    expect(isNextjsFrameworkFile("/project/app/loading.tsx")).toBe(true);
    expect(isNextjsFrameworkFile("/project/app/error.tsx")).toBe(true);
    expect(isNextjsFrameworkFile("/project/app/not-found.tsx")).toBe(true);
  });

  it("protects Pages Router special files", () => {
    expect(isNextjsFrameworkFile("/project/pages/_app.tsx")).toBe(true);
    expect(isNextjsFrameworkFile("/project/pages/_document.tsx")).toBe(true);
    expect(isNextjsFrameworkFile("/project/pages/_error.tsx")).toBe(true);
  });

  it("protects API routes", () => {
    expect(isNextjsFrameworkFile("/project/pages/api/users.ts")).toBe(true);
    expect(isNextjsFrameworkFile("/project/pages/api/auth/[...nextauth].ts")).toBe(true);
  });

  it("does not protect normal files", () => {
    expect(isNextjsFrameworkFile("/project/src/components/Button.tsx")).toBe(false);
    expect(isNextjsFrameworkFile("/project/src/utils/api.ts")).toBe(false);
    expect(isNextjsFrameworkFile("/project/src/app/dashboard/page.tsx")).toBe(false);
  });
});

describe("isSafeToDelete", () => {
  it("marks test files as unsafe", () => {
    expect(isSafeToDelete("/project/Button.test.tsx")).toBe(false);
    expect(isSafeToDelete("/project/Button.spec.ts")).toBe(false);
    expect(isSafeToDelete("/project/__tests__/Button.ts")).toBe(false);
  });

  it("marks stories files as unsafe", () => {
    expect(isSafeToDelete("/project/Button.stories.tsx")).toBe(false);
  });

  it("marks Next.js framework files as unsafe", () => {
    expect(isSafeToDelete("/project/next.config.ts")).toBe(false);
    expect(isSafeToDelete("/project/middleware.ts")).toBe(false);
    expect(isSafeToDelete("/project/pages/_app.tsx")).toBe(false);
    expect(isSafeToDelete("/project/pages/api/hello.ts")).toBe(false);
  });

  it("allows deletion of regular files", () => {
    expect(isSafeToDelete("/project/src/OldButton.tsx")).toBe(true);
    expect(isSafeToDelete("/project/src/unused.ts")).toBe(true);
  });
});
