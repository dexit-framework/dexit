/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import * as Ajv from "ajv";

import {
	ITestDocument, TESTSET_SCHEMA,
	ITestSet, ITestTask, ITestEntry, ITestSetEntry,
	IValidationError, VALIDATION_ERROR_TYPE, TEST_TASK_SCHEMA, DEFAULTS_SCHEMA
} from "./Interfaces";

import { ValidationError } from "./Errors";

import { ModuleMgr } from "./ModuleMgr";

/**
 * Repository options
 */
export interface IRepositoryOpts {
	/** If to ignore invalid documents */
	ignoreInvalid: boolean;
}

/**
 * Repository class which is responsible for validing loading test documents and merging it's params, defaults, etc...
 */
export class Repository {

	/** Root test group */
	protected rootTestSet: ITestSetEntry;

	/** Load and validation errors */
	protected errors: Array<IValidationError> = [];

	/** AJV instance */
	protected ajv: Ajv.Ajv;

	/** Test document schema validator */
	protected schemaValidator;

	/**
	 * Repository constructor
	 *
	 * @param opts Options object
	 * @todo Validate tasks
	 */
	public constructor(
		protected moduleMgr: ModuleMgr,
		protected opts: IRepositoryOpts
	) {

		this.ajv = new Ajv({
			useDefaults: true,
			allErrors: true,
			removeAdditional: true
		});

		this.schemaValidator = this.ajv.compile(TESTSET_SCHEMA(TEST_TASK_SCHEMA, DEFAULTS_SCHEMA));

		this.rootTestSet = {
			schema: null,
			id: "$",
			localName: "$",
			path: [],
			tags: [],
			defaults: {},
			params: {},
			beforeEachTasks: [],
			afterEachTasks: [],
			beforeAllTasks: [],
			afterAllTasks: [],
			tests: [],
			children: {},
			skip: false
		};

	}

	/**
	 * Resolve or create test set entry
	 *
	 * @param path Path array
	 */
	protected resolveSetEntry(path: Array<string>) {

		let parent = this.rootTestSet;

		for (let i = 0; i < path.length; i++) {

			if (!parent.children[path[i]])
				parent.children[path[i]] = {
					schema: null,
					id: parent.id + "." + path[i],
					localName: path[i],
					path: parent.path.slice().concat([ path[i] ]),
					tags: [],
					defaults: {},
					params: {},
					beforeEachTasks: [],
					afterEachTasks: [],
					beforeAllTasks: [],
					afterAllTasks: [],
					tests: [],
					children: {},
					skip: null
				};

			parent = parent.children[path[i]];

		}

		return parent;

	}

	/**
	 * Validates task
	 *
	 * @param id Task ID
	 * @param task Task definition
	 */
	protected validateTask(doc: ITestDocument, id: string, task: ITestTask) {

		// Try to resolve command
		const cmd = this.moduleMgr.getCommand(task.do);

		if (cmd === null) {

			this.errors.push({
				document: doc,
				id: id,
				error: { message: `Command '${task.do}' not found.` }
			});

			return false;

		}

		let isOk: boolean = true;

		// Validate args
		if (cmd._argsValidator && !cmd._argsValidator(task.args)) {

			this.errors.push({
				document: doc,
				id: id,
				error: { message: cmd._argsValidator.errors }
			});

			isOk = false;

		}

		// Validate expect
		if (cmd._expectValidator && !cmd._expectValidator(task.args)) {

			this.errors.push({
				document: doc,
				id: id,
				error: { message: cmd._expectValidator.errors }
			});

			isOk = false;

		}

		return isOk;

	}

	/**
	 * Validates a task list
	 *
	 * @param doc Document
	 * @param parentId Parent ID
	 * @param tasks Task
	 */
	protected validateTaskList(doc: ITestDocument, parentId: string, tasks: Array<ITestTask>) {

		let isOk = true;

		for (let i = 0; i < tasks.length; i++) {

			const taskId = parentId + ".tasks[" + i + "]";

			// Validate schema
			if (!this.validateTask(doc, taskId, tasks[i])) {
				isOk = false;
				continue;
			}

			// Validate dependencies
			if (tasks[i].runBeforeAsync) {

				let found = false;

				for (let j = 0; j < tasks.length; j++)
					if (tasks[j].id === tasks[i].runBeforeAsync) {
						found = true;
						break;
					}

				if (!found) {

					this.errors.push({
						document: doc,
						id: taskId,
						error: { message: `Task with id '${tasks[i].runBeforeAsync}' for runBeforeAsync was not found.` }
					});

					isOk = false;

				}

			}

		}

		return isOk;

	}

