import collSpecable from "./collSpecable";
import predSpecable from "./predSpecable";
import { isColl, isStore } from "./util";

export default function specable(initialValue, options = {}, _extra) {
  if (isStore(initialValue)) return initialValue;

  const collCandidate = options.fields || options.spec || initialValue;

  if (isColl(collCandidate)) {
    return collSpecable(initialValue, options, { ..._extra, specable });
  }

  return predSpecable(initialValue, options, _extra);
}
