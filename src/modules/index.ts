/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { JsModule } from "./JsModule";

// Export classes
export * from "./JsModule";

// Export module map
export const BUILTIN_MODULES = [
	JsModule
];
