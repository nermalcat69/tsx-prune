#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import chalk from "chalk";
import { Project } from "ts-morph";

import { scanFiles, resolveEntryPoints } from "./scanner";
import { Parser } from "./parser";
import { buildGraphFromFileInfos } from "./graph";
import { analyze } from "./analyzer";
import { clean } from "./cleaner";
import {
  reportAnalysis,
  reportCleanResult,
  printBanner,
  printScanningMessage,
  printDone,
} from "./reporter";
import { getDefaultConfig, loadConfigFile, mergeConfig } from "./config";
import { normalizePath } from "./utils";
import { FileInfo } from "./types";

const pkg = require("../package.json") as { version: string };

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("tsx-prune")
    .description(
      "Analyze and remove unused components, files, imports, and exports in TypeScript/React codebases"
    )
    .version(pkg.version)
    .option("--delete", "Actually delete unused files (default: dry run)")
    .option("--dry-run", "Show what would be deleted without doing it (default)")
    .option("--fix-imports", "Remove unused import statements")
    .option("--fix-exports", "Remove export modifiers from unused exports")
    .option("--entry <paths...>", "Entry point files or globs")
    .option("--ignore <patterns...>", "Glob patterns to ignore")
    .option("--root <dir>", "Root directory to scan (default: cwd)")
    .option("--tsconfig <path>", "Path to tsconfig.json")
    .option("--json", "Output results as JSON")
    .option("--silent", "Suppress all output except errors")
    .option("--config <path>", "Path to tsx-prune config file")
    .parse(process.argv);

  const opts = program.opts<{
    delete?: boolean;
    dryRun?: boolean;
    fixImports?: boolean;
    fixExports?: boolean;
    entry?: string[];
    ignore?: string[];
    root?: string;
    tsconfig?: string;
    json?: boolean;
    silent?: boolean;
    config?: string;
  }>();

  const cwd = normalizePath(process.cwd());
  const root = opts.root ? normalizePath(path.resolve(cwd, opts.root)) : cwd;

  // Load base config
  const defaultConfig = getDefaultConfig(root);

  // Load config file
  const configFileDir = opts.config
    ? path.dirname(path.resolve(cwd, opts.config))
    : root;
  const fileConfig = loadConfigFile(configFileDir);

  // Merge with CLI overrides
  const config = mergeConfig(defaultConfig, fileConfig, {
    entry: opts.entry,
    ignore: opts.ignore,
    json: opts.json,
    silent: opts.silent,
    tsconfig: opts.tsconfig
      ? path.resolve(cwd, opts.tsconfig)
      : undefined,
  });

  const isDryRun = !opts.delete;

  printBanner(config.silent, config.json);

  if (!config.silent && !config.json) {
    console.log(chalk.dim(`Root: ${root}`));
    console.log(chalk.dim(`Tsconfig: ${config.tsconfig}`));
    console.log();
  }

  // Step 1: Scan files
  let allFiles: string[];
  try {
    allFiles = await scanFiles({
      root,
      extensions: config.extensions,
      ignore: config.ignore,
      entry: config.entry,
    });
  } catch (err) {
    console.error(chalk.red(`Error scanning files: ${err}`));
    process.exit(1);
  }

  if (allFiles.length === 0) {
    if (!config.silent) {
      console.log(chalk.yellow("No files found to scan."));
    }
    process.exit(0);
  }

  printScanningMessage(allFiles.length, config.silent, config.json);

  // Step 2: Resolve entry points
  let entryPoints: string[];
  try {
    entryPoints = await resolveEntryPoints(config.entry, root);
    // Filter to only files that exist in our scanned set
    const scannedSet = new Set(allFiles);
    entryPoints = entryPoints.filter((e) => scannedSet.has(e));
  } catch (err) {
    console.error(chalk.red(`Error resolving entry points: ${err}`));
    process.exit(1);
  }

  if (!config.silent && !config.json) {
    if (entryPoints.length === 0) {
      console.log(
        chalk.yellow(
          "Warning: No entry points found. All files will be reported as unused."
        )
      );
    } else {
      console.log(
        chalk.dim(
          `Entry points: ${entryPoints.length} found`
        )
      );
    }
  }

  // Step 3: Parse files and build dependency graph
  const parser = new Parser({
    tsconfig: config.tsconfig,
    root,
    extensions: config.extensions,
  });

  // Add all files to the project for cross-file analysis
  parser.addFiles(allFiles);

  const fileInfoMap = new Map<string, FileInfo>();
  let parsed = 0;

  for (const filePath of allFiles) {
    try {
      const info = parser.parseFile(filePath);
      fileInfoMap.set(filePath, info);
    } catch (_err) {
      // Skip files that can't be parsed
      if (!config.silent) {
        process.stderr.write(chalk.dim(`Warning: skipping ${filePath}\n`));
      }
    }

    parsed++;
    if (!config.silent && !config.json && parsed % 100 === 0) {
      process.stdout.write(chalk.dim(`\r  Parsed ${parsed}/${allFiles.length} files...`));
    }
  }

  if (!config.silent && !config.json && allFiles.length > 100) {
    process.stdout.write("\n");
  }

  // Step 4: Build dependency graph
  const graph = buildGraphFromFileInfos(
    fileInfoMap as Map<string, { path: string; imports: { resolvedPath: string | null; isDynamic: boolean }[] }>
  );

  // Step 5: Analyze
  const result = analyze(graph, fileInfoMap, {
    entryPoints,
    ignorePatterns: config.ignore,
  });

  // Step 6: Report
  reportAnalysis(result, {
    json: config.json,
    silent: config.silent,
    cwd: root,
  });

  // Step 7: Clean if requested
  const shouldClean =
    opts.delete || opts.fixImports || opts.fixExports;

  if (shouldClean) {
    // Create ts-morph project for code modifications
    const morphProject = new Project({
      tsConfigFilePath: config.tsconfig,
      skipAddingFilesFromTsConfig: true,
    });
    morphProject.addSourceFilesAtPaths(allFiles);

    const cleanResult = await clean(result, morphProject, {
      dryRun: isDryRun,
      fixImports: opts.fixImports ?? false,
      fixExports: opts.fixExports ?? false,
      ignorePatterns: config.ignore,
    });

    reportCleanResult(cleanResult, {
      json: config.json,
      silent: config.silent,
      cwd: root,
    });
  }

  printDone(isDryRun, config.silent, config.json);

  // Exit with non-zero code if unused items found (useful for CI)
  const hasIssues =
    result.unusedFiles.length > 0 ||
    result.unusedExports.length > 0 ||
    result.unusedComponents.length > 0;

  if (hasIssues) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red.bold("Fatal error:"), err);
  process.exit(1);
});
