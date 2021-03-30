export default function register(el, specableStore) {
  if (!el || !specableStore) return;

  let store = specableStore;
  let unsub;
  listen();

  function blurHandler() {
    store.activate();
  }

  function inputHandler(e) {
    store.set(e.target.value);
  }

  function listen() {
    unsub = store.subscribe(({ value = "" }) => {
      if (el.value !== value) el.value = value;
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
    update(newStore) {
      unlisten();
      if (!newStore) return;
      store = newStore;
      listen();
    },
  };
}
