/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import * as deepMerge from "deepmerge";

import {
	ITestTask, ITestEntry, ITestSetEntry,
	ICompleteReport,
	IRunContext,
	ITestTaskReport,
	ITestReport,
	ITestSetReport,
	IAssertionError
} from "./Interfaces";

import { ReporterMgr } from "./ReporterMgr";
import { ModuleMgr } from "./ModuleMgr";

import { resolveArgs, promiseWait, IPromiseWait, clone, formatHrtime } from "./Util";

/**
 * Runner options
 */
export interface IRunnerOpts {}

/**
 * Runner class is resonsible for execution of tests
 */
export class Runner {

	/**
	 * Runner constructor
	 *
	 * @param moduleMgr Modules manager
	 * @param reporterMgr Reporter manager
	 * @param opts Options
	 */
	public constructor(
		protected moduleMrgr: ModuleMgr,
		protected reporterMgr: ReporterMgr,
		protected opts: IRunnerOpts
	) {}

	/**
	 * Executes a task
	 *
	 * @param ctx Run context
	 * @param task Task
	 * @param onReady If task is ready to continue (for runBeforeAsync)
	 */
	protected async runTask(ctx: IRunContext, task: ITestTask, onReady: IPromiseWait) {

		const report: ITestTaskReport = {
			task: task,
			context: ctx,
			label: task.do,
			runArgs: null,
			expectArgs: null,
			result: null,
			setArgs: null,
			errors: [],
		};

		let phase = "validation";

		try {

			const cmdArgs = this.moduleMrgr.parseCommand(task.do);
			const cmd = this.moduleMrgr.getCommand(task.do);

			report.runArgs = deepMerge(ctx.defaults[cmdArgs.module] || {}, resolveArgs(ctx.params, task.args || {}));
			report.expectArgs = resolveArgs(ctx.params, task.expect || {});

			// Validate args and expect
			let argErrors: Array<IAssertionError> = [];
			let expectErrors: Array<IAssertionError> = [];

			if (cmd.validateArgs)
				argErrors = cmd.validateArgs(report.runArgs);

			if (cmd.validateExpect)
				expectErrors = cmd.validateExpect(report.expectArgs);

			if (argErrors.length > 0 || expectErrors.length > 0) {

				if (argErrors.length > 0)
					report.errors.push({ message: "Task has invalid run arguments:", actual: report.runArgs });

				report.errors.push.apply(report.errors, argErrors);

				if (expectErrors.length > 0)
					report.errors.push({ message: "Task has invalid expect arguments:", actual: report.expectArgs });

				report.errors.push.apply(report.errors, expectErrors);

				onReady.resolve();
				return report;

			}

			// Set label?
			if (task.description)
				report.label = task.description;
			else if (cmd.getLabel)
				report.label = cmd.getLabel(report.runArgs, report.expectArgs);

			// Run module
			phase = "run";

			report.result = await cmd.run(report.runArgs, () => onReady.resolve());

			// Run expect
			phase = "expect";

			if (cmd.expect && task.expect)
				report.errors = cmd.expect(report.expectArgs, report.result);

			// Set values to params
			if (task.set) {

				phase = "set";

				const setObj = resolveArgs(Object.assign({}, report.result), task.set);
				report.setArgs = setObj;

				ctx.params = Object.assign(ctx.params, setObj);

			}

		} catch (err) {

			report.errors.push({
				message: "Failed to execute task " + phase + ": " + String(err)
			});

		}

		return report;

	}

