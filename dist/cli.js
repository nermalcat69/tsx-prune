#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const ts_morph_1 = require("ts-morph");
const scanner_1 = require("./scanner");
const parser_1 = require("./parser");
const graph_1 = require("./graph");
const analyzer_1 = require("./analyzer");
const cleaner_1 = require("./cleaner");
const reporter_1 = require("./reporter");
const config_1 = require("./config");
const utils_1 = require("./utils");
const pkg = require("../package.json");
// ─── helpers ────────────────────────────────────────────────────────────────
async function buildContext(opts) {
    const cwd = (0, utils_1.normalizePath)(process.cwd());
    const root = opts.root ? (0, utils_1.normalizePath)(path.resolve(cwd, opts.root)) : cwd;
    const defaultConfig = (0, config_1.getDefaultConfig)(root);
    const configFileDir = opts.config
        ? path.dirname(path.resolve(cwd, opts.config))
        : root;
    const fileConfig = (0, config_1.loadConfigFile)(configFileDir);
    const config = (0, config_1.mergeConfig)(defaultConfig, fileConfig, {
        entry: opts.entry,
        ignore: opts.ignore,
        json: opts.json,
        silent: opts.silent,
        tsconfig: opts.tsconfig ? path.resolve(cwd, opts.tsconfig) : undefined,
    });
    return { cwd, root, config };
}
// ─── main "analyze" action ──────────────────────────────────────────────────
async function runAnalyze(opts) {
    const { root, config } = await buildContext(opts);
    const isDryRun = !opts.delete;
    (0, reporter_1.printBanner)(config.silent, config.json);
    if (!config.silent && !config.json) {
        console.log(chalk_1.default.dim(`Root:     ${root}`));
        console.log(chalk_1.default.dim(`Tsconfig: ${config.tsconfig}`));
        if (opts.verySafe)
            console.log(chalk_1.default.yellow("  --very-safe: deletion disabled"));
        console.log();
    }
    let allFiles;
    try {
        allFiles = await (0, scanner_1.scanFiles)({ root, extensions: config.extensions, ignore: config.ignore, entry: config.entry });
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error scanning files: ${err}`));
        process.exit(1);
    }
    if (allFiles.length === 0) {
        if (!config.silent)
            console.log(chalk_1.default.yellow("No files found to scan."));
        process.exit(0);
    }
    (0, reporter_1.printScanningMessage)(allFiles.length, config.silent, config.json);
    let entryPoints;
    try {
        entryPoints = await (0, scanner_1.resolveEntryPoints)(config.entry, root);
        const scannedSet = new Set(allFiles);
        entryPoints = entryPoints.filter((e) => scannedSet.has(e));
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error resolving entry points: ${err}`));
        process.exit(1);
    }
    if (!config.silent && !config.json) {
        if (entryPoints.length === 0) {
            console.log(chalk_1.default.yellow("Warning: No entry points found. All files will be reported as unused."));
        }
        else {
            console.log(chalk_1.default.dim(`Entry points: ${entryPoints.length} found`));
        }
    }
    const parser = new parser_1.Parser({ tsconfig: config.tsconfig, root, extensions: config.extensions });
    parser.addFiles(allFiles);
    const fileInfoMap = new Map();
    let parsed = 0;
    for (const filePath of allFiles) {
        try {
            fileInfoMap.set(filePath, parser.parseFile(filePath));
        }
        catch {
            if (!config.silent)
                process.stderr.write(chalk_1.default.dim(`Warning: skipping ${filePath}\n`));
        }
        parsed++;
        if (!config.silent && !config.json && parsed % 100 === 0) {
            process.stdout.write(chalk_1.default.dim(`\r  Parsed ${parsed}/${allFiles.length} files...`));
        }
    }
    if (!config.silent && !config.json && allFiles.length > 100)
        process.stdout.write("\n");
    const graph = (0, graph_1.buildGraphFromFileInfos)(fileInfoMap);
    if (opts.debug) {
        (0, reporter_1.printDependencyGraph)(graph, entryPoints, root, config.silent, config.json);
    }
    const result = (0, analyzer_1.analyze)(graph, fileInfoMap, { entryPoints, ignorePatterns: config.ignore });
    (0, reporter_1.reportAnalysis)(result, { json: config.json, silent: config.silent, cwd: root });
    const shouldClean = !opts.verySafe && (opts.delete || opts.fixImports || opts.fixExports);
    if (shouldClean) {
        const morphProject = new ts_morph_1.Project({ tsConfigFilePath: config.tsconfig, skipAddingFilesFromTsConfig: true });
        morphProject.addSourceFilesAtPaths(allFiles);
        const cleanResult = await (0, cleaner_1.clean)(result, morphProject, {
            dryRun: isDryRun,
            fixImports: opts.fixImports ?? false,
            fixExports: opts.fixExports ?? false,
            ignorePatterns: config.ignore,
        });
        (0, reporter_1.reportCleanResult)(cleanResult, { json: config.json, silent: config.silent, cwd: root });
    }
    (0, reporter_1.printDone)(isDryRun || !!opts.verySafe, config.silent, config.json);
    const hasIssues = result.unusedFiles.length > 0 ||
        result.unusedExports.length > 0 ||
        result.unusedComponents.length > 0;
    if (hasIssues)
        process.exit(1);
}
// ─── program ────────────────────────────────────────────────────────────────
const program = new commander_1.Command();
program
    .name("tsx-prune")
    .description("Analyze and remove unused TypeScript/React files, imports, and exports")
    .version(pkg.version);
