/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { IValidationError } from "./Interfaces";

/**
 * Test document validation exception
 */
export class ValidationError extends Error {

	public constructor(
		public errors: Array<IValidationError>
	) {

		super("Some test documents failed to validate against schema.");

	}

}
