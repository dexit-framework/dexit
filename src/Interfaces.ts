/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import * as Ajv from "ajv";

/** JSON schema for test task */
export const TEST_TASK_SCHEMA = {
	type: "object",
	required: [
		"do"
	],
	additionalProperties: false,
	properties: {
		id: {
			type: "string",
			description: "Unique ID of the task within a test"
		},
		description: {
			type: "string",
			description: "Task description"
		},
		do: {
			type: "string",
			description: "Command identifier"
		},
		args: {
			type: "object",
			description: "Module arguments",
			default: {}
		},
		expect: {
			type: "object",
			description: "Expectation arguments",
		},
		set: {
			type: "object",
			description: "Assign values from task result to parameter"
		},
		runBeforeAsync: {
			type: "string",
			description: "Specifies a task ID that current task must be run before async"
		},
		continueOnError: {
			type: "boolean",
			description: "If to continue to other task if an error occur during task execution",
			default: false
		}
	}
};

export const DEFAULTS_SCHEMA = {
	type: "object",
	description: "Default parameters for modules",
	additionalProperties: {
		type: "object",
		description: "Default module parameters"
	}
};

/** JSON schema for test set */
export function TESTSET_SCHEMA(taskSchema, defaultsSchema) {

	return {
		type: "object",
		required: [
			"name"
		],
		properties: {
			name: {
				type: "string",
				description: "Test set name"
			},
			description: {
				type: "string",
				description: "Test set description"
			},
			tags: {
				type: "array",
				description: "Test set tags",
				items: {
					type: "string",
					description: "Tag name"
				}
			},
			defaults: defaultsSchema,
			params: {
				type: "object",
				description: "TestSet parameters"
			},
			beforeAll: {
				type: "array",
				description: "Tasks to run before this TestSet",
				items: taskSchema
			},
			afterAll: {
				type: "array",
				description: "Tasks to run after this TestSet",
				items: taskSchema
			},
			beforeEach: {
				type: "array",
				description: "Tasks to run before each Test",
				items: taskSchema
			},
			afterEach: {
				type: "array",
				description: "Tasks to run fter each Test",
				items: taskSchema
			},
			executionOrder: {
				type: "string",
				description: "If tests should be run synchronously after each other or asynchronously. By default test are executed async.",
				default: "async",
				enum: [ "async", "sync" ]
			},
			skip: {
				type: "boolean",
				description: "If to skip this Test set",
				default: false
			},
			tests: {
				type: "array",
				description: "Set of tests",
				items: {
					type: "object",
					description: "Single test",
					required: [
						"description",
						"tasks"
					],
					properties: {
						name: {
							type: "string",
							description: "Test name"
						},
						description: {
							type: "string",
							description: "Test description"
						},
						tags: {
							type: "array",
							description: "Test tags",
							items: {
								type: "string",
								description: "Tag name"
							}
						},
						defaults: defaultsSchema,
						params: {
							type: "object",
							description: "Test parameters"
						},
						skip: {
							type: "boolean",
							description: "If to skip this Test",
							default: false
						},
						tasks: {
							type: "array",
							description: "Test tasks",
							items: taskSchema
						}
					}
				}
			}
		}

	};

}

/**
 * Test set execution order type
 */
export enum EXECUTION_ORDER_TYPE {
	SYNC = "sync",
	ASYNC = "async"
}

/**
 * Test document interface
 */
export interface ITestDocument {
	filename: string;
	fullPath: string;
	document: any;
}

/**
 * Test task interface
 */
export interface ITestTask {
	id?: string;
	description?: string;
	do: string;
	args?: { [K: string] : any };
	expect?: { [K: string] : any };
	set?: { [K: string]: string };
	runBeforeAsync?: string;
	continueOnError: boolean;
	executionOrder?: number;
}

/**
 * Single test interface
 */
export interface ITest {
	name?: string;
	description: string;
	tags?: Array<string>;
	defaults?: { [K: string]: any };
	params?: { [K: string]: any };
	skip: boolean;
	tasks: Array<ITestTask>;
}

/**
 * Test Set interface
 */
export interface ITestSet {
	name: string;
	description?: string;
	tags?: Array<string>;
	defaults?: { [K: string]: any };
	params?: { [K: string]: any };
	beforeAll?: Array<ITestTask>;
	afterAll?: Array<ITestTask>;
	beforeEach?: Array<ITestTask>;
	afterEach?: Array<ITestTask>;
	executionOrder: EXECUTION_ORDER_TYPE;
	skip: boolean;
	tests?: Array<ITest>;
}

/**
 * Resolved test entry interface
 */
export interface ITestEntry {
	/** Test definition schema */
	schema: ITest;
	/** Unique test string ID resolved from path */
	id: string;
	/** Test path - namespace + test index / name */
	path: Array<string>;
	/** Resolved list of tags */
	tags: Array<string>;
	/** Resolved default values */
	defaults: { [K: string]: any };
	/** Test params */
	params: { [K: string]: any };
	/** Test tasks */
	tasks: Array<ITestTask>;
	/** If to skip the test */
	skip: boolean;
}

/**
 * Test runner group
 */
export interface ITestSetEntry {
	schema: ITestSet;
	id: string;
	localName: string;
	path: Array<string>;
	tags: Array<string>;
	defaults: { [K: string]: any };
	params: { [K: string]: any };
	beforeEachTasks: Array<ITestTask>;
	afterEachTasks: Array<ITestTask>;
	beforeAllTasks: Array<ITestTask>;
	afterAllTasks: Array<ITestTask>;
	tests: Array<ITestEntry>;
	children: { [K: string]: ITestSetEntry };
	skip: boolean;
}

/**
 * Validation error types
 */
export enum VALIDATION_ERROR_TYPE {
	INVALID_SCHEMA = "invalidSchema",
	INVALID_STRUCT = "invalidStruct"
}

/**
 * Document validation error interface
 */
export interface IValidationError {
	document: ITestDocument;
	id: string;
	error: IAssertionError;
}

/**
 * Test runner context
 */
export interface IRunContext {
	defaults: { [K: string]: any };
	params: { [K: string]: any };
}

/**
 * Interface representing assertion error
 */
export interface IAssertionError {
	message: string|Array<Ajv.ErrorObject>;
	expected?: any;
	actual?: any;
}

/**
 * Report of task completition
 */
export interface ITestTaskReport {
	task: ITestTask;
	label: string;
	context: IRunContext;
	runArgs: any;
	expectArgs: any;
	result: any;
	setArgs: any;
	errors: Array<IAssertionError>;
}

/**
 * Report of test completition
 */
export interface ITestReport {
	test: ITestEntry;
	tasks: Array<ITestTaskReport>;
	beforeTasks: Array<ITestTaskReport>;
	afterTasks: Array<ITestTaskReport>;
	errorCount: number;
}

/**
 * Report of task completition
 */
export interface ITestSetReport {
	testSet: ITestSetEntry;
	tests: Array<ITestReport>;
	beforeTasks: Array<ITestTaskReport>;
	afterTasks: Array<ITestTaskReport>;
	children: Array<ITestSetReport>;
	testCount: number;
	skippedCount: number;
	errorCount: number;
}

/**
 * Overall test reports
 */
export interface ICompleteReport {
	testSets: Array<ITestSetReport>;
	testCount: number;
	skippedCount: number;
	errorCount: number;
	duration: number;
}
