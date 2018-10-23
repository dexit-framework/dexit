/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { ModuleMgr } from "./ModuleMgr";
import { TESTSET_SCHEMA, TEST_TASK_SCHEMA, DEFAULTS_SCHEMA } from "./Interfaces";
import * as deepmerge from "deepmerge";

/**
 * Class providing various tools
 */
export class Tools {

	/**
	 * Tools constructor
	 *
	 * @param moduleMrgr Module manager
	 */
	public constructor(
		protected moduleMrgr: ModuleMgr
	) {}

	/**
	 * Generates test file schema including all loaded module settings
	 */
	public generateSchema() {

		const modules = this.moduleMrgr.getAllModules();

		const taskSchemas = [];
		const defaultsSchemas = {};

		// Build schemas
		for (const name in modules) {

			const mod = modules[name];

			// Build task schemas
			for (const cmd in mod.commands) {

				const cmdSchema = {
					description: mod.commands[cmd].description,
					properties: {
						do: {
							enum: [ mod.name + "." + cmd ]
						}
					}
				};

				if (mod.commands[cmd].argsSchema)
					cmdSchema.properties["args"] = mod.commands[cmd].argsSchema;

				if (mod.commands[cmd].expectSchema)
					cmdSchema.properties["expect"] = mod.commands[cmd].expectSchema;

				taskSchemas.push(cmdSchema);

			}

			// Build defaults schemas
			if (mod.defaultsSchema)
				defaultsSchemas[mod.name] = mod.defaultsSchema;

		}

		// Put together
		const outTaskSchema = deepmerge(TEST_TASK_SCHEMA, {
			anyOf: taskSchemas
		});

		const outDefaultsSchema = deepmerge(DEFAULTS_SCHEMA, {
			properties: defaultsSchemas,
			additionalProperties: false,
			patternProperties: {
				".*": DEFAULTS_SCHEMA.additionalProperties
			}
		});

		// Render
		return TESTSET_SCHEMA(outTaskSchema, outDefaultsSchema);

	}

}