	/**
	 * Executes a list of tasks
	 * @param ctx Run context
	 * @param tasks Task list
	 */
	protected async runTaskList(ctx: IRunContext, testSet: ITestSetEntry, test: ITestEntry, tasks: Array<ITestTask>) {

		const taskReports: Array<ITestTaskReport> = [];
		const taskMap: { [K: string]: { task: ITestTask, runOrder: number, waitOrder: number, completitionPromise: Promise<any> } } = {};
		const executionPlan: Array<{ runTask?: string, waitFor?: string, order: number }> = [];

		let errorCount = 0;
		let shouldTerminate = false;

		// Add tasks to map
		for (let i = 0; i < tasks.length; i++)
			taskMap[tasks[i].id || `$_${i}_#`] = {
				task: tasks[i],
				runOrder: i * 1000,
				waitOrder: (i * 1000) + 1,
				completitionPromise: null
			};

		// Resolve dependencies
		for (const id in taskMap) {

			if (!taskMap[id].task.runBeforeAsync) continue;
			taskMap[id].runOrder = taskMap[ taskMap[id].task.runBeforeAsync ].runOrder - 1;

		}

		// Create an execution plan
		for (const id in taskMap) {

			executionPlan.push({
				runTask: id,
				order: taskMap[id].runOrder
			});

			executionPlan.push({
				waitFor: id,
				order: taskMap[id].waitOrder
			});

		}

		executionPlan.sort((a, b) => a.order > b.order ? 1 : ( a.order < b.order ? -1 : 0 ));

		// Execute
		for (let i = 0; i < executionPlan.length; i++) {

			const step = executionPlan[i];

			// Run task
			if (step.runTask) {

				const target = taskMap[step.runTask];

				// Log
				this.reporterMgr.logTaskBegin(testSet, test, target.task);

				// Create ready promise object
				const ready = promiseWait();

				// Run task
				target.completitionPromise = this.runTask(ctx, target.task, ready);

				// Wait to be ready
				await ready.promise;

			// Wait for task completition
			} else if (step.waitFor) {

				const target = taskMap[step.waitFor];

				const taskReport = await target.completitionPromise;

				if (taskReport.errors.length > 0) {

					errorCount++;

					if (!taskReport.task.continueOnError)
						shouldTerminate = true;

				}

				taskReports.push(taskReport);

				// Log
				this.reporterMgr.logTaskComplete(testSet, test, taskReport.task, taskReport);

			}

			// Terminate?
			if (shouldTerminate)
				break;

		}

		// Return report
		return {
			tasks: taskReports,
			errorCount: errorCount
		};

	}

	/**
	 * Runs the test
	 * @param ctx Run context
	 * @param testSet Test set
	 * @param test Test
	 */
	protected async runTest(ctx: IRunContext, testSet: ITestSetEntry, test: ITestEntry) {

		const testReport: ITestReport = {
			test: test,
			errorCount: 0,
			tasks: [],
			beforeTasks: [],
			afterTasks: []
		};

		// Log
		this.reporterMgr.logTestBegin(testSet, test);

		// Create context
		const childCtx: IRunContext = deepMerge(clone(ctx), {
			defaults: test.defaults,
			params: test.params
		});

		// Run before tasks
		const beforeRun = await this.runTaskList(childCtx, testSet, test, testSet.beforeEachTasks);

		testReport.beforeTasks = beforeRun.tasks;
		testReport.errorCount += beforeRun.errorCount;

		// Run test tasks if before tasks was sucessfull
		if (testReport.errorCount === 0) {

			const testRun = await this.runTaskList(childCtx, testSet, test, test.tasks);

			testReport.tasks = testRun.tasks;
			testReport.errorCount += testRun.errorCount;

		}

		// Run after tasks
		const afterRun = await this.runTaskList(childCtx, testSet, test, testSet.afterEachTasks);

		testReport.afterTasks = afterRun.tasks;
		testReport.errorCount += afterRun.errorCount;

		// Log
		this.reporterMgr.logTestComplete(testSet, test, testReport);

		// Return
		return testReport;

	}

