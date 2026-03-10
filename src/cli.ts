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
  printDependencyGraph,
} from "./reporter";
import { getDefaultConfig, loadConfigFile, mergeConfig } from "./config";
import { normalizePath } from "./utils";
import { FileInfo } from "./types";

const pkg = require("../package.json") as { version: string };

// ─── shared option types ────────────────────────────────────────────────────

interface SharedOpts {
  entry?: string[];
  ignore?: string[];
  root?: string;
  tsconfig?: string;
  json?: boolean;
  silent?: boolean;
  config?: string;
  verySafe?: boolean;
  debug?: boolean;
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function buildContext(opts: SharedOpts) {
  const cwd = normalizePath(process.cwd());
  const root = opts.root ? normalizePath(path.resolve(cwd, opts.root)) : cwd;

  const defaultConfig = getDefaultConfig(root);
  const configFileDir = opts.config
    ? path.dirname(path.resolve(cwd, opts.config))
    : root;
  const fileConfig = loadConfigFile(configFileDir);
  const config = mergeConfig(defaultConfig, fileConfig, {
    entry: opts.entry,
    ignore: opts.ignore,
    json: opts.json,
    silent: opts.silent,
    tsconfig: opts.tsconfig ? path.resolve(cwd, opts.tsconfig) : undefined,
  });

  return { cwd, root, config };
}

// ─── main "analyze" action ──────────────────────────────────────────────────

async function runAnalyze(
  opts: SharedOpts & { delete?: boolean; fixImports?: boolean; fixExports?: boolean }
): Promise<void> {
  const { root, config } = await buildContext(opts);
  const isDryRun = !opts.delete;

  printBanner(config.silent, config.json);

  if (!config.silent && !config.json) {
    console.log(chalk.dim(`Root:     ${root}`));
    console.log(chalk.dim(`Tsconfig: ${config.tsconfig}`));
    if (opts.verySafe) console.log(chalk.yellow("  --very-safe: deletion disabled"));
    console.log();
  }

  let allFiles: string[];
  try {
    allFiles = await scanFiles({ root, extensions: config.extensions, ignore: config.ignore, entry: config.entry });
  } catch (err) {
    console.error(chalk.red(`Error scanning files: ${err}`));
    process.exit(1);
  }

  if (allFiles.length === 0) {
    if (!config.silent) console.log(chalk.yellow("No files found to scan."));
    process.exit(0);
  }

  printScanningMessage(allFiles.length, config.silent, config.json);

  let entryPoints: string[];
  try {
    entryPoints = await resolveEntryPoints(config.entry, root);
    const scannedSet = new Set(allFiles);
    entryPoints = entryPoints.filter((e) => scannedSet.has(e));
  } catch (err) {
    console.error(chalk.red(`Error resolving entry points: ${err}`));
    process.exit(1);
  }

  if (!config.silent && !config.json) {
    if (entryPoints.length === 0) {
      console.log(chalk.yellow("Warning: No entry points found. All files will be reported as unused."));
    } else {
      console.log(chalk.dim(`Entry points: ${entryPoints.length} found`));
    }
  }

  const parser = new Parser({ tsconfig: config.tsconfig, root, extensions: config.extensions });
  parser.addFiles(allFiles);

  const fileInfoMap = new Map<string, FileInfo>();
  let parsed = 0;
  for (const filePath of allFiles) {
    try {
      fileInfoMap.set(filePath, parser.parseFile(filePath));
    } catch {
      if (!config.silent) process.stderr.write(chalk.dim(`Warning: skipping ${filePath}\n`));
    }
    parsed++;
    if (!config.silent && !config.json && parsed % 100 === 0) {
      process.stdout.write(chalk.dim(`\r  Parsed ${parsed}/${allFiles.length} files...`));
    }
  }
  if (!config.silent && !config.json && allFiles.length > 100) process.stdout.write("\n");

  const graph = buildGraphFromFileInfos(fileInfoMap);

  if (opts.debug) {
    printDependencyGraph(graph, entryPoints, root, config.silent, config.json);
  }

  const result = analyze(graph, fileInfoMap, { entryPoints, ignorePatterns: config.ignore });

  reportAnalysis(result, { json: config.json, silent: config.silent, cwd: root });

  const shouldClean = !opts.verySafe && (opts.delete || opts.fixImports || opts.fixExports);

  if (shouldClean) {
    const morphProject = new Project({ tsConfigFilePath: config.tsconfig, skipAddingFilesFromTsConfig: true });
    morphProject.addSourceFilesAtPaths(allFiles);

    const cleanResult = await clean(result, morphProject, {
      dryRun: isDryRun,
      fixImports: opts.fixImports ?? false,
      fixExports: opts.fixExports ?? false,
      ignorePatterns: config.ignore,
    });

    reportCleanResult(cleanResult, { json: config.json, silent: config.silent, cwd: root });
  }

  printDone(isDryRun || !!opts.verySafe, config.silent, config.json);

  const hasIssues =
    result.unusedFiles.length > 0 ||
    result.unusedExports.length > 0 ||
    result.unusedComponents.length > 0;

  if (hasIssues) process.exit(1);
}

// ─── program ────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("tsx-prune")
  .description("Analyze and remove unused TypeScript/React files, imports, and exports")
  .version(pkg.version);

// ── shared option adder ──────────────────────────────────────────────────────

function addSharedOptions(cmd: Command): Command {
  return cmd
    .option("--entry <paths...>", "Entry point files or globs")
    .option("--ignore <patterns...>", "Glob patterns to ignore")
    .option("--root <dir>", "Root directory to scan (default: cwd)")
    .option("--tsconfig <path>", "Path to tsconfig.json")
    .option("--json", "Output results as JSON")
    .option("--silent", "Suppress all output except errors")
    .option("--config <path>", "Path to tsx-prune config file")
    .option("--very-safe", "Report only — never delete or modify any file")
    .option("--debug", "Print dependency graph to stdout");
}

// ── default / analyze action (tsx-prune [options]) ───────────────────────────

addSharedOptions(program)
  .option("--delete", "Actually delete unused files (default: dry run)")
  .option("--dry-run", "Show what would be deleted without doing it (default)")
  .option("--fix-imports", "Remove unused import statements")
  .option("--fix-exports", "Remove export modifiers from unused exports")
  .action(async (opts) => {
    await runAnalyze(opts).catch((err) => {
      console.error(chalk.red.bold("Fatal error:"), err);
      process.exit(1);
    });
  });

// ── tsx-prune scan ────────────────────────────────────────────────────────────

const scanCmd = new Command("scan")
  .description("List all TypeScript/React files found under --root");

addSharedOptions(scanCmd).action(async (opts: SharedOpts) => {
  const { root, config } = await buildContext(opts);
  const allFiles = await scanFiles({ root, extensions: config.extensions, ignore: config.ignore, entry: config.entry });

  if (config.json) {
    console.log(JSON.stringify({ files: allFiles.map((f) => path.relative(root, f)) }, null, 2));
  } else if (!config.silent) {
    console.log(chalk.bold(`Found ${allFiles.length} files:`));
    for (const f of allFiles) {
      console.log(chalk.dim("  " + path.relative(root, f)));
    }
  }
});

// ── tsx-prune clean ────────────────────────────────────────────────────────────

const cleanCmd = new Command("clean")
  .description("Delete unused files detected by analysis");

addSharedOptions(cleanCmd)
  .option("--fix-imports", "Also remove unused import statements")
  .option("--fix-exports", "Also remove export modifiers from unused exports")
  .action(async (opts: SharedOpts & { fixImports?: boolean; fixExports?: boolean }) => {
    await runAnalyze({ ...opts, delete: true }).catch((err) => {
      console.error(chalk.red.bold("Fatal error:"), err);
      process.exit(1);
    });
  });

// ── tsx-prune graph ────────────────────────────────────────────────────────────

const graphCmd = new Command("graph")
  .description("Print the dependency tree from entry points");

addSharedOptions(graphCmd).action(async (opts: SharedOpts) => {
  const { root, config } = await buildContext(opts);

  if (!config.silent && !config.json) {
    console.log(chalk.dim(`Root:     ${root}`));
    console.log(chalk.dim(`Tsconfig: ${config.tsconfig}\n`));
  }

  const allFiles = await scanFiles({ root, extensions: config.extensions, ignore: config.ignore, entry: config.entry });
  if (allFiles.length === 0) {
    if (!config.silent) console.log(chalk.yellow("No files found."));
    return;
  }

  let entryPoints = await resolveEntryPoints(config.entry, root);
  const scannedSet = new Set(allFiles);
  entryPoints = entryPoints.filter((e) => scannedSet.has(e));

  const parser = new Parser({ tsconfig: config.tsconfig, root, extensions: config.extensions });
  parser.addFiles(allFiles);

  const fileInfoMap = new Map<string, FileInfo>();
  for (const f of allFiles) {
    try { fileInfoMap.set(f, parser.parseFile(f)); } catch { /* skip */ }
  }

  const graph = buildGraphFromFileInfos(fileInfoMap);
  printDependencyGraph(graph, entryPoints, root, config.silent, config.json);
});

program.addCommand(scanCmd);
program.addCommand(cleanCmd);
program.addCommand(graphCmd);

program.parse(process.argv);
