import chalk from "chalk";
import {
  AnalysisResult,
  CleanResult,
  ReportOptions,
  UnusedExport,
  UnusedImport,
} from "./types";
import { plural, relativeTo, sortPaths } from "./utils";

interface JsonReport {
  summary: {
    totalFiles: number;
    unusedFiles: number;
    unusedExports: number;
    unusedImports: number;
    unusedComponents: number;
  };
  unusedFiles: string[];
  unusedExports: Array<{ file: string; name: string; isComponent: boolean }>;
  unusedImports: Array<{ file: string; name: string; moduleSpecifier: string }>;
  unusedComponents: Array<{ file: string; name: string }>;
}

export function reportAnalysis(
  result: AnalysisResult,
  options: ReportOptions
): void {
  if (options.json) {
    reportJson(result, options);
    return;
  }

  if (options.silent) return;

  reportText(result, options);
}

function reportText(result: AnalysisResult, options: ReportOptions): void {
  const { cwd } = options;
  const hasIssues =
    result.unusedFiles.length > 0 ||
    result.unusedExports.length > 0 ||
    result.unusedComponents.length > 0;

  // Unused files
  if (result.unusedFiles.length > 0) {
    console.log(chalk.yellow.bold("\nUnused Files:"));
    for (const file of sortPaths(result.unusedFiles)) {
      console.log(chalk.red("  ✗ ") + chalk.dim(relativeTo(file, cwd)));
    }
    console.log(
      chalk.yellow(
        `  ${plural(result.unusedFiles.length, "unused file")} found`
      )
    );
  }

  // Unused exports
  if (result.unusedExports.length > 0) {
    console.log(chalk.yellow.bold("\nUnused Exports:"));

    const byFile = groupByFile(result.unusedExports);
    for (const [file, exports] of byFile) {
      console.log(chalk.dim("  " + relativeTo(file, cwd)));
      for (const exp of exports) {
        const label = exp.isComponent
          ? chalk.cyan(`<${exp.name}>`)
          : chalk.white(exp.name);
        console.log(`    ${chalk.red("✗")} ${label}`);
      }
    }
    console.log(
      chalk.yellow(
        `  ${plural(result.unusedExports.length, "unused export")} found`
      )
    );
  }

  // Unused components (summary if not already shown)
  if (result.unusedComponents.length > 0) {
    const componentNames = result.unusedComponents
      .map((c) => chalk.cyan(`<${c.name}>`))
      .join(", ");
    console.log(chalk.yellow.bold("\nUnused React Components:"));
    console.log(`  ${componentNames}`);
    console.log(
      chalk.yellow(
        `  ${plural(result.unusedComponents.length, "unused component")} found`
      )
    );
  }

  // Summary
  console.log(chalk.bold("\n─────────────────────────────────────────"));
  console.log(
    chalk.bold("Summary:"),
    chalk.dim(`${result.totalFiles} files scanned`)
  );

  if (!hasIssues) {
    console.log(chalk.green.bold("  ✓ No unused code found!"));
  } else {
    if (result.unusedFiles.length > 0) {
      console.log(
        chalk.red(`  ✗ ${plural(result.unusedFiles.length, "unused file")}`)
      );
    }
    if (result.unusedExports.length > 0) {
      console.log(
        chalk.red(
          `  ✗ ${plural(result.unusedExports.length, "unused export")}`
        )
      );
    }
    if (result.unusedComponents.length > 0) {
      console.log(
        chalk.red(
          `  ✗ ${plural(result.unusedComponents.length, "unused React component")}`
        )
      );
    }
  }
}

