#!/usr/bin/env node

/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { ArgumentParser } from "argparse";
import { statSync, writeFileSync } from "fs";
import { resolve as resolvePath } from "path";

import { Dexit } from "./Dexit";
import { ValidationError, TestsDirectoryNotFoundError } from "./Errors";

// Load Dexit package.json to read meta-data
const dexitPackage = require(__dirname + "/../../package.json");

/*
 * Setup argument parser
 */
const parser = new ArgumentParser({
	description: `DEXIT v${dexitPackage.version} (Declarative Extensible Integration Testing)`,
	version: dexitPackage.version,
	addHelp: true
});

parser.addArgument( [ "--base-path" ], {
	help: "Base project path",
	dest: "basePath",
	defaultValue: "."
});

parser.addArgument( [ "--modules-path" ], {
	help: "Node modules path",
	dest: "modulesPath"
});

parser.addArgument( [ "--no-autoload" ], {
	help: "Disable autoloading of modules",
	dest: "autoloadModules",
	action: "storeConst",
	constant: false
});

parser.addArgument( [ "--no-builtin" ], {
	help: "Disable autoloading of built-in modules",
	dest: "loadBuiltInModules",
	action: "storeConst",
	constant: false
});

parser.addArgument( [ "--ignore-invalid" ], {
	help: "Ignore invalid test files",
	dest: "ignoreInvalidTests",
	action: "storeConst",
	constant: true
});

parser.addArgument( ["--reporter"], {
	help: "Use reporter (default: console)",
	metavar: "module_name",
	dest: "reporters",
	nargs: "*"
});

parser.addArgument( [ "--debug" ], {
	help: "Print bootstrap debug messages",
	dest: "debug",
	action: "storeTrue",
});

parser.addArgument( [ "--generate-schema" ], {
	// tslint:disable-next-line:max-line-length
	help: "Generate JSON schema for test files including all loaded modules definitions. Can be used for linters or language servers to enable intellisense. No tests will be run when this option is set.",
	dest: "generateSchema",
	metavar: "schema_filename"
});

parser.addArgument( ["testsPath"], {
	help: "Tests directory path",
	defaultValue: "./tests",
	nargs: "*"
});

// Parse arguments
const args = parser.parseArgs();
const debug = args.debug;

// Filter null values
for (const i in args)
	if (args[i] === null)
		delete args[i];

// Set default modules path
if (!args.modulesPath)
	args.modulesPath = args.basePath + "/node_modules";

// Convert reporters to an object
if (args.reporters) {

	const reportersConfig = {};

	for (let i = 0; i < args.reporters.length; i++)
		reportersConfig[ args.reporters[i] ] = {};

	args.reporters = reportersConfig;

}

// Try to read config from local package.json
let localConfig = {};

try {

	const localPackage = resolvePath(args.basePath + "/package.json");

	if (debug) console.debug(`Trying to load local package '${localPackage}'...`);

	statSync(localPackage);

	if (debug) console.debug(`Local package found, checking for Dexit configuration...`);

	const pkg = require(localPackage);

	if (pkg["dexit"]) {

		localConfig = pkg["dexit"];

		if (debug) console.debug(`Using local package configuration...`);

	} else {

		if (debug) console.debug(`Local package configuration for Dexit not found.`);

	}

} catch (err) {

	if (err.code !== "ENOENT")
		console.error("Failed to load local package.json, ignoring it. Error:", err);

}

// Merge config
const config = Object.assign(localConfig, args);

if (debug) {
	console.debug("Using configuration:");
	console.dir(config, { depth: null, colors: true });
}

try {

	// Instantiate Dexit
	const dexit = new Dexit(config);

	// Init
	if (debug) console.debug("Initializing Dexit...");

	dexit.init();

	// Generate schema and exit?
	if (config.generateSchema) {

		const schemaFn = resolvePath(config.generateSchema);

		console.log("Generating JSON schema...");
		const schema = dexit.getTools().generateSchema();

		console.log(`Writing schema to '${schemaFn}' ...`);
		writeFileSync(schemaFn, JSON.stringify(schema), { encoding: "utf-8" });

		console.log("Schema successfully written.");
		process.exit();

	}

	// Run tests
	if (debug) console.debug("Running Dexit...");

	dexit.run().then((report) => {

		if (debug) console.debug("Dexit finished with error count:", report.errorCount);

		if (report.errorCount > 0)
			process.exit(1);
		else
			process.exit(0);

	}, (err) => {

		if (err instanceof ValidationError) {

			console.error("Please check your test files and ensure that all required modules are installed.");

		} else if (err instanceof TestsDirectoryNotFoundError) {

			console.error(err.message);

		} else {

			console.error(err);

		}

		process.exit(2);

	});

} catch (err) {

	console.error(err);
	process.exit(2);

}
