/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { ITestModule } from "../ModuleMgr";

/** Request arguments schema */
const REQUEST_ARGS_SCHEMA = {
	type: "object",
	description: "Module provides HTTP calls and response assertions.",
	properties: {
		url: {
			type: "string",
			description: "Request URL"
		},
		baseUrl: {
			type: "string",
			description: "Base URL for the request"
		},
		path: {
			type: "string",
			description: "Endpoint path"
		},
		query: {
			type: "object",
			description: "Query parameters"
		},
		body: {
			type: "string",
			description: "Body payload"
		},
		jsonBody: {}
	}
};

/** Expect arguments schema */
const EXPECT_SCHEMA = {
	type: "object",
	properties: {
		code: {
			type: "integer",
			description: "Response HTTP status code"
		},
		jsonSchema: {
			type: "object",
			description: "JSON schema to validate response body"
		}
	}
};

function getUrl(args: any) {

	if (args.url)
		return args.url;
	else
		return args.baseUrl + args.path;

}

function validateArgs(args: any) {

	const errors = [];

	if (!args.url && (!args.baseUrl || !args.path))
		errors.push({ message: "Property 'url' or 'baseUrl' with 'path' must be set." });

	return errors;

}

function handleExpect(args: any, result: any) {

	const errors = [];

	if (args.code && result.code !== args.code)
		errors.push({
			message: "Invalid HTTP response status code.",
			expected: args.code,
			actual: result.code
		});

	return errors;

}

export const HttpModule: ITestModule = {
	name: "http",
	description: "Module provides HTTP calls and response assertions.",
	defaultsSchema: REQUEST_ARGS_SCHEMA,
	commands: {

		get: {
			description: "Calls a HTTP endpoint using the GET method.",
			argsSchema: REQUEST_ARGS_SCHEMA,
			expectSchema: EXPECT_SCHEMA,
			validateArgs: validateArgs,

			getLabel: (args) => `HTTP GET '${getUrl(args)}'`,

			run: async (args, onReady) => {

				onReady();

				return { code: 200 };

			},

			expect: handleExpect
		},

		post: {
			description: "Calls a HTTP endpoint using the POST method.",
			argsSchema: REQUEST_ARGS_SCHEMA,
			expectSchema: EXPECT_SCHEMA,
			validateArgs: validateArgs,

			getLabel: (args) => `HTTP POST '${getUrl(args)}'`,

			run: async (args, onReady) => {

				onReady();

				return { code: 200 };

			},

			expect: handleExpect
		}

	}
};