	/**
	 * Run the Test Set
	 *
	 * @param ctx Run context
	 * @param testSet Test Set
	 */
	public async runTestSet(ctx: IRunContext, testSet: ITestSetEntry) {

		const testSetReport: ITestSetReport = {
			testSet: testSet,
			tests: [],
			beforeTasks: [],
			afterTasks: [],
			testCount: testSet.tests.length,
			skippedCount: 0,
			errorCount: 0,
			children: []
		};

		// Create context
		const childCtx: IRunContext = deepMerge(clone(ctx), {
			defaults: testSet.defaults,
			params: testSet.params
		});

		// Log
		this.reporterMgr.logTestSetBegin(testSet);

		// Run before all tasks
		const beforeRun = await this.runTaskList(childCtx, testSet, null, testSet.beforeAllTasks);

		testSetReport.beforeTasks = beforeRun.tasks;
		testSetReport.errorCount += beforeRun.errorCount;

		// Run tests and child testSets if before tasks was successfull
		if (testSetReport.errorCount === 0) {

			const testPromises = [];
			const childSetPromises = [];

			// Run tests
			for (let i = 0; i < testSet.tests.length; i++) {

				const test = testSet.tests[i];

				if (test.skip) {

					this.reporterMgr.logTestSkip(testSet, test);
					testSetReport.skippedCount++;

				} else {

					const testPromise = this.runTest(childCtx, testSet, test);

					if (testSet.schema.executionOrder === "sync")
						await testPromise;

					testPromises.push(testPromise);

				}

			}

			// Run child test sets
			for (const j in testSet.children) {

				const childSet = testSet.children[j];

				if (childSet.skip) {

					this.reporterMgr.logTestSetSkip(testSet);
					testSetReport.skippedCount += childSet.testCount;

				} else {

					childSetPromises.push(
						this.runTestSet(childCtx, childSet)
					);

				}

			}

			// Wait for completition
			testSetReport.tests = await Promise.all(testPromises);
			testSetReport.children = await Promise.all(childSetPromises);

			// Merge error counts
			for (let i = 0; i < testSetReport.tests.length; i++)
				testSetReport.errorCount += testSetReport.tests[i].errorCount;

			for (let i = 0; i < testSetReport.children.length; i++) {
				testSetReport.testCount += testSetReport.children[i].testCount;
				testSetReport.skippedCount += testSetReport.children[i].skippedCount;
				testSetReport.errorCount += testSetReport.children[i].errorCount;
			}

		}

		// Run after all tasks
		const afterRun = await this.runTaskList(childCtx, testSet, null, testSet.afterAllTasks);

		testSetReport.afterTasks = afterRun.tasks;
		testSetReport.errorCount += afterRun.errorCount;

		// Log
		this.reporterMgr.logTestSetComplete(testSet, testSetReport);

		// Return
		return testSetReport;

	}

	/**
	 * Runs the test sets and generates report object
	 *
	 * @param testSets Test sets to run
	 */
	public async run(testSets: { [K: string]: ITestSetEntry }) {

		const report: ICompleteReport = {
			testSets: [],
			testCount: 0,
			skippedCount: 0,
			errorCount: 0,
			duration: 0
		};

		// Prepare context
		const defaultCtx: IRunContext = {
			params: {},
			defaults: {}
		};

		// Setup timer
		const timeStart = process.hrtime();

		// Run test sets
		const testSetPromises = [];

		for (const k in testSets) {

			if (testSets[k].skip) {

				this.reporterMgr.logTestSetSkip(testSets[k]);
				report.skippedCount += testSets[k].testCount;

			} else {

				testSetPromises.push(
					this.runTestSet(defaultCtx, testSets[k])
				);

			}

		}

		// Wait for completition
		report.testSets = await Promise.all(testSetPromises);

		// End timer
		const timeDuration = process.hrtime(timeStart);

		report.duration = formatHrtime(timeDuration);

		// Aggergate counters
		for (let i = 0; i < report.testSets.length; i++) {

			report.testCount += report.testSets[i].testCount;
			report.skippedCount += report.testSets[i].skippedCount;
			report.errorCount += report.testSets[i].errorCount;

		}

		return report;

	}

}
