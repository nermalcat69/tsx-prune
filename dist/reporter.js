"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportAnalysis = reportAnalysis;
exports.reportCleanResult = reportCleanResult;
exports.printBanner = printBanner;
exports.printScanningMessage = printScanningMessage;
exports.printDone = printDone;
const chalk_1 = __importDefault(require("chalk"));
const utils_1 = require("./utils");
function reportAnalysis(result, options) {
    if (options.json) {
        reportJson(result, options);
        return;
    }
    if (options.silent)
        return;
    reportText(result, options);
}
function reportText(result, options) {
    const { cwd } = options;
    const hasIssues = result.unusedFiles.length > 0 ||
        result.unusedExports.length > 0 ||
        result.unusedComponents.length > 0;
    // Unused files
    if (result.unusedFiles.length > 0) {
        console.log(chalk_1.default.yellow.bold("\nUnused Files:"));
        for (const file of (0, utils_1.sortPaths)(result.unusedFiles)) {
            console.log(chalk_1.default.red("  ✗ ") + chalk_1.default.dim((0, utils_1.relativeTo)(file, cwd)));
        }
        console.log(chalk_1.default.yellow(`  ${(0, utils_1.plural)(result.unusedFiles.length, "unused file")} found`));
    }
    // Unused exports
    if (result.unusedExports.length > 0) {
        console.log(chalk_1.default.yellow.bold("\nUnused Exports:"));
        const byFile = groupByFile(result.unusedExports);
        for (const [file, exports] of byFile) {
            console.log(chalk_1.default.dim("  " + (0, utils_1.relativeTo)(file, cwd)));
            for (const exp of exports) {
                const label = exp.isComponent
                    ? chalk_1.default.cyan(`<${exp.name}>`)
                    : chalk_1.default.white(exp.name);
                console.log(`    ${chalk_1.default.red("✗")} ${label}`);
            }
        }
        console.log(chalk_1.default.yellow(`  ${(0, utils_1.plural)(result.unusedExports.length, "unused export")} found`));
    }
    // Unused components (summary if not already shown)
    if (result.unusedComponents.length > 0) {
        const componentNames = result.unusedComponents
            .map((c) => chalk_1.default.cyan(`<${c.name}>`))
            .join(", ");
        console.log(chalk_1.default.yellow.bold("\nUnused React Components:"));
        console.log(`  ${componentNames}`);
        console.log(chalk_1.default.yellow(`  ${(0, utils_1.plural)(result.unusedComponents.length, "unused component")} found`));
    }
    // Summary
    console.log(chalk_1.default.bold("\n─────────────────────────────────────────"));
    console.log(chalk_1.default.bold("Summary:"), chalk_1.default.dim(`${result.totalFiles} files scanned`));
    if (!hasIssues) {
        console.log(chalk_1.default.green.bold("  ✓ No unused code found!"));
    }
    else {
        if (result.unusedFiles.length > 0) {
            console.log(chalk_1.default.red(`  ✗ ${(0, utils_1.plural)(result.unusedFiles.length, "unused file")}`));
        }
        if (result.unusedExports.length > 0) {
            console.log(chalk_1.default.red(`  ✗ ${(0, utils_1.plural)(result.unusedExports.length, "unused export")}`));
        }
        if (result.unusedComponents.length > 0) {
            console.log(chalk_1.default.red(`  ✗ ${(0, utils_1.plural)(result.unusedComponents.length, "unused React component")}`));
        }
    }
}
function reportJson(result, options) {
    const { cwd } = options;
    const report = {
        summary: {
            totalFiles: result.totalFiles,
            unusedFiles: result.unusedFiles.length,
            unusedExports: result.unusedExports.length,
            unusedImports: result.unusedImports.length,
            unusedComponents: result.unusedComponents.length,
        },
        unusedFiles: result.unusedFiles.map((f) => (0, utils_1.relativeTo)(f, cwd)),
        unusedExports: result.unusedExports.map((e) => ({
            file: (0, utils_1.relativeTo)(e.file, cwd),
            name: e.name,
            isComponent: e.isComponent,
        })),
        unusedImports: result.unusedImports.map((i) => ({
            file: (0, utils_1.relativeTo)(i.file, cwd),
            name: i.name,
            moduleSpecifier: i.moduleSpecifier,
        })),
        unusedComponents: result.unusedComponents.map((c) => ({
            file: (0, utils_1.relativeTo)(c.file, cwd),
            name: c.name,
        })),
    };
    console.log(JSON.stringify(report, null, 2));
}
function reportCleanResult(cleanResult, options) {
    if (options.json || options.silent)
        return;
    const { cwd } = options;
    if (cleanResult.deletedFiles.length > 0) {
        console.log(chalk_1.default.green.bold("\nDeleted Files:"));
        for (const file of cleanResult.deletedFiles) {
            console.log(chalk_1.default.green("  ✓ ") + chalk_1.default.dim((0, utils_1.relativeTo)(file, cwd)));
        }
    }
    if (cleanResult.wouldDeleteFiles.length > 0) {
        console.log(chalk_1.default.yellow.bold("\nWould Delete Files (dry run):"));
        for (const file of cleanResult.wouldDeleteFiles) {
            console.log(chalk_1.default.yellow("  ~ ") + chalk_1.default.dim((0, utils_1.relativeTo)(file, cwd)));
        }
    }
    if (cleanResult.removedImports.length > 0) {
        console.log(chalk_1.default.green.bold("\nRemoved Unused Imports:"));
        const byFile = groupUnusedImportsByFile(cleanResult.removedImports);
        for (const [file, imports] of byFile) {
            console.log(chalk_1.default.dim("  " + (0, utils_1.relativeTo)(file, cwd)));
            for (const imp of imports) {
                console.log(`    ${chalk_1.default.green("✓")} ${chalk_1.default.white(imp.name)} from ${chalk_1.default.dim(imp.moduleSpecifier)}`);
            }
        }
    }
    if (cleanResult.removedExports.length > 0) {
        console.log(chalk_1.default.green.bold("\nRemoved Export Modifiers:"));
        const byFile = groupByFile(cleanResult.removedExports);
        for (const [file, exports] of byFile) {
            console.log(chalk_1.default.dim("  " + (0, utils_1.relativeTo)(file, cwd)));
            for (const exp of exports) {
                console.log(`    ${chalk_1.default.green("✓")} ${chalk_1.default.white(exp.name)}`);
            }
        }
    }
    if (cleanResult.skippedFiles.length > 0) {
        console.log(chalk_1.default.dim(`\nSkipped ${cleanResult.skippedFiles.length} protected files (tests, stories)`));
    }
}
function groupByFile(items) {
    const map = new Map();
    for (const item of items) {
        if (!map.has(item.file))
            map.set(item.file, []);
        map.get(item.file).push(item);
    }
    return map;
}
function groupUnusedImportsByFile(items) {
    const map = new Map();
    for (const item of items) {
        if (!map.has(item.file))
            map.set(item.file, []);
        map.get(item.file).push(item);
    }
    return map;
}
function printBanner(silent, json = false) {
    if (silent || json)
        return;
    console.log(chalk_1.default.bold.cyan(`
  ████████╗███████╗██╗  ██╗      ██████╗ ██████╗ ██╗   ██╗███╗   ██╗███████╗
     ██╔══╝██╔════╝╚██╗██╔╝      ██╔══██╗██╔══██╗██║   ██║████╗  ██║██╔════╝
     ██║   ███████╗ ╚███╔╝ █████╗██████╔╝██████╔╝██║   ██║██╔██╗ ██║█████╗
     ██║   ╚════██║ ██╔██╗ ╚════╝██╔═══╝ ██╔══██╗██║   ██║██║╚██╗██║██╔══╝
     ██║   ███████║██╔╝ ██╗      ██║     ██║  ██║╚██████╔╝██║ ╚████║███████╗
     ╚═╝   ╚══════╝╚═╝  ╚═╝      ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
  `));
}
function printScanningMessage(fileCount, silent, json = false) {
    if (silent || json)
        return;
    console.log(chalk_1.default.dim(`Scanning ${fileCount} files...`));
}
function printDone(dryRun, silent, json = false) {
    if (silent || json)
        return;
    if (dryRun) {
        console.log(chalk_1.default.dim("\nDry run complete. Use ") + chalk_1.default.bold("--delete") + chalk_1.default.dim(" to remove unused files."));
    }
    else {
        console.log(chalk_1.default.green.bold("\nDone!"));
    }
}
//# sourceMappingURL=reporter.js.map