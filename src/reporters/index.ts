/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { ConsoleReporter } from "./ConsoleReporter";

// Export classes
export * from "./ConsoleReporter";

// Export reporter map
export const BUILTIN_REPORTERS = {
	console: ConsoleReporter
};