	/**
	 * Loads single test document
	 *
	 * @param doc Document object
	 */
	protected loadTestSet(doc: ITestDocument) {

		// Validate schema
		if (!this.schemaValidator(doc.document)) {

			this.errors.push({
				document: doc,
				id: null,
				error: { message: this.schemaValidator.errors }
			});

			return false;

		}

		const testSet = doc.document as ITestSet;
		const testList = [];

		let isOk = true;

		// Load document into the repository
		const path = testSet.name.split(".");
		const setEntry = this.resolveSetEntry(path);

		// Check for duplicity
		if (setEntry.schema !== null) {

			this.errors.push({
				document: doc,
				id: setEntry.id,
				error: { message: `Test with the name '${testSet.name}' already exists in different document.` }
			});

			return false;

		}

		// Validate tasks
		if (!this.validateTaskList(doc, setEntry.id + "#beforeAll", testSet.beforeAll || []))
			isOk = false;

		if (!this.validateTaskList(doc, setEntry.id + "#afterAll", testSet.afterAll || []))
			isOk = false;

		if (!this.validateTaskList(doc, setEntry.id + "#beforeEach", testSet.beforeEach || []))
			isOk = false;

		if (!this.validateTaskList(doc, setEntry.id + "#afterEach", testSet.afterEach || []))
			isOk = false;

		// Load tests
		if (testSet.tests) {

			for (let i = 0; i < testSet.tests.length; i++) {

				const test = testSet.tests[i];

				const testEntry = {
					schema: test,
					id: setEntry.id + ".tests[" + i + "]",
					path: setEntry.path.concat([ "#" + i ]),
					tags: [],
					defaults: {},
					params: {},
					tasks: test.tasks
				};

				// Validate tasks
				if (!this.validateTaskList(doc, testEntry.id, testEntry.tasks))
					isOk = false;

				testList.push(testEntry);

			}

		}

		// Assign values if all ok
		if (isOk) {

			setEntry.schema = testSet;
			setEntry.tests = testList;

		}

		return isOk;

	}

	/**
	 * Build test set - resolves defaults, params, before/after hooks, etc...
	 *
	 * @param parentEntry Parent test set
	 * @param setEntry Current test set
	 */
	protected buildTestSet(parentEntry: ITestSetEntry, setEntry: ITestSetEntry) {

		// Merge values from parents
		if (parentEntry && setEntry.schema) {

			// Merge tags
			setEntry.tags = parentEntry.tags.slice().concat(setEntry.schema.tags || []);

			// Set defaults and params
			setEntry.defaults = setEntry.schema.defaults || {};
			setEntry.params = setEntry.schema.params || {};

			// Merge before/after all
			setEntry.beforeAllTasks = setEntry.schema.beforeAll || [];
			setEntry.afterAllTasks = setEntry.schema.afterAll || [];

			// Merge before/after each
			setEntry.beforeEachTasks = parentEntry.beforeEachTasks.slice().concat(setEntry.schema.beforeEach || []);
			setEntry.afterEachTasks = parentEntry.afterEachTasks.slice().concat(setEntry.schema.afterEach || []);

			// Set skip
			setEntry.skip = parentEntry.skip || setEntry.schema.skip;

		}

		// Build tests
		for (let i = 0; i < setEntry.tests.length; i++) {

			const test = setEntry.tests[i];

			test.tags = setEntry.tags.slice().concat(test.schema.tags || []);

			// Set defaults and params
			test.defaults = test.schema.defaults || {};
			test.params = test.schema.params || {};

			// Set skip
			test.skip = setEntry.skip || test.schema.skip;

		}

		// Build children
		for (const i in setEntry.children)
			this.buildTestSet(setEntry, setEntry.children[i]);

	}

	/**
	 * Loads and validates test documents
	 *
	 * @param docs List of documents
	 */
	public loadDocuments(docs: Array<any>) {

		let hasErrors: boolean = false;

		for (let i = 0; i < docs.length; i++)
			if (!this.loadTestSet(docs[i]))
				hasErrors = true;

		if (hasErrors && !this.opts.ignoreInvalid)
			throw new ValidationError(this.errors);

	}

	/**
	 * Merge params, defaults and other stuff to child sets and tests
	 */
	public build() {

		this.buildTestSet(null, this.rootTestSet);

	}

	/**
	 * Returns root test set
	 */
	public getTests() {

		return this.rootTestSet.children;

	}

	/**
	 * Return validation errors
	 */
	public getErrors() {

		return this.errors;

	}

}
