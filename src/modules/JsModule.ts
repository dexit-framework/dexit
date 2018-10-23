/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { runInNewContext } from "vm";
import { ITestModule } from "../ModuleMgr";
import { AssertionError } from "assert";

/** Arguments schema */
const ARGS_SCHEMA = {
	type: "object",
	properties: {
		code: {
			type: "string",
			description: "JavaScript expression code"
		},
		script: {
			type: "string",
			description: "JavaScript script code (you are allowed to use multiple statements)"
		}
	}
};

/** Expect arguments schema */
const EXPECT_SCHEMA = {
	type: "object",
	properties: {
		code: {
			type: "string",
			description: "JavaScript expression code"
		},
		script: {
			type: "string",
			description: "JavaScript script code (you are allowed to use multiple statements)"
		},
	}
};

/**
 * Create a context object for sandboxed scripts
 *
 * @param args Args
 */
function createContextObject(args: any) {

	return Object.assign({
		setTimeout: setTimeout,
		setInterval: setInterval,
		Date: Date
	}, args, { $_return: null });

}

/**
 * Run the simple expression
 *
 * @param code Expression code
 * @param args Arguments
 */
function runExpression(code: string, args: any) {

	const ctx = createContextObject(args);

	runInNewContext("$_return=(" + args.code + ");", ctx);

	return ctx;

}

/**
 * Run complex script
 *
 * @param code Script code
 * @param args Arguments
 */
function runScript(code: string, args: any) {

	const ctx = createContextObject(args);

	runInNewContext("$_return=(function(){" + code + "})();", ctx);

	return ctx;

}

export const JsModule: ITestModule = {
	name: "js",
	description: "Module provides commands to evaluate JavaScript expressions.",
	commands: {

		eval: {
			description: "Evaluates JavaScript code both for run and expect (if set)",
			argsSchema: ARGS_SCHEMA,
			expectSchema: EXPECT_SCHEMA,

			getLabel: (runArgs, expectArgs) => runArgs.code ? runArgs.code : ( expectArgs.code ? expectArgs.code : "js.eval" ),

			run: async (args, onReady) => {

				onReady();

				let res = { $_return: {} };

				if (args.code)
					res = runExpression(args.code, args);
				else if (args.script)
					res = runScript(args.script, args);

				if (res.$_return instanceof Promise)
					return await res.$_return;
				else
					return res.$_return;

			},

			expect: (args, result) => {

				try {

					if (args.code) {

						const res = runExpression(args.code, Object.assign({}, args, { result: result }));

						if (!res.$_return)
							return [{
								message: "Assertion failed",
								expected: args.code,
								actual: args
							}];

					} else if (args.script) {

						runScript(args.script, Object.assign({}, args, { result: result }));

					}

					return [];

				} catch (err) {

					if (err instanceof AssertionError)
						return [{
							message: err.message,
							expected: err.expected,
							actual: err.actual
						}];
					else
						return [{
							message: err.message,
						}];

				}

			}
		}

	}
};
