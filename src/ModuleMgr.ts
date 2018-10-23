/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { readdirSync, statSync } from "fs";
import * as Ajv from "ajv";
import { IAssertionError } from "./Interfaces";

/**
 * Test command interface
 */
export interface ITestCommand {
	/** Command description */
	description: string;

	/** Optional arguments JSON schema */
	argsSchema?: any;
	_argsValidator?: Ajv.ValidateFunction;

	/** Optional expect JSON schema */
	expectSchema?: any;
	_expectValidator?: Ajv.ValidateFunction;

	/** Validates arguments */
	validateArgs?: (args: any) => Array<IAssertionError>;

	/** Validates expect */
	validateExpect?: (args: any) => Array<IAssertionError>;

	/** Command run handler */
	run: (args: any, onReady: () => void) => Promise<any>;

	/** Command expect handler */
	expect?: (args: any, result: any) => Array<IAssertionError>;

	/** Return user-friendly label of task based on arguments */
	getLabel?: (runArgs: any, expectArgs: any) => string;
}

/**
 * Module interface
 */
export interface ITestModule {
	/** Module name */
	name: string;

	/** Module description */
	description?: string;

	/** Defaults schema */
	defaultsSchema?: any;

	/** Commands provided by the module */
	commands: { [K: string]: ITestCommand };
}

/**
 * Modules class is responsible for loading of modules
 */
export class ModuleMgr {

	/** Registered modules */
	protected modules: { [K: string]: ITestModule } = {};

	/** AJV instance */
	protected ajv: Ajv.Ajv;

	/**
	 * Modules constructor
	 */
	public constructor() {

		this.ajv = new Ajv({
			useDefaults: true,
			allErrors: true,
			removeAdditional: true
		});

	}

	/**
	 * Registers module directly
	 *
	 * @param module Module object
	 */
	public register(mod: ITestModule) {

		// Check if not already registered
		if (this.modules[mod.name])
			throw new Error(`Module '${mod.name}' is already registered.`);

		// Set validators
		for (const i in mod.commands) {

			const cmd = mod.commands[i];

			if (cmd.argsSchema)
				cmd._argsValidator = this.ajv.compile(cmd.argsSchema);

			if (cmd.expectSchema)
				cmd._expectValidator = this.ajv.compile(cmd.expectSchema);

		}

		// Assign
		this.modules[mod.name] = mod;

	}

	/**
	 * Validates module definition object
	 *
	 * @param id Module idenitifer (for debugging, eg. filename or so)
	 * @param mod Module object
	 */
	protected validateModuleObject(id: string, mod: any) {

		// Validate interface
		if (!(mod instanceof Object))
			throw new Error(`Module '${id}' does not export a configuration object.`);

		if (!mod.name)
			throw new Error(`Module '${id}' definition must has a 'name' property.`);

		if (!mod.commands)
			throw new Error(`Module '${id}' definition must has a 'commands' property.`);

		if (!(mod.commands instanceof Object))
			throw new Error(`Module '${id}' property 'commands' must be an object.`);

		// Validate commands
		for (const i in mod.commands) {

			const cmd = mod.commands[i];

			if (!(cmd instanceof Object))
				throw new Error(`Module '${id}' command '${i}' must be an object.`);

			if (!cmd.description)
				throw new Error(`Module '${id}' command '${i}' definition must has 'description' property.`);

			if (!cmd.run)
				throw new Error(`Module '${id}' command '${i}' definition must has 'run' property.`);

			if (typeof cmd.run !== "function")
				throw new Error(`Module '${id}' command '${i}' definition property 'run' must be a function.`);

			if (cmd.expect && typeof cmd.expect !== "function")
				throw new Error(`Module '${id}' command '${i}' definition property 'expect' must be a function.`);

			if (cmd.getLabel && typeof cmd.getLabel !== "function")
				throw new Error(`Module '${id}' command '${i}' definition property 'getLabel' must be a function.`);

			if (cmd._argsValidator)
				throw new Error(`Module '${id}' command '${i}' cannot has '_argsValidator' property because it is reserved.`);

			if (cmd._expectValidator)
				throw new Error(`Module '${id}' command '${i}' cannot has '_expectValidator' property because it is reserved.`);

		}

	}

	/**
	 * Tries to load Dexit module from Node.JS package
	 *
	 * @param path Module path
	 */
	protected tryLoadNodeModule(path: string) {

		try {

			const pkg = require(path + "/package.json");

			// Skip non-dexit module
			if (pkg.dexitModule !== true)
				return;

			const main = path + "/" + (pkg.main || "index.js");

			// Try to load module file
			this.load(main);

		} catch (err) {

			throw new Error("Failed load module '" + path + "': " + String(err));

		}

	}

	/**
	 * Loads and register module from file
	 *
	 * @param filename Module filename
	 */
	public load(filename: string) {

		const mod = require(filename);

		this.validateModuleObject(filename, mod);
		this.register(mod);

	}

	/**
	 * Loads all dexit NPM modules from specified path
	 *
	 * @param path Modules path
	 */
	public loadAllNodeModules(path: string = "./node_modules") {

		const moduleList = [];

		try {

			const moduleFiles = readdirSync(path);

			for (let i = 0; i < moduleFiles.length; i++) {

				try {

					const pkgPath = path + "/" + moduleFiles[i] + "/package.json";

					if (statSync(pkgPath).isFile())
						moduleList.push(path + "/" + moduleFiles[i]);

				} catch { /* Pass */ }

			}

		} catch { /* Pass */ }

		// Load them all
		for (let i = 0; i < moduleList.length; i++)
			this.tryLoadNodeModule(moduleList[i]);

	}

	/**
	 * Returns all registered modules
	 */
	public getAllModules() {

		return this.modules;

	}

	/**
	 * Returns module
	 *
	 * @param name Module name
	 */
	public getModule(name: string) {

		return this.modules[name] || null;

	}

	/**
	 * Parse command ID into module and command name itself
	 *
	 * @param id Command ID
	 */
	public parseCommand(id: string) {

		const path = id.split(".", 2);

		return {
			module: path[0],
			command: path[1]
		};

	}

	/**
	 * Returns module command by ID
	 *
	 * @param id Command ID in form of "module.command"
	 */
	public getCommand(id: string) {

		const path = id.split(".", 2);
		const mod = this.modules[path[0]];

		if (!mod)
			return null;

		return mod.commands[path[1]] || null;

	}

}
