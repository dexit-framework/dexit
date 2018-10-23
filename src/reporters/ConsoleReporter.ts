/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import colors = require("colors");
import { inspect, puts } from "util";

import { IReporter } from "../ReporterMgr";
import {
	IValidationError, IAssertionError,
	ITestSetEntry, ITestEntry, ITestTask,
	ITestSetReport, ITestReport, ITestTaskReport, ICompleteReport
} from "../Interfaces";

/**
 * Console reporter options interface
 */
export interface IConsoleReporterOpts {
	detailed?: boolean;
	reportValidTasks?: boolean;
	reportArgs?: boolean;
}

/**
 * Console reporter reports messages to the stdout
 */
export class ConsoleReporter implements IReporter {

	/** If to print details */
	protected detailed: boolean;

	/**
	 * Reporter constructor
	 *
	 * @param opts Options
	 */
	public constructor(protected opts: IConsoleReporterOpts = {}) {

		if (opts.detailed)
			this.detailed = true;

	}

	/**
	 * Formats assertion message
	 * @param err Assertion error
	 */
	protected formatAssertion(id: string, err: IAssertionError) {

		const out = [];

		// Add message
		if (err.message instanceof Array) {

			for (let i = 0; i < err.message.length; i++)
				out.push(colors.white("'$" + err.message[i].dataPath + "' " + err.message[i].message));

		} else if (typeof err.message === "string") {

			out.push(colors.white(err.message));

		}

		// Add actual
		if (err.actual) {
			out.push("", "Actual:");
			out.push.apply(out, this.splitLines(
				colors.green(inspect(err.actual, { depth: null })),
				100
			));
		}

		// Add expected
		if (err.expected) {
			out.push("", "Expected:");
			out.push.apply(out, this.splitLines(
				colors.red(inspect(err.expected, { depth: null })),
				100
			));
		}

		// Return
		if (id)
			return [colors.red("At " + id), out];
		else
			return out;

	}

	/**
	 * Splits message into lines by max line length
	 *
	 * @param msg Message
	 * @param maxLineLength Maximum line length in characters
	 */
	protected splitLines(msg: string, maxLineLength: number) {

		const lines = [];
		const nl = msg.split("\n");

		for (let i = 0; i < nl.length; i++) {

			let cursor = 0;

			while (cursor <= nl[i].length) {

				lines.push(nl[i].substr(cursor, maxLineLength));
				cursor += maxLineLength;

			}

		}

		return lines;

	}

	/**
	 * Format output with proper indentation
	 *
	 * @param output Output array
	 * @param indentSize Indentation size (spaces)
	 * @param level Indentation level
	 */
	protected formatOutput(output: Array<any>, indentSize: number = 2, level: number = 0) {

		const out = [];

		let _indent = "";

		for (let i = 0; i < indentSize * level; i++)
			_indent += " ";

		for (let i = 0; i < output.length; i++) {

			// Sub-lines
			if (output[i] instanceof Array) {

				const subOut = this.formatOutput(output[i], indentSize, level + 1);

				if (subOut.length > 0)
					out.push.apply(out, subOut);

			// Print message
			} else {

				const lines = this.splitLines(output[i], 180);

				for (let j = 0; j < lines.length; j++)
					out.push(_indent + lines[j]);

			}

		}

		return out;

	}

	/**
	 * Returns if a line is empty
	 *
	 * @param line Line
	 */
	protected isLineEmpty(line: any) {

		if (typeof line === "string" && line.trim() === "") {

			return true;

		} else if (line instanceof Array) {

			for (let i = 0; i < line.length; i++)
				if (this.isLineEmpty(line[i]))
					return true;

			return false;

		} else {

			return false;

		}

	}

	/**
	 * Returns if line block array is empty (recursively)
	 *
	 * @param block Block array
	 */
	protected isBlockEmpty(block: Array<any>) {

		if (block.length === 0)
			return true;

		for (let i = 0; i < block.length; i++) {

			if (!(block[i] instanceof Array))
				return false;

			if (!this.isBlockEmpty(block[i]))
				return false;
		}

		return true;

	}

	/**
	 * Return item name based on provided objects
	 *
	 * @param testSet Test Set
	 * @param test Test
	 * @param task Test task
	 * @param taskReport Task report
	 */
	protected getItemName(testSet: ITestSetEntry = null, test: ITestEntry = null, task: ITestTask = null, taskReport: ITestTaskReport = null) {

		const parts = [];

		if (testSet)
			parts.push( testSet.schema ? testSet.schema.name : testSet.id );

		if (test)
			parts.push( test.schema.description || test.schema.name || "@" );

		if (taskReport)
			parts.push( taskReport.label );
		else if (task)
			parts.push( task.do );

		return parts.join(" / ");

	}

