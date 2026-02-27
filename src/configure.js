/**
 * configure.js
 *
 * Small adapter to wire a Specma-compatible implementation into this library.
 *
 * This module:
 * - declares the list of required Specma functions the library depends on
 * - exports a mutable `specma` reference that other modules import
 * - provides `configure(specmaFns)` to set the implementation (must provide
 *   required functions)
 * - provides `ensureConfigured()` to assert configuration and throw a clear
 *   error when not configured
 *
 * Usage:
 * import { configure } from "svelte-specma";
 * configure(specma); // specma must expose required helper functions
 */

/**
 * List of function names that a Specma implementation must provide.
 * These functions are accessed by the library at runtime.
 * @type {string[]}
 */
const REQUIRED_SPECMA_FNS = [
  "and",
  "getMessage",
  "getPred",
  "getSpread",
  "isOpt",
  "validatePred",
];

/**
 * Error message used when the library has not been configured correctly.
 * @type {string}
 */
const CONFIG_ERROR_MSG =
  "SvelteSpecma must be configured with a valid Specma version.";

/**
 * Mutable export that will hold the configured Specma implementation.
 * Other modules import this and expect it to be populated by calling `configure`.
 * It is `undefined` until `configure()` is called successfully.
 * @type {object|undefined}
 */
export let specma = undefined;

/**
 * ensureConfigured
 *
 * Throw a TypeError with a descriptive message if the library has not been
 * configured with a valid Specma object.
 *
 * Call this at the start of functions that depend on `specma` to provide a
 * clear runtime failure rather than failing with obscure errors later.
 *
 * @throws {TypeError} when `specma` is not set
 */
export function ensureConfigured() {
  if (!specma) {
    throw new TypeError(CONFIG_ERROR_MSG);
  }
}

/**
 * configure
 *
 * Provide a Specma-compatible implementation to the library.
 * The provided object must implement the functions listed in REQUIRED_SPECMA_FNS.
 *
 * Example:
 *   import * as specma from "specma";
 *   configure(specma);
 *
 * @param {object} specmaFns - an object implementing required Specma functions
 * @throws {TypeError} if the provided object is missing required functions
 */
export default function configure(specmaFns) {
  if (!specmaFns) {
    throw new TypeError(CONFIG_ERROR_MSG);
  }

  REQUIRED_SPECMA_FNS.forEach((key) => {
    if (typeof specmaFns[key] !== "function") {
      throw new TypeError(`'${key}' must be a function provided by 'specma'`);
    }
  });
  specma = specmaFns;
}