function reportJson(result: AnalysisResult, options: ReportOptions): void {
  const { cwd } = options;
  const report: JsonReport = {
    summary: {
      totalFiles: result.totalFiles,
      unusedFiles: result.unusedFiles.length,
      unusedExports: result.unusedExports.length,
      unusedImports: result.unusedImports.length,
      unusedComponents: result.unusedComponents.length,
    },
    unusedFiles: result.unusedFiles.map((f) => relativeTo(f, cwd)),
    unusedExports: result.unusedExports.map((e) => ({
      file: relativeTo(e.file, cwd),
      name: e.name,
      isComponent: e.isComponent,
    })),
    unusedImports: result.unusedImports.map((i) => ({
      file: relativeTo(i.file, cwd),
      name: i.name,
      moduleSpecifier: i.moduleSpecifier,
    })),
    unusedComponents: result.unusedComponents.map((c) => ({
      file: relativeTo(c.file, cwd),
      name: c.name,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
}

export function reportCleanResult(
  cleanResult: CleanResult,
  options: ReportOptions
): void {
  if (options.json || options.silent) return;

  const { cwd } = options;

  if (cleanResult.deletedFiles.length > 0) {
    console.log(chalk.green.bold("\nDeleted Files:"));
    for (const file of cleanResult.deletedFiles) {
      console.log(chalk.green("  ✓ ") + chalk.dim(relativeTo(file, cwd)));
    }
  }

  if (cleanResult.wouldDeleteFiles.length > 0) {
    console.log(chalk.yellow.bold("\nWould Delete Files (dry run):"));
    for (const file of cleanResult.wouldDeleteFiles) {
      console.log(chalk.yellow("  ~ ") + chalk.dim(relativeTo(file, cwd)));
    }
  }

  if (cleanResult.removedImports.length > 0) {
    console.log(
      chalk.green.bold("\nRemoved Unused Imports:")
    );
    const byFile = groupUnusedImportsByFile(cleanResult.removedImports);
    for (const [file, imports] of byFile) {
      console.log(chalk.dim("  " + relativeTo(file, cwd)));
      for (const imp of imports) {
        console.log(
          `    ${chalk.green("✓")} ${chalk.white(imp.name)} from ${chalk.dim(imp.moduleSpecifier)}`
        );
      }
    }
  }

  if (cleanResult.removedExports.length > 0) {
    console.log(chalk.green.bold("\nRemoved Export Modifiers:"));
    const byFile = groupByFile(cleanResult.removedExports);
    for (const [file, exports] of byFile) {
      console.log(chalk.dim("  " + relativeTo(file, cwd)));
      for (const exp of exports) {
        console.log(`    ${chalk.green("✓")} ${chalk.white(exp.name)}`);
      }
    }
  }

  if (cleanResult.skippedFiles.length > 0) {
    console.log(chalk.dim(`\nSkipped ${cleanResult.skippedFiles.length} protected files (tests, stories)`));
  }
}

function groupByFile(
  items: UnusedExport[]
): Map<string, UnusedExport[]> {
  const map = new Map<string, UnusedExport[]>();
  for (const item of items) {
    if (!map.has(item.file)) map.set(item.file, []);
    map.get(item.file)!.push(item);
  }
  return map;
}

function groupUnusedImportsByFile(
  items: UnusedImport[]
): Map<string, UnusedImport[]> {
  const map = new Map<string, UnusedImport[]>();
  for (const item of items) {
    if (!map.has(item.file)) map.set(item.file, []);
    map.get(item.file)!.push(item);
  }
  return map;
}

export function printBanner(silent: boolean, json = false): void {
  if (silent || json) return;
  console.log(
    chalk.bold.cyan(`
  ████████╗███████╗██╗  ██╗      ██████╗ ██████╗ ██╗   ██╗███╗   ██╗███████╗
     ██╔══╝██╔════╝╚██╗██╔╝      ██╔══██╗██╔══██╗██║   ██║████╗  ██║██╔════╝
     ██║   ███████╗ ╚███╔╝ █████╗██████╔╝██████╔╝██║   ██║██╔██╗ ██║█████╗
     ██║   ╚════██║ ██╔██╗ ╚════╝██╔═══╝ ██╔══██╗██║   ██║██║╚██╗██║██╔══╝
     ██║   ███████║██╔╝ ██╗      ██║     ██║  ██║╚██████╔╝██║ ╚████║███████╗
     ╚═╝   ╚══════╝╚═╝  ╚═╝      ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
  `)
  );
}

export function printScanningMessage(fileCount: number, silent: boolean, json = false): void {
  if (silent || json) return;
  console.log(chalk.dim(`Scanning ${fileCount} files...`));
}

export function printDone(dryRun: boolean, silent: boolean, json = false): void {
  if (silent || json) return;
  if (dryRun) {
    console.log(chalk.dim("\nDry run complete. Use ") + chalk.bold("--delete") + chalk.dim(" to remove unused files."));
  } else {
    console.log(chalk.green.bold("\nDone!"));
  }
}
