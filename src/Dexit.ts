/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { resolve as resolvePath } from "path";

import { Loader } from "./Loader";
import { ModuleMgr } from "./ModuleMgr";
import { ReporterMgr } from "./ReporterMgr";
import { Repository } from "./Repository";
import { Runner } from "./Runner";
import { Tools } from "./Tools";

import * as builtinModules from "./modules";
import * as builtinReporters from "./reporters";

/**
 * Dexit configuration interface
 */
export interface IDexitConfig {
	modulesPath?: string;
	basePath?: string;
	testsPath?: string;
	reporters?: { [K: string]: { [K: string]: any } };
	autoloadModules?: boolean;
	loadBuiltInModules?: boolean;
	ignoreInvalidTests?: boolean;
}

/**
 * Dexit main class
 */
export class Dexit {

	/* Component instances */
	protected loader: Loader;
	protected moduleMgr: ModuleMgr;
	protected reporterMgr: ReporterMgr;
	protected repository: Repository;
	protected runner: Runner;
	protected tools: Tools;

	/** Options */
	protected opts: IDexitConfig;

	/**
	 * Dexit constructor
	 *
	 * @param opts Configuration options
	 */
	public constructor(opts: IDexitConfig) {

		// Read config
		this.opts = Object.assign({
			modulesPath: "./node_modules",
			basePath: "./",
			testsPath: "/tests",
			reporters: {
				console: {
					detailed: false,
					reportValidTasks: false,
					reportArgs: false
				}
			},
			autoloadModules: true,
			loadBuiltInModules: true,
			ignoreInvalidTests: false
		}, opts);

		// Instantiate components
		this.loader = new Loader();
		this.moduleMgr = new ModuleMgr();
		this.reporterMgr = new ReporterMgr();

		this.repository = new Repository(this.moduleMgr, {
			ignoreInvalid: this.opts.ignoreInvalidTests
		});

		this.runner = new Runner(this.moduleMgr, this.reporterMgr, {});

		this.tools = new Tools(this.moduleMgr);

	}

	/**
	 * Initializes Dexit
	 */
	public init() {

		// Load builtin modules
		if (this.opts.loadBuiltInModules) {

			this.moduleMgr.register(builtinModules.HttpModule);
			this.moduleMgr.register(builtinModules.JsModule);

		}

		// Autoload modules from path
		if (this.opts.autoloadModules)
			this.moduleMgr.loadAllNodeModules(resolvePath(this.opts.modulesPath));

		// Load reporters
		for (const i in this.opts.reporters) {

			const reporterConfig = this.opts.reporters[i];

			if (i === "console")
				this.reporterMgr.register(new builtinReporters.ConsoleReporter(reporterConfig));
			else
				this.reporterMgr.loadNodeModule(resolvePath(this.opts.modulesPath + "/" + this.opts.reporters[i]), reporterConfig);

		}

	}

	/**
	 * Loads and runs tests
	 *
	 * @param generateReport If to generate report
	 */
	public async run(generateReport: boolean = true) {

		console.log("Loading test documents...");
		const docs = await this.loader.loadDirectory(resolvePath(this.opts.basePath), this.opts.testsPath);

		this.repository.loadDocuments(docs);
		this.repository.build();

		const errors = this.repository.getErrors();

		if (errors.length > 0) {
			this.reporterMgr.logValidationErrors(errors);
			console.log("");
		}

		console.log("Running tests...");

		const report = await this.runner.run(this.repository.getTests());

		console.log("\nTest results:\n");

		if (generateReport)
			this.reporterMgr.generateReport(report);
		else
			console.log("Finished.");

		return report;

	}

	/**
	 * Returns module manager instance
	 */
	public getModuleMgr() {

		return this.moduleMgr;

	}

	/**
	 * Returns reporter manager instance
	 */
	public getReporterMgr() {

		return this.reporterMgr;

	}

	/**
	 * Returns tools instance
	 */
	public getTools() {

		return this.tools;

	}

}
