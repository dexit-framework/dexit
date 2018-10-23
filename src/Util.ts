/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import * as JP from "jsonpath";

/**
 * Clones and object
 *
 * @param obj Object to clone
 */
export function clone(obj) {

	let copy;

	// Handle the 3 simple types, and null or undefined
	if (null === obj || "object" !== typeof obj) return obj;

	// Handle Date
	if (obj instanceof Date) {
		copy = new Date();
		copy.setTime(obj.getTime());
		return copy;
	}

	// Handle Array
	if (obj instanceof Array) {
		copy = [];
		for (let i = 0, len = obj.length; i < len; i++) {
			copy[i] = clone(obj[i]);
		}
		return copy;
	}

	// Handle Object
	if (obj instanceof Object) {
		copy = {};
		for (const attr in obj) {
			if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
		}
		return copy;
	}

	throw new Error("Unable to copy obj! Its type isn't supported.");

}

/**
 * Resolves arguments
 *
 * @param data Source data for interpolation
 * @param args Arguments to resolve
 */
export function resolveArgs(data: { [K: string]: any } = {}, args: any) {

	// Interpolate string
	if (typeof args === "string") {

		const ipols = args.match(/\$\{([a-zA-Z0-9\.\_\[\]\*@\?><=\!]+)\}/g);
		let res = args;

		if (ipols !== null) {

			for (let i = 0; i < ipols.length; i++) {

				const jPath = "$." + ipols[i].substr(2, ipols[i].length - 3);
				const value = JP.value(data, jPath);

				if (args === ipols[i])
					return value;

				res = res.replace(ipols[i], value);

			}

		}

		return res;

	// Traverse array
	} else if (args instanceof Array) {

		const res = [];

		for (let i = 0; i < args.length; i++)
			res.push( this.resolveArgs(data, args[i]) );

		return res;

	// Traverse object
	} else if (args instanceof Object) {

		const res = {};

		for (const k in args)
			res[k] = this.resolveArgs(data, args[k]);

		return res;

	} else {

		return args;

	}

}

/**
 * Promise wait interface
 */
export interface IPromiseWait {
	promise: Promise<any>;
	resolve: () => void;
}

/**
 * Return an object with promise and resolve function to be able to resolve promise after some delay
 */
export function promiseWait() {

	let resolved = false;

	return {
		promise: new Promise((resolve) => {

			const timer = setInterval(() => {

				if (!resolved) return;

				clearInterval(timer);
				resolve();

			}, 0);

		}),
		resolve: () => resolved = true
	};

}

/**
 * Converts high-resolution time to seconds as float
 * @param hrTime Time object
 */
export function formatHrtime(hrTime) {

	return (hrTime[0] * 1000000000 + hrTime[1]) / 1000000000;

}
