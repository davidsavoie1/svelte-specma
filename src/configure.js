const REQUIRED_SPECMA_FNS = [
  "and",
  "getMessage",
  "getPred",
  "getSpread",
  "isOpt",
  "validatePred",
];

const CONFIG_ERROR_MSG =
  "SvelteSpecma must be configured with a valid Specma version.";

export let specma = undefined;

export function ensureConfigured() {
  if (!specma) {
    throw new TypeError(CONFIG_ERROR_MSG);
  }
}

export default function configure(specmaFns) {
  if (
    !specmaFns ||
    REQUIRED_SPECMA_FNS.some((key) => typeof specmaFns[key] !== "function")
  ) {
    throw new TypeError(CONFIG_ERROR_MSG);
  }
  specma = specmaFns;
}
