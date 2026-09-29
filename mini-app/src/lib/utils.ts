import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import type { MutableRefObject, Ref } from "react";

/**
 * tailwind-merge has to know our design scale. Without it `text-button` (a
 * font size) looks like a text *colour*, and in `cn("text-button glass
 * text-ink")` the size is silently dropped as "overridden" by `text-ink`;
 * likewise `rounded-pill` would not override `rounded-[26px]`.
 * Keep in step with `fontSize` / `borderRadius` in tailwind.config.ts.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display-xl", "display-lg", "display-md", "display-sm",
        "title-lg", "title-md", "title-sm",
        "body-md", "body-sm",
        "caption", "caption-upper", "button",
      ],
      radius: ["xs", "pill"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** One ref callback that fans out to several refs (callback or object). */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const r of refs) {
      if (typeof r === "function") r(node);
      else if (r) (r as MutableRefObject<T | null>).current = node;
    }
  };
}
