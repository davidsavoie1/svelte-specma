import { identity } from "./util";

export default function register(el, storeOrArgs) {
  let args = normalizeArgs(storeOrArgs);
  if (!el || !args.store) return;

  let unsub;
  listen();

  function blurHandler() {
    args.store.activate();
  }

  function inputHandler(e) {
    args.store.set(args.toValue(e.target.value));
  }

  function listen() {
    unsub = args.store.subscribe(({ value }) => {
      const elValue = args.toInput(value);
      if (el.value !== elValue) el.value = elValue;
    });
    el.addEventListener("blur", blurHandler);
    el.addEventListener("input", inputHandler);
  }

  function unlisten() {
    unsub();
    el.removeEventListener("blur", blurHandler);
    el.removeEventListener("input", inputHandler);
  }

  return {
    destroy: unlisten,
    update(newArgs) {
      unlisten();
      if (!newArgs) return;
      args = normalizeArgs(newArgs);
      listen();
    },
  };
}

function normalizeArgs(storeOrArgs) {
  if (!storeOrArgs) return {};

  if (!Array.isArray(storeOrArgs)) {
    return {
      store: storeOrArgs,
      toInput: identity,
      toValue: identity,
    };
  }

  const [store, { toInput = identity, toValue = identity } = {}] = storeOrArgs;
  return { store, toInput, toValue };
}