	/**
	 * Logs test validation errors
	 *
	 * @param errors List of validation errors
	 */
	public logValidationErrors(errors: Array<IValidationError>) {

		if (errors.length === 0)
			return;

		// Group by documents
		const docs: { [K: string]: Array<IValidationError> } = {};

		for (let i = 0; i < errors.length; i++) {

			const key = errors[i].document.filename;

			if (!docs[key])
				docs[key] = [];

			docs[key].push(errors[i]);

		}

		// Build message
		const docsMsg = [];

		for (const doc in docs) {

			docsMsg.push("", "- " + doc);

			for (let i = 0; i < docs[doc].length; i++)
				docsMsg.push("", this.formatAssertion(docs[doc][i].id, docs[doc][i].error));

		}

		const msg = [
			colors.red("Some of your test files failed to validate."),
			docsMsg,
			""
		];

		console.log(this.formatOutput(msg).join("\n"));

	}

	/**
	 * Logs start of a test set
	 *
	 * @param testSet Test set entry
	 */
	public logTestSetBegin(testSet: ITestSetEntry) {

		if (this.detailed)
			console.log(this.formatOutput([
				colors.gray(`Running TestSet '${this.getItemName(testSet)}'...`)
			]).join("\n"));

	}

	/**
	 * Logs completition of a test set
	 *
	 * @param testSet Test set entry
	 * @param report Test set report
	 */
	public logTestSetComplete(testSet: ITestSetEntry, report: ITestSetReport) {

		if (this.detailed)
			console.log(this.formatOutput([
				report.errorCount > 0 ?
					colors.red(`TestSet '${this.getItemName(testSet)}' completed with ${report.errorCount} errors.`)
				:
					colors.green(`TestSet '${this.getItemName(testSet)}' completed without errors.`)
			]).join("\n"));

	}

	/**
	 * Logs skip of a test set
	 *
	 * @param testSet Test set entry
	 */
	public logTestSetSkip(testSet: ITestSetEntry) {

		if (this.detailed)
			console.log(this.formatOutput([
				colors.gray(`TestSet '${this.getItemName(testSet)}' skipped.`)
			]).join("\n"));

	}

	/**
	 * Logs start of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 */
	public logTestBegin(testSet: ITestSetEntry, test: ITestEntry) {

		if (this.detailed)
			console.log(this.formatOutput([
				colors.gray(`Running Test '${this.getItemName(testSet, test)}'...`)
			]).join("\n"));

	}

	/**
	 * Logs completition of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 * @param report Test error
	 */
	public logTestComplete(testSet: ITestSetEntry, test: ITestEntry, report: ITestReport) {

		if (this.detailed)
			console.log(this.formatOutput([
				report.errorCount > 0 ?
					colors.red(`Test '${this.getItemName(testSet, test)}' completed with ${report.errorCount} errors.`)
				:
					colors.green(`Test '${this.getItemName(testSet, test)}' completed without errors.`)
			]).join("\n"));

	}

	/**
	 * Logs skip of a test
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 */
	public logTestSkip(testSet: ITestSetEntry, test: ITestEntry) {

		if (this.detailed)
			console.log(this.formatOutput([
				colors.gray(`Test '${this.getItemName(testSet, test)}' skipped.`)
			]).join("\n"));

	}

	/**
	 * Logs start of a task
	 *
	 * @param testSet Parent Test set entry
	 * @param test Test entry
	 * @param task Test task
	 */
	public logTaskBegin(testSet: ITestSetEntry, test: ITestEntry, task: ITestTask) {

		if (this.detailed)
			console.log(this.formatOutput([
				colors.gray(`Running Task '${this.getItemName(testSet, test, task)}'...`)
			]).join("\n"));

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

		if (!this.detailed)
			return;

		let msg;

		if (report.errors.length > 0) {

			const errMsgs = [];

			for (let i = 0; i < report.errors.length; i++)
				errMsgs.push(this.formatAssertion(null, report.errors[i]));

			msg = [
				colors.red(`Task '${this.getItemName(testSet, test, task, report)}' failed:`),
				"",
				errMsgs
			];

		} else {

			msg = [
				colors.green(`Task '${this.getItemName(testSet, test, task, report)}' completed without errors.`)
			];

		}

		console.log(this.formatOutput(msg).join("\n"));

	}

	/**
	 * Generates array output for test task report
	 *
	 * @param task Test Task Report
	 */
	protected reportTask(task: ITestTaskReport) {

		// Skip if valid and not to report valid tasks
		if (task.errors.length === 0 && !this.opts.reportValidTasks)
			return [];

		const out = [];

		// Add label
		if (task.errors.length > 0) {

			out.push(colors.red(`- ✘ ${task.label}`));

			const errMsgs = [];

			for (let i = 0; i < task.errors.length; i++)
				errMsgs.push(this.formatAssertion(null, task.errors[i]), "");

			out.push(errMsgs);

		} else  {

			out.push(colors.green(`- ✔ ${task.label}`));

		}

		if (this.opts.reportArgs) {

			const argsOut = [];

			argsOut.push("", "Run Args:");
			argsOut.push.apply(argsOut, this.splitLines(
				colors.green(inspect(task.runArgs, { depth: null })),
				100
			));

			argsOut.push("", "Expect Args:");
			argsOut.push.apply(argsOut, this.splitLines(
				colors.green(inspect(task.expectArgs, { depth: null })),
				100
			));

			if (task.result) {

				argsOut.push("", "Result:");
				argsOut.push.apply(argsOut, this.splitLines(
					colors.green(inspect(task.result, { depth: null })),
					100
				));

			}

			if (task.setArgs) {

				argsOut.push("", "Set:");
				argsOut.push.apply(argsOut, this.splitLines(
					colors.green(inspect(task.setArgs, { depth: null })),
					100
				));

			}

			out.push(argsOut, "");

		}

		return out;

	}