// ── shared option adder ──────────────────────────────────────────────────────
function addSharedOptions(cmd) {
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
        console.error(chalk_1.default.red.bold("Fatal error:"), err);
        process.exit(1);
    });
});
// ── tsx-prune scan ────────────────────────────────────────────────────────────
const scanCmd = new commander_1.Command("scan")
    .description("List all TypeScript/React files found under --root");
addSharedOptions(scanCmd).action(async (opts) => {
    const { root, config } = await buildContext(opts);
    const allFiles = await (0, scanner_1.scanFiles)({ root, extensions: config.extensions, ignore: config.ignore, entry: config.entry });
    if (config.json) {
        console.log(JSON.stringify({ files: allFiles.map((f) => path.relative(root, f)) }, null, 2));
    }
    else if (!config.silent) {
        console.log(chalk_1.default.bold(`Found ${allFiles.length} files:`));
        for (const f of allFiles) {
            console.log(chalk_1.default.dim("  " + path.relative(root, f)));
        }
    }
});
// ── tsx-prune clean ────────────────────────────────────────────────────────────
const cleanCmd = new commander_1.Command("clean")
    .description("Delete unused files detected by analysis");
addSharedOptions(cleanCmd)
    .option("--fix-imports", "Also remove unused import statements")
    .option("--fix-exports", "Also remove export modifiers from unused exports")
    .action(async (opts) => {
    await runAnalyze({ ...opts, delete: true }).catch((err) => {
        console.error(chalk_1.default.red.bold("Fatal error:"), err);
        process.exit(1);
    });
});
// ── tsx-prune graph ────────────────────────────────────────────────────────────
const graphCmd = new commander_1.Command("graph")
    .description("Print the dependency tree from entry points");
addSharedOptions(graphCmd).action(async (opts) => {
    const { root, config } = await buildContext(opts);
    if (!config.silent && !config.json) {
        console.log(chalk_1.default.dim(`Root:     ${root}`));
        console.log(chalk_1.default.dim(`Tsconfig: ${config.tsconfig}\n`));
    }
    const allFiles = await (0, scanner_1.scanFiles)({ root, extensions: config.extensions, ignore: config.ignore, entry: config.entry });
    if (allFiles.length === 0) {
        if (!config.silent)
            console.log(chalk_1.default.yellow("No files found."));
        return;
    }
    let entryPoints = await (0, scanner_1.resolveEntryPoints)(config.entry, root);
    const scannedSet = new Set(allFiles);
    entryPoints = entryPoints.filter((e) => scannedSet.has(e));
    const parser = new parser_1.Parser({ tsconfig: config.tsconfig, root, extensions: config.extensions });
    parser.addFiles(allFiles);
    const fileInfoMap = new Map();
    for (const f of allFiles) {
        try {
            fileInfoMap.set(f, parser.parseFile(f));
        }
        catch { /* skip */ }
    }
    const graph = (0, graph_1.buildGraphFromFileInfos)(fileInfoMap);
    (0, reporter_1.printDependencyGraph)(graph, entryPoints, root, config.silent, config.json);
});
program.addCommand(scanCmd);
program.addCommand(cleanCmd);
program.addCommand(graphCmd);
program.parse(process.argv);
//# sourceMappingURL=cli.js.map