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
async function main() {
    const program = new commander_1.Command();
    program
        .name("tsx-prune")
        .description("Analyze and remove unused components, files, imports, and exports in TypeScript/React codebases")
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
    const opts = program.opts();
    const cwd = (0, utils_1.normalizePath)(process.cwd());
    const root = opts.root ? (0, utils_1.normalizePath)(path.resolve(cwd, opts.root)) : cwd;
    // Load base config
    const defaultConfig = (0, config_1.getDefaultConfig)(root);
    // Load config file
    const configFileDir = opts.config
        ? path.dirname(path.resolve(cwd, opts.config))
        : root;
    const fileConfig = (0, config_1.loadConfigFile)(configFileDir);
    // Merge with CLI overrides
    const config = (0, config_1.mergeConfig)(defaultConfig, fileConfig, {
        entry: opts.entry,
        ignore: opts.ignore,
        json: opts.json,
        silent: opts.silent,
        tsconfig: opts.tsconfig
            ? path.resolve(cwd, opts.tsconfig)
            : undefined,
    });
    const isDryRun = !opts.delete;
    (0, reporter_1.printBanner)(config.silent, config.json);
    if (!config.silent && !config.json) {
        console.log(chalk_1.default.dim(`Root: ${root}`));
        console.log(chalk_1.default.dim(`Tsconfig: ${config.tsconfig}`));
        console.log();
    }
    // Step 1: Scan files
    let allFiles;
    try {
        allFiles = await (0, scanner_1.scanFiles)({
            root,
            extensions: config.extensions,
            ignore: config.ignore,
            entry: config.entry,
        });
    }
    catch (err) {
        console.error(chalk_1.default.red(`Error scanning files: ${err}`));
        process.exit(1);
    }
    if (allFiles.length === 0) {
        if (!config.silent) {
            console.log(chalk_1.default.yellow("No files found to scan."));
        }
        process.exit(0);
    }
    (0, reporter_1.printScanningMessage)(allFiles.length, config.silent, config.json);
    // Step 2: Resolve entry points
    let entryPoints;
    try {
        entryPoints = await (0, scanner_1.resolveEntryPoints)(config.entry, root);
        // Filter to only files that exist in our scanned set
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
    // Step 3: Parse files and build dependency graph
    const parser = new parser_1.Parser({
        tsconfig: config.tsconfig,
        root,
        extensions: config.extensions,
    });
    // Add all files to the project for cross-file analysis
    parser.addFiles(allFiles);
    const fileInfoMap = new Map();
    let parsed = 0;
    for (const filePath of allFiles) {
        try {
            const info = parser.parseFile(filePath);
            fileInfoMap.set(filePath, info);
        }
        catch (_err) {
            // Skip files that can't be parsed
            if (!config.silent) {
                process.stderr.write(chalk_1.default.dim(`Warning: skipping ${filePath}\n`));
            }
        }
        parsed++;
        if (!config.silent && !config.json && parsed % 100 === 0) {
            process.stdout.write(chalk_1.default.dim(`\r  Parsed ${parsed}/${allFiles.length} files...`));
        }
    }
    if (!config.silent && !config.json && allFiles.length > 100) {
        process.stdout.write("\n");
    }
    // Step 4: Build dependency graph
    const graph = (0, graph_1.buildGraphFromFileInfos)(fileInfoMap);
    // Step 5: Analyze
    const result = (0, analyzer_1.analyze)(graph, fileInfoMap, {
        entryPoints,
        ignorePatterns: config.ignore,
    });
    // Step 6: Report
    (0, reporter_1.reportAnalysis)(result, {
        json: config.json,
        silent: config.silent,
        cwd: root,
    });
    // Step 7: Clean if requested
    const shouldClean = opts.delete || opts.fixImports || opts.fixExports;
    if (shouldClean) {
        // Create ts-morph project for code modifications
        const morphProject = new ts_morph_1.Project({
            tsConfigFilePath: config.tsconfig,
            skipAddingFilesFromTsConfig: true,
        });
        morphProject.addSourceFilesAtPaths(allFiles);
        const cleanResult = await (0, cleaner_1.clean)(result, morphProject, {
            dryRun: isDryRun,
            fixImports: opts.fixImports ?? false,
            fixExports: opts.fixExports ?? false,
            ignorePatterns: config.ignore,
        });
        (0, reporter_1.reportCleanResult)(cleanResult, {
            json: config.json,
            silent: config.silent,
            cwd: root,
        });
    }
    (0, reporter_1.printDone)(isDryRun, config.silent, config.json);
    // Exit with non-zero code if unused items found (useful for CI)
    const hasIssues = result.unusedFiles.length > 0 ||
        result.unusedExports.length > 0 ||
        result.unusedComponents.length > 0;
    if (hasIssues) {
        process.exit(1);
    }
}
main().catch((err) => {
    console.error(chalk_1.default.red.bold("Fatal error:"), err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map