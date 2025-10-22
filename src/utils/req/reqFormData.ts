import { isArray, isDefined, isObject } from "../check";
import { jsonStringify } from "../json";
import { FormDataObject } from "./reqTypes";

export const reqFormData = (form: FormDataObject | FormData | null | undefined, base?: FormData) => {
  if (!form) return;
  if (form instanceof FormData) return form;
  const r = base || new FormData();
  for (const k in form) {
    let v = form[k];
    if (isObject(v)) {
      if (isArray(v)) {
        for (const child of v) r.append(k, child as any);
        v = undefined;
      } else if (v instanceof File) {
      } else if (v instanceof Blob) {
      } else if (v instanceof Date) {
        v = v.toISOString();
      }
      else {
        v = jsonStringify(v);
      }
    }
    if (isDefined(v)) {
      r.append(k, v);
    }
  }
  return r;
};