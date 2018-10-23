/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { readdirSync, statSync } from "fs";
import {
	IValidationError, IAssertionError,
	ITestSetEntry, ITestEntry, ITestTask,
	ITestSetReport, ICompleteReport, ITestReport, ITestTaskReport
} from "./Interfaces";

export interface IReporter {
	/**
	 * Logs test validation errors
	 *
	 * @param errors List of validation errors
	 */
	logValidationErrors(errors: Array<IValidationError>);

	/**
	 * Logs start of a test set
	 *
	 * @param testSet Test set entry
	 */
	logTestSetBegin(testSet: ITestSetEntry);

	/**
	 * Logs completition of a test set
	 *
	 * @param testSet Test set entry
	 * @param report Test set report
	 */
	logTestSetComplete(testSet: ITestSetEntry, report: ITestSetReport);

	/**
	 * Logs skip of a test set
	 *
	 * @param testSet Test set entry
	 */
	logTestSetSkip(testSet: ITestSetEntry);

	/**
	 * Logs start of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 */
	logTestBegin(testSet: ITestSetEntry, test: ITestEntry);

	/**
	 * Logs completition of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 * @param report Test report
	 */
	logTestComplete(testSet: ITestSetEntry, test: ITestEntry, report: ITestReport);

	/**
	 * Logs skip of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 */
	logTestSkip(testSet: ITestSetEntry, test: ITestEntry);

	/**
	 * Logs start of a task
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 * @param task Test task
	 */
	logTaskBegin(testSet: ITestSetEntry, test: ITestEntry, task: ITestTask);

	/**
	 * Logs completition of a task
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 * @param task Test task
	 * @param report Task report
	 */
	logTaskComplete(testSet: ITestSetEntry, test: ITestEntry, task: ITestTask, report: ITestTaskReport);

	/**
	 * Generates report of a root test set
	 *
	 * @param report Report TestSet
	 */
	generateReport(report: ICompleteReport);
}

/** List of IReporter functions for validation */
const REPORTER_FUNCTIONS = [
	"logValidationErrors",
	"logTestSetBegin",
	"logTestSetComplete",
	"logTestSetSkip",
	"logTestBegin",
	"logTestComplete",
	"logTestSkip",
	"logTaskBegin",
	"logTaskComplete",
	"generateReport"
];

/**
 * Reporter manager class is responsible for loading of reporters
 */
export class ReporterMgr implements IReporter {

	/** Registered reporters */
	protected reporters: Array<IReporter> = [];

	/**
	 * Registers reporter directly
	 *
	 * @param reporter Reporter instance
	 */
	public register(reporter: IReporter) {

		this.reporters.push(reporter);

	}

	/**
	 * Validates reporter instance interface
	 *
	 * @param id Reporter idenitifer (for debugging, eg. filename or so)
	 * @param reporter Reporter object
	 */
	protected validateReporterObject(id: string, reporter: any) {

		// Validate interface
		if (!(reporter instanceof Object))
			throw new Error(`Reporter '${id}' instance is not an object.`);

		for (let i = 0; i < REPORTER_FUNCTIONS.length; i++)
			if (!reporter[REPORTER_FUNCTIONS[i]] || (typeof reporter[REPORTER_FUNCTIONS[i]]) !== "function")
				throw new Error(`Reporter '${id}' must implement '${REPORTER_FUNCTIONS[i]}' function.`);

	}

	/**
	 * Loads and register reporter module from file
	 *
	 * @param filename Reporter filename
	 * @param opts Reporter configuration options
	 */
	public load(filename: string, opts: { [K: string]: any }) {

		const reporterClass = require(filename);
		const reporter = new reporterClass(opts);

		this.validateReporterObject(filename, reporter);
		this.register(reporter);

	}

	/**
	 * Tries to load Dexit reporter module from Node.JS package
	 *
	 * @param path Module path
	 * @param opts Reporter configuration options
	 */
	public loadNodeModule(path: string, opts: { [K: string]: any }) {

		try {

			const pkg = require(path + "/package.json");

			// Skip non-dexit module
			if (pkg.dexitReporter !== true)
				return;

			const main = path + "/" + (pkg.main || "index.js");

			// Try to load module file
			this.load(main, opts);

		} catch (err) {

			throw new Error("Failed load reporter '" + path + "': " + String(err));

		}

	}

	/**
	 * Returns registered reporters
	 */
	public getReporters() {

		return this.reporters;

	}

	/**
	 * Logs test validation errors
	 *
	 * @param errors List of validation errors
	 */
	public logValidationErrors(errors: Array<IValidationError>) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logValidationErrors(errors);

	}

	/**
	 * Logs start of a test set
	 *
	 * @param testSet Test set entry
	 */
	public logTestSetBegin(testSet: ITestSetEntry) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logTestSetBegin(testSet);

	}

	/**
	 * Logs completition of a test set
	 *
	 * @param testSet Test set entry
	 * @param report Test set report
	 */
	public logTestSetComplete(testSet: ITestSetEntry, report: ITestSetReport) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logTestSetComplete(testSet, report);

	}

	/**
	 * Logs skip of a test set
	 *
	 * @param testSet Test set entry
	 */
	public logTestSetSkip(testSet: ITestSetEntry) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logTestSetSkip(testSet);

	}

	/**
	 * Logs start of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 */
	public logTestBegin(testSet: ITestSetEntry, test: ITestEntry) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logTestBegin(testSet, test);

	}

	/**
	 * Logs completition of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 * @param report Test report
	 */
	public logTestComplete(testSet: ITestSetEntry, test: ITestEntry, report: ITestReport) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logTestComplete(testSet, test, report);

	}

	/**
	 * Logs skip of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 */
	public logTestSkip(testSet: ITestSetEntry, test: ITestEntry) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logTestSkip(testSet, test);

	}

	/**
	 * Logs start of a task
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 * @param task Test task
	 */
	public logTaskBegin(testSet: ITestSetEntry, test: ITestEntry, task: ITestTask) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logTaskBegin(testSet, test, task);

	}

	/**
	 * Logs completition of a task
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 * @param task Test task
	 * @param report Task report
	 */
	public logTaskComplete(testSet: ITestSetEntry, test: ITestEntry, task: ITestTask, report: ITestTaskReport) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].logTaskComplete(testSet, test, task, report);

	}

	/**
	 * Generates report of a root test set
	 *
	 * @param report Report TestSet
	 */
	public generateReport(report: ICompleteReport) {

		for (let i = 0; i < this.reporters.length; i++)
			this.reporters[i].generateReport(report);

	}

}
