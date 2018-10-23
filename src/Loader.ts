/*
 * dexit
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0
 */

import { readFile, readdirSync, statSync } from "fs";
import { resolve as resolvePath } from "path";
import { loadAll as yamlLoadAll } from "js-yaml";
import { ITestDocument } from "./Interfaces";
import { TestsDirectoryNotFoundError } from "./Errors";

/**
 * Loader is a class responsible for loading and parsing test files
 */
export class Loader {

	/**
	 * Resolve file list from recursive directory search with respect to search and ignore patterns
	 *
	 * @param basePath Base path
	 * @param relativePath Relative path (filters only apply to this path)
	 * @param searchPattern Search RegExp pattern
	 * @param ignorePattern Ignore RegExp pattern
	 */
	protected resolveDirectory(basePath: string, relativePath: string, searchPattern: RegExp, ignorePattern: RegExp) {

		const fullPath = resolvePath(basePath + "/" + relativePath);

		const files = readdirSync(fullPath);
		const result = [];

		for (let i = 0; i < files.length; i++) {

			const relativeFilePath = relativePath + "/" + files[i];
			const fullFilePath = fullPath + "/" + files[i];

			// Search recursively if directory
			if (statSync(fullFilePath).isDirectory()) {

				const subResult = this.resolveDirectory(basePath, relativeFilePath, searchPattern, ignorePattern);
				result.push.apply(result, subResult);

			// If file add to list
			} else if (statSync(fullFilePath).isFile()) {

				// Skip if not match pattern or should be ignored
				if (searchPattern !== null && !relativeFilePath.match(searchPattern))
					continue;

				if (ignorePattern !== null && relativeFilePath.match(ignorePattern))
					continue;

				result.push(relativeFilePath);

			}

		}

		return result;

	}

	/**
	 * Loads single test file and return array of parsed documents
	 * @param basePath Full filename
	 * @param filename Relative filename
	 */
	public loadTest(basePath: string, filename: string): Promise<Array<ITestDocument>> {

		const fullPath = basePath + "/" + filename;

		return new Promise((resolve, reject) => {

			readFile(fullPath, { encoding: "utf-8" }, (err, data) => {

				// Reject with an error
				if (err)
					return reject(err);

				// Try to parse yaml
				const docs = [];

				yamlLoadAll(data, (doc) => docs.push({
					filename: filename,
					fullPath: fullPath,
					document: doc
				}));

				resolve(docs);

			});

		});

	}

	/**
	 * Load all tests from a directory
	 *
	 * @param basePath Base test directory path
	 * @param path Directory path
	 * @param searchPattern Search RegExp pattern - defaults to .yaml|.yml files
	 * @param ignorePattern Ignore RegExp pattern
	 */
	public async loadDirectory(
		basePath: string, path: string,
		searchPattern: RegExp = new RegExp("^.*(\.yml|\.yaml)$"), ignorePattern: RegExp = null
	) {

		let files;

		try {

			files = this.resolveDirectory(basePath, path, searchPattern, ignorePattern);

		} catch (err) {

			if (err.code === "ENOENT")
				throw new TestsDirectoryNotFoundError(basePath + "/" + path);
			else
				throw err;

		}

		const jobs = [];

		for (let i = 0; i < files.length; i++)
			jobs.push( this.loadTest(basePath, files[i]) );

		return Promise.all(jobs).then((docsList) => {

			const docs = [];

			for (let i = 0; i < docsList.length; i++)
				docs.push.apply(docs, docsList[i]);

			return docs;

		}, (err) => {

			throw err;

		});

	}

}