	/**
	 * Generates array output for test report
	 *
	 * @param test Test Report
	 */
	protected reportTest(test: ITestReport) {

		const out = [];
		const tasksOut = [];
		const beforeOut = [];
		const afterOut = [];

		// Add label
		if (test.errorCount > 0)
			out.push(colors.red(`✘ ${test.test.schema.description}`));
		else if (test.tasks.length === 0 && test.beforeTasks.length === 0 && test.afterTasks.length === 0)
			out.push(colors.gray(`✔ ${test.test.schema.description}`));
		else
			out.push(colors.green(`✔ ${test.test.schema.description}`));

		// Add before tasks
		for (let i = 0; i < test.beforeTasks.length; i++)
			beforeOut.push(this.reportTask(test.beforeTasks[i]));

		// Add tasks
		for (let i = 0; i < test.tasks.length; i++)
			tasksOut.push(this.reportTask(test.tasks[i]));

		// Add after tasks
		for (let i = 0; i < test.afterTasks.length; i++)
			afterOut.push(this.reportTask(test.afterTasks[i]));

		// Add to output
		if (!this.isBlockEmpty(beforeOut)) out.push(beforeOut.concat([["---"]]));
		if (!this.isBlockEmpty(tasksOut)) out.push(tasksOut);
		if (!this.isBlockEmpty(afterOut)) out.push([["---"]].concat(afterOut));

		return out;

	}

	/**
	 * Generates array output for test set report
	 *
	 * @param testSet Test Set Report
	 */
	protected reportTestSet(testSet: ITestSetReport) {

		const out = [];
		const testResults = [];
		const childReports = [];
		const beforeOut = [];
		const afterOut = [];

		// Generate test results
		for (let i = 0; i < testSet.tests.length; i++)
			testResults.push(this.reportTest(testSet.tests[i]));

		// Generate child reports
		for (let i = 0; i < testSet.children.length; i++)
			childReports.push(this.reportTestSet(testSet.children[i]) );

		// Add before tasks
		for (let i = 0; i < testSet.beforeTasks.length; i++)
			beforeOut.push(this.reportTask(testSet.beforeTasks[i]));

		// Add after tasks
		for (let i = 0; i < testSet.afterTasks.length; i++)
			afterOut.push(this.reportTask(testSet.afterTasks[i]));

		// Add label
		// tslint:disable-next-line:max-line-length
		let label = testSet.testSet.path[testSet.testSet.path.length - 1];
		let sublabel = null;

		if (testSet.testSet.schema && testSet.testSet.schema.description) {

			label = testSet.testSet.schema.description;
			sublabel = testSet.testSet.path[testSet.testSet.path.length - 1];

		}

		if (testSet.errorCount > 0)
			out.push(colors.red(`✘ ${label}`) + ( sublabel ? " " + colors.gray(`(${sublabel})`) : "" ));
		else if (testSet.testCount - testSet.skippedCount === 0)
			out.push(colors.gray(`✔ ${label}` + ( sublabel ? " " + colors.gray(`(${sublabel})`) : "" )));
		else
			out.push(colors.green(`✔ ${label}` + ( sublabel ? " " + colors.gray(`(${sublabel})`) : "" )));

		// Add test and task results
		if (!this.isBlockEmpty(beforeOut)) out.push([["# Before All", beforeOut]], "");
		if (!this.isBlockEmpty(testResults)) out.push(testResults);
		if (!this.isBlockEmpty(afterOut)) out.push("", [["# After All", afterOut]]);

		// Add child test sets
		if (childReports.length > 0)
			out.push(childReports);

		if (!this.isLineEmpty(out[out.length - 1]))
			out.push("");

		return out;

	}

	/**
	 * Generates report of a root test set
	 *
	 * @param report Report TestSet
	 */
	public generateReport(report: ICompleteReport) {

		const msg = [];

		for (let i = 0; i < report.testSets.length; i++)
			msg.push.apply(msg, this.reportTestSet(report.testSets[i]));

		if (report.errorCount > 0)
			msg.push(
				// tslint:disable-next-line:max-line-length
				colors.red(`✘ Completed ${report.testCount - report.skippedCount} of ${report.testCount} tests (${report.skippedCount} skipped) with ${report.errorCount} errors in ${report.duration} seconds.`)
			);

		else
			msg.push(
				// tslint:disable-next-line:max-line-length
				colors.green(`✔ Completed ${report.testCount - report.skippedCount} of ${report.testCount} tests (${report.skippedCount} skipped) without errors in ${report.duration} seconds.`)
			);

		console.log(this.formatOutput(msg).join("\n"));

	}

}
